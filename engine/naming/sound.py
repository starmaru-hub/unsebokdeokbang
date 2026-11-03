"""한글 발음: 초성 분해와 발음오행."""
from ..constants import GEUK, SAENG

CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"
JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"
JONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"]

# 학설 1 (현대 작명 다수설): ㅇㅎ=土, ㅁㅂㅍ=水
# 학설 2 (훈민정음 해례본):   ㅇㅎ=水, ㅁㅂㅍ=土
_BASE = {"ㄱ": "木", "ㄲ": "木", "ㅋ": "木", "ㄴ": "火", "ㄷ": "火", "ㄸ": "火", "ㄹ": "火", "ㅌ": "火",
         "ㅅ": "金", "ㅆ": "金", "ㅈ": "金", "ㅉ": "金", "ㅊ": "金"}
SCHOOLS = {
    "modern": {**_BASE, "ㅇ": "土", "ㅎ": "土", "ㅁ": "水", "ㅂ": "水", "ㅃ": "水", "ㅍ": "水"},
    "hunmin": {**_BASE, "ㅇ": "水", "ㅎ": "水", "ㅁ": "土", "ㅂ": "土", "ㅃ": "土", "ㅍ": "土"},
}


def decompose(syl: str):
    code = ord(syl) - 0xAC00
    if not 0 <= code < 11172:
        raise ValueError(f"한글 음절이 아닙니다: {syl}")
    return CHO[code // 588], JUNG[(code % 588) // 28], JONG[code % 28]


def sound_element(syl: str, school: str = "modern") -> str:
    return SCHOOLS[school][decompose(syl)[0]]


def pair_relation(a: str, b: str) -> str:
    if a == b:
        return "비화"
    if SAENG[a] == b or SAENG[b] == a:
        return "상생"
    return "상극"


def sound_flow(syllables: list[str], school: str = "modern") -> dict:
    els = [sound_element(s, school) for s in syllables]
    rels = [pair_relation(els[i], els[i + 1]) for i in range(len(els) - 1)]
    return {"elements": els, "relations": rels}
