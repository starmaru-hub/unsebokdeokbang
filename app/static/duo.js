/* 궁합(커플·부부) · 기업 사주(대표자 + 회사) — 두 사주 입력·분석·결과 */
(function () {
  const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => `<option value="${h % 12}" ${h === 9 ? "selected" : ""}>${h}시</option>`).join("");
  const MINS = Array.from({ length: 60 }, (_, m) => `<option value="${m}">${String(m).padStart(2, "0")}분</option>`).join("");
  let duoMode = "couple";
  let duoData = null;

  function personForm(p, title, sub, { company = false, gender = "M", parent = false } = {}) {
    if (parent) {   // 부모: 이름·한자 없이 생년월일시만
      return `<fieldset class="pf" data-p="${p}" data-parent="1">
      <legend><span class="no">${title}</span><small>${sub}</small></legend>
      <div class="grid">
        <label class="f-namew">이름<input class="f-name name-in" maxlength="5" placeholder="홍길동"></label>
        <label>달력<div class="row"><div class="seg f-cal"><button type="button" data-v="solar" class="on">양력</button><button type="button" data-v="lunar">음력</button></div>
          <span class="check hide f-leapw"><input type="checkbox" class="f-leap"> 윤달</span></div></label>
        <label>생년월일<input type="date" class="f-date" min="1900-01-01" max="2100-12-31"></label>
        <label class="f-time">태어난 시각
          <div class="row"><div class="seg f-ampm"><button type="button" data-v="am" class="on">오전</button><button type="button" data-v="pm">오후</button></div>
            <select class="f-hour">${HOURS}</select><select class="f-min">${MINS}</select></div>
          <span class="check"><input type="checkbox" class="f-notime"> 시각을 모릅니다</span></label>
        <label>출생지
          <div class="combo"><input class="f-regq" value="서울" placeholder="도시 이름 검색" autocomplete="off"><ul class="f-regl hide"></ul></div>
          <input type="hidden" class="f-reg" value="서울"></label>
      </div></fieldset>`;
    }
    return `<fieldset class="pf" data-p="${p}">
      <legend><span class="no">${title}</span><small>${sub}</small></legend>
      <div class="grid">
        <label class="${company ? "" : "f-namew"}">${company ? "회사명 (상호)" : "이름 <small>(성 포함 · 발음오행으로 풀이, 한자는 선택)</small>"}
          <div class="row"><input class="f-name ${company ? "" : "name-in"}" maxlength="${company ? 30 : 5}" placeholder="${company ? "예: 한빛솔루션" : "홍길동"}" required>
          ${company ? "" : `<span class="pick f-npick"><span class="hint">이름을 입력하면 글자별 한자를 고를 수 있습니다</span></span>`}</div></label>
        ${company ? "" : `<label>성별<div class="seg f-gender">
          <button type="button" data-v="M" class="${gender === "M" ? "on" : ""}">남자</button><button type="button" data-v="F" class="${gender === "F" ? "on" : ""}">여자</button></div></label>`}
        ${company ? "" : `<label>달력<div class="row"><div class="seg f-cal"><button type="button" data-v="solar" class="on">양력</button><button type="button" data-v="lunar">음력</button></div>
          <span class="check hide f-leapw"><input type="checkbox" class="f-leap"> 윤달</span></div></label>`}
        <label>${company ? "설립일 (법인 등기일·개업일)" : "생년월일"}<input type="date" class="f-date" min="1900-01-01" max="2100-12-31"></label>
        <label class="f-time">${company ? "설립 시각" : "태어난 시각"}
          <div class="row"><div class="seg f-ampm"><button type="button" data-v="am" class="on">오전</button><button type="button" data-v="pm">오후</button></div>
            <select class="f-hour">${HOURS}</select><select class="f-min">${MINS}</select></div>
          <span class="check"><input type="checkbox" class="f-notime" ${company ? "checked" : ""}> 시각을 모릅니다</span>
          ${company ? `<small class="note">※ 설립 시각은 법인 사업자등록증이 발급된 시각을 입력해 주세요. 모르면 '시각을 모릅니다'에 체크하면 시주 없이 분석합니다.</small>` : ""}</label>
        <label>${company ? "회사 소재지" : "출생지"}
          <div class="combo"><input class="f-regq" value="서울" placeholder="도시 이름 검색 (예: 부산, ㅂㅅ)" autocomplete="off"><ul class="f-regl hide"></ul></div>
          <input type="hidden" class="f-reg" value="서울"></label>
      </div></fieldset>`;
  }

  window.buildDuo = function (mode) {
    duoMode = mode;
    $("#duoCols").innerHTML = mode === "couple"
      ? personForm("a", "첫 번째 분", "남편 · 남자친구 등", { gender: "M" }) + personForm("b", "두 번째 분", "아내 · 여자친구 등", { gender: "F" }) +
        `<fieldset class="pf rel-pf"><legend><span class="no">두 분의 관계</span><small>결혼하셨다면 결혼 날짜로 결혼일 풀이를, 아니면 결혼하기 좋은 해를 알려 드립니다</small></legend>
          <div class="grid">
            <label>결혼 여부<div class="seg" id="marSeg"><button type="button" data-v="no" class="on">결혼 전 (연애 중)</button><button type="button" data-v="yes">결혼함</button></div></label>
            <label id="wedWrap" class="hide">결혼 날짜<input type="date" id="wedDate" min="1900-01-01" max="2100-12-31"></label>
          </div></fieldset>`
      : personForm("rep", "대표자", "회사를 이끄는 분") + personForm("comp", "회사", "설립일 기준으로 회사 사주를 세웁니다", { company: true });
    $("#duoBtn").textContent = mode === "couple" ? "궁합 보기" : "기업 사주 보기";
    $("#duoErr").textContent = "";
    $$(".pf[data-p]").forEach(initForm);
    const mar = $("#marSeg");
    if (mar) mar.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      mar.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      $("#wedWrap").classList.toggle("hide", b.dataset.v !== "yes");
    });
  };

  function initForm(f) {
    const t = (s) => f.querySelector(s);
    f.querySelectorAll(".seg").forEach((seg) => seg.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b || b.disabled) return;
      seg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      if (seg.classList.contains("f-cal")) t(".f-leapw").classList.toggle("hide", b.dataset.v !== "lunar");
    }));
    const noTime = t(".f-notime");
    const sync = () => f.querySelectorAll(".f-ampm button, .f-hour, .f-min").forEach((el) => (el.disabled = noTime.checked));
    noTime.addEventListener("change", sync);
    sync();
    attachRegion(t(".f-regq"), t(".f-regl"), t(".f-reg"));
    const pick = t(".f-npick");
    if (pick) {
      let tm;
      t(".f-name").addEventListener("input", (e) => {
        clearTimeout(tm);
        tm = setTimeout(async () => {
          const syl = [...e.target.value.trim()].filter((c) => c >= "가" && c <= "힣").slice(0, 5);
          if (!syl.length) return;
          const lists = await Promise.all(syl.map((x) => api(`/api/hanja?q=${encodeURIComponent(x)}&limit=300`)));
          pick.innerHTML = lists.map((l, i) => `<select data-r="${esc(syl[i])}" aria-label="${esc(syl[i])} 한자"><option value="">${esc(syl[i])} · 한자 모름</option>` +
            l.map((c) => `<option value="${esc(c.h)}">${esc(c.h)} ${esc(firstMeaning(c.m))} (${c.jw})</option>`).join("") + "</select>").join("");
        }, 300);
      });
    }
  }

  /* 출생지 검색 (app.js 의 regions · chosung 재사용) */
  function attachRegion(q, list, hidden) {
    let hits = [], idx = 0;
    const show = (v) => {
      v = v.trim();
      const cv = chosung(v);
      hits = regions.filter((r) => !v || r.name.includes(v) || r.cho.startsWith(cv) || r.cho.includes(v)).slice(0, 60);
      idx = 0;
      list.innerHTML = hits.length ? hits.map((r, i) => `<li data-i="${i}" class="${i ? "" : "act"}">${esc(r.name)}<small>${r.overseas ? "해외 · " : ""}동경 ${r.lon.toFixed(1)}°</small></li>`).join("")
        : `<li class="empty">일치하는 지역이 없습니다</li>`;
      list.classList.remove("hide");
    };
    const pick = (r) => { q.value = r.name; hidden.value = r.name; list.classList.add("hide"); };
    q.addEventListener("focus", () => { q.select(); show(""); });
    q.addEventListener("input", () => { hidden.value = ""; show(q.value); });
    q.addEventListener("keydown", (e) => {
      const items = list.querySelectorAll("li[data-i]");
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!items.length) return;
        idx = (idx + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items.forEach((li, i) => li.classList.toggle("act", i === idx));
      } else if (e.key === "Enter" && !list.classList.contains("hide")) {
        e.preventDefault();
        if (hits[idx]) pick(hits[idx]);
      }
    });
    list.addEventListener("mousedown", (e) => { const li = e.target.closest("li[data-i]"); if (li) { e.preventDefault(); pick(hits[+li.dataset.i]); } });
    q.addEventListener("blur", () => {
      list.classList.add("hide");
      const ex = regions.find((r) => r.name === q.value.trim());
      if (ex) pick(ex); else if (!hidden.value) q.value = "";
    });
  }

  window.duoPersonForm = (...a) => personForm(...a);
  window.duoInitForm = (f) => initForm(f);
  window.duoCollect = (p, label) => collect(p, label);

  function collect(p, label) {
    const f = $(`.pf[data-p="${p}"]`);
    const t = (s) => f.querySelector(s);
    const on = (s, d) => (t(s) ? t(`${s} .on`).dataset.v : d);
    const [y, m, d] = t(".f-date").value.split("-").map(Number);
    if (!t(".f-name").value.trim()) throw new Error(`${label}의 ${t(".f-npick") || f.dataset.parent ? "이름" : "회사명"}을 입력해 주세요`);
    if (!y) throw new Error(`${label}의 날짜를 입력해 주세요`);
    const kr = t(".f-name").value.trim();
    const sel = f.dataset.parent ? [] : [...f.querySelectorAll(".f-npick select")];
    const hj = sel.length && sel.length === [...kr].length ? sel.map((x) => x.value || " ").join("") : "";
    if (!t(".f-reg").value) throw new Error(`${label}의 지역을 검색해서 골라 주세요`);
    const noTime = t(".f-notime").checked;
    const hh = +t(".f-hour").value + (on(".f-ampm", "am") === "pm" ? 12 : 0);
    return {
      name: kr, name_hanja: hj.trim() ? hj : null, year: y, month: m, day: d,
      hour: noTime ? null : hh, minute: noTime ? 0 : +t(".f-min").value,
      calendar: on(".f-cal", "solar"), leap_month: t(".f-leap") ? t(".f-leap").checked : false,
      gender: on(".f-gender", "M"), region: t(".f-reg").value,
    };
  }

  $("#duoForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#duoErr").textContent = "";
    const out = $("#out");
    try {
      let data;
      if (duoMode === "couple") {
        const a = collect("a", "첫 번째 분"), b = collect("b", "두 번째 분");
        const married = $("#marSeg .on").dataset.v === "yes";
        const wedding_date = married ? $("#wedDate").value : null;
        if (married && !wedding_date) throw new Error("결혼 날짜를 입력해 주세요");
        out.innerHTML = $("#tplLoading").innerHTML;
        data = await api("/api/couple", { a, b, married, wedding_date });
      } else {
        const rep = collect("rep", "대표자"), comp = collect("comp", "회사");
        const company_name = comp.name;
        delete comp.name;
        delete comp.name_hanja;
        out.innerHTML = $("#tplLoading").innerHTML;
        data = await api("/api/business", { rep, company: comp, company_name });
      }
      duoData = data;
      out.innerHTML = renderDuo(data);
      out.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      out.innerHTML = "";
      $("#duoErr").textContent = err.message;
    }
  });

  $("#out").addEventListener("click", (e) => {
    if (e.target.closest("[data-doc='duo']") && duoData) openDuoReport(duoData);
  });

  function miniPillars(sj) {
    const ps = sj.saju.pillars;
    const nm = sj.analysis.name_elements || [];
    const cols = [0, 1, 2, 3].map((i) => {
      const p = ps[i];
      const lb = ["年", "月", "日", "時"][i];
      return p ? `<div><small>${lb}</small><b class="e-${p.gan_oh}">${p.gan}</b><b class="e-${p.ji_oh}">${p.ji}</b></div>`
        : `<div><small>${lb}</small><b class="na">?</b><b class="na">?</b></div>`;
    }).join("");
    // 이름 2자(발음오행)를 다섯째 열로 — 사주 8자 + 이름 2자 = 10자
    const nameCol = nm.length ? `<div class="mini-name"><small>名</small>${nm.map((n) => `<b class="e-${n.element}" title="${esc(n.kr)} · ${n.element}">${esc(n.kr)}</b>`).join("")}</div>` : "";
    return `<div class="mini-wg ${nm.length ? "with-name" : ""}">${cols}${nameCol}</div>`;
  }

  function personCard(p, sj) {
    const dm = p.day_master;
    return `<div class="pc">
      <h3>${esc(p.name)}</h3>
      <p class="meta"><span>${esc(dm.gan)}${OH_KR[dm.element]} 일간</span><span>${esc(p.strength)}</span><span>${esc(p.animal)}띠</span></p>
      ${miniPillars(sj)}
      <p class="meta"><span>용신 <b class="t-${p.yong}">${p.yong}(${OH_KR[p.yong]})</b></span>
        <span>오행(${esc(p.basis || "사주 8자")}) ${OH_ORDER.map((o) => `<span class="t-${o}">${o}${p.element_count[o]}</span>`).join(" ")}</span></p>
    </div>`;
  }

  function nameTbl(name, chars) {
    return `<table class="nm-oh"><tr><th>${esc(name)}</th>${chars.map((x) => `<th>${esc(x.kr)}</th>`).join("")}</tr>
      <tr><td>한자</td>${chars.map((x) => `<td class="hz">${esc(x.h || "–")}</td>`).join("")}</tr>
      <tr><td>오행</td>${chars.map((x) => { const o = x.sound; return `<td class="t-${o}">${o}<small>발음</small></td>`; }).join("")}</tr>
      <tr><td>역할</td>${chars.map((x) => `<td><span class="role ${["용신", "희신", "조후"].includes(x.role) ? "e-" + x.sound : "plain"}">${esc(x.role)}</span></td>`).join("")}</tr></table>`;
  }

  function catCard(c) {
    const tbls = c.tables ? `<div class="nm-tbls">${c.tables.map((x) => nameTbl(x.name, x.chars)).join("")}</div>`
      : c.chars ? `<div class="nm-tbls">${nameTbl("대표자", c.chars)}</div>` : "";
    const comb = c.combined ? `<p class="legend">두 사주 합산 오행: ${OH_ORDER.map((o) => `<span class="t-${o}">${o} ${c.combined[o]}</span>`).join(" · ")}</p>` : "";
    return `<article class="ft ${c.tables || c.chars ? "ft-wide" : ""}">
      <header><i>${c.hanja}</i><div><h3>${esc(c.title)}</h3>${c.stars ? `<span class="st">${"★".repeat(c.stars)}${"☆".repeat(5 - c.stars)}</span>` : ""}</div>
        ${c.score != null ? `<b class="sc">${c.score}<small>점</small></b>` : ""}</header>
      <p class="hl">${esc(c.headline)}</p>${tbls}
      <ul>${c.points.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>${comb}
    </article>`;
  }

  function renderDuo(d) {
    const isC = d.type === "couple";
    const [p1, p2] = d.people;
    const head = secHead(isC ? "宮合 鑑定" : "企業 四柱", isC ? `${esc(p1.name)} · ${esc(p2.name)}님의 궁합` : `${esc(p1.name)}님과 ${esc(p2.name)}의 기업 사주`,
      `<span>${d.year}년 기준</span>${d.wedding ? `<span>결혼일 ${esc(d.wedding)}</span>` : ""}`);
    const years = d.years ? subHead("연도별 회사 운 · 회사 60% + 대표자 40%", "年運") +
      `<div class="luck-list">${d.years.map((y) => luckRow(y, "sw")).join("")}</div>` : "";
    return `<section class="panel">${head}
      ${isC ? "" : `<div class="doc-bar"><span>기업 사주 결과를 한 장으로 정리한 문서</span>
        <button class="btn-doc" type="button" data-doc="duo">기업 사주 해설서 보기 · 다운로드</button></div>`}
      <div class="duo-top">
        ${personCard(p1, d.sajus[0])}
        <div class="duo-score"><div class="ring big" style="--p:${d.overall}"><div><span><b>${d.overall}</b><small>/ 100</small></span></div></div>
          <p class="grade">${esc(d.grade)}</p><p class="legend">${isC ? "종합 궁합" : "종합 점수"}</p></div>
        ${personCard(p2, d.sajus[1])}
      </div>
      <div class="ft-grid duo-grid">${d.categories.map(catCard).join("")}</div>
      ${years}
      <div class="adv-box" style="margin-top:16px"><b>조언</b>${d.advice.map((x) => `<p>${esc(x)}</p>`).join("")}</div>
    </section>`;
  }
})();
