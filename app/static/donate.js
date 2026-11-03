/* 커피 후원: 상단 버튼 · 결과 하단 카드 · 페이지 하단 링크 (config.js 의 SITE.donate.url 사용) */
(function () {
  const d = (window.SITE && window.SITE.donate) || {};
  const on = !!d.url;
  const link = (cls, text) => `<a class="${cls}" href="${esc(d.url)}" target="_blank" rel="noopener">☕ ${esc(text)}</a>`;

  // 결과 화면 맨 아래에 붙이는 후원 카드 (render 함수들이 호출)
  window.donateCard = () => (on ? `<section class="donate-card">
    <div class="dc-icon" aria-hidden="true">☕</div>
    <div class="dc-text"><h3>${esc(d.title)}</h3><p>${esc(d.message)}</p></div>
    ${link("dc-btn", d.button)}
  </section>` : "");

  if (!on) return;
  const tabs = document.querySelector(".top-in");
  if (tabs) tabs.insertAdjacentHTML("beforeend", link("donate-top", "커피 후원"));
  const foot = document.querySelector(".foot-in");
  if (foot) foot.insertAdjacentHTML("beforeend", `<p class="foot-donate">${link("dc-btn sm", d.button)}</p>`);

  // 결과가 그려질 때마다 #out 끝에 후원 카드가 없으면 붙인다
  const out = document.querySelector("#out");
  new MutationObserver(() => {
    if (out.querySelector(".panel:not(.loading)") && !out.querySelector(".donate-card")) {
      out.insertAdjacentHTML("beforeend", window.donateCard());
    }
  }).observe(out, { childList: true });
})();
