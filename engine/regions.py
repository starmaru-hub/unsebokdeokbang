"""출생 지역 → (경도, 시간대).  경도는 진태양시(지방평균태양시) 보정에 쓴다."""

# 이름: (경도°E, IANA 시간대)
REGIONS = {
    # 수도권
    "서울": (126.978, "Asia/Seoul"), "인천": (126.705, "Asia/Seoul"), "수원": (127.028, "Asia/Seoul"),
    "성남": (127.137, "Asia/Seoul"), "고양": (126.832, "Asia/Seoul"), "용인": (127.177, "Asia/Seoul"),
    "부천": (126.766, "Asia/Seoul"), "안산": (126.831, "Asia/Seoul"), "안양": (126.951, "Asia/Seoul"),
    "화성": (126.831, "Asia/Seoul"), "평택": (127.112, "Asia/Seoul"), "의정부": (127.033, "Asia/Seoul"),
    "파주": (126.780, "Asia/Seoul"), "김포": (126.716, "Asia/Seoul"), "남양주": (127.216, "Asia/Seoul"),
    "시흥": (126.803, "Asia/Seoul"), "광명": (126.865, "Asia/Seoul"), "하남": (127.215, "Asia/Seoul"),
    "이천": (127.443, "Asia/Seoul"), "강화": (126.488, "Asia/Seoul"),
    # 강원
    "춘천": (127.730, "Asia/Seoul"), "원주": (127.920, "Asia/Seoul"), "강릉": (128.876, "Asia/Seoul"),
    "속초": (128.591, "Asia/Seoul"), "동해": (129.114, "Asia/Seoul"), "삼척": (129.165, "Asia/Seoul"),
    "태백": (128.986, "Asia/Seoul"),
    # 충청
    "대전": (127.385, "Asia/Seoul"), "세종": (127.289, "Asia/Seoul"), "청주": (127.489, "Asia/Seoul"),
    "충주": (127.926, "Asia/Seoul"), "제천": (128.191, "Asia/Seoul"), "천안": (127.152, "Asia/Seoul"),
    "아산": (127.002, "Asia/Seoul"), "공주": (127.119, "Asia/Seoul"), "논산": (127.099, "Asia/Seoul"),
    "서산": (126.450, "Asia/Seoul"), "보령": (126.613, "Asia/Seoul"), "당진": (126.646, "Asia/Seoul"),
    # 전라
    "광주": (126.851, "Asia/Seoul"), "전주": (127.148, "Asia/Seoul"), "군산": (126.737, "Asia/Seoul"),
    "익산": (126.957, "Asia/Seoul"), "정읍": (126.856, "Asia/Seoul"), "남원": (127.390, "Asia/Seoul"),
    "목포": (126.392, "Asia/Seoul"), "여수": (127.662, "Asia/Seoul"), "순천": (127.487, "Asia/Seoul"),
    "나주": (126.711, "Asia/Seoul"), "광양": (127.696, "Asia/Seoul"), "해남": (126.599, "Asia/Seoul"),
    # 경상
    "부산": (129.075, "Asia/Seoul"), "대구": (128.601, "Asia/Seoul"), "울산": (129.311, "Asia/Seoul"),
    "창원": (128.681, "Asia/Seoul"), "진주": (128.108, "Asia/Seoul"), "김해": (128.889, "Asia/Seoul"),
    "양산": (129.037, "Asia/Seoul"), "거제": (128.621, "Asia/Seoul"), "통영": (128.433, "Asia/Seoul"),
    "포항": (129.343, "Asia/Seoul"), "경주": (129.225, "Asia/Seoul"), "구미": (128.344, "Asia/Seoul"),
    "안동": (128.729, "Asia/Seoul"), "김천": (128.114, "Asia/Seoul"), "영주": (128.624, "Asia/Seoul"),
    "상주": (128.159, "Asia/Seoul"), "경산": (128.741, "Asia/Seoul"), "울릉": (130.905, "Asia/Seoul"),
    # 제주
    "제주": (126.531, "Asia/Seoul"), "서귀포": (126.560, "Asia/Seoul"),
    # 북한
    "평양": (125.754, "Asia/Seoul"), "개성": (126.554, "Asia/Seoul"), "함흥": (127.536, "Asia/Seoul"),
    "신의주": (124.398, "Asia/Seoul"), "원산": (127.443, "Asia/Seoul"), "청진": (129.776, "Asia/Seoul"),
    # 해외 주요 도시
    "도쿄": (139.692, "Asia/Tokyo"), "오사카": (135.502, "Asia/Tokyo"), "베이징": (116.407, "Asia/Shanghai"),
    "상하이": (121.474, "Asia/Shanghai"), "홍콩": (114.169, "Asia/Hong_Kong"), "타이베이": (121.565, "Asia/Taipei"),
    "싱가포르": (103.820, "Asia/Singapore"), "방콕": (100.502, "Asia/Bangkok"), "하노이": (105.834, "Asia/Ho_Chi_Minh"),
    "호치민": (106.660, "Asia/Ho_Chi_Minh"), "마닐라": (120.984, "Asia/Manila"), "시드니": (151.209, "Australia/Sydney"),
    "멜버른": (144.963, "Australia/Melbourne"), "오클랜드": (174.763, "Pacific/Auckland"),
    "런던": (-0.128, "Europe/London"), "파리": (2.352, "Europe/Paris"), "베를린": (13.405, "Europe/Berlin"),
    "모스크바": (37.617, "Europe/Moscow"), "두바이": (55.271, "Asia/Dubai"),
    "뉴욕": (-74.006, "America/New_York"), "워싱턴": (-77.037, "America/New_York"), "애틀랜타": (-84.388, "America/New_York"),
    "시카고": (-87.630, "America/Chicago"), "댈러스": (-96.797, "America/Chicago"), "덴버": (-104.990, "America/Denver"),
    "로스앤젤레스": (-118.244, "America/Los_Angeles"), "샌프란시스코": (-122.419, "America/Los_Angeles"),
    "시애틀": (-122.332, "America/Los_Angeles"), "호놀룰루": (-157.858, "Pacific/Honolulu"),
    "토론토": (-79.383, "America/Toronto"), "밴쿠버": (-123.121, "America/Vancouver"),
    "상파울루": (-46.633, "America/Sao_Paulo"),
}

DEFAULT_REGION = "서울"


def lookup(name: str):
    if name not in REGIONS:
        raise KeyError(f"등록되지 않은 지역입니다: {name}")
    return REGIONS[name]
