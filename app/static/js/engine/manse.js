// 만세력: 생년월일시·지역 → 사주팔자(년·월·일·시주)와 대운  (engine/manse.py 이식)
import KoreanLunarCalendar from "../vendor/korean-lunar-calendar.js";
import { T } from "./tables.js";
import { EngineError, ganjiIndex, ganjiKr, ganjiName, isoDate, mod, pad2, pyRound } from "./util.js";

const DAY = 86400000;
let TERMS = null;      // [[utcMs, lon], ...] 시간순
let JIE = null;        // 절(節)만
let JIE_TIMES = null;

export function setSolarTerms(raw) {
  const out = [];
  for (const y of Object.keys(raw).sort((a, b) => Number(a) - Number(b))) {
    for (const [lon, iso] of raw[y]) out.push([Date.parse(iso), lon]);
  }
  out.sort((a, b) => a[0] - b[0]);
  TERMS = out;
  JIE = out.filter(([, lon]) => String(lon) in T.JIE_LON_TO_BRANCH);
  JIE_TIMES = JIE.map((x) => x[0]);
}

/** 출생 순간 직전·직후의 절 */
export function prevNextJie(instant) {
  let lo = 0, hi = JIE_TIMES.length;          // bisect_right
  while (lo < hi) { const m = (lo + hi) >> 1; if (instant < JIE_TIMES[m]) hi = m; else lo = m + 1; }
  if (lo === 0 || lo >= JIE.length) throw new EngineError("지원 범위(1900~2100년)를 벗어났습니다");
  return [JIE[lo - 1], JIE[lo]];
}

/** 균시차(분) — Spencer 1971 */
export function equationOfTimeMinutes(ms) {
  const d = new Date(ms);
  const yday = Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 1)) / DAY) + 1;
  const g = 2 * Math.PI / 365 * (yday - 1);
  return 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
    - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
}

/** 날짜(UTC 자정 ms) → 율리우스일 */
export const jdn = (dayMs) => Math.floor(dayMs / DAY) + 2440588;

// ── 시간대 ──────────────────────────────────────────
const fmtCache = {};
function tzFormatter(tz) {
  return fmtCache[tz] ||= new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}
/** 해당 순간의 UTC 대비 오프셋(ms) */
export function tzOffset(utcMs, tz) {
  const p = Object.fromEntries(tzFormatter(tz).formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}
/** 현지 벽시계 시각 → UTC (파이썬 zoneinfo fold=0 과 같은 규칙) */
export function zonedToUtc(wallMs, tz) {
  const o1 = tzOffset(wallMs - DAY, tz), o2 = tzOffset(wallMs + DAY, tz);
  const cands = [...new Set([o1, o2])].map((o) => [wallMs - o, o]).filter(([t, o]) => tzOffset(t, tz) === o);
  if (cands.length === 0) return wallMs - o1;                         // 없는 시각(서머타임 시작): 전환 전 오프셋
  if (cands.length === 1) return cands[0][0];
  return Math.min(...cands.map((c) => c[0]));                        // 겹치는 시각: 먼저 오는 쪽
}
function tzName(utcMs, tz) {
  const off = tzOffset(utcMs, tz) / 60000;
  if (tz === "Asia/Seoul") return { 540: "KST", 510: "KST", 600: "KDT", 570: "KDT" }[off] || "LMT";
  if (tz === "Asia/Tokyo") return off === 600 ? "JDT" : "JST";
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date(utcMs));
  return (p.find((x) => x.type === "timeZoneName") || {}).value || "";
}
const fmtYmdHm = (ms) => { const d = new Date(ms); return `${isoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`; };
const kstText = (utcMs) => fmtYmdHm(utcMs + tzOffset(utcMs, "Asia/Seoul")) + " KST";

// ── 음력 ────────────────────────────────────────────
export function lunarToSolar(y, m, d, leap = false) {
  const cal = new KoreanLunarCalendar();
  if (!cal.setLunarDate(y, m, d, !!leap)) throw new EngineError("존재하지 않는 음력 날짜입니다 (윤달 여부 확인)");
  const s = cal.getSolarCalendar();
  return [s.year, s.month, s.day];
}
export function solarToLunar(y, m, d) {
  const cal = new KoreanLunarCalendar();
  if (!cal.setSolarDate(y, m, d)) return {};
  const l = cal.getLunarCalendar();
  const leap = !!l.intercalation;
  return { year: l.year, month: l.month, day: l.day, leap, text: `음력 ${l.year}년 ${leap ? "윤" : ""}${l.month}월 ${l.day}일` };
}

// ── 기둥 ────────────────────────────────────────────
export class Pillar {
  constructor(name, gan, ji, idx60) { Object.assign(this, { name, gan, ji, idx60 }); }
  get text() { return this.gan + this.ji; }
  toDict() {
    const gi = T.GAN.indexOf(this.gan), ji = T.JI.indexOf(this.ji);
    return {
      name: this.name, ganji: this.text, kr: ganjiKr(this.idx60),
      gan: this.gan, gan_kr: T.GAN_KR[gi], gan_oh: T.GAN_OH[gi], gan_yang: T.GAN_YANG[gi],
      ji: this.ji, ji_kr: T.JI_KR[ji], ji_oh: T.JI_OH[ji],
    };
  }
}
const pillarDay = (dayMs) => { const k = mod(jdn(dayMs) + 49, 60); return new Pillar("일주", T.GAN[k % 10], T.JI[k % 12], k); };

function pillarYear(instant, solarYear) {
  const ip = TERMS.find(([t, lon]) => lon === 315 && new Date(t).getUTCFullYear() === solarYear)[0];
  const y = instant >= ip ? solarYear : solarYear - 1;
  const k = mod(y - 4, 60);
  return new Pillar("년주", T.GAN[k % 10], T.JI[k % 12], k);
}
function pillarMonth(instant, yearGanIdx) {
  const [[, lon]] = prevNextJie(instant);
  const branch = T.JIE_LON_TO_BRANCH[String(lon)];
  const first = (yearGanIdx % 5 * 2 + 2) % 10;
  const stem = (first + mod(branch - 2, 12)) % 10;
  return new Pillar("월주", T.GAN[stem], T.JI[branch], ganjiIndex(stem, branch));
}
function pillarHour(solarMs, dayGanIdx) {
  const d = new Date(solarMs);
  const minutes = d.getUTCHours() * 60 + d.getUTCMinutes();
  const branch = Math.floor((minutes + 60) / 120) % 12;
  const stem = (dayGanIdx % 5 * 2 + branch) % 10;
  return new Pillar("시주", T.GAN[stem], T.JI[branch], ganjiIndex(stem, branch));
}

export const defaultBirth = () => ({
  year: null, month: null, day: null, hour: null, minute: 0, calendar: "solar", leap_month: false, gender: "M",
  region: T.DEFAULT_REGION, longitude: null, tz: null, zi_mode: "jojasi", apply_eot: false, apply_longitude: true,
});

export class Saju {
  constructor(o) { Object.assign(this, o); }
  get dayGan() { return this.pillars[2].gan; }
  toDict() {
    const { pillars, ...rest } = this;
    return { input: rest.input, solar_date: rest.solar_date, lunar: rest.lunar, standard_time: rest.standard_time,
      utc_time: rest.utc_time, solar_time: rest.solar_time, correction_minutes: rest.correction_minutes,
      pillars: pillars.map((p) => p.toDict()), hour_known: rest.hour_known, year_animal: rest.year_animal,
      prev_jie: rest.prev_jie, next_jie: rest.next_jie, daewoon: rest.daewoon };
  }
}

function validDate(y, m, d) {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export function compute(input) {
  const b = { ...defaultBirth(), ...input };
  let sy, sm, sd;
  if (b.calendar === "lunar") [sy, sm, sd] = lunarToSolar(b.year, b.month, b.day, b.leap_month);
  else {
    if (!validDate(b.year, b.month, b.day)) throw new EngineError("존재하지 않는 날짜입니다");
    [sy, sm, sd] = [b.year, b.month, b.day];
  }
  if (!(sy >= 1900 && sy <= 2100)) throw new EngineError("1900~2100년 사이만 지원합니다");

  let lon, tz;
  if (b.longitude == null) {
    if (!(b.region in T.REGIONS)) throw new EngineError(`등록되지 않은 지역입니다: ${b.region}`);
    [lon, tz] = T.REGIONS[b.region];
  } else { lon = b.longitude; tz = b.tz || "Asia/Seoul"; }
  if (b.tz) tz = b.tz;
  const hourKnown = b.hour != null;
  const [h, mi] = hourKnown ? [b.hour, b.minute] : [12, 0];
  const wall = Date.UTC(sy, sm - 1, sd, h, mi);                       // 현지 벽시계 시각(가짜 UTC)
  const instant = zonedToUtc(wall, tz);

  let corr = null;
  let solar = wall;                                                   // 보정된 태양시(가짜 UTC)
  if (b.apply_longitude) {
    solar = instant + Math.round(lon / 15 * 3600 * 1e6) / 1e3;         // 마이크로초 단위까지 (파이썬 timedelta)
    if (b.apply_eot) solar += Math.round(equationOfTimeMinutes(solar) * 60 * 1e6) / 1e3;
    corr = pyRound((solar - wall) / 60000, 1);
  }

  const solarYear = new Date(instant + 9 * 3600000).getUTCFullYear();
  const yearP = pillarYear(instant, solarYear);
  const monthP = pillarMonth(instant, T.GAN.indexOf(yearP.gan));
  const sDate = new Date(solar);
  let dayMs = hourKnown ? Date.UTC(sDate.getUTCFullYear(), sDate.getUTCMonth(), sDate.getUTCDate()) : Date.UTC(sy, sm - 1, sd);
  const lateZi = hourKnown && sDate.getUTCHours() === 23;
  if (lateZi && b.zi_mode === "jojasi") dayMs += DAY;
  const dayP = pillarDay(dayMs);
  const pillars = [yearP, monthP, dayP];
  if (hourKnown) {
    let stemBase = T.GAN.indexOf(dayP.gan);
    if (lateZi && b.zi_mode === "yajasi") stemBase = T.GAN.indexOf(pillarDay(dayMs + DAY).gan);
    pillars.push(pillarHour(solar, stemBase));
  }

  const [[pt, plon], [nt, nlon]] = prevNextJie(instant);
  const sdIso = isoDate(sy, sm, sd);
  const saju = new Saju({
    input: { year: b.year, month: b.month, day: b.day, hour: b.hour, minute: b.minute, calendar: b.calendar,
      leap_month: b.leap_month, gender: b.gender, region: b.region, longitude: b.longitude, tz: b.tz,
      zi_mode: b.zi_mode, apply_eot: b.apply_eot, apply_longitude: b.apply_longitude },
    solar_date: sdIso, lunar: solarToLunar(sy, sm, sd),
    standard_time: hourKnown ? `${fmtYmdHm(wall)} (${tzName(instant, tz)})` : sdIso,
    utc_time: hourKnown ? `${fmtYmdHm(instant)} UTC` : "",
    solar_time: hourKnown ? fmtYmdHm(solar) : null,
    correction_minutes: hourKnown ? corr : null,
    pillars, hour_known: hourKnown, year_animal: T.JI_ANIMAL[T.JI.indexOf(yearP.ji)],
    prev_jie: { name: T.SOLAR_TERM_NAMES[String(plon)], time: kstText(pt) },
    next_jie: { name: T.SOLAR_TERM_NAMES[String(nlon)], time: kstText(nt) },
    daewoon: {},
  });
  saju.daewoon = computeDaewoon(saju, instant, b.gender, pt, nt);
  return saju;
}

/** 대운: 양남음녀 순행, 음남양녀 역행. 절입까지 3일 = 1년 */
export function computeDaewoon(saju, instant, gender, prevT, nextT) {
  const yearYang = T.GAN_YANG[T.GAN.indexOf(saju.pillars[0].gan)];
  const forward = (yearYang && gender === "M") || (!yearYang && gender === "F");
  const days = (forward ? nextT - instant : instant - prevT) / DAY;
  const start = Math.max(1, pyRound(days / 3));
  const monthIdx = saju.pillars[1].idx60;
  const birthYear = Number(saju.solar_date.slice(0, 4));
  const list = [];
  for (let n = 1; n <= 10; n++) {
    const k = forward ? mod(monthIdx + n, 60) : mod(monthIdx - n, 60);
    const age = start + (n - 1) * 10;
    list.push({ age, year: birthYear + age - 1, ganji: ganjiName(k), kr: ganjiKr(k), gan_oh: T.GAN_OH[k % 10], ji_oh: T.JI_OH[k % 12] });
  }
  return { forward, start_age: start, days_to_jie: pyRound(days, 2), list };
}
