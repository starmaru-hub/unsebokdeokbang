// 운세 풀이: 성격·재물·학업·연애·건강·직업·올해·대운·이름 오행  (engine/fortune.py 이식)
import { T } from "./tables.js";
import { elementOfGroup, isJiChung, jiYukhap, tenGod, tenGodBranch, twelveStage } from "./saju.js";
import { floordiv, fsum, ganjiKr, ganjiName, isHangul, j, maxBy, mod, pyRound, sortBy, sortStr, sum } from "./util.js";

const OHAENG = [...T.OHAENG];
const OKR = T.OHAENG_KR;

function level(r) { return r >= 0.30 ? "과다" : r >= 0.15 ? "적당" : r >= 0.05 ? "약함" : "없음"; }
export const stars = (score) => Math.max(1, Math.min(5, pyRound((score - 30) / 13)));
export const clamp = (x) => Math.trunc(Math.max(35, Math.min(96, pyRound(x))));

export class Ctx {
  constructor(saju, a, gender) {
    this.s = saju; this.a = a; this.g = gender;
    this.dm = saju.dayGan;
    this.dmOh = T.GAN_OH[T.GAN.indexOf(this.dm)];
    const gs = a.group_score;
    const total = fsum(Object.values(gs)) || 1;
    this.ratio = Object.fromEntries(Object.entries(gs).map(([k, v]) => [k, v / total]));
    this.lv = Object.fromEntries(Object.entries(this.ratio).map(([k, v]) => [k, level(v)]));
    this.cnt = {};
    for (const p of saju.pillars) {
      if (p.name !== "일주") { const g = tenGod(this.dm, p.gan); this.cnt[g] = (this.cnt[g] || 0) + 1; }
      const g2 = tenGodBranch(this.dm, p.ji); this.cnt[g2] = (this.cnt[g2] || 0) + 1;
    }
    this.strong = ["신강", "극신강"].includes(a.strength.label);
    this.weak = ["신약", "극신약"].includes(a.strength.label);
    this.need = a.needed_elements;
    this.avoid = a.avoid_elements;
    this.branches = saju.pillars.map((p) => p.ji);
    this.dayJi = saju.pillars[2].ji;
    this.sinsal = new Set(a.sinsal.map((x) => x.name));
  }
  c(god) { return this.cnt[god] || 0; }
  el(group) { return elementOfGroup(this.dmOh, group); }
  fit(group) {
    const e = this.el(group);
    if (e === this.need[0]) return 12;
    if (this.need.slice(1).includes(e)) return 8;
    if (e === this.a.gisin.element) return -10;
    if (this.avoid.includes(e)) return -5;
    return 0;
  }
}

const inn = (v, arr) => arr.includes(v);

function personality(c) {
  const a = c.a;
  const top = sortBy(Object.keys(c.ratio), (k) => -c.ratio[k]);
  const [main, second] = top;
  const pts = [a.day_master.desc,
    `사주에서 가장 두드러진 기운은 ${main}(${c.lv[main]})으로, ${T.GROUP_TRAIT[main][0]}이 강합니다. `
    + `여기에 ${second}의 기운이 더해져 ${T.GROUP_TRAIT[second][0]}도 함께 지녔습니다.`];
  if (c.strong) pts.push("일간의 힘이 강해 주관이 뚜렷하고 추진력이 있습니다. 내 뜻을 밀고 나가는 힘은 장점이지만, 남의 의견을 한 번 더 들으면 더 크게 됩니다.");
  else if (c.weak) pts.push("일간이 다소 약해 섬세하고 주변을 배려하는 마음이 큽니다. 좋은 사람과 환경을 만나면 능력이 크게 꽃피는 유형입니다.");
  else pts.push("일간의 힘이 균형을 이뤄 상황에 따라 유연하게 대처하는 능력이 좋습니다.");
  const n0 = c.need[0];
  const advice = [`주의할 점: ${T.GROUP_TRAIT[main][1]}.`,
    `부족한 ${OKR[n0]}(${n0}) 기운(${T.OH_LUCK[n0].color} 계열, ${T.OH_LUCK[n0].direction})을 가까이하면 균형에 도움이 됩니다.`];
  return { key: "personality", title: "타고난 성격", hanja: "性", score: null,
    headline: `${a.day_master.gan}${OKR[c.dmOh]} 일간 · ${main} 중심의 성향`, points: pts, advice };
}

function wealth(c) {
  let score = 60 + c.fit("재성");
  const pts = [];
  const jr = c.lv["재성"], sk = c.lv["식상"], bg = c.lv["비겁"];
  const pyeon = c.c("편재"), jeong = c.c("정재");
  if (jr === "없음") {
    score -= 6;
    pts.push("사주에 재성이 드러나지 않아 돈 자체를 좇기보다 일과 명분을 따르는 편입니다. 재물은 실력과 신용을 쌓은 뒤에 따라오는 구조입니다.");
    if (inn(sk, ["적당", "과다"])) { score += 6; pts.push("다행히 식상(재능·기술)이 살아 있어 전문성과 아이디어가 곧 수입원이 됩니다."); }
  } else {
    if (c.strong && inn(jr, ["적당", "과다"])) {
      score += 12;
      pts.push("일간이 튼튼하고 재성도 갖춰 '신왕재왕(身旺財旺)'에 가까운 구조입니다. 재물을 벌고 지키는 힘이 함께 있어 재물운이 좋은 편입니다.");
    } else if (c.weak && jr === "과다") {
      score -= 8;
      pts.push("재성은 많은데 일간이 약한 '재다신약(財多身弱)'의 모습이 있습니다. 기회는 많이 오지만 감당할 체력과 관리가 관건이니, 욕심보다 지킬 수 있는 만큼만 키우는 것이 좋습니다.");
    } else {
      score += 4;
      pts.push("재성이 적당히 자리해 생활에 필요한 재물은 꾸준히 들어오는 편입니다.");
    }
    if (inn(sk, ["적당", "과다"])) { score += 6; pts.push("식상이 재성을 생하는 '식상생재(食傷生財)'의 흐름이 있어 재능과 활동이 돈으로 이어지기 쉽습니다."); }
    if (pyeon > jeong) pts.push("편재가 더 두드러져 사업·투자·영업처럼 유동적인 재물에 강하고 씀씀이도 큰 편입니다.");
    else if (jeong > pyeon) pts.push("정재가 더 두드러져 월급·저축·부동산처럼 안정적으로 모으는 재물에 강합니다.");
    else if (pyeon && jeong) pts.push("정재와 편재가 함께 있어 고정 수입과 부수입을 모두 기대할 수 있습니다.");
  }
  if (bg === "과다" && jr !== "없음") {
    score -= 8;
    pts.push("비겁이 많아 '군겁쟁재(群劫爭財)'의 기운이 있습니다. 동업·보증·돈 거래에서 손해 보기 쉬우니 명확한 계약이 필요합니다.");
  }
  if (c.fit("재성") > 0) pts.push(`재성(${c.el("재성")})이 이 사주에 필요한 기운이라 재물 활동이 운을 돕습니다.`);
  else if (c.fit("재성") < 0) pts.push(`재성(${c.el("재성")})이 이 사주에서 부담이 되는 기운이라 무리한 투자보다 안정적인 운용이 맞습니다.`);
  score = clamp(score);
  const advice = ["큰 지출과 투자는 용신 운이 들어오는 시기에 하는 것이 유리합니다."];
  if (c.c("겁재") || bg === "과다") advice.push("보증과 금전 대여는 피하고 공동 투자는 문서로 남기세요.");
  advice.push(`재물과 인연이 깊은 업종: ${T.OH_JOBS[c.need[0]]}`);
  const head = score >= 75 ? "재물을 모으고 지키는 힘이 좋습니다" : score >= 58 ? "노력한 만큼 재물이 따르는 사주입니다" : "관리와 절제가 재물의 열쇠입니다";
  return { key: "wealth", title: "재물운", hanja: "財", score, headline: head, points: pts, advice };
}

function study(c) {
  let score = 60 + floordiv(c.fit("인성"), 2);
  const pts = [];
  const ins = c.lv["인성"], gw = c.lv["관성"], sk = c.lv["식상"], jr = c.lv["재성"];
  const ok = (v) => inn(v, ["적당", "과다"]);
  if (ok(ins)) {
    score += 10;
    if (c.c("정인") >= c.c("편인")) pts.push("정인이 살아 있어 차분히 앉아 공부하는 힘과 이해력이 좋습니다. 체계적인 학습·자격 취득에 강합니다.");
    else pts.push("편인이 두드러져 직관과 응용력이 뛰어납니다. 남들이 잘 하지 않는 특수 분야나 전문 기술에서 두각을 나타냅니다.");
  } else {
    score -= 4;
    pts.push("인성이 약해 오래 앉아 외우는 방식보다 직접 해 보며 익히는 체험형 학습이 잘 맞습니다.");
  }
  if (ok(gw) && ok(ins)) { score += 10; pts.push("관성과 인성이 서로 이어지는 '관인상생(官印相生)'의 구조로 시험·공무원·승진 시험에 유리합니다."); }
  if (ok(sk)) { score += 4; pts.push("식상이 있어 표현력과 창의력이 좋아 글쓰기·발표·예체능 분야의 재능을 키우기 좋습니다."); }
  if (jr === "과다" && ins !== "과다") { score -= 8; pts.push("재성이 강해 인성을 누르는 '재극인(財剋印)'의 모습이 있어 공부 중 다른 관심사로 집중이 흐트러지기 쉽습니다."); }
  if (c.branches.includes(T.MUNCHANG[c.dm])) { score += 6; pts.push(`학문과 글재주의 별인 문창귀인(${T.MUNCHANG[c.dm]})이 있어 총명함이 돋보입니다.`); }
  if (c.sinsal.has("화개살")) { score += 3; pts.push("화개살이 있어 학문·예술·종교처럼 깊이 파고드는 분야에 몰입하는 힘이 있습니다."); }
  score = clamp(score);
  const n0 = c.need[0];
  const advice = [`책상은 ${T.OH_LUCK[n0].direction} 방향, 공부방 소품은 ${T.OH_LUCK[n0].color} 계열이 좋습니다.`];
  if (inn(ins, ["약함", "없음"])) advice.push("짧게 끊어 반복하는 학습법과 스터디 그룹처럼 함께하는 방식이 효과적입니다.");
  const head = score >= 75 ? "시험과 학업에 강한 사주입니다" : score >= 58 ? "꾸준함이 성적을 만드는 사주입니다" : "자신에게 맞는 학습법이 중요합니다";
  return { key: "study", title: "학업 · 시험운", hanja: "學", score, headline: head, points: pts, advice };
}

const SPOUSE = { 정재: "알뜰하고 현실적인 배우자", 편재: "활동적이고 씀씀이가 큰 배우자", 정관: "반듯하고 책임감 있는 배우자",
  편관: "카리스마 있고 강한 배우자", 정인: "자상하고 나를 챙겨 주는 배우자", 편인: "독특하고 생각이 깊은 배우자",
  식신: "온화하고 여유로운 배우자", 상관: "재치 있고 표현이 분명한 배우자", 비견: "친구 같은 동반자형 배우자", 겁재: "개성이 강하고 주관이 뚜렷한 배우자" };

function love(c) {
  const male = c.g === "M";
  const star = male ? "재성" : "관성";
  const starKr = male ? "아내·여자친구의 별인 재성" : "남편·남자친구의 별인 관성";
  let score = 60 + floordiv(c.fit(star), 2);
  const pts = [];
  const lv = c.lv[star];
  if (lv === "없음") { score -= 6; pts.push(`사주에 ${starKr}이 드러나지 않아 연애에 소극적이거나 인연이 늦게 무르익는 편입니다. 서두르기보다 자연스러운 만남이 좋습니다.`); }
  else if (lv === "과다") pts.push(`${starKr}이 많아 이성의 관심을 많이 받고 인연도 다양합니다. 그만큼 선택이 어려우니 한 사람에게 집중하는 것이 중요합니다.`);
  else { score += 8; pts.push(`${starKr}이 알맞게 자리해 자연스럽게 좋은 인연을 만나는 구조입니다.`); }
  const [a, b] = male ? ["정재", "편재"] : ["정관", "편관"];
  if (c.c(a) && c.c(b)) {
    score -= 4;
    pts.push(`${j(a, "과/와")} ${j(b, "이/가")} 함께 있어 마음이 가는 인연이 여럿일 수 있습니다. 진지한 관계와 가벼운 관계를 분명히 구분하는 것이 좋습니다.`);
  }
  const dayGod = tenGodBranch(c.dm, c.dayJi);
  pts.push(`배우자 자리인 일지에 ${j(dayGod, "이/가")} 있어 ${SPOUSE[dayGod]}와 인연이 깊습니다.`);
  const clash = c.s.pillars.filter((p) => p.name !== "일주" && isJiChung(p.ji, c.dayJi)).map((p) => p.name);
  if (clash.length) { score -= 8; pts.push(`일지가 ${clash.join(", ")}와 충(沖)하여 배우자 자리가 흔들리기 쉽습니다. 서로의 생활 방식을 존중하고 대화로 조율하는 노력이 필요합니다.`); }
  const harm = c.s.pillars.filter((p) => p.name !== "일주" && jiYukhap(p.ji, c.dayJi)).map((p) => p.name);
  if (harm.length) { score += 5; pts.push("일지가 다른 기둥과 합(合)을 이뤄 정이 깊고 관계를 오래 이어 가는 힘이 있습니다."); }
  if (c.sinsal.has("도화살")) { score += 4; pts.push("도화살이 있어 매력이 돋보이고 이성에게 인기가 많습니다."); }
  if (!male && c.lv["식상"] === "과다") { score -= 4; pts.push("식상이 강해 할 말은 하는 성격이라 상대와 의견 충돌이 생길 수 있습니다. 부드러운 표현이 관계를 지킵니다."); }
  if (male && c.lv["비겁"] === "과다") { score -= 4; pts.push("비겁이 많아 연애에서 경쟁자가 생기거나 자존심 싸움이 될 수 있습니다."); }
  score = clamp(score);
  const advice = [`인연을 만나기 좋은 곳은 ${T.OH_LUCK[c.el(star)].direction} 방향, 좋은 계절은 ${T.OH_LUCK[c.need[0]].season}입니다.`,
    "대운이나 올해 운에서 배우자 별이 들어오는 시기에 인연이 깊어지기 쉽습니다."];
  const head = score >= 72 ? "좋은 인연을 만나는 힘이 있습니다" : score >= 56 ? "노력과 대화로 사랑이 깊어지는 사주입니다" : "서두르지 않는 인연이 좋습니다";
  return { key: "love", title: "연애 · 결혼운", hanja: "緣", score, headline: head, points: pts, advice };
}

function health(c) {
  const sc = c.a.element_score;
  const total = fsum(Object.values(sc)) || 1;
  let score = 70;
  const pts = [], advice = [];
  const weak = OHAENG.filter((o) => sc[o] / total < 0.08);
  const strong = OHAENG.filter((o) => sc[o] / total > 0.32);
  for (const o of weak) {
    score -= 6;
    pts.push(`${o}(${OKR[o]}) 기운이 부족해 ${T.OH_ORGAN[o][0]} 쪽이 약해지기 쉽습니다. 특히 ${T.OH_ORGAN[o][1]}에 신경 쓰세요.`);
    advice.push(`${OKR[o]}(${o}) 보강: ${T.OH_CARE[o]}`);
  }
  for (const o of strong) {
    score -= 5;
    const v = T.GEUK[o];
    pts.push(`${o}(${OKR[o]}) 기운이 지나치게 강해 ${T.OH_ORGAN[o][0]}에 과부하가 걸리기 쉽고, `
      + `이 기운이 누르는 ${v}(${OKR[v]})의 ${T.OH_ORGAN[v][0]}도 함께 살펴야 합니다.`);
  }
  if (!weak.length && !strong.length) { score += 8; pts.push("오행이 비교적 고르게 분포해 타고난 체질이 무난하고 회복력이 좋은 편입니다."); }
  if (c.weak) { score -= 4; pts.push("일간이 약한 편이라 무리하면 쉽게 지칠 수 있습니다. 휴식과 수면을 꾸준히 챙기세요."); }
  else if (c.a.strength.label === "극신강") pts.push("기운이 강해 체력은 좋지만 과로를 과신하기 쉽습니다. 정기 검진으로 미리 관리하세요.");
  score = clamp(score);
  if (!advice.length) advice.push(T.OH_CARE[c.need[0]]);
  const head = score >= 75 ? "체질이 튼튼하고 회복력이 좋습니다" : score >= 58 ? "타고난 약점만 관리하면 무난합니다" : "꾸준한 건강 관리가 필요한 사주입니다";
  return { key: "health", title: "건강운", hanja: "健", score, headline: head, points: pts, advice };
}

const FIELDS = {
  비겁: "독립 사업·프리랜서·스포츠·영업처럼 스스로 주도하는 일",
  식상: "기획·콘텐츠·예술·요리·교육·서비스처럼 재능을 표현하는 일",
  재성: "사업·금융·유통·무역·관리처럼 돈과 사람을 다루는 일",
  관성: "공무원·대기업·법조·군경·관리직처럼 조직과 원칙이 있는 일",
  인성: "연구·교육·의료·상담·문서·자격 전문직처럼 지식을 쓰는 일",
};
function career(c) {
  const top = maxBy(Object.keys(c.ratio), (k) => c.ratio[k]);
  let score = 60;
  const n0 = c.need[0];
  const pts = [`사주의 중심 기운이 ${top}이라 ${FIELDS[top]}에서 능력이 잘 발휘됩니다.`,
    `용신 ${j(`${n0}(${OKR[n0]})`, "과/와")} 어울리는 분야는 ${T.OH_JOBS[n0]} 등입니다.`];
  const ok = (v) => inn(v, ["적당", "과다"]);
  if (ok(c.lv["관성"]) && ok(c.lv["인성"])) { score += 12; pts.push("관성과 인성이 함께 있어 조직 안에서 인정받고 승진하는 힘이 좋습니다."); }
  if (ok(c.lv["식상"]) && ok(c.lv["재성"])) { score += 10; pts.push("식상과 재성이 이어져 내 아이디어를 사업이나 수익으로 연결하는 능력이 있습니다."); }
  if (c.c("상관") && c.c("정관")) { score -= 6; pts.push("상관과 정관이 함께 있어 틀에 박힌 조직 생활에 답답함을 느낄 수 있습니다. 자율성이 보장되는 환경이 더 맞습니다."); }
  if (c.sinsal.has("역마살")) pts.push("역마살이 있어 이동·출장·해외와 관련된 일에서 기회가 많습니다.");
  score = clamp(score + floordiv(c.fit("관성"), 2));
  const advice = [`추천 분야: ${T.OH_JOBS[n0]}` + (c.need.length > 1 ? `, ${T.OH_JOBS[c.need[1]]}` : "")];
  const head = score >= 75 ? "조직과 사업 모두에서 성장할 힘이 있습니다" : "적성에 맞는 분야를 찾으면 크게 성장합니다";
  return { key: "career", title: "직업 · 적성", hanja: "業", score, headline: head, points: pts, advice };
}

export function luckPeriod(c, gan, ji, label) {
  const gGod = tenGod(c.dm, gan);
  const jGod = tenGodBranch(c.dm, ji);
  const gOh = T.GAN_OH[T.GAN.indexOf(gan)], jOh = T.JI_OH[T.JI.indexOf(ji)];
  let score = 60;
  for (const [o, w] of [[gOh, 1.0], [jOh, 1.2]]) {
    if (o === c.need[0]) score += 12 * w;
    else if (c.need.includes(o)) score += 7 * w;
    else if (o === c.a.gisin.element) score -= 10 * w;
    else if (c.avoid.includes(o)) score -= 5 * w;
  }
  const jkr = `${ji}(${T.JI_KR[T.JI.indexOf(ji)]})`;
  const pts = [`${j(label, "은/는")} 천간 ${j(`${gan}(${gGod})`, "과/와")} 지지 ${ji}(${jGod})의 기운이 들어옵니다. ${T.GOD_YEAR[gGod]}`];
  const good = [gOh, jOh].filter((o) => c.need.includes(o));
  const bad = [gOh, jOh].filter((o) => c.avoid.includes(o));
  if (good.length) pts.push(`이 사주에 필요한 ${sortStr([...new Set(good)]).join("·")} 기운이 들어와 전반적으로 운이 힘을 받습니다.`);
  if (bad.length) pts.push(`부담이 되는 ${sortStr([...new Set(bad)]).join("·")} 기운도 함께 들어오니 무리한 확장은 삼가는 것이 좋습니다.`);
  if (isJiChung(ji, c.dayJi)) {
    score -= 6;
    pts.push(`${j(jkr, "이/가")} 일지 ${c.dayJi}와 충(沖)하여 이사·이직·관계 변화 등 움직임이 많을 수 있습니다. 건강과 배우자 관계를 함께 챙기세요.`);
  }
  if (isJiChung(ji, c.s.pillars[1].ji)) pts.push(`${j(jkr, "이/가")} 월지 ${c.s.pillars[1].ji}와 충하여 직장·가정 환경에 변화가 생길 수 있습니다.`);
  if (jiYukhap(ji, c.dayJi)) { score += 4; pts.push("지지가 일지와 합을 이뤄 좋은 인연과 협력이 따르기 쉽습니다."); }
  return [clamp(score), pts, gGod];
}

function thisYear(c, year) {
  const k = mod(year - 4, 60);
  const [score, pts] = luckPeriod(c, T.GAN[k % 10], T.JI[k % 12], `${year}년 ${ganjiName(k)}(${ganjiKr(k)})년`);
  const n0 = c.need[0];
  const advice = [`올해의 행운 색은 ${T.OH_LUCK[n0].color}, 방향은 ${T.OH_LUCK[n0].direction}입니다.`];
  const head = score >= 75 ? "기회를 크게 잡을 수 있는 해입니다" : score >= 56 ? "차근차근 쌓아 가면 좋은 시기입니다" : "내실을 다지고 건강을 챙길 해입니다";
  return { key: "year", title: `${year}년 운세`, hanja: "歲", score, headline: head, points: pts, advice, ganji: ganjiName(k), kr: ganjiKr(k) };
}

function daewoonCat(c, year) {
  const dws = c.s.daewoon.list;
  let cur = null;
  for (let i = 0; i < dws.length; i++) {
    const nxt = i + 1 < dws.length ? dws[i + 1].year : 1e6;
    if (dws[i].year <= year && year < nxt) { cur = dws[i]; break; }
  }
  const flow = dws.map((d) => ({ age: d.age, year: d.year, ganji: d.ganji, score: luckPeriod(c, d.ganji[0], d.ganji[1], "")[0] }));
  if (!cur) {
    const st = dws[0];
    return { key: "daewoon", title: "대운 흐름", hanja: "運", score: null,
      headline: `${st.age}세(${st.year}년)부터 첫 대운이 시작됩니다`,
      points: ["아직 첫 대운이 시작되기 전으로, 이 시기에는 타고난 사주(원국)와 해마다의 운이 중심이 됩니다."],
      advice: [], flow };
  }
  const [score, pts] = luckPeriod(c, cur.ganji[0], cur.ganji[1], `현재 대운 ${cur.ganji}(${cur.kr}, ${cur.age}세~)`);
  let ahead = flow.filter((x) => x.year >= cur.year);
  if (!ahead.length) ahead = flow;
  const best = maxBy(ahead, (x) => x.score);
  pts.push(`앞으로의 대운 중 가장 힘이 실리는 시기는 ${best.age}세 무렵(${best.year}년~) ${best.ganji} 대운입니다.`);
  const head = score >= 72 ? "현재 대운이 순풍입니다" : score >= 56 ? "현재 대운은 무난한 흐름입니다" : "현재 대운은 내실을 다질 시기입니다";
  return { key: "daewoon", title: "대운 흐름", hanja: "運", score, headline: head, points: pts, advice: [], flow };
}

// ── 대운·세운 상세 ─────────────────────────────────
export function period(c, gan, ji, kind) {
  const [score, , gGod] = luckPeriod(c, gan, ji, "");
  const jGod = tenGodBranch(c.dm, ji);
  const gOh = T.GAN_OH[T.GAN.indexOf(gan)], jOh = T.JI_OH[T.JI.indexOf(ji)];
  const stage = twelveStage(c.dm, ji);
  const t = [];
  if (kind === "dw") {
    t.push(`전반 5년은 천간 ${gan}(${gGod})의 영향으로 ${j(T.GOD_KEYWORDS[gGod], "이/가")} 삶의 중심 주제가 됩니다. ${T.GOD_YEAR[gGod]}`);
    t.push(`후반 5년은 지지 ${ji}(${jGod})의 영향이 커져 ${T.GOD_LIFE[jGod]}`);
  } else {
    t.push(`${T.GOD_YEAR[gGod]} 생활 면에서는 ${T.GOD_LIFE[jGod]}`);
  }
  t.push(`일간에게는 12운성 '${stage}'에 해당하는 ${T.STAGE_ENERGY[stage]} 시기입니다.`);
  const good = sortStr([...new Set([gOh, jOh].filter((o) => c.need.includes(o)))]);
  const bad = sortStr([...new Set([gOh, jOh].filter((o) => c.avoid.includes(o)))]);
  if (good.length && !bad.length) t.push(`사주에 필요한 ${good.map((o) => `${o}(${OKR[o]})`).join("·")} 기운이 들어와 하는 일에 힘이 실립니다.`);
  else if (bad.length && !good.length) t.push(`사주에 부담이 되는 ${bad.map((o) => `${o}(${OKR[o]})`).join("·")} 기운이 들어오니 확장보다 수비가 좋습니다.`);
  else if (good.length && bad.length) t.push(`도움이 되는 ${good.join("·")} 기운과 부담이 되는 ${bad.join("·")} 기운이 섞여 길흉이 교차합니다.`);
  if (isJiChung(ji, c.dayJi)) t.push("일지와 충(沖)하여 이사·이직·관계 변화가 생기기 쉽고, 배우자·건강을 특히 챙겨야 합니다.");
  else if (jiYukhap(ji, c.dayJi)) t.push("일지와 합(合)하여 좋은 인연·협력자가 생기고 가정에 화목한 일이 따릅니다.");
  if (isJiChung(ji, c.s.pillars[1].ji)) t.push("월지와 충하여 직장·부모·생활 환경에 변화가 있을 수 있습니다.");
  const lv = T.LOVE_GOD[c.g] || [];
  if (lv.includes(gGod) || lv.includes(jGod)) t.push("배우자 별이 들어와 연애·결혼 인연이 깊어지기 좋은 때입니다.");
  if (T.MUNCHANG[c.dm] === ji || gGod === "정인" || jGod === "정인") t.push("공부·시험·자격증에 유리합니다.");
  const keys = sortStr([...new Set([T.GOD_KEYWORDS[gGod].split("·")[0], T.GOD_KEYWORDS[jGod].split("·")[0]])]);
  const lvl = score >= 80 ? "대길" : score >= 68 ? "길" : score >= 55 ? "평" : "주의";
  return { ganji: gan + ji, gods: [gGod, jGod], stage, score, level: lvl, keywords: keys, elements: [gOh, jOh], text: t };
}

export function daewoonDetail(c, year) {
  const dws = c.s.daewoon.list;
  return dws.map((d, i) => {
    const nxt = i + 1 < dws.length ? dws[i + 1].year : d.year + 10;
    return { ...period(c, d.ganji[0], d.ganji[1], "dw"),
      age: d.age, age_end: d.age + 9, year: d.year, year_end: nxt - 1, kr: d.kr, current: d.year <= year && year < nxt, past: nxt <= year };
  });
}

export function seunDetail(c, year, n = 10) {
  const birthYear = Number(c.s.solar_date.slice(0, 4));
  const yearJi = c.s.pillars[0].ji;
  const samjae = Object.entries(T.SAMJAE).find(([k]) => k.includes(yearJi))[1];
  const out = [];
  for (let y = year; y < year + n; y++) {
    const k = mod(y - 4, 60);
    const p = period(c, T.GAN[k % 10], T.JI[k % 12], "sw");
    if (samjae.includes(T.JI[k % 12])) {
      const idx = samjae.indexOf(T.JI[k % 12]);
      const nm = ["들삼재", "눌삼재", "날삼재"][idx];
      p.text.push(`띠 기준 삼재(${nm})에 해당합니다. 큰 결정은 신중히 하고 건강·안전에 유의하세요.`);
      p.samjae = nm;
    }
    Object.assign(p, { year: y, age: y - birthYear + 1, kr: ganjiKr(k), current: y === year });
    out.push(p);
  }
  return out;
}

// ── 이름 오행 ─────────────────────────────────────
export function nameOhaeng(c, nameKr, nameHanja, db, naming) {
  nameKr = (nameKr || "").trim();
  if ([...nameKr].length < 2 || ![...nameKr].every(isHangul)) return null;
  const chars0 = [...nameKr];
  const two = db.surnames.some((s) => [...s.kr].length === 2 && s.kr === chars0.slice(0, 2).join(""));
  const surLen = (two && chars0.length >= 3) || chars0.length >= 4 ? 2 : 1;
  const hanja = [...(nameHanja || "")];
  const chars = chars0.map((ch, i) => {
    const h = i < hanja.length && hanja[i].trim() ? hanja[i] : null;
    const e = h ? db.char(h, ch) : null;
    return { kr: ch, h: e ? e.h : (h || ""), m: e ? e.m : "", won: e ? e.won : null,
      sound: naming.soundElement(ch), jawon: e ? e.jw : null, is_surname: i < surLen };
  });
  const pts = [];
  for (const x of chars) {
    const el = x.sound;
    if (x.is_surname) { x.role = "성"; continue; }
    if (el === c.need[0]) x.role = "용신";
    else if (c.need.includes(el)) x.role = el === c.a.heesin.element ? "희신" : "조후";
    else if (el === c.a.gisin.element) x.role = "기신";
    else if (c.avoid.includes(el)) x.role = "구신";
    else x.role = "한신";
  }
  const given = chars.filter((x) => !x.is_surname);
  const lab = (x) => (x.h ? `${x.h}(${x.kr})` : x.kr);
  pts.push(`이름 '${nameKr}'의 발음오행(소리의 오행)은 ` + given.map((x) => `${lab(x)} ${x.sound}`).join(", ") + "입니다.");
  const good = given.filter((x) => ["용신", "희신", "조후"].includes(x.role));
  const bad = given.filter((x) => ["기신", "구신"].includes(x.role));
  const cnt = (roles) => given.filter((x) => roles.includes(x.role)).length;
  let score = 60 + 12 * cnt(["용신"]) + 8 * cnt(["희신", "조후"]) - 10 * cnt(["기신"]) - 5 * cnt(["구신"]);
  if (good.length) pts.push(`${j(good.map(lab).join(", "), "이/가")} 사주에 필요한 ${sortStr([...new Set(good.map((x) => x.sound))]).join("·")} 기운을 채워 줍니다. 이름이 사주의 부족한 부분을 보완하는 좋은 구성입니다.`);
  if (bad.length) pts.push(`${j(bad.map(lab).join(", "), "은/는")} 사주에 부담이 되는 ${sortStr([...new Set(bad.map((x) => x.sound))]).join("·")} 기운이라 아쉬움이 있습니다.`);
  if (!good.length && !bad.length) pts.push("이름의 오행이 사주에 크게 도움이 되지도, 해가 되지도 않는 중립적인 구성입니다.");
  const combined = { ...(c.a.element_count_saju || c.a.element_count) };
  for (const x of given) combined[x.sound] += 1;
  const filled = OHAENG.filter((o) => c.a.element_count[o] === 0 && combined[o] > 0);
  if (filled.length) pts.push(`사주에 없던 ${filled.map((o) => `${o}(${OKR[o]})`).join("·")} 기운을 이름이 채워 줍니다.`);
  const snd = chars.map((x) => x.sound);
  const rels = snd.slice(0, -1).map((s, i) => naming.pairRelation(s, snd[i + 1]));
  pts.push("발음오행 흐름은 " + chars.map((x) => `${x.kr}(${OKR[x.sound]})`).join(" → ")
    + (!rels.includes("상극") ? " 으로 막힘 없이 이어집니다." : " 으로 일부 상극이 있어 소리의 흐름에 부딪힘이 있습니다."));
  if (rels.includes("상극")) score -= 5;
  let grids = null;
  if (chars.every((x) => x.won)) {
    grids = naming.fourGrids(chars.filter((x) => x.is_surname).map((x) => x.won), given.map((x) => x.won));
    const badG = Object.values(grids).filter((g) => g.level === 0).map((g) => g.label);
    pts.push(!badG.length ? "수리 4격이 모두 길수입니다." : `수리 흉수: ${badG.join(", ")}.`);
    score += !badG.length ? 6 : -4 * badG.length;
  } else {
    pts.push("한자를 모두 입력하면 수리 4격까지 볼 수 있습니다.");
  }
  score = clamp(score);
  const advice = good.length ? [] : [`이름이나 호(號)·닉네임에 ${c.need.slice(0, 2).map((o) => `${o}(${OKR[o]})`).join("·")} 기운의 글자를 쓰면 보완이 됩니다.`];
  const head = score >= 72 ? "이름이 사주를 잘 보완합니다" : score >= 56 ? "이름과 사주의 조화가 무난합니다" : "이름이 사주를 충분히 돕지 못합니다";
  return { key: "name", title: "이름 오행", hanja: "名", score, headline: head, points: pts, advice, chars, combined, grids, basis: "sound" };
}

export function interpret(saju, analysis, gender, { year = null, nameKr = null, nameHanja = null, question = null, db = null, naming = null, answer = null } = {}) {
  year = year || new Date().getFullYear();
  const c = new Ctx(saju, analysis, gender);
  const cats = [personality(c)];
  const nm = nameKr ? nameOhaeng(c, nameKr, nameHanja, db, naming) : null;
  if (nm) cats.push(nm);
  cats.push(wealth(c), study(c), love(c), health(c), career(c), thisYear(c, year), daewoonCat(c, year));
  for (const x of cats) x.stars = x.score != null ? stars(x.score) : null;
  const scored = cats.filter((x) => x.score != null && !["year", "daewoon", "name"].includes(x.key)).map((x) => x.score);
  const n0 = c.need[0];
  const res = {
    year, overall: pyRound(sum(scored) / scored.length), categories: cats,
    daewoon: daewoonDetail(c, year), seun: seunDetail(c, year),
    lucky: { element: n0, element_kr: OKR[n0], ...T.OH_LUCK[n0] },
  };
  if (question && question.trim() && answer) res.question = answer(c, res, question, year);
  return res;
}
