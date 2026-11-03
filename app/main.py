"""운세복덕방 로컬 개발 서버.

실제 서비스는 서버 없이 GitHub Pages 에서 돌아간다 (계산: app/static/js/engine).
이 파일의 /api/* 는 파이썬 엔진을 그대로 노출하는 참고·검증용이다.

실행:  python -m uvicorn app.main:app --port 8000   →  http://localhost:8000
또는:  cd app/static && python -m http.server 8000   (서버 없는 실제 배포와 똑같은 방식)
"""
from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from engine import regions
from engine.manse import BirthInput
from engine.naming.hanja_db import get_db
from engine.naming.namer import NamingOptions
from engine.compat import business, couple
from engine.pipeline import run_evaluate, run_naming, run_saju

STATIC = Path(__file__).resolve().parent / "static"

app = FastAPI(title="운세복덕방 API", version="0.1.0")


@app.middleware("http")
async def revalidate_static(request, call_next):
    """화면 파일은 매번 최신 여부를 확인 (수정 후 예전 화면이 남지 않도록)."""
    resp = await call_next(request)
    if not request.url.path.startswith("/api/"):
        resp.headers["Cache-Control"] = "no-cache"
    return resp


class Birth(BaseModel):
    year: int = Field(ge=1900, le=2100)
    month: int = Field(ge=1, le=12)
    day: int = Field(ge=1, le=31)
    hour: int | None = Field(default=None, ge=0, le=23)
    minute: int = Field(default=0, ge=0, le=59)
    calendar: Literal["solar", "lunar"] = "solar"
    leap_month: bool = False
    gender: Literal["M", "F"] = "M"
    region: str = regions.DEFAULT_REGION
    zi_mode: Literal["jojasi", "yajasi"] = "jojasi"
    apply_eot: bool = False

    def to_input(self) -> BirthInput:
        return BirthInput(**self.model_dump())


class Options(BaseModel):
    sound_school: Literal["modern", "hunmin"] = "modern"
    min_tier: int = Field(default=2, ge=0, le=5)
    exclude_soft_bad: bool = False
    allow_suri_bad: bool = False
    fixed_syllable: str | None = None
    fixed_position: int = Field(default=0, ge=0, le=1)
    fixed_hanja: str | None = None
    candidates: list[str] = []
    single_name: bool = False
    top_n: int = Field(default=30, ge=1, le=100)

    def to_opts(self) -> NamingOptions:
        d = self.model_dump()
        d["fixed_syllable"] = d["fixed_syllable"] or None
        d["fixed_hanja"] = d["fixed_hanja"] or None
        return NamingOptions(**d)


class ParentBirth(Birth):
    label: str = Field(default="부모", max_length=10)   # 아버지 / 어머니
    name: str | None = Field(default=None, max_length=10)


class NamingReq(BaseModel):
    birth: Birth
    surname_kr: str = Field(min_length=1, max_length=2)
    surname_hanja: str | None = None
    options: Options = Options()
    parents: list[ParentBirth] = Field(default=[], max_length=2)   # 부모 사주 반영(선택)


class GivenChar(BaseModel):
    h: str = Field(min_length=1, max_length=1)
    r: str = Field(min_length=1, max_length=1)


class EvalReq(BaseModel):
    birth: Birth
    surname_kr: str
    surname_hanja: str | None = None
    given: list[GivenChar] = Field(min_length=1, max_length=2)
    options: Options = Options()
    parents: list["ParentBirth"] = Field(default=[], max_length=2)   # 부모 사주 반영(선택)


def _guard(fn, *a):
    try:
        return fn(*a)
    except (ValueError, KeyError) as e:
        raise HTTPException(400, str(e).strip("'"))


@app.get("/api/regions")
def api_regions():
    return [{"name": k, "lon": v[0], "tz": v[1]} for k, v in regions.REGIONS.items()]


@app.get("/api/surnames")
def api_surnames(kr: str):
    db = get_db()
    opts = db.surname_options(kr)
    # 목록에 없는 성씨는 해당 음의 인명용 한자 전체를 후보로
    if not opts and len(kr) == 1:
        opts = [{"kr": kr, "hanja": e["h"], "chars": [e]} for e in db.search(kr, 60)]
    return [{"kr": o["kr"], "hanja": o["hanja"],
             "meaning": " ".join(c["m"].split("/")[0] for c in o["chars"]),
             "strokes": [c["won"] for c in o["chars"]]} for o in opts]


@app.get("/api/hanja")
def api_hanja(q: str, limit: int = 200):
    return get_db().search(q, limit)


class SajuReq(Birth):
    name_kr: str | None = Field(default=None, max_length=10)     # 성 포함 한글 이름
    name_hanja: str | None = Field(default=None, max_length=10)  # 글자 수만큼, 모르는 자리는 공백
    question: str | None = Field(default=None, max_length=500)   # 궁금한 점(자유 질문)

    def to_input(self) -> BirthInput:
        return BirthInput(**self.model_dump(exclude={"name_kr", "name_hanja", "question"}))


@app.post("/api/saju")
def api_saju(b: SajuReq):
    return _guard(run_saju, b.to_input(), True, b.name_kr, b.name_hanja, b.question)


@app.post("/api/naming")
def api_naming(req: NamingReq):
    parents = [(p.label, BirthInput(**p.model_dump(exclude={"label", "name"})), p.name) for p in req.parents]
    return _guard(run_naming, req.birth.to_input(), req.surname_kr, req.surname_hanja, req.options.to_opts(), parents)


@app.post("/api/evaluate")
def api_evaluate(req: EvalReq):
    parents = [(p.label, BirthInput(**p.model_dump(exclude={"label", "name"})), p.name) for p in req.parents]
    return _guard(run_evaluate, req.birth.to_input(), req.surname_kr, req.surname_hanja,
                  [(g.h, g.r) for g in req.given], req.options.to_opts(), parents)


class Person(Birth):
    name: str | None = Field(default=None, max_length=20)
    name_hanja: str | None = Field(default=None, max_length=20)  # 글자 수만큼, 모르는 자리는 공백


class CoupleReq(BaseModel):
    a: Person
    b: Person
    married: bool = False
    wedding_date: date | None = None   # 결혼한 경우 결혼 날짜


class BizReq(BaseModel):
    rep: Person
    company: Birth            # 설립일(법인 등기일)·시각·소재지
    company_name: str | None = Field(default=None, max_length=30)


def _birth(p: BaseModel) -> BirthInput:
    return BirthInput(**p.model_dump(exclude={"name", "name_hanja"}))


@app.post("/api/couple")
def api_couple(req: CoupleReq):
    if req.married and not req.wedding_date:
        raise HTTPException(400, "결혼 날짜를 입력해 주세요")
    return _guard(couple, _birth(req.a), req.a.name, _birth(req.b), req.b.name, None, req.married, req.wedding_date,
                  req.a.name_hanja, req.b.name_hanja)


@app.post("/api/business")
def api_business(req: BizReq):
    return _guard(business, _birth(req.rep), req.rep.name, _birth(req.company), req.company_name, None, req.rep.name_hanja)


# 화면은 app/static 이 그대로 사이트 루트 (GitHub Pages 와 같은 구조). 계산은 브라우저의 js/engine 이 한다.
app.mount("/", StaticFiles(directory=STATIC, html=True), name="site")
