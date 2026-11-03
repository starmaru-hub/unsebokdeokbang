"""대법원 인명용 한자 DB 생성.

입력 (data/raw):
  gov.csv               대법원 전자가족관계등록시스템 인명용 한자 (zispace/data-hanja 크롤링본)
  naver.csv             네이버 한자사전 인명용 한자 훈음
  hanja_grade.csv       한국어문회 급수 (rycont/hanja-grade-dataset)
  libhangul_hanja.txt   libhangul 한자 사전 (훈음 보충)
  unihan/*.txt          Unicode Unihan (부수·획수·KS X 1001 수록 여부)

출력: data/hanja.json
  [{"h": 한자, "r": 음, "m": 훈(뜻), "rad": 부수번호, "rad_c": 부수자,
    "won": 원획, "pil": 필획, "jw": 자원오행, "grade": 급수, "ks": KS X 1001 수록,
    "tier": 친숙도 0~5}, ...]
"""
import csv
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "hanja.json"

# 강희자전 214부수의 획수 (부수 번호 구간별)
_RAD_STROKE_RANGES = [
    (1, 6, 1), (7, 29, 2), (30, 60, 3), (61, 94, 4), (95, 117, 5), (118, 146, 6),
    (147, 166, 7), (167, 175, 8), (176, 186, 9), (187, 194, 10), (195, 200, 11),
    (201, 204, 12), (205, 208, 13), (209, 210, 14), (211, 211, 15), (212, 213, 16), (214, 214, 17),
]


def radical_strokes(n: int) -> int:
    for lo, hi, s in _RAD_STROKE_RANGES:
        if lo <= n <= hi:
            return s
    raise ValueError(n)


# 숫자 한자는 원획법에서 그 수의 값으로 센다
NUMERAL_STROKES = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10}

GRADE_TIER = {
    "8급": 5, "7급Ⅱ": 5, "7급": 5, "6급Ⅱ": 5, "6급": 5, "5급Ⅱ": 5, "5급": 5,
    "4급Ⅱ": 4, "4급": 4, "3급Ⅱ": 4, "3급": 4, "2급": 3, "1급": 2, "특급Ⅱ": 1, "특급": 1,
}


def load_unihan():
    fields = {"kRSUnicode", "kTotalStrokes", "kIRG_KSource", "kHangul", "kDefinition"}
    data = defaultdict(dict)
    for name in ("Unihan_IRGSources.txt", "Unihan_Readings.txt"):
        with open(RAW / "unihan" / name, encoding="utf-8") as f:
            for line in f:
                if line.startswith("#") or not line.strip():
                    continue
                cp, key, val = line.rstrip("\n").split("\t", 2)
                if key in fields:
                    data[chr(int(cp[2:], 16))][key] = val
    return data


def load_radical_chars():
    """부수번호 → 부수 글자 (CJK Radicals: 康熙部首 U+2F00~)."""
    return {i + 1: chr(0x2F00 + i) for i in range(214)}


def nfc(ch: str) -> str:
    """호환용 한자(U+F900~, 대법원이 李/리 등 다른 음에 사용)를 통합 한자로 정규화."""
    return unicodedata.normalize("NFC", ch)


def load_meanings():
    naver = {}
    with open(RAW / "naver.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            note = (row["note"] or "").strip()
            # "아름다울 가" → "아름다울"
            if note.endswith(row["hangul"]):
                note = note[: -len(row["hangul"])].strip()
            if note and note != row["hangul"]:
                naver[(nfc(row["hanja"]), row["hangul"])] = note
    lib = {}
    with open(RAW / "libhangul_hanja.txt", encoding="utf-8") as f:
        for line in f:
            if line.startswith("#"):
                continue
            parts = line.rstrip("\n").split(":")
            if len(parts) >= 3 and len(parts[0]) == 1 and len(parts[1]) == 1:
                m = parts[2].strip()
                if m.endswith(parts[0]):
                    m = m[: -len(parts[0])].strip()
                if m and m != parts[0]:
                    lib.setdefault((nfc(parts[1]), parts[0]), m)
    grade = {}
    with open(RAW / "hanja_grade.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            grade.setdefault(nfc(row["hanja"]), row["level"])
    return naver, lib, grade


def main():
    rad_ohaeng = json.loads((ROOT / "data" / "radical_ohaeng.json").read_text(encoding="utf-8"))
    rad_ohaeng = {int(k): v for k, v in rad_ohaeng["map"].items()}
    overrides = json.loads((ROOT / "data" / "jawon_override.json").read_text(encoding="utf-8"))["map"]
    uni = load_unihan()
    rad_chars = load_radical_chars()
    naver, lib, grade = load_meanings()

    out, skipped = [], 0
    seen = set()
    with open(RAW / "gov.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            orig, r = row["hanja"], row["hangul"]
            h = nfc(orig)
            if (h, r) in seen:
                continue
            seen.add((h, r))
            u = uni.get(h)
            if row["pua"] == "1" or not u or "kRSUnicode" not in u:
                skipped += 1  # 사용자 정의 영역/미등록 글자: 화면 표시 불가 → 제외
                continue
            rs = u["kRSUnicode"].split()[0]
            m = re.match(r"(\d+)'*\.(-?\d+)", rs)
            rad, resid = int(m.group(1)), int(m.group(2))
            won = NUMERAL_STROKES.get(h, radical_strokes(rad) + resid)
            pil = int(u.get("kTotalStrokes", "0").split()[0]) or won

            gov_note = (row["note"] or "").strip()
            gm = re.match(r"^([^(,]+)\(" + re.escape(r) + r"\)$", gov_note)
            meaning = naver.get((h, r)) or (gm.group(1) if gm else None) or lib.get((h, r))
            if not meaning:
                # 다른 음으로 등록된 같은 글자의 훈이라도 사용
                meaning = next((v for (hh, _), v in naver.items() if hh == h), None)

            g = grade.get(h)
            ks = u.get("kIRG_KSource", "").startswith("K0")
            tier = GRADE_TIER.get(g, 0)
            if tier == 0 and ks:
                tier = 1 if meaning else 0
            out.append({
                "h": h, "cp": f"U+{ord(orig):04X}", "r": r, "m": meaning or "", "rad": rad, "rad_c": rad_chars[rad],
                "won": won, "pil": pil, "jw": overrides.get(h, rad_ohaeng.get(rad)),
                "grade": g or "", "ks": ks, "tier": tier,
                "en": u.get("kDefinition", "")[:80],
            })

    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"saved {len(out)} entries ({len({e['h'] for e in out})} chars), skipped {skipped}")
    no_m = sum(1 for e in out if not e["m"])
    print("tier dist", {t: sum(1 for e in out if e["tier"] == t) for t in range(6)}, "no meaning", no_m)


if __name__ == "__main__":
    main()
