"""사주 운세 풀이: 성격 · 재물 · 학업 · 연애/결혼 · 건강 · 직업/적성 · 올해 운세 · 대운.

입력은 manse.Saju 와 saju.analyze() 결과. 규칙 기반으로 점수(0~100)와 풀이 문장을 만든다.
점수는 상대적인 경향을 보여 주기 위한 지표이며, 기준값 60에서 근거마다 가감한다.
"""
from __future__ import annotations

from collections import Counter
from datetime import date

from .constants import GAN, GAN_OH, GEUK, JI, JI_KR, JI_OH, OHAENG, OHAENG_KR, ganji_kr, ganji_name
from .manse import Saju
from .saju import JI_CHUNG, JI_YUKHAP, element_of_group, ten_god, ten_god_branch

OH_ORGAN = {
    "木": ("간·담낭·근육·신경계·눈", "목과 어깨 결림, 눈의 피로, 스트레스성 긴장"),
    "火": ("심장·소장·혈관·혈압", "혈액순환, 가슴 두근거림, 불면과 열감"),
    "土": ("비장·위장·췌장·소화기", "소화불량, 위염, 체중 변화와 당 관리"),
    "金": ("폐·대장·호흡기·피부", "기관지·비염, 피부 트러블, 장 건강"),
    "水": ("신장·방광·생식기·뼈·귀", "부종, 허리와 무릎, 냉증과 호르몬 균형"),
}
OH_CARE = {
    "木": "스트레칭과 숲길 걷기, 푸른 채소와 신맛 나는 음식이 도움이 됩니다.",
    "火": "규칙적인 유산소 운동과 충분한 수면, 쓴맛 나는 차(녹차 등)가 도움이 됩니다.",
    "土": "규칙적인 식사 시간과 과식 피하기, 노란 곡류·단호박 같은 음식이 도움이 됩니다.",
    "金": "호흡 운동과 실내 습도 관리, 무·배·도라지 같은 흰색 음식이 도움이 됩니다.",
    "水": "몸을 따뜻하게 하고 수분을 충분히, 검은콩·해조류 같은 검은 음식이 도움이 됩니다.",
}
OH_JOBS = {
    "木": "교육·출판·디자인·패션·의료·복지·환경",
    "火": "방송·미디어·IT·예술·공연·마케팅·에너지",
    "土": "부동산·건설·농업·중개·컨설팅·공공행정",
    "金": "금융·법조·회계·기계·자동차·군경·의료기술",
    "水": "무역·유통·물류·여행·연구·수산·심리상담",
}
OH_LUCK = {
    "木": {"color": "초록·청색", "direction": "동쪽", "number": "3, 8", "season": "봄"},
    "火": {"color": "빨강·주황·보라", "direction": "남쪽", "number": "2, 7", "season": "여름"},
    "土": {"color": "노랑·갈색·베이지", "direction": "중앙", "number": "5, 10", "season": "환절기"},
    "金": {"color": "흰색·은색·금색", "direction": "서쪽", "number": "4, 9", "season": "가을"},
    "水": {"color": "검정·남색", "direction": "북쪽", "number": "1, 6", "season": "겨울"},
}
GROUP_TRAIT = {
    "비겁": ("독립심과 자존심이 강하고 스스로 길을 개척하려는 성향", "고집이 세 보이거나 경쟁심 때문에 주변과 부딪칠 수 있습니다"),
    "식상": ("표현력과 손재주, 아이디어가 풍부하고 하고 싶은 말을 하는 성향", "생각이 앞서 말이 많아지거나 규칙에 답답함을 느낄 수 있습니다"),
    "재성": ("현실 감각과 사교성이 좋고 실속을 챙기는 성향", "결과와 이익을 서두르다 마음이 조급해질 수 있습니다"),
    "관성": ("책임감과 원칙을 중시하고 명예와 체면을 지키는 성향", "스스로를 지나치게 몰아붙이거나 남의 시선을 의식할 수 있습니다"),
    "인성": ("생각이 깊고 배우기를 좋아하며 사람을 품는 성향", "생각이 많아 실행이 늦거나 남에게 기대려는 마음이 생길 수 있습니다"),
}
GOD_YEAR = {
    "비견": "주체성이 강해지고 독립·새 출발의 기운이 있는 시기입니다. 동료와 협력하되 지출과 경쟁 관계는 관리가 필요합니다.",
    "겁재": "경쟁과 승부의 기운이 강한 시기입니다. 과감한 도전이 성과로 이어질 수 있지만 금전 거래·보증은 조심하세요.",
    "식신": "재능과 표현이 빛나고 먹고 즐길 일이 생기는 여유로운 시기입니다. 새로운 취미나 창작에도 좋습니다.",
    "상관": "변화와 개혁의 기운이 강한 시기입니다. 능력을 드러낼 기회가 오지만 윗사람과의 언쟁은 피하는 것이 좋습니다.",
    "편재": "활동 범위가 넓어지고 사업·투자 등 큰 재물의 기회가 오는 시기입니다. 들어온 만큼 나가기 쉬우니 관리가 중요합니다.",
    "정재": "꾸준한 수입과 저축, 안정된 재물운의 시기입니다. 성실하게 쌓은 노력이 결실을 맺습니다.",
    "편관": "압박과 책임이 커지지만 그만큼 권한과 도약의 기회가 오는 시기입니다. 무리한 일정과 건강은 챙기세요.",
    "정관": "직장·명예·승진 운이 좋은 시기입니다. 원칙을 지키면 인정받고 공적인 일이 순조롭습니다.",
    "편인": "직관과 아이디어가 살아나고 특수 분야 공부나 자격증에 좋은 시기입니다. 생각이 많아지니 결단은 신중히.",
    "정인": "배움과 문서, 귀인의 도움이 따르는 시기입니다. 시험·계약·부동산 문서운이 좋습니다.",
}
MUNCHANG = {"甲": "巳", "乙": "午", "丙": "申", "丁": "酉", "戊": "申", "己": "酉", "庚": "亥", "辛": "子", "壬": "寅", "癸": "卯"}


def _has_batchim(word: str) -> bool:
    """마지막 한글 음절의 받침 여부 ('水(수)' → '수' 기준)."""
    for ch in reversed(word):
        if "가" <= ch <= "힣":
            return (ord(ch) - 0xAC00) % 28 != 0
    return False


def j(word: str, pair: str) -> str:
    """조사 붙이기: j('정재', '과/와') → '정재와'."""
    a, b = pair.split("/")
    return word + (a if _has_batchim(word) else b)


def _level(ratio: float) -> str:
    if ratio >= 0.30:
        return "과다"
    if ratio >= 0.15:
        return "적당"
    if ratio >= 0.05:
        return "약함"
    return "없음"


def _stars(score: int) -> int:
    return max(1, min(5, round((score - 30) / 13)))


def _clamp(x: float) -> int:
    return int(max(35, min(96, round(x))))


class _Ctx:
    def __init__(self, saju: Saju, a: dict, gender: str):
        self.s, self.a, self.g = saju, a, gender
        self.dm = saju.day_gan
        self.dm_oh = GAN_OH[GAN.index(self.dm)]
        gs = a["group_score"]
        total = sum(gs.values()) or 1
        self.ratio = {k: v / total for k, v in gs.items()}
        self.lv = {k: _level(v) for k, v in self.ratio.items()}
        # 드러난 십신 개수 (천간 + 지지 정기)
        gods = []
        for p in saju.pillars:
            if p.name != "일주":
                gods.append(ten_god(self.dm, p.gan))
            gods.append(ten_god_branch(self.dm, p.ji))
        self.cnt = Counter(gods)
        self.strong = a["strength"]["label"] in ("신강", "극신강")
        self.weak = a["strength"]["label"] in ("신약", "극신약")
        self.need = a["needed_elements"]
        self.avoid = a["avoid_elements"]
        self.branches = [p.ji for p in saju.pillars]
        self.day_ji = saju.pillars[2].ji
        self.sinsal = {x["name"] for x in a["sinsal"]}

    def el(self, group):
        return element_of_group(self.dm_oh, group)

    def fit(self, group) -> int:
        """해당 십신 오행이 용신/희신이면 +, 기신/구신이면 -."""
        e = self.el(group)
        if e == self.need[0]:
            return 12
        if e in self.need[1:]:
            return 8
        if e == self.a["gisin"]["element"]:
            return -10
        if e in self.avoid:
            return -5
        return 0


def _personality(c: _Ctx) -> dict:
    a = c.a
    top = sorted(c.ratio, key=c.ratio.get, reverse=True)
    main, second = top[0], top[1]
    pts = [a["day_master"]["desc"],
           f"사주에서 가장 두드러진 기운은 {main}({c.lv[main]})으로, {GROUP_TRAIT[main][0]}이 강합니다. "
           f"여기에 {second}의 기운이 더해져 {GROUP_TRAIT[second][0]}도 함께 지녔습니다."]
    if c.strong:
        pts.append("일간의 힘이 강해 주관이 뚜렷하고 추진력이 있습니다. 내 뜻을 밀고 나가는 힘은 장점이지만, 남의 의견을 한 번 더 들으면 더 크게 됩니다.")
    elif c.weak:
        pts.append("일간이 다소 약해 섬세하고 주변을 배려하는 마음이 큽니다. 좋은 사람과 환경을 만나면 능력이 크게 꽃피는 유형입니다.")
    else:
        pts.append("일간의 힘이 균형을 이뤄 상황에 따라 유연하게 대처하는 능력이 좋습니다.")
    weak_side = GROUP_TRAIT[main][1]
    advice = [f"주의할 점: {weak_side}.",
              f"부족한 {OHAENG_KR[c.need[0]]}({c.need[0]}) 기운({OH_LUCK[c.need[0]]['color']} 계열, {OH_LUCK[c.need[0]]['direction']})을 가까이하면 균형에 도움이 됩니다."]
    return {"key": "personality", "title": "타고난 성격", "hanja": "性", "score": None,
            "headline": f"{a['day_master']['gan']}{OHAENG_KR[c.dm_oh]} 일간 · {main} 중심의 성향",
            "points": pts, "advice": advice}


def _wealth(c: _Ctx) -> dict:
    score = 60 + c.fit("재성")
    pts = []
    jr, sk, bg = c.lv["재성"], c.lv["식상"], c.lv["비겁"]
    pyeon, jeong = c.cnt["편재"], c.cnt["정재"]
    if jr == "없음":
        score -= 6
        pts.append("사주에 재성이 드러나지 않아 돈 자체를 좇기보다 일과 명분을 따르는 편입니다. 재물은 실력과 신용을 쌓은 뒤에 따라오는 구조입니다.")
        if sk in ("적당", "과다"):
            score += 6
            pts.append("다행히 식상(재능·기술)이 살아 있어 전문성과 아이디어가 곧 수입원이 됩니다.")
    else:
        if c.strong and jr in ("적당", "과다"):
            score += 12
            pts.append("일간이 튼튼하고 재성도 갖춰 '신왕재왕(身旺財旺)'에 가까운 구조입니다. 재물을 벌고 지키는 힘이 함께 있어 재물운이 좋은 편입니다.")
        elif c.weak and jr == "과다":
            score -= 8
            pts.append("재성은 많은데 일간이 약한 '재다신약(財多身弱)'의 모습이 있습니다. 기회는 많이 오지만 감당할 체력과 관리가 관건이니, 욕심보다 지킬 수 있는 만큼만 키우는 것이 좋습니다.")
        else:
            score += 4
            pts.append("재성이 적당히 자리해 생활에 필요한 재물은 꾸준히 들어오는 편입니다.")
        if sk in ("적당", "과다"):
            score += 6
            pts.append("식상이 재성을 생하는 '식상생재(食傷生財)'의 흐름이 있어 재능과 활동이 돈으로 이어지기 쉽습니다.")
        if pyeon > jeong:
            pts.append("편재가 더 두드러져 사업·투자·영업처럼 유동적인 재물에 강하고 씀씀이도 큰 편입니다.")
        elif jeong > pyeon:
            pts.append("정재가 더 두드러져 월급·저축·부동산처럼 안정적으로 모으는 재물에 강합니다.")
        elif pyeon and jeong:
            pts.append("정재와 편재가 함께 있어 고정 수입과 부수입을 모두 기대할 수 있습니다.")
    if bg == "과다" and jr != "없음":
        score -= 8
        pts.append("비겁이 많아 '군겁쟁재(群劫爭財)'의 기운이 있습니다. 동업·보증·돈 거래에서 손해 보기 쉬우니 명확한 계약이 필요합니다.")
    if c.fit("재성") > 0:
        pts.append(f"재성({c.el('재성')})이 이 사주에 필요한 기운이라 재물 활동이 운을 돕습니다.")
    elif c.fit("재성") < 0:
        pts.append(f"재성({c.el('재성')})이 이 사주에서 부담이 되는 기운이라 무리한 투자보다 안정적인 운용이 맞습니다.")
    score = _clamp(score)
    advice = ["큰 지출과 투자는 용신 운이 들어오는 시기에 하는 것이 유리합니다."]
    if c.cnt["겁재"] or bg == "과다":
        advice.append("보증과 금전 대여는 피하고 공동 투자는 문서로 남기세요.")
    advice.append(f"재물과 인연이 깊은 업종: {OH_JOBS[c.need[0]]}")
    head = "재물을 모으고 지키는 힘이 좋습니다" if score >= 75 else ("노력한 만큼 재물이 따르는 사주입니다" if score >= 58 else "관리와 절제가 재물의 열쇠입니다")
    return {"key": "wealth", "title": "재물운", "hanja": "財", "score": score, "headline": head, "points": pts, "advice": advice}


def _study(c: _Ctx) -> dict:
    score = 60 + c.fit("인성") // 2
    pts = []
    ins, gw, sk, jr = c.lv["인성"], c.lv["관성"], c.lv["식상"], c.lv["재성"]
    if ins in ("적당", "과다"):
        score += 10
        if c.cnt["정인"] >= c.cnt["편인"]:
            pts.append("정인이 살아 있어 차분히 앉아 공부하는 힘과 이해력이 좋습니다. 체계적인 학습·자격 취득에 강합니다.")
        else:
            pts.append("편인이 두드러져 직관과 응용력이 뛰어납니다. 남들이 잘 하지 않는 특수 분야나 전문 기술에서 두각을 나타냅니다.")
    else:
        score -= 4
        pts.append("인성이 약해 오래 앉아 외우는 방식보다 직접 해 보며 익히는 체험형 학습이 잘 맞습니다.")
    if gw in ("적당", "과다") and ins in ("적당", "과다"):
        score += 10
        pts.append("관성과 인성이 서로 이어지는 '관인상생(官印相生)'의 구조로 시험·공무원·승진 시험에 유리합니다.")
    if sk in ("적당", "과다"):
        score += 4
        pts.append("식상이 있어 표현력과 창의력이 좋아 글쓰기·발표·예체능 분야의 재능을 키우기 좋습니다.")
    if jr == "과다" and ins != "과다":
        score -= 8
        pts.append("재성이 강해 인성을 누르는 '재극인(財剋印)'의 모습이 있어 공부 중 다른 관심사로 집중이 흐트러지기 쉽습니다.")
    if MUNCHANG[c.dm] in c.branches:
        score += 6
        pts.append(f"학문과 글재주의 별인 문창귀인({MUNCHANG[c.dm]})이 있어 총명함이 돋보입니다.")
    if "화개살" in c.sinsal:
        score += 3
        pts.append("화개살이 있어 학문·예술·종교처럼 깊이 파고드는 분야에 몰입하는 힘이 있습니다.")
    score = _clamp(score)
    advice = [f"책상은 {OH_LUCK[c.need[0]]['direction']} 방향, 공부방 소품은 {OH_LUCK[c.need[0]]['color']} 계열이 좋습니다."]
    if ins in ("약함", "없음"):
        advice.append("짧게 끊어 반복하는 학습법과 스터디 그룹처럼 함께하는 방식이 효과적입니다.")
    head = "시험과 학업에 강한 사주입니다" if score >= 75 else ("꾸준함이 성적을 만드는 사주입니다" if score >= 58 else "자신에게 맞는 학습법이 중요합니다")
    return {"key": "study", "title": "학업 · 시험운", "hanja": "學", "score": score, "headline": head, "points": pts, "advice": advice}


def _love(c: _Ctx) -> dict:
    male = c.g == "M"
    star = "재성" if male else "관성"
    star_kr = "아내·여자친구의 별인 재성" if male else "남편·남자친구의 별인 관성"
    score = 60 + c.fit(star) // 2
    pts = []
    lv = c.lv[star]
    if lv == "없음":
        score -= 6
        pts.append(f"사주에 {star_kr}이 드러나지 않아 연애에 소극적이거나 인연이 늦게 무르익는 편입니다. 서두르기보다 자연스러운 만남이 좋습니다.")
    elif lv == "과다":
        pts.append(f"{star_kr}이 많아 이성의 관심을 많이 받고 인연도 다양합니다. 그만큼 선택이 어려우니 한 사람에게 집중하는 것이 중요합니다.")
    else:
        score += 8
        pts.append(f"{star_kr}이 알맞게 자리해 자연스럽게 좋은 인연을 만나는 구조입니다.")
    a, b = ("정재", "편재") if male else ("정관", "편관")
    if c.cnt[a] and c.cnt[b]:
        score -= 4
        pts.append(f"{j(a, '과/와')} {j(b, '이/가')} 함께 있어 마음이 가는 인연이 여럿일 수 있습니다. 진지한 관계와 가벼운 관계를 분명히 구분하는 것이 좋습니다.")
    day_god = ten_god_branch(c.dm, c.day_ji)
    spouse = {"정재": "알뜰하고 현실적인 배우자", "편재": "활동적이고 씀씀이가 큰 배우자", "정관": "반듯하고 책임감 있는 배우자",
              "편관": "카리스마 있고 강한 배우자", "정인": "자상하고 나를 챙겨 주는 배우자", "편인": "독특하고 생각이 깊은 배우자",
              "식신": "온화하고 여유로운 배우자", "상관": "재치 있고 표현이 분명한 배우자", "비견": "친구 같은 동반자형 배우자", "겁재": "개성이 강하고 주관이 뚜렷한 배우자"}[day_god]
    pts.append(f"배우자 자리인 일지에 {j(day_god, '이/가')} 있어 {spouse}와 인연이 깊습니다.")
    clash = [p.name for p in c.s.pillars if p.name != "일주" and frozenset(p.ji + c.day_ji) in JI_CHUNG]
    if clash:
        score -= 8
        pts.append(f"일지가 {', '.join(clash)}와 충(沖)하여 배우자 자리가 흔들리기 쉽습니다. 서로의 생활 방식을 존중하고 대화로 조율하는 노력이 필요합니다.")
    harm = [p.name for p in c.s.pillars if p.name != "일주" and frozenset(p.ji + c.day_ji) in JI_YUKHAP]
    if harm:
        score += 5
        pts.append("일지가 다른 기둥과 합(合)을 이뤄 정이 깊고 관계를 오래 이어 가는 힘이 있습니다.")
    if "도화살" in c.sinsal:
        score += 4
        pts.append("도화살이 있어 매력이 돋보이고 이성에게 인기가 많습니다.")
    if not male and c.lv["식상"] == "과다":
        score -= 4
        pts.append("식상이 강해 할 말은 하는 성격이라 상대와 의견 충돌이 생길 수 있습니다. 부드러운 표현이 관계를 지킵니다.")
    if male and c.lv["비겁"] == "과다":
        score -= 4
        pts.append("비겁이 많아 연애에서 경쟁자가 생기거나 자존심 싸움이 될 수 있습니다.")
    score = _clamp(score)
    advice = [f"인연을 만나기 좋은 곳은 {OH_LUCK[c.el(star)]['direction']} 방향, 좋은 계절은 {OH_LUCK[c.need[0]]['season']}입니다.",
              "대운이나 올해 운에서 배우자 별이 들어오는 시기에 인연이 깊어지기 쉽습니다."]
    head = "좋은 인연을 만나는 힘이 있습니다" if score >= 72 else ("노력과 대화로 사랑이 깊어지는 사주입니다" if score >= 56 else "서두르지 않는 인연이 좋습니다")
    return {"key": "love", "title": "연애 · 결혼운", "hanja": "緣", "score": score, "headline": head, "points": pts, "advice": advice}


def _health(c: _Ctx) -> dict:
    a = c.a
    sc = a["element_score"]
    total = sum(sc.values()) or 1
    score = 70
    pts, advice = [], []
    weak = [o for o in OHAENG if sc[o] / total < 0.08]
    strong = [o for o in OHAENG if sc[o] / total > 0.32]
    for o in weak:
        score -= 6
        pts.append(f"{o}({OHAENG_KR[o]}) 기운이 부족해 {OH_ORGAN[o][0]} 쪽이 약해지기 쉽습니다. 특히 {OH_ORGAN[o][1]}에 신경 쓰세요.")
        advice.append(f"{OHAENG_KR[o]}({o}) 보강: {OH_CARE[o]}")
    for o in strong:
        score -= 5
        victim = GEUK[o]
        pts.append(f"{o}({OHAENG_KR[o]}) 기운이 지나치게 강해 {OH_ORGAN[o][0]}에 과부하가 걸리기 쉽고, "
                   f"이 기운이 누르는 {victim}({OHAENG_KR[victim]})의 {OH_ORGAN[victim][0]}도 함께 살펴야 합니다.")
    if not weak and not strong:
        score += 8
        pts.append("오행이 비교적 고르게 분포해 타고난 체질이 무난하고 회복력이 좋은 편입니다.")
    if c.weak:
        score -= 4
        pts.append("일간이 약한 편이라 무리하면 쉽게 지칠 수 있습니다. 휴식과 수면을 꾸준히 챙기세요.")
    elif c.a["strength"]["label"] == "극신강":
        pts.append("기운이 강해 체력은 좋지만 과로를 과신하기 쉽습니다. 정기 검진으로 미리 관리하세요.")
    score = _clamp(score)
    if not advice:
        advice.append(OH_CARE[c.need[0]])
    head = "체질이 튼튼하고 회복력이 좋습니다" if score >= 75 else ("타고난 약점만 관리하면 무난합니다" if score >= 58 else "꾸준한 건강 관리가 필요한 사주입니다")
    return {"key": "health", "title": "건강운", "hanja": "健", "score": score, "headline": head, "points": pts, "advice": advice}


def _career(c: _Ctx) -> dict:
    top = max(c.ratio, key=c.ratio.get)
    fields = {
        "비겁": "독립 사업·프리랜서·스포츠·영업처럼 스스로 주도하는 일",
        "식상": "기획·콘텐츠·예술·요리·교육·서비스처럼 재능을 표현하는 일",
        "재성": "사업·금융·유통·무역·관리처럼 돈과 사람을 다루는 일",
        "관성": "공무원·대기업·법조·군경·관리직처럼 조직과 원칙이 있는 일",
        "인성": "연구·교육·의료·상담·문서·자격 전문직처럼 지식을 쓰는 일",
    }[top]
    score = 60
    pts = [f"사주의 중심 기운이 {top}이라 {fields}에서 능력이 잘 발휘됩니다.",
           f"용신 {j(c.need[0] + '(' + OHAENG_KR[c.need[0]] + ')', '과/와')} 어울리는 분야는 {OH_JOBS[c.need[0]]} 등입니다."]
    if c.lv["관성"] in ("적당", "과다") and c.lv["인성"] in ("적당", "과다"):
        score += 12
        pts.append("관성과 인성이 함께 있어 조직 안에서 인정받고 승진하는 힘이 좋습니다.")
    if c.lv["식상"] in ("적당", "과다") and c.lv["재성"] in ("적당", "과다"):
        score += 10
        pts.append("식상과 재성이 이어져 내 아이디어를 사업이나 수익으로 연결하는 능력이 있습니다.")
    if c.cnt["상관"] and c.cnt["정관"]:
        score -= 6
        pts.append("상관과 정관이 함께 있어 틀에 박힌 조직 생활에 답답함을 느낄 수 있습니다. 자율성이 보장되는 환경이 더 맞습니다.")
    if "역마살" in c.sinsal:
        pts.append("역마살이 있어 이동·출장·해외와 관련된 일에서 기회가 많습니다.")
    score = _clamp(score + c.fit("관성") // 2)
    advice = [f"추천 분야: {OH_JOBS[c.need[0]]}" + (f", {OH_JOBS[c.need[1]]}" if len(c.need) > 1 else "")]
    head = "조직과 사업 모두에서 성장할 힘이 있습니다" if score >= 75 else "적성에 맞는 분야를 찾으면 크게 성장합니다"
    return {"key": "career", "title": "직업 · 적성", "hanja": "業", "score": score, "headline": head, "points": pts, "advice": advice}


def _luck_period(c: _Ctx, gan: str, ji: str, label: str) -> tuple[int, list[str], str]:
    g_god = ten_god(c.dm, gan)
    j_god = ten_god_branch(c.dm, ji)
    g_oh, j_oh = GAN_OH[GAN.index(gan)], JI_OH[JI.index(ji)]
    score = 60
    for o, w in ((g_oh, 1.0), (j_oh, 1.2)):
        if o == c.need[0]:
            score += 12 * w
        elif o in c.need:
            score += 7 * w
        elif o == c.a["gisin"]["element"]:
            score -= 10 * w
        elif o in c.avoid:
            score -= 5 * w
    pts = [f"{j(label, '은/는')} 천간 {j(f'{gan}({g_god})', '과/와')} 지지 {ji}({j_god})의 기운이 들어옵니다. {GOD_YEAR[g_god]}"]
    good = [o for o in (g_oh, j_oh) if o in c.need]
    bad = [o for o in (g_oh, j_oh) if o in c.avoid]
    if good:
        pts.append(f"이 사주에 필요한 {'·'.join(sorted(set(good)))} 기운이 들어와 전반적으로 운이 힘을 받습니다.")
    if bad:
        pts.append(f"부담이 되는 {'·'.join(sorted(set(bad)))} 기운도 함께 들어오니 무리한 확장은 삼가는 것이 좋습니다.")
    if frozenset(ji + c.day_ji) in JI_CHUNG:
        score -= 6
        pts.append(f"{j(f'{ji}({JI_KR[JI.index(ji)]})', '이/가')} 일지 {c.day_ji}와 충(沖)하여 이사·이직·관계 변화 등 움직임이 많을 수 있습니다. 건강과 배우자 관계를 함께 챙기세요.")
    if frozenset(ji + c.s.pillars[1].ji) in JI_CHUNG:
        pts.append(f"{j(f'{ji}({JI_KR[JI.index(ji)]})', '이/가')} 월지 {c.s.pillars[1].ji}와 충하여 직장·가정 환경에 변화가 생길 수 있습니다.")
    if frozenset(ji + c.day_ji) in JI_YUKHAP:
        score += 4
        pts.append("지지가 일지와 합을 이뤄 좋은 인연과 협력이 따르기 쉽습니다.")
    return _clamp(score), pts, g_god


def _this_year(c: _Ctx, year: int) -> dict:
    k = (year - 4) % 60
    gan, ji = GAN[k % 10], JI[k % 12]
    score, pts, g_god = _luck_period(c, gan, ji, f"{year}년 {ganji_name(k)}({ganji_kr(k)})년")
    advice = [f"올해의 행운 색은 {OH_LUCK[c.need[0]]['color']}, 방향은 {OH_LUCK[c.need[0]]['direction']}입니다."]
    head = "기회를 크게 잡을 수 있는 해입니다" if score >= 75 else ("차근차근 쌓아 가면 좋은 시기입니다" if score >= 56 else "내실을 다지고 건강을 챙길 해입니다")
    return {"key": "year", "title": f"{year}년 운세", "hanja": "歲", "score": score, "headline": head, "points": pts, "advice": advice,
            "ganji": ganji_name(k), "kr": ganji_kr(k)}


def _daewoon(c: _Ctx, year: int) -> dict:
    dws = c.s.daewoon["list"]
    cur = None
    for i, d in enumerate(dws):
        nxt = dws[i + 1]["year"] if i + 1 < len(dws) else 10 ** 6
        if d["year"] <= year < nxt:
            cur = d
            break
    flow = []
    for d in dws:
        s, _, _ = _luck_period(c, d["ganji"][0], d["ganji"][1], "")
        flow.append({"age": d["age"], "year": d["year"], "ganji": d["ganji"], "score": s})
    if not cur:
        start = dws[0]
        return {"key": "daewoon", "title": "대운 흐름", "hanja": "運", "score": None,
                "headline": f"{start['age']}세({start['year']}년)부터 첫 대운이 시작됩니다",
                "points": ["아직 첫 대운이 시작되기 전으로, 이 시기에는 타고난 사주(원국)와 해마다의 운이 중심이 됩니다."],
                "advice": [], "flow": flow}
    score, pts, _ = _luck_period(c, cur["ganji"][0], cur["ganji"][1], f"현재 대운 {cur['ganji']}({cur['kr']}, {cur['age']}세~)")
    ahead = [x for x in flow if x["year"] >= cur["year"]] or flow
    best = max(ahead, key=lambda x: x["score"])
    pts.append(f"앞으로의 대운 중 가장 힘이 실리는 시기는 {best['age']}세 무렵({best['year']}년~) {best['ganji']} 대운입니다.")
    head = "현재 대운이 순풍입니다" if score >= 72 else ("현재 대운은 무난한 흐름입니다" if score >= 56 else "현재 대운은 내실을 다질 시기입니다")
    return {"key": "daewoon", "title": "대운 흐름", "hanja": "運", "score": score, "headline": head, "points": pts, "advice": [], "flow": flow}


# ───────────── 대운 · 세운 상세 풀이 ─────────────
GOD_KEYWORDS = {
    "비견": "자립·동료·경쟁", "겁재": "승부·투자·지출", "식신": "재능·여유·먹을복", "상관": "변화·표현·이직",
    "편재": "사업·투자·활동 무대", "정재": "고정 수입·저축·가정", "편관": "책임·압박·도약", "정관": "직장·명예·승진",
    "편인": "직관·전문 공부·변화", "정인": "학업·문서·귀인",
}
GOD_LIFE = {  # 지지(생활·내면) 쪽 풀이
    "비견": "주변에 비슷한 처지의 사람이 모이고 스스로 결정할 일이 많아집니다.",
    "겁재": "돈이 들고 나는 폭이 커지고 경쟁자가 생기기 쉽습니다.",
    "식신": "마음이 여유롭고 먹고 즐기는 일, 자녀나 후배와 관련된 기쁨이 따릅니다.",
    "상관": "답답한 틀을 벗어나고 싶은 마음이 커지며 말과 표현으로 인한 일이 생깁니다.",
    "편재": "활동 범위가 넓어지고 큰돈이 오가며 바깥일이 바빠집니다.",
    "정재": "생활이 안정되고 수입과 저축, 집안 살림에 힘이 실립니다.",
    "편관": "몸과 마음의 부담이 커지지만 이를 견디면 한 단계 올라섭니다.",
    "정관": "규칙적인 생활과 책임 있는 자리, 공적인 인정이 따릅니다.",
    "편인": "혼자 깊이 생각하는 시간이 늘고 새로운 분야에 관심이 생깁니다.",
    "정인": "윗사람과 어머니 같은 존재의 도움, 문서·계약·공부 운이 따릅니다.",
}
LOVE_GOD = {"M": ("정재", "편재"), "F": ("정관", "편관")}
STAGE_ENERGY = {
    "장생": "새로 시작하는 기운이 싹트는", "목욕": "변화가 많고 마음이 들뜨기 쉬운", "관대": "자신감이 커지고 사회로 나아가는",
    "건록": "실력이 무르익어 자립하는", "제왕": "기운이 절정에 이르는", "쇠": "속도를 늦추고 안정을 찾는",
    "병": "무리하지 말고 몸을 살펴야 하는", "사": "하던 일을 정리하고 마무리하는", "묘": "그동안의 결실을 저장하는",
    "절": "흐름이 바뀌는 전환점의", "태": "새로운 계획을 품는", "양": "힘을 기르며 준비하는",
}
SAMJAE = {"申子辰": "寅卯辰", "亥卯未": "巳午未", "寅午戌": "申酉戌", "巳酉丑": "亥子丑"}


def _period(c: _Ctx, gan: str, ji: str, kind: str) -> dict:
    """대운(kind='dw') 또는 세운(kind='sw') 한 기간의 상세 풀이."""
    from .saju import twelve_stage
    score, _, g_god = _luck_period(c, gan, ji, "")
    j_god = ten_god_branch(c.dm, ji)
    g_oh, j_oh = GAN_OH[GAN.index(gan)], JI_OH[JI.index(ji)]
    stage = twelve_stage(c.dm, ji)
    t = []
    if kind == "dw":
        t.append(f"전반 5년은 천간 {gan}({g_god})의 영향으로 {j(GOD_KEYWORDS[g_god], '이/가')} 삶의 중심 주제가 됩니다. {GOD_YEAR[g_god]}")
        t.append(f"후반 5년은 지지 {ji}({j_god})의 영향이 커져 {GOD_LIFE[j_god]}")
    else:
        t.append(f"{GOD_YEAR[g_god]} 생활 면에서는 {GOD_LIFE[j_god]}")
    t.append(f"일간에게는 12운성 '{stage}'에 해당하는 {STAGE_ENERGY[stage]} 시기입니다.")
    good = sorted({o for o in (g_oh, j_oh) if o in c.need})
    bad = sorted({o for o in (g_oh, j_oh) if o in c.avoid})
    if good and not bad:
        t.append(f"사주에 필요한 {'·'.join(f'{o}({OHAENG_KR[o]})' for o in good)} 기운이 들어와 하는 일에 힘이 실립니다.")
    elif bad and not good:
        t.append(f"사주에 부담이 되는 {'·'.join(f'{o}({OHAENG_KR[o]})' for o in bad)} 기운이 들어오니 확장보다 수비가 좋습니다.")
    elif good and bad:
        t.append(f"도움이 되는 {'·'.join(good)} 기운과 부담이 되는 {'·'.join(bad)} 기운이 섞여 길흉이 교차합니다.")
    if frozenset(ji + c.day_ji) in JI_CHUNG:
        t.append(f"일지와 충(沖)하여 이사·이직·관계 변화가 생기기 쉽고, 배우자·건강을 특히 챙겨야 합니다.")
    elif frozenset(ji + c.day_ji) in JI_YUKHAP:
        t.append("일지와 합(合)하여 좋은 인연·협력자가 생기고 가정에 화목한 일이 따릅니다.")
    if frozenset(ji + c.s.pillars[1].ji) in JI_CHUNG:
        t.append("월지와 충하여 직장·부모·생활 환경에 변화가 있을 수 있습니다.")
    love = LOVE_GOD.get(c.g, ())
    if g_god in love or j_god in love:
        t.append("배우자 별이 들어와 연애·결혼 인연이 깊어지기 좋은 때입니다.")
    if MUNCHANG[c.dm] == ji or g_god == "정인" or j_god == "정인":
        t.append("공부·시험·자격증에 유리합니다.")
    keys = sorted({GOD_KEYWORDS[g_god].split("·")[0], GOD_KEYWORDS[j_god].split("·")[0]})
    level = "대길" if score >= 80 else "길" if score >= 68 else "평" if score >= 55 else "주의"
    return {"ganji": gan + ji, "gods": [g_god, j_god], "stage": stage, "score": score, "level": level,
            "keywords": keys, "elements": [g_oh, j_oh], "text": t}


def daewoon_detail(c: _Ctx, year: int) -> list[dict]:
    dws = c.s.daewoon["list"]
    out = []
    for i, d in enumerate(dws):
        nxt = dws[i + 1]["year"] if i + 1 < len(dws) else d["year"] + 10
        p = _period(c, d["ganji"][0], d["ganji"][1], "dw")
        p.update({"age": d["age"], "age_end": d["age"] + 9, "year": d["year"], "year_end": nxt - 1, "kr": d["kr"],
                  "current": d["year"] <= year < nxt, "past": nxt <= year})
        out.append(p)
    return out


def seun_detail(c: _Ctx, year: int, n: int = 10) -> list[dict]:
    birth_year = int(c.s.solar_date[:4])
    year_ji = c.s.pillars[0].ji
    samjae = next(v for k, v in SAMJAE.items() if year_ji in k)
    out = []
    for y in range(year, year + n):
        k = (y - 4) % 60
        p = _period(c, GAN[k % 10], JI[k % 12], "sw")
        if JI[k % 12] in samjae:
            idx = samjae.index(JI[k % 12])
            p["text"].append(f"띠 기준 삼재({['들삼재', '눌삼재', '날삼재'][idx]})에 해당합니다. 큰 결정은 신중히 하고 건강·안전에 유의하세요.")
            p["samjae"] = ["들삼재", "눌삼재", "날삼재"][idx]
        p.update({"year": y, "age": y - birth_year + 1, "kr": ganji_kr(k), "current": y == year})
        out.append(p)
    return out


# ───────────── 이름 오행 ─────────────
def name_ohaeng(c: _Ctx, name_kr: str, name_hanja: str | None) -> dict | None:
    """이름(성 포함)의 발음오행·자원오행을 사주의 용신과 대조한다."""
    from .naming.hanja_db import get_db
    from .naming.sound import pair_relation, sound_element
    from .naming.suri import four_grids

    name_kr = (name_kr or "").strip()
    if len(name_kr) < 2 or not all("가" <= ch <= "힣" for ch in name_kr):
        return None
    db = get_db()
    two = any(s["kr"] == name_kr[:2] for s in db.surnames if len(s["kr"]) == 2)
    sur_len = 2 if (two and len(name_kr) >= 3) or len(name_kr) >= 4 else 1  # 복성(남궁·제갈 …)
    hanja = list(name_hanja or "")
    chars = []
    for i, ch in enumerate(name_kr):
        h = hanja[i] if i < len(hanja) and hanja[i].strip() else None
        e = db.char(h, ch) if h else None
        chars.append({"kr": ch, "h": e["h"] if e else (h or ""), "m": e["m"] if e else "", "won": e["won"] if e else None,
                      "sound": sound_element(ch), "jawon": e["jw"] if e else None, "is_surname": i < sur_len})
    pts = []
    roles = []
    for x in chars:
        el = x["sound"]
        if x["is_surname"]:
            x["role"] = "성"
            continue
        if el == c.need[0]:
            x["role"] = "용신"
        elif el in c.need:
            x["role"] = "희신" if el == c.a["heesin"]["element"] else "조후"
        elif el == c.a["gisin"]["element"]:
            x["role"] = "기신"
        elif el in c.avoid:
            x["role"] = "구신"
        else:
            x["role"] = "한신"
        roles.append(x["role"])
    given = [x for x in chars if not x["is_surname"]]
    lab = lambda x: f"{x['h']}({x['kr']})" if x["h"] else x["kr"]
    has_hanja = all(x["jawon"] for x in given)
    basis = "발음오행(소리의 오행)"
    pts.append(f"이름 '{name_kr}'의 {basis}은 " + ", ".join(f"{lab(x)} {x['sound']}" for x in given) + "입니다.")
    good = [x for x in given if x["role"] in ("용신", "희신", "조후")]
    bad = [x for x in given if x["role"] in ("기신", "구신")]
    score = 60 + 12 * len([x for x in given if x["role"] == "용신"]) + 8 * len([x for x in given if x["role"] in ("희신", "조후")]) \
        - 10 * len([x for x in given if x["role"] == "기신"]) - 5 * len([x for x in given if x["role"] == "구신"])
    if good:
        pts.append(f"{j(', '.join(lab(x) for x in good), '이/가')} 사주에 필요한 {'·'.join(sorted({(x['sound']) for x in good}))} 기운을 채워 줍니다. 이름이 사주의 부족한 부분을 보완하는 좋은 구성입니다.")
    if bad:
        pts.append(f"{j(', '.join(lab(x) for x in bad), '은/는')} 사주에 부담이 되는 {'·'.join(sorted({(x['sound']) for x in bad}))} 기운이라 아쉬움이 있습니다.")
    if not good and not bad:
        pts.append("이름의 오행이 사주에 크게 도움이 되지도, 해가 되지도 않는 중립적인 구성입니다.")
    # 사주 + 이름 오행 합산
    combined = dict(c.a.get("element_count_saju") or c.a["element_count"])  # 사주 8자에 이름을 한 번만 더함
    for x in given:
        combined[x["sound"]] += 1
    filled = [o for o in OHAENG if c.a["element_count"][o] == 0 and combined[o] > 0]
    if filled:
        pts.append(f"사주에 없던 {'·'.join(f'{o}({OHAENG_KR[o]})' for o in filled)} 기운을 이름이 채워 줍니다.")
    # 발음 흐름
    snd = [x["sound"] for x in chars]
    rels = [pair_relation(snd[i], snd[i + 1]) for i in range(len(snd) - 1)]
    pts.append("발음오행 흐름은 " + " → ".join(f"{x['kr']}({OHAENG_KR[x['sound']]})" for x in chars) +
               (" 으로 막힘 없이 이어집니다." if "상극" not in rels else " 으로 일부 상극이 있어 소리의 흐름에 부딪힘이 있습니다."))
    if "상극" in rels:
        score -= 5
    grids = None
    if all(x["won"] for x in chars):
        grids = four_grids([x["won"] for x in chars if x["is_surname"]], [x["won"] for x in given])
        bad_g = [g["label"] for g in grids.values() if g["level"] == 0]
        pts.append("수리 4격이 모두 길수입니다." if not bad_g else f"수리 흉수: {', '.join(bad_g)}.")
        score += 6 if not bad_g else -4 * len(bad_g)
    else:
        pts.append("한자를 모두 입력하면 수리 4격까지 볼 수 있습니다.")
    score = _clamp(score)
    advice = [] if good else [f"이름이나 호(號)·닉네임에 {'·'.join(f'{o}({OHAENG_KR[o]})' for o in c.need[:2])} 기운의 글자를 쓰면 보완이 됩니다."]
    head = "이름이 사주를 잘 보완합니다" if score >= 72 else ("이름과 사주의 조화가 무난합니다" if score >= 56 else "이름이 사주를 충분히 돕지 못합니다")
    return {"key": "name", "title": "이름 오행", "hanja": "名", "score": score, "headline": head, "points": pts, "advice": advice,
            "chars": chars, "combined": combined, "grids": grids, "basis": "sound"}


def interpret(saju: Saju, analysis: dict, gender: str, year: int | None = None,
              name_kr: str | None = None, name_hanja: str | None = None, question: str | None = None) -> dict:
    year = year or date.today().year
    c = _Ctx(saju, analysis, gender)
    cats = [_personality(c)]
    nm = name_ohaeng(c, name_kr, name_hanja) if name_kr else None
    if nm:
        cats.append(nm)
    cats += [_wealth(c), _study(c), _love(c), _health(c), _career(c), _this_year(c, year), _daewoon(c, year)]
    for x in cats:
        x["stars"] = _stars(x["score"]) if x["score"] is not None else None
    scored = [x["score"] for x in cats if x["score"] is not None and x["key"] not in ("year", "daewoon", "name")]
    res = {
        "year": year,
        "overall": round(sum(scored) / len(scored)),
        "categories": cats,
        "daewoon": daewoon_detail(c, year),
        "seun": seun_detail(c, year),
        "lucky": {"element": c.need[0], "element_kr": OHAENG_KR[c.need[0]], **OH_LUCK[c.need[0]]},
    }
    if question and question.strip():
        from .question import answer
        res["question"] = answer(c, res, question, year)
    return res
