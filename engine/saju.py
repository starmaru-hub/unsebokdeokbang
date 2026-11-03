"""사주 분석: 오행 분포, 십신, 12운성, 신강/신약, 용신·희신·기신, 합충, 주요 신살.

작명에 필요한 핵심 결과는 `needed_elements`(이름으로 보충할 오행)와 `avoid_elements`.
사주풀이 서비스를 붙일 때도 이 모듈의 결과를 그대로 재사용한다.
"""
from __future__ import annotations

from .constants import (GAN, GAN_KR, GAN_OH, GAN_YANG, GEUK, JANGSAENG, JI, JI_KR, JI_OH, JI_YANG,
                        JIJANGGAN, OHAENG, OHAENG_KR, SAENG, TWELVE_STAGES)
from .manse import Saju

TEN_GODS = {  # (관계, 음양 같음?) → 십신
    ("same", True): "비견", ("same", False): "겁재",
    ("out", True): "식신", ("out", False): "상관",
    ("wealth", True): "편재", ("wealth", False): "정재",
    ("officer", True): "편관", ("officer", False): "정관",
    ("resource", True): "편인", ("resource", False): "정인",
}
GROUP_OF = {"비견": "비겁", "겁재": "비겁", "식신": "식상", "상관": "식상", "편재": "재성", "정재": "재성",
            "편관": "관성", "정관": "관성", "편인": "인성", "정인": "인성"}

# 자리별 가중치 (월지=월령이 가장 큼)
W_STEM = {"년주": 1.0, "월주": 1.2, "일주": 0.0, "시주": 1.0}
W_BRANCH = {"년주": 1.0, "월주": 3.0, "일주": 1.5, "시주": 1.0}

DAY_MASTER_DESC = {
    "甲": "큰 나무(甲木). 곧고 진취적이며 리더십과 개척 정신이 강합니다.",
    "乙": "화초·덩굴(乙木). 유연하고 적응력이 좋으며 섬세하고 끈기가 있습니다.",
    "丙": "태양(丙火). 밝고 열정적이며 표현력이 뛰어나고 주위를 환하게 합니다.",
    "丁": "촛불·등불(丁火). 따뜻하고 세심하며 집중력과 배려심이 깊습니다.",
    "戊": "큰 산(戊土). 듬직하고 포용력이 있으며 신뢰를 주는 중심형입니다.",
    "己": "논밭의 흙(己土). 온화하고 실속 있으며 사람을 기르고 돌보는 힘이 있습니다.",
    "庚": "무쇠·바위(庚金). 결단력과 의리가 강하고 추진력이 뛰어납니다.",
    "辛": "보석(辛金). 섬세하고 깔끔하며 자존심과 미적 감각이 뛰어납니다.",
    "壬": "큰 바다·강(壬水). 지혜롭고 포부가 크며 융통성과 통찰력이 있습니다.",
    "癸": "비·이슬(癸水). 총명하고 감수성이 풍부하며 조용히 스며드는 힘이 있습니다.",
}
OH_DESC = {
    "木": "성장·인자함·기획력", "火": "열정·표현력·예의", "土": "신용·포용·안정감",
    "金": "결단·의리·실행력", "水": "지혜·유연함·통찰력",
}

GAN_HAP = {frozenset("甲己"): "土", frozenset("乙庚"): "金", frozenset("丙辛"): "水", frozenset("丁壬"): "木", frozenset("戊癸"): "火"}
GAN_CHUNG = [frozenset("甲庚"), frozenset("乙辛"), frozenset("丙壬"), frozenset("丁癸")]
JI_YUKHAP = {frozenset("子丑"): "土", frozenset("寅亥"): "木", frozenset("卯戌"): "火", frozenset("辰酉"): "金", frozenset("巳申"): "水", frozenset("午未"): "火"}
JI_CHUNG = [frozenset(p) for p in ("子午", "丑未", "寅申", "卯酉", "辰戌", "巳亥")]
JI_SAMHAP = {"申子辰": "水", "亥卯未": "木", "寅午戌": "火", "巳酉丑": "金"}
CHEONEUL = {"甲": "丑未", "戊": "丑未", "庚": "丑未", "乙": "子申", "己": "子申", "丙": "亥酉", "丁": "亥酉", "辛": "寅午", "壬": "巳卯", "癸": "巳卯"}


def relation(dm_oh: str, oh: str) -> str:
    if oh == dm_oh:
        return "same"
    if SAENG[dm_oh] == oh:
        return "out"
    if GEUK[dm_oh] == oh:
        return "wealth"
    if GEUK[oh] == dm_oh:
        return "officer"
    return "resource"


def ten_god(day_gan: str, other_gan: str) -> str:
    di, oi = GAN.index(day_gan), GAN.index(other_gan)
    return TEN_GODS[(relation(GAN_OH[di], GAN_OH[oi]), GAN_YANG[di] == GAN_YANG[oi])]


def ten_god_branch(day_gan: str, ji: str) -> str:
    return ten_god(day_gan, JIJANGGAN[ji][-1][0])  # 정기 기준


def twelve_stage(gan: str, ji: str) -> str:
    start = JI.index(JANGSAENG[gan])
    off = (JI.index(ji) - start) % 12 if GAN_YANG[GAN.index(gan)] else (start - JI.index(ji)) % 12
    return TWELVE_STAGES[off]


def element_of_group(dm_oh: str, group: str) -> str:
    return {
        "비겁": dm_oh, "식상": SAENG[dm_oh], "재성": GEUK[dm_oh],
        "관성": next(o for o in OHAENG if GEUK[o] == dm_oh),
        "인성": next(o for o in OHAENG if SAENG[o] == dm_oh),
    }[group]


def gongmang(day_idx60: int) -> str:
    """일주 기준 공망 지지 2개."""
    start = day_idx60 - day_idx60 % 10  # 해당 순(旬)의 甲 위치
    first_ji = start % 12
    return JI[(first_ji + 10) % 12] + JI[(first_ji + 11) % 12]


W_NAME = 1.0  # 이름 글자 하나의 가중치 (천간 한 글자와 같은 비중)
REL_GROUP = {"same": "비겁", "out": "식상", "wealth": "재성", "officer": "관성", "resource": "인성"}


def analyze(saju: Saju, name_chars: list[dict] | None = None) -> dict:
    """name_chars: 이름(성 제외) 글자 [{"kr", "h", "element", "basis"}] — 주면 사주 8자 + 이름 = 10자로 분석한다."""
    ps = saju.pillars
    dm = saju.day_gan
    dm_oh = GAN_OH[GAN.index(dm)]
    name_chars = name_chars or []

    # 1) 오행 개수(8글자, 지지는 본기 오행) & 가중 점수(지장간 비율, 자리 가중)
    count = {o: 0 for o in OHAENG}
    score = {o: 0.0 for o in OHAENG}
    pillar_rows = []
    for p in ps:
        gi, ji = GAN.index(p.gan), JI.index(p.ji)
        count[GAN_OH[gi]] += 1
        count[JI_OH[ji]] += 1
        score[GAN_OH[gi]] += W_STEM[p.name] if p.name != "일주" else 1.0
        for g, days in JIJANGGAN[p.ji]:
            score[GAN_OH[GAN.index(g)]] += W_BRANCH[p.name] * days / 30
        pillar_rows.append({
            "name": p.name, "ganji": p.text,
            "gan_god": "일간(나)" if p.name == "일주" else ten_god(dm, p.gan),
            "ji_god": ten_god_branch(dm, p.ji),
            "jijanggan": [g for g, _ in JIJANGGAN[p.ji]],
            "stage": twelve_stage(dm, p.ji),
        })

    count8 = dict(count)
    name_rows = []
    for nc in name_chars:  # 이름 글자: 오행 개수·점수에 더한다
        el = nc["element"]
        count[el] += 1
        score[el] += W_NAME
        name_rows.append({**nc, "group": REL_GROUP[relation(dm_oh, el)]})

    # 2) 신강/신약: (비겁+인성) 가중 점수 비율, 일간 자체는 제외 (이름 글자 포함)
    group_score = {g: 0.0 for g in ("비겁", "식상", "재성", "관성", "인성")}
    for p in ps:
        if p.name != "일주":
            group_score[GROUP_OF[ten_god(dm, p.gan)]] += W_STEM[p.name]
        for g, days in JIJANGGAN[p.ji]:
            group_score[GROUP_OF[ten_god(dm, g)]] += W_BRANCH[p.name] * days / 30
    for nr in name_rows:
        group_score[nr["group"]] += W_NAME
    total = sum(group_score.values())
    support = group_score["비겁"] + group_score["인성"]
    ratio = support / total if total else 0.5
    month_god = GROUP_OF[ten_god_branch(dm, ps[1].ji)]
    deukryeong = month_god in ("비겁", "인성")
    if ratio >= 0.65:
        strength = "극신강"
    elif ratio >= 0.53:
        strength = "신강"
    elif ratio > 0.45:
        strength = "중화"
    elif ratio > 0.33:
        strength = "신약"
    else:
        strength = "극신약"

    # 3) 억부용신
    others = {g: group_score[g] for g in ("식상", "재성", "관성")}
    if strength in ("신강", "극신강"):
        if group_score["인성"] > group_score["비겁"]:
            yong_g, hee_g, why = "재성", "식상", "인성이 많아 신강하므로 재성으로 인성을 제어합니다."
        elif group_score["관성"] >= 1.0:
            yong_g, hee_g, why = "관성", "재성", "비겁이 많아 신강하므로 관성으로 일간을 다스립니다."
        else:
            yong_g, hee_g, why = "식상", "재성", "비겁이 많아 신강하므로 식상으로 기운을 설기합니다."
    elif strength in ("신약", "극신약"):
        heavy = max(others, key=others.get)
        if heavy == "재성":
            yong_g, hee_g, why = "비겁", "인성", "재성이 많아 신약하므로 비겁으로 일간을 돕습니다."
        else:
            yong_g, hee_g, why = "인성", "비겁", f"{heavy}이(가) 많아 신약하므로 인성으로 일간을 생합니다."
    else:
        weakest = min(OHAENG, key=lambda o: score[o])
        yong_g = next(g for g in group_score if element_of_group(dm_oh, g) == weakest)
        hee_g = next(g for g in group_score if element_of_group(dm_oh, g) == next(o for o in OHAENG if SAENG[o] == weakest))
        why = "사주가 중화에 가까워 가장 약한 오행을 보완해 균형을 맞춥니다."
    yong = element_of_group(dm_oh, yong_g)
    hee = element_of_group(dm_oh, hee_g)
    gi = next(o for o in OHAENG if GEUK[o] == yong)        # 용신을 극하는 오행
    gu = next(o for o in OHAENG if SAENG[o] == gi)         # 기신을 생하는 오행
    if hee in (gi, gu, yong):                               # 다섯 역할이 겹치지 않게: 희신 = 용신을 생하는 오행
        hee = next(o for o in OHAENG if SAENG[o] == yong)
        hee_g = next(g for g in group_score if element_of_group(dm_oh, g) == hee)
    han = next(o for o in OHAENG if o not in (yong, hee, gi, gu))  # 한신: 나머지 하나
    roles = {yong: "용신", hee: "희신", han: "한신", gu: "구신", gi: "기신"}

    # 4) 조후(寒暖燥濕): 겨울생은 火, 여름생은 水가 필요
    johu = None
    mji = ps[1].ji
    if mji in "亥子丑" and score["火"] < 2.0:
        johu = {"element": "火", "why": "겨울(亥子丑월)에 태어나 차가운 사주라 따뜻한 火 기운이 필요합니다."}
    elif mji in "巳午未" and score["水"] < 2.0:
        johu = {"element": "水", "why": "여름(巳午未월)에 태어나 뜨거운 사주라 시원한 水 기운이 필요합니다."}

    needed = [yong, hee]
    if johu and johu["element"] not in needed and johu["element"] != gi:
        needed.append(johu["element"])
    avoid = [o for o in (gi, gu) if o not in needed]

    # 5) 합·충
    stems = [p.gan for p in ps]
    branches = [p.ji for p in ps]
    rels = []
    for i in range(len(ps)):
        for j in range(i + 1, len(ps)):
            a, b = frozenset(stems[i] + stems[j]), frozenset(branches[i] + branches[j])
            if a in GAN_HAP:
                rels.append(f"{ps[i].name}·{ps[j].name} 천간합 {stems[i]}{stems[j]}→{GAN_HAP[a]}")
            if a in GAN_CHUNG:
                rels.append(f"{ps[i].name}·{ps[j].name} 천간충 {stems[i]}{stems[j]}")
            if b in JI_YUKHAP:
                rels.append(f"{ps[i].name}·{ps[j].name} 지지육합 {branches[i]}{branches[j]}→{JI_YUKHAP[b]}")
            if b in JI_CHUNG:
                rels.append(f"{ps[i].name}·{ps[j].name} 지지충 {branches[i]}{branches[j]}")
    for trio, oh in JI_SAMHAP.items():
        hit = [c for c in trio if c in branches]
        if len(hit) == 3:
            rels.append(f"지지삼합 {trio}→{oh}국")
        elif len(hit) == 2 and trio[1] in hit:
            rels.append(f"지지반합 {''.join(hit)}→{oh}")

    # 6) 주요 신살
    sinsal = []
    nobles = [b for b in branches if b in CHEONEUL[dm]]
    if nobles:
        sinsal.append({"name": "천을귀인", "detail": f"{''.join(nobles)} — 어려울 때 돕는 귀인의 기운"})
    gm = gongmang(ps[2].idx60)
    hit_gm = [p.name for p in ps if p.ji in gm and p.name != "일주"]
    sinsal.append({"name": "공망", "detail": f"{gm}" + (f" ({', '.join(hit_gm)}에 해당)" if hit_gm else "")})
    for base in dict.fromkeys([ps[0].ji, ps[2].ji]):  # 년지 → 일지 순서 고정
        for trio in JI_SAMHAP:
            if base in trio:
                dohwa = {"申子辰": "酉", "亥卯未": "子", "寅午戌": "卯", "巳酉丑": "午"}[trio]
                yeokma = {"申子辰": "寅", "亥卯未": "巳", "寅午戌": "申", "巳酉丑": "亥"}[trio]
                hwagae = {"申子辰": "辰", "亥卯未": "未", "寅午戌": "戌", "巳酉丑": "丑"}[trio]
                for nm, c, d in (("도화살", dohwa, "인기·매력"), ("역마살", yeokma, "이동·활동성"), ("화개살", hwagae, "예술·학문·종교성")):
                    if c in branches and not any(s["name"] == nm for s in sinsal):
                        sinsal.append({"name": nm, "detail": f"{c} — {d}"})

    lacking = [o for o in OHAENG if count[o] == 0]
    excess = [o for o in OHAENG if count[o] >= 3]
    summary = [f"일간은 {dm}({GAN_KR[GAN.index(dm)]}{OHAENG_KR[dm_oh]})입니다. {DAY_MASTER_DESC[dm]}"]
    if name_rows:
        summary.append(f"사주 8자에 이름 {len(name_rows)}자(" + ", ".join(f"{(n.get('h') or n['kr'])} {n['element']}" for n in name_rows)
                       + f")를 더해 총 {(8 if len(ps) == 4 else 6) + len(name_rows)}자의 오행으로 풀이했습니다.")
    summary.append(f"월령은 {mji}({JI_KR[JI.index(mji)]})월로 {'득령' if deukryeong else '실령'}했고, "
                   f"일간을 돕는 기운의 비율은 {ratio * 100:.0f}%로 '{strength}' 사주입니다.")
    if lacking:
        summary.append("없는 오행: " + ", ".join(f"{o}({OHAENG_KR[o]}, {OH_DESC[o]})" for o in lacking) + ".")
    if excess:
        summary.append("많은 오행: " + ", ".join(f"{o}({OHAENG_KR[o]})" for o in excess) + ".")
    summary.append(f"용신은 {yong}({OHAENG_KR[yong]}, {yong_g}), 희신은 {hee}({OHAENG_KR[hee]}, {hee_g})입니다. {why}")
    if johu:
        summary.append("조후: " + johu["why"])
    summary.append("이름에는 " + "·".join(f"{o}({OHAENG_KR[o]})" for o in needed) + " 기운의 한자를 쓰는 것이 좋고, "
                   + ("·".join(f"{o}({OHAENG_KR[o]})" for o in avoid) + " 기운은 피하는 것이 좋습니다." if avoid else "크게 꺼리는 오행은 없습니다."))

    return {
        "day_master": {"gan": dm, "kr": GAN_KR[GAN.index(dm)], "element": dm_oh, "yang": GAN_YANG[GAN.index(dm)],
                       "desc": DAY_MASTER_DESC[dm]},
        "pillars": pillar_rows,
        "element_count": count,
        "element_count_saju": count8,          # 사주 8자만의 개수
        "name_elements": name_rows,            # 이름 글자(10자 분석에 포함된 것)
        "basis": f"사주 8자 + 이름 {len(name_rows)}자" if name_rows else "사주 8자",
        "element_score": {k: round(v, 2) for k, v in score.items()},
        "group_score": {k: round(v, 2) for k, v in group_score.items()},
        "strength": {"label": strength, "ratio": round(ratio, 3), "deukryeong": deukryeong, "month_god": month_god},
        "yongsin": {"element": yong, "group": yong_g, "why": why},
        "heesin": {"element": hee, "group": hee_g},
        "gisin": {"element": gi},
        "gusin": {"element": gu},
        "hansin": {"element": han},
        "roles": roles,                     # 오행 → 용신/희신/한신/구신/기신
        "johu": johu,
        "needed_elements": needed,
        "avoid_elements": avoid,
        "lacking": lacking,
        "excess": excess,
        "relations": rels,
        "sinsal": sinsal,
        "summary": summary,
    }
