// 사용자 질문 풀이: 질문에서 주제·시기를 찾아 그 분야를 중점 분석  (engine/question.py 이식)
import { T } from "./tables.js";
import { period } from "./fortune.js";
import { isJiChung } from "./saju.js";
import { ganjiKr, ganjiName, j, maxBy, minBy, mod, pyRound, sortBy } from "./util.js";

const TOPIC_KEYS = Object.keys(T.Q_TOPICS);

export function detect(question, year) {
  const q = question.replaceAll(" ", "");
  const topics = TOPIC_KEYS.filter((k) => T.Q_TOPICS[k][2].some((kw) => q.includes(kw)));
  const years = [...new Set((question.match(/(20\d\d|19\d\d)/g) || []).map(Number))].sort((a, b) => a - b);
  if (q.includes("올해") || q.includes("금년") || q.includes("이번해")) years.push(year);
  if (q.includes("내년")) years.push(year + 1);
  if (q.includes("내후년") || q.includes("후년")) years.push(year + 2);
  const when = ["언제", "몇년", "몇살", "시기", "때가", "타이밍"].some((w) => q.includes(w));
  return [topics, [...new Set(years)].sort((a, b) => a - b), when];
}

function topicYear(c, topic, y) {
  const k = mod(y - 4, 60);
  const gan = T.GAN[k % 10], ji = T.JI[k % 12];
  const p = period(c, gan, ji, "sw");
  let sc = p.score;
  const notes = [];
  const good = new Set(T.Q_GOOD[topic]), bad = new Set(T.Q_BAD[topic]);
  if (topic === "love") {
    (c.g === "M" ? ["정재", "편재"] : ["정관", "편관"]).forEach((g) => good.add(g));
    (c.g === "M" ? ["겁재"] : ["상관"]).forEach((g) => bad.add(g));
  }
  if (topic === "family") (c.g === "F" ? ["식신"] : ["정관", "편관"]).forEach((g) => good.add(g));
  const txt = T.Q_GOD_TOPIC_TEXT[topic];
  for (const g of p.gods) {
    if (good.has(g)) { sc += 8; notes.push((txt[g] ?? "도움이 되는") + ` ${g}`); }
    else if (bad.has(g)) { sc -= 8; notes.push((txt[g] ?? "조심할") + ` ${g}`); }
  }
  const chung = isJiChung(ji, c.dayJi);
  if (topic === "move" && (chung || ji === T.Q_YEOKMA[c.s.pillars[0].ji])) { sc += 8; notes.push("이동·변화의 기운(충·역마)"); }
  else if ((topic === "love" || topic === "health") && chung) { sc -= 8; notes.push("배우자 자리(일지)와 충"); }
  sc = Math.trunc(Math.max(30, Math.min(98, pyRound(sc))));
  const level = sc >= 82 ? "대길" : sc >= 68 ? "길" : sc >= 55 ? "평" : "주의";
  return { year: y, ganji: ganjiName(k), kr: ganjiKr(k), score: sc, level, gods: p.gods, notes, elements: p.elements };
}

function topicLine(topic, ty) {
  let base = `${ty.year}년 ${ty.ganji}(${ty.kr})년은 ${T.Q_TOPICS[topic][0]} 면에서 '${ty.level}'(${ty.score}점)입니다.`;
  if (ty.notes.length) base += " " + ty.notes.slice(0, 2).map((n) => n.slice(0, n.lastIndexOf(" "))).join(", ") + " 기운이 들어옵니다.";
  return base;
}

export function answer(c, fortune, question, year) {
  question = (question || "").trim();
  let [topics, years, when] = detect(question, year);
  const cats = Object.fromEntries(fortune.categories.map((x) => [x.key, x]));
  const catOf = { wealth: "wealth", career: "career", love: "love", health: "health", study: "study" };
  if (!topics.length) topics = ["general"];
  const sections = [];
  for (const t of topics.slice(0, 3)) {
    if (t === "general") {
      const yc = cats.year;
      const pts = ["질문에서 특정 분야(재물·직장·연애·건강·시험·이사·자녀·인간관계)를 찾지 못해 전체 흐름을 중심으로 풀이합니다.",
        yc ? `올해 운은 ${yc.score}점 — ${yc.headline}.` : ""];
      sections.push({ key: "general", title: "전체 흐름", hanja: "總", points: pts.filter(Boolean) });
      continue;
    }
    const [title, hz] = T.Q_TOPICS[t];
    const pts = [];
    const base = cats[catOf[t] || ""];
    if (base) pts.push(`타고난 ${title}: ${base.headline}. ` + base.points.slice(0, 2).join(" "));
    else if (t === "move") pts.push(c.sinsal.has("역마살") ? "역마살이 있어 이동·해외와 인연이 깊습니다." : "사주에 역마의 기운이 강하지 않아 잦은 이동보다 한곳에 뿌리내릴 때 안정됩니다.");
    else if (t === "family") {
      const star = c.g === "F" ? "식상" : "관성";
      pts.push(`자녀를 뜻하는 별(${star})은 사주에서 '${c.lv[star]}' 수준이며, 부모를 뜻하는 인성은 '${c.lv["인성"]}' 수준입니다.`);
    } else if (t === "people") {
      pts.push(`동료·친구를 뜻하는 비겁은 '${c.lv["비겁"]}', 귀인을 뜻하는 인성은 '${c.lv["인성"]}' 수준입니다.`
        + (c.sinsal.has("천을귀인") ? " 천을귀인이 있어 어려울 때 돕는 사람이 나타납니다." : ""));
    }
    if (t === "health") {
      const weak = Object.keys(T.OHAENG_KR).filter((o) => c.a.element_count[o] === 0);
      if (weak.length) pts.push("특히 " + weak.map((o) => `${o}(${T.Q_HEALTH_ORGAN[o]})`).join(", ") + " 쪽을 꾸준히 살피세요.");
    }
    const cur = (fortune.daewoon || []).find((d) => d.current) || null;
    if (cur) {
      const txt = T.Q_GOD_TOPIC_TEXT[t];
      const hits = cur.gods.filter((g) => txt[g]).map((g) => txt[g]);
      pts.push(j(`현재 대운 ${cur.ganji}(${cur.age}~${cur.age_end}세)`, "은/는") + " "
        + (hits.length ? `${hits.join(", ")} 시기로 ${title}에 직접 영향을 줍니다.` : `${title}에 큰 변화를 주기보다 기본 흐름을 따르는 시기입니다.`));
    }
    const ask = years.length ? years : (when ? [] : [year]);
    for (const y of ask.slice(0, 3)) pts.push(topicLine(t, topicYear(c, t, y)));
    const span = [];
    for (let y = year; y < year + 10; y++) span.push(topicYear(c, t, y));
    const best = sortBy(span, (x) => -x.score).slice(0, 3);
    const caution = sortBy(span, (x) => x.score).filter((x) => x.score < 55).slice(0, 2);
    pts.push(`앞으로 10년 중 ${title}에 가장 좋은 해는 ` + best.map((x) => `${x.year}년(${x.ganji}, ${x.score}점)`).join(", ") + "입니다.");
    if (caution.length) pts.push("조심할 해는 " + caution.map((x) => `${x.year}년(${x.ganji})`).join(", ") + "입니다.");
    sections.push({ key: t, title, hanja: hz, points: pts, years: span, advice: T.Q_TOPIC_ADVICE[t] });
  }
  const luck = T.OH_LUCK[c.need[0]];
  let head;
  if (topics.length === 1 && topics[0] === "general") head = "전체 운의 흐름을 중심으로 풀이했습니다";
  else {
    const parts = [];
    for (const s of sections) {
      const ys = s.years;
      if (years.length) {
        const ty = topicYear(c, s.key, years[0]);
        parts.push(`${years[0]}년 ${s.title} '${ty.level}'`);
      }
      if (when || !years.length) {
        if (s.key === "health") parts.push(`건강은 ${minBy(ys, (x) => x.score).year}년을 특히 조심`);
        else parts.push(`${s.title} 최적기 ${maxBy(ys, (x) => x.score).year}년`);
      }
    }
    head = [...new Set(parts)].join(" · ");
  }
  return {
    question, topics: sections.map((s) => s.title), years, when, headline: head, sections,
    advice: sections.filter((s) => s.advice).map((s) => s.advice)
      .concat([`행운의 기운은 ${c.need[0]}(${T.OHAENG_KR[c.need[0]]}) — ${luck.color} 색, ${luck.direction} 방향이 도움이 됩니다.`]),
  };
}
