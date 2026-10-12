// 새 게임 프롤로그 — 만화책 한 쪽 (인라인 SVG 한 장)
// 사선으로 나뉜 크기가 다른 컷 4개: ① 야근하는 밤 ② 결심 (얼굴 클로즈업) ③ 버스 창밖 ④ 시골집 앞 새 출발 (와이드)
// 그림은 그라데이션 · 빛 · 그림자로 깊이를 주고, 나레이션 상자는 HTML 로 컷 위에 얹는다

const INK = '#2a1d17';
const FONT = 'font-family="Jua, sans-serif"';
const SKIN = '#f8d9bf';
const HAIR = '#5a3823';
const S = (w = 3) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

/**
 * 여러 조각(머리 · 목 · 귀 · 팔 · 손 …)을 한 덩어리로 그린다.
 * ① 모든 조각을 굵은 먹선으로 한 번 ② 그 위에 색만 다시 칠함 → 바깥 테두리만 남고 이음매 선은 사라진다.
 * 조각: { el: '<circle cx=.. cy=.. r=..', fill } 또는 선 조각 { el: '<path d=".."', line: 색, width }. tf = transform
 */
function unit(parts, w = 3) {
  const tf = (p) => (p.tf ? ` transform="${p.tf}"` : '');
  const ink = parts.map((p) => (p.line
    ? `${p.el}${tf(p)} fill="none" stroke="${INK}" stroke-width="${p.width + w * 2}" stroke-linecap="round" stroke-linejoin="round"/>`
    : `${p.el}${tf(p)} fill="${INK}" stroke="${INK}" stroke-width="${w * 2}" stroke-linejoin="round"/>`)).join('');
  const paint = parts.map((p) => (p.line
    ? `${p.el}${tf(p)} fill="none" stroke="${p.line}" stroke-width="${p.width}" stroke-linecap="round" stroke-linejoin="round"/>`
    : `${p.el}${tf(p)} fill="${p.fill}"/>`)).join('');
  return `<g>${ink}${paint}</g>`;
}

/** 같은 그림이 나오도록 고정된 난수 */
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// ───────── 컷 모양 (페이지 1000 × 640, 사선 칸막이) ─────────
const PANELS = [
  'M0 0 H556 L528 302 H0 Z',
  'M576 0 H1000 V302 H548 Z',
  'M0 322 H392 L420 640 H0 Z',
  'M412 322 H1000 V640 H440 Z',
];

// ───────── 만화 연출 도구 ─────────
function lines(cx, cy, list, size, fill = INK) {
  const top = cy - ((list.length - 1) * size * 1.18) / 2 + size * 0.36;
  return list.map((t, i) => `<text x="${cx}" y="${(top + i * size * 1.18).toFixed(1)}" ${FONT} font-size="${size}" text-anchor="middle" fill="${fill}">${t}</text>`).join('');
}

/** 말풍선 (타원 + 꼬리를 한 줄 외곽선으로) */
function speech(cx, cy, rx, ry, tx, ty, list, size = 18) {
  const ang = Math.atan2((ty - cy) / ry, (tx - cx) / rx);
  const pt = (a) => `${(cx + Math.cos(a) * rx).toFixed(1)} ${(cy + Math.sin(a) * ry).toFixed(1)}`;
  const d = `M${pt(ang + 0.26)} A${rx} ${ry} 0 1 1 ${pt(ang - 0.26)} L${tx} ${ty} Z`;
  return `<g class="bubble-pop"><path d="${d}" fill="#fff" ${S(3)}/>${lines(cx, cy, list, size)}</g>`;
}

/** 외침 풍선 (삐죽삐죽) */
function burst(cx, cy, rx, ry, tx, ty, list, size = 20) {
  const r = rng(17);
  const n = 20;
  const tailA = Math.atan2(ty - cy, tx - cx);
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2;
    const k = i % 2 ? 0.84 + r() * 0.05 : 1.1 + r() * 0.14;
    let x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k;
    if (i % 2 === 0 && Math.abs(Math.atan2(Math.sin(a - tailA), Math.cos(a - tailA))) < Math.PI / n) { x = tx; y = ty; }
    d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return `<g class="bubble-pop"><path d="${d}Z" fill="#fff" ${S(3)}/>${lines(cx, cy, list, size, '#d63f36')}</g>`;
}

/** 생각 풍선 (몽글몽글 + 작은 동그라미) */
function thought(cx, cy, rx, ry, trail, list, size = 16) {
  const n = 12;
  let d = '';
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const p = `${(cx + Math.cos(a) * rx).toFixed(1)} ${(cy + Math.sin(a) * ry).toFixed(1)}`;
    d += i ? ` A${(rx * 0.3).toFixed(1)} ${(ry * 0.4).toFixed(1)} 0 0 1 ${p}` : `M${p}`;
  }
  const dots = trail.map(([x, y, rr]) => `<circle cx="${x}" cy="${y}" r="${rr}" fill="#fff" ${S(2.4)}/>`).join('');
  return `<g class="bubble-pop">${dots}<path d="${d} Z" fill="#fff" ${S(3)}/>${lines(cx, cy, list, size)}</g>`;
}

/** 의성어: 색 글씨 + 검은 외곽선 + 흰 테두리 */
function sfx(x, y, text, size, rot, fill) {
  const t = `x="${x}" y="${y}" ${FONT} font-size="${size}" text-anchor="middle" transform="rotate(${rot} ${x} ${y})"`;
  return `<g class="sfx"><text ${t} fill="#fff" stroke="#fff" stroke-width="10" stroke-linejoin="round">${text}</text>
    <text ${t} fill="${fill}" stroke="${INK}" stroke-width="3.6" stroke-linejoin="round" paint-order="stroke">${text}</text></g>`;
}

/** 반짝이 (네 갈래 별) */
const spark = (x, y, s = 1, c = '#fff') => `<path class="twinkle" transform="translate(${x} ${y}) scale(${s})" d="M0 -12 Q1.6 -1.6 12 0 Q1.6 1.6 0 12 Q-1.6 1.6 -12 0 Q-1.6 -1.6 0 -12Z" fill="${c}"/>`;

/** 집중선: 가장자리에서 (cx, cy) 쪽으로 모이는 쐐기 */
function focusLines(cx, cy, inner, color, n, opacity, seed) {
  const r = rng(seed);
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.06;
    const w = 0.01 + r() * 0.022;
    const rin = inner * (0.9 + r() * 0.6);
    const p = (ang, rad) => `${(cx + Math.cos(ang) * rad).toFixed(1)} ${(cy + Math.sin(ang) * rad).toFixed(1)}`;
    d += `M${p(a - w, 700)} L${p(a, rin)} L${p(a + w, 700)} Z `;
  }
  return `<path d="${d}" fill="${color}" opacity="${opacity}"/>`;
}

// ───────── 공통 정의 (그라데이션 · 필터 · 컷 클립) ─────────
const DEFS = `
  <defs>
    <filter id="pc-blur8" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>
    <filter id="pc-blur3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="pc-blur20" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="20"/></filter>
    ${PANELS.map((d, i) => `<clipPath id="pc-clip${i}"><path d="${d}"/></clipPath>`).join('')}
    <linearGradient id="pc-night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141a36"/><stop offset="1" stop-color="#2e3866"/></linearGradient>
    <linearGradient id="pc-desk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7d5f49"/><stop offset="1" stop-color="#4a372b"/></linearGradient>
    <linearGradient id="pc-screen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2f8ff"/><stop offset="1" stop-color="#a9cdf5"/></linearGradient>
    <linearGradient id="pc-facelight" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#8fc8ff" stop-opacity=".55"/><stop offset=".6" stop-color="#8fc8ff" stop-opacity="0"/></linearGradient>
    <radialGradient id="pc-burst" cx="0.55" cy="0.55" r="0.75"><stop offset="0" stop-color="#fff4c8"/><stop offset=".35" stop-color="#ffb468"/><stop offset=".72" stop-color="#ff7466"/><stop offset="1" stop-color="#c8427a"/></radialGradient>
    <radialGradient id="pc-iris" cx="0.5" cy="0.35" r="0.7"><stop offset="0" stop-color="#8a5a3a"/><stop offset="1" stop-color="#2a170e"/></radialGradient>
    <linearGradient id="pc-hair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6e4630"/><stop offset="1" stop-color="#4a2c1a"/></linearGradient>
    <linearGradient id="pc-day" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd2ff"/><stop offset="1" stop-color="#e6f7ff"/></linearGradient>
    <linearGradient id="pc-dawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc4f4"/><stop offset=".55" stop-color="#cfe9f2"/><stop offset="1" stop-color="#ffe0ae"/></linearGradient>
    <linearGradient id="pc-roof" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e0704f"/><stop offset="1" stop-color="#a8432f"/></linearGradient>
    <linearGradient id="pc-field" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b4e07e"/><stop offset="1" stop-color="#7fbf52"/></linearGradient>
    <clipPath id="pc-win"><rect x="34" y="378" width="332" height="194" rx="22"/></clipPath>
    <clipPath id="pc-face1"><circle cx="200" cy="138" r="46"/></clipPath>
  </defs>`;

// ───────── ① 야근하는 밤 ─────────
function cut1() {
  const r = rng(5);
  let city = '';
  for (let x = -10; x < 560;) {
    const w = 34 + r() * 46, h = 60 + r() * 120;
    const col = r() < 0.5 ? '#222a52' : '#2b3462';
    city += `<rect x="${x.toFixed(0)}" y="${(205 - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="${col}"/>`;
    for (let wy = 205 - h + 10; wy < 196; wy += 14) {
      for (let wx = x + 6; wx < x + w - 8; wx += 11) if (r() < 0.32) city += `<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="5" height="7" fill="${r() < 0.7 ? '#ffd98a' : '#9fd0ff'}" opacity=".85"/>`;
    }
    x += w + 2;
  }
  const bokeh = Array.from({ length: 12 }, () => `<circle cx="${(r() * 540).toFixed(0)}" cy="${(40 + r() * 150).toFixed(0)}" r="${(6 + r() * 12).toFixed(0)}" fill="${['#ffcf7a', '#ff9a7a', '#9fd0ff'][Math.floor(r() * 3)]}" opacity=".45" filter="url(#pc-blur3)"/>`).join('');
  return `
    <rect x="0" y="0" width="560" height="305" fill="url(#pc-night)"/>
    ${city}${bokeh}
    <path d="M140 0 V205 M280 0 V205 M420 0 V205 M0 70 H560" stroke="#111632" stroke-width="7"/>
    <!-- 모니터 빛 -->
    <ellipse cx="350" cy="160" rx="170" ry="110" fill="#8fc8ff" opacity=".22" filter="url(#pc-blur20)"/>
    <rect x="0" y="205" width="560" height="100" fill="url(#pc-desk)"/>
    <path d="M0 205 H560" ${S(3)}/>
    <!-- 서류 더미 -->
    <g ${S(2)}>
      <rect x="22" y="170" width="86" height="36" fill="#f4f4f8" transform="rotate(-3 65 188)"/>
      <rect x="26" y="152" width="80" height="22" fill="#fff" transform="rotate(4 66 163)"/>
      <rect x="30" y="136" width="74" height="20" fill="#f4f4f8" transform="rotate(-5 67 146)"/>
      <rect x="84" y="130" width="18" height="16" fill="#ffe36a" transform="rotate(10 93 138)"/>
    </g>
    <!-- 주인공: 턱을 괴고 지쳐 있는 -->
    <!-- 몸 (몸통 · 두 팔 · 오른손이 한 덩어리) -->
    ${unit([
      { el: '<path d="M118 214 Q124 180 200 172 Q276 180 282 214 Z"', fill: '#eef0f4' },
      { el: '<path d="M128 212 Q150 196 172 184"', line: '#eef0f4', width: 18 },
      { el: '<path d="M226 206 H298"', line: '#eef0f4', width: 20 },
      { el: '<circle cx="306" cy="206" r="9"', fill: SKIN },
    ])}
    <path d="M296 198 q3 8 0 16" fill="none" ${S(2)}/>
    <path d="M186 176 L200 196 L214 176" fill="none" ${S(2.4)}/>
    <path d="M197 186 L205 186 L210 214 L201 220 L192 214 Z" fill="#d9534a" ${S(2.2)} transform="rotate(14 201 200)"/>
    <g transform="rotate(-9 200 170)">
      <!-- 머리 (귀 · 얼굴 · 머리카락이 한 덩어리) -->
      ${unit([
        { el: '<ellipse cx="154" cy="140" rx="8" ry="11"', fill: SKIN },
        { el: '<ellipse cx="246" cy="140" rx="8" ry="11"', fill: SKIN },
        { el: '<circle cx="200" cy="138" r="46"', fill: SKIN },
        { el: '<path d="M152 142 Q146 88 200 84 Q254 86 248 142 Q244 116 232 110 L226 128 L214 106 L204 126 L190 104 L180 126 L170 110 Q158 118 152 142 Z"', fill: 'url(#pc-hair)' },
        { el: '<path d="M200 86 C204 70 224 66 232 80 C222 76 210 80 204 90 Z"', fill: HAIR },
      ])}
      <rect x="150" y="90" width="100" height="100" fill="url(#pc-facelight)" clip-path="url(#pc-face1)"/>
      <path d="M152 142 Q158 118 170 110 L180 126 L190 104 L204 126 L214 106 L226 128 L232 110 Q244 116 248 142" fill="none" ${S(2.4)}/>
      <path d="M150 136 q4 4 0 9 M250 136 q-4 4 0 9" fill="none" stroke="#d9a080" stroke-width="2" stroke-linecap="round"/>
      <path d="M170 140 Q182 134 194 140 M206 140 Q218 134 230 140" fill="none" ${S(3.4)}/>
      <path d="M174 142 Q182 148 190 142 Z M210 142 Q218 148 226 142 Z" fill="#3a2a4a"/>
      <path d="M172 152 q10 5 20 0 M208 152 q10 5 20 0" fill="none" stroke="#9a80c0" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M192 166 q4 -4 8 0 q4 4 8 0" fill="none" ${S(2.4)}/>
    </g>
    <!-- 턱을 괸 손 (얼굴 앞이라 테두리를 둔다) -->
    <path d="M158 190 Q156 176 168 172 Q184 168 190 178 Q192 188 180 192 Q168 196 158 190 Z" fill="${SKIN}" ${S(2.4)}/>
    <path d="M170 180 q8 -2 14 2" fill="none" stroke="#d9a080" stroke-width="2" stroke-linecap="round"/>
    <path d="M250 112 Q258 126 250 132 Q242 126 250 112 Z" class="drip" fill="#bfe6ff" ${S(2)}/>
    ${Array.from({ length: 6 }, (_, i) => `<path d="M${168 + i * 13} 64 v${12 + (i % 3) * 6}" stroke="#c9d2f0" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>`).join('')}
    <!-- 모니터 -->
    <rect x="300" y="104" width="150" height="94" rx="8" fill="#2b2f3a" ${S()}/>
    <rect x="308" y="112" width="134" height="76" rx="3" fill="url(#pc-screen)"/>
    <path d="M318 126 h70 M318 138 h104 M318 150 h56 M318 162 h88 M318 174 h40" stroke="#7d9ccc" stroke-width="4" stroke-linecap="round"/>
    <rect x="364" y="198" width="22" height="8" fill="#3a3f4c" ${S(2)}/>
    <!-- 종이컵 · 시계 -->
    <g ${S(2.2)}>
      <path d="M460 206 l4 -30 h22 l4 30 Z" fill="#fff"/><path d="M480 206 l4 -26 h20 l4 26 Z" fill="#f2e6d6" transform="rotate(8 494 193)"/>
      <path d="M466 186 h20" stroke="#c8a888"/>
    </g>
    <rect x="474" y="132" width="74" height="34" rx="6" fill="#16161c" ${S(2.4)}/>
    <text x="511" y="157" ${FONT} font-size="22" text-anchor="middle" fill="#ff5a4a">23:50</text>
    ${speech(84, 116, 66, 32, 152, 160, ['하아…', '오늘도 야근…'], 17)}`;
}

// ───────── ② 결심 (얼굴 클로즈업) ─────────
function cut2() {
  return `
    <rect x="540" y="0" width="470" height="305" fill="url(#pc-burst)"/>
    ${focusLines(800, 170, 130, '#ffffff', 80, 0.45, 9)}
    ${spark(612, 64, 1.1)}${spark(960, 220, 0.9)}${spark(700, 40, 0.6)}${spark(980, 150, 0.6)}
    <!-- 어깨 -->
    <path d="M664 306 Q676 262 800 254 Q924 262 936 306 Z" fill="#f4efe4" ${S()}/>
    <!-- 얼굴 (귀 · 목 · 얼굴 · 머리카락이 한 덩어리) -->
    ${unit([
      { el: '<path d="M770 226 V258 Q800 280 830 258 V226 Z"', fill: SKIN },
      { el: '<ellipse cx="702" cy="192" rx="16" ry="22"', fill: SKIN },
      { el: '<ellipse cx="898" cy="192" rx="16" ry="22"', fill: SKIN },
      { el: '<circle cx="800" cy="178" r="98"', fill: SKIN },
      { el: '<path d="M698 184 Q690 64 800 60 Q912 64 902 184 Q896 136 872 124 L864 158 L842 114 L826 150 L804 108 L786 150 L766 112 L752 152 L736 126 Q712 138 698 184 Z"', fill: 'url(#pc-hair)' },
    ], 3.4)}
    <path d="M${800 - 94} ${178 + 28} A98 98 0 0 0 ${800 + 94} ${178 + 28}" fill="none" ${S(3)}/>
    <path d="M764 256 Q800 284 836 256" fill="none" ${S(3)}/>
    <path d="M698 184 Q712 138 736 126 L752 152 L766 112 L786 150 L804 108 L826 150 L842 114 L864 158 L872 124 Q896 136 902 184" fill="none" ${S(3)}/>
    <path d="M696 184 q6 8 0 16 M904 184 q-6 8 0 16" fill="none" stroke="#d9a080" stroke-width="2.6" stroke-linecap="round"/>
    <ellipse cx="744" cy="222" rx="18" ry="9" fill="#ff8f80" opacity=".45"/>
    <ellipse cx="856" cy="222" rx="18" ry="9" fill="#ff8f80" opacity=".45"/>
    <path d="M740 92 Q780 70 830 76" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".35"/>
    <!-- 불타는 눈 -->
    <path d="M736 150 L786 162 M864 150 L814 162" ${S(8)}/>
    <g>
      <ellipse cx="764" cy="194" rx="17" ry="23" fill="url(#pc-iris)" ${S(3)}/>
      <ellipse cx="836" cy="194" rx="17" ry="23" fill="url(#pc-iris)" ${S(3)}/>
      <path d="M743 178 Q764 166 786 178 M814 178 Q836 166 857 178" fill="none" ${S(5)}/>
      <circle cx="758" cy="184" r="6.5" fill="#fff"/><circle cx="830" cy="184" r="6.5" fill="#fff"/>
      <circle cx="770" cy="204" r="3" fill="#fff"/><circle cx="842" cy="204" r="3" fill="#fff"/>
      ${spark(766, 196, 0.45, '#ffe58a')}${spark(838, 196, 0.45, '#ffe58a')}
    </g>
    <path d="M800 208 q4 7 0 11" fill="none" ${S(2.4)}/>
    <path d="M774 236 Q800 254 826 236 Q822 260 800 262 Q778 260 774 236 Z" fill="#b8413c" ${S(3)}/>
    <path d="M778 238 Q800 250 822 238 L820 244 Q800 254 780 244 Z" fill="#fff"/>
    <!-- 불끈 쥔 주먹 (가방 손잡이) -->
    <path d="M586 236 H612 M676 236 H700" stroke="#7a4a2e" stroke-width="13" stroke-linecap="round"/>
    ${unit([
      { el: '<rect x="606" y="262" width="66" height="50"', fill: '#f4efe4' },
      { el: '<rect x="598" y="200" width="84" height="74" rx="26"', fill: SKIN },
    ], 3.2)}
    <path d="M608 272 Q640 280 670 272" fill="none" ${S(2.6)}/>
    <path d="M610 222 H672 M608 240 H674 M612 257 H668" fill="none" ${S(2.6)}/>
    <path d="M600 212 Q636 196 674 214" fill="none" ${S(3)}/>
    <path d="M574 196 l-14 -10 M570 222 l-18 -2 M576 250 l-16 8" ${S(3)}/>
    ${sfx(646, 176, '불끈!', 30, -10, '#ff8a3c')}
    ${burst(912, 78, 74, 42, 872, 132, ['그래,', '결심했어!'], 21)}`;
}

// ───────── ③ 버스 창밖 ─────────
function cut3() {
  const r = rng(13);
  const streaks = Array.from({ length: 14 }, () => {
    const y = 470 + r() * 100, x = 30 + r() * 260;
    return `<path d="M${x.toFixed(0)} ${y.toFixed(0)} h${(40 + r() * 90).toFixed(0)}" stroke="#fff" stroke-width="${(1.5 + r() * 2).toFixed(1)}" stroke-linecap="round" opacity=".55"/>`;
  }).join('');
  return `
    <rect x="0" y="318" width="430" height="326" fill="#efe1c6"/>
    <rect x="0" y="590" width="430" height="54" fill="#dccaa8"/>
    <!-- 창밖 -->
    <g clip-path="url(#pc-win)">
      <rect x="30" y="374" width="340" height="200" fill="url(#pc-day)"/>
      <circle cx="330" cy="400" r="40" fill="#fff" opacity=".8" filter="url(#pc-blur20)"/>
      <path d="M30 470 L92 418 L150 452 L222 398 L300 450 L372 414 V580 H30 Z" fill="#a9d6cb"/>
      <path d="M30 500 Q120 462 222 492 T372 480 V580 H30 Z" fill="#8fcf6e"/>
      <rect x="30" y="522" width="340" height="60" fill="#78bd55"/>
      ${[0, 1, 2, 3].map((i) => `<path d="M30 ${532 + i * 12} H372" stroke="#6aab48" stroke-width="5"/>`).join('')}
      ${[70, 150, 240, 330].map((x) => `<circle cx="${x}" cy="505" r="${16 + (x % 7)}" fill="#5ea844" filter="url(#pc-blur3)"/>`).join('')}
      ${streaks}
      <g>
        <rect x="112" y="540" width="6" height="40" fill="#8a8f96"/>
        <rect x="56" y="500" width="120" height="42" rx="6" fill="#2f8a4a" stroke="#fff" stroke-width="3"/>
        <text x="116" y="528" ${FONT} font-size="19" text-anchor="middle" fill="#fff">초록마을 3km</text>
      </g>
      <path d="M60 374 L130 374 L40 580 L30 580 Z M160 374 L190 374 L100 580 L80 580 Z" fill="#fff" opacity=".22"/>
    </g>
    <rect x="34" y="378" width="332" height="194" rx="22" fill="none" stroke="#b6a382" stroke-width="12"/>
    <rect x="28" y="372" width="344" height="206" rx="26" fill="none" ${S(3)}/>
    <rect x="40" y="384" width="320" height="182" rx="18" fill="none" ${S(2)}/>
    <!-- 좌석 -->
    <path d="M244 644 L256 566 Q264 544 294 544 H430 V644 Z" fill="#3f8f8a" ${S()}/>
    <path d="M262 580 H430" stroke="#2f7470" stroke-width="4"/>
    <!-- 주인공 옆모습 (창밖을 보는) -->
    <path d="M258 644 Q264 590 318 578 Q372 590 384 644 Z" fill="#f4efe4" ${S()}/>
    <!-- 머리 (목 · 얼굴 · 귀 · 머리카락이 한 덩어리) -->
    ${unit([
      { el: '<path d="M300 540 L298 586 Q318 596 340 586 L338 540 Z"', fill: SKIN },
      { el: '<circle cx="318" cy="512" r="52"', fill: SKIN },
      { el: '<path d="M264 500 Q262 452 318 446 Q374 448 372 506 Q372 532 362 546 Q356 520 344 506 Q334 492 318 490 L312 476 L300 494 L292 480 L282 498 L276 486 Q268 492 264 500 Z"', fill: 'url(#pc-hair)' },
      { el: '<ellipse cx="342" cy="524" rx="10" ry="13"', fill: SKIN },
    ], 3.2)}
    <path d="M273 538 A52 52 0 0 0 332 562" fill="none" ${S(2.8)}/>
    <path d="M288 584 Q318 600 348 584" fill="none" ${S(3)}/>
    <path d="M264 500 Q268 492 276 486 L282 498 L292 480 L300 494 L312 476 L318 490 Q334 492 344 506 Q356 520 362 546" fill="none" ${S(2.6)}/>
    <path d="M300 462 Q326 452 350 462" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".3"/>
    <path d="M336 512 Q354 510 352 525 Q351 539 336 537" fill="none" ${S(2.6)}/>
    <path d="M340 518 q5 5 0 11" fill="none" stroke="#d9a080" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M378 476 q12 -2 20 4 M380 496 q10 2 16 8" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>
    <ellipse cx="288" cy="516" rx="7" ry="9.5" fill="url(#pc-iris)" ${S(2)}/>
    <circle cx="286" cy="512" r="2.6" fill="#fff"/>
    <path d="M278 500 q10 -5 18 0" fill="none" ${S(2.6)}/>
    <ellipse cx="294" cy="536" rx="10" ry="5" fill="#ff8f80" opacity=".5"/>
    <path d="M270 540 q6 5 12 1" fill="none" ${S(2.4)}/>
    ${thought(176, 452, 98, 34, [[270, 492, 5], [258, 480, 7]], ['할아버지의 시골집…', '어떤 곳일까?'], 16)}
    ${sfx(76, 616, '덜컹덜컹', 22, -6, '#ffd25a')}`;
}

// ───────── ④ 시골집 앞 새 출발 (와이드) ─────────
function cut4() {
  const rays = Array.from({ length: 9 }, (_, i) => {
    const a = -Math.PI + 0.25 + i * 0.33;
    const x1 = 870 + Math.cos(a - 0.05) * 600, y1 = 478 + Math.sin(a - 0.05) * 600;
    const x2 = 870 + Math.cos(a + 0.05) * 600, y2 = 478 + Math.sin(a + 0.05) * 600;
    return `<path d="M870 478 L${x1.toFixed(0)} ${y1.toFixed(0)} L${x2.toFixed(0)} ${y2.toFixed(0)} Z" fill="#fff" opacity=".16"/>`;
  }).join('');
  const sprouts = [];
  [[560, 8], [584, 10], [610, 12], [638, 15]].forEach(([y, t], i) => {
    sprouts.push(`<rect x="680" y="${y}" width="330" height="${t}" rx="${t / 2}" fill="#9a6a44" ${S(2)}/>`);
    for (let x = 700 + (i % 2) * 14; x < 1000; x += 34 + i * 4) {
      const s = 0.8 + i * 0.18;
      sprouts.push(`<path transform="translate(${x} ${y + 1}) scale(${s})" d="M0 0 q-6 -9 -11 -5 q5 6 11 5 q6 -9 11 -5 q-5 6 -11 5" fill="#5fbf45" ${S(1.6)}/>`);
    }
  });
  return `
    <rect x="405" y="318" width="600" height="326" fill="url(#pc-dawn)"/>
    ${rays}
    <circle cx="870" cy="478" r="80" fill="#fff4c8" opacity=".9" filter="url(#pc-blur20)"/>
    <circle cx="870" cy="478" r="30" fill="#ffd56a"/>
    <path d="M540 372 q8 -8 16 0 q8 -8 16 0 M574 392 q6 -6 12 0 q6 -6 12 0" fill="none" ${S(2.6)}/>
    <path d="M405 482 L500 430 L580 462 L680 416 L780 466 L860 440 L1005 476 V644 H405 Z" fill="#a8cdb9"/>
    <path d="M405 504 Q560 472 700 502 T1005 494 V644 H405 Z" fill="#93cf72" ${S(2)}/>
    <path d="M405 546 Q700 524 1005 540 V644 H405 Z" fill="url(#pc-field)"/>
    <!-- 낡은 시골집 -->
    <ellipse cx="556" cy="552" rx="100" ry="10" fill="#4f7a3a" opacity=".3"/>
    <rect x="598" y="426" width="18" height="34" fill="#a49a8e" ${S(2.4)}/>
    <rect x="482" y="470" width="146" height="80" fill="#f3e4c6" ${S()}/>
    <path d="M482 492 H628 M520 470 V550 M592 470 V550" stroke="#b08a66" stroke-width="4"/>
    <path d="M464 480 Q510 448 555 418 Q600 448 646 480 Z" fill="url(#pc-roof)" ${S()}/>
    <path d="M488 466 Q520 446 555 424 M520 474 Q540 456 556 444 M590 474 Q572 456 556 444" fill="none" stroke="#8f3a28" stroke-width="2.4" opacity=".7"/>
    <rect x="540" y="506" width="28" height="44" rx="3" fill="#a8784e" ${S(2.6)}/>
    <circle cx="562" cy="530" r="2.4" fill="${INK}"/>
    <rect x="494" y="500" width="22" height="22" fill="#cfeaf8" ${S(2.4)}/>
    <path d="M490 516 L520 504" stroke="#9a7048" stroke-width="7" stroke-linecap="round"/>
    <rect x="596" y="500" width="22" height="22" fill="#cfeaf8" ${S(2.4)}/>
    <path d="M600 504 l8 8 l-4 6 M610 502 l-2 6" fill="none" stroke="#8aa0b0" stroke-width="1.6"/>
    <path d="M622 482 l-6 10 l5 6 l-5 10" fill="none" stroke="#a08870" stroke-width="2" stroke-linecap="round"/>
    ${[640, 656, 672, 688].map((x, i) => `<rect x="${x}" y="${528 + i}" width="8" height="${24 - i}" fill="#c9a476" ${S(1.8)}/>`).join('')}
    <path d="M636 538 H696" stroke="#c9a476" stroke-width="4"/>
    ${sprouts.join('')}
    <!-- 주인공 뒷모습 (호미를 어깨에) -->
    <ellipse cx="764" cy="630" rx="44" ry="8" fill="#3f6a2c" opacity=".3"/>
    <path d="M812 552 L846 450" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
    <path d="M812 552 L846 450" stroke="#c8925e" stroke-width="5" stroke-linecap="round"/>
    <path d="M838 446 L872 456 L866 466 L842 460 Z" fill="#c9d1d8" ${S(2.6)}/>
    <!-- 몸 (다리 · 몸통 · 두 팔 · 손이 한 덩어리) -->
    ${unit([
      { el: '<rect x="752" y="590" width="15" height="38" rx="6"', fill: '#5d7fb8' },
      { el: '<rect x="773" y="590" width="15" height="38" rx="6"', fill: '#5d7fb8' },
      { el: '<path d="M744 556 Q736 578 742 594"', line: '#f4efe4', width: 11 },
      { el: '<path d="M796 556 Q818 544 824 522"', line: '#f4efe4', width: 11 },
      { el: '<circle cx="742" cy="598" r="7"', fill: SKIN },
      { el: '<circle cx="826" cy="515" r="8"', fill: SKIN },
      { el: '<rect x="740" y="540" width="60" height="64" rx="20"', fill: '#f4efe4' },
    ])}
    <path d="M770 604 V628" ${S(2.2)}/>
    <path d="M738 592 q4 3 9 1 M820 524 q5 3 10 0" fill="none" ${S(2)}/>
    <!-- 머리 (목 · 귀 · 뒤통수가 한 덩어리) -->
    ${unit([
      { el: '<path d="M760 528 V548 Q770 552 780 548 V528 Z"', fill: SKIN },
      { el: '<ellipse cx="736" cy="516" rx="8" ry="11"', fill: SKIN },
      { el: '<ellipse cx="804" cy="516" rx="8" ry="11"', fill: SKIN },
      { el: '<circle cx="770" cy="508" r="34"', fill: 'url(#pc-hair)' },
    ])}
    <path d="M750 534 Q760 540 762 530 M790 534 Q780 540 778 530" fill="none" ${S(2)}/>
    <path d="M754 546 Q770 554 786 546" fill="none" ${S(2.6)}/>
    <path d="M744 492 Q770 474 798 490" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".3"/>
    ${spark(720, 470, 0.7)}${spark(850, 520, 0.55)}${spark(700, 590, 0.5, '#fff6c8')}
    ${speech(624, 404, 86, 34, 744, 486, ['좋아, 여기서', '다시 시작이다!'], 18)}`;
}

// 나레이션 상자 위치 (페이지 대비 %)
const CAPS = [
  { left: 1.4, top: 2.2, w: 33 },
  { left: 60.5, top: 2.2, w: 23 },
  { left: 1.4, top: 52.6, w: 32 },
  { right: 1.4, top: 52.6, w: 27 },
];

/** 프롤로그 마크업. captions: 컷마다 나레이션 */
export function prologueComicHTML(captions) {
  const arts = [cut1(), cut2(), cut3(), cut4()];
  const groups = arts.map((art, i) => `<g class="cut" data-cut="${i}"><g clip-path="url(#pc-clip${i})">${art}</g><path d="${PANELS[i]}" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/></g>`).join('');
  const caps = captions.map((c, i) => {
    const p = CAPS[i];
    const pos = `${p.left != null ? `left:${p.left}%` : `right:${p.right}%`};top:${p.top}%;max-width:${p.w}%`;
    return `<div class="cut-cap" data-cut="${i}" style="${pos}">${c}</div>`;
  }).join('');
  return `
    <div class="comic">
      <div class="comic-head">
        <div class="comic-title">프롤로그</div>
        <button class="btn small comic-skip">건너뛰기 ⏭</button>
      </div>
      <div class="comic-page">
        <svg viewBox="0 0 1000 640" xmlns="http://www.w3.org/2000/svg">${DEFS}${groups}</svg>
        ${caps}
      </div>
      <div class="comic-foot">
        <small class="comic-hint">클릭하면 다음 컷으로 넘어가요</small>
        <button class="btn primary big comic-start hidden">🌱 초록마을로 출발!</button>
      </div>
    </div>`;
}
