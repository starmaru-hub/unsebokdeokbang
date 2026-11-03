// JS 엔진 검증: js_parity.py 가 만든 입력을 JS 엔진에 넣고 파이썬 결과와 비교한다.
// 실행:  node scripts/js_parity.mjs <cases.json>
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const api = await import(new URL(`file:///${join(ROOT, "app/static/js/engine/api.js").replaceAll("\\", "/")}`));
await api.init(async (name) => JSON.parse(readFileSync(join(ROOT, "app/static/data", `${name}.json`), "utf8")));

const cases = JSON.parse(readFileSync(process.argv[2], "utf8"));
// 해외 지역의 시간대 약어(EST/JST 등)는 브라우저와 파이썬 표기가 달라 비교에서 뺀다
const IGNORE = [/\.standard_time$/, /^\.ok\[\d+\]\.(cp|rad|rad_c|ks|en)$/];  // 한자 DB 에서 일부러 뺀 필드

function diff(a, b, path, out) {
  if (out.length > 8) return;
  if (IGNORE.some((re) => re.test(path))) return;
  if (typeof a === "number" && typeof b === "number") { if (Math.abs(a - b) > 1e-9) out.push(`${path}: py=${a} js=${b}`); return; }
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    if (a !== b && !(a == null && b == null)) out.push(`${path}: py=${JSON.stringify(a)?.slice(0, 160)} js=${JSON.stringify(b)?.slice(0, 160)}`);
    return;
  }
  if (Array.isArray(a) !== Array.isArray(b)) { out.push(`${path}: 형태 다름`); return; }
  if (Array.isArray(a)) {
    if (a.length !== b.length) out.push(`${path}: 길이 py=${a.length} js=${b.length}`);
    for (let i = 0; i < Math.min(a.length, b.length); i++) diff(a[i], b[i], `${path}[${i}]`, out);
    return;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (IGNORE.some((re) => re.test(`${path}.${k}`))) continue;
    if (!(k in a)) { out.push(`${path}.${k}: py 없음 (js=${JSON.stringify(b[k])?.slice(0, 80)})`); continue; }
    if (!(k in b)) { out.push(`${path}.${k}: js 없음 (py=${JSON.stringify(a[k])?.slice(0, 80)})`); continue; }
    diff(a[k], b[k], `${path}.${k}`, out);
  }
}

let fails = 0;
const byRoute = {};
for (const [i, c] of cases.entries()) {
  const fn = api.ROUTES[c.route];
  let js;
  try { js = { ok: JSON.parse(JSON.stringify(fn(c.body))) }; } catch (e) { js = { error: e.message }; }
  if (js.ok) delete js.ok._saju;
  const out = [];
  diff(c.py, js, "", out);
  byRoute[c.route] ||= [0, 0];
  byRoute[c.route][0] += 1;
  if (out.length) {
    fails += 1;
    byRoute[c.route][1] += 1;
    if (fails <= 12) console.log(`\n#${i} ${c.route} ${JSON.stringify(c.body).slice(0, 200)}\n  ` + out.join("\n  "));
  }
}
console.log("\n경로별 (건수, 불일치):", JSON.stringify(byRoute));
console.log(fails ? `불일치 ${fails}건 / 전체 ${cases.length}건` : `전체 ${cases.length}건 모두 일치`);
process.exit(fails ? 1 : 0);
