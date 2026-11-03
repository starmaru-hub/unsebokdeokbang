// 파이썬 엔진과 똑같은 결과를 내기 위한 도우미 (반올림·나머지·조사·검색 등)
import { T } from "./tables.js";

/** 파이썬 % (항상 0 이상) */
export const mod = (a, n) => ((a % n) + n) % n;

/** 파이썬 // (내림 나눗셈) */
export const floordiv = (a, b) => Math.floor(a / b);

/**
 * 파이썬 round(x, n): 배정밀도 값의 '정확한 10진 값'을 기준으로 0.5 는 짝수 쪽으로 반올림.
 * toPrecision(100) 은 이 범위의 숫자를 정확한 10진수로 펼쳐 준다.
 */
export function pyRound(x, n = 0) {
  if (!Number.isFinite(x)) return x;
  const neg = x < 0;
  const s = Math.abs(x).toPrecision(100);               // 지수 표기 없이 펼쳐짐 (|x| >= 1e-7 범위)
  let [ip, fp = ""] = s.split(".");
  if (s.includes("e")) return Number(x.toFixed(n));     // 아주 작은 수: 오차 무시
  fp = fp.padEnd(n + 1, "0");
  const keep = fp.slice(0, n);
  const rest = fp.slice(n);
  let digits = (ip + keep).split("").map(Number);
  const first = Number(rest[0]);
  const tail = rest.slice(1);
  let up;
  if (first > 5) up = true;
  else if (first < 5) up = false;
  else if (/[1-9]/.test(tail)) up = true;
  else up = digits[digits.length - 1] % 2 === 1;        // 정확히 반 → 짝수로
  if (up) {
    let i = digits.length - 1;
    while (i >= 0) {
      if (digits[i] === 9) { digits[i] = 0; i -= 1; } else { digits[i] += 1; break; }
    }
    if (i < 0) digits.unshift(1);
  }
  const str = digits.join("");
  const intPart = str.slice(0, str.length - n) || "0";
  const val = Number(n ? `${intPart}.${str.slice(str.length - n)}` : intPart);
  return neg ? -val : val;
}

/** 파이썬 f"{x:.Nf}" */
export const pyFixed = (x, n) => pyRound(x, n).toFixed(n);

/** 정수 합 (오차 없음) */
export const sum = (arr) => arr.reduce((a, b) => a + b, 0);

/** 파이썬 3.12+ sum() 의 소수 합: Neumaier 보정 합계 (마지막 자리까지 같게) */
export function fsum(arr) {
  let f = 0, c = 0;
  for (const x of arr) {
    const t = f + x;
    if (Math.abs(f) >= Math.abs(x)) c += (f - t) + x;
    else c += (x - t) + f;
    f = t;
  }
  if (c && Number.isFinite(c)) f += c;
  return f;
}

/** 파이썬 max(iterable, key=...) — 같은 값이면 먼저 나온 것 */
export function maxBy(arr, key) {
  let best = arr[0], bv = key(arr[0]);
  for (const x of arr.slice(1)) { const v = key(x); if (v > bv) { best = x; bv = v; } }
  return best;
}
export function minBy(arr, key) {
  let best = arr[0], bv = key(arr[0]);
  for (const x of arr.slice(1)) { const v = key(x); if (v < bv) { best = x; bv = v; } }
  return best;
}

/** 안정 정렬 (파이썬 sorted 와 같게) — key 오름차순 */
export const sortBy = (arr, key) => arr.map((x, i) => [key(x), i, x])
  .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1])).map((t) => t[2]);

/** 문자열 정렬 (파이썬 sorted 와 같은 코드포인트 순) */
export const sortStr = (arr) => [...arr].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

/** frozenset 두 글자 키 */
export const pairKey = (a, b) => [...new Set([a, b])].sort().join("");

/** 한글 받침 조사: j('정재', '과/와') → '정재와' */
export function j(word, pair) {
  const [a, b] = pair.split("/");
  for (const ch of [...word].reverse()) {
    if (ch >= "가" && ch <= "힣") return word + ((ch.codePointAt(0) - 0xac00) % 28 !== 0 ? a : b);
  }
  return word + b;
}

export const isHangul = (ch) => ch >= "가" && ch <= "힣";

export class EngineError extends Error {}

/** 60갑자 */
export const ganjiName = (k) => T.GAN[k % 10] + T.JI[k % 12];
export const ganjiKr = (k) => T.GAN_KR[k % 10] + T.JI_KR[k % 12];
export function ganjiIndex(gan, ji) {
  for (let k = 0; k < 60; k++) if (k % 10 === gan && k % 12 === ji) return k;
  throw new EngineError("천간과 지지의 음양이 맞지 않습니다");
}

/** 날짜 문자열 */
export const pad2 = (n) => String(n).padStart(2, "0");
export const isoDate = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
