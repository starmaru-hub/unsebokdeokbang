"""인명용 한자 DB 조회."""
from __future__ import annotations

import json
import re
from collections import defaultdict
from functools import lru_cache
from pathlib import Path

DATA = Path(__file__).resolve().parents[2] / "data"

_SPLIT = re.compile(r"[\s,/;·()]+")


class HanjaDB:
    def __init__(self):
        self.entries = json.loads((DATA / "hanja.json").read_text(encoding="utf-8"))
        self.by_reading = defaultdict(list)
        self.by_char = {}
        for e in self.entries:
            self.by_reading[e["r"]].append(e)
            self.by_char.setdefault(e["h"], e)
        bad = json.loads((DATA / "bad_hanja.json").read_text(encoding="utf-8"))
        self.hard_bad = set(bad["hard"])
        self.soft_bad = set(bad["soft"])
        self.bad_words = set(bad["meaning_keywords"])
        self.surnames = json.loads((DATA / "surnames.json").read_text(encoding="utf-8"))["list"]

    def is_hard_bad(self, e) -> bool:
        if e["h"] in self.hard_bad:
            return True
        return any(tok in self.bad_words for tok in _SPLIT.split(e["m"]) if tok)

    def candidates(self, syllable: str, min_tier: int = 2) -> list[dict]:
        """이름에 쓸 만한 한자 후보 (뜻 나쁜 글자 제외, 친숙도 min_tier 이상)."""
        return [e for e in self.by_reading.get(syllable, [])
                if e["tier"] >= min_tier and e["m"] and e["jw"] and not self.is_hard_bad(e)]

    def char(self, h: str, reading: str | None = None) -> dict | None:
        if reading:
            for e in self.by_reading.get(reading, []):
                if e["h"] == h:
                    return e
        return self.by_char.get(h)

    def search(self, q: str, limit: int = 200) -> list[dict]:
        """음(한글 한 글자) 또는 한자로 검색."""
        if not q:
            return []
        if q in self.by_reading:
            res = sorted(self.by_reading[q], key=lambda e: (-e["tier"], e["won"]))
        else:
            res = [e for e in self.entries if e["h"] in q]
        return res[:limit]

    def surname_options(self, kr: str) -> list[dict]:
        out = []
        for s in self.surnames:
            if s["kr"] == kr:
                same_len = len(kr) == len(s["hanja"])
                chars = [self.char(c, kr[i] if same_len else None) for i, c in enumerate(s["hanja"])]
                if all(chars):
                    out.append({"kr": kr, "hanja": s["hanja"], "chars": chars})
        return out


@lru_cache(maxsize=1)
def get_db() -> HanjaDB:
    return HanjaDB()
