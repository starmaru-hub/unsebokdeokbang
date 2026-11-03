// 사주 분석: 오행·십신·12운성·신강약·용신(5역할)·합충·신살  (engine/saju.py 이식)
import { T } from "./tables.js";
import { fsum, maxBy, minBy, pairKey, pyFixed, pyRound } from "./util.js";

const OHAENG = [...T.OHAENG];

export function relation(dmOh, oh) {
  if (oh === dmOh) return "same";
  if (T.SAENG[dmOh] === oh) return "out";
  if (T.GEUK[dmOh] === oh) return "wealth";
  if (T.GEUK[oh] === dmOh) return "officer";
  return "resource";
}
export function tenGod(dayGan, otherGan) {
  const di = T.GAN.indexOf(dayGan), oi = T.GAN.indexOf(otherGan);
  return T.TEN_GODS[`${relation(T.GAN_OH[di], T.GAN_OH[oi])}|${T.GAN_YANG[di] === T.GAN_YANG[oi]}`];
}
export const tenGodBranch = (dayGan, ji) => tenGod(dayGan, T.JIJANGGAN[ji][T.JIJANGGAN[ji].length - 1][0]);

export function twelveStage(gan, ji) {
  const start = T.JI.indexOf(T.JANGSAENG[gan]);
  const idx = T.JI.indexOf(ji);
  const off = T.GAN_YANG[T.GAN.indexOf(gan)] ? (((idx - start) % 12) + 12) % 12 : (((start - idx) % 12) + 12) % 12;
  return T.TWELVE_STAGES[off];
}
export function elementOfGroup(dmOh, group) {
  return {
    비겁: dmOh, 식상: T.SAENG[dmOh], 재성: T.GEUK[dmOh],
    관성: OHAENG.find((o) => T.GEUK[o] === dmOh),
    인성: OHAENG.find((o) => T.SAENG[o] === dmOh),
  }[group];
}
export function gongmang(dayIdx60) {
  const start = dayIdx60 - (dayIdx60 % 10);
  const firstJi = start % 12;
  return T.JI[(firstJi + 10) % 12] + T.JI[(firstJi + 11) % 12];
}
export const ganHap = (a, b) => T.GAN_HAP[pairKey(a, b)];
export const isGanChung = (a, b) => T.GAN_CHUNG.includes(pairKey(a, b));
export const jiYukhap = (a, b) => T.JI_YUKHAP[pairKey(a, b)];
export const isJiChung = (a, b) => T.JI_CHUNG.includes(pairKey(a, b));

const GROUPS = ["비겁", "식상", "재성", "관성", "인성"];
const r2 = (v) => pyRound(v, 2);

/** nameChars: 이름(성 제외) 글자 [{kr, h, element, basis}] — 주면 사주 8자 + 이름 = 10자로 분석 */
export function analyze(saju, nameChars = null) {
  const ps = saju.pillars;
  const dm = saju.dayGan;
  const dmOh = T.GAN_OH[T.GAN.indexOf(dm)];
  nameChars = nameChars || [];

  const count = Object.fromEntries(OHAENG.map((o) => [o, 0]));
  const score = Object.fromEntries(OHAENG.map((o) => [o, 0]));
  const pillarRows = [];
  for (const p of ps) {
    const gi = T.GAN.indexOf(p.gan), ji = T.JI.indexOf(p.ji);
    count[T.GAN_OH[gi]] += 1;
    count[T.JI_OH[ji]] += 1;
    score[T.GAN_OH[gi]] += p.name !== "일주" ? T.W_STEM[p.name] : 1.0;
    for (const [g, days] of T.JIJANGGAN[p.ji]) score[T.GAN_OH[T.GAN.indexOf(g)]] += T.W_BRANCH[p.name] * days / 30;
    pillarRows.push({
      name: p.name, ganji: p.text,
      gan_god: p.name === "일주" ? "일간(나)" : tenGod(dm, p.gan),
      ji_god: tenGodBranch(dm, p.ji),
      jijanggan: T.JIJANGGAN[p.ji].map(([g]) => g),
      stage: twelveStage(dm, p.ji),
    });
  }
  const count8 = { ...count };
  const nameRows = [];
  for (const nc of nameChars) {
    const el = nc.element;
    count[el] += 1;
    score[el] += T.W_NAME;
    nameRows.push({ ...nc, group: T.REL_GROUP[relation(dmOh, el)] });
  }

  const groupScore = Object.fromEntries(GROUPS.map((g) => [g, 0]));
  for (const p of ps) {
    if (p.name !== "일주") groupScore[T.GROUP_OF[tenGod(dm, p.gan)]] += T.W_STEM[p.name];
    for (const [g, days] of T.JIJANGGAN[p.ji]) groupScore[T.GROUP_OF[tenGod(dm, g)]] += T.W_BRANCH[p.name] * days / 30;
  }
  for (const nr of nameRows) groupScore[nr.group] += T.W_NAME;
  const total = fsum(Object.values(groupScore));
  const support = groupScore["비겁"] + groupScore["인성"];
  const ratio = total ? support / total : 0.5;
  const monthGod = T.GROUP_OF[tenGodBranch(dm, ps[1].ji)];
  const deukryeong = monthGod === "비겁" || monthGod === "인성";
  const strength = ratio >= 0.65 ? "극신강" : ratio >= 0.53 ? "신강" : ratio > 0.45 ? "중화" : ratio > 0.33 ? "신약" : "극신약";

  let yongG, heeG, why;
  if (strength === "신강" || strength === "극신강") {
    if (groupScore["인성"] > groupScore["비겁"]) [yongG, heeG, why] = ["재성", "식상", "인성이 많아 신강하므로 재성으로 인성을 제어합니다."];
    else if (groupScore["관성"] >= 1.0) [yongG, heeG, why] = ["관성", "재성", "비겁이 많아 신강하므로 관성으로 일간을 다스립니다."];
    else [yongG, heeG, why] = ["식상", "재성", "비겁이 많아 신강하므로 식상으로 기운을 설기합니다."];
  } else if (strength === "신약" || strength === "극신약") {
    const heavy = maxBy(["식상", "재성", "관성"], (g) => groupScore[g]);
    if (heavy === "재성") [yongG, heeG, why] = ["비겁", "인성", "재성이 많아 신약하므로 비겁으로 일간을 돕습니다."];
    else [yongG, heeG, why] = ["인성", "비겁", `${heavy}이(가) 많아 신약하므로 인성으로 일간을 생합니다.`];
  } else {
    const weakest = minBy(OHAENG, (o) => score[o]);
    yongG = GROUPS.find((g) => elementOfGroup(dmOh, g) === weakest);
    const gen = OHAENG.find((o) => T.SAENG[o] === weakest);
    heeG = GROUPS.find((g) => elementOfGroup(dmOh, g) === gen);
    why = "사주가 중화에 가까워 가장 약한 오행을 보완해 균형을 맞춥니다.";
  }
  const yong = elementOfGroup(dmOh, yongG);
  let hee = elementOfGroup(dmOh, heeG);
  const gi = OHAENG.find((o) => T.GEUK[o] === yong);
  const gu = OHAENG.find((o) => T.SAENG[o] === gi);
  if ([gi, gu, yong].includes(hee)) {
    hee = OHAENG.find((o) => T.SAENG[o] === yong);
    heeG = GROUPS.find((g) => elementOfGroup(dmOh, g) === hee);
  }
  const han = OHAENG.find((o) => ![yong, hee, gi, gu].includes(o));
  const roles = {};
  roles[yong] = "용신"; roles[hee] = "희신"; roles[han] = "한신"; roles[gu] = "구신"; roles[gi] = "기신";

  let johu = null;
  const mji = ps[1].ji;
  if ("亥子丑".includes(mji) && score["火"] < 2.0) johu = { element: "火", why: "겨울(亥子丑월)에 태어나 차가운 사주라 따뜻한 火 기운이 필요합니다." };
  else if ("巳午未".includes(mji) && score["水"] < 2.0) johu = { element: "水", why: "여름(巳午未월)에 태어나 뜨거운 사주라 시원한 水 기운이 필요합니다." };

  const needed = [yong, hee];
  if (johu && !needed.includes(johu.element) && johu.element !== gi) needed.push(johu.element);
  const avoid = [gi, gu].filter((o) => !needed.includes(o));

  // 합·충
  const stems = ps.map((p) => p.gan), branches = ps.map((p) => p.ji);
  const rels = [];
  for (let i = 0; i < ps.length; i++) {
    for (let k = i + 1; k < ps.length; k++) {
      const gh = ganHap(stems[i], stems[k]);
      if (gh) rels.push(`${ps[i].name}·${ps[k].name} 천간합 ${stems[i]}${stems[k]}→${gh}`);
      if (isGanChung(stems[i], stems[k])) rels.push(`${ps[i].name}·${ps[k].name} 천간충 ${stems[i]}${stems[k]}`);
      const jh = jiYukhap(branches[i], branches[k]);
      if (jh) rels.push(`${ps[i].name}·${ps[k].name} 지지육합 ${branches[i]}${branches[k]}→${jh}`);
      if (isJiChung(branches[i], branches[k])) rels.push(`${ps[i].name}·${ps[k].name} 지지충 ${branches[i]}${branches[k]}`);
    }
  }
  for (const [trio, oh] of Object.entries(T.JI_SAMHAP)) {
    const hit = [...trio].filter((c) => branches.includes(c));
    if (hit.length === 3) rels.push(`지지삼합 ${trio}→${oh}국`);
    else if (hit.length === 2 && hit.includes(trio[1])) rels.push(`지지반합 ${hit.join("")}→${oh}`);
  }

  // 신살
  const sinsal = [];
  const nobles = branches.filter((b) => T.CHEONEUL[dm].includes(b));
  if (nobles.length) sinsal.push({ name: "천을귀인", detail: `${nobles.join("")} — 어려울 때 돕는 귀인의 기운` });
  const gm = gongmang(ps[2].idx60);
  const hitGm = ps.filter((p) => gm.includes(p.ji) && p.name !== "일주").map((p) => p.name);
  sinsal.push({ name: "공망", detail: gm + (hitGm.length ? ` (${hitGm.join(", ")}에 해당)` : "") });
  const DOHWA = { 申子辰: "酉", 亥卯未: "子", 寅午戌: "卯", 巳酉丑: "午" };
  const YEOKMA = { 申子辰: "寅", 亥卯未: "巳", 寅午戌: "申", 巳酉丑: "亥" };
  const HWAGAE = { 申子辰: "辰", 亥卯未: "未", 寅午戌: "戌", 巳酉丑: "丑" };
  for (const base of [...new Set([ps[0].ji, ps[2].ji])]) {
    for (const trio of Object.keys(T.JI_SAMHAP)) {
      if (!trio.includes(base)) continue;
      for (const [nm, c, d] of [["도화살", DOHWA[trio], "인기·매력"], ["역마살", YEOKMA[trio], "이동·활동성"], ["화개살", HWAGAE[trio], "예술·학문·종교성"]]) {
        if (branches.includes(c) && !sinsal.some((s) => s.name === nm)) sinsal.push({ name: nm, detail: `${c} — ${d}` });
      }
    }
  }

  const lacking = OHAENG.filter((o) => count[o] === 0);
  const excess = OHAENG.filter((o) => count[o] >= 3);
  const okr = T.OHAENG_KR;
  const summary = [`일간은 ${dm}(${T.GAN_KR[T.GAN.indexOf(dm)]}${okr[dmOh]})입니다. ${T.DAY_MASTER_DESC[dm]}`];
  if (nameRows.length) {
    summary.push(`사주 8자에 이름 ${nameRows.length}자(` + nameRows.map((n) => `${n.h || n.kr} ${n.element}`).join(", ")
      + `)를 더해 총 ${(ps.length === 4 ? 8 : 6) + nameRows.length}자의 오행으로 풀이했습니다.`);
  }
  summary.push(`월령은 ${mji}(${T.JI_KR[T.JI.indexOf(mji)]})월로 ${deukryeong ? "득령" : "실령"}했고, `
    + `일간을 돕는 기운의 비율은 ${pyFixed(ratio * 100, 0)}%로 '${strength}' 사주입니다.`);
  if (lacking.length) summary.push("없는 오행: " + lacking.map((o) => `${o}(${okr[o]}, ${T.OH_DESC[o]})`).join(", ") + ".");
  if (excess.length) summary.push("많은 오행: " + excess.map((o) => `${o}(${okr[o]})`).join(", ") + ".");
  summary.push(`용신은 ${yong}(${okr[yong]}, ${yongG}), 희신은 ${hee}(${okr[hee]}, ${heeG})입니다. ${why}`);
  if (johu) summary.push("조후: " + johu.why);
  summary.push("이름에는 " + needed.map((o) => `${o}(${okr[o]})`).join("·") + " 기운의 한자를 쓰는 것이 좋고, "
    + (avoid.length ? avoid.map((o) => `${o}(${okr[o]})`).join("·") + " 기운은 피하는 것이 좋습니다." : "크게 꺼리는 오행은 없습니다."));

  return {
    day_master: { gan: dm, kr: T.GAN_KR[T.GAN.indexOf(dm)], element: dmOh, yang: T.GAN_YANG[T.GAN.indexOf(dm)], desc: T.DAY_MASTER_DESC[dm] },
    pillars: pillarRows,
    element_count: count,
    element_count_saju: count8,
    name_elements: nameRows,
    basis: nameRows.length ? `사주 8자 + 이름 ${nameRows.length}자` : "사주 8자",
    element_score: Object.fromEntries(Object.entries(score).map(([k, v]) => [k, r2(v)])),
    group_score: Object.fromEntries(Object.entries(groupScore).map(([k, v]) => [k, r2(v)])),
    strength: { label: strength, ratio: pyRound(ratio, 3), deukryeong, month_god: monthGod },
    yongsin: { element: yong, group: yongG, why },
    heesin: { element: hee, group: heeG },
    gisin: { element: gi },
    gusin: { element: gu },
    hansin: { element: han },
    roles,
    johu,
    needed_elements: needed,
    avoid_elements: avoid,
    lacking,
    excess,
    relations: rels,
    sinsal,
    summary,
  };
}
