"""작명: 사주 분석 결과 + 성씨 → 인명용 한자 이름 추천 / 이름 감정.

점수 (100점 만점)
  자원오행  30  이름 한자의 자원오행이 용신·희신(필요 오행)인가
  수리      30  원형이정 4격이 길수인가 (81수리)
  발음오행  15  성→이름 초성 오행이 상생으로 흐르는가
  음양      10  획수 홀(양)·짝(음)이 섞였는가
  한자품질  15  익숙한 한자인가(급수), 불용문자 여부, 자연스러운 이름인가
"""
from __future__ import annotations

import itertools
import json
from dataclasses import dataclass, field
from pathlib import Path

from ..constants import OHAENG_KR
from .hanja_db import get_db
from .sound import sound_flow
from .suri import STRONG_FOR_WOMEN, four_grids

DATA = Path(__file__).resolve().parents[2] / "data"


@dataclass
class NamingOptions:
    gender: str = "M"
    sound_school: str = "modern"     # modern | hunmin
    min_tier: int = 2                # 한자 친숙도 하한 (0~5, 높을수록 쉬운 한자만)
    exclude_soft_bad: bool = False   # 전통 불용문자 완전 제외
    allow_suri_bad: bool = False     # 흉수 포함 이름도 결과에 허용
    fixed_syllable: str | None = None    # 돌림자(한글)
    fixed_position: int = 0              # 돌림자 위치 0=첫째 1=둘째
    fixed_hanja: str | None = None       # 돌림자 한자 지정
    candidates: list[str] = field(default_factory=list)  # 사용자가 고른 한글 이름 후보
    single_name: bool = False        # 외자 이름
    top_n: int = 30
    per_name: int = 2                # 한글 이름 하나당 최대 한자 조합 수


def _load_pool():
    return json.loads((DATA / "name_pool.json").read_text(encoding="utf-8"))


def _load_favored():
    return json.loads((DATA / "name_favored.json").read_text(encoding="utf-8"))["map"]


class Namer:
    def __init__(self, analysis: dict, surname_chars: list[dict], surname_kr: str, opts: NamingOptions,
                 parents: list[dict] | None = None):
        self.db = get_db()
        self.a = analysis
        self.sur = surname_chars
        self.sur_kr = surname_kr
        self.o = opts
        self.need = analysis["needed_elements"]       # [용신, 희신, (조후)]
        self.avoid = analysis["avoid_elements"]
        self.pool = _load_pool()
        self.favored = _load_favored()
        self.pool_rank = {g: {n: i for i, n in enumerate(self.pool[g])} for g in ("M", "F")}
        # 부모 사주: [{"label": "아버지", "analysis": {...}}, ...] — 있으면 '부모 조화' 10점 항목을 더한다
        self.parents = parents or []

    def parent_points(self, el: str) -> tuple[float, list[str]]:
        """한자 오행 하나가 부모 사주에 주는 영향 (부모 1명당 -2.5 ~ +2.5)."""
        pts, notes = 0.0, []
        for p in self.parents:
            pa = p["analysis"]
            if el == pa["needed_elements"][0]:
                pts += 2.5
                notes.append(f"{p['label']} 용신")
            elif el in pa["needed_elements"][1:]:
                pts += 1.5
                notes.append(f"{p['label']} 희신")
            elif el == pa["gisin"]["element"]:
                pts -= 2.5
                notes.append(f"{p['label']} 기신")
            elif el in pa["avoid_elements"]:
                pts -= 1
        return pts, notes

    # ---------- 개별 한자 점수 ----------
    def element_points(self, el: str) -> tuple[float, str]:
        if el == self.need[0]:
            return 15, "용신"
        if len(self.need) > 1 and el == self.need[1]:
            return 12, "희신"
        if el in self.need[2:]:
            return 10, "조후"
        if el in self.avoid:
            return (0, "기신") if el == self.a["gisin"]["element"] else (3, "구신")
        return 6, "한신"

    def quality_points(self, e: dict) -> float:
        """글자 하나의 작명 적합도 (최대 7). 작명 선호 한자 > 급수 높은 한자 > 희귀 한자."""
        fav = self.favored.get(e["r"], [])
        if e["h"] in fav:
            p = max(5.0, 7 - 0.3 * fav.index(e["h"]))
        else:
            p = e["tier"] * 0.8
        if e["h"] in self.db.soft_bad:
            p -= 3
        return p

    # ---------- 후보 한글 이름 ----------
    def hangul_names(self) -> list[str]:
        if self.o.candidates:
            return [c.strip() for c in self.o.candidates if c.strip()]
        g = self.o.gender if self.o.gender in ("M", "F") else "M"
        base = list(self.pool[g])
        if self.o.single_name:
            sylls = sorted({s for n in base for s in n})
            return sylls
        if self.o.fixed_syllable:
            fs, pos = self.o.fixed_syllable, self.o.fixed_position
            names = [n for n in base if len(n) == 2 and n[pos] == fs]
            other = sorted({n[1 - pos] for n in base if len(n) == 2})
            for s in other:
                n = fs + s if pos == 0 else s + fs
                if n not in names and s != fs:
                    names.append(n)
            return names
        return base

    # ---------- 이름 하나 평가 ----------
    def evaluate(self, given_chars: list[dict], given_kr: str) -> dict:
        sur_strokes = [c["won"] for c in self.sur]
        giv_strokes = [c["won"] for c in given_chars]

        # 자원오행 (30)
        jw = []
        jw_pts = 0.0
        for c in given_chars:
            pts, role = self.element_points(c["jw"])
            jw.append({"h": c["h"], "element": c["jw"], "role": role})
            jw_pts += pts
        if len(given_chars) == 1:
            jw_pts *= 2
        # 두 글자가 용신·희신을 모두 채우면 가산
        roles = {x["role"] for x in jw}
        if {"용신", "희신"} <= roles:
            jw_pts = min(30, jw_pts + 3)

        # 수리 (30)
        grids = four_grids(sur_strokes, giv_strokes)
        suri_pts = sum({2: 7.5, 1: 4, 0: 0}[g["level"]] for g in grids.values())
        suri_notes = []
        if self.o.gender == "F":
            strong = [g["label"] for k, g in grids.items() if k != "won" and g["suri"] in STRONG_FOR_WOMEN]
            if strong:
                suri_notes.append("여성에게 강한 수(21·23·29·33·39)가 " + ", ".join(strong) + "에 있음 — 학파에 따라 피하기도 합니다.")

        # 음양 (10)
        yy = ["양" if s % 2 else "음" for s in sur_strokes + giv_strokes]
        yy_pts = 10 if len(set(yy)) > 1 else 0

        # 발음오행 (15)
        sylls = list(self.sur_kr) + list(given_kr)
        flow = sound_flow(sylls, self.o.sound_school)
        rel_pts = {"상생": 1.0, "비화": 0.6, "상극": 0.0}
        rels = flow["relations"]
        snd_pts = 15 * sum(rel_pts[r] for r in rels) / len(rels)

        # 한자 품질 (15): 친숙도 평균 + 자연스러운 이름 보너스
        q = sum(self.quality_points(c) for c in given_chars) / len(given_chars)
        ranks = self.pool_rank.get(self.o.gender, {})
        if given_kr in ranks:      # 많이 쓰이는 이름일수록 가산
            q += 5 + 3 * (1 - ranks[given_kr] / len(ranks))
        elif given_kr in self.o.candidates:
            q += 8
        else:
            q += 3
        q_pts = max(0.0, min(15.0, q))
        if len({c["h"] for c in given_chars} | {c["h"] for c in self.sur}) < len(given_chars) + len(self.sur):
            q_pts -= 5  # 같은 한자 반복

        breakdown = {"자원오행": round(jw_pts, 1), "수리": round(suri_pts, 1), "발음오행": round(snd_pts, 1),
                     "음양": yy_pts, "한자품질": round(q_pts, 1)}
        full = {"자원오행": 30, "수리": 30, "발음오행": 15, "음양": 10, "한자품질": 15}
        total = jw_pts + suri_pts + yy_pts + snd_pts + q_pts
        parent_notes = []
        if self.parents:
            # 부모 조화(10점): 아기 이름 한자가 부모의 용신·희신을 함께 채우는가
            pp = 0.0
            for c in given_chars:
                v, notes = self.parent_points(c["jw"])
                pp += v
                if notes:
                    parent_notes.append(f"{c['h']}({c['jw']}): " + ", ".join(notes))
            scale = 2 / (len(given_chars) * len(self.parents))   # 글자 수·부모 수와 무관하게 -5~+5로 맞춤
            par_pts = max(0.0, min(10.0, 5 + pp * scale))
            breakdown["부모조화"] = round(par_pts, 1)
            full["부모조화"] = 10
            total = total * 0.9 + par_pts
        total = round(total, 1)
        # 불용한자 표시: 전통 불용문자 / 뜻이 좋지 않은 글자
        bad_chars = []
        for c in given_chars:
            if c["h"] in self.db.soft_bad:
                bad_chars.append({"h": c["h"], "kind": "전통 불용문자"})
            elif self.db.is_hard_bad(c):
                bad_chars.append({"h": c["h"], "kind": "뜻이 좋지 않은 글자"})
        return {
            "hangul": self.sur_kr + given_kr,
            "hanja": "".join(c["h"] for c in self.sur) + "".join(c["h"] for c in given_chars),
            "given_kr": given_kr,
            "score": total,
            "breakdown": breakdown,
            "breakdown_full": full,
            "parent_notes": parent_notes,
            "bad_chars": bad_chars,
            "chars": [{"h": c["h"], "r": c["r"], "m": c["m"], "won": c["won"], "pil": c["pil"], "jw": c["jw"],
                       "grade": c["grade"], "role": role}
                      for c, role in [(c, "성") for c in self.sur] + [(c, x["role"]) for c, x in zip(given_chars, jw)]],
            "jawon": jw,
            "suri": grids,
            "suri_notes": suri_notes,
            "eumyang": yy,
            "sound": {"syllables": sylls, **flow},
            "comment": self._comment(jw, grids, flow, yy_pts) + (
                (" 부모 사주와의 조화: " + " / ".join(parent_notes) + ".") if parent_notes else
                (" 부모 사주에는 중립적인 한자입니다." if self.parents else "")) + (
                (" ※ 불용한자: " + ", ".join(f"{x['h']}({x['kind']})" for x in bad_chars) + " — 이름에는 피하는 것이 좋습니다.")
                if bad_chars else ""),
        }

    def _comment(self, jw, grids, flow, yy_pts) -> str:
        parts = []
        good = [f"{x['h']}({OHAENG_KR[x['element']]}·{x['role']})" for x in jw if x["role"] in ("용신", "희신", "조후")]
        if good:
            parts.append("자원오행 " + ", ".join(good) + "이(가) 사주에 필요한 기운을 보완합니다.")
        bad_g = [g["label"] for g in grids.values() if g["level"] == 0]
        parts.append("수리 4격이 모두 길수입니다." if not bad_g else "수리 흉수: " + ", ".join(bad_g) + ".")
        if all(r != "상극" for r in flow["relations"]):
            parts.append("발음오행이 " + "→".join(OHAENG_KR[e] for e in flow["elements"]) + "로 순하게 흐릅니다.")
        if not yy_pts:
            parts.append("획수 음양이 한쪽으로 치우쳐 있습니다.")
        return " ".join(parts)

    # ---------- 추천 ----------
    def recommend(self) -> list[dict]:
        names = self.hangul_names()
        cache: dict[str, list[dict]] = {}

        def cands(syl: str, fixed: str | None = None) -> list[dict]:
            if fixed:
                e = self.db.char(fixed, syl)
                return [e] if e else []
            if syl not in cache:
                cs = [c for c in self.db.candidates(syl, self.o.min_tier)
                      if not (self.o.exclude_soft_bad and c["h"] in self.db.soft_bad)]
                cs.sort(key=lambda c: -(self.element_points(c["jw"])[0] + 1.5 * self.quality_points(c)
                                        + self.parent_points(c["jw"])[0]))
                cache[syl] = cs[:12]
            return cache[syl]

        results = []
        for nm in names:
            if nm[0] == self.sur_kr[-1]:
                continue  # '김김○' 같은 반복 회피
            lists = []
            for i, syl in enumerate(nm):
                fixed = self.o.fixed_hanja if (self.o.fixed_syllable and i == self.o.fixed_position and not self.o.single_name) else None
                lists.append(cands(syl, fixed))
            if not all(lists):
                continue
            scored = []
            for combo in itertools.product(*lists):
                if len(set(c["h"] for c in combo)) < len(combo):
                    continue
                r = self.evaluate(list(combo), nm)
                if not self.o.allow_suri_bad and any(g["level"] == 0 for g in r["suri"].values()):
                    continue
                scored.append(r)
            scored.sort(key=lambda r: -r["score"])
            results.extend(scored[: self.o.per_name])
        results.sort(key=lambda r: -r["score"])
        return results[: self.o.top_n]


def evaluate_name(analysis: dict, surname_chars: list[dict], surname_kr: str,
                  given: list[tuple[str, str]], opts: NamingOptions, parents: list[dict] | None = None) -> dict:
    """기존 이름 감정. given = [(한자, 음), ...]"""
    db = get_db()
    chars = []
    for h, r in given:
        e = db.char(h, r)
        if not e:
            raise ValueError(f"인명용 한자 DB에 없는 글자입니다: {h}({r})")
        chars.append(e)
    n = Namer(analysis, surname_chars, surname_kr, opts, parents)
    res = n.evaluate(chars, "".join(r for _, r in given))
    res["hanja_valid"] = True
    return res
