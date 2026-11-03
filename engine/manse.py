"""만세력: 생년월일시·지역 → 사주팔자(년주·월주·일주·시주)와 대운.

규칙
- 년주: 입춘 절입 시각 기준으로 해가 바뀐다.
- 월주: 12절(입춘·경칩·청명 …) 절입 시각 기준. 월간은 년간에서 둔월법(甲己年 丙寅月 …).
- 일주: 율리우스일(JDN) 기준 60갑자 순환. 2000-01-01 = 戊午일.
- 시주: 출생지 경도로 보정한 지방평균태양시(옵션: 균시차까지 → 진태양시) 기준 2시간 단위.
        시간은 일간에서 둔시법(甲己日 甲子時 …).
- 23~24시(子時 전반): zi_mode="jojasi"(기본) 이면 다음날 일진으로, "yajasi" 이면 당일 일진 +
  다음날 일간 기준 시주(야자시)로 계산한다.
- 한국 표준시 변경(1954~61 UTC+8:30)과 서머타임(1948~60, 1987~88)은 tz 데이터베이스로 자동 반영.
"""
from __future__ import annotations

import bisect
import json
import math
from dataclasses import dataclass, field, asdict
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from zoneinfo import ZoneInfo

from korean_lunar_calendar import KoreanLunarCalendar

from . import regions
from .constants import (GAN, GAN_KR, GAN_OH, GAN_YANG, JI, JI_ANIMAL, JI_KR, JI_OH,
                        JIE_LON_TO_BRANCH, SOLAR_TERM_NAMES, ganji_index, ganji_kr, ganji_name)

DATA = Path(__file__).resolve().parent.parent / "data"


@lru_cache(maxsize=1)
def _terms():
    """[(utc datetime, 황경), ...] 시간순 전체 목록."""
    raw = json.loads((DATA / "solar_terms.json").read_text(encoding="utf-8"))
    out = []
    for y in sorted(raw, key=int):
        for lon, iso in raw[y]:
            out.append((datetime.strptime(iso, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc), lon))
    out.sort()
    return out


def _jie_list():
    return [(t, lon) for t, lon in _terms() if lon in JIE_LON_TO_BRANCH]


@lru_cache(maxsize=1)
def _jie_times():
    return [t for t, _ in _jie_list()]


def prev_next_jie(instant_utc: datetime):
    """출생 순간 직전·직후의 절(節)."""
    jl = _jie_list()
    i = bisect.bisect_right(_jie_times(), instant_utc)
    if i == 0 or i >= len(jl):
        raise ValueError("지원 범위(1900~2100년)를 벗어났습니다")
    return jl[i - 1], jl[i]


def equation_of_time_minutes(d: date) -> float:
    """균시차(분). 진태양시 = 평균태양시 + 균시차. (Spencer 1971 근사, 오차 ±30초)"""
    g = 2 * math.pi / 365 * (d.timetuple().tm_yday - 1)
    return 229.18 * (0.000075 + 0.001868 * math.cos(g) - 0.032077 * math.sin(g)
                     - 0.014615 * math.cos(2 * g) - 0.040849 * math.sin(2 * g))


def jdn(d: date) -> int:
    return d.toordinal() + 1721425


def lunar_to_solar(y: int, m: int, d: int, leap: bool = False) -> date:
    cal = KoreanLunarCalendar()
    if not cal.setLunarDate(y, m, d, leap):
        raise ValueError("존재하지 않는 음력 날짜입니다 (윤달 여부 확인)")
    return date(cal.solarYear, cal.solarMonth, cal.solarDay)


def solar_to_lunar(d: date) -> dict:
    cal = KoreanLunarCalendar()
    if not cal.setSolarDate(d.year, d.month, d.day):
        return {}
    return {"year": cal.lunarYear, "month": cal.lunarMonth, "day": cal.lunarDay, "leap": bool(cal.isIntercalation),
            "text": f"음력 {cal.lunarYear}년 {'윤' if cal.isIntercalation else ''}{cal.lunarMonth}월 {cal.lunarDay}일"}


@dataclass
class Pillar:
    name: str            # 년주/월주/일주/시주
    gan: str
    ji: str
    idx60: int

    @property
    def text(self):
        return self.gan + self.ji

    def to_dict(self):
        gi, ji = GAN.index(self.gan), JI.index(self.ji)
        return {
            "name": self.name, "ganji": self.text, "kr": ganji_kr(self.idx60),
            "gan": self.gan, "gan_kr": GAN_KR[gi], "gan_oh": GAN_OH[gi], "gan_yang": GAN_YANG[gi],
            "ji": self.ji, "ji_kr": JI_KR[ji], "ji_oh": JI_OH[ji],
        }


@dataclass
class BirthInput:
    year: int
    month: int
    day: int
    hour: int | None = None       # None = 시간 모름
    minute: int = 0
    calendar: str = "solar"       # solar | lunar
    leap_month: bool = False
    gender: str = "M"             # M | F
    region: str = regions.DEFAULT_REGION
    longitude: float | None = None  # 직접 입력 시 지역보다 우선
    tz: str | None = None
    zi_mode: str = "jojasi"       # jojasi | yajasi
    apply_eot: bool = False       # 균시차(진태양시) 적용 여부
    apply_longitude: bool = True  # 경도 보정 적용 여부


@dataclass
class Saju:
    input: dict
    solar_date: str
    lunar: dict
    standard_time: str            # 입력 시각(현지 표준시, 서머타임 포함)
    utc_time: str
    solar_time: str | None        # 보정된 태양시
    correction_minutes: float | None
    pillars: list[Pillar]
    hour_known: bool
    year_animal: str
    prev_jie: dict
    next_jie: dict
    daewoon: dict = field(default_factory=dict)

    @property
    def day_gan(self):
        return self.pillars[2].gan

    def to_dict(self):
        d = asdict(self)
        d["pillars"] = [p.to_dict() for p in self.pillars]
        return d


def _pillar_year(instant_utc: datetime, solar_year: int) -> Pillar:
    # 해당 양력 연도의 입춘 이전이면 전년도
    ipchun = next(t for t, lon in _terms() if lon == 315 and t.year == solar_year)
    y = solar_year if instant_utc >= ipchun else solar_year - 1
    k = (y - 4) % 60
    return Pillar("년주", GAN[k % 10], JI[k % 12], k)


def _pillar_month(instant_utc: datetime, year_gan_idx: int) -> Pillar:
    (_, lon), _ = prev_next_jie(instant_utc)
    branch = JIE_LON_TO_BRANCH[lon]
    first_stem = (year_gan_idx % 5 * 2 + 2) % 10        # 寅월의 천간: 甲己→丙, 乙庚→戊 …
    stem = (first_stem + (branch - 2) % 12) % 10
    k = ganji_index(stem, branch)
    return Pillar("월주", GAN[stem], JI[branch], k)


def _pillar_day(d: date) -> Pillar:
    k = (jdn(d) + 49) % 60
    return Pillar("일주", GAN[k % 10], JI[k % 12], k)


def _pillar_hour(local_solar: datetime, day_gan_idx: int) -> Pillar:
    minutes = local_solar.hour * 60 + local_solar.minute
    branch = ((minutes + 60) // 120) % 12
    stem = (day_gan_idx % 5 * 2 + branch) % 10           # 甲己日 甲子時, 乙庚日 丙子時 …
    return Pillar("시주", GAN[stem], JI[branch], ganji_index(stem, branch))


def compute(b: BirthInput) -> Saju:
    if b.calendar == "lunar":
        sd = lunar_to_solar(b.year, b.month, b.day, b.leap_month)
    else:
        sd = date(b.year, b.month, b.day)
    if not (1900 <= sd.year <= 2100):
        raise ValueError("1900~2100년 사이만 지원합니다")

    lon, tzname = regions.lookup(b.region) if b.longitude is None else (b.longitude, b.tz or "Asia/Seoul")
    if b.tz:
        tzname = b.tz
    tz = ZoneInfo(tzname)
    hour_known = b.hour is not None
    h, mi = (b.hour, b.minute) if hour_known else (12, 0)  # 시간 미상이면 정오로 년·월·일주만 사용
    local_std = datetime(sd.year, sd.month, sd.day, h, mi, tzinfo=tz)
    instant = local_std.astimezone(timezone.utc)

    # 지방평균태양시 = UTC + 경도/15시간 (+ 균시차)
    corr_from_std = None
    solar_local = local_std.replace(tzinfo=None)
    if b.apply_longitude:
        solar_local = instant.replace(tzinfo=None) + timedelta(hours=lon / 15)
        if b.apply_eot:
            solar_local += timedelta(minutes=equation_of_time_minutes(solar_local.date()))
        corr_from_std = round((solar_local - local_std.replace(tzinfo=None)).total_seconds() / 60, 1)

    year_p = _pillar_year(instant, _solar_year_for(instant))
    month_p = _pillar_month(instant, GAN.index(year_p.gan))

    day_date = solar_local.date() if hour_known else sd
    late_zi = hour_known and solar_local.hour == 23
    if late_zi and b.zi_mode == "jojasi":
        day_date += timedelta(days=1)
    day_p = _pillar_day(day_date)
    pillars = [year_p, month_p, day_p]
    if hour_known:
        stem_base = GAN.index(day_p.gan)
        if late_zi and b.zi_mode == "yajasi":
            stem_base = GAN.index(_pillar_day(day_date + timedelta(days=1)).gan)
        pillars.append(_pillar_hour(solar_local, stem_base))

    (pt, plon), (nt, nlon) = prev_next_jie(instant)
    kst = ZoneInfo("Asia/Seoul")
    saju = Saju(
        input=asdict(b), solar_date=sd.isoformat(), lunar=solar_to_lunar(sd),
        standard_time=local_std.strftime("%Y-%m-%d %H:%M") + f" ({local_std.tzname()})" if hour_known else sd.isoformat(),
        utc_time=instant.strftime("%Y-%m-%d %H:%M UTC") if hour_known else "",
        solar_time=solar_local.strftime("%Y-%m-%d %H:%M") if hour_known else None,
        correction_minutes=corr_from_std if hour_known else None,
        pillars=pillars, hour_known=hour_known, year_animal=JI_ANIMAL[JI.index(year_p.ji)],
        prev_jie={"name": SOLAR_TERM_NAMES[plon], "time": pt.astimezone(kst).strftime("%Y-%m-%d %H:%M KST")},
        next_jie={"name": SOLAR_TERM_NAMES[nlon], "time": nt.astimezone(kst).strftime("%Y-%m-%d %H:%M KST")},
    )
    saju.daewoon = compute_daewoon(saju, instant, b.gender, pt, nt)
    return saju


def _solar_year_for(instant_utc: datetime) -> int:
    # 입춘은 항상 2월 3~5일이므로 KST 기준 연도와 UTC 연도 차이는 무관하다
    return (instant_utc + timedelta(hours=9)).year


def compute_daewoon(saju: Saju, instant: datetime, gender: str, prev_t: datetime, next_t: datetime) -> dict:
    """대운: 양남음녀 순행, 음남양녀 역행. 절입까지 3일 = 1년."""
    year_yang = GAN_YANG[GAN.index(saju.pillars[0].gan)]
    forward = (year_yang and gender == "M") or (not year_yang and gender == "F")
    days = ((next_t - instant) if forward else (instant - prev_t)).total_seconds() / 86400
    start = max(1, round(days / 3))
    month_idx = saju.pillars[1].idx60
    birth_year = int(saju.solar_date[:4])
    items = []
    for n in range(1, 11):
        k = (month_idx + n) % 60 if forward else (month_idx - n) % 60
        age = start + (n - 1) * 10
        items.append({"age": age, "year": birth_year + age - 1, "ganji": ganji_name(k), "kr": ganji_kr(k),
                      "gan_oh": GAN_OH[k % 10], "ji_oh": JI_OH[k % 12]})
    return {"forward": forward, "start_age": start, "days_to_jie": round(days, 2), "list": items}
