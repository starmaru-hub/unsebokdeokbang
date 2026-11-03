// 작명: 인명용 한자 DB · 발음오행 · 81수리 · 이름 추천/감정  (engine/naming/*.py 이식)
import { T } from "./tables.js";
import { EngineError, fsum, isHangul, pyRound, sortBy, sortStr, sum } from "./util.js";

// ── 한자 DB ──────────────────────────────────────
const SPLIT = /[\s,/;·()]+/;
export class HanjaDB {
  constructor({ hanja, bad, surnames }) {
    this.entries = hanja;
    this.byReading = new Map();
    this.byChar = new Map();
    for (const e of hanja) {
      if (!this.byReading.has(e.r)) this.byReading.set(e.r, []);
      this.byReading.get(e.r).push(e);
      if (!this.byChar.has(e.h)) this.byChar.set(e.h, e);
    }
    this.hardBad = new Set(bad.hard);
    this.softBad = new Set(bad.soft);
    this.badWords = new Set(bad.meaning_keywords);
    this.surnames = surnames.list;
  }
  isHardBad(e) {
    if (this.hardBad.has(e.h)) return true;
    return e.m.split(SPLIT).some((tok) => tok && this.badWords.has(tok));
  }
  candidates(syl, minTier = 2) {
    return (this.byReading.get(syl) || []).filter((e) => e.tier >= minTier && e.m && e.jw && !this.isHardBad(e));
  }
  char(h, reading = null) {
    if (reading) {
      const e = (this.byReading.get(reading) || []).find((x) => x.h === h);
      if (e) return e;
    }
    return this.byChar.get(h) || null;
  }
  search(q, limit = 200) {
    if (!q) return [];
    let res;
    if (this.byReading.has(q)) res = sortBy(this.byReading.get(q), (e) => [-e.tier, e.won].map((v) => String(v + 1000).padStart(6, "0")).join(""));
    else res = this.entries.filter((e) => q.includes(e.h));
    return res.slice(0, limit);
  }
  surnameOptions(kr) {
    const out = [];
    for (const s of this.surnames) {
      if (s.kr !== kr) continue;
      const hs = [...s.hanja], ks = [...kr];
      const same = ks.length === hs.length;
      const chars = hs.map((c, i) => this.char(c, same ? ks[i] : null));
      if (chars.every(Boolean)) out.push({ kr, hanja: s.hanja, chars });
    }
    return out;
  }
}

// ── 발음오행 ─────────────────────────────────────
export function soundElement(syl, school = "modern") {
  const code = syl.codePointAt(0) - 0xac00;
  if (!(code >= 0 && code < 11172)) throw new EngineError(`한글 음절이 아닙니다: ${syl}`);
  return T.SOUND_SCHOOLS[school][T.CHO[Math.floor(code / 588)]];
}
export function pairRelation(a, b) {
  if (a === b) return "비화";
  if (T.SAENG[a] === b || T.SAENG[b] === a) return "상생";
  return "상극";
}
export function soundFlow(sylls, school = "modern") {
  const els = sylls.map((s) => soundElement(s, school));
  return { elements: els, relations: els.slice(0, -1).map((e, i) => pairRelation(e, els[i + 1])) };
}

// ── 81수리 ───────────────────────────────────────
const norm = (n) => { while (n > 81) n -= 80; return n; };
export function suriInfo(n) {
  const k = norm(n);
  const [name, lv, desc] = T.SURI_81[String(k)];
  return { num: n, suri: k, name, level: lv, level_kr: T.LEVEL_KR[String(lv)], desc };
}
export function fourGrids(surname, given) {
  const s = sum(surname);
  let won, hyeong, i_, jeong;
  if (given.length === 1) { const g = given[0]; [won, hyeong, i_, jeong] = [g + 1, s + g, g + 1, s + g]; }
  else [won, hyeong, i_, jeong] = [sum(given), s + given[0], s + sum(given.slice(1)), s + sum(given)];
  return {
    won: { label: "원격(초년운)", ...suriInfo(won) },
    hyeong: { label: "형격(청년운)", ...suriInfo(hyeong) },
    i: { label: "이격(중년운)", ...suriInfo(i_) },
    jeong: { label: "정격(총운)", ...suriInfo(jeong) },
  };
}

// ── 이름 추천 · 감정 ─────────────────────────────
export const defaultNamingOptions = () => ({
  gender: "M", sound_school: "modern", min_tier: 2, exclude_soft_bad: false, allow_suri_bad: false,
  fixed_syllable: null, fixed_position: 0, fixed_hanja: null, candidates: [], single_name: false, top_n: 30, per_name: 2,
});

function* product(lists, i = 0, acc = []) {
  if (i === lists.length) { yield acc; return; }
  for (const x of lists[i]) yield* product(lists, i + 1, [...acc, x]);
}

export class Namer {
  constructor(analysis, surnameChars, surnameKr, opts, parents, { db, pool, favored }) {
    this.db = db;
    this.a = analysis;
    this.sur = surnameChars;
    this.surKr = surnameKr;
    this.o = { ...defaultNamingOptions(), ...opts };
    this.need = analysis.needed_elements;
    this.avoid = analysis.avoid_elements;
    this.pool = pool;
    this.favored = favored;
    this.poolRank = Object.fromEntries(["M", "F"].map((g) => [g, Object.fromEntries(pool[g].map((n, i) => [n, i]))]));
    this.parents = parents || [];
  }
  parentPoints(el) {
    let pts = 0;
    const notes = [];
    for (const p of this.parents) {
      const pa = p.analysis;
      if (el === pa.needed_elements[0]) { pts += 2.5; notes.push(`${p.label} 용신`); }
      else if (pa.needed_elements.slice(1).includes(el)) { pts += 1.5; notes.push(`${p.label} 희신`); }
      else if (el === pa.gisin.element) { pts -= 2.5; notes.push(`${p.label} 기신`); }
      else if (pa.avoid_elements.includes(el)) pts -= 1;
    }
    return [pts, notes];
  }
  elementPoints(el) {
    if (el === this.need[0]) return [15, "용신"];
    if (this.need.length > 1 && el === this.need[1]) return [12, "희신"];
    if (this.need.slice(2).includes(el)) return [10, "조후"];
    if (this.avoid.includes(el)) return el === this.a.gisin.element ? [0, "기신"] : [3, "구신"];
    return [6, "한신"];
  }
  qualityPoints(e) {
    const fav = this.favored[e.r] || [];
    let p = fav.includes(e.h) ? Math.max(5.0, 7 - 0.3 * fav.indexOf(e.h)) : e.tier * 0.8;
    if (this.db.softBad.has(e.h)) p -= 3;
    return p;
  }
  hangulNames() {
    if (this.o.candidates && this.o.candidates.length) return this.o.candidates.map((c) => c.trim()).filter(Boolean);
    const g = ["M", "F"].includes(this.o.gender) ? this.o.gender : "M";
    const base = [...this.pool[g]];
    if (this.o.single_name) return sortStr([...new Set(base.flatMap((n) => [...n]))]);
    if (this.o.fixed_syllable) {
      const fs = this.o.fixed_syllable, pos = this.o.fixed_position;
      const names = base.filter((n) => [...n].length === 2 && [...n][pos] === fs);
      const other = sortStr([...new Set(base.filter((n) => [...n].length === 2).map((n) => [...n][1 - pos]))]);
      for (const s of other) {
        const n = pos === 0 ? fs + s : s + fs;
        if (!names.includes(n) && s !== fs) names.push(n);
      }
      return names;
    }
    return base;
  }
  evaluate(givenChars, givenKr) {
    const surStrokes = this.sur.map((c) => c.won), givStrokes = givenChars.map((c) => c.won);
    const jw = [];
    let jwPts = 0;
    for (const c of givenChars) { const [p, role] = this.elementPoints(c.jw); jw.push({ h: c.h, element: c.jw, role }); jwPts += p; }
    if (givenChars.length === 1) jwPts *= 2;
    const roles = new Set(jw.map((x) => x.role));
    if (roles.has("용신") && roles.has("희신")) jwPts = Math.min(30, jwPts + 3);

    const grids = fourGrids(surStrokes, givStrokes);
    const suriPts = sum(Object.values(grids).map((g) => ({ 2: 7.5, 1: 4, 0: 0 })[g.level]));
    const suriNotes = [];
    if (this.o.gender === "F") {
      const strong = Object.entries(grids).filter(([k, g]) => k !== "won" && T.STRONG_FOR_WOMEN.includes(g.suri)).map(([, g]) => g.label);
      if (strong.length) suriNotes.push("여성에게 강한 수(21·23·29·33·39)가 " + strong.join(", ") + "에 있음 — 학파에 따라 피하기도 합니다.");
    }
    const yy = [...surStrokes, ...givStrokes].map((s) => (s % 2 ? "양" : "음"));
    const yyPts = new Set(yy).size > 1 ? 10 : 0;

    const sylls = [...this.surKr, ...givenKr];
    const flow = soundFlow(sylls, this.o.sound_school);
    const relPts = { 상생: 1.0, 비화: 0.6, 상극: 0.0 };
    const sndPts = 15 * fsum(flow.relations.map((r) => relPts[r])) / flow.relations.length;

    let q = fsum(givenChars.map((c) => this.qualityPoints(c))) / givenChars.length;
    const ranks = this.poolRank[this.o.gender] || {};
    const nRanks = Object.keys(ranks).length;
    if (givenKr in ranks) q += 5 + 3 * (1 - ranks[givenKr] / nRanks);
    else if ((this.o.candidates || []).includes(givenKr)) q += 8;
    else q += 3;
    let qPts = Math.max(0.0, Math.min(15.0, q));
    if (new Set([...givenChars.map((c) => c.h), ...this.sur.map((c) => c.h)]).size < givenChars.length + this.sur.length) qPts -= 5;

    const breakdown = { 자원오행: pyRound(jwPts, 1), 수리: pyRound(suriPts, 1), 발음오행: pyRound(sndPts, 1), 음양: yyPts, 한자품질: pyRound(qPts, 1) };
    const full = { 자원오행: 30, 수리: 30, 발음오행: 15, 음양: 10, 한자품질: 15 };
    let total = jwPts + suriPts + yyPts + sndPts + qPts;
    const parentNotes = [];
    if (this.parents.length) {
      let pp = 0;
      for (const c of givenChars) {
        const [v, notes] = this.parentPoints(c.jw);
        pp += v;
        if (notes.length) parentNotes.push(`${c.h}(${c.jw}): ` + notes.join(", "));
      }
      const scale = 2 / (givenChars.length * this.parents.length);
      const parPts = Math.max(0.0, Math.min(10.0, 5 + pp * scale));
      breakdown["부모조화"] = pyRound(parPts, 1);
      full["부모조화"] = 10;
      total = total * 0.9 + parPts;
    }
    total = pyRound(total, 1);
    // 불용한자 표시: 전통 불용문자 / 뜻이 좋지 않은 글자
    const badChars = [];
    for (const c of givenChars) {
      if (this.db.softBad.has(c.h)) badChars.push({ h: c.h, kind: "전통 불용문자" });
      else if (this.db.isHardBad(c)) badChars.push({ h: c.h, kind: "뜻이 좋지 않은 글자" });
    }
    return {
      hangul: this.surKr + givenKr,
      hanja: this.sur.map((c) => c.h).join("") + givenChars.map((c) => c.h).join(""),
      given_kr: givenKr, score: total, breakdown, breakdown_full: full, parent_notes: parentNotes, bad_chars: badChars,
      chars: [...this.sur.map((c) => [c, "성"]), ...givenChars.map((c, i) => [c, jw[i].role])]
        .map(([c, role]) => ({ h: c.h, r: c.r, m: c.m, won: c.won, pil: c.pil, jw: c.jw, grade: c.grade, role })),
      jawon: jw, suri: grids, suri_notes: suriNotes, eumyang: yy,
      sound: { syllables: sylls, ...flow },
      comment: this.comment(jw, grids, flow, yyPts) + (parentNotes.length
        ? " 부모 사주와의 조화: " + parentNotes.join(" / ") + "."
        : (this.parents.length ? " 부모 사주에는 중립적인 한자입니다." : ""))
        + (badChars.length ? " ※ 불용한자: " + badChars.map((x) => `${x.h}(${x.kind})`).join(", ") + " — 이름에는 피하는 것이 좋습니다." : ""),
    };
  }
  comment(jw, grids, flow, yyPts) {
    const parts = [];
    const good = jw.filter((x) => ["용신", "희신", "조후"].includes(x.role)).map((x) => `${x.h}(${T.OHAENG_KR[x.element]}·${x.role})`);
    if (good.length) parts.push("자원오행 " + good.join(", ") + "이(가) 사주에 필요한 기운을 보완합니다.");
    const badG = Object.values(grids).filter((g) => g.level === 0).map((g) => g.label);
    parts.push(!badG.length ? "수리 4격이 모두 길수입니다." : "수리 흉수: " + badG.join(", ") + ".");
    if (flow.relations.every((r) => r !== "상극")) parts.push("발음오행이 " + flow.elements.map((e) => T.OHAENG_KR[e]).join("→") + "로 순하게 흐릅니다.");
    if (!yyPts) parts.push("획수 음양이 한쪽으로 치우쳐 있습니다.");
    return parts.join(" ");
  }
  recommend() {
    const names = this.hangulNames();
    const cache = new Map();
    const cands = (syl, fixed) => {
      if (fixed) { const e = this.db.char(fixed, syl); return e ? [e] : []; }
      if (!cache.has(syl)) {
        let cs = this.db.candidates(syl, this.o.min_tier).filter((c) => !(this.o.exclude_soft_bad && this.db.softBad.has(c.h)));
        cs = sortBy(cs, (c) => -(this.elementPoints(c.jw)[0] + 1.5 * this.qualityPoints(c) + this.parentPoints(c.jw)[0]));
        cache.set(syl, cs.slice(0, 12));
      }
      return cache.get(syl);
    };
    const surLast = [...this.surKr].slice(-1)[0];
    let results = [];
    for (const nm of names) {
      const syls = [...nm];
      if (syls[0] === surLast) continue;
      const lists = syls.map((syl, i) => cands(syl,
        this.o.fixed_syllable && i === this.o.fixed_position && !this.o.single_name ? this.o.fixed_hanja : null));
      if (!lists.every((l) => l.length)) continue;
      let scored = [];
      for (const combo of product(lists)) {
        if (new Set(combo.map((c) => c.h)).size < combo.length) continue;
        const r = this.evaluate(combo, nm);
        if (!this.o.allow_suri_bad && Object.values(r.suri).some((g) => g.level === 0)) continue;
        scored.push(r);
      }
      scored = sortBy(scored, (r) => -r.score);
      results.push(...scored.slice(0, this.o.per_name));
    }
    results = sortBy(results, (r) => -r.score);
    return results.slice(0, this.o.top_n);
  }
}

export function evaluateName(analysis, surnameChars, surnameKr, given, opts, parents, deps) {
  const chars = given.map(([h, r]) => {
    const e = deps.db.char(h, r);
    if (!e) throw new EngineError(`인명용 한자 DB에 없는 글자입니다: ${h}(${r})`);
    return e;
  });
  const n = new Namer(analysis, surnameChars, surnameKr, opts, parents, deps);
  const res = n.evaluate(chars, given.map(([, r]) => r).join(""));
  res.hanja_valid = true;
  return res;
}

export { isHangul };
