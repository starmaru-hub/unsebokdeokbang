"""웹(GitHub Pages)용 정적 파일 만들기.

1) 파이썬 엔진의 표·문구 상수를 JS 모듈(app/static/js/engine/tables.js)로 내보낸다.
   → JS 엔진이 파이썬과 똑같은 문구·표를 쓰게 하기 위함 (손으로 옮길 때의 오타 방지)
2) 엔진이 쓰는 데이터 JSON 을 app/static/data/ 로 복사한다 (한자 DB는 화면에 안 쓰는 필드 제거).

실행:  python scripts/build_web.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from engine import compat, constants, fortune, question, regions, saju  # noqa: E402
from engine.naming import sound, suri  # noqa: E402

OUT_JS = ROOT / "app" / "static" / "js" / "engine" / "tables.js"
OUT_DATA = ROOT / "app" / "static" / "data"


def conv(v):
    """frozenset·set·tuple 키/값을 JSON 으로 옮길 수 있게 바꾼다."""
    if isinstance(v, dict):
        out = {}
        for k, x in v.items():
            if isinstance(k, frozenset):
                k = "".join(sorted(k))
            elif isinstance(k, tuple):
                k = "|".join(str(p).lower() if isinstance(p, bool) else str(p) for p in k)
            out[str(k)] = conv(x)
        return out
    if isinstance(v, frozenset):
        return "".join(sorted(v))
    if isinstance(v, set):
        return sorted(conv(x) for x in v)
    if isinstance(v, (list, tuple)):
        return [conv(x) for x in v]
    return v


TABLES = {
    # constants
    **{k: getattr(constants, k) for k in (
        "GAN", "GAN_KR", "JI", "JI_KR", "JI_ANIMAL", "OHAENG", "OHAENG_KR", "GAN_OH", "GAN_YANG", "JI_OH", "JI_YANG",
        "JIJANGGAN", "SAENG", "GEUK", "JIE_LON_TO_BRANCH", "SOLAR_TERM_NAMES", "TWELVE_STAGES", "JANGSAENG")},
    # saju
    **{k: getattr(saju, k) for k in (
        "TEN_GODS", "GROUP_OF", "W_STEM", "W_BRANCH", "DAY_MASTER_DESC", "OH_DESC", "GAN_HAP", "GAN_CHUNG",
        "JI_YUKHAP", "JI_CHUNG", "JI_SAMHAP", "CHEONEUL", "REL_GROUP", "W_NAME")},
    # fortune
    **{k: getattr(fortune, k) for k in (
        "OH_ORGAN", "OH_CARE", "OH_JOBS", "OH_LUCK", "GROUP_TRAIT", "GOD_YEAR", "MUNCHANG", "GOD_KEYWORDS",
        "GOD_LIFE", "LOVE_GOD", "STAGE_ENERGY", "SAMJAE")},
    # question
    "Q_TOPICS": question.TOPICS, "Q_GOOD": question.GOOD, "Q_BAD": question.BAD,
    "Q_GOD_TOPIC_TEXT": question.GOD_TOPIC_TEXT, "Q_TOPIC_ADVICE": question.TOPIC_ADVICE,
    "Q_HEALTH_ORGAN": question.HEALTH_ORGAN, "Q_YEOKMA": question.YEOKMA,
    # compat
    "WONJIN": compat.WONJIN, "COMPANY_STYLE": compat.COMPANY_STYLE,
    # naming
    "SURI_81": suri.SURI_81, "LEVEL_KR": suri.LEVEL_KR, "STRONG_FOR_WOMEN": suri.STRONG_FOR_WOMEN,
    "CHO": sound.CHO, "SOUND_SCHOOLS": sound.SCHOOLS,
    # regions
    "REGIONS": regions.REGIONS, "DEFAULT_REGION": regions.DEFAULT_REGION,
}

# 화면·엔진에서 쓰지 않는 한자 필드(영문 뜻, 코드값 등)는 빼서 용량을 줄인다
HANJA_KEEP = ("h", "r", "m", "won", "pil", "jw", "grade", "tier")


def main():
    OUT_JS.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(conv(TABLES), ensure_ascii=False, separators=(",", ":"))
    OUT_JS.write_text("// 자동 생성 파일 — scripts/build_web.py 로 다시 만드세요. 직접 고치지 마세요.\n"
                      f"export const T = {body};\n", encoding="utf-8")
    OUT_DATA.mkdir(parents=True, exist_ok=True)
    hanja = json.loads((ROOT / "data" / "hanja.json").read_text(encoding="utf-8"))
    slim = [{k: e[k] for k in HANJA_KEEP} for e in hanja]
    (OUT_DATA / "hanja.json").write_text(json.dumps(slim, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    for name in ("solar_terms.json", "surnames.json", "name_pool.json", "name_favored.json", "bad_hanja.json"):
        src = json.loads((ROOT / "data" / name).read_text(encoding="utf-8"))
        (OUT_DATA / name).write_text(json.dumps(src, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    for f in sorted(OUT_DATA.iterdir()):
        print(f"{f.name:20s} {f.stat().st_size:>9,d} bytes")
    print(f"{OUT_JS.name:20s} {OUT_JS.stat().st_size:>9,d} bytes")


if __name__ == "__main__":
    main()
