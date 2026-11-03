// 궁합(커플·부부) · 기업 사주(대표자 + 회사)  (engine/compat.py 이식)
import { T } from "./tables.js";
import { compute } from "./manse.js";
import { analyze, elementOfGroup, ganHap, isJiChung, jiYukhap } from "./saju.js";
import { Ctx, clamp, interpret, nameOhaeng, period, stars } from "./fortune.js";
import { givenNameChars } from "./pipeline.js";
import { fsum, ganjiKr, ganjiName, isHangul, isoDate, j, maxBy, mod, pairKey, pyFixed, pyRound, sortBy, sortStr, sum } from "./util.js";

const OHAENG = [...T.OHAENG];
const OKR = T.OHAENG_KR;
const oh = (o) => `${o}(${OKR[o]})`;
const grade = (s) => (s >= 85 ? "천생연분" : s >= 75 ? "매우 좋음" : s >= 65 ? "좋음" : s >= 52 ? "보통" : "노력 필요");

function ganRelation(a, b) {
  const h = ganHap(a, b);
  if (h) return ["합", h];
  const oa = T.GAN_OH[T.GAN.indexOf(a)], ob = T.GAN_OH[T.GAN.indexOf(b)];
  if (oa === ob) return ["비화", null];
  if (T.SAENG[oa] === ob) return ["내가생", null];
  if (T.SAENG[ob] === oa) return ["상대가생", null];
  if (T.GEUK[oa] === ob) return ["내가극", null];
  return ["상대가극", null];
}
function jiRelation(a, b) {
  if (a === b) return "같음";
  if (jiYukhap(a, b)) return "육합";
  if (isJiChung(a, b)) return "충";
  if (T.WONJIN.includes(pairKey(a, b))) return "원진";
  if (Object.keys(T.JI_SAMHAP).some((t) => t.includes(a) && t.includes(b))) return "삼합";
  return null;
}
function support(need, other) {
  const sc = other.element_score;
  const total = fsum(Object.values(sc)) || 1;
  return fsum(need.slice(0, 2).map((o) => sc[o])) / total;
}
function personSummary(name, s, a) {
  return { name, pillars: s.pillars.map((p) => p.text).join(" "), day_master: a.day_master, strength: a.strength.label,
    yong: a.yongsin.element, roles: a.roles, element_count: a.element_count, element_count_saju: a.element_count_saju ?? null,
    name_elements: a.name_elements || [], basis: a.basis ?? null, animal: s.year_animal };
}
const descHead = (g) => T.DAY_MASTER_DESC[g].split(".")[0];
const spouseGods = (g) => (g === "M" ? ["정재", "편재"] : ["정관", "편관"]);

// ── 궁합 ─────────────────────────────────────────
export function couple(b1, n1, b2, n2, { year = null, married = false, wedding = null, h1 = null, h2 = null, deps }) {
  year = year || new Date().getFullYear();
  const s1 = compute(b1), s2 = compute(b2);
  const a1 = analyze(s1, givenNameChars(n1, h1, deps));
  const a2 = analyze(s2, givenNameChars(n2, h2, deps));
  n1 = n1 || "첫 번째 분"; n2 = n2 || "두 번째 분";
  const cats = [];

  // 1) 성격 궁합
  const d1 = s1.dayGan, d2 = s2.dayGan;
  const [rel, hap] = ganRelation(d1, d2);
  let score = 60;
  let pts = [`${n1}님은 ${descHead(d1)}, ${n2}님은 ${descHead(d2)}입니다.`];
  if (rel === "합") { score += 25; pts.push(`두 분의 일간 ${d1}·${d2}는 천간합(${oh(hap)})을 이룹니다. 처음 만나도 낯설지 않고 서로에게 자연스럽게 끌리는, 궁합에서 가장 좋게 보는 관계입니다.`); }
  else if (rel === "비화") { score += 6; pts.push("두 분의 일간이 같은 오행이라 친구처럼 말이 잘 통하고 가치관이 비슷합니다. 다만 둘 다 자기 방식을 고집하면 부딪힐 수 있어 역할 분담이 중요합니다."); }
  else if (rel === "내가생") { score += 12; pts.push(`${n1}님의 기운이 ${n2}님을 생(生)해 주는 관계입니다. ${n1}님이 아끼고 챙겨 주며 ${n2}님은 그 안에서 편안함을 느낍니다. 받는 쪽이 고마움을 표현하면 더욱 단단해집니다.`); }
  else if (rel === "상대가생") { score += 12; pts.push(`${n2}님의 기운이 ${n1}님을 생(生)해 주는 관계입니다. ${n2}님이 든든한 버팀목이 되어 주고 ${n1}님은 그 덕에 힘을 얻습니다.`); }
  else if (rel === "내가극") { score -= 4; pts.push(`${n1}님이 ${n2}님을 극(剋)하는 관계라 ${n1}님이 주도권을 쥐기 쉽고 ${n2}님은 압박감을 느낄 수 있습니다. 상대의 속도를 존중하면 오히려 서로를 잘 다듬어 주는 관계가 됩니다.`); }
  else { score -= 4; pts.push(`${n2}님이 ${n1}님을 극(剋)하는 관계라 ${n2}님의 의견이 강하게 작용하기 쉽습니다. ${n1}님이 마음을 솔직하게 표현하는 것이 균형의 열쇠입니다.`); }
  cats.push({ key: "mind", title: "성격 궁합", hanja: "性", score: clamp(score), headline: `일간 ${d1} · ${d2}`, points: pts });

  // 2) 애정·생활 궁합
  const j1 = s1.pillars[2].ji, j2 = s2.pillars[2].ji;
  let r = jiRelation(j1, j2);
  score = 62;
  pts = [`배우자 자리인 일지는 ${n1}님 ${j1}(${T.JI_KR[T.JI.indexOf(j1)]}), ${n2}님 ${j2}(${T.JI_KR[T.JI.indexOf(j2)]})입니다.`];
  const msg = {
    육합: [20, "일지가 육합을 이뤄 정이 깊고 함께 있을 때 편안합니다. 생활 리듬과 애정 표현이 잘 맞는 좋은 궁합입니다."],
    삼합: [12, "일지가 삼합의 한 축을 이뤄 같은 목표를 향해 힘을 모으기 좋습니다."],
    같음: [2, "일지가 같아 생활 습관이 닮았습니다. 편하지만 서로의 단점도 비슷해 함께 보완할 부분을 정해 두면 좋습니다."],
    충: [-18, "일지가 충(沖)하여 생활 방식과 감정 표현이 달라 다툼이 생기기 쉽습니다. 각자의 공간과 시간을 인정해 주면 충의 기운이 오히려 활력이 됩니다."],
    원진: [-12, "일지가 원진(怨嗔) 관계라 사소한 일에 서운함이 쌓이기 쉽습니다. 오해가 생기면 바로 대화로 푸는 습관이 중요합니다."],
  };
  if (r in msg) { score += msg[r][0]; pts.push(msg[r][1]); }
  else pts.push("일지 사이에 특별한 합이나 충이 없어 무난한 관계로, 함께 쌓아 가는 노력에 따라 깊어집니다.");
  const m1 = s1.pillars[1].ji, m2 = s2.pillars[1].ji;
  if (isJiChung(m1, m2)) { score -= 6; pts.push("월지(집안·환경)가 충하여 두 집안의 분위기나 생활 배경이 크게 다를 수 있습니다."); }
  else if (jiYukhap(m1, m2)) { score += 5; pts.push("월지(집안·환경)가 합을 이뤄 양가와의 관계도 원만한 편입니다."); }
  cats.push({ key: "love", title: "애정 · 생활 궁합", hanja: "情", score: clamp(score), headline: `배우자궁 ${j1} · ${j2}`, points: pts });

  // 3) 오행 보완
  const sup12 = support(a1.needed_elements, a2), sup21 = support(a2.needed_elements, a1);
  score = 50 + (sup12 + sup21) * 70;
  pts = [(a1.name_elements.length || a2.name_elements.length)
    ? `두 분 모두 사주에 이름 글자의 발음오행을 더해(${n1}님 ${sum(Object.values(a1.element_count))}자, `
      + `${n2}님 ${sum(Object.values(a2.element_count))}자) 오행을 비교했습니다.` : "",
  `${n1}님에게 필요한 기운은 ${a1.needed_elements.slice(0, 2).map(oh).join("·")}, `
    + `${n2}님에게 필요한 기운은 ${a2.needed_elements.slice(0, 2).map(oh).join("·")}입니다.`];
  for (const [me, other, sup] of [[n1, n2, sup12], [n2, n1, sup21]]) {
    if (sup >= 0.35) pts.push(`${other}님의 사주에 ${me}님이 필요로 하는 기운이 풍부해(${pyFixed(sup * 100, 0)}%), 함께 있으면 ${me}님의 운이 살아납니다.`);
    else if (sup >= 0.2) pts.push(`${other}님이 ${me}님에게 필요한 기운을 어느 정도(${pyFixed(sup * 100, 0)}%) 채워 줍니다.`);
    else pts.push(`${other}님의 사주에는 ${me}님에게 필요한 기운이 적어(${pyFixed(sup * 100, 0)}%) 오행 보완 효과는 크지 않습니다.`);
  }
  pts = pts.filter(Boolean);
  const combined = Object.fromEntries(OHAENG.map((o) => [o, a1.element_count[o] + a2.element_count[o]]));
  const missing = OHAENG.filter((o) => combined[o] === 0);
  pts.push("두 사주를 합치면 오행이 " + (!missing.length ? "모두 갖춰져 균형이 좋습니다." : `${j(missing.map(oh).join("·"), "이/가")} 없어 이 기운을 생활 속에서 보완하면 좋습니다.`));
  cats.push({ key: "oh", title: "오행 보완", hanja: "補", score: clamp(score), headline: "서로에게 필요한 기운을 채워 주는지", points: pts, combined });

  // 4) 배우자 인연
  score = 58;
  pts = [];
  for (const [me, b, sMe, sOther] of [[n1, b1, s1, s2], [n2, b2, s2, s1]]) {
    const dmOh = T.GAN_OH[T.GAN.indexOf(sMe.dayGan)];
    const star = elementOfGroup(dmOh, b.gender === "M" ? "재성" : "관성");
    const otherOh = T.GAN_OH[T.GAN.indexOf(sOther.dayGan)];
    const label = b.gender === "M" ? "아내·여자친구의 별(재성)" : "남편·남자친구의 별(관성)";
    if (otherOh === star) { score += 12; pts.push(`상대의 일간 오행 ${j(oh(otherOh), "이/가")} ${me}님에게 ${label}에 해당해 배우자로서 인연이 깊습니다.`); }
    else pts.push(`${me}님의 ${label}은 ${oh(star)}이고 상대의 일간은 ${oh(otherOh)}입니다.`);
  }
  if (b1.gender === b2.gender) pts.push("동성 커플의 경우 배우자 별보다 성격·생활 궁합과 오행 보완을 중심으로 보시면 됩니다.");
  cats.push({ key: "star", title: "배우자 인연", hanja: "緣", score: clamp(score), headline: "서로가 배우자 별인지", points: pts });

  // 5) 띠 궁합
  const y1 = s1.pillars[0].ji, y2 = s2.pillars[0].ji;
  r = jiRelation(y1, y2);
  score = 62 + ({ 육합: 14, 삼합: 14, 같음: 4, 충: -12, 원진: -8 }[r] || 0);
  const tti = { 육합: "육합으로 서로를 끌어당기는 좋은 띠 궁합입니다.", 삼합: "삼합으로 뜻이 잘 맞는 좋은 띠 궁합입니다.",
    같음: "같은 띠라 공감대가 큽니다.", 충: "충하는 띠라 성향 차이가 크지만, 서로 다른 점이 오히려 보완이 될 수 있습니다.",
    원진: "원진 관계의 띠라 사소한 감정 소모를 줄이는 배려가 필요합니다." }[r] || "띠 사이에 특별한 합충이 없어 무난합니다.";
  cats.push({ key: "tti", title: "띠 궁합", hanja: "支", score: clamp(score), headline: `${s1.year_animal}띠 · ${s2.year_animal}띠`,
    points: [`${n1}님 ${s1.year_animal}띠(${y1}), ${n2}님 ${s2.year_animal}띠(${y2}). ${tti}`] });

  // 6) 올해 두 사람의 운
  const f1 = interpret(s1, a1, b1.gender, { year }), f2 = interpret(s2, a2, b2.gender, { year });
  const y1c = f1.categories.find((c) => c.key === "year"), y2c = f2.categories.find((c) => c.key === "year");
  const k = mod(year - 4, 60);
  score = pyRound((y1c.score + y2c.score) / 2);
  pts = [`${year}년 ${ganjiName(k)}(${ganjiKr(k)})년 ${n1}님의 운은 ${y1c.score}점, ${n2}님은 ${y2c.score}점입니다.`];
  if (Math.max(y1c.score, y2c.score) < 55) pts.push("두 분 모두 올해는 내실을 다질 해입니다. 큰 결정은 서로 충분히 상의하며 천천히 진행하고, 건강을 함께 챙기세요.");
  else if (Math.abs(y1c.score - y2c.score) >= 15) {
    const [hi, lo] = y1c.score > y2c.score ? [n1, n2] : [n2, n1];
    pts.push(`올해는 ${hi}님의 운이 더 좋으니 중요한 결정은 ${hi}님이 앞장서고, ${lo}님은 건강과 내실을 챙기는 역할을 맡으면 좋습니다.`);
  } else pts.push("두 분의 올해 운 흐름이 비슷해 함께 계획한 일을 같은 속도로 추진하기 좋습니다.");
  cats.push({ key: "year", title: `${year}년 함께하는 운`, hanja: "歲", score, headline: "두 사람의 올해 흐름", points: pts });

  // 7) 이름 · 결혼
  const people = [[n1, b1, s1, a1], [n2, b2, s2, a2]];
  const nc = coupleNames(people, [h1, h2], deps);
  if (nc) cats.push(nc);
  if (married && wedding) cats.push(weddingDay(people, wedding, year));
  else if (!married) cats.push(weddingYears(people, year));

  const weights = { mind: 0.25, love: 0.25, oh: 0.2, star: 0.15, tti: 0.1, year: 0.05, names: 0.1 };
  const used = cats.filter((c) => c.key in weights);
  const overall = pyRound(fsum(used.map((c) => c.score * weights[c.key])) / fsum(used.map((c) => weights[c.key])));
  for (const c of cats) { c.stars = stars(c.score); if (!c.advice) c.advice = []; }
  const advice = [];
  if (cats.some((c) => c.key === "love" && c.score < 55)) advice.push("다툼이 생기면 그날 안에 대화로 푸는 규칙을 정해 두세요.");
  const lucky = a1.needed_elements.slice(0, 2).filter((o) => a2.needed_elements.slice(0, 2).includes(o));
  if (lucky.length) advice.push(`두 분 모두에게 좋은 기운은 ${lucky.map(oh).join("·")}입니다. 신혼집 인테리어나 데이트 장소에 이 기운을 활용해 보세요.`);
  advice.push("궁합 점수는 경향일 뿐이며, 서로를 이해하려는 마음이 가장 큰 궁합입니다.");
  return {
    type: "couple", year, married, wedding: wedding ? isoDate(...wedding) : null, overall, grade: grade(overall), categories: cats, advice,
    people: [personSummary(n1, s1, a1), personSummary(n2, s2, a2)],
    sajus: [{ saju: s1.toDict(), analysis: a1 }, { saju: s2.toDict(), analysis: a2 }],
  };
}

function weddingDay(people, wd, year) {
  const [wy, wm, wdd] = wd;
  const ws = compute({ year: wy, month: wm, day: wdd, hour: 12 });
  const [yp, mp, dp] = ws.pillars;
  let score = 60;
  const pts = [`결혼일 ${wy}년 ${wm}월 ${wdd}일은 ${yp.text}년 ${mp.text}월 ${dp.text}일(${ganjiKr(dp.idx60)}일)입니다.`];
  for (const [name, b, s, a] of people) {
    const c = new Ctx(s, a, b.gender);
    const [rel] = ganRelation(s.dayGan, dp.gan);
    if (rel === "합") { score += 8; pts.push(`결혼일의 천간 ${j(`${dp.gan}(${T.GAN_KR[T.GAN.indexOf(dp.gan)]})`, "이/가")} ${name}님의 일간 ${s.dayGan}과 천간합을 이뤄 마음이 하나로 묶이는 날이었습니다.`); }
    const r = jiRelation(s.pillars[2].ji, dp.ji);
    const djk = `${dp.ji}(${T.JI_KR[T.JI.indexOf(dp.ji)]})`;
    if (r === "육합" || r === "삼합") { score += 6; pts.push(`결혼일의 지지 ${j(djk, "이/가")} ${name}님의 배우자 자리(${s.pillars[2].ji})와 ${r}하여 부부 인연을 단단히 맺는 날이었습니다.`); }
    else if (r === "충") { score -= 8; pts.push(`결혼일의 지지 ${j(djk, "이/가")} ${name}님의 배우자 자리(${s.pillars[2].ji})와 충(沖)하는 날이었습니다. 결혼 초 생활 방식의 차이를 조율하는 노력이 특히 도움이 됩니다.`); }
    else if (r === "원진") { score -= 5; pts.push(`결혼일의 지지가 ${name}님의 배우자 자리와 원진 관계라, 사소한 서운함을 그때그때 푸는 습관이 중요합니다.`); }
    const sw = period(c, yp.gan, yp.ji, "sw");
    score += pyRound((sw.score - 60) * 0.3);
    const star = sw.gods.some((g) => spouseGods(b.gender).includes(g));
    if (star) score += 4;
    pts.push(`결혼한 ${wy}년은 ${name}님에게 '${sw.level}'(${sw.score}점)의 해였` + (star ? "고, 배우자 별이 들어온 해라 결혼 시기로 잘 맞았습니다." : "습니다."));
  }
  const today = new Date();
  const before = (today.getMonth() + 1) * 100 + today.getDate() < wm * 100 + wdd;
  const marriedYears = year - wy + (before ? 0 : 1) - 1;
  if (marriedYears >= 0) {
    const stage = marriedYears < 3 ? "신혼기로 서로의 생활을 맞춰 가는 시기" : marriedYears < 10 ? "가정의 기반을 다지는 시기"
      : marriedYears < 25 ? "함께 쌓은 신뢰로 가정을 이끄는 시기" : "서로를 가장 잘 아는 동반자의 시기";
    pts.push(`결혼 ${marriedYears + 1}년 차로, ${stage}입니다.`);
  }
  score = clamp(score);
  const head = score >= 70 ? "두 분에게 좋은 날 맺은 인연입니다" : score >= 55 ? "무난한 날 맺은 인연입니다" : "서로 맞춰 가는 노력이 빛나는 인연입니다";
  return { key: "wedding", title: "결혼일 풀이", hanja: "婚", score, headline: head, points: pts };
}

function weddingYears(people, year) {
  const rows = [];
  for (let y = year; y < year + 6; y++) {
    const k = mod(y - 4, 60);
    const gan = T.GAN[k % 10], ji = T.JI[k % 12];
    let sc = 0;
    const notes = [];
    for (const [name, b, s, a] of people) {
      const p = period(new Ctx(s, a, b.gender), gan, ji, "sw");
      sc += p.score / 2;
      if (p.gods.some((g) => spouseGods(b.gender).includes(g))) { sc += 5; notes.push(`${name}님 배우자 별`); }
      const r = jiRelation(s.pillars[2].ji, ji);
      if (r === "육합" || r === "삼합") { sc += 4; notes.push(`${name}님 배우자궁 ${r}`); }
      else if (r === "충") { sc -= 6; notes.push(`${name}님 배우자궁 충`); }
    }
    rows.push([y, ganjiName(k), pyRound(sc), notes]);
  }
  const best = sortBy(rows, (r) => -r[2]).slice(0, 2);
  const pts = [`앞으로 6년 중 결혼하기 가장 좋은 해는 ${best[0][0]}년(${best[0][1]})과 ${best[1][0]}년(${best[1][1]})입니다.`];
  for (const [y, gz, sc, notes] of rows) pts.push(`${y}년 ${gz}: ${sc}점` + (notes.length ? ` — ${notes.join(", ")}` : ""));
  pts.push("결혼 날짜(택일)는 두 분의 일간과 합하고 배우자 자리와 충하지 않는 날을 고르면 좋습니다.");
  return { key: "wedding", title: "결혼하기 좋은 해", hanja: "婚", score: clamp(best[0][2]), headline: `${best[0][0]}년 · ${best[1][0]}년 추천`, points: pts };
}

function coupleNames(people, hanjas, deps) {
  const res = people.map(([name, b, s, a], i) => (name ? nameOhaeng(new Ctx(s, a, b.gender), name, hanjas[i], deps.db, deps.naming) : null));
  if (!res.some(Boolean)) return null;
  const pts = [], scores = [], tables = [];
  res.forEach((r, i) => {
    const me = people[i], other = people[1 - i];
    if (!r) { pts.push(`${me[0]}님의 이름은 한글이 아니어서 오행을 볼 수 없습니다.`); return; }
    scores.push(r.score);
    tables.push({ name: me[0], chars: r.chars });
    pts.push(`[${me[0]}] ${r.headline} — ` + r.points.slice(0, 2).join(" "));
    const els = r.chars.filter((x) => !x.is_surname).map((x) => x.sound);
    const gift = sortStr([...new Set(els.filter((o) => other[3].needed_elements.slice(0, 2).includes(o)))]);
    if (gift.length) {
      scores[scores.length - 1] = Math.min(96, scores[scores.length - 1] + 6);
      pts.push(`${me[0]}님 이름의 ${gift.map(oh).join("·")} 기운은 ${other[0]}님에게도 필요한 기운이라, 이름을 부를 때마다 상대의 운을 북돋웁니다.`);
    }
  });
  const score = scores.length ? clamp(sum(scores) / scores.length) : 60;
  const head = score >= 72 ? "두 분의 이름이 사주를 잘 받쳐 줍니다" : score >= 56 ? "이름과 사주의 조화가 무난합니다" : "이름이 사주를 충분히 돕지 못합니다";
  pts.push("이름 오행은 발음오행(이름 첫소리)을 기준으로 풀이했습니다.");
  return { key: "names", title: "이름 오행 궁합", hanja: "名", score, headline: head, points: pts, tables };
}

// ── 기업 사주 ─────────────────────────────────────
export function business(rep, repName, comp, compName, { year = null, repHanja = null, deps }) {
  year = year || new Date().getFullYear();
  const rs = compute(rep), cs = compute(comp);
  const ra = analyze(rs), ca = analyze(cs);
  repName = repName || "대표자";
  compName = (compName || "").trim();
  const cname = compName || "회사";
  const cc = new Ctx(cs, ca, "M"), rc = new Ctx(rs, ra, rep.gender || "M");
  const cats = [];

  const top = maxBy(Object.keys(cc.ratio), (k) => cc.ratio[k]);
  let pts = [`${cname}의 일간은 ${j(`${cs.dayGan}(${ca.day_master.kr}${OKR[cc.dmOh]})`, "으로/로")} ${descHead(cs.dayGan)}의 기질을 가진 회사입니다.`,
    `사주의 중심 기운이 ${top}이라 ${T.COMPANY_STYLE[top]}`,
    `회사 사주는 '${ca.strength.label}'이며 용신은 ${oh(ca.yongsin.element)}입니다.`];
  cats.push({ key: "nature", title: "회사의 성격", hanja: "社", score: null, headline: `${top} 중심의 ${cs.dayGan}${OKR[cc.dmOh]} 기업`, points: pts });

  const rn = repName ? nameOhaeng(rc, repName, repHanja, deps.db, deps.naming) : null;
  if (rn) {
    const els = rn.chars.filter((x) => !x.is_surname).map((x) => x.sound);
    const helps = sortStr([...new Set(els.filter((o) => ca.needed_elements.slice(0, 2).includes(o)))]);
    const hurts = sortStr([...new Set(els.filter((o) => ca.avoid_elements.includes(o)))]);
    if (helps.length) { rn.score = clamp(rn.score + 6); rn.points.push(`대표자 이름의 ${helps.map(oh).join("·")} 기운은 회사 사주에도 필요한 기운이라, 대표자가 이름으로 회사를 돕는 구조입니다.`); }
    if (hurts.length) { rn.score = clamp(rn.score - 4); rn.points.push(`대표자 이름의 ${hurts.map(oh).join("·")} 기운은 회사 사주에는 부담이 되는 기운입니다.`); }
    if (!helps.length && !hurts.length) rn.points.push("대표자 이름의 오행은 회사 사주에 중립적입니다.");
    Object.assign(rn, { key: "repname", title: "대표자 이름 오행", hanja: "名" });
    cats.push(rn);
  }

  let score = 60 + cc.fit("재성");
  pts = [];
  if (cc.lv["재성"] === "없음") { score -= 6; pts.push("회사 사주에 재성이 드러나지 않아 초기 매출이 더디게 붙을 수 있습니다. 기술·제품력을 먼저 쌓는 전략이 맞습니다."); }
  else if (cc.strong) { score += 10; pts.push("회사의 힘이 튼튼하고 재성도 갖춰 매출을 만들고 지키는 힘이 좋습니다."); }
  else if (cc.lv["재성"] === "과다") { score -= 6; pts.push("시장 기회는 많지만 회사 체력에 비해 벌이가 커 확장 속도 조절과 자금 관리가 중요합니다."); }
  else { score += 4; pts.push("재성이 알맞게 자리해 안정적인 매출 흐름을 기대할 수 있습니다."); }
  if (["적당", "과다"].includes(cc.lv["식상"]) && cc.lv["재성"] !== "없음") { score += 8; pts.push("식상이 재성을 생해 제품·서비스가 곧 매출로 이어지는 구조(식상생재)입니다."); }
  if (cc.lv["비겁"] === "과다") { score -= 6; pts.push("비겁이 많아 경쟁사가 많거나 동업자와 이익 배분 문제가 생기기 쉽습니다. 지분·계약을 명확히 하세요."); }
  cats.push({ key: "wealth", title: "회사 재물운", hanja: "財", score: clamp(score), headline: "매출과 이익의 흐름", points: pts });

  const [rel] = ganRelation(rs.dayGan, cs.dayGan);
  score = 60;
  pts = [`${repName}님의 일간은 ${rs.dayGan}(${ra.day_master.kr}), ${cname}의 일간은 ${cs.dayGan}(${ca.day_master.kr})입니다.`];
  if (rel === "합") { score += 20; pts.push("천간합을 이뤄 대표자와 회사가 한 몸처럼 움직입니다. 대표자의 의지가 회사에 그대로 전해지는 좋은 궁합입니다."); }
  else if (rel === "상대가생") { score += 16; pts.push("회사가 대표자를 생(生)해 주는 관계라 회사가 대표자에게 이익과 명예를 가져다줍니다."); }
  else if (rel === "내가극") { score += 10; pts.push("대표자가 회사를 극(剋)하는 관계로, 회사는 대표자에게 재성(재물)이 됩니다. 장악력이 강하고 회사가 곧 대표자의 재물이 되는 구조입니다."); }
  else if (rel === "내가생") { score += 2; pts.push("대표자가 회사를 생(生)해 주는 관계라 대표자의 헌신으로 회사가 자랍니다. 대표자의 체력과 시간 관리가 중요합니다."); }
  else if (rel === "비화") { score += 4; pts.push("대표자와 회사의 오행이 같아 방향이 일치하지만, 회사를 키우려면 대표자와 다른 성향의 인재를 함께 두는 것이 좋습니다."); }
  else { score -= 8; pts.push("회사가 대표자를 극(剋)하는 관계라 회사 운영이 대표자에게 부담과 압박(관성)으로 다가오기 쉽습니다. 권한 위임과 전문 경영 보완이 도움이 됩니다."); }
  const sup = support(ra.needed_elements, ca);
  score += pyRound((sup - 0.2) * 40);
  pts.push(`회사 사주에 ${repName}님에게 필요한 ${ra.needed_elements.slice(0, 2).map(oh).join("·")} 기운이 ${pyFixed(sup * 100, 0)}% 들어 있어 `
    + (sup >= 0.3 ? "회사가 대표자의 운을 북돋웁니다." : sup >= 0.18 ? "보완 효과는 보통입니다." : "회사가 대표자의 부족한 기운을 채워 주지는 못합니다."));
  const r = jiRelation(rs.pillars[2].ji, cs.pillars[2].ji);
  if (r === "육합" || r === "삼합") { score += 8; pts.push("대표자와 회사의 일지가 합을 이뤄 내부 결속력이 좋습니다."); }
  else if (r === "충" || r === "원진") { score -= 8; pts.push(`대표자와 회사의 일지가 ${r} 관계라 조직 내 갈등이나 대표자 피로가 생기기 쉽습니다.`); }
  cats.push({ key: "match", title: "대표자 · 회사 궁합", hanja: "合", score: clamp(score), headline: `${rs.dayGan} 대표 · ${cs.dayGan} 회사`, points: pts });

  const ry = ra.needed_elements[0], cy = ca.needed_elements[0];
  pts = [`대표자 용신 ${oh(ry)} 업종: ${T.OH_JOBS[ry]}`, `회사 용신 ${oh(cy)} 업종: ${T.OH_JOBS[cy]}`];
  score = 62;
  if (ry === cy) { score += 16; pts.push(`대표자와 회사의 용신이 ${oh(ry)}로 같아 이 업종에 집중하면 시너지가 큽니다.`); }
  else if (T.SAENG[ry] === cy || T.SAENG[cy] === ry) { score += 8; pts.push("두 용신이 서로 생하는 관계라 두 분야를 연결한 사업 모델이 유리합니다."); }
  else pts.push("두 용신이 달라 대표자 강점 분야와 회사 주력 분야를 나눠 운영하는 전략이 좋습니다.");
  cats.push({ key: "industry", title: "업종 적합성", hanja: "業", score: clamp(score), headline: "잘 맞는 사업 분야", points: pts });

  if (compName) {
    const se = [...compName].filter(isHangul).map((ch) => [ch, deps.naming.soundElement(ch)]);
    const need = new Set([...ra.needed_elements.slice(0, 2), ...ca.needed_elements.slice(0, 2)]);
    const avoid = new Set([...ra.avoid_elements, ...ca.avoid_elements]);
    const good = se.filter(([, o]) => need.has(o)).map(([ch, o]) => `${ch}(${o})`);
    const bad = se.filter(([, o]) => avoid.has(o) && !need.has(o)).map(([ch, o]) => `${ch}(${o})`);
    score = clamp(60 + 8 * good.length - 6 * bad.length);
    pts = [`상호 '${compName}'의 발음오행은 ` + se.map(([ch, o]) => `${ch}(${OKR[o]})`).join(" → ") + "입니다."];
    if (good.length) pts.push(`${j(good.join(", "), "이/가")} 대표자·회사에 필요한 기운을 담고 있어 좋습니다.`);
    if (bad.length) pts.push(`${j(bad.join(", "), "은/는")} 부담이 되는 기운이라 로고 색상이나 영문 표기로 보완하면 좋습니다.`);
    cats.push({ key: "cname", title: "상호 오행", hanja: "號", score, headline: `'${compName}'의 소리 기운`, points: pts });
  }

  const years = [];
  for (let y = year; y < year + 5; y++) {
    const k = mod(y - 4, 60);
    const pc = period(cc, T.GAN[k % 10], T.JI[k % 12], "sw");
    const pr = period(rc, T.GAN[k % 10], T.JI[k % 12], "sw");
    const sc = pyRound(pc.score * 0.6 + pr.score * 0.4);
    years.push({ year: y, ganji: ganjiName(k), kr: ganjiKr(k), score: sc,
      level: sc >= 80 ? "대길" : sc >= 68 ? "길" : sc >= 55 ? "평" : "주의",
      company: pc, rep: pr, elements: pc.elements, gods: pc.gods, keywords: pc.keywords,
      text: [`회사: ${pc.text[0]}`, `대표자: ${pr.text[0]}`, ...pc.text.slice(2, 4)], current: y === year });
  }
  const best = maxBy(years, (x) => x.score);
  cats.push({ key: "years", title: "연도별 회사 운", hanja: "歲", score: years[0].score,
    headline: `가장 좋은 해는 ${best.year}년(${best.ganji})`, points: [`${best.year}년이 확장·투자·신사업에 가장 유리합니다.`] });

  const weights = { wealth: 0.3, match: 0.35, industry: 0.2, cname: 0.15, repname: 0.1 };
  const scored = cats.filter((c) => c.key in weights);
  const overall = pyRound(fsum(scored.map((c) => c.score * weights[c.key])) / fsum(scored.map((c) => weights[c.key])));
  for (const c of cats) { c.stars = c.score != null ? stars(c.score) : null; if (!c.advice) c.advice = []; }
  return {
    type: "business", year, overall, grade: grade(overall).replace("천생연분", "최상"), categories: cats, years,
    advice: [`중요한 계약·개업·이전은 ${best.year}년처럼 운이 좋은 해에 맞추면 좋습니다.`,
      `사무실 인테리어·로고에 회사 용신 ${oh(cy)} 계열 색을 쓰면 회사 기운을 보완합니다.`],
    people: [personSummary(repName, rs, ra), personSummary(cname, cs, ca)],
    sajus: [{ saju: rs.toDict(), analysis: ra }, { saju: cs.toDict(), analysis: ca }],
  };
}
