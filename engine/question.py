"""사용자 질문 풀이: 자유 질문에서 주제·시기를 찾아 그 분야를 중점적으로 분석한다.

예) "올해 이직해도 될까요?" → 주제: 직장, 시기: 올해
    "언제 결혼하면 좋을까요" → 주제: 연애·결혼, 시기: 언제(좋은 해 추천)
"""
from __future__ import annotations

import re

from .constants import GAN, JI, OHAENG_KR, ganji_kr, ganji_name
from .fortune import OH_LUCK, _Ctx, _period, j

TOPICS = {
    "wealth": ("재물 · 금전", "財", ["돈", "재물", "금전", "투자", "주식", "코인", "재테크", "사업", "장사", "창업", "매출", "빚", "대출", "로또", "부자", "수입", "월급", "연봉", "가게"]),
    "career": ("직장 · 진로", "業", ["직장", "회사", "취업", "취직", "이직", "퇴사", "승진", "직업", "공무원", "진로", "일자리", "면접", "사직", "프리랜서", "적성", "커리어"]),
    "love": ("연애 · 결혼", "緣", ["연애", "결혼", "남자친구", "여자친구", "남친", "여친", "배우자", "이혼", "재회", "인연", "짝", "소개팅", "남편", "아내", "애인", "사랑", "썸", "헤어", "궁합"]),
    "health": ("건강", "健", ["건강", "병", "수술", "아프", "아픈", "몸", "다이어트", "질병", "통증", "병원", "체력", "우울", "불면"]),
    "study": ("학업 · 시험", "學", ["시험", "공부", "합격", "수능", "자격증", "학업", "대학", "유학", "입시", "고시", "성적", "편입", "대학원"]),
    "move": ("이사 · 이동", "移", ["이사", "이동", "해외", "이민", "집", "부동산", "아파트", "청약", "매매", "전세", "출장", "여행"]),
    "family": ("자녀 · 가족", "家", ["자녀", "아이", "아기", "임신", "출산", "부모", "가족", "형제", "자식", "아들", "딸", "시댁", "처가"]),
    "people": ("인간관계", "人", ["인간관계", "친구", "동료", "상사", "대인", "사람", "갈등", "동업", "배신", "모임"]),
}

# 주제별로 운에 들어오면 좋은 십신(+)과 조심할 십신(-)
GOOD = {
    "wealth": {"정재", "편재", "식신"}, "career": {"정관", "편관", "정인"}, "study": {"정인", "편인", "정관"},
    "health": {"식신", "정인"}, "move": {"편재", "상관", "편인"}, "family": set(), "people": {"비견", "정인", "식신"},
    "love": {"식신"},   # 배우자 별은 성별에 따라 _topic_year 에서 더한다
}
BAD = {
    "wealth": {"겁재"}, "career": {"상관"}, "study": {"편재", "정재"}, "health": {"편관"},
    "move": set(), "family": set(), "people": {"겁재", "편관"}, "love": set(),
}
GOD_TOPIC_TEXT = {
    "wealth": {"정재": "꾸준한 수입과 저축이 늘어나는", "편재": "사업·투자로 큰돈이 오가는", "식신": "재능과 활동이 수입으로 이어지는", "겁재": "지출과 손재(財)를 조심해야 하는", "상관": "새로운 돈벌이 아이디어가 생기는"},
    "career": {"정관": "승진·안정된 자리·인정이 따르는", "편관": "책임은 무겁지만 도약의 기회가 오는", "정인": "윗사람의 도움과 자격·문서 운이 좋은", "상관": "조직에 답답함을 느끼고 변화를 원하는", "비견": "독립·창업을 생각하게 되는", "편재": "활동 무대가 넓어지는"},
    "love": {"정재": "진지한 인연(남성에게 아내 별)이 들어오는", "편재": "이성 만남이 활발해지는(남성)", "정관": "결혼 상대(여성에게 남편 별)가 들어오는", "편관": "강렬한 인연이 찾아오는(여성)", "식신": "마음이 여유로워 관계가 부드러운", "상관": "표현이 강해져 다툼을 조심해야 하는", "겁재": "경쟁자가 생기기 쉬운", "비견": "친구 같은 인연이 생기는"},
    "health": {"편관": "몸에 부담과 스트레스가 커지는", "식신": "몸과 마음이 편안해지는", "정인": "회복과 휴식이 잘 되는", "상관": "에너지 소모가 많은", "겁재": "무리하기 쉬운"},
    "study": {"정인": "공부가 잘 되고 시험·문서운이 좋은", "편인": "특수 분야 공부·자격증에 유리한", "정관": "시험·공채에 유리한", "편재": "다른 관심사로 집중이 흐트러지기 쉬운", "정재": "현실적인 일에 마음이 쏠리는", "상관": "실기·표현력 시험에 강한"},
    "move": {"편재": "활동 범위가 넓어지고 이동이 많은", "상관": "환경을 바꾸고 싶어지는", "편인": "새로운 곳에 관심이 생기는", "정인": "집·문서(계약)운이 좋은"},
    "family": {"식신": "자녀·후배와 관련된 기쁨이 있는", "상관": "자녀 문제로 신경 쓸 일이 생기는", "정관": "자녀(남성 기준)나 집안에 좋은 일이 있는", "편관": "가족에 대한 책임이 커지는", "정인": "부모님의 도움이 따르는", "편인": "부모와 생각 차이가 생기기 쉬운"},
    "people": {"비견": "뜻이 맞는 동료가 생기는", "겁재": "경쟁·금전 갈등을 조심해야 하는", "정인": "귀인의 도움이 따르는", "식신": "사람들과 즐겁게 어울리는", "편관": "윗사람·조직의 압박이 있는", "상관": "말로 인한 오해를 조심해야 하는"},
}
TOPIC_ADVICE = {
    "wealth": "큰 투자·계약은 좋은 해에 맞추고, 조심할 해에는 보증·동업·고위험 투자를 피하세요.",
    "career": "이직·창업 같은 큰 변화는 좋은 해에, 조심할 해에는 현재 자리에서 실력을 쌓는 편이 유리합니다.",
    "love": "인연은 배우자 별이 들어오는 해에 깊어지기 쉽습니다. 다툼이 생기면 그날 안에 대화로 푸세요.",
    "health": "조심할 해에는 정기 검진과 충분한 휴식을 우선하세요.",
    "study": "시험 일정을 좋은 해에 맞추고, 집중이 흐트러지는 해에는 학습 계획을 짧게 나눠 관리하세요.",
    "move": "이사·계약은 좋은 해에 진행하고, 충(沖)이 드는 해의 이동은 일정에 여유를 두세요.",
    "family": "가족과의 대화 시간을 정해 두면 집안의 기운이 안정됩니다.",
    "people": "조심할 해에는 금전 거래와 감정적인 언쟁을 피하세요.",
}
HEALTH_ORGAN = {"木": "간·담·근육·눈", "火": "심장·혈압·혈액순환", "土": "위장·소화기", "金": "폐·호흡기·피부·대장", "水": "신장·방광·허리·냉증"}
YEOKMA = {"申": "寅", "子": "寅", "辰": "寅", "寅": "申", "午": "申", "戌": "申", "巳": "亥", "酉": "亥", "丑": "亥", "亥": "巳", "卯": "巳", "未": "巳"}


def detect(question: str, year: int) -> tuple[list[str], list[int], bool]:
    q = question.replace(" ", "")
    topics = [k for k, (_, _, kws) in TOPICS.items() if any(kw in q for kw in kws)]
    years = sorted({int(y) for y in re.findall(r"(20\d\d|19\d\d)", question)})
    if "올해" in q or "금년" in q or "이번해" in q:
        years.append(year)
    if "내년" in q:
        years.append(year + 1)
    if "내후년" in q or "후년" in q:
        years.append(year + 2)
    when = any(w in q for w in ("언제", "몇년", "몇살", "시기", "때가", "타이밍"))
    return topics, sorted(set(years)), when


def _topic_year(c: _Ctx, topic: str, y: int) -> dict:
    k = (y - 4) % 60
    gan, ji = GAN[k % 10], JI[k % 12]
    p = _period(c, gan, ji, "sw")
    sc = p["score"]
    notes = []
    good, bad = set(GOOD[topic]), set(BAD[topic])
    if topic == "love":
        good |= {"정재", "편재"} if c.g == "M" else {"정관", "편관"}
        bad |= {"겁재"} if c.g == "M" else {"상관"}
    if topic == "family":
        good |= {"식신"} if c.g == "F" else {"정관", "편관"}
    for g in p["gods"]:
        if g in good:
            sc += 8
            notes.append(GOD_TOPIC_TEXT[topic].get(g, "도움이 되는") + f" {g}")
        elif g in bad:
            sc -= 8
            notes.append(GOD_TOPIC_TEXT[topic].get(g, "조심할") + f" {g}")
    chung = frozenset(ji + c.day_ji) in {frozenset(x) for x in ("子午", "丑未", "寅申", "卯酉", "辰戌", "巳亥")}
    if topic == "move" and (chung or ji == YEOKMA.get(c.s.pillars[0].ji)):
        sc += 8
        notes.append("이동·변화의 기운(충·역마)")
    elif topic in ("love", "health") and chung:
        sc -= 8
        notes.append("배우자 자리(일지)와 충")
    sc = int(max(30, min(98, round(sc))))
    level = "대길" if sc >= 82 else "길" if sc >= 68 else "평" if sc >= 55 else "주의"
    return {"year": y, "ganji": ganji_name(k), "kr": ganji_kr(k), "score": sc, "level": level, "gods": p["gods"],
            "notes": notes, "elements": p["elements"]}


def _topic_line(topic: str, ty: dict) -> str:
    good = [n for n in ty["notes"]]
    base = f"{ty['year']}년 {ty['ganji']}({ty['kr']})년은 {TOPICS[topic][0]} 면에서 '{ty['level']}'({ty['score']}점)입니다."
    if good:
        base += " " + ", ".join(n.rsplit(" ", 1)[0] for n in good[:2]) + " 기운이 들어옵니다."
    return base


def answer(c: _Ctx, fortune: dict, question: str, year: int) -> dict:
    question = (question or "").strip()
    topics, years, when = detect(question, year)
    cats = {x["key"]: x for x in fortune["categories"]}
    cat_of = {"wealth": "wealth", "career": "career", "love": "love", "health": "health", "study": "study"}
    if not topics:
        topics = ["general"]
    sections = []
    best_all, caution_all = [], []
    for t in topics[:3]:
        if t == "general":
            yc = cats.get("year")
            pts = ["질문에서 특정 분야(재물·직장·연애·건강·시험·이사·자녀·인간관계)를 찾지 못해 전체 흐름을 중심으로 풀이합니다.",
                   f"올해 운은 {yc['score']}점 — {yc['headline']}." if yc else ""]
            sections.append({"key": "general", "title": "전체 흐름", "hanja": "總", "points": [p for p in pts if p]})
            continue
        title, hz, _ = TOPICS[t]
        pts = []
        # 1) 타고난 성향
        base = cats.get(cat_of.get(t, ""))
        if base:
            pts.append(f"타고난 {title}: {base['headline']}. " + " ".join(base["points"][:2]))
        elif t == "move":
            pts.append("역마살이 있어 이동·해외와 인연이 깊습니다." if "역마살" in c.sinsal else "사주에 역마의 기운이 강하지 않아 잦은 이동보다 한곳에 뿌리내릴 때 안정됩니다.")
        elif t == "family":
            star = "식상" if c.g == "F" else "관성"
            pts.append(f"자녀를 뜻하는 별({star})은 사주에서 '{c.lv[star]}' 수준이며, 부모를 뜻하는 인성은 '{c.lv['인성']}' 수준입니다.")
        elif t == "people":
            pts.append(f"동료·친구를 뜻하는 비겁은 '{c.lv['비겁']}', 귀인을 뜻하는 인성은 '{c.lv['인성']}' 수준입니다."
                       + (" 천을귀인이 있어 어려울 때 돕는 사람이 나타납니다." if "천을귀인" in c.sinsal else ""))
        if t == "health":
            weak = [o for o in OHAENG_KR if c.a["element_count"][o] == 0]
            if weak:
                pts.append("특히 " + ", ".join(f"{o}({HEALTH_ORGAN[o]})" for o in weak) + " 쪽을 꾸준히 살피세요.")
        # 2) 현재 대운
        cur = next((d for d in fortune.get("daewoon", []) if d.get("current")), None)
        if cur:
            hits = [GOD_TOPIC_TEXT[t].get(g) for g in cur["gods"] if GOD_TOPIC_TEXT[t].get(g)]
            pts.append(j(f"현재 대운 {cur['ganji']}({cur['age']}~{cur['age_end']}세)", "은/는") + " " +
                       (f"{', '.join(hits)} 시기로 {title}에 직접 영향을 줍니다." if hits else f"{title}에 큰 변화를 주기보다 기본 흐름을 따르는 시기입니다."))
        # 3) 물어본 해
        ask = years or ([year] if not when else [])
        for y in ask[:3]:
            pts.append(_topic_line(t, _topic_year(c, t, y)))
        # 4) 10년 중 좋은 해 / 조심할 해
        span = [_topic_year(c, t, y) for y in range(year, year + 10)]
        best = sorted(span, key=lambda x: -x["score"])[:3]
        caution = [x for x in sorted(span, key=lambda x: x["score"]) if x["score"] < 55][:2]
        pts.append(f"앞으로 10년 중 {title}에 가장 좋은 해는 " + ", ".join(f"{x['year']}년({x['ganji']}, {x['score']}점)" for x in best) + "입니다.")
        if caution:
            pts.append("조심할 해는 " + ", ".join(f"{x['year']}년({x['ganji']})" for x in caution) + "입니다.")
        best_all += [dict(x, topic=title) for x in best]
        caution_all += [dict(x, topic=title) for x in caution]
        sections.append({"key": t, "title": title, "hanja": hz, "points": pts, "years": span, "advice": TOPIC_ADVICE[t]})

    luck = OH_LUCK[c.need[0]]
    labels = [s["title"] for s in sections]
    if topics == ["general"]:
        head = "전체 운의 흐름을 중심으로 풀이했습니다"
    else:
        # 주제마다 한 마디씩: 물어본 해의 등급, 시기를 물었으면 최적의 해
        parts = []
        for s_ in sections:
            ys = s_["years"]
            if years:
                ty = _topic_year(c, s_["key"], years[0])
                parts.append(f"{years[0]}년 {s_['title']} '{ty['level']}'")
            if when or not years:
                if s_["key"] == "health":
                    w = min(ys, key=lambda x: x["score"])
                    parts.append(f"건강은 {w['year']}년을 특히 조심")
                else:
                    b = max(ys, key=lambda x: x["score"])
                    parts.append(f"{s_['title']} 최적기 {b['year']}년")
        head = " · ".join(dict.fromkeys(parts))
    return {
        "question": question, "topics": labels, "years": years, "when": when, "headline": head,
        "sections": sections,
        "advice": [s["advice"] for s in sections if s.get("advice")] +
                  [f"행운의 기운은 {c.need[0]}({OHAENG_KR[c.need[0]]}) — {luck['color']} 색, {luck['direction']} 방향이 도움이 됩니다."],
    }
