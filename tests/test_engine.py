"""실행: python -m pytest tests -q"""
from datetime import date

from engine.manse import BirthInput, _pillar_day, compute
from engine.naming.hanja_db import get_db
from engine.naming.namer import NamingOptions
from engine.naming.suri import four_grids
from engine.pipeline import run_evaluate, run_naming
from engine.saju import analyze


def pillars(**kw):
    return " ".join(p.text for p in compute(BirthInput(**kw)).pillars)


def test_day_pillar_reference():
    assert _pillar_day(date(2000, 1, 1)).text == "戊午"


def test_ipchun_boundary_1990():
    # 1990 입춘 = 2월 4일 11:14 KST
    assert pillars(year=1990, month=2, day=4, hour=11, minute=0).startswith("己巳 丁丑")
    assert pillars(year=1990, month=2, day=4, hour=11, minute=30).startswith("庚午 戊寅")


def test_summer_time_and_longitude():
    s = compute(BirthInput(1987, 7, 15, hour=0, minute=40))  # 서머타임 +1h, 서울 경도 -32분
    assert s.correction_minutes == -92.1
    assert s.pillars[3].ji == "子"


def test_lunar_input():
    s = compute(BirthInput(1990, 5, 15, hour=8, calendar="lunar"))
    assert s.solar_date == "1990-06-07"


def test_unknown_hour_three_pillars():
    s = compute(BirthInput(2025, 3, 3))
    assert len(s.pillars) == 3 and analyze(s)["needed_elements"]


def test_won_strokes():
    db = get_db()
    assert {h: db.char(h)["won"] for h in "江花陽都鄭"} == {"江": 7, "花": 10, "陽": 17, "都": 16, "鄭": 19}


def test_four_grids():
    g = four_grids([8], [13, 16])  # 金渡潤
    assert [g[k]["num"] for k in ("won", "hyeong", "i", "jeong")] == [29, 21, 24, 37]


def test_naming_pipeline():
    r = run_naming(BirthInput(2026, 10, 20, hour=9, minute=30), "김", "金", NamingOptions(top_n=5))
    assert len(r["names"]) == 5
    top = r["names"][0]
    assert all(g["level"] > 0 for g in top["suri"].values())
    assert top["hanja"].startswith("金")


def test_dolimja():
    r = run_naming(BirthInput(2026, 1, 1, hour=10), "이", "李",
                   NamingOptions(fixed_syllable="준", fixed_position=1, fixed_hanja="俊", top_n=5))
    assert all(n["hangul"].endswith("준") and n["hanja"].endswith("俊") for n in r["names"])


def test_evaluate():
    r = run_evaluate(BirthInput(1990, 6, 7, hour=8), "박", "朴", [("志", "지"), ("成", "성")], NamingOptions())
    assert 0 < r["evaluation"]["score"] <= 100


def test_five_roles_distinct():
    a = analyze(compute(BirthInput(1990, 6, 7, hour=8)))
    assert sorted(a["roles"].values()) == sorted(["용신", "희신", "한신", "구신", "기신"])


def test_couple_and_business():
    from engine.compat import business, couple
    c = couple(BirthInput(1990, 6, 7, hour=8, gender="M"), "철수", BirthInput(1992, 3, 15, gender="F"), "영희")
    assert 0 < c["overall"] <= 100 and c["categories"][-1]["key"] == "wedding"
    from datetime import date
    m = couple(BirthInput(1990, 6, 7, hour=8, gender="M"), "철수", BirthInput(1992, 3, 15, gender="F"), "영희",
               married=True, wedding=date(2019, 5, 18))
    assert m["categories"][-1]["title"] == "결혼일 풀이"
    b = business(BirthInput(1975, 4, 20, hour=10), "김대표", BirthInput(2015, 9, 1), "한빛솔루션")
    assert 0 < b["overall"] <= 100 and len(b["years"]) == 5


def test_naming_with_parents():
    r = run_naming(BirthInput(2026, 10, 20, hour=9, gender="F"), "김", "金", NamingOptions(top_n=3),
                   [("아버지", BirthInput(1990, 6, 7, hour=8)), ("어머니", BirthInput(1992, 3, 15, gender="F"))])
    assert len(r["parents"]) == 2
    assert all("부모조화" in n["breakdown"] for n in r["names"])


def test_evaluate_with_parents():
    r = run_evaluate(BirthInput(2026, 10, 20, hour=9, gender="F"), "김", "金", [("玟", "민"), ("周", "주")], NamingOptions(),
                     [("아버지", BirthInput(1990, 6, 7, hour=8), "김철수")])
    assert r["parents"][0]["name"] == "김철수" and "부모조화" in r["evaluation"]["breakdown"]


def test_question_focus():
    from engine.pipeline import run_saju
    q = run_saju(BirthInput(1990, 6, 7, hour=8), True, "홍길동", None, "올해 이직해도 될까요?")["fortune"]["question"]
    assert q["topics"] == ["직장 · 진로"] and q["years"] and len(q["sections"][0]["years"]) == 10
