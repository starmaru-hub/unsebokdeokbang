"""JS 엔진 검증용: 무작위 입력과 파이썬 엔진 결과를 JSON 으로 저장한다.

실행:  python scripts/js_parity.py [출력파일] [건수]
그다음 node scripts/js_parity.mjs [출력파일] 로 JS 결과와 비교한다.
"""
from __future__ import annotations

import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app import main as M  # noqa: E402
from engine import regions  # noqa: E402

OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "parity_cases.json"
N = int(sys.argv[2]) if len(sys.argv) > 2 else 60
rnd = random.Random(20261103)

KOREAN_REGIONS = [k for k, v in regions.REGIONS.items() if v[1] == "Asia/Seoul"]
ALL_REGIONS = list(regions.REGIONS)
SURNAMES = ["김", "이", "박", "최", "정", "강", "윤", "남궁", "제갈", "홍"]
NAMES = ["홍길동", "김철수", "이영희", "박서준", "최하윤", "남궁민수", "정도윤", "강지우", "윤서아", "임채원"]
QUESTIONS = ["올해 이직해도 될까요?", "언제 결혼하면 좋을까요", "2028년에 이사 가도 괜찮나요", "돈은 언제 모일까요",
             "건강이 걱정돼요", "그냥 궁금해요", "내년 시험 합격할까요 그리고 연애운도", "자녀운과 부모님 건강", "동업해도 될까요"]


EDGE_YEARS = [1948, 1949, 1950, 1951, 1955, 1956, 1957, 1958, 1959, 1960, 1987, 1988, 1954, 1961, 1908, 1912]


def birth(korean_only=False):
    y = rnd.choice(EDGE_YEARS) if rnd.random() < 0.3 else rnd.randint(1902, 2099)
    m = rnd.randint(1, 12)
    d = rnd.randint(1, 28)
    b = {"year": y, "month": m, "day": d, "gender": rnd.choice("MF")}
    if rnd.random() < 0.15 and y <= 2049:
        b["calendar"] = "lunar"
    if rnd.random() < 0.85:
        b["hour"] = rnd.choice([23, 0, 1, 22]) if rnd.random() < 0.3 else rnd.randint(0, 23)
        b["minute"] = rnd.randint(0, 59)
    if rnd.random() < 0.1:   # 절입일(2월 4일 무렵 등) 경계
        b["month"], b["day"] = rnd.choice([(2, 4), (3, 6), (4, 5), (5, 6), (6, 6), (7, 7), (8, 8), (9, 8), (10, 8), (11, 7), (12, 7), (1, 6)])
    b["region"] = rnd.choice(KOREAN_REGIONS if korean_only or rnd.random() < 0.8 else ALL_REGIONS)
    if b["region"] not in KOREAN_REGIONS:
        b["year"] = min(b["year"], 2024)   # 해외 미래 서머타임 규칙은 시간대 데이터 버전마다 달라 비교에서 뺀다
    if rnd.random() < 0.2:
        b["zi_mode"] = "yajasi"
    if rnd.random() < 0.15:
        b["apply_eot"] = True
    return b


def call(fn, model, payload):
    try:
        return {"ok": json.loads(json.dumps(fn(model(**payload)), ensure_ascii=False, default=str))}
    except Exception as e:  # noqa: BLE001  — 오류 메시지도 비교
        return {"error": str(getattr(e, "detail", e))}


def main():
    cases = []
    for _ in range(N):
        b = birth()
        nm = rnd.choice(NAMES)
        p = {**b, "name_kr": nm, "question": rnd.choice(QUESTIONS) if rnd.random() < 0.7 else None}
        cases.append({"route": "POST /api/saju", "body": p, "py": call(M.api_saju, M.SajuReq, p)})
    for _ in range(max(6, N // 6)):
        r = {"birth": birth(True), "surname_kr": rnd.choice(SURNAMES),
             "options": {"min_tier": rnd.choice([1, 2, 4]), "sound_school": rnd.choice(["modern", "hunmin"]), "top_n": 10}}
        roll = rnd.random()
        if roll < 0.25:
            r["options"].update({"fixed_syllable": "준", "fixed_position": 1})
        elif roll < 0.4:
            r["options"]["candidates"] = ["서윤", "하린", "지안", "도윤"]
        if rnd.random() < 0.4:
            r["parents"] = [{"label": "아버지", "name": "김철수", **birth(True)}, {"label": "어머니", "name": "이영희", **birth(True)}]
        cases.append({"route": "POST /api/naming", "body": r, "py": call(M.api_naming, M.NamingReq, r)})
    for _ in range(max(6, N // 4)):
        r = {"birth": birth(True), "surname_kr": "박", "given": [{"h": "志", "r": "지"}, {"h": "成", "r": "성"}],
             "options": {}, "parents": [{"label": "아버지", **birth(True)}] if rnd.random() < 0.5 else []}
        cases.append({"route": "POST /api/evaluate", "body": r, "py": call(M.api_evaluate, M.EvalReq, r)})
    for _ in range(max(6, N // 3)):
        married = rnd.random() < 0.4
        r = {"a": {**birth(), "name": rnd.choice(NAMES), "gender": "M"}, "b": {**birth(), "name": rnd.choice(NAMES), "gender": "F"},
             "married": married, "wedding_date": f"{rnd.randint(1990, 2025)}-{rnd.randint(1, 12):02d}-{rnd.randint(1, 28):02d}" if married else None}
        cases.append({"route": "POST /api/couple", "body": r, "py": call(M.api_couple, M.CoupleReq, r)})
    for _ in range(max(6, N // 3)):
        comp = birth()
        comp.pop("gender", None)
        r = {"rep": {**birth(), "name": rnd.choice(NAMES)}, "company": comp, "company_name": rnd.choice(["한빛솔루션", "운세복덕방", "미래상사", ""])}
        cases.append({"route": "POST /api/business", "body": r, "py": call(M.api_business, M.BizReq, r)})
    for q in ["민", "서", "金", "김", "준"]:
        cases.append({"route": "GET /api/hanja", "body": {"q": q, "limit": 50}, "py": {"ok": M.api_hanja(q, 50)}})
    for kr in ["김", "이", "남궁", "휘"]:
        cases.append({"route": "GET /api/surnames", "body": {"kr": kr}, "py": {"ok": M.api_surnames(kr)}})
    cases.append({"route": "GET /api/regions", "body": {}, "py": {"ok": M.api_regions()}})
    OUT.write_text(json.dumps(cases, ensure_ascii=False), encoding="utf-8")
    print(f"{len(cases)} cases → {OUT}")


if __name__ == "__main__":
    main()
