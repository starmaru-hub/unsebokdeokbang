/* 메뉴별 히어로 일러스트 (SVG, 금빛 선화 + 주홍 포인트)
   window.heroArt(mode) → SVG 문자열 */
(() => {
  const W = 400, H = 360;

  /* 공통 정의: 금빛 그라데이션, 달빛 */
  const defs = `<defs>
    <linearGradient id="ag" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f6dc9a"/><stop offset=".55" stop-color="#d4a94f"/><stop offset="1" stop-color="#a87b2c"/>
    </linearGradient>
    <linearGradient id="ar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e2533a"/><stop offset="1" stop-color="#a8291a"/>
    </linearGradient>
    <radialGradient id="am" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#fff3d1" stop-opacity=".95"/><stop offset=".55" stop-color="#f3d58e" stop-opacity=".5"/>
      <stop offset="1" stop-color="#f3d58e" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="aglow" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#f3c96b" stop-opacity=".35"/><stop offset="1" stop-color="#f3c96b" stop-opacity="0"/>
    </radialGradient>
  </defs>`;

  /* 구름 문양(운문) 한 덩이 */
  const cloud = (x, y, s = 1, cls = "") => `<g transform="translate(${x} ${y}) scale(${s})"><g class="a-cloud ${cls}">
    <path d="M0 30 C0 18 14 12 22 20 C24 6 44 2 52 14 C60 4 80 8 80 22 C92 20 98 32 90 38 L4 38 C-2 38 -2 31 0 30 Z"
      fill="rgba(246,220,154,.10)" stroke="url(#ag)" stroke-width="1.6"/>
    <path d="M22 20 c4 6 14 6 14 -2 c0 -6 -8 -7 -9 -2" fill="none" stroke="url(#ag)" stroke-width="1.4"/>
    <path d="M52 14 c2 8 14 9 15 1 c1 -6 -7 -8 -9 -3" fill="none" stroke="url(#ag)" stroke-width="1.4"/>
  </g></g>`;

  /* 별 */
  const stars = (pts) => pts.map(([x, y, r], i) =>
    `<circle class="a-star" style="animation-delay:${(i * 0.7) % 4}s" cx="${x}" cy="${y}" r="${r}" fill="#fbe7b0"/>`).join("");

  /* 달 */
  const moon = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r * 2.2}" fill="url(#aglow)"/>
    <circle cx="${x}" cy="${y}" r="${r}" fill="url(#am)"/>`;

  /* 낙관(붉은 도장) */
  const seal = (x, y, s, txt) => `<g transform="translate(${x} ${y})">
    <rect x="0" y="0" width="${s}" height="${s}" rx="4" fill="url(#ar)"/>
    <rect x="3" y="3" width="${s - 6}" height="${s - 6}" rx="2" fill="none" stroke="#ffd9c8" stroke-opacity=".6"/>
    <text x="${s / 2}" y="${s / 2 + s * 0.17}" text-anchor="middle" font-size="${s * 0.5}" font-family="Noto Serif KR,serif" font-weight="900" fill="#fff1e6">${txt}</text>
  </g>`;

  const T = (x, y, size, txt, extra = "") =>
    `<text x="${x}" y="${y}" text-anchor="middle" font-family="Noto Serif KR,serif" font-weight="900" font-size="${size}" ${extra}>${txt}</text>`;

  /* ── 이름 짓기: 족자에 名, 붓과 벼루 ── */
  const naming = () => `
    ${moon(300, 78, 40)}
    ${stars([[60, 50, 1.6], [120, 30, 1.2], [350, 170, 1.4], [40, 150, 1.1], [220, 24, 1.3]])}
    ${cloud(250, 120, .9, "a-drift")}
    <g class="a-float">
      <rect x="118" y="34" width="140" height="10" rx="5" fill="url(#ag)"/>
      <path d="M150 34 L188 8 L226 34" fill="none" stroke="url(#ag)" stroke-width="1.6"/>
      <rect x="126" y="44" width="124" height="230" fill="#f7efdc"/>
      <rect x="126" y="44" width="124" height="230" fill="none" stroke="url(#ag)" stroke-width="3"/>
      <rect x="136" y="54" width="104" height="210" fill="none" stroke="#c9a65a" stroke-opacity=".6"/>
      ${T(188, 175, 92, "名", 'fill="#1f2547"')}
      ${T(188, 222, 18, "福 德 吉 祥", 'fill="#7a6a4a" letter-spacing="4"')}
      ${seal(214, 236, 22, "印")}
      <rect x="112" y="274" width="152" height="12" rx="6" fill="url(#ag)"/>
      <circle cx="112" cy="280" r="7" fill="url(#ar)"/><circle cx="264" cy="280" r="7" fill="url(#ar)"/>
    </g>
    <g transform="translate(276 214) rotate(28)">
      <rect x="-5" y="-70" width="10" height="92" rx="4" fill="url(#ag)"/>
      <rect x="-6" y="-74" width="12" height="8" rx="2" fill="url(#ar)"/>
      <path d="M-6 22 C-8 40 -2 54 0 62 C2 54 8 40 6 22 Z" fill="#1d1b2c" stroke="url(#ag)" stroke-width="1"/>
    </g>
    <ellipse cx="96" cy="306" rx="54" ry="16" fill="#151a33" stroke="url(#ag)" stroke-width="2"/>
    <ellipse cx="90" cy="302" rx="22" ry="6" fill="#0b0e1d"/>
    ${cloud(12, 300, 1, "a-drift2")}
  `;

  /* ── 이름 감정: 이름 두루마리 + 鑑定 도장 + 저울 눈금 ── */
  const evaluate = () => `
    ${moon(320, 70, 34)}
    ${stars([[50, 40, 1.4], [150, 22, 1.2], [370, 200, 1.3], [30, 210, 1.1]])}
    ${cloud(220, 96, .8, "a-drift")}
    <g class="a-float">
      <path d="M70 120 h250 v150 h-250 z" fill="#f7efdc" stroke="url(#ag)" stroke-width="3"/>
      <rect x="58" y="110" width="20" height="170" rx="10" fill="url(#ag)"/>
      <rect x="312" y="110" width="20" height="170" rx="10" fill="url(#ag)"/>
      ${T(150, 210, 54, "姓", 'fill="#1f2547"')}
      ${T(214, 210, 54, "名", 'fill="#1f2547"')}
      <g font-family="Noto Sans KR,sans-serif" font-size="12" fill="#7a6a4a">
        <text x="100" y="244">자원</text><text x="150" y="244">수리</text><text x="200" y="244">발음</text><text x="250" y="244">음양</text>
      </g>
      ${[0, 1, 2, 3].map((i) => `<g transform="translate(${100 + i * 50} 252)">
        ${[0, 1, 2, 3, 4].map((j) => `<circle cx="${j * 6}" cy="0" r="2.2" fill="${j < [5, 4, 5, 4][i] ? "#c4402b" : "#d9ccb0"}"/>`).join("")}
      </g>`).join("")}
    </g>
    <g transform="translate(262 46)"><g class="a-stamp">
      <circle cx="40" cy="40" r="38" fill="url(#ar)"/>
      <circle cx="40" cy="40" r="32" fill="none" stroke="#ffd9c8" stroke-opacity=".7" stroke-width="1.5"/>
      ${T(40, 37, 20, "鑑", 'fill="#fff1e6"')}
      ${T(40, 60, 20, "定", 'fill="#fff1e6"')}
    </g></g>
    ${cloud(20, 300, 1.1, "a-drift2")}
    ${cloud(250, 306, .8, "a-drift")}
  `;

  /* ── 인명용 한자: 펼친 책과 떠오르는 오행 글자 ── */
  const dict = () => {
    const els = [["木", 92, 92, "#7fd09a"], ["火", 160, 52, "#ff8a73"], ["土", 228, 40, "#f3c96b"], ["金", 296, 64, "#e6e2d6"], ["水", 336, 124, "#86b6ee"]];
    return `
    ${stars([[40, 40, 1.4], [370, 30, 1.2], [20, 180, 1.1], [380, 230, 1.3]])}
    <circle cx="200" cy="200" r="170" fill="url(#aglow)"/>
    ${els.map(([c, x, y, col], i) => `<g class="a-bob" style="animation-delay:${i * 0.6}s">
      <circle cx="${x}" cy="${y}" r="24" fill="rgba(20,26,56,.7)" stroke="url(#ag)" stroke-width="1.5"/>
      ${T(x, y + 9, 26, c, `fill="${col}"`)}
    </g>`).join("")}
    <g transform="translate(0 6)">
      <path d="M200 196 C160 176 110 176 62 190 L62 300 C110 288 160 288 200 306 Z" fill="#f7efdc" stroke="url(#ag)" stroke-width="2.5"/>
      <path d="M200 196 C240 176 290 176 338 190 L338 300 C290 288 240 288 200 306 Z" fill="#efe4c9" stroke="url(#ag)" stroke-width="2.5"/>
      <path d="M200 196 V306" stroke="#b08a3e" stroke-width="2"/>
      ${[0, 1, 2].map((r) => T(96 + r * 34, 236 + (r % 2) * 4, 22, "仁義禮"[r], 'fill="#1f2547"')).join("")}
      ${[0, 1, 2].map((r) => T(242 + r * 34, 240 - (r % 2) * 4, 22, "智信德"[r], 'fill="#1f2547"')).join("")}
      <g stroke="#c9b58a" stroke-width="1.2">
        <path d="M82 262 h96"/><path d="M82 274 h90"/><path d="M222 262 h96"/><path d="M228 274 h90"/>
      </g>
      <path d="M56 300 C110 290 160 292 200 312 C240 292 290 290 344 300 L344 310 C290 300 240 304 200 322 C160 304 110 300 56 310 Z" fill="url(#ag)"/>
    </g>
    ${cloud(10, 300, .9, "a-drift2")}
  `;
  };

  /* ── 사주 풀이: 나경(나침반) — 팔괘·십이지 고리가 천천히 돈다 ── */
  const saju = () => {
    const cx = 200, cy = 184;
    const JI = "子丑寅卯辰巳午未申酉戌亥";
    const TRI = ["111", "011", "101", "001", "110", "010", "100", "000"];
    const jiRing = [...JI].map((c, i) => {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * 132, y = cy + Math.sin(a) * 132;
      return T(x.toFixed(1), (y + 7).toFixed(1), 19, c, 'fill="#f6dc9a"');
    }).join("");
    const triRing = TRI.map((bits, i) => {
      const deg = (i / 8) * 360;
      const lines = [...bits].map((b, k) => {
        const y = -100 + k * 9;
        return b === "1" ? `<rect x="-14" y="${y}" width="28" height="5" rx="1" fill="url(#ag)"/>`
          : `<rect x="-14" y="${y}" width="12" height="5" rx="1" fill="url(#ag)"/><rect x="2" y="${y}" width="12" height="5" rx="1" fill="url(#ag)"/>`;
      }).join("");
      return `<g transform="translate(${cx} ${cy}) rotate(${deg})">${lines}</g>`;
    }).join("");
    const ticks = Array.from({ length: 48 }, (_, i) => {
      const a = (i / 48) * Math.PI * 2;
      const r1 = 150, r2 = i % 4 ? 154 : 158;
      return `<path d="M${(cx + Math.cos(a) * r1).toFixed(1)} ${(cy + Math.sin(a) * r1).toFixed(1)} L${(cx + Math.cos(a) * r2).toFixed(1)} ${(cy + Math.sin(a) * r2).toFixed(1)}" stroke="#d4a94f" stroke-width="1.2"/>`;
    }).join("");
    return `
    ${stars([[30, 30, 1.4], [372, 26, 1.2], [20, 330, 1.2], [380, 320, 1.4], [370, 180, 1]])}
    <circle cx="${cx}" cy="${cy}" r="178" fill="url(#aglow)"/>
    <circle cx="${cx}" cy="${cy}" r="162" fill="#151a36" stroke="url(#ag)" stroke-width="3"/>
    <g class="a-spin" style="transform-origin:${cx}px ${cy}px">
      ${ticks}
      <circle cx="${cx}" cy="${cy}" r="146" fill="none" stroke="#d4a94f" stroke-opacity=".7"/>
      ${jiRing}
      <circle cx="${cx}" cy="${cy}" r="114" fill="none" stroke="#d4a94f" stroke-opacity=".7"/>
    </g>
    <g class="a-spin-rev" style="transform-origin:${cx}px ${cy}px">
      ${triRing}
      <circle cx="${cx}" cy="${cy}" r="70" fill="none" stroke="#d4a94f" stroke-opacity=".7"/>
    </g>
    <g transform="translate(${cx} ${cy})">
      <circle r="44" fill="#f7efdc"/>
      <path d="M0 -44 A44 44 0 0 1 0 44 A22 22 0 0 1 0 0 A22 22 0 0 0 0 -44 Z" fill="#1f2547"/>
      <circle cy="-22" r="7" fill="#1f2547"/><circle cy="22" r="7" fill="#f7efdc"/>
      <circle r="44" fill="none" stroke="url(#ag)" stroke-width="3"/>
    </g>
    <path d="M${cx} ${cy - 160} l6 14 h-12 z" fill="url(#ar)"/>
  `;
  };

  /* ── 궁합: 해와 달, 붉은 실로 이어진 囍 ── */
  const couple = () => `
    ${stars([[40, 40, 1.4], [200, 20, 1.2], [370, 210, 1.2], [26, 220, 1.1]])}
    <g class="a-bob"><circle cx="82" cy="104" r="62" fill="url(#aglow)"/>
      <circle cx="82" cy="104" r="34" fill="url(#ar)"/>
      ${T(82, 116, 32, "日", 'fill="#fff1e6"')}</g>
    <g class="a-bob" style="animation-delay:1.2s"><circle cx="318" cy="104" r="62" fill="url(#aglow)"/>
      <circle cx="318" cy="104" r="34" fill="url(#am)"/>
      ${T(318, 116, 32, "月", 'fill="#1f2547"')}</g>
    <path class="a-thread" d="M110 128 C150 210 170 120 200 186 C230 120 250 210 290 128" fill="none" stroke="#e2533a" stroke-width="2.6" stroke-linecap="round"/>
    <g transform="translate(200 214)">
      <circle r="66" fill="#151a36" stroke="url(#ag)" stroke-width="3"/>
      <circle r="56" fill="none" stroke="#d4a94f" stroke-opacity=".6"/>
      ${T(0, 26, 72, "囍", 'fill="url(#ar)"')}
    </g>
    <g transform="translate(200 286)" fill="none" stroke="#e2533a" stroke-width="2.4">
      <path d="M0 0 c-14 -10 -24 4 -12 12 c-10 8 4 20 12 8 c8 12 22 0 12 -8 c12 -8 2 -22 -12 -12 z"/>
      <path d="M-4 24 L-10 52 M4 24 L10 52"/>
    </g>
    ${cloud(10, 290, 1, "a-drift2")}
    ${cloud(292, 296, .9, "a-drift")}
  `;

  /* ── 기업 사주: 엽전과 산, 해 ── */
  const biz = () => `
    ${stars([[40, 36, 1.4], [150, 20, 1.2], [372, 40, 1.2]])}
    <circle cx="290" cy="96" r="80" fill="url(#aglow)"/>
    <circle cx="290" cy="96" r="38" fill="url(#ar)"/>
    <path d="M0 300 L70 214 L120 262 L190 170 L262 250 L314 206 L400 300 Z" fill="#1a2044" stroke="url(#ag)" stroke-width="2"/>
    <path d="M190 170 L210 196 L196 194 L182 206 Z" fill="#f7efdc" opacity=".85"/>
    <g transform="translate(150 170)"><g class="a-float">
      <circle r="78" fill="url(#ag)"/>
      <circle r="68" fill="none" stroke="#7a5418" stroke-width="2"/>
      <rect x="-20" y="-20" width="40" height="40" fill="#151a36" stroke="#7a5418" stroke-width="2"/>
      ${T(0, -34, 24, "財", 'fill="#5a3b0c"')}${T(0, 56, 24, "福", 'fill="#5a3b0c"')}
      ${T(-44, 9, 24, "興", 'fill="#5a3b0c"')}${T(44, 9, 24, "旺", 'fill="#5a3b0c"')}
    </g></g>
    ${[0, 1, 2, 3].map((i) => `<ellipse cx="292" cy="${300 - i * 12}" rx="40" ry="10" fill="url(#ag)" stroke="#7a5418" stroke-width="1.2"/>`).join("")}
    ${cloud(16, 312, 1, "a-drift2")}
  `;

  const ART = { naming, evaluate, dict, saju, couple, biz };
  window.heroArt = (mode) =>
    `<svg viewBox="0 0 ${W} ${H}" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${defs}${(ART[mode] || naming)()}</svg>`;
})();
