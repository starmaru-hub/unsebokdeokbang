"""24절기 절입 시각표(UTC) 생성 — 1900~2100년.

ephem(VSOP87)으로 태양 시황경이 15° 배수가 되는 순간을 이분법으로 찾는다.
결과: data/solar_terms.json  {"1990": [[황경, "ISO UTC"], ...], ...}
런타임에는 ephem 없이 이 표만 읽는다.
"""
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import ephem

OUT = Path(__file__).resolve().parent.parent / "data" / "solar_terms.json"


def sun_lon(d: float) -> float:
    """ephem.Date(d) 시각의 태양 겉보기 황경(도, 0~360)."""
    s = ephem.Sun()
    s.compute(ephem.Date(d), epoch=ephem.Date(d))
    # 광행차·장동이 반영된 겉보기 적경/적위 → 그 시점 황도좌표 (KASI 발표값과 수 초 이내)
    ecl = ephem.Ecliptic(ephem.Equatorial(s.ra, s.dec, epoch=ephem.Date(d)), epoch=ephem.Date(d))
    return math.degrees(ecl.lon) % 360


def find_term(target: float, guess: float) -> float:
    """guess 근처(±20일)에서 황경이 target 이 되는 시각."""
    def diff(d):
        return ((sun_lon(d) - target + 180) % 360) - 180

    lo, hi = guess - 20, guess + 20
    while diff(lo) > 0:
        lo -= 5
    while diff(hi) < 0:
        hi += 5
    for _ in range(60):  # 40일 / 2^60 → 충분
        mid = (lo + hi) / 2
        if diff(mid) < 0:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def main():
    table = {}
    for year in range(1899, 2102):
        terms = []
        # 소한(285°)부터 동지(270°)까지 그해 양력 순서대로
        for k in range(24):
            lon = (285 + 15 * k) % 360
            # 대략적 날짜: 소한 ≈ 1월 6일, 이후 약 15.22일 간격
            guess = float(ephem.Date(f"{year}/1/6")) + k * 15.218
            d = find_term(lon, guess)
            dt = ephem.Date(d).datetime().replace(tzinfo=timezone.utc)
            terms.append([lon, dt.strftime("%Y-%m-%dT%H:%M:%SZ")])
        table[str(year)] = terms
        if year % 20 == 0:
            print(year, terms[2])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(table, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("saved", OUT)


if __name__ == "__main__":
    main()
