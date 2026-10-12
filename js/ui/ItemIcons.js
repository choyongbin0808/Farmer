// 이모지 대신 직접 그린 아이템 아이콘 (SVG). items.js 에서 svg: '이름' 으로 지정한다

// 성장 촉진제: 구리빛 테두리의 모래시계 (위는 조금, 아래는 수북한 금빛 모래)
function hourglass() {
  return `<svg class="gear-svg item-svg" viewBox="0 0 64 64" aria-hidden="true">
  <defs>
    <linearGradient id="hg-cap" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f6a98a"/><stop offset="0.45" stop-color="#d0583f"/><stop offset="1" stop-color="#8c2c22"/>
    </linearGradient>
    <linearGradient id="hg-post" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#7d2a20"/><stop offset="0.45" stop-color="#e08566"/><stop offset="1" stop-color="#8c2c22"/>
    </linearGradient>
    <linearGradient id="hg-glass" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.95"/><stop offset="0.5" stop-color="#e3f3fb" stop-opacity="0.75"/><stop offset="1" stop-color="#b9dcec" stop-opacity="0.9"/>
    </linearGradient>
    <linearGradient id="hg-sand" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffd877"/><stop offset="1" stop-color="#e48a2a"/>
    </linearGradient>
  </defs>
  <ellipse cx="32" cy="58.5" rx="21" ry="3" fill="#000" opacity="0.18"/>
  <path d="M20 12.5 C20 24 29 27.5 30.2 32 C29 36.5 20 40 20 51.5 L44 51.5 C44 40 35 36.5 33.8 32 C35 27.5 44 24 44 12.5 Z" fill="url(#hg-glass)" stroke="#8fbfd4" stroke-width="1.2"/>
  <path d="M23.6 21 C25.5 26 29.6 28.6 32 31.2 C34.4 28.6 38.5 26 40.4 21 Z" fill="url(#hg-sand)"/>
  <rect x="31.3" y="31" width="1.4" height="13" rx="0.7" fill="#eb9a30"/>
  <path d="M20.8 51.5 C21.6 45 27 41.6 32 41 C37 41.6 42.4 45 43.2 51.5 Z" fill="url(#hg-sand)"/>
  <path d="M23 16 C23.5 23 27 26 28.6 28.6" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity="0.85"/>
  <path d="M23 48.5 C23.4 44 25.5 41 27.5 39.6" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity="0.6"/>
  <rect x="13.5" y="11" width="5" height="42" rx="2.2" fill="url(#hg-post)" stroke="#5c1d16" stroke-width="1"/>
  <rect x="45.5" y="11" width="5" height="42" rx="2.2" fill="url(#hg-post)" stroke="#5c1d16" stroke-width="1"/>
  <rect x="10" y="4" width="44" height="9.5" rx="4.5" fill="url(#hg-cap)" stroke="#5c1d16" stroke-width="1.4"/>
  <rect x="10" y="50.5" width="44" height="9.5" rx="4.5" fill="url(#hg-cap)" stroke="#5c1d16" stroke-width="1.4"/>
  <rect x="14" y="5.6" width="30" height="2.2" rx="1.1" fill="#fff" opacity="0.55"/>
  <rect x="14" y="52.1" width="30" height="2.2" rx="1.1" fill="#fff" opacity="0.5"/>
</svg>`;
}

// 갈아엎기: 흙더미를 뒤집는 호미 + 빙 도는 화살표
function plow() {
  return `<svg class="gear-svg item-svg" viewBox="0 0 64 64" aria-hidden="true">
  <defs>
    <linearGradient id="pl-soil" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#a8754a"/><stop offset="1" stop-color="#6b4226"/>
    </linearGradient>
    <linearGradient id="pl-blade" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#eef2f5"/><stop offset="1" stop-color="#8d99a3"/>
    </linearGradient>
  </defs>
  <ellipse cx="32" cy="57" rx="24" ry="3.5" fill="#000" opacity="0.16"/>
  <path d="M8 56 C10 45 20 40 30 41 C40 40 52 44 56 56 Z" fill="url(#pl-soil)" stroke="#4a2c18" stroke-width="1.4"/>
  <circle cx="22" cy="49" r="2" fill="#4f301b"/><circle cx="36" cy="47" r="1.6" fill="#4f301b"/><circle cx="45" cy="51" r="1.8" fill="#4f301b"/>
  <path d="M15 45 C13 40 15 36 19 35" fill="none" stroke="#5aa83c" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M19 35 C22 33 24 35 22 38 C20 39 18 38 19 35 Z" fill="#7cc95a" stroke="#3f7f2a" stroke-width="1"/>
  <rect x="34" y="6" width="5" height="38" rx="2.4" transform="rotate(32 36.5 25)" fill="#c98a4b" stroke="#6b3f1e" stroke-width="1.2"/>
  <path d="M22 37 L33 33 L36 40 C31 44 25 45 20 43 Z" fill="url(#pl-blade)" stroke="#55606a" stroke-width="1.3"/>
  <path d="M46 10 A12 12 0 0 1 56 26" fill="none" stroke="#f0a83a" stroke-width="3.4" stroke-linecap="round"/>
  <path d="M51.5 25 L56.5 28.5 L59 22.6 Z" fill="#f0a83a" stroke="#c47a12" stroke-width="1" stroke-linejoin="round"/>
</svg>`;
}

const ICONS = { hourglass, plow };

/** svg 이름 → SVG 문자열 (없으면 빈 문자열) */
export function itemSvg(name) {
  return ICONS[name]?.() ?? '';
}
