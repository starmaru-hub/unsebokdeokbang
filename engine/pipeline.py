"""작명 전체 파이프라인: 출생정보 → 만세력 → 사주 분석 → 한자 이름 추천."""
from __future__ import annotations

from .fortune import interpret
from .manse import BirthInput, compute
from .naming.hanja_db import get_db
from .naming.namer import Namer, NamingOptions, evaluate_name
from .saju import analyze


def resolve_surname(kr: str, hanja: str | None) -> list[dict]:
    db = get_db()
    if hanja:
        chars = []
        for i, h in enumerate(hanja):
            e = db.char(h, kr[i] if len(kr) == len(hanja) else None) or db.char(h)
            if not e:
                raise ValueError(f"성씨 한자를 찾을 수 없습니다: {h}")
            chars.append(e)
        return chars
    opts = db.surname_options(kr)
    if not opts:
        raise ValueError(f"'{kr}' 성씨의 한자를 지정해 주세요")
    return opts[0]["chars"]


def given_name_chars(name_kr: str | None, name_hanja: str | None) -> list[dict]:
    """성을 뺀 이름 글자의 발음오행 (사주 8자 + 이름 = 10자 분석용)."""
    from .naming.sound import sound_element
    name_kr = (name_kr or "").strip()
    if len(name_kr) < 2 or not all("가" <= ch <= "힣" for ch in name_kr):
        return []
    db = get_db()
    two = any(s["kr"] == name_kr[:2] for s in db.surnames if len(s["kr"]) == 2)
    sur_len = 2 if (two and len(name_kr) >= 3) or len(name_kr) >= 4 else 1
    hanja = list(name_hanja or "")
    out = []
    for i, ch in enumerate(name_kr):
        if i < sur_len:
            continue
        h = hanja[i] if i < len(hanja) and hanja[i].strip() else None
        e = db.char(h, ch) if h else None
        # 사주 풀이에서 이름 오행은 발음오행(초성)으로 본다. 한자는 표시용
        out.append({"kr": ch, "h": e["h"] if e else "", "element": sound_element(ch), "basis": "발음"})
    return out


def run_saju(birth: BirthInput, with_fortune: bool = False,
             name_kr: str | None = None, name_hanja: str | None = None, question: str | None = None) -> dict:
    saju = compute(birth)
    name_chars = given_name_chars(name_kr, name_hanja) if with_fortune else []
    res = {"saju": saju.to_dict(), "analysis": analyze(saju, name_chars)}
    if name_chars:
        # 이름을 넣기 전(사주 8자만)과 비교할 수 있도록 요약을 남긴다
        a8 = analyze(saju)
        res["analysis_saju8"] = {"strength": a8["strength"], "yong": a8["yongsin"]["element"], "hee": a8["heesin"]["element"],
                                 "gi": a8["gisin"]["element"], "roles": a8["roles"], "element_count": a8["element_count"]}
    if with_fortune:
        res["fortune"] = interpret(saju, res["analysis"], birth.gender, name_kr=name_kr, name_hanja=name_hanja,
                                   question=question)
    return res


def _parents(parents: list[tuple] | None, res: dict) -> list[dict]:
    """[("아버지", BirthInput, "홍길동"), ...] → Namer 용 부모 분석 목록 (+ res["parents"] 요약)."""
    par = []
    for label, pb, *rest in parents or []:
        pname = rest[0] if rest else None
        ps = compute(pb)
        pa = analyze(ps)
        par.append({"label": label, "analysis": pa})
        res.setdefault("parents", []).append({
            "label": label, "name": pname, "pillars": " ".join(p.text for p in ps.pillars), "day_master": pa["day_master"],
            "strength": pa["strength"]["label"], "needed": pa["needed_elements"], "gisin": pa["gisin"]["element"],
            "roles": pa["roles"]})
    return par


def run_naming(birth: BirthInput, surname_kr: str, surname_hanja: str | None, opts: NamingOptions,
               parents: list[tuple] | None = None) -> dict:
    """parents: [("아버지", BirthInput, "홍길동"), ...] — 주면 부모 사주와의 조화까지 반영 (이름은 선택)."""
    opts.gender = birth.gender
    res = run_saju(birth)
    sur = resolve_surname(surname_kr, surname_hanja)
    par = _parents(parents, res)
    names = Namer(res["analysis"], sur, surname_kr, opts, par).recommend()
    res["surname"] = {"kr": surname_kr, "hanja": "".join(c["h"] for c in sur),
                      "strokes": [c["won"] for c in sur], "elements": [c["jw"] for c in sur]}
    res["names"] = names
    return res


def run_evaluate(birth: BirthInput, surname_kr: str, surname_hanja: str | None,
                 given: list[tuple[str, str]], opts: NamingOptions, parents: list[tuple] | None = None) -> dict:
    opts.gender = birth.gender
    res = run_saju(birth)
    sur = resolve_surname(surname_kr, surname_hanja)
    res["evaluation"] = evaluate_name(res["analysis"], sur, surname_kr, given, opts, _parents(parents, res))
    return res
