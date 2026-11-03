/* 성명 감정서 · 사주 해설서 — 새 창에 A4 문서로 띄우고 PDF(인쇄)·HTML로 저장 */
(function () {
  const SITE_NAME = (window.SITE && window.SITE.name) || "운세복덕방";
  const LOGO = new URL("img/logo.png", document.baseURI).href;   // 새 창(about:blank)에서도 보이도록 절대 주소
  const OH_KR = { 木: "목", 火: "화", 土: "토", 金: "금", 水: "수" };
  const OH_NAME = { 木: "나무", 火: "불", 土: "흙", 金: "쇠", 水: "물" };
  const OH_TRAIT = { 木: "성장과 인자함, 기획력", 火: "열정과 표현력, 예의", 土: "신용과 포용, 안정감", 金: "결단과 의리, 실행력", 水: "지혜와 유연함, 통찰력" };
  const GRID_PERIOD = { won: "초년운 (출생~20세 무렵)", hyeong: "청년운 (20~40세 무렵)", i: "중년운 (40~60세 무렵)", jeong: "총운·말년운 (평생, 특히 60세 이후)" };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // "불을 윤/윤택할" → "불을" (첫 뜻만, 끝에 붙은 음 제거)
  const first = (m) => String(m || "").split(/[\/,]/)[0].trim().replace(/\s+[가-힣](\([가-힣]\))?$/, "");
  const ohw = (o) => `${o}(${OH_KR[o]})`;

  function grade(score) {
    if (score >= 90) return ["最上", "최상", "사주와 성명학 원리 전반에 걸쳐 매우 잘 어울리는 이름입니다."];
    if (score >= 80) return ["優秀", "우수", "사주를 잘 보완하며 성명학적으로 흠잡을 곳이 적은 좋은 이름입니다."];
    if (score >= 65) return ["良好", "양호", "대체로 무난하며 일부 항목만 보완하면 더욱 좋아지는 이름입니다."];
    if (score >= 50) return ["普通", "보통", "장점과 단점이 함께 있어 아쉬운 항목을 살펴볼 필요가 있는 이름입니다."];
    return ["再考", "재검토", "사주 보완이나 수리 측면에서 아쉬움이 커 다른 한자나 이름을 함께 검토해 보시길 권합니다."];
  }

  const roleText = {
    용신: (o) => `사주에 가장 필요한 ${ohw(o)} 기운을 직접 채워 주는 글자로, 이름의 핵심 역할을 합니다.`,
    희신: (o) => `용신을 돕는 ${ohw(o)} 기운으로, 사주의 균형을 한층 든든하게 받쳐 줍니다.`,
    조후: (o) => `사주의 차고 더움을 조절하는 ${ohw(o)} 기운으로, 계절의 치우침을 부드럽게 해 줍니다.`,
    한신: (o) => `${ohw(o)} 기운은 이 사주에서 크게 돕지도 해치지도 않는 중립적인 기운입니다.`,
    구신: (o) => `${ohw(o)} 기운은 사주에 다소 부담이 되는 쪽이라 아쉬움이 있습니다.`,
    기신: (o) => `${ohw(o)} 기운은 이 사주에서 피하면 좋은 기운이라 보완이 필요합니다.`,
  };

  function meta(s) {
    const i = s.input;
    const time = s.hour_known ? s.standard_time.replace(/\s*\(.*\)/, "") : `${s.solar_date} (시간 미상)`;
    return {
      gender: i.gender === "F" ? "여성" : "남성",
      birth: `${i.calendar === "lunar" ? `음력 ${i.year}.${i.month}.${i.day}${i.leap_month ? "(윤달)" : ""} / 양력 ` : "양력 "}${time}`,
      lunar: s.lunar.text || "",
      region: i.region,
      solar: s.hour_known ? `${s.correction_minutes > 0 ? "+" : ""}${s.correction_minutes}분 보정 → 태양시 ${s.solar_time}` : "시주 미상 (삼주 분석)",
    };
  }

  function sajuTable(s, a) {
    const order = [0, 1, 2, 3]; // 년 월 일 시
    const cell = (i, key) => {
      const p = s.pillars[i];
      if (!p) return `<td class="na">–</td>`;
      const o = key === "gan" ? p.gan_oh : p.ji_oh;
      return `<td><span class="gz c-${o}">${p[key]}</span><small>${p[key + "_kr"]} · ${o}</small></td>`;
    };
    const godRow = (k) => order.map((i) => `<td class="g">${a.pillars[i] ? esc(a.pillars[i][k] === "일간(나)" ? "일원(나)" : a.pillars[i][k]) : "–"}</td>`).join("");
    return `<table class="saju"><tr><th></th>${order.map((i) => `<th>${["年柱 년주", "月柱 월주", "日柱 일주", "時柱 시주"][i]}</th>`).join("")}</tr>
      <tr><th>십신</th>${godRow("gan_god")}</tr>
      <tr><th>천간</th>${order.map((i) => cell(i, "gan")).join("")}</tr>
      <tr><th>지지</th>${order.map((i) => cell(i, "ji")).join("")}</tr>
      <tr><th>십신</th>${godRow("ji_god")}</tr>
      <tr><th>12운성</th>${godRow("stage")}</tr></table>`;
  }

  function ohRow(a) {
    return `<table class="oh"><tr>${Object.keys(OH_KR).map((o) => `<th class="c-${o}">${o} ${OH_KR[o]}</th>`).join("")}</tr>
      <tr>${Object.keys(OH_KR).map((o) => `<td><b>${a.element_count[o]}</b>개<small>${a.element_score[o]}점</small></td>`).join("")}</tr></table>`;
  }

  function yongBox(a) {
    return `<div class="ys">
      <div><span>신강·신약</span><b>${esc(a.strength.label)}</b><small>돕는 기운 ${(a.strength.ratio * 100).toFixed(0)}%</small></div>
      ${[["용신", "用神", "가장 필요한 기운"], ["희신", "喜神", "용신을 돕는 기운"], ["한신", "閑神", "영향이 적은 기운"], ["구신", "仇神", "기신을 돕는 기운"], ["기신", "忌神", "가장 피할 기운"]]
        .map(([r, hz, d]) => { const o = Object.keys(a.roles).find((k) => a.roles[k] === r);
          return `<div><span>${r} ${hz}</span><b class="c-${o}">${ohw(o)}</b><small>${d}</small></div>`; }).join("")}</div>
      ${a.johu ? `<p class="info">조후(調候) ${ohw(a.johu.element)}: ${esc(a.johu.why)}</p>` : ""}`;
  }

  function nameNarrative(n, a) {
    const sur = n.chars.filter((c) => c.role === "성");
    const giv = n.chars.filter((c) => c.role !== "성");
    const dm = a.day_master;
    const out = [];
    out.push(`이 사주는 ${dm.gan}${OH_KR[dm.element]}(${esc(dm.kr)}${OH_KR[dm.element]}) 일간으로 태어났습니다. ${esc(dm.desc)} ` +
      `일간을 돕는 기운이 ${(a.strength.ratio * 100).toFixed(0)}%인 '${esc(a.strength.label)}' 사주로, ${esc(a.yongsin.why)}`);
    out.push(`따라서 이름에는 ${a.needed_elements.map(ohw).join("·")} 기운을 담는 것이 좋습니다. ` +
      `${a.needed_elements.map((o) => `${ohw(o)}는 ${OH_TRAIT[o]}`).join(", ")}을(를) 상징합니다.`);
    const meanings = giv.map((c) => `'${esc(first(c.m))}'`).join("과(와) ");
    out.push(`이름 '${esc(n.given_kr || n.hangul.slice(sur.length))}'(${giv.map((c) => esc(c.h)).join("")})은(는) ${meanings}의 뜻을 담고 있습니다.`);
    giv.forEach((c, idx) => {
      const role = roleText[c.role] ? roleText[c.role](c.jw) : "";
      out.push(`${idx === 0 ? "첫째" : "둘째"} 글자 ${esc(c.h)}(${esc(first(c.m))} ${esc(c.r)})는 원획 ${c.won}획, 자원오행 ${ohw(c.jw)}입니다. ${role}`);
    });
    const goodGrids = Object.entries(n.suri).filter(([, g]) => g.level === 2).map(([, g]) => g.label.replace(/\(.*\)/, ""));
    const badGrids = Object.entries(n.suri).filter(([, g]) => g.level === 0).map(([, g]) => g.label.replace(/\(.*\)/, ""));
    out.push(badGrids.length
      ? `수리 4격 중 ${badGrids.join("·")}이(가) 흉수에 해당해 그 시기에는 노력과 신중함이 더 필요하다고 봅니다.`
      : `수리 4격(원·형·이·정)이 모두 ${Object.values(n.suri).every((g) => g.level === 2) ? "길수" : "길수 또는 반길수"}로 짜여 초년부터 말년까지 운의 흐름이 고릅니다.`);
    const rel = n.sound.relations;
    out.push(`발음오행은 ${n.sound.syllables.map((s, i) => `${esc(s)}(${OH_KR[n.sound.elements[i]]})`).join(" → ")}로 ` +
      (rel.every((r) => r !== "상극") ? "서로 막힘 없이 이어져 부르기 편하고 기운이 순하게 흐릅니다." : "일부 상극 관계가 있어 소리의 흐름에 약간의 부딪힘이 있습니다."));
    out.push(n.breakdown["음양"] ? `획수의 음양은 ${n.eumyang.join("·")}으로 홀짝이 고르게 섞여 조화를 이룹니다.` : `획수의 음양이 ${n.eumyang[0]}으로 치우쳐 있어 아쉬움이 있습니다.`);
    out.push(`종합 점수는 ${n.score}점(${grade(n.score)[1]})입니다. ${grade(n.score)[2]}`);
    return out;
  }

  const CSS = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #e9e4d8; color: #1d1b17; font: 13px/1.7 "Noto Sans KR", sans-serif; }
  .bar { position: sticky; top: 0; background: #16181d; color: #f1ead9; display: flex; gap: 8px; justify-content: center; padding: 10px; z-index: 5; }
  .bar button { border: 0; border-radius: 8px; padding: 9px 16px; font: 700 14px "Noto Sans KR"; cursor: pointer; background: #f1ead9; color: #16181d; }
  .bar button.pri { background: #a8321f; color: #fff; }
  .doc { width: 210mm; min-height: 297mm; margin: 18px auto; background: #fffdf8; padding: 16mm 15mm; position: relative;
    box-shadow: 0 6px 30px rgba(0,0,0,.15); }
  .frame { border: 1.5px solid #b08a3e; outline: 1px solid #b08a3e; outline-offset: 3px; padding: 10mm 9mm; min-height: 262mm; position: relative; }
  h1 { font: 900 30px "Noto Serif KR", serif; text-align: center; letter-spacing: .4em; margin: 0; }
  .h1-sub { text-align: center; font: 600 13px "Noto Serif KR", serif; color: #8a6d2c; letter-spacing: .3em; margin: 2px 0 14px; }
  .no { display: flex; justify-content: space-between; font-size: 11px; color: #6b6356; border-bottom: 1px solid #d6c8ab; padding-bottom: 8px; margin-bottom: 14px; }
  h2 { font: 700 15px "Noto Serif KR", serif; margin: 18px 0 8px; padding-left: 10px; border-left: 4px solid #a8321f; }
  h2 small { font-weight: 600; color: #8a6d2c; margin-left: 6px; letter-spacing: .15em; font-size: 11px; }
  .hero { display: grid; grid-template-columns: 1fr auto; gap: 14px; align-items: center; background: #faf5ea; border: 1px solid #e4dac6; border-radius: 6px; padding: 14px 18px; }
  .nm-big { font: 900 44px/1.1 "Noto Serif KR", serif; letter-spacing: .15em; }
  .nm-kr { font-size: 15px; letter-spacing: .6em; color: #6b6356; }
  .info { font-size: 12px; color: #4a453c; margin-top: 8px; }
  .info span { display: inline-block; margin-right: 14px; }
  .stamp { width: 104px; height: 104px; border-radius: 50%; border: 3px solid #a8321f; color: #a8321f; display: grid; place-items: center; text-align: center;
    transform: rotate(-8deg); font-family: "Noto Serif KR", serif; }
  .stamp b { display: block; font-size: 30px; line-height: 1; } .stamp span { font-size: 12px; font-weight: 700; letter-spacing: .1em; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #e4dac6; padding: 5px 6px; text-align: center; }
  th { background: #f4ecdb; font-weight: 600; font-size: 12px; }
  table.saju td small { display: block; font-size: 10px; color: #6b6356; }
  .gz { font: 900 22px "Noto Serif KR", serif; }
  .g { font-size: 11.5px; }
  .na { color: #aaa; }
  table.oh td b { font: 700 16px "Noto Serif KR", serif; } table.oh td small { display: block; font-size: 10px; color: #6b6356; }
  .ys { display: flex; gap: 6px; margin-top: 8px; }
  .ys div { flex: 1; border: 1px solid #e4dac6; border-radius: 6px; text-align: center; padding: 6px 4px; background: #faf5ea; }
  .ys span { display: block; font-size: 10.5px; color: #6b6356; } .ys b { font: 700 15px "Noto Serif KR", serif; display: block; } .ys small { font-size: 10px; color: #6b6356; }
  .chars td.h { font: 900 26px "Noto Serif KR", serif; width: 54px; }
  .chars td.l { text-align: left; }
  .lv2 { color: #3c7d55; font-weight: 700; } .lv1 { color: #b1842c; font-weight: 700; } .lv0 { color: #b94335; font-weight: 700; }
  .score { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
  .score div { border: 1px solid #e4dac6; border-radius: 6px; padding: 6px; text-align: center; }
  .score b { display: block; font: 700 17px "Noto Serif KR", serif; color: #a8321f; } .score span { font-size: 11px; color: #6b6356; }
  .narr p { margin: 0 0 6px; text-indent: .6em; text-align: justify; }
  .c-木 { color: #3c7d55; } .c-火 { color: #b94335; } .c-土 { color: #b1842c; } .c-金 { color: #6d6f77; } .c-水 { color: #2c557f; }
  .sign { display: flex; justify-content: flex-end; align-items: center; gap: 14px; margin-top: 18px; font: 600 14px "Noto Serif KR", serif; }
  .seal-img { width: 58px; height: 58px; border-radius: 50%; object-fit: cover; }
  .seal { width: 52px; height: 52px; background: #a8321f; color: #fff; display: grid; place-items: center; font: 900 26px "Noto Serif KR", serif;
    border-radius: 6px; transform: rotate(-4deg); box-shadow: inset 0 0 0 2px rgba(255,255,255,.3), inset 0 0 0 4px #a8321f; }
  .foot { margin-top: 14px; font-size: 10px; color: #8b8273; border-top: 1px solid #e4dac6; padding-top: 6px; }
  .pb { break-before: page; }
  .dw { display: grid; grid-template-columns: repeat(10, 1fr); gap: 3px; }
  .dw div { border: 1px solid #e4dac6; text-align: center; font-size: 10px; padding: 3px 0; border-radius: 4px; }
  .dw b { display: block; font: 700 14px "Noto Serif KR", serif; }
  ul.sum { margin: 0; padding-left: 18px; } ul.sum li { margin-bottom: 3px; }
  .ftc { border: 1px solid #e4dac6; border-radius: 6px; padding: 8px 12px; margin-bottom: 8px; break-inside: avoid; }
  .ftc h3 { margin: 0; font: 700 14px "Noto Serif KR", serif; display: flex; align-items: center; gap: 8px; }
  .ftc h3 em { margin-left: auto; font-style: normal; color: #a8321f; font-size: 13px; }
  .ftc .stars { color: #b08a3e; letter-spacing: 1px; }
  .hz { width: 24px; height: 24px; background: #16181d; color: #d0ac5f; border-radius: 5px; display: inline-grid; place-items: center; font-size: 13px; }
  .ftc .hl { margin: 4px 0; font-weight: 700; }
  .ftc ul { margin: 0; padding-left: 18px; } .ftc li { margin-bottom: 2px; }
  .ftc .adv { margin: 4px 0 0; font-size: 12px; color: #6b6356; }
  table.luck td { vertical-align: top; } table.luck tr { break-inside: avoid; } table.luck small { color: #6b6356; font-size: 10px; }
  @media print {
    body { background: #fff; } .bar { display: none; }
    .doc { margin: 0; width: auto; min-height: auto; box-shadow: none; padding: 0; }
    .frame { min-height: 268mm; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }`;

  function docNo() {
    const d = new Date();
    const p = (x) => String(x).padStart(2, "0");
    return { no: `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`,
      date: `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일` };
  }

  function shell(title, fileName, body) {
    return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=Noto+Serif+KR:wght@600;700;900&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>
<div class="bar"><button class="pri" onclick="window.print()">PDF로 저장 · 인쇄</button><button id="saveHtml">HTML 파일 다운로드</button></div>
${body}
<script>
document.getElementById("saveHtml").onclick = function () {
  var html = "<!doctype html>" + document.documentElement.outerHTML;
  var a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  a.download = ${JSON.stringify(fileName)};
  document.body.appendChild(a); a.click(); a.remove();
};
<\/script></body></html>`;
  }

  function openDoc(html) {
    const w = window.open("", "_blank");
    if (!w) { alert("팝업이 차단되었습니다. 이 사이트의 팝업을 허용해 주세요."); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }

  /* 성명 감정서 */
  window.openNameReport = function (n, data) {
    const s = data.saju, a = data.analysis, m = meta(s), d = docNo(), g = grade(n.score);
    const giv = n.chars.filter((c) => c.role !== "성");
    const charRows = n.chars.map((c) => `<tr><td class="h">${esc(c.h)}</td><td>${esc(c.r)}</td><td class="l">${esc(c.m)}</td><td>${c.won}획<small style="display:block;font-size:10px;color:#6b6356">필획 ${c.pil}</small></td>
      <td class="c-${c.jw}"><b>${ohw(c.jw)}</b></td><td>${esc(c.role)}</td></tr>`).join("");
    const suriRows = Object.entries(n.suri).map(([k, gg]) => `<tr><td><b>${esc(gg.label.replace(/\(.*\)/, ""))}</b></td><td>${GRID_PERIOD[k]}</td><td>${gg.num}${gg.num !== gg.suri ? `→${gg.suri}` : ""}</td>
      <td>${esc(gg.name)}</td><td class="lv${gg.level}">${gg.level_kr}</td><td class="l" style="text-align:left">${esc(gg.desc)}</td></tr>`).join("");
    const score = Object.entries(n.breakdown).map(([k, v]) => `<div><b>${v}</b><span>${k} / ${{ 자원오행: 30, 수리: 30, 발음오행: 15, 음양: 10, 한자품질: 15 }[k]}</span></div>`).join("");
    const body = `<div class="doc"><div class="frame">
      <h1>姓名鑑定書</h1><p class="h1-sub">성 명 감 정 서</p>
      <div class="no"><span>문서번호 NM-${d.no}</span><span>발행일 ${d.date}</span></div>
      <div class="hero"><div><div class="nm-big">${esc(n.hanja)}</div><div class="nm-kr">${esc(n.hangul)}</div>
        <div class="info"><span>성별 ${m.gender}</span><span>${esc(m.birth)}</span><span>출생지 ${esc(m.region)}</span></div></div>
        <div class="stamp"><div><b>${n.score.toFixed(1)}</b><span>${g[0]} · ${g[1]}</span></div></div></div>

      <h2>사주 원국<small>四柱原局</small></h2>
      ${sajuTable(s, a)}
      <div class="info"><span>${esc(m.lunar)}</span><span>${esc(m.solar)}</span><span>${esc(s.year_animal)}띠</span></div>
      <h2>오행과 용신<small>五行 · 用神</small></h2>
      ${ohRow(a)}${yongBox(a)}

      <h2>이름 글자 풀이<small>字意 · 字源五行</small></h2>
      <table class="chars"><tr><th>한자</th><th>음</th><th>뜻(훈)</th><th>원획</th><th>자원오행</th><th>사주 역할</th></tr>${charRows}</table>

      <h2>수리 4격<small>元亨利貞</small></h2>
      <table><tr><th>격</th><th>해당 시기</th><th>획수</th><th>수리</th><th>길흉</th><th>풀이</th></tr>${suriRows}</table>
      <div class="info"><span>발음오행 ${n.sound.syllables.map((x, i) => `${esc(x)}(${OH_KR[n.sound.elements[i]]})`).join(" → ")} · ${n.sound.relations.join(", ")}</span>
        <span>획수 음양 ${n.eumyang.join("·")}</span></div>

      <h2>항목별 점수<small>評點</small></h2>
      <div class="score">${score}</div>

      <h2>종합 해설<small>總評</small></h2>
      <div class="narr">${nameNarrative(n, a).map((x) => `<p>${x}</p>`).join("")}</div>
      ${n.suri_notes.map((x) => `<p style="font-size:11px;color:#6b6356">※ ${esc(x)}</p>`).join("")}

      <div class="sign"><span>위와 같이 감정합니다.<br>${d.date} · ${SITE_NAME}</span><img class="seal-img" src="${LOGO}" alt="운세복덕방"></div>
      <div class="foot">본 감정서는 만세력(천문 계산 절입 시각, 출생지 경도·서머타임 보정)과 대법원 인명용 한자표를 바탕으로 자원오행·81수리·발음오행·음양 원리에 따라 자동 산출되었습니다.
        성명학은 학파에 따라 기준이 다를 수 있으므로 참고 자료로 활용하시기 바랍니다.</div>
    </div></div>`;
    openDoc(shell(`성명감정서 ${n.hangul}(${n.hanja})`, `성명감정서_${n.hangul}_${n.hanja}.html`, body));
  };

  function fortuneHtml(f) {
    const st = (n) => (n ? "★".repeat(n) + "☆".repeat(5 - n) : "");
    const L = f.lucky;
    const q = f.question ? `<h2>질문 풀이<small>問 · ${esc(f.question.topics.join(" · "))}</small></h2>
      <p style="font:600 14px 'Noto Serif KR',serif;border-left:3px solid #a8321f;padding-left:10px">“${esc(f.question.question)}”</p>
      <p class="hl" style="font-weight:700;color:#a8321f">${esc(f.question.headline)}</p>
      ${f.question.sections.map((s) => `<div class="ftc"><h3><span class="hz">${s.hanja}</span>${esc(s.title)}</h3>
        <ul>${s.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>`).join("")}
      <p class="adv" style="font-size:12px;color:#6b6356">조언 · ${f.question.advice.map(esc).join(" / ")}</p>` : "";
    return `${q}<h2 class="pb">운세 풀이<small>運勢 解說 · ${f.year}년 기준 · 종합 ${f.overall}점</small></h2>
      <p class="info"><span>행운의 기운 ${ohw(L.element)}</span><span>색 ${esc(L.color)}</span><span>방향 ${esc(L.direction)}</span><span>숫자 ${esc(L.number)}</span><span>계절 ${esc(L.season)}</span></p>
      ${f.categories.map((c) => `<div class="ftc">
        <h3><span class="hz">${c.hanja}</span>${esc(c.title)}${c.score != null ? `<em>${c.score}점 <span class="stars">${st(c.stars)}</span></em>` : ""}</h3>
        <p class="hl">${esc(c.headline)}</p>
        <ul>${c.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
        ${c.advice.length ? `<p class="adv">조언 · ${c.advice.map(esc).join(" / ")}</p>` : ""}</div>`).join("")}
      ${luckTable("대운별 풀이", "大運 · 10년 단위", f.daewoon, "dw")}
      ${luckTable("세운 풀이", `歲運 · ${f.seun[0].year}~${f.seun[f.seun.length - 1].year}년`, f.seun, "sw")}`;
  }

  function luckTable(title, sub, list, kind) {
    const rows = list.map((d) => `<tr${d.current ? ' style="background:#fbf3df"' : ""}>
      <td>${kind === "dw" ? `${d.age}~${d.age_end}세<br><small>${d.year}~${d.year_end}</small>` : `${d.year}년<br><small>${d.age}세</small>`}</td>
      <td><b class="c-${d.elements[0]}" style="font:700 17px 'Noto Serif KR',serif">${d.ganji[0]}</b><b class="c-${d.elements[1]}" style="font:700 17px 'Noto Serif KR',serif">${d.ganji[1]}</b><br><small>${esc(d.gods.join("·"))}</small></td>
      <td>${d.level}<br><small>${d.score}점${d.current ? " · 현재" : ""}${d.samjae ? " · " + esc(d.samjae) : ""}</small></td>
      <td style="text-align:left;font-size:11.5px">${d.text.map(esc).join(" ")}</td></tr>`).join("");
    return `<h2>${title}<small>${sub}</small></h2>
      <table class="luck"><tr><th style="width:68px">시기</th><th style="width:60px">간지</th><th style="width:50px">길흉</th><th>풀이</th></tr>${rows}</table>`;
  }

  /* 궁합 감정서 · 기업 사주 해설서 */
  window.openDuoReport = function (d) {
    const isC = d.type === "couple", dn = docNo();
    const st = (n) => (n ? "★".repeat(n) + "☆".repeat(5 - n) : "");
    const people = d.people.map((p, i) => {
      const s = d.sajus[i].saju, a = d.sajus[i].analysis, m = meta(s);
      return `<h2>${esc(p.name)}<small>${isC ? "四柱" : i ? "會社 四柱 · 설립일 기준" : "代表者 四柱"}</small></h2>
        <div class="info"><span>${isC || !i ? `성별 ${m.gender}` : "회사"}</span><span>${esc(m.birth)}</span><span>${esc(m.region)}</span></div>
        ${sajuTable(s, a)}${yongBox(a)}`;
    }).join("");
    const cats = d.categories.map((c) => `<div class="ftc">
      <h3><span class="hz">${c.hanja}</span>${esc(c.title)}${c.score != null ? `<em>${c.score}점 <span class="stars">${st(c.stars)}</span></em>` : ""}</h3>
      <p class="hl">${esc(c.headline)}</p><ul>${c.points.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("");
    const years = d.years ? luckTable("연도별 회사 운", "年運 · 회사 60% + 대표자 40%", d.years, "sw") : "";
    const title = isC ? "宮合鑑定書" : "企業四柱解說書";
    const body = `<div class="doc"><div class="frame">
      <h1>${title}</h1><p class="h1-sub">${isC ? "궁 합 감 정 서" : "기 업 사 주 해 설 서"}</p>
      <div class="no"><span>문서번호 ${isC ? "GH" : "BZ"}-${dn.no}</span><span>발행일 ${dn.date}</span></div>
      <div class="hero"><div><div class="nm-big" style="font-size:30px">${esc(d.people[0].name)} · ${esc(d.people[1].name)}</div>
        <div class="info"><span>${d.year}년 기준</span><span>${isC ? "궁합" : "기업 사주"} 종합 판정 ${esc(d.grade)}</span></div></div>
        <div class="stamp"><div><b>${d.overall}</b><span>${esc(d.grade)}</span></div></div></div>
      ${people}
      <h2 class="pb">항목별 풀이<small>${isC ? "宮合 解說" : "企業 解說"}</small></h2>${cats}
      ${years}
      <h2>조언<small>助言</small></h2><ul class="sum">${d.advice.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <div class="sign"><span>${dn.date} · ${SITE_NAME}</span><img class="seal-img" src="${LOGO}" alt="운세복덕방"></div>
      <div class="foot">본 문서는 천문 계산 만세력을 바탕으로 자동 산출되었습니다. 명리학은 학파에 따라 해석이 다를 수 있으므로 참고 자료로 활용하시기 바랍니다.</div>
    </div></div>`;
    const fname = `${isC ? "궁합감정서" : "기업사주해설서"}_${d.people[0].name}_${d.people[1].name}.html`.replace(/\s+/g, "");
    openDoc(shell(`${isC ? "궁합감정서" : "기업사주해설서"} ${d.people[0].name}·${d.people[1].name}`, fname, body));
  };

  /* 사주 해설서 */
  window.openSajuReport = function (data) {
    const s = data.saju, a = data.analysis, m = meta(s), d = docNo();
    const dw = s.daewoon.list.map((x) => `<div>${x.age}세<b><span class="c-${x.gan_oh}">${x.ganji[0]}</span><span class="c-${x.ji_oh}">${x.ganji[1]}</span></b>${x.year}</div>`).join("");
    const names = (data.names || []).slice(0, 10);
    const nameRows = names.map((n, i) => `<tr><td>${i + 1}</td><td style="font:700 17px 'Noto Serif KR',serif">${esc(n.hanja)}</td><td>${esc(n.hangul)}</td>
      <td class="l" style="text-align:left">${n.chars.filter((c) => c.role !== "성").map((c) => `${esc(c.h)} ${esc(first(c.m))}(${c.jw})`).join(", ")}</td><td><b>${n.score}</b></td></tr>`).join("");
    const body = `<div class="doc"><div class="frame">
      <h1>四柱解說書</h1><p class="h1-sub">사 주 해 설 서</p>
      <div class="no"><span>문서번호 SJ-${d.no}</span><span>발행일 ${d.date}</span></div>
      ${data.personName ? `<div class="hero" style="grid-template-columns:1fr;margin-bottom:8px"><div><div class="nm-big" style="font-size:32px">${esc(data.personName)}</div></div></div>` : ""}
      <div class="info" style="margin-bottom:10px"><span>성별 ${m.gender}</span><span>${esc(m.birth)}</span><span>출생지 ${esc(m.region)}</span><span>${esc(m.lunar)}</span><span>${esc(m.solar)}</span></div>
      <h2>사주 원국<small>四柱原局${a.name_elements && a.name_elements.length ? " · 사주 8자 + 이름 " + a.name_elements.length + "자" : ""}</small></h2>${sajuTable(s, a)}
      ${a.name_elements && a.name_elements.length ? `<p class="info"><span>이름 글자: ${a.name_elements.map((n) => `${esc(n.h || n.kr)}(${esc(n.kr)}) <b class="c-${n.element}">${n.element}</b> · ${n.basis}오행 · ${esc(n.group)}`).join(" / ")}</span>
        <span>오행 개수(사주+이름): ${Object.keys(OH_KR).map((o) => `${o} ${a.element_count[o]}`).join(" · ")}</span></p>` : ""}
      <h2>오행 분포<small>五行</small></h2>${ohRow(a)}
      <h2>신강약과 용신<small>强弱 · 用神</small></h2>${yongBox(a)}
      <h2>풀이<small>解說</small></h2><ul class="sum">${a.summary.map((x, i) => `<li>${esc(i === 0 && data.personName ? x.replace(/^일간은/, `${data.personName}님의 일간은`) : x)}</li>`).join("")}</ul>
      ${a.relations.length ? `<h2>합·충<small>合沖</small></h2><p>${a.relations.map(esc).join(" · ")}</p>` : ""}
      <h2>신살<small>神殺</small></h2><p>${a.sinsal.map((x) => `<b>${esc(x.name)}</b> ${esc(x.detail)}`).join(" · ")}</p>
      <h2>대운<small>大運 · ${s.daewoon.forward ? "순행" : "역행"} ${s.daewoon.start_age}세 시작</small></h2><div class="dw">${dw}</div>
      ${data.fortune ? fortuneHtml(data.fortune) : ""}
      ${names.length ? `<h2>추천 이름<small>推薦姓名 TOP ${names.length}</small></h2>
        <table><tr><th>순위</th><th>한자</th><th>한글</th><th>글자 풀이(자원오행)</th><th>점수</th></tr>${nameRows}</table>` : ""}
      <div class="sign"><span>${d.date} · ${SITE_NAME}</span><img class="seal-img" src="${LOGO}" alt="운세복덕방"></div>
      <div class="foot">본 해설서는 천문 계산 만세력을 바탕으로 자동 산출되었습니다. 명리학은 학파에 따라 해석이 다를 수 있으므로 참고 자료로 활용하시기 바랍니다.</div>
    </div></div>`;
    const who = data.personName ? `_${data.personName}` : "";
    openDoc(shell(`사주해설서${who.replace("_", " ")}`, `사주해설서${who}_${s.solar_date}.html`, body));
  };
})();
