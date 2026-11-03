const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const OH_KR = { 木: "목", 火: "화", 土: "토", 金: "금", 水: "수" };
const OH_ORDER = ["木", "火", "土", "金", "水"];
const SCORE_FULL = { 자원오행: 30, 수리: 30, 발음오행: 15, 음양: 10, 한자품질: 15, 부모조화: 10 };
const MEDAL = ["壹", "貳", "參"];
let mode = "naming";

/* 예전 서버 API 와 같은 주소·입출력으로 브라우저 안의 계산 엔진을 부른다 */
async function api(path, body) {
  const engine = await window.engineReady;
  return engine.request(path, body ? JSON.parse(JSON.stringify(body)) : undefined);
}
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const firstMeaning = (m) => String(m || "").split(/[\/,]/)[0].trim().replace(/\s+[가-힣](\([가-힣]\))?$/, "");

/* ---------- 폼 ---------- */
function segValue(id) { return $(`#${id} .on`).dataset.v; }
$$(".seg").forEach((seg) => seg.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn || btn.disabled) return;
  $$("button", seg).forEach((b) => b.classList.toggle("on", b === btn));
  if (seg.id === "calendar") $("#leapWrap").classList.toggle("hide", segValue("calendar") !== "lunar");
}));
$("#bhour").innerHTML = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => `<option value="${h % 12}" ${h === 9 ? "selected" : ""}>${h}시</option>`).join("");
$("#bmin").innerHTML = Array.from({ length: 60 }, (_, m) => `<option value="${m}">${String(m).padStart(2, "0")}분</option>`).join("");
$("#noTime").addEventListener("change", (e) => {
  $$("#ampm button, #bhour, #bmin").forEach((el) => (el.disabled = e.target.checked));
});

/* 출생지 검색: 이름 일부 또는 초성(ㅂㅅ → 부산)으로 찾기 */
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const chosung = (s) => [...s].map((c) => { const k = c.charCodeAt(0) - 0xac00; return k >= 0 && k < 11172 ? CHO[Math.floor(k / 588)] : c; }).join("");
let regions = [], regionHits = [], regionIdx = 0;
(async function initRegions() {
  regions = (await api("/api/regions")).map((r) => ({ ...r, cho: chosung(r.name), overseas: r.tz !== "Asia/Seoul" }));
})();
function showRegions(q) {
  q = q.trim();
  const cq = chosung(q);
  regionHits = regions.filter((r) => !q || r.name.includes(q) || r.cho.startsWith(cq) || r.cho.includes(q)).slice(0, 60);
  regionIdx = 0;
  $("#regionList").innerHTML = regionHits.length
    ? regionHits.map((r, i) => `<li role="option" data-i="${i}" class="${i === 0 ? "act" : ""}">${esc(r.name)}<small>${r.overseas ? "해외 · " : ""}동경 ${r.lon.toFixed(1)}°</small></li>`).join("")
    : `<li class="empty">일치하는 지역이 없습니다. 가까운 도시를 골라 주세요.</li>`;
  $("#regionList").classList.remove("hide");
  $("#regionQ").setAttribute("aria-expanded", "true");
}
function pickRegion(r) {
  $("#regionQ").value = r.name;
  $("#region").value = r.name;
  $("#regionList").classList.add("hide");
  $("#regionQ").setAttribute("aria-expanded", "false");
}
$("#regionQ").addEventListener("focus", (e) => { e.target.select(); showRegions(""); });
$("#regionQ").addEventListener("input", (e) => { $("#region").value = ""; showRegions(e.target.value); });
$("#regionQ").addEventListener("keydown", (e) => {
  const items = $$("#regionList li[data-i]");
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    if (!items.length) return;
    regionIdx = (regionIdx + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items.forEach((li, i) => li.classList.toggle("act", i === regionIdx));
    items[regionIdx].scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter" && !$("#regionList").classList.contains("hide")) {
    e.preventDefault();
    if (regionHits[regionIdx]) pickRegion(regionHits[regionIdx]);
  } else if (e.key === "Escape") {
    $("#regionList").classList.add("hide");
  }
});
$("#regionList").addEventListener("mousedown", (e) => {
  const li = e.target.closest("li[data-i]");
  if (li) { e.preventDefault(); pickRegion(regionHits[+li.dataset.i]); }
});
$("#regionQ").addEventListener("blur", () => {
  $("#regionList").classList.add("hide");
  // 정확히 입력했으면 그대로 선택, 아니면 마지막 선택값으로 되돌림
  const exact = regions.find((r) => r.name === $("#regionQ").value.trim());
  if (exact) pickRegion(exact);
  else if (!$("#region").value) $("#regionQ").value = "";
});

let surTimer;
$("#surKr").addEventListener("input", (e) => {
  clearTimeout(surTimer);
  const kr = e.target.value.trim();
  if (!kr) return;
  surTimer = setTimeout(async () => {
    const opts = await api(`/api/surnames?kr=${encodeURIComponent(kr)}`);
    $("#surHanja").innerHTML = opts.length
      ? opts.map((o) => `<option value="${esc(o.hanja)}">${esc(o.hanja)} · ${esc(o.meaning)} (${o.strokes.join("+")}획)</option>`).join("")
      : `<option value="">해당 한자 없음</option>`;
  }, 250);
});

let evTimer;
$("#evKr").addEventListener("input", (e) => {
  clearTimeout(evTimer);
  evTimer = setTimeout(async () => {
    const syl = [...e.target.value.trim()].slice(0, 2);
    if (!syl.length) return;
    const lists = await Promise.all(syl.map((s) => api(`/api/hanja?q=${encodeURIComponent(s)}&limit=300`)));
    $("#evPick").innerHTML = lists.map((l, i) => `<select data-r="${esc(syl[i])}" aria-label="${esc(syl[i])} 한자">` +
      l.map((c) => `<option value="${esc(c.h)}">${esc(c.h)} ${esc(firstMeaning(c.m))} ${esc(c.r)} (${c.won}획·${c.jw})</option>`).join("") + "</select>").join("");
  }, 300);
});

/* 사주 풀이: 이름 글자별 한자 선택 (모르면 '모름') */
let nmTimer;
$("#personName").addEventListener("input", (e) => {
  clearTimeout(nmTimer);
  nmTimer = setTimeout(async () => {
    const syl = [...e.target.value.trim()].filter((c) => c >= "가" && c <= "힣").slice(0, 5);
    if (!syl.length) return;
    const lists = await Promise.all(syl.map((s) => api(`/api/hanja?q=${encodeURIComponent(s)}&limit=300`)));
    $("#nmPick").innerHTML = lists.map((l, i) => `<select data-r="${esc(syl[i])}" aria-label="${esc(syl[i])} 한자">
      <option value="">${esc(syl[i])} · 한자 모름</option>` +
      l.map((c) => `<option value="${esc(c.h)}">${esc(c.h)} ${esc(firstMeaning(c.m))} (${c.jw})</option>`).join("") + "</select>").join("");
  }, 300);
});
function namePayload() {
  const kr = $("#personName").value.trim();
  const sel = $$("#nmPick select");
  const hanja = sel.length === [...kr].length ? sel.map((s) => s.value || " ").join("") : "";
  return { name_kr: kr || null, name_hanja: hanja.trim() ? hanja : null };
}

/* 불용한자 목록 (처음 펼칠 때 한 번만 불러옴) */
$("#badListBox").addEventListener("toggle", async (e) => {
  if (!e.target.open || $("#badList").dataset.done) return;
  const bad = await (await fetch("data/bad_hanja.json")).json();
  const chips = (arr) => arr.map((h) => `<span>${esc(h)}</span>`).join("");
  $("#badList").innerHTML = `<p><b>전통 불용문자 ${bad.soft.length}자</b> — 체크하면 추천에서 뺍니다 (끄면 점수만 깎고 결과에 경고 표시)</p>
    <div class="bad-chips">${chips(bad.soft)}</div>
    <p><b>뜻이 좋지 않은 글자 ${bad.hard.length}자</b> — 항상 뺍니다 (뜻에 '죽을·병들·귀신' 등이 들어간 글자도 함께 제외)</p>
    <div class="bad-chips hard">${chips(bad.hard)}</div>`;
  $("#badList").dataset.done = "1";
});

/* 부모 사주 반영(선택): 날짜를 입력한 부모만 보냄 */
$("#useParents").addEventListener("change", (e) => {
  if (e.target.checked && !$("#parentCols").children.length) {
    $("#parentCols").innerHTML = duoPersonForm("fa", "아버지", "아기의 아버지", { parent: true }) +
      duoPersonForm("mo", "어머니", "아기의 어머니", { parent: true });
    $$("#parentCols .pf").forEach(duoInitForm);
  }
  $("#parentsBox").classList.toggle("hide", !e.target.checked);
});
function parentsPayload() {
  if (!$("#useParents").checked) return [];
  const out = [];
  for (const [p, label] of [["fa", "아버지"], ["mo", "어머니"]]) {
    if (!$(`.pf[data-p="${p}"] .f-date`).value) continue;
    const x = duoCollect(p, label);
    out.push({ label, name: x.name, year: x.year, month: x.month, day: x.day, hour: x.hour, minute: x.minute,
      calendar: x.calendar, leap_month: x.leap_month, gender: p === "fa" ? "M" : "F", region: x.region });
  }
  if (!out.length) throw new Error("부모 사주를 반영하려면 아버지나 어머니의 생년월일을 입력해 주세요");
  return out;
}

function birthPayload() {
  const [y, m, d] = $("#bdate").value.split("-").map(Number);
  if (!y) throw new Error("생년월일을 입력해 주세요");
  if (!$("#region").value) throw new Error("출생지를 검색해서 목록에서 골라 주세요");
  const noTime = $("#noTime").checked;
  // 오전 12시 = 0시(자정), 오후 12시 = 12시(정오)
  const hh = +$("#bhour").value + (segValue("ampm") === "pm" ? 12 : 0);
  const mm = +$("#bmin").value;
  return {
    year: y, month: m, day: d, hour: noTime ? null : hh, minute: noTime ? 0 : mm,
    calendar: segValue("calendar"), leap_month: $("#leap").checked, gender: segValue("gender"),
    region: $("#region").value, zi_mode: $("#zi").value, apply_eot: $("#eot").checked,
  };
}
function optionsPayload() {
  return {
    sound_school: $("#school").value, min_tier: +$("#tier").value, exclude_soft_bad: $("#softBad").checked,
    fixed_syllable: $("#fixSyl").value.trim() || null, fixed_position: +$("#fixPos").value,
    fixed_hanja: $("#fixHanja").value.trim() || null, single_name: $("#single").checked,
    candidates: $("#cands").value.split(/[,\s]+/).filter(Boolean), top_n: 30,
  };
}

/* ---------- 탭 ---------- */
/* 첫 화면 숫자 4칸: 메뉴별로 다르게 */
const NAMING_STATS = [["9,088", "대법원 인명용 한자"], ["±수 초", "천문 계산 절입 시각"], ["4대 원리", "자원·수리·발음·음양"], ["무료", "회원가입 없이 바로"]];
const HERO_STATS = {
  naming: NAMING_STATS, evaluate: NAMING_STATS, dict: NAMING_STATS,
  saju: [["8개 분야", "성격·재물·학업·연애·건강·직업"], ["5역할", "용신·희신·한신·구신·기신"], ["대운 10 · 세운 1", "대운 10년 단위 · 세운 1년 단위"], ["이름 오행", "내 이름이 사주를 돕는지"]],
  couple: [["7가지", "성격·애정·오행·인연·띠·이름·올해"], ["결혼일", "결혼일 풀이 · 좋은 해 추천"], ["오행 보완", "서로 채워 주는 기운"], ["띠 궁합", "삼합·육합·충·원진"]],
  biz: [["설립일", "사업자등록증 기준 회사 사주"], ["대표 × 회사", "두 사주의 궁합"], ["업종 · 상호", "용신 업종과 회사 이름 오행"], ["5년 운", "연도별 회사 운세"]],
};
/* 진행 단계 4칸 · 상단 작은 글씨: 메뉴별로 다르게 */
const NAMING_STEPS = [["출생 정보", "양력·음력, 시각, 출생지"], ["사주 · 용신 분석", "만세력, 오행, 신강약"], ["인명용 한자 선별", "자원오행, 81수리"], ["이름 추천", "점수와 근거 제시"]];
const HERO_STEPS = {
  naming: NAMING_STEPS,
  evaluate: [["출생 정보", "양력·음력, 시각, 출생지"], ["사주 · 용신 분석", "만세력, 오행, 신강약"], ["이름 한자 대조", "자원오행, 81수리, 발음"], ["이름 감정", "점수와 근거 제시"]],
  saju: [["출생 정보", "이름, 생년월일시, 출생지"], ["사주 세우기", "만세력 · 원국 여덟 글자"], ["오행 · 용신 분석", "십신, 신강약, 5역할"], ["운세 풀이", "분야별 · 대운 · 세운"]],
};
const HERO_EYEBROW = { naming: "四柱八字 · 用神 · 姓名學", evaluate: "四柱八字 · 用神 · 姓名學", dict: "大法院 人名用 漢字",
  saju: "四柱八字 · 用神 · 大運 · 歲運", couple: "宮合 · 四柱八字 · 夫婦", biz: "企業 四柱 · 代表者 · 社名" };
const HERO = {
  naming: ["타고난 사주에 꼭 맞는<br><em>좋은 이름</em>을 지어 드립니다", "생년월일시와 출생지로 사주를 세우고, 부족한 기운을 채우는 한자를 대법원 인명용 한자 중에서 골라 자원오행 · 수리 · 발음오행 · 음양 네 가지 원리로 검증합니다."],
  evaluate: ["지금 쓰는 이름,<br><em>사주와 잘 맞을까요</em>", "이름의 한자를 고르면 사주의 용신과 맞는지, 81수리와 발음오행·음양은 어떤지 항목별 점수로 감정해 드립니다."],
  saju: ["내 사주로 보는<br><em>재물 · 학업 · 연애 · 건강</em>", "정확한 만세력으로 사주를 세우고 성격, 재물운, 학업·시험운, 연애·결혼운, 건강운, 직업·적성, 올해 운세와 대운 흐름까지 풀어 드립니다."],
  couple: ["두 사람의 사주로 보는<br><em>궁합 · 부부 사주</em>", "두 분의 일간·배우자궁·띠·오행 보완·배우자 별 인연과 올해 운까지 비교해 궁합을 풀어 드립니다."],
  biz: ["대표자와 회사가 만나는<br><em>기업 사주</em>", "대표자의 사주와 회사 설립일 사주를 함께 세워 회사의 성격, 재물운, 대표자와의 궁합, 업종, 상호 오행, 연도별 운을 풀어 드립니다."],
  dict: ["대법원 인명용 한자<br><em>9,088자</em> 사전", "음이나 한자로 찾으면 원획(작명 획수), 필획, 자원오행, 급수와 뜻을 함께 보여 드립니다."],
};
$$(".tab").forEach((t) => t.addEventListener("click", () => {
  mode = t.dataset.tab;
  $$(".tab").forEach((x) => x.classList.toggle("on", x === t));
  $("#heroTitle").innerHTML = HERO[mode][0];
  $("#heroSub").textContent = HERO[mode][1];
  $("#heroEyebrow").textContent = HERO_EYEBROW[mode];
  $("#fs1Desc").textContent = { naming: "이름을 지을 분의 성씨와 성별", evaluate: "감정받을 분의 성씨·성별과 이름",
    saju: "풀이를 받을 분의 이름과 성별" }[mode] || "";
  if (HERO_STEPS[mode]) {
    $("#steps").innerHTML = HERO_STEPS[mode].map(([t, d], i) => `<li><i>${"一二三四"[i]}</i><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join("");
  }
  $("#heroStats").innerHTML = HERO_STATS[mode].map(([v, t]) => `<li><b>${esc(v)}</b><span>${esc(t)}</span></li>`).join("");
  const duo = mode === "couple" || mode === "biz";
  $("#birthCard").classList.toggle("hide", mode === "dict" || duo);
  $("#steps").classList.toggle("hide", mode === "dict" || duo);
  $("#duoCard").classList.toggle("hide", !duo);
  const parentMode = mode === "naming" || mode === "evaluate";
  $$(".only-parents").forEach((el) => el.classList.toggle("hide", !parentMode));
  $("#parentsBox").classList.toggle("hide", !(parentMode && $("#useParents").checked));
  $$(".method").forEach((m) => m.classList.toggle("hide", !m.dataset.modes.split(" ").includes(mode)));
  if (duo) buildDuo(mode);
  $("#dictCard").classList.toggle("hide", mode !== "dict");
  $("#evalInputs").classList.toggle("hide", mode !== "evaluate");
  $$(".only-naming").forEach((el) => el.classList.toggle("hide", mode !== "naming"));
  $(".f-sur").classList.toggle("hide", mode === "saju");
  $$(".only-saju").forEach((el) => el.classList.toggle("hide", mode !== "saju"));
  $("#personName").required = mode === "saju";
  $("#surKr").required = mode !== "saju";
  $("#submitBtn").textContent = { naming: "사주 분석하고 이름 짓기", evaluate: "이름 감정하기", saju: "사주 풀이 보기" }[mode] || "";
  $("#out").innerHTML = "";
  setStep(0);
}));
$("#submitBtn").textContent = "사주 분석하고 이름 짓기";

function setStep(n) {
  $$("#steps li").forEach((li, i) => {
    li.classList.toggle("done", i < n);
    li.classList.toggle("on", i === n);
  });
}
setStep(0);

/* 하루 1회 제한 — 서버가 없어 이 브라우저에 기록한다
   · 작명 묶음: 이름 짓기 + 이름 감정 (합쳐서 하루 1회)
   · 사주 묶음: 사주 풀이 + 궁합 + 기업 사주 (합쳐서 하루 1회) */
const QUOTA_GROUPS = {
  name: { label: "작명 서비스", items: "이름 짓기·이름 감정", modes: ["naming", "evaluate"] },
  saju: { label: "사주 서비스", items: "사주 풀이·궁합·기업 사주", modes: ["saju", "couple", "biz"] },
};
const MODE_LABEL = { naming: "이름 짓기", evaluate: "이름 감정", saju: "사주 풀이", couple: "궁합", biz: "기업 사주" };
/** 받침 따라 조사 고르기: josa("궁합","을","를") → "궁합을" */
const josa = (w, a, b) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return w + (c >= 0 && c <= 11171 && c % 28 ? a : b); };
const groupOf = (m) => Object.keys(QUOTA_GROUPS).find((g) => QUOTA_GROUPS[g].modes.includes(m));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장 불가(시크릿 창 등) */ } },
};
const Quota = {
  last(m) { const g = groupOf(m); const r = g && store.get(`unse.quota.${g}`); return r && r.date === today() ? r : null; },
  /** 오늘 이미 썼으면 안내를 띄우고 true */
  blocked(m) {
    if (!this.last(m)) return false;
    this.note();
    const g = QUOTA_GROUPS[groupOf(m)];
    const err = ["couple", "biz"].includes(m) ? $("#duoErr") : $("#err");
    err.textContent = `${g.label}(${g.items})는 합쳐서 하루에 한 번만 이용할 수 있습니다. 내일 다시 이용해 주세요.`;
    return true;
  },
  record(m, data) { const g = groupOf(m); if (g) store.set(`unse.quota.${g}`, { date: today(), mode: m, data }); this.note(); },
  /** 현재 메뉴의 폼 아래에 '오늘 이미 이용' 안내 */
  note() {
    for (const el of $$(".quota-note")) el.classList.add("hide");
    const last = this.last(mode);
    if (!last) return;
    const g = QUOTA_GROUPS[groupOf(mode)];
    const el = ["couple", "biz"].includes(mode) ? $("#duoQuotaNote") : $("#quotaNote");
    el.classList.remove("hide");
    el.innerHTML = `<b>오늘의 ${g.label}를 이미 이용하셨습니다.</b> ${josa(g.items, "은", "는")} 합쳐서 하루에 한 번 무료로 이용할 수 있어요.
      오늘은 <em>${MODE_LABEL[last.mode] || ""}</em>${josa(MODE_LABEL[last.mode] || "", "을", "를").slice(-1)} 이용하셨습니다. 내일 다시 찾아 주세요.
      <button type="button" class="btn-doc quota-replay">오늘 결과 다시 보기</button>`;
    el.querySelector(".quota-replay").onclick = () => {
      const d = last.data;
      if (!d) return;
      if (d.type === "couple" || d.type === "business") window.showDuoResult(d);
      else { render(d); setStep(4); }
      $("#out").scrollIntoView({ behavior: "smooth", block: "start" });
    };
  },
};
window.Quota = Quota;
$$(".tab").forEach((t) => t.addEventListener("click", () => Quota.note()));
Quota.note();

$("#birthForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#err").textContent = "";
  const out = $("#out");
  if (Quota.blocked(mode)) return;
  try {
    const birth = birthPayload();
    out.innerHTML = $("#tplLoading").innerHTML;
    setStep(1);
    let data;
    if (mode === "saju") {
      data = await api("/api/saju", { ...birth, ...namePayload(), question: $("#question").value.trim() || null });
      data.personName = $("#personName").value.trim();
    } else {
      const base = { birth, surname_kr: $("#surKr").value.trim(), surname_hanja: $("#surHanja").value || null, options: optionsPayload() };
      if (mode === "evaluate") {
        const given = $$("#evPick select").map((s) => ({ h: s.value, r: s.dataset.r }));
        if (!given.length) throw new Error("감정할 이름을 입력하고 한자를 골라 주세요");
        data = await api("/api/evaluate", { ...base, given, parents: parentsPayload() });
      } else {
        data = await api("/api/naming", { ...base, parents: parentsPayload() });
      }
    }
    render(data);
    setStep(4);
    Quota.record(mode, data);
    out.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    out.innerHTML = "";
    setStep(0);
    $("#err").textContent = err.message;
  }
});

/* ---------- 렌더링 ---------- */
let lastData = null;
$("#out").addEventListener("click", (e) => {
  const b = e.target.closest("[data-doc]");
  if (!b || !lastData) return;
  if (b.dataset.doc === "saju") return openSajuReport(lastData);
  const n = b.dataset.i === "eval" ? lastData.evaluation : lastData.names[+b.dataset.i];
  openNameReport(n, lastData);
});

function render(d) {
  lastData = d;
  let html = renderSaju(d.saju, d.analysis);
  if (d.fortune) html += renderFortune(d.fortune, d.personName);
  if (d.names) html += renderNames(d.names, d.surname);
  if (d.evaluation) {
    html += `<section class="panel">${secHead("姓名 鑑定", "이름 감정 결과", "")}${parStrip()}${nameCard(d.evaluation, 0, "wide")}</section>`;
  }
  $("#out").innerHTML = html;
}

const secHead = (eyebrow, title, meta) =>
  `<div class="rs-h"><div><p class="eyebrow">${eyebrow}</p><h2>${title}</h2></div>${meta ? `<div class="meta">${meta}</div>` : ""}</div>`;
const subHead = (title, hanja) => `<div class="sub-h"><h3>${title}</h3><small>${hanja}</small></div>`;

function renderSaju(s, a) {
  const order = [0, 1, 2, 3]; // 년 월 일 시
  // 이름 글자가 있으면 '이름' 열을 더해 사주 8자 + 이름 2자 = 10자를 한 표에 보여 준다
  const nm = a.name_elements || [];
  const nameCell = (n) => n ? `<td class="cell e-${n.element} name-cell">${esc(n.h || n.kr)}<small>${esc(n.kr)} · ${n.element}</small></td>` : "<td></td>";
  const nameCol = nm.length ? {
    head: `<th class="name-col">名<b>이름</b></th>`,
    rows: [`<td class="god">${esc(nm[0]?.group || "")}</td>`, nameCell(nm[0]), nameCell(nm[1]),
      `<td class="god">${esc(nm[1]?.group || "")}</td>`, `<td>${[...new Set(nm.map((n) => n.basis))].join("·")}오행</td>`, "<td>–</td>"],
  } : null;
  const head = order.map((i) => `<th>${["年", "月", "日", "時"][i]}<b>${["년주", "월주", "일주", "시주"][i]}</b></th>`).join("") + (nameCol ? nameCol.head : "");
  let ri = 0;
  const row = (label, fn) => `<tr><th>${label}</th>${order.map((i) => fn(s.pillars[i], a.pillars[i], i)).join("")}${nameCol ? nameCol.rows[ri++] : ""}</tr>`;
  const missing = (txt) => `<td class="empty">?<small>${txt}</small></td>`;
  const table = `<table class="wg ${nm.length ? "with-name" : ""}"><thead><tr><th></th>${head}</tr></thead><tbody>
    ${row("십신", (p, ap) => (p ? `<td class="god">${esc(ap.gan_god === "일간(나)" ? "일원" : ap.gan_god)}</td>` : "<td>–</td>"))}
    ${row("천간", (p, ap, i) => (p ? `<td class="cell e-${p.gan_oh} ${i === 2 ? "me" : ""}">${p.gan}<small>${p.gan_kr} · ${p.gan_oh}</small></td>` : missing("시간 미상")))}
    ${row("지지", (p) => (p ? `<td class="cell e-${p.ji_oh}">${p.ji}<small>${p.ji_kr} · ${p.ji_oh}</small></td>` : missing("시간 미상")))}
    ${row("십신", (p, ap) => (p ? `<td class="god">${esc(ap.ji_god)}</td>` : "<td>–</td>"))}
    ${row("지장간", (p, ap) => (p ? `<td class="jj">${ap.jijanggan.join("")}</td>` : "<td>–</td>"))}
    ${row("12운성", (p, ap) => (p ? `<td>${esc(ap.stage)}</td>` : "<td>–</td>"))}
  </tbody></table>`;
  // 이름을 넣기 전(8자)과 비교
  const a8 = lastData?.analysis_saju8;
  const cmp = a8 ? `<div class="basis-note"><b>${esc(a.basis)} = ${OH_ORDER.reduce((t, o) => t + a.element_count[o], 0)}자 기준 풀이</b>
    <span>오행 개수(사주+이름): ${OH_ORDER.map((o) => `<em class="t-${o}">${o} ${a.element_count_saju[o]}${a.element_count[o] > a.element_count_saju[o] ? `+${a.element_count[o] - a.element_count_saju[o]}` : ""}</em>`).join(" · ")}</span>
    <span>사주 8자만: ${esc(a8.strength.label)} · 용신 ${a8.yong} → 이름 포함 10자: ${esc(a.strength.label)} · 용신 ${a.yongsin.element}${a8.strength.label === a.strength.label && a8.yong === a.yongsin.element ? " (변화 없음)" : " (이름이 사주의 균형을 바꿉니다)"}</span></div>` : "";

  const dm = a.day_master;
  const corr = s.correction_minutes != null
    ? `${s.correction_minutes > 0 ? "+" : ""}${s.correction_minutes}분 → ${esc(s.solar_time.slice(11))}`
    : "시간 미상 (삼주 분석)";
  const dayCard = `<div class="day-card">
    <div class="big"><b class="e-${dm.element}">${dm.gan}</b><div><span>일간 · 나를 나타내는 글자</span><strong>${dm.gan}${OH_KR[dm.element]} (${dm.kr}${OH_KR[dm.element]})</strong></div></div>
    <p>${esc(dm.desc)}</p>
    <ul class="info-list">
      <li>양력<b>${esc(s.solar_date)}</b></li>
      <li>음력<b>${esc((s.lunar.text || "").replace("음력 ", ""))}</b></li>
      <li>띠<b>${esc(s.year_animal)}띠</b></li>
      <li>태양시 보정<b>${corr}</b></li>
      <li>절입<b>${esc(s.prev_jie.name)} ${esc(s.prev_jie.time.slice(5))}</b></li>
    </ul></div>`;

  const max = Math.max(...Object.values(a.element_score), 0.1);
  const bars = OH_ORDER.map((o) => `<div class="b"><span class="n t-${o}">${o}<small>${OH_KR[o]} ${a.element_count[o]}개${a.name_elements?.length && a.element_count[o] > a.element_count_saju[o] ? "(名+" + (a.element_count[o] - a.element_count_saju[o]) + ")" : ""}</small><em class="rtag r-${a.roles[o]}">${a.roles[o]}</em></span>
    <div class="track"><div class="fill e-${o}" style="width:${(a.element_score[o] / max) * 100}%"></div></div><span class="v">${a.element_score[o]}</span></div>`).join("");

  const st = a.strength;
  const roleCards = roleRow(a);
  const nowYear = new Date().getFullYear();
  const dw = s.daewoon.list.map((x, i, arr) => {
    const next = arr[i + 1];
    const now = x.year <= nowYear && (!next || nowYear < next.year);
    return `<div class="${now ? "now" : ""}">${x.age}세<b><span class="t-${x.gan_oh}">${x.ganji[0]}</span><span class="t-${x.ji_oh}">${x.ganji[1]}</span></b>${x.year}</div>`;
  }).join("");

  return `<section class="panel">
    ${secHead("四柱 原局", lastData?.personName ? `${esc(lastData.personName)}님의 사주 원국` : "사주 원국", `<span>${esc(s.input.gender === "F" ? "여성" : "남성")}</span><span>${esc(s.input.region)}</span><span>${s.hour_known ? esc(s.standard_time) : "시간 미상"}</span>`)}
    <div class="doc-bar"><span>사주 원국 · 오행 · 용신 · 대운${lastData && lastData.names ? " · 추천 이름 TOP 10" : ""}을 한 장으로 정리한 문서</span>
      <button class="btn-doc" type="button" data-doc="saju">사주 해설서 보기 · 다운로드</button></div>
    ${cmp}
    <div class="wg-wrap">${table}${dayCard}</div>

    ${subHead("오행 분포", "五行")}
    <div class="oh-wrap">${pentagon(a)}<div class="bars">${bars}
      <p class="legend">막대 길이 = 지장간과 월령(月令)을 반영한 가중 점수 · 개수 = 여덟 글자 중 해당 오행 수</p></div></div>

    ${subHead("신강·신약과 용신", "强弱 · 用神")}
    <div class="ys-grid">
      <div>
        <div class="meter"><i style="left:${Math.min(100, Math.max(0, st.ratio * 100))}%"></i></div>
        <div class="meter-lb"><span>극신약</span><span>신약</span><span>중화</span><span>신강</span><span>극신강</span></div>
        <p class="strength-t">${esc(st.label)}<small>일간을 돕는 기운 ${(st.ratio * 100).toFixed(0)}% · ${st.deukryeong ? "득령" : "실령"}</small></p>
        <p class="why">${esc(a.yongsin.why)}</p>
      </div>
      <div class="ys-side">
        <p class="why"><b>용신(用神)</b>은 사주의 균형을 잡아 주는 가장 필요한 기운입니다. 아래와 같이 다섯 오행이 각자 역할을 나눠 맡습니다.</p>
        ${a.johu ? `<p class="why">조후(調候): ${esc(a.johu.why)}</p>` : ""}
      </div>
    </div>
    ${roleCards}

    ${subHead("풀이 요약", "解說")}
    <ul class="summary">${personalize(a.summary, lastData?.personName).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>

    ${a.relations.length ? subHead("합 · 충", "合沖") + `<div class="chips">${a.relations.map((r) => `<span class="chip">${esc(r)}</span>`).join("")}</div>` : ""}
    ${subHead("신살", "神殺")}
    <div class="chips">${a.sinsal.map((r) => `<span class="chip"><b>${esc(r.name)}</b>${esc(r.detail)}</span>`).join("")}</div>

    ${subHead(`대운 · ${s.daewoon.forward ? "순행" : "역행"} · ${s.daewoon.start_age}세 시작`, "大運")}
    <div class="dw">${dw}</div>
  </section>`;
}

/* 운세 풀이: 성격 · 재물 · 학업 · 연애 · 건강 · 직업 · 올해 · 대운 */
const stars = (n) => (n ? "★".repeat(n) + "☆".repeat(5 - n) : "");
function renderFortune(f, name) {
  const who = name ? `${esc(name)}님의 ` : "";
  const L = f.lucky;
  const card = (c) => {
    const isNow = (x, i, arr) => x.year <= f.year && (!arr[i + 1] || f.year < arr[i + 1].year);
    const flow = c.flow ? `<div class="dw-chart">${c.flow.map((x, i, arr) => `<div title="${x.ganji} ${x.score}점" class="${isNow(x, i, arr) ? "now" : ""}">
        <i style="height:${Math.max(8, (x.score - 30) * 1.4)}px" class="${x.score >= 70 ? "hi" : x.score < 55 ? "lo" : ""}"></i>
        <b>${x.ganji}</b><span>${x.age}세</span></div>`).join("")}</div>` : "";
    const nameTable = c.key === "name" ? `<table class="nm-oh"><tr><th></th>${c.chars.map((x) => `<th>${esc(x.kr)}</th>`).join("")}</tr>
        <tr><td>한자</td>${c.chars.map((x) => `<td class="hz">${esc(x.h || "–")}</td>`).join("")}</tr>
        <tr><td>발음오행</td>${c.chars.map((x) => `<td class="t-${x.sound}">${x.sound}</td>`).join("")}</tr>
        <tr><td>자원오행<small>(참고)</small></td>${c.chars.map((x) => `<td class="t-${x.jawon || ""}">${x.jawon || "–"}</td>`).join("")}</tr>
        <tr><td>역할</td>${c.chars.map((x) => `<td><span class="role ${["용신", "희신", "조후"].includes(x.role) ? "e-" + x.sound : "plain"}">${esc(x.role)}</span></td>`).join("")}</tr></table>
      <p class="legend">사주 + 이름 오행 개수: ${OH_ORDER.map((o) => `<span class="t-${o}">${o} ${c.combined[o]}</span>`).join(" · ")}</p>` : "";
    return `<article class="ft ft-${c.key}">
      <header><i>${c.hanja}</i><div><h3>${esc(c.title)}</h3>${c.stars ? `<span class="st">${stars(c.stars)}</span>` : ""}</div>
        ${c.score != null ? `<b class="sc">${c.score}<small>점</small></b>` : ""}</header>
      <p class="hl">${esc(c.headline)}</p>
      ${nameTable}${flow}
      <ul>${c.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
      ${c.advice.length ? `<div class="adv-box"><b>조언</b>${c.advice.map((x) => `<p>${esc(x)}</p>`).join("")}</div>` : ""}
    </article>`;
  };
  const scored = f.categories.filter((c) => c.score != null && !["year", "daewoon"].includes(c.key));
  const summary = scored.map((c) => `<div><span>${c.hanja}</span><b>${c.score}</b><small>${esc(c.title.split(" ")[0])}</small></div>`).join("");
  return `${f.question ? renderQuestion(f.question, who) : ""}<section class="panel">
    ${secHead("運勢 解說", `${who}운세 풀이`, `<span>${f.year}년 기준</span><span>종합 ${f.overall}점</span>`)}
    <div class="ft-top">
      <div class="ft-sum">${summary}</div>
      <div class="lucky"><b>행운의 기운 · ${L.element}(${L.element_kr})</b>
        <span>색 <em>${esc(L.color)}</em></span><span>방향 <em>${esc(L.direction)}</em></span>
        <span>숫자 <em>${esc(L.number)}</em></span><span>계절 <em>${esc(L.season)}</em></span></div>
    </div>
    <div class="ft-grid">${f.categories.map(card).join("")}</div>
    ${subHead("대운별 풀이 · 10년 단위", "大運 解說")}
    <div class="luck-list">${f.daewoon.map((d) => luckRow(d, "dw")).join("")}</div>
    ${subHead(`세운 풀이 · ${f.seun[0].year}~${f.seun[f.seun.length - 1].year}년`, "歲運 解說")}
    <div class="luck-list">${f.seun.map((d) => luckRow(d, "sw")).join("")}</div>
    <p class="legend">점수는 사주의 십신·오행·신강약·용신·신살과 대운·세운을 근거로 산출한 상대적 경향입니다. 명리학은 학파에 따라 해석이 다를 수 있습니다.</p>
  </section>`;
}

/* 질문 풀이: 사용자가 적은 궁금한 점을 중점 분석 */
function renderQuestion(q, who) {
  const sec = (s) => {
    const chart = s.years ? `<div class="q-years">${s.years.map((y) => `<div class="lv-${y.level}" title="${esc(y.notes.join(", "))}">
        <i style="height:${Math.max(6, (y.score - 30) * 1.3)}px"></i><b>${y.year}</b><span>${y.score}</span></div>`).join("")}</div>` : "";
    return `<article class="q-sec"><header><i>${s.hanja}</i><h3>${esc(s.title)}</h3></header>
      ${chart}<ul>${s.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></article>`;
  };
  return `<section class="panel q-panel">
    ${secHead("問 · 質問 解說", `${who}질문 풀이`, q.topics.map((t) => `<span>${esc(t)}</span>`).join(""))}
    <blockquote class="q-quote">“${esc(q.question)}”</blockquote>
    <p class="q-head">${esc(q.headline)}</p>
    <div class="q-grid">${q.sections.map(sec).join("")}</div>
    <div class="adv-box"><b>조언</b>${q.advice.map((x) => `<p>${esc(x)}</p>`).join("")}</div>
  </section>`;
}

/* 대운·세운 한 줄 (클릭하면 상세 풀이 펼침) */
function luckRow(d, kind) {
  const when = kind === "dw" ? `${d.age}~${d.age_end}세<small>${d.year}~${d.year_end}</small>` : `${d.year}년<small>${d.age != null ? d.age + "세" : "회사 운"}</small>`;
  const tags = [d.current ? `<span class="tag now">현재</span>` : "", d.samjae ? `<span class="tag sj">${esc(d.samjae)}</span>` : ""].join("");
  return `<details class="lk ${d.current ? "cur" : ""} ${d.past ? "past" : ""}" ${d.current ? "open" : ""}>
    <summary>
      <span class="when">${when}</span>
      <span class="gz2"><b class="t-${d.elements[0]}">${d.ganji[0]}</b><b class="t-${d.elements[1]}">${d.ganji[1]}</b><small>${esc(d.kr)}</small></span>
      <span class="lk-gods">${esc(d.gods[0])} · ${esc(d.gods[1])}<small>${d.keywords.map(esc).join(" · ")}</small></span>
      <span class="lk-tags">${tags}</span>
      <span class="lv lvl-${d.level}">${d.level}</span><span class="sc2">${d.score}</span>
    </summary>
    <ul>${d.text.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
  </details>`;
}

/* 풀이 첫 문장을 "○○님의 일간은 …"으로 */
function personalize(lines, name) {
  if (!name) return lines;
  return lines.map((x, i) => (i === 0 ? x.replace(/^일간은/, `${name}님의 일간은`) : x));
}

/* 오행 5역할: 용신 · 희신 · 한신 · 구신 · 기신 */
const ROLE_INFO = {
  용신: ["用神", "가장 필요한 기운", "이름·색·방향 등으로 적극 보충"],
  희신: ["喜神", "용신을 돕는 기운", "함께 쓰면 좋은 기운"],
  한신: ["閑神", "영향이 적은 기운", "크게 신경 쓰지 않아도 됨"],
  구신: ["仇神", "기신을 돕는 기운", "지나치면 부담"],
  기신: ["忌神", "가장 피할 기운", "과하게 쓰지 않도록 주의"],
};
const OH_VIRTUE = { 木: "인(仁) · 성장", 火: "예(禮) · 열정", 土: "신(信) · 신용", 金: "의(義) · 결단", 水: "지(智) · 지혜" };
function roleRow(a) {
  const byRole = Object.fromEntries(Object.entries(a.roles).map(([o, r]) => [r, o]));
  return `<div class="roles5">${Object.keys(ROLE_INFO).map((r) => {
    const o = byRole[r], [hz, what, how] = ROLE_INFO[r];
    const good = r === "용신" || r === "희신";
    return `<div class="rc ${good ? "e-" + o + " good" : "r-" + r}">
      <span class="rl">${r} <i>${hz}</i></span><b>${o}</b><span class="vt">${OH_KR[o]} · ${OH_VIRTUE[o]}</span>
      <small>${what}<br>${how}</small></div>`;
  }).join("")}</div>`;
}

/* 오행 상생도: 木→火→土→金→水 원형 배치, 원 크기 = 가중 점수 */
function pentagon(a) {
  const cx = 120, cy = 122, R = 84;
  const max = Math.max(...Object.values(a.element_score), 0.1);
  const pos = OH_ORDER.map((o, i) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return { o, x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang) };
  });
  const ring = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="var(--line-2)" stroke-width="1.5"/>`;
  const star = pos.map((p, i) => { const q = pos[(i + 2) % 5]; return `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" stroke="var(--line)" stroke-dasharray="3 4"/>`; }).join("");
  const need = new Set(a.needed_elements);
  const nodes = pos.map((p) => {
    const r = 15 + 13 * (a.element_score[p.o] / max);
    const mark = need.has(p.o) ? `<circle cx="${p.x}" cy="${p.y}" r="${r + 5}" fill="none" stroke="var(--gold)" stroke-width="2" stroke-dasharray="4 3"/>` : "";
    return `${mark}<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="var(--${{ 木: "wood", 火: "fire", 土: "earth", 金: "metal", 水: "water" }[p.o]})"/>
      <text x="${p.x}" y="${p.y + 6}" text-anchor="middle" font-size="17" font-weight="900" fill="#fff">${p.o}</text>`;
  }).join("");
  return `<svg class="oh-svg" viewBox="0 0 240 244" role="img" aria-label="오행 상생도">${ring}${star}${nodes}
    <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="11" fill="var(--faint)">상생 ↻</text>
    <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="10" fill="var(--faint)">점선 = 필요 오행</text></svg>`;
}

function parStrip() {
  return lastData?.parents ? `<div class="par-strip"><b>부모 사주 반영</b>${lastData.parents.map((p) =>
    `<span>${esc(p.label)}${p.name ? ` <b>${esc(p.name)}</b>` : ""} · ${esc(p.pillars)} · ${esc(p.day_master.gan)}${OH_KR[p.day_master.element]} 일간 · 용신 <em class="t-${p.needed[0]}">${p.needed[0]}</em>${p.needed[1] ? `·<em class="t-${p.needed[1]}">${p.needed[1]}</em>` : ""} · 기신 ${p.gisin}</span>`).join("")}</div>` : "";
}

function renderNames(names, sur) {
  const head = secHead("推薦 姓名", `추천 이름 ${names.length}선`,
    `<span>성씨 ${esc(sur.hanja)}(${esc(sur.kr)}) ${sur.strokes.join("+")}획</span><span>${$("#softBad").checked ? "불용한자 제외" : "불용한자 포함(경고 표시)"}</span><span>${lastData?.parents ? "기본 5항목 × 0.9 + 부모조화 10" : "자원오행 30 · 수리 30 · 발음 15 · 음양 10 · 한자 15"}</span>`);
  if (!names.length) return `<section class="panel">${head}<p>조건에 맞는 이름이 없습니다. 한자 난이도를 넓히거나 돌림자 조건을 바꿔 보세요.</p></section>`;
  const top = names.slice(0, 3).map((n, i) => nameCard(n, i + 1, "feat")).join("");
  const par = parStrip();
  const rest = names.slice(3).map((n, i) => nameCard(n, i + 4)).join("");
  return `<section class="panel">${head}${par}<div class="top3">${top}</div>${rest ? `<div class="rest">${rest}</div>` : ""}</section>`;
}

function grade(score) {
  if (score >= 90) return "최상";
  if (score >= 80) return "우수";
  if (score >= 65) return "양호";
  if (score >= 50) return "보통";
  return "재검토 권장";
}

function nameCard(n, rank, variant = "") {
  const chars = n.chars.map((c) => {
    const good = ["용신", "희신", "조후"].includes(c.role);
    return `<div><b>${esc(c.h)}</b><span class="m">${esc(firstMeaning(c.m))} ${esc(c.r)}</span>${c.won}획 · <span class="t-${c.jw}">${c.jw}</span><br>
      <span class="role ${good ? "e-" + c.jw : "plain"}">${esc(c.role)}</span></div>`;
  }).join("");
  const bd = Object.entries(n.breakdown).map(([k, v]) =>
    `<div class="b"><span>${k}</span><div class="track"><div class="fill" style="width:${(v / (n.breakdown_full || SCORE_FULL)[k]) * 100}%"></div></div><span class="v">${v}</span></div>`).join("");
  const suri = Object.values(n.suri).map((g) => `<tr><td>${esc(g.label)}</td><td>${g.num}${g.num !== g.suri ? `→${g.suri}` : ""}</td><td>${esc(g.name)}</td><td><span class="lv lv-${g.level}">${g.level_kr}</span></td><td>${esc(g.desc)}</td></tr>`).join("");
  const flow = n.sound.syllables.map((s, i) => `<span class="sy">${esc(s)} <span class="t-${n.sound.elements[i]}">${n.sound.elements[i]}</span></span>${i < n.sound.relations.length ? `<em>${n.sound.relations[i]}→</em>` : ""}`).join("");
  const detail = `<table class="suri"><tr><th>격</th><th>획수</th><th>수리</th><th>길흉</th><th>의미</th></tr>${suri}</table>
      <div class="flow">발음오행 ${flow}</div>
      <p class="note-s">획수 음양: ${n.eumyang.join(" · ")}</p>
      ${n.suri_notes.map((x) => `<p class="note-s">※ ${esc(x)}</p>`).join("")}`;
  const ring = `<div class="ring" style="--p:${n.score}"><div><span><b>${n.score.toFixed(1)}</b><small>/ 100</small></span></div></div>`;
  const main = `<div class="nm-head"><div><div class="hj">${esc(n.hanja)}</div><div class="kr">${esc(n.hangul)}</div>
      ${variant === "wide" ? `<span class="grade">${grade(n.score)}</span>` : ""}</div>${ring}</div>
    <div class="cl">${chars}</div>
    <div class="bars bd">${bd}</div>
    ${n.bad_chars && n.bad_chars.length ? `<div class="warn-bad">⚠ 불용한자: ${n.bad_chars.map((x) => `<b>${esc(x.h)}</b> ${esc(x.kind)}`).join(", ")} — 이름에는 피하는 것이 좋습니다.</div>` : ""}
    <div class="cmt">${esc(n.comment.replace(/ ※ 불용한자: .*$/, ""))}</div>
    <button class="btn-doc" type="button" data-doc="name" data-i="${variant === "wide" ? "eval" : rank - 1}">성명 감정서 보기 · 다운로드</button>`;
  if (variant === "wide") {
    return `<article class="nm wide"><div class="nm-main">${main}</div>
      <div class="nm-side"><h3>수리 4격 · 발음 · 음양</h3>${detail}</div></article>`;
  }
  const badge = variant === "feat" ? `<span class="medal">${MEDAL[rank - 1]} 추천</span>` : `<span class="rk">#${rank}</span>`;
  return `<article class="nm ${variant} r${rank}">${badge}${main}
    <details><summary>수리 · 발음 상세 보기</summary>${detail}</details></article>`;
}

/* ---------- 한자 사전 ---------- */
async function dictSearch() {
  const q = $("#dictQ").value.trim();
  if (!q) return;
  const list = await api(`/api/hanja?q=${encodeURIComponent(q)}&limit=400`);
  $("#dictOut").innerHTML = list.length ? list.map((c) => `<div><b>${esc(c.h)}</b><span>${esc(c.m)} ${esc(c.r)}<br>원획 ${c.won} · 필획 ${c.pil}<br>
    자원 <span class="t-${c.jw}">${c.jw}</span>${c.grade ? " · " + esc(c.grade) : ""}</span></div>`).join("") : "<p>결과가 없습니다.</p>";
}
$("#dictBtn").addEventListener("click", dictSearch);
$("#dictQ").addEventListener("keydown", (e) => e.key === "Enter" && dictSearch());
