// 파이프라인: 출생정보 → 만세력 → 사주 분석 → 운세 / 이름 추천·감정  (engine/pipeline.py 이식)
import { compute } from "./manse.js";
import { analyze } from "./saju.js";
import { interpret } from "./fortune.js";
import { answer } from "./question.js";
import { Namer, evaluateName, soundElement } from "./naming.js";
import { EngineError, isHangul } from "./util.js";

export function resolveSurname(kr, hanja, deps) {
  const db = deps.db;
  if (hanja) {
    const hs = [...hanja], ks = [...kr];
    return hs.map((h, i) => {
      const e = db.char(h, ks.length === hs.length ? ks[i] : null) || db.char(h);
      if (!e) throw new EngineError(`성씨 한자를 찾을 수 없습니다: ${h}`);
      return e;
    });
  }
  const opts = db.surnameOptions(kr);
  if (!opts.length) throw new EngineError(`'${kr}' 성씨의 한자를 지정해 주세요`);
  return opts[0].chars;
}

/** 성을 뺀 이름 글자의 발음오행 (사주 8자 + 이름 = 10자 분석용) */
export function givenNameChars(nameKr, nameHanja, deps) {
  const s = [...(nameKr || "").trim()];
  if (s.length < 2 || !s.every(isHangul)) return [];
  const db = deps.db;
  const two = db.surnames.some((x) => [...x.kr].length === 2 && x.kr === s.slice(0, 2).join(""));
  const surLen = (two && s.length >= 3) || s.length >= 4 ? 2 : 1;
  const hanja = [...(nameHanja || "")];
  const out = [];
  s.forEach((ch, i) => {
    if (i < surLen) return;
    const h = i < hanja.length && hanja[i].trim() ? hanja[i] : null;
    const e = h ? db.char(h, ch) : null;
    out.push({ kr: ch, h: e ? e.h : "", element: soundElement(ch), basis: "발음" });
  });
  return out;
}

export function runSaju(birth, deps, { withFortune = false, nameKr = null, nameHanja = null, question = null, year = null } = {}) {
  const saju = compute(birth);
  const nameChars = withFortune && deps.db ? givenNameChars(nameKr, nameHanja, deps) : [];
  const res = { saju: saju.toDict(), analysis: analyze(saju, nameChars) };
  if (nameChars.length) {
    const a8 = analyze(saju);
    res.analysis_saju8 = { strength: a8.strength, yong: a8.yongsin.element, hee: a8.heesin.element, gi: a8.gisin.element, roles: a8.roles, element_count: a8.element_count };
  }
  if (withFortune) {
    res.fortune = interpret(saju, res.analysis, birth.gender || "M",
      { year, nameKr, nameHanja, question, db: deps.db, naming: deps.naming, answer });
  }
  res._saju = saju;   // 내부용 (응답에서는 제거)
  return res;
}

function parentsOf(parents, res) {
  const par = [];
  for (const [label, pb, pname = null] of parents || []) {
    const ps = compute(pb);
    const pa = analyze(ps);
    par.push({ label, analysis: pa });
    (res.parents ||= []).push({ label, name: pname, pillars: ps.pillars.map((p) => p.text).join(" "), day_master: pa.day_master,
      strength: pa.strength.label, needed: pa.needed_elements, gisin: pa.gisin.element, roles: pa.roles });
  }
  return par;
}

export function runNaming(birth, surnameKr, surnameHanja, opts, parents, deps) {
  opts = { ...opts, gender: birth.gender || "M" };
  const res = runSaju(birth, deps);
  const sur = resolveSurname(surnameKr, surnameHanja, deps);
  const par = parentsOf(parents, res);
  const names = new Namer(res.analysis, sur, surnameKr, opts, par, deps).recommend();
  res.surname = { kr: surnameKr, hanja: sur.map((c) => c.h).join(""), strokes: sur.map((c) => c.won), elements: sur.map((c) => c.jw) };
  res.names = names;
  return res;
}

export function runEvaluate(birth, surnameKr, surnameHanja, given, opts, parents, deps) {
  opts = { ...opts, gender: birth.gender || "M" };
  const res = runSaju(birth, deps);
  const sur = resolveSurname(surnameKr, surnameHanja, deps);
  res.evaluation = evaluateName(res.analysis, sur, surnameKr, given, opts, parentsOf(parents, res), deps);
  return res;
}
