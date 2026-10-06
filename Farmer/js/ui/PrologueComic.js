// 새 게임 프롤로그 4컷 만화 — 그림은 모두 코드(인라인 SVG)로 그린다

const INK = '#5b4030';
const O = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const O2 = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
const LN = 'fill="none" stroke="#3a2618" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"';
const SKIN = '#f6d2b4';

// ───────── 동글동글 주인공 ─────────
function eyes(type) {
  const dots = `<ellipse cx="-9" cy="-80" rx="3.4" ry="4.4" fill="#3a2618"/><ellipse cx="9" cy="-80" rx="3.4" ry="4.4" fill="#3a2618"/>
    <circle cx="-8" cy="-82" r="1.3" fill="#fff"/><circle cx="10" cy="-82" r="1.3" fill="#fff"/>`;
  return {
    happy: `<path d="M-14 -79 q4.5 -6 9 0 M5 -79 q4.5 -6 9 0" ${LN}/>`,
    tired: `<path d="M-15 -79 h9 M6 -79 h9" ${LN}/><path d="M-15 -74 q4.5 3 9 0 M6 -74 q4.5 3 9 0" fill="none" stroke="#a08ab8" stroke-width="2" stroke-linecap="round"/>`,
    normal: dots,
    determined: `${dots}<path d="M-15 -91 l9 3 M15 -91 l-9 3" ${LN}/>`,
  }[type];
}

function mouth(type) {
  return {
    happy: `<path d="M-7 -67 q7 8 14 0" ${LN}/>`,
    tired: `<path d="M-6 -66 q3 -3 6 0 q3 3 6 0" ${LN}/>`,
    normal: `<path d="M-4 -67 q4 4 8 0" ${LN}/>`,
    determined: `<path d="M-6 -67 h12" ${LN}/>`,
  }[type];
}

/** 머리만 (발밑 기준 좌표계, 머리 중심 = (0, -80)) */
function head(type) {
  const blush = type === 'tired' ? '' : `<ellipse cx="-19" cy="-70" rx="6" ry="3.5" fill="#f6a39a" opacity=".75"/><ellipse cx="19" cy="-70" rx="6" ry="3.5" fill="#f6a39a" opacity=".75"/>`;
  return `<circle cx="0" cy="-80" r="30" fill="${SKIN}" ${O}/>
    <path d="M-31 -80 Q-33 -114 0 -113 Q33 -114 31 -80 Q27 -95 16 -98 Q10 -89 0 -91 Q-8 -98 -14 -97 Q-26 -94 -31 -80 Z" fill="#5a3a24" ${O}/>
    ${eyes(type)}${mouth(type)}${blush}`;
}

/** 굵은 외곽선이 있는 팔 (안쪽은 옷 색) */
function arm(d, shirt) {
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="16" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${shirt}" stroke-width="10" stroke-linecap="round"/>`;
}

const POSES = {
  down: { l: 'M-18 -46 Q-26 -36 -25 -26', r: 'M18 -46 Q26 -36 25 -26', hands: [[-25, -24], [25, -24]] },
  up: { l: 'M-18 -46 Q-26 -36 -25 -26', r: 'M18 -46 Q32 -60 30 -76', hands: [[-25, -24], [30, -79]] },
  desk: { l: 'M-18 -46 Q-18 -40 -9 -40', r: 'M18 -46 Q18 -40 9 -40', hands: [[-8, -40], [8, -40]] },
};

/** 발밑 (x, y) 에 서 있는 주인공. extra 는 손에 든 물건(로컬 좌표) */
function hero({ x, y, s = 1, face = 'happy', pose = 'down', shirt = '#f4efe4', pants = '#6a8cc8', extra = '' }) {
  const p = POSES[pose];
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <rect x="-15" y="-22" width="12" height="20" rx="5" fill="${pants}" ${O}/>
    <rect x="3" y="-22" width="12" height="20" rx="5" fill="${pants}" ${O}/>
    <ellipse cx="-9" cy="-2" rx="9" ry="4.5" fill="#7a4e32" ${O2}/>
    <ellipse cx="9" cy="-2" rx="9" ry="4.5" fill="#7a4e32" ${O2}/>
    <rect x="-21" y="-55" width="42" height="38" rx="15" fill="${shirt}" ${O}/>
    ${arm(p.l, shirt)}${arm(p.r, shirt)}
    ${extra}
    ${p.hands.map(([hx, hy]) => `<circle cx="${hx}" cy="${hy}" r="6" fill="${SKIN}" ${O2}/>`).join('')}
    ${head(face)}
  </g>`;
}

const star = (x, y, s = 1, c = '#ffd25a') => `<path class="twinkle" transform="translate(${x} ${y}) scale(${s})" d="M0 -8 Q1.2 -1.2 8 0 Q1.2 1.2 0 8 Q-1.2 1.2 -8 0 Q-1.2 -1.2 0 -8Z" fill="${c}" ${O2}/>`;
const heart = (x, y, s = 1) => `<path class="float" transform="translate(${x} ${y}) scale(${s})" d="M0 6 C-10 -2 -8 -10 -3 -10 C-1 -10 0 -8 0 -7 C0 -8 1 -10 3 -10 C8 -10 10 -2 0 6Z" fill="#ff8fa8" ${O2}/>`;
const cloud = (x, y, s = 1) => `<g class="drift" transform="translate(${x} ${y}) scale(${s})"><path d="M-30 8 Q-34 -6 -20 -8 Q-16 -22 0 -18 Q14 -26 22 -10 Q36 -8 32 8 Z" fill="#fff" ${O2}/></g>`;

// ───────── 컷 1: 야근하는 도시의 밤 ─────────
const CUT1 = `
  <rect width="320" height="220" fill="#5a6590"/>
  <rect y="172" width="320" height="48" fill="#414a6c"/>
  <rect x="204" y="20" width="94" height="72" rx="8" fill="#2c3558" ${O}/>
  <path d="M251 20 v72 M204 56 h94" stroke="${INK}" stroke-width="3"/>
  <circle cx="276" cy="40" r="11" fill="#ffe9a8"/><circle cx="270" cy="36" r="10" fill="#2c3558"/>
  ${star(224, 36, 0.45, '#fff8d0')}${star(236, 74, 0.35, '#fff8d0')}${star(282, 76, 0.4, '#fff8d0')}
  <circle cx="148" cy="40" r="17" fill="#fff8e8" ${O}/>
  <path d="M148 40 L143 30 M148 40 L139 38" ${LN}/>
  <ellipse cx="200" cy="116" rx="80" ry="54" fill="#d6e4ff" opacity=".13"/>
  ${hero({ x: 112, y: 178, s: 0.95, face: 'tired', pose: 'desk', shirt: '#c9d4e6', pants: '#4a5468' })}
  <path class="drip" d="M145 82 q6 9 0 12 q-6 -3 0 -12z" fill="#a8dcff" ${O2}/>
  <rect x="160" y="86" width="84" height="56" rx="6" fill="#e2ebf8" ${O}/>
  <path d="M172 100 h40 M172 110 h56 M172 120 h30 M172 130 h46" stroke="#93a8d0" stroke-width="3" stroke-linecap="round"/>
  <rect x="195" y="140" width="14" height="6" fill="#8a8fa0" ${O2}/>
  <rect x="18" y="140" width="284" height="14" rx="5" fill="#c09060" ${O}/>
  <rect x="28" y="152" width="264" height="42" fill="#a07048" ${O}/>
  <rect x="30" y="104" width="38" height="36" fill="#fff" ${O2}/><rect x="34" y="96" width="36" height="10" fill="#fff" ${O2} transform="rotate(-6 52 101)"/>
  <path d="M36 114 h26 M36 122 h22 M36 130 h26" stroke="#c8c8d4" stroke-width="2"/>
  <rect x="128" y="124" width="15" height="17" rx="3" fill="#fff" ${O2}/><path d="M143 128 q6 0 6 5 q0 5 -6 5" fill="none" ${O2}/>
  <rect x="268" y="124" width="15" height="17" rx="3" fill="#ffd9b0" ${O2}/>
  <text class="float" x="40" y="62" font-family="Jua, sans-serif" font-size="22" fill="#dfe6ff">Z z z…</text>
  <text x="96" y="208" font-family="Jua, sans-serif" font-size="13" fill="#c8d0ee">PM 11:50</text>`;

// ───────── 컷 2: 짐을 싸는 결심 ─────────
const CUT2 = `
  <defs><linearGradient id="pc-sky2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffcfa8"/><stop offset="1" stop-color="#fff0de"/></linearGradient></defs>
  <rect width="320" height="220" fill="url(#pc-sky2)"/>
  <rect x="6" y="70" width="44" height="110" fill="#a6b0cc" ${O2}/><rect x="46" y="44" width="40" height="136" fill="#8f9abb" ${O2}/>
  <rect x="236" y="100" width="40" height="80" fill="#a6b0cc" ${O2}/><rect x="272" y="62" width="44" height="118" fill="#8f9abb" ${O2}/>
  ${[[14, 82], [28, 82], [14, 100], [28, 100], [54, 56], [68, 56], [54, 76], [68, 76], [54, 96], [244, 112], [258, 112], [280, 74], [296, 74], [280, 94]].map(([x, y]) => `<rect x="${x}" y="${y}" width="8" height="10" rx="1" fill="#ffe7a0"/>`).join('')}
  <rect y="172" width="320" height="48" fill="#ead8b8"/>
  <text x="40" y="30" font-family="Jua, sans-serif" font-size="14" fill="#b07a5a" transform="rotate(-8 40 30)">빵빵~</text>
  <text x="98" y="30" font-family="Jua, sans-serif" font-size="12" fill="#b07a5a">웅성웅성</text>
  <circle cx="186" cy="104" r="5" fill="#fff" ${O2}/><circle cx="200" cy="88" r="7" fill="#fff" ${O2}/>
  <ellipse cx="252" cy="52" rx="58" ry="34" fill="#fff" ${O}/>
  <path d="M206 70 Q230 42 256 60 Q278 44 300 66 L300 72 L206 72 Z" fill="#a6d982"/>
  <rect x="232" y="46" width="22" height="16" fill="#f3e2c4" ${O2}/><path d="M228 48 L243 36 L258 48 Z" fill="#d9614a" ${O2}/>
  <circle cx="284" cy="36" r="7" fill="#ffd25a" ${O2}/>
  ${hero({ x: 118, y: 196, s: 1, face: 'determined', pose: 'up' })}
  <text x="140" y="62" font-family="Jua, sans-serif" font-size="24" fill="#e2685a" stroke="#fff" stroke-width="5" paint-order="stroke" transform="rotate(-10 140 62)">결심!</text>
  ${star(158, 96, 0.9)}${star(76, 118, 0.6)}
  <rect x="178" y="140" width="92" height="52" rx="9" fill="#ee8a62" ${O}/>
  <path d="M204 140 v-11 h40 v11" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
  <path d="M186 141 q14 -18 30 -2" fill="#8cc8f0" ${O2}/><path d="M226 141 q12 -14 26 0" fill="#ffe08a" ${O2}/>
  <path d="M190 156 h76 M224 144 v46" stroke="#c8603e" stroke-width="3"/>
  ${heart(250, 172, 0.9)}`;

// ───────── 컷 3: 초록마을로 가는 버스 ─────────
const CUT3 = `
  <defs><linearGradient id="pc-sky3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a8dcff"/><stop offset="1" stop-color="#e6f6ff"/></linearGradient></defs>
  <rect width="320" height="220" fill="url(#pc-sky3)"/>
  ${cloud(60, 40, 1)}${cloud(240, 30, 0.8)}
  <path d="M190 52 q5 -5 10 0 q5 -5 10 0 M214 64 q4 -4 8 0 q4 -4 8 0" ${LN}/>
  <path d="M0 140 Q70 96 150 128 T320 112 V220 H0 Z" fill="#b8e490" ${O2}/>
  <path d="M0 168 Q90 138 180 160 T320 150 V220 H0 Z" fill="#8cc86a" ${O2}/>
  <circle cx="40" cy="128" r="12" fill="#6cb04a" ${O2}/><rect x="37" y="138" width="6" height="12" fill="#a07048"/>
  <circle cx="300" cy="118" r="14" fill="#6cb04a" ${O2}/><rect x="297" y="130" width="6" height="12" fill="#a07048"/>
  <rect y="190" width="320" height="22" fill="#dcc49c" ${O2}/>
  <path d="M10 201 h22 M60 201 h22 M110 201 h22 M160 201 h22 M210 201 h22 M260 201 h22" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
  <path d="M28 142 h22 M18 158 h28 M32 174 h18" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
  <g class="bob">
    <circle cx="60" cy="178" r="6" fill="#eee" ${O2}/><circle cx="48" cy="172" r="4" fill="#eee" ${O2}/>
    <rect x="66" y="120" width="152" height="64" rx="18" fill="#ffd25a" ${O}/>
    <rect x="68" y="160" width="148" height="9" fill="#7cc05a"/>
    <g transform="translate(140 175) scale(0.42)">${head('happy')}</g>
    <rect x="86" y="130" width="30" height="24" rx="6" fill="#d6f0ff" ${O2}/>
    <rect x="124" y="130" width="32" height="24" rx="6" fill="none" ${O}/>
    <rect x="164" y="130" width="30" height="24" rx="6" fill="#d6f0ff" ${O2}/>
    <rect x="200" y="128" width="14" height="30" rx="4" fill="#d6f0ff" ${O2}/>
    <circle cx="100" cy="184" r="13" fill="#4a4a52" ${O}/><circle cx="100" cy="184" r="5" fill="#d0d0d8"/>
    <circle cx="188" cy="184" r="13" fill="#4a4a52" ${O}/><circle cx="188" cy="184" r="5" fill="#d0d0d8"/>
  </g>
  <rect x="266" y="126" width="8" height="66" fill="#b07a4e" ${O2}/>
  <path d="M232 108 h62 l12 12 l-12 12 h-62 z" fill="#f6e2b4" ${O}/>
  <text x="264" y="125" text-anchor="middle" font-family="Jua, sans-serif" font-size="14" fill="#4f8a36">초록마을</text>
  ${star(130, 102, 0.6)}`;

// ───────── 컷 4: 낡은 집과 밭에서 새 출발 ─────────
const CUT4 = `
  <defs><linearGradient id="pc-sky4" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fdcff"/><stop offset="1" stop-color="#eaf8ff"/></linearGradient></defs>
  <rect width="320" height="220" fill="url(#pc-sky4)"/>
  <g class="spin" style="transform-origin: 286px 34px">
    <path d="M286 6 v8 M286 54 v8 M258 34 h8 M306 34 h8 M266 14 l6 6 M300 48 l6 6 M266 54 l6 -6 M300 20 l6 -6" stroke="#f0b030" stroke-width="3" stroke-linecap="round"/>
  </g>
  <circle cx="286" cy="34" r="15" fill="#ffd25a" ${O2}/>
  ${cloud(170, 30, 0.7)}
  <rect y="128" width="320" height="92" fill="#a6d982"/>
  <path d="M0 128 Q80 118 160 128 T320 124" fill="none" ${O2}/>
  <rect x="104" y="44" width="12" height="22" fill="#b0a69a" ${O2}/>
  <rect x="20" y="78" width="96" height="64" rx="6" fill="#f3e2c4" ${O}/>
  <path d="M10 84 L68 40 L126 84 Z" fill="#c8664a" ${O}/>
  <rect x="80" y="58" width="14" height="10" fill="#a8b4c0" ${O2} transform="rotate(12 87 63)"/>
  <rect x="56" y="106" width="22" height="36" rx="4" fill="#a8784e" ${O}/>
  <circle cx="73" cy="125" r="2" fill="${INK}"/>
  <rect x="28" y="94" width="20" height="18" rx="2" fill="#cfeeff" ${O2}/>
  <path d="M92 96 l4 8 l-3 6 l4 8" fill="none" stroke="#a08870" stroke-width="2" stroke-linecap="round"/>
  ${[0, 1, 2, 3].map((i) => `<rect x="164" y="${146 + i * 17}" width="146" height="10" rx="5" fill="#b07a50" ${O2}/>`
    + [0, 1, 2, 3, 4].map((k) => {
      const x = 178 + k * 28 + (i % 2) * 12;
      const y = 146 + i * 17;
      return `<path d="M${x} ${y + 2} q-5 -7 -9 -4 q4 5 9 4 q5 -7 9 -4 q-4 5 -9 4" fill="#6cc04a" ${O2}/>`;
    }).join('')).join('')}
  ${hero({ x: 136, y: 206, s: 0.95, face: 'happy', pose: 'up', extra: `<path d="M30 -78 L40 -122" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M30 -78 L40 -122" stroke="#c89060" stroke-width="3.5" stroke-linecap="round"/><path d="M36 -124 L54 -116" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M36 -124 L54 -116" stroke="#c6ced6" stroke-width="5" stroke-linecap="round"/>` })}
  ${star(96, 160, 0.8)}${star(184, 112, 0.6)}
  ${heart(112, 92, 0.9)}`;

const CUTS = [CUT1, CUT2, CUT3, CUT4];

/** 4컷 만화 마크업. captions: 각 컷 아래 대사 4줄 */
export function prologueComicHTML(captions) {
  const cuts = CUTS.map((art, i) => `
    <div class="cut">
      <span class="cut-no">${i + 1}</span>
      <svg viewBox="0 0 320 220" xmlns="http://www.w3.org/2000/svg">${art}</svg>
      <div class="cut-cap">${captions[i]}</div>
    </div>`).join('');
  return `
    <div class="comic">
      <div class="comic-head">
        <div class="comic-title">프롤로그</div>
        <button class="btn small comic-skip">건너뛰기 ⏭</button>
      </div>
      <div class="comic-grid">${cuts}</div>
      <div class="comic-foot">
        <small class="comic-hint">클릭하면 다음 컷으로 넘어가요</small>
        <button class="btn primary big comic-start hidden">🌱 초록마을로 출발!</button>
      </div>
    </div>`;
}
