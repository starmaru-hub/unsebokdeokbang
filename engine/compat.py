"""두 사주 비교 분석: 궁합(커플·부부)과 기업 사주(대표자 + 회사 설립일).

점수는 기준 60에서 근거마다 가감한 상대적 지표이며, 항목마다 풀이 문장을 함께 만든다.
"""
from __future__ import annotations

from datetime import date

from .constants import GAN, GAN_KR, GAN_OH, GEUK, JI, JI_ANIMAL, JI_KR, OHAENG, OHAENG_KR, SAENG, ganji_kr, ganji_name
from .fortune import OH_JOBS, _Ctx, _period, _clamp, _stars, interpret, j, name_ohaeng
from .manse import BirthInput, compute
from .saju import DAY_MASTER_DESC, GAN_HAP, JI_CHUNG, JI_SAMHAP, JI_YUKHAP, analyze, element_of_group

WONJIN = [frozenset(p) for p in ("子未", "丑午", "寅酉", "卯申", "辰亥", "巳戌")]
OH_VIRTUE = {"木": "인(仁)", "火": "예(禮)", "土": "신(信)", "金": "의(義)", "水": "지(智)"}


def _grade(score: int) -> str:
    return "천생연분" if score >= 85 else "매우 좋음" if score >= 75 else "좋음" if score >= 65 else "보통" if score >= 52 else "노력 필요"


def _oh(o: str) -> str:
    return f"{o}({OHAENG_KR[o]})"


def _gan_relation(a: str, b: str) -> tuple[str, str | None]:
    """천간 a(나)와 b(상대)의 관계: 합 / 비화 / 내가생 / 상대가생 / 내가극 / 상대가극."""
    if frozenset(a + b) in GAN_HAP:
        return "합", GAN_HAP[frozenset(a + b)]
    oa, ob = GAN_OH[GAN.index(a)], GAN_OH[GAN.index(b)]
    if oa == ob:
        return "비화", None
    if SAENG[oa] == ob:
        return "내가생", None
    if SAENG[ob] == oa:
        return "상대가생", None
    if GEUK[oa] == ob:
        return "내가극", None
    return "상대가극", None


def _ji_relation(a: str, b: str) -> str | None:
    pair = frozenset(a + b)
    if a == b:
        return "같음"
    if pair in JI_YUKHAP:
        return "육합"
    if pair in JI_CHUNG:
        return "충"
    if pair in WONJIN:
        return "원진"
    if any(a in t and b in t for t in JI_SAMHAP):
        return "삼합"
    return None


def _support(need: list[str], other: dict) -> float:
    """상대 사주에서 내 용신·희신 오행이 차지하는 비율."""
    sc = other["element_score"]
    total = sum(sc.values()) or 1
    return sum(sc[o] for o in need[:2]) / total


def _person_summary(name: str, s, a: dict) -> dict:
    return {"name": name, "pillars": " ".join(p.text for p in s.pillars), "day_master": a["day_master"],
            "strength": a["strength"]["label"], "yong": a["yongsin"]["element"], "roles": a["roles"],
            "element_count": a["element_count"], "element_count_saju": a.get("element_count_saju"),
            "name_elements": a.get("name_elements", []), "basis": a.get("basis"), "animal": s.year_animal}


# ───────────── 궁합 ─────────────
def couple(b1: BirthInput, n1: str, b2: BirthInput, n2: str, year: int | None = None,
           married: bool = False, wedding: date | None = None,
           h1: str | None = None, h2: str | None = None) -> dict:
    year = year or date.today().year
    from .pipeline import given_name_chars
    s1, s2 = compute(b1), compute(b2)
    # 두 사람 모두 사주 8자 + 이름 2자(발음오행) = 10자로 분석
    a1 = analyze(s1, given_name_chars(n1, h1))
    a2 = analyze(s2, given_name_chars(n2, h2))
    n1, n2 = n1 or "첫 번째 분", n2 or "두 번째 분"
    cats = []

    # 1) 성격 궁합 — 일간 관계
    d1, d2 = s1.day_gan, s2.day_gan
    rel, hap = _gan_relation(d1, d2)
    score = 60
    pts = [f"{n1}님은 {DAY_MASTER_DESC[d1].split('.')[0]}, {n2}님은 {DAY_MASTER_DESC[d2].split('.')[0]}입니다."]
    if rel == "합":
        score += 25
        pts.append(f"두 분의 일간 {d1}·{d2}는 천간합({_oh(hap)})을 이룹니다. 처음 만나도 낯설지 않고 서로에게 자연스럽게 끌리는, 궁합에서 가장 좋게 보는 관계입니다.")
    elif rel == "비화":
        score += 6
        pts.append("두 분의 일간이 같은 오행이라 친구처럼 말이 잘 통하고 가치관이 비슷합니다. 다만 둘 다 자기 방식을 고집하면 부딪힐 수 있어 역할 분담이 중요합니다.")
    elif rel == "내가생":
        score += 12
        pts.append(f"{n1}님의 기운이 {n2}님을 생(生)해 주는 관계입니다. {n1}님이 아끼고 챙겨 주며 {n2}님은 그 안에서 편안함을 느낍니다. 받는 쪽이 고마움을 표현하면 더욱 단단해집니다.")
    elif rel == "상대가생":
        score += 12
        pts.append(f"{n2}님의 기운이 {n1}님을 생(生)해 주는 관계입니다. {n2}님이 든든한 버팀목이 되어 주고 {n1}님은 그 덕에 힘을 얻습니다.")
    elif rel == "내가극":
        score -= 4
        pts.append(f"{n1}님이 {n2}님을 극(剋)하는 관계라 {n1}님이 주도권을 쥐기 쉽고 {n2}님은 압박감을 느낄 수 있습니다. 상대의 속도를 존중하면 오히려 서로를 잘 다듬어 주는 관계가 됩니다.")
    else:
        score -= 4
        pts.append(f"{n2}님이 {n1}님을 극(剋)하는 관계라 {n2}님의 의견이 강하게 작용하기 쉽습니다. {n1}님이 마음을 솔직하게 표현하는 것이 균형의 열쇠입니다.")
    cats.append({"key": "mind", "title": "성격 궁합", "hanja": "性", "score": _clamp(score), "headline": f"일간 {d1} · {d2}", "points": pts})

    # 2) 애정·생활 궁합 — 일지(배우자궁)
    j1, j2 = s1.pillars[2].ji, s2.pillars[2].ji
    r = _ji_relation(j1, j2)
    score = 62
    pts = [f"배우자 자리인 일지는 {n1}님 {j1}({JI_KR[JI.index(j1)]}), {n2}님 {j2}({JI_KR[JI.index(j2)]})입니다."]
    msg = {
        "육합": (20, "일지가 육합을 이뤄 정이 깊고 함께 있을 때 편안합니다. 생활 리듬과 애정 표현이 잘 맞는 좋은 궁합입니다."),
        "삼합": (12, "일지가 삼합의 한 축을 이뤄 같은 목표를 향해 힘을 모으기 좋습니다."),
        "같음": (2, "일지가 같아 생활 습관이 닮았습니다. 편하지만 서로의 단점도 비슷해 함께 보완할 부분을 정해 두면 좋습니다."),
        "충": (-18, "일지가 충(沖)하여 생활 방식과 감정 표현이 달라 다툼이 생기기 쉽습니다. 각자의 공간과 시간을 인정해 주면 충의 기운이 오히려 활력이 됩니다."),
        "원진": (-12, "일지가 원진(怨嗔) 관계라 사소한 일에 서운함이 쌓이기 쉽습니다. 오해가 생기면 바로 대화로 푸는 습관이 중요합니다."),
    }
    if r in msg:
        score += msg[r][0]
        pts.append(msg[r][1])
    else:
        pts.append("일지 사이에 특별한 합이나 충이 없어 무난한 관계로, 함께 쌓아 가는 노력에 따라 깊어집니다.")
    m1, m2 = s1.pillars[1].ji, s2.pillars[1].ji
    if frozenset(m1 + m2) in JI_CHUNG:
        score -= 6
        pts.append("월지(집안·환경)가 충하여 두 집안의 분위기나 생활 배경이 크게 다를 수 있습니다.")
    elif frozenset(m1 + m2) in JI_YUKHAP:
        score += 5
        pts.append("월지(집안·환경)가 합을 이뤄 양가와의 관계도 원만한 편입니다.")
    cats.append({"key": "love", "title": "애정 · 생활 궁합", "hanja": "情", "score": _clamp(score), "headline": f"배우자궁 {j1} · {j2}", "points": pts})

    # 3) 오행 보완
    sup12, sup21 = _support(a1["needed_elements"], a2), _support(a2["needed_elements"], a1)
    score = 50 + (sup12 + sup21) * 70
    pts = [f"두 분 모두 사주에 이름 글자의 발음오행을 더해({n1}님 {sum(a1['element_count'].values())}자, "
           f"{n2}님 {sum(a2['element_count'].values())}자) 오행을 비교했습니다." if a1.get("name_elements") or a2.get("name_elements") else "",
           f"{n1}님에게 필요한 기운은 {'·'.join(_oh(o) for o in a1['needed_elements'][:2])}, "
           f"{n2}님에게 필요한 기운은 {'·'.join(_oh(o) for o in a2['needed_elements'][:2])}입니다."]
    for me, other, sup, a_other in ((n1, n2, sup12, a2), (n2, n1, sup21, a1)):
        if sup >= 0.35:
            pts.append(f"{other}님의 사주에 {me}님이 필요로 하는 기운이 풍부해({sup * 100:.0f}%), 함께 있으면 {me}님의 운이 살아납니다.")
        elif sup >= 0.2:
            pts.append(f"{other}님이 {me}님에게 필요한 기운을 어느 정도({sup * 100:.0f}%) 채워 줍니다.")
        else:
            pts.append(f"{other}님의 사주에는 {me}님에게 필요한 기운이 적어({sup * 100:.0f}%) 오행 보완 효과는 크지 않습니다.")
    pts = [x for x in pts if x]
    combined = {o: a1["element_count"][o] + a2["element_count"][o] for o in OHAENG}
    missing = [o for o in OHAENG if combined[o] == 0]
    pts.append("두 사주를 합치면 오행이 " + ("모두 갖춰져 균형이 좋습니다." if not missing else f"{j('·'.join(_oh(o) for o in missing), '이/가')} 없어 이 기운을 생활 속에서 보완하면 좋습니다."))
    cats.append({"key": "oh", "title": "오행 보완", "hanja": "補", "score": _clamp(score), "headline": "서로에게 필요한 기운을 채워 주는지", "points": pts,
                 "combined": combined})

    # 4) 배우자 인연 — 상대 일간이 내 배우자 별인가
    score = 58
    pts = []
    for me, b, s_me, s_other in ((n1, b1, s1, s2), (n2, b2, s2, s1)):
        dm_oh = GAN_OH[GAN.index(s_me.day_gan)]
        star = element_of_group(dm_oh, "재성" if b.gender == "M" else "관성")
        other_oh = GAN_OH[GAN.index(s_other.day_gan)]
        label = "아내·여자친구의 별(재성)" if b.gender == "M" else "남편·남자친구의 별(관성)"
        if other_oh == star:
            score += 12
            pts.append(f"상대의 일간 오행 {j(_oh(other_oh), '이/가')} {me}님에게 {label}에 해당해 배우자로서 인연이 깊습니다.")
        else:
            pts.append(f"{me}님의 {label}은 {_oh(star)}이고 상대의 일간은 {_oh(other_oh)}입니다.")
    if b1.gender == b2.gender:
        pts.append("동성 커플의 경우 배우자 별보다 성격·생활 궁합과 오행 보완을 중심으로 보시면 됩니다.")
    cats.append({"key": "star", "title": "배우자 인연", "hanja": "緣", "score": _clamp(score), "headline": "서로가 배우자 별인지", "points": pts})

    # 5) 띠 궁합
    y1, y2 = s1.pillars[0].ji, s2.pillars[0].ji
    r = _ji_relation(y1, y2)
    score = 62 + {"육합": 14, "삼합": 14, "같음": 4, "충": -12, "원진": -8}.get(r, 0)
    tti = {"육합": "육합으로 서로를 끌어당기는 좋은 띠 궁합입니다.", "삼합": "삼합으로 뜻이 잘 맞는 좋은 띠 궁합입니다.",
           "같음": "같은 띠라 공감대가 큽니다.", "충": "충하는 띠라 성향 차이가 크지만, 서로 다른 점이 오히려 보완이 될 수 있습니다.",
           "원진": "원진 관계의 띠라 사소한 감정 소모를 줄이는 배려가 필요합니다."}.get(r, "띠 사이에 특별한 합충이 없어 무난합니다.")
    cats.append({"key": "tti", "title": "띠 궁합", "hanja": "支", "score": _clamp(score),
                 "headline": f"{s1.year_animal}띠 · {s2.year_animal}띠", "points": [f"{n1}님 {s1.year_animal}띠({y1}), {n2}님 {s2.year_animal}띠({y2}). {tti}"]})

    # 6) 올해 두 사람의 운
    f1 = interpret(s1, a1, b1.gender, year)
    f2 = interpret(s2, a2, b2.gender, year)
    y1c = next(c for c in f1["categories"] if c["key"] == "year")
    y2c = next(c for c in f2["categories"] if c["key"] == "year")
    k = (year - 4) % 60
    score = round((y1c["score"] + y2c["score"]) / 2)
    pts = [f"{year}년 {ganji_name(k)}({ganji_kr(k)})년 {n1}님의 운은 {y1c['score']}점, {n2}님은 {y2c['score']}점입니다."]
    if max(y1c["score"], y2c["score"]) < 55:
        pts.append("두 분 모두 올해는 내실을 다질 해입니다. 큰 결정은 서로 충분히 상의하며 천천히 진행하고, 건강을 함께 챙기세요.")
    elif abs(y1c["score"] - y2c["score"]) >= 15:
        hi, lo = (n1, n2) if y1c["score"] > y2c["score"] else (n2, n1)
        pts.append(f"올해는 {hi}님의 운이 더 좋으니 중요한 결정은 {hi}님이 앞장서고, {lo}님은 건강과 내실을 챙기는 역할을 맡으면 좋습니다.")
    else:
        pts.append("두 분의 올해 운 흐름이 비슷해 함께 계획한 일을 같은 속도로 추진하기 좋습니다.")
    cats.append({"key": "year", "title": f"{year}년 함께하는 운", "hanja": "歲", "score": score, "headline": "두 사람의 올해 흐름", "points": pts})

    # 7) 결혼: 결혼일 풀이 또는 결혼하기 좋은 해
    people = ((n1, b1, s1, a1), (n2, b2, s2, a2))
    nc = _couple_names(people, (h1, h2))
    if nc:
        cats.append(nc)
    if married and wedding:
        cats.append(_wedding_day(people, wedding, year))
    elif not married:
        cats.append(_wedding_years(people, year))

    weights = {"mind": 0.25, "love": 0.25, "oh": 0.2, "star": 0.15, "tti": 0.1, "year": 0.05, "names": 0.1}
    used = [c for c in cats if c["key"] in weights]
    overall = round(sum(c["score"] * weights[c["key"]] for c in used) / sum(weights[c["key"]] for c in used))
    for c in cats:
        c["stars"] = _stars(c["score"])
        c.setdefault("advice", [])
    advice = []
    if any(c["key"] == "love" and c["score"] < 55 for c in cats):
        advice.append("다툼이 생기면 그날 안에 대화로 푸는 규칙을 정해 두세요.")
    lucky = [o for o in a1["needed_elements"][:2] if o in a2["needed_elements"][:2]]
    if lucky:
        advice.append(f"두 분 모두에게 좋은 기운은 {'·'.join(_oh(o) for o in lucky)}입니다. 신혼집 인테리어나 데이트 장소에 이 기운을 활용해 보세요.")
    advice.append("궁합 점수는 경향일 뿐이며, 서로를 이해하려는 마음이 가장 큰 궁합입니다.")
    return {
        "type": "couple", "year": year, "married": married, "wedding": wedding.isoformat() if wedding else None, "overall": overall, "grade": _grade(overall), "categories": cats, "advice": advice,
        "people": [_person_summary(n1, s1, a1), _person_summary(n2, s2, a2)],
        "sajus": [{"saju": s1.to_dict(), "analysis": a1}, {"saju": s2.to_dict(), "analysis": a2}],
    }


def _spouse_gods(gender: str) -> tuple[str, str]:
    return ("정재", "편재") if gender == "M" else ("정관", "편관")


def _wedding_day(people, wd: date, year: int) -> dict:
    """결혼한 날의 일진·월·해가 두 사람에게 어떤 날이었는지."""
    ws = compute(BirthInput(wd.year, wd.month, wd.day, hour=12))
    yp, mp, dp = ws.pillars[0], ws.pillars[1], ws.pillars[2]
    score = 60
    pts = [f"결혼일 {wd.year}년 {wd.month}월 {wd.day}일은 {yp.text}년 {mp.text}월 {dp.text}일({ganji_kr(dp.idx60)}일)입니다."]
    for name, b, s, a in people:
        c = _Ctx(s, a, b.gender)
        rel, hap = _gan_relation(s.day_gan, dp.gan)
        if rel == "합":
            score += 8
            pts.append(f"결혼일의 천간 {j(f'{dp.gan}({GAN_KR[GAN.index(dp.gan)]})', '이/가')} {name}님의 일간 {s.day_gan}과 천간합을 이뤄 마음이 하나로 묶이는 날이었습니다.")
        r = _ji_relation(s.pillars[2].ji, dp.ji)
        if r in ("육합", "삼합"):
            score += 6
            pts.append(f"결혼일의 지지 {j(f'{dp.ji}({JI_KR[JI.index(dp.ji)]})', '이/가')} {name}님의 배우자 자리({s.pillars[2].ji})와 {r}하여 부부 인연을 단단히 맺는 날이었습니다.")
        elif r == "충":
            score -= 8
            pts.append(f"결혼일의 지지 {j(f'{dp.ji}({JI_KR[JI.index(dp.ji)]})', '이/가')} {name}님의 배우자 자리({s.pillars[2].ji})와 충(沖)하는 날이었습니다. 결혼 초 생활 방식의 차이를 조율하는 노력이 특히 도움이 됩니다.")
        elif r == "원진":
            score -= 5
            pts.append(f"결혼일의 지지가 {name}님의 배우자 자리와 원진 관계라, 사소한 서운함을 그때그때 푸는 습관이 중요합니다.")
        sw = _period(c, yp.gan, yp.ji, "sw")
        score += round((sw["score"] - 60) * 0.3)
        sg = _spouse_gods(b.gender)
        star = any(g in sg for g in sw["gods"])
        if star:
            score += 4
        pts.append(f"결혼한 {wd.year}년은 {name}님에게 '{sw['level']}'({sw['score']}점)의 해였" +
                   ("고, 배우자 별이 들어온 해라 결혼 시기로 잘 맞았습니다." if star else "습니다."))
    married_years = year - wd.year + (0 if (date.today().month, date.today().day) < (wd.month, wd.day) else 1) - 1
    if married_years >= 0:
        stage = ("신혼기로 서로의 생활을 맞춰 가는 시기" if married_years < 3 else "가정의 기반을 다지는 시기" if married_years < 10
                 else "함께 쌓은 신뢰로 가정을 이끄는 시기" if married_years < 25 else "서로를 가장 잘 아는 동반자의 시기")
        pts.append(f"결혼 {married_years + 1}년 차로, {stage}입니다.")
    score = _clamp(score)
    head = "두 분에게 좋은 날 맺은 인연입니다" if score >= 70 else "무난한 날 맺은 인연입니다" if score >= 55 else "서로 맞춰 가는 노력이 빛나는 인연입니다"
    return {"key": "wedding", "title": "결혼일 풀이", "hanja": "婚", "score": score, "headline": head, "points": pts}


def _wedding_years(people, year: int) -> dict:
    """미혼 커플: 앞으로 6년 중 결혼하기 좋은 해."""
    rows = []
    for y in range(year, year + 6):
        k = (y - 4) % 60
        gan, ji = GAN[k % 10], JI[k % 12]
        sc, notes = 0, []
        for name, b, s, a in people:
            p = _period(_Ctx(s, a, b.gender), gan, ji, "sw")
            sc += p["score"] / 2
            if any(g in _spouse_gods(b.gender) for g in p["gods"]):
                sc += 5
                notes.append(f"{name}님 배우자 별")
            r = _ji_relation(s.pillars[2].ji, ji)
            if r in ("육합", "삼합"):
                sc += 4
                notes.append(f"{name}님 배우자궁 {r}")
            elif r == "충":
                sc -= 6
                notes.append(f"{name}님 배우자궁 충")
        rows.append((y, ganji_name(k), round(sc), notes))
    best = sorted(rows, key=lambda r: -r[2])[:2]
    pts = [f"앞으로 6년 중 결혼하기 가장 좋은 해는 {best[0][0]}년({best[0][1]})과 {best[1][0]}년({best[1][1]})입니다."]
    for y, gz, sc, notes in rows:
        pts.append(f"{y}년 {gz}: {sc}점" + (f" — {', '.join(notes)}" if notes else ""))
    pts.append("결혼 날짜(택일)는 두 분의 일간과 합하고 배우자 자리와 충하지 않는 날을 고르면 좋습니다.")
    return {"key": "wedding", "title": "결혼하기 좋은 해", "hanja": "婚", "score": _clamp(best[0][2]),
            "headline": f"{best[0][0]}년 · {best[1][0]}년 추천", "points": pts}


def _couple_names(people, hanjas) -> dict | None:
    """두 사람의 이름 오행: 각자 자기 사주에 맞는지 + 상대에게 필요한 기운을 주는지."""
    res = []
    for (name, b, s, a), h in zip(people, hanjas):
        r = name_ohaeng(_Ctx(s, a, b.gender), name, h) if name else None
        res.append(r)
    if not any(res):
        return None
    pts, scores, tables = [], [], []
    for i, r in enumerate(res):
        me, other = people[i], people[1 - i]
        if not r:
            pts.append(f"{me[0]}님의 이름은 한글이 아니어서 오행을 볼 수 없습니다.")
            continue
        scores.append(r["score"])
        tables.append({"name": me[0], "chars": r["chars"]})
        pts.append(f"[{me[0]}] {r['headline']} — " + " ".join(r["points"][:2]))
        els = [x["sound"] for x in r["chars"] if not x["is_surname"]]
        gift = sorted({o for o in els if o in other[3]["needed_elements"][:2]})
        if gift:
            scores[-1] = min(96, scores[-1] + 6)
            pts.append(f"{me[0]}님 이름의 {'·'.join(_oh(o) for o in gift)} 기운은 {other[0]}님에게도 필요한 기운이라, 이름을 부를 때마다 상대의 운을 북돋웁니다.")
    score = _clamp(sum(scores) / len(scores)) if scores else 60
    head = "두 분의 이름이 사주를 잘 받쳐 줍니다" if score >= 72 else "이름과 사주의 조화가 무난합니다" if score >= 56 else "이름이 사주를 충분히 돕지 못합니다"
    pts.append("이름 오행은 발음오행(이름 첫소리)을 기준으로 풀이했습니다.")
    return {"key": "names", "title": "이름 오행 궁합", "hanja": "名", "score": score, "headline": head, "points": pts, "tables": tables}


# ───────────── 기업 사주 ─────────────
COMPANY_STYLE = {
    "비겁": "경쟁과 협업이 많은 조직입니다. 동업·파트너십으로 성장하지만 내부 경쟁과 지분 관리가 중요합니다.",
    "식상": "제품·콘텐츠·서비스를 만들어 내는 창의형 기업입니다. 기술과 아이디어가 곧 경쟁력입니다.",
    "재성": "영업과 매출 중심의 실리형 기업입니다. 시장 감각이 뛰어나고 현금 흐름을 잘 만듭니다.",
    "관성": "체계와 규정이 강한 조직형 기업입니다. 공공·대기업 거래, 인허가 사업에서 신뢰를 얻습니다.",
    "인성": "브랜드·신뢰·지식 기반의 기업입니다. 연구·교육·문서·자격 기반 사업에 강합니다.",
}


def _sound_elements(name: str) -> list[tuple[str, str]]:
    from .naming.sound import sound_element
    return [(ch, sound_element(ch)) for ch in name if "가" <= ch <= "힣"]


def business(rep: BirthInput, rep_name: str, comp: BirthInput, comp_name: str, year: int | None = None,
             rep_hanja: str | None = None) -> dict:
    year = year or date.today().year
    rs, cs = compute(rep), compute(comp)
    ra, ca = analyze(rs), analyze(cs)
    rep_name = rep_name or "대표자"
    comp_name = (comp_name or "").strip()
    cname = comp_name or "회사"
    cc = _Ctx(cs, ca, "M")
    rc = _Ctx(rs, ra, rep.gender)
    cats = []

    # 1) 회사의 성격
    top = max(cc.ratio, key=cc.ratio.get)
    pts = [f"{cname}의 일간은 {j(cs.day_gan + '(' + ca['day_master']['kr'] + OHAENG_KR[cc.dm_oh] + ')', '으로/로')} {DAY_MASTER_DESC[cs.day_gan].split('.')[0]}의 기질을 가진 회사입니다.",
           f"사주의 중심 기운이 {top}이라 {COMPANY_STYLE[top]}",
           f"회사 사주는 '{ca['strength']['label']}'이며 용신은 {_oh(ca['yongsin']['element'])}입니다."]
    cats.append({"key": "nature", "title": "회사의 성격", "hanja": "社", "score": None, "headline": f"{top} 중심의 {cs.day_gan}{OHAENG_KR[cc.dm_oh]} 기업", "points": pts})

    # 1-2) 대표자 이름 오행: 대표자 사주 + 회사 사주에 함께 대조
    rn = name_ohaeng(rc, rep_name, rep_hanja) if rep_name else None
    if rn:
        given = [x for x in rn["chars"] if not x["is_surname"]]
        els = [x["sound"] for x in given]
        helps = sorted({o for o in els if o in ca["needed_elements"][:2]})
        hurts = sorted({o for o in els if o in ca["avoid_elements"]})
        if helps:
            rn["score"] = _clamp(rn["score"] + 6)
            rn["points"].append(f"대표자 이름의 {'·'.join(_oh(o) for o in helps)} 기운은 회사 사주에도 필요한 기운이라, 대표자가 이름으로 회사를 돕는 구조입니다.")
        if hurts:
            rn["score"] = _clamp(rn["score"] - 4)
            rn["points"].append(f"대표자 이름의 {'·'.join(_oh(o) for o in hurts)} 기운은 회사 사주에는 부담이 되는 기운입니다.")
        if not helps and not hurts:
            rn["points"].append("대표자 이름의 오행은 회사 사주에 중립적입니다.")
        rn.update({"key": "repname", "title": "대표자 이름 오행", "hanja": "名"})
        cats.append(rn)

    # 2) 회사 재물운
    score = 60 + cc.fit("재성")
    pts = []
    if cc.lv["재성"] == "없음":
        score -= 6
        pts.append("회사 사주에 재성이 드러나지 않아 초기 매출이 더디게 붙을 수 있습니다. 기술·제품력을 먼저 쌓는 전략이 맞습니다.")
    elif cc.strong:
        score += 10
        pts.append("회사의 힘이 튼튼하고 재성도 갖춰 매출을 만들고 지키는 힘이 좋습니다.")
    elif cc.lv["재성"] == "과다":
        score -= 6
        pts.append("시장 기회는 많지만 회사 체력에 비해 벌이가 커 확장 속도 조절과 자금 관리가 중요합니다.")
    else:
        score += 4
        pts.append("재성이 알맞게 자리해 안정적인 매출 흐름을 기대할 수 있습니다.")
    if cc.lv["식상"] in ("적당", "과다") and cc.lv["재성"] != "없음":
        score += 8
        pts.append("식상이 재성을 생해 제품·서비스가 곧 매출로 이어지는 구조(식상생재)입니다.")
    if cc.lv["비겁"] == "과다":
        score -= 6
        pts.append("비겁이 많아 경쟁사가 많거나 동업자와 이익 배분 문제가 생기기 쉽습니다. 지분·계약을 명확히 하세요.")
    cats.append({"key": "wealth", "title": "회사 재물운", "hanja": "財", "score": _clamp(score),
                 "headline": "매출과 이익의 흐름", "points": pts})

    # 3) 대표자와 회사의 궁합
    rel, hap = _gan_relation(rs.day_gan, cs.day_gan)
    score = 60
    pts = [f"{rep_name}님의 일간은 {rs.day_gan}({ra['day_master']['kr']}), {cname}의 일간은 {cs.day_gan}({ca['day_master']['kr']})입니다."]
    if rel == "합":
        score += 20
        pts.append("천간합을 이뤄 대표자와 회사가 한 몸처럼 움직입니다. 대표자의 의지가 회사에 그대로 전해지는 좋은 궁합입니다.")
    elif rel == "상대가생":
        score += 16
        pts.append("회사가 대표자를 생(生)해 주는 관계라 회사가 대표자에게 이익과 명예를 가져다줍니다.")
    elif rel == "내가극":
        score += 10
        pts.append("대표자가 회사를 극(剋)하는 관계로, 회사는 대표자에게 재성(재물)이 됩니다. 장악력이 강하고 회사가 곧 대표자의 재물이 되는 구조입니다.")
    elif rel == "내가생":
        score += 2
        pts.append("대표자가 회사를 생(生)해 주는 관계라 대표자의 헌신으로 회사가 자랍니다. 대표자의 체력과 시간 관리가 중요합니다.")
    elif rel == "비화":
        score += 4
        pts.append("대표자와 회사의 오행이 같아 방향이 일치하지만, 회사를 키우려면 대표자와 다른 성향의 인재를 함께 두는 것이 좋습니다.")
    else:
        score -= 8
        pts.append("회사가 대표자를 극(剋)하는 관계라 회사 운영이 대표자에게 부담과 압박(관성)으로 다가오기 쉽습니다. 권한 위임과 전문 경영 보완이 도움이 됩니다.")
    sup = _support(ra["needed_elements"], ca)
    score += round((sup - 0.2) * 40)
    pts.append(f"회사 사주에 {rep_name}님에게 필요한 {'·'.join(_oh(o) for o in ra['needed_elements'][:2])} 기운이 {sup * 100:.0f}% 들어 있어 "
               + ("회사가 대표자의 운을 북돋웁니다." if sup >= 0.3 else "보완 효과는 보통입니다." if sup >= 0.18 else "회사가 대표자의 부족한 기운을 채워 주지는 못합니다."))
    r = _ji_relation(rs.pillars[2].ji, cs.pillars[2].ji)
    if r in ("육합", "삼합"):
        score += 8
        pts.append("대표자와 회사의 일지가 합을 이뤄 내부 결속력이 좋습니다.")
    elif r in ("충", "원진"):
        score -= 8
        pts.append(f"대표자와 회사의 일지가 {r} 관계라 조직 내 갈등이나 대표자 피로가 생기기 쉽습니다.")
    cats.append({"key": "match", "title": "대표자 · 회사 궁합", "hanja": "合", "score": _clamp(score), "headline": f"{rs.day_gan} 대표 · {cs.day_gan} 회사", "points": pts})

    # 4) 업종 적합성
    ry, cy = ra["needed_elements"][0], ca["needed_elements"][0]
    pts = [f"대표자 용신 {_oh(ry)} 업종: {OH_JOBS[ry]}", f"회사 용신 {_oh(cy)} 업종: {OH_JOBS[cy]}"]
    score = 62
    if ry == cy:
        score += 16
        pts.append(f"대표자와 회사의 용신이 {_oh(ry)}로 같아 이 업종에 집중하면 시너지가 큽니다.")
    elif SAENG[ry] == cy or SAENG[cy] == ry:
        score += 8
        pts.append("두 용신이 서로 생하는 관계라 두 분야를 연결한 사업 모델이 유리합니다.")
    else:
        pts.append("두 용신이 달라 대표자 강점 분야와 회사 주력 분야를 나눠 운영하는 전략이 좋습니다.")
    cats.append({"key": "industry", "title": "업종 적합성", "hanja": "業", "score": _clamp(score), "headline": "잘 맞는 사업 분야", "points": pts})

    # 5) 상호 오행
    if comp_name:
        se = _sound_elements(comp_name)
        need = set(ra["needed_elements"][:2]) | set(ca["needed_elements"][:2])
        avoid = set(ra["avoid_elements"]) | set(ca["avoid_elements"])
        good = [f"{ch}({o})" for ch, o in se if o in need]
        bad = [f"{ch}({o})" for ch, o in se if o in avoid and o not in need]
        score = _clamp(60 + 8 * len(good) - 6 * len(bad))
        pts = [f"상호 '{comp_name}'의 발음오행은 " + " → ".join(f"{ch}({OHAENG_KR[o]})" for ch, o in se) + "입니다."]
        if good:
            pts.append(f"{j(', '.join(good), '이/가')} 대표자·회사에 필요한 기운을 담고 있어 좋습니다.")
        if bad:
            pts.append(f"{j(', '.join(bad), '은/는')} 부담이 되는 기운이라 로고 색상이나 영문 표기로 보완하면 좋습니다.")
        cats.append({"key": "cname", "title": "상호 오행", "hanja": "號", "score": score, "headline": f"'{comp_name}'의 소리 기운", "points": pts})

    # 6) 연도별 회사 운 (5년)
    years = []
    for y in range(year, year + 5):
        k = (y - 4) % 60
        pc = _period(cc, GAN[k % 10], JI[k % 12], "sw")
        pr = _period(rc, GAN[k % 10], JI[k % 12], "sw")
        sc = round(pc["score"] * 0.6 + pr["score"] * 0.4)
        years.append({"year": y, "ganji": ganji_name(k), "kr": ganji_kr(k), "score": sc,
                      "level": "대길" if sc >= 80 else "길" if sc >= 68 else "평" if sc >= 55 else "주의",
                      "company": pc, "rep": pr, "elements": pc["elements"], "gods": pc["gods"], "keywords": pc["keywords"],
                      "text": [f"회사: {pc['text'][0]}", f"대표자: {pr['text'][0]}"] + pc["text"][2:4], "current": y == year})
    best = max(years, key=lambda x: x["score"])
    cats.append({"key": "years", "title": "연도별 회사 운", "hanja": "歲", "score": years[0]["score"],
                 "headline": f"가장 좋은 해는 {best['year']}년({best['ganji']})", "points": [f"{best['year']}년이 확장·투자·신사업에 가장 유리합니다."]})

    weights = {"wealth": 0.3, "match": 0.35, "industry": 0.2, "cname": 0.15, "repname": 0.1}
    scored = [c for c in cats if c["key"] in weights]
    wsum = sum(weights[c["key"]] for c in scored)
    overall = round(sum(c["score"] * weights[c["key"]] for c in scored) / wsum)
    for c in cats:
        c["stars"] = _stars(c["score"]) if c["score"] is not None else None
        c.setdefault("advice", [])
    return {
        "type": "business", "year": year, "overall": overall, "grade": _grade(overall).replace("천생연분", "최상"),
        "categories": cats, "years": years,
        "advice": [f"중요한 계약·개업·이전은 {best['year']}년처럼 운이 좋은 해에 맞추면 좋습니다.",
                   f"사무실 인테리어·로고에 회사 용신 {_oh(cy)} 계열 색을 쓰면 회사 기운을 보완합니다."],
        "people": [_person_summary(rep_name, rs, ra), _person_summary(cname, cs, ca)],
        "sajus": [{"saju": rs.to_dict(), "analysis": ra}, {"saju": cs.to_dict(), "analysis": ca}],
    }
