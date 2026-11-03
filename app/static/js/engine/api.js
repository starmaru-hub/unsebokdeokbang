// 서버 없이 브라우저에서 돌아가는 API — 예전 FastAPI(app/main.py)의 /api/* 와 같은 입출력
import { T } from "./tables.js";
import { setSolarTerms } from "./manse.js";
import { HanjaDB, defaultNamingOptions, fourGrids, pairRelation, soundElement } from "./naming.js";
import { runEvaluate, runNaming, runSaju } from "./pipeline.js";
import { business, couple } from "./compat.js";
import { EngineError } from "./util.js";

let deps = null;
let loading = null;

/** 데이터 읽기: 브라우저는 fetch(data/…), Node 검증 스크립트는 직접 넘겨 준다 */
export async function init(loader) {
  if (deps) return deps;
  loading ||= (async () => {
    const [solar, hanja, bad, surnames, pool, favored] = await Promise.all(
      ["solar_terms", "hanja", "bad_hanja", "surnames", "name_pool", "name_favored"].map((n) => loader(n)));
    setSolarTerms(solar);
    deps = { db: new HanjaDB({ hanja, bad, surnames }), pool, favored: favored.map,
      naming: { soundElement, pairRelation, fourGrids } };
    return deps;
  })();
  return loading;
}

// ── 입력 검사 (pydantic 모델과 같은 범위) ─────────
const fail = (msg) => { throw new EngineError(msg); };
const BIRTH_KEYS = ["year", "month", "day", "hour", "minute", "calendar", "leap_month", "gender", "region", "zi_mode", "apply_eot"];
function birthOf(b) {
  if (!b) fail("출생 정보를 입력해 주세요");
  const x = Object.fromEntries(BIRTH_KEYS.filter((k) => k in b).map((k) => [k, b[k]]));
  if (!Number.isInteger(x.year) || x.year < 1900 || x.year > 2100) fail("1900~2100년 사이만 지원합니다");
  if (!Number.isInteger(x.month) || x.month < 1 || x.month > 12) fail("월을 확인해 주세요");
  if (!Number.isInteger(x.day) || x.day < 1 || x.day > 31) fail("일을 확인해 주세요");
  if (x.hour != null && (x.hour < 0 || x.hour > 23)) fail("시각을 확인해 주세요");
  x.minute = x.minute ?? 0;
  x.gender = x.gender || "M";
  x.region = x.region || T.DEFAULT_REGION;
  return x;
}
function optionsOf(o = {}) {
  const d = { ...defaultNamingOptions(), ...o };
  d.fixed_syllable = d.fixed_syllable || null;
  d.fixed_hanja = d.fixed_hanja || null;
  d.candidates = d.candidates || [];
  return d;
}
const parentsOf = (ps = []) => ps.slice(0, 2).map((p) => [p.label || "부모", birthOf(p), p.name || null]);
const strip = (res) => { delete res._saju; return res; };
const parseDate = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? [+m[1], +m[2], +m[3]] : null; };

const ROUTES = {
  "GET /api/regions": () => Object.entries(T.REGIONS).map(([name, [lon, tz]]) => ({ name, lon, tz })),
  "GET /api/surnames": ({ kr }) => {
    let opts = deps.db.surnameOptions(kr);
    if (!opts.length && [...kr].length === 1) opts = deps.db.search(kr, 60).map((e) => ({ kr, hanja: e.h, chars: [e] }));
    return opts.map((o) => ({ kr: o.kr, hanja: o.hanja, meaning: o.chars.map((c) => c.m.split("/")[0]).join(" "), strokes: o.chars.map((c) => c.won) }));
  },
  "GET /api/hanja": ({ q, limit = 200 }) => deps.db.search(q, Number(limit)),
  "POST /api/saju": (b) => strip(runSaju(birthOf(b), deps, { withFortune: true, nameKr: b.name_kr || null, nameHanja: b.name_hanja || null, question: b.question || null })),
  "POST /api/naming": (r) => strip(runNaming(birthOf(r.birth), r.surname_kr, r.surname_hanja || null, optionsOf(r.options), parentsOf(r.parents), deps)),
  "POST /api/evaluate": (r) => strip(runEvaluate(birthOf(r.birth), r.surname_kr, r.surname_hanja || null,
    (r.given || []).map((g) => [g.h, g.r]), optionsOf(r.options), parentsOf(r.parents), deps)),
  "POST /api/couple": (r) => {
    if (r.married && !r.wedding_date) fail("결혼 날짜를 입력해 주세요");
    return couple(birthOf(r.a), r.a.name || null, birthOf(r.b), r.b.name || null,
      { married: !!r.married, wedding: r.married ? parseDate(r.wedding_date) : null, h1: r.a.name_hanja || null, h2: r.b.name_hanja || null, deps });
  },
  "POST /api/business": (r) => business(birthOf(r.rep), r.rep.name || null, birthOf(r.company), r.company_name || null,
    { repHanja: r.rep.name_hanja || null, deps }),
};

/** path 예: "/api/hanja?q=민&limit=300" */
export async function request(path, body) {
  await init(browserLoader);
  const [p, qs = ""] = path.split("?");
  const key = `${body ? "POST" : "GET"} ${p}`;
  const fn = ROUTES[key];
  if (!fn) throw new EngineError(`알 수 없는 요청입니다: ${p}`);
  const params = body || Object.fromEntries(new URLSearchParams(qs));
  try {
    return fn(params);
  } catch (e) {
    if (e instanceof EngineError) throw e;
    console.error(e);
    throw new EngineError("계산 중 오류가 발생했습니다. 입력값을 확인해 주세요.");
  }
}

const BASE = new URL("../../data/", import.meta.url);
async function browserLoader(name) {
  const res = await fetch(new URL(`${name}.json`, BASE));
  if (!res.ok) throw new EngineError("데이터를 불러오지 못했습니다. 새로고침해 주세요.");
  return res.json();
}

export { ROUTES, birthOf, optionsOf, parentsOf, deps as _deps };
