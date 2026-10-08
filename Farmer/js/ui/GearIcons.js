import { GEAR } from '../data/tools.js';

/**
 * 장비 아이콘 — 같은 종류라도 등급마다 생김새가 다르도록 직접 그린 SVG (64x64)
 * 옷 아이콘(컬러 이모지)과 같은 화풍: 외곽선 없이 통통하고 큼직한 덩어리 + 밝은 면/어두운 면 두 톤 + 작은 하이라이트
 * 호미: 낡은 호미 → 잎날 호미 → 넓은 괭이 → 쇠스랑 → 장식 호미 → 트랙터
 * 물뿌리개: 양동이 → 둥근 물뿌리개 → 긴 꼭지 물뿌리개 → 납작 물뿌리개 → 주전자형 → 스프링클러
 * 낫: 녹슨 작은 낫 → 기본 낫 → 톱니 낫 → 긴 자루 큰 낫 → 쌍날 낫 → 파종기
 */

const toRGB = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const css = ([r, g, b]) => `rgb(${r | 0},${g | 0},${b | 0})`;
const mix = (c, t, k) => toRGB(c).map((v, i) => v + (t[i] - v) * k);
const shade = (c, k) => css(mix(c, k > 0 ? [255, 255, 255] : [0, 0, 0], Math.abs(k)));

/**
 * 두 톤 칠: 위/왼쪽은 밝은 면, 아래/오른쪽은 그늘 (이모지처럼 경계가 또렷한 그라데이션)
 * fill — 덩어리(path)용, bar — 막대(회전한 rect)용(막대 두께 방향으로 나뉨), solid — 선(stroke)용
 */
function paint(id, color, rainbow = false) {
  if (rainbow) {
    const stops = (o) => ['#ff7b7b', '#ffd84a', '#72dc82', '#62bcff', '#c88cff']
      .map((c, i) => `<stop offset="${i / 4}" stop-color="${c}" stop-opacity="${o}"/>`).join('');
    return {
      fill: `url(#${id})`, bar: `url(#${id})`, solid: '#b58cff', dark: '#8a62c8',
      def: `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${stops(1)}</linearGradient>`,
    };
  }
  const base = css(toRGB(color));
  const dark = shade(color, -0.2);
  const two = (gid, x2, y2) => `<linearGradient id="${gid}" x1="0" y1="0" x2="${x2}" y2="${y2}">
    <stop offset="0" stop-color="${shade(color, 0.12)}"/><stop offset=".55" stop-color="${base}"/>
    <stop offset=".56" stop-color="${dark}"/><stop offset="1" stop-color="${dark}"/></linearGradient>`;
  return { fill: `url(#${id})`, bar: `url(#${id}-b)`, solid: base, dark, def: two(id, 0.7, 1) + two(`${id}-b`, 0, 1) };
}

/** 통통한 막대 (자루 · 꼭지 등) — 양 끝이 둥근 사각형을 회전시켜 그린다 */
function bar(x1, y1, x2, y2, w, p) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return `<rect x="${-w / 2}" y="${-w / 2}" width="${len + w}" height="${w}" rx="${w / 2}" fill="${p.bar}" transform="translate(${x1} ${y1}) rotate(${ang})"/>`;
}

/** 손잡이 고리 같은 굵은 곡선 */
const ring = (d, w, p) => `<path d="${d}" fill="none" stroke="${p.dark}" stroke-width="${w}" stroke-linecap="round" transform="translate(.8 1.2)"/>
  <path d="${d}" fill="none" stroke="${p.solid}" stroke-width="${w}" stroke-linecap="round"/>`;
const blob = (d, p) => `<path d="${d}" fill="${p.fill}"/>`;
const ball = (x, y, r, p) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${p.fill}"/>`;
const hi = (d, w = 3) => `<path d="${d}" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="${w}" stroke-linecap="round"/>`;
const spot = (x, y, r, c, o = 1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="${o}"/>`;
const wheel = (x, y, r, P) => `${ball(x, y, r, P.tire)}${ball(x, y, r * 0.45, P.cap)}`;

const DRAW = {
  // ───── 호미 ─────
  hoe_old: (P) => `
    ${bar(10, 56, 30, 36, 10, P.woodOld)}
    ${bar(30, 36, 41, 24, 5, P.m)}
    ${blob('M35 12 L61 16 L46 39 Z', P.m)}
    ${spot(48, 21, 3, P.rust, 0.75)}${spot(52, 27, 2, P.rust, 0.75)}${spot(43, 17, 1.6, P.rust, 0.75)}
    ${hi('M40 16 L53 18', 2.4)}`,
  hoe_copper: (P) => `
    ${bar(8, 58, 32, 34, 9, P.wood)}
    ${blob('M29 35 C 31 13, 50 3, 61 3 C 63 16, 52 35, 29 35 Z', P.m)}
    ${hi('M37 22 Q43 13 52 9')}`,
  hoe_iron: (P) => `
    ${bar(6, 60, 37, 29, 8, P.wood)}
    ${bar(35, 31, 44, 22, 6, P.m)}
    ${blob('M41 3 L63 15 L54 33 L31 20 Z', P.m)}
    ${hi('M42 9 L56 17')}`,
  hoe_silver: (P) => `
    ${bar(6, 60, 34, 32, 8, P.wood)}
    ${bar(28, 20, 48, 40, 8, P.m)}
    ${bar(31, 23, 43, 8, 6, P.m)}
    ${bar(38, 30, 51, 15, 6, P.m)}
    ${bar(45, 37, 59, 22, 6, P.m)}
    ${hi('M32 18 L39 10', 2)}${hi('M39 25 L46 17', 2)}${hi('M46 32 L53 24', 2)}`,
  hoe_gold: (P) => `
    ${bar(8, 58, 31, 35, 9, P.wood)}
    ${bar(13, 53, 17, 49, 12, P.m)}${bar(21, 45, 25, 41, 12, P.m)}
    ${blob('M27 37 L35 12 Q50 -1 63 6 Q55 12 58 22 Q48 37 27 37 Z', P.m)}
    ${ball(46, 21, 5.5, P.gem)}${spot(44.3, 19.3, 1.8, '#fff', 0.85)}
    ${hi('M38 13 Q47 5 56 6')}`,
  hoe_rainbow: (P) => `
    ${bar(12, 24, 12, 11, 5, P.pipe)}
    ${blob('M3 44 L3 30 Q3 23 10 23 L30 23 L30 44 Z', P.m)}
    ${blob('M25 44 L25 12 Q25 9 28 9 L46 9 Q48 9 49 11 L54 44 Z', P.m)}
    ${blob('M30 14 L44 14 L46.5 28 L30 28 Z', P.glass)}
    ${wheel(42, 47, 14, P)}${wheel(13, 52, 9, P)}
    ${hi('M33 17 L38 17', 2.4)}`,

  // ───── 물뿌리개 ─────
  can_old: (P) => `
    ${ring('M12 26 Q32 0 52 26', 4, P.pipe)}
    ${blob('M8 24 L56 24 L50 59 L14 59 Z', P.m)}
    ${bar(7, 24, 57, 24, 6, P.m)}
    ${spot(24, 40, 3, P.rust, 0.6)}${spot(41, 50, 2.4, P.rust, 0.6)}${spot(34, 33, 1.8, P.rust, 0.6)}
    ${hi('M15 30 L18 52')}`,
  can_copper: (P) => `
    ${ring('M18 28 Q31 9 44 28', 5, P.m)}
    ${bar(44, 46, 58, 22, 7, P.m)}
    ${blob('M53 13 L64 20 L58 28 Z', P.m)}
    ${blob('M8 31 Q8 24 15 24 L45 24 Q52 24 52 31 L52 53 Q52 60 45 60 L15 60 Q8 60 8 53 Z', P.m)}
    ${hi('M14 31 L14 50')}`,
  can_iron: (P) => `
    ${ring('M19 18 Q3 30 19 46', 5, P.m)}
    ${bar(39, 50, 56, 14, 6, P.m)}
    ${blob('M48 6 A9 9 0 0 1 64 14 L56 18 Z', P.m)}
    ${blob('M17 14 Q17 10 21 10 L39 10 Q43 10 43 14 L43 60 L17 60 Z', P.m)}
    ${hi('M23 17 L23 45')}`,
  can_silver: (P) => `
    ${ring('M10 34 Q28 2 46 34', 5, P.m)}
    ${ring('M48 42 Q58 40 59 26', 5, P.m)}
    ${blob('M54 17 L64 20 L61 30 Z', P.m)}
    ${blob('M3 44 Q3 28 28 28 Q53 28 53 44 Q53 59 28 59 Q3 59 3 44 Z', P.m)}
    ${hi('M11 37 Q19 32 30 32')}`,
  can_gold: (P) => `
    ${ring('M14 31 Q0 39 14 50', 5, P.m)}
    ${ring('M45 43 Q58 43 56 31 Q55 22 62 20', 5, P.m)}
    ${ball(30, 41, 18, P.m)}
    ${blob('M18 27 Q30 9 42 27 Z', P.m)}
    ${ball(30, 12, 4, P.gem)}
    ${ball(30, 43, 6, P.gem)}${spot(28, 41, 2, '#fff', 0.85)}
    ${hi('M19 36 Q22 30 27 28')}`,
  can_rainbow: (P) => `
    <path d="M28 20 Q14 2 2 18" fill="none" stroke="#5ab4ff" stroke-width="3.4" stroke-dasharray="4 4" stroke-linecap="round"/>
    <path d="M36 20 Q50 2 62 18" fill="none" stroke="#5ab4ff" stroke-width="3.4" stroke-dasharray="4 4" stroke-linecap="round"/>
    ${bar(32, 32, 32, 52, 7, P.pipe)}
    ${blob('M15 51 L49 51 L45 61 L19 61 Z', P.pipe)}
    ${bar(13, 27, 51, 27, 7, P.m)}
    ${blob('M23 19 L41 19 L41 35 L23 35 Z', P.m)}
    ${ball(13, 27, 5, P.m)}${ball(51, 27, 5, P.m)}
    ${hi('M27 23 L27 30', 2.4)}`,

  // ───── 낫 ─────
  sickle_old: (P) => `
    ${bar(11, 58, 25, 44, 10, P.woodOld)}
    ${blob('M23 47 Q15 22 34 10 Q48 3 57 14 Q42 11 34 21 Q28 31 31 45 Z', P.m)}
    ${spot(37, 14, 2.6, P.rust, 0.75)}${spot(26, 33, 2, P.rust, 0.75)}
    ${hi('M25 36 Q24 24 32 17', 2.4)}`,
  sickle_copper: (P) => `
    ${bar(8, 60, 27, 41, 9, P.wood)}
    ${blob('M24 43 Q16 14 40 5 Q57 1 64 15 Q48 9 38 18 Q30 27 33 41 Z', P.m)}
    ${hi('M26 32 Q25 19 36 12')}`,
  sickle_iron: (P) => `
    ${bar(8, 60, 27, 41, 9, P.wood)}
    ${blob('M24 43 Q17 12 44 3 Q61 1 64 18 L59 14 L57 21 L52 15 L50 22 L45 17 L43 25 L38 22 L37 31 L33 31 L33 41 Z', P.m)}
    ${hi('M26 32 Q25 17 38 10')}`,
  sickle_silver: (P) => `
    ${bar(6, 62, 33, 8, 7, P.wood)}
    ${bar(14, 45, 25, 49, 7, P.woodOld)}
    ${blob('M29 5 Q53 0 64 29 Q50 15 32 17 Z', P.m)}
    ${hi('M35 7 Q49 5 57 17')}`,
  sickle_gold: (P) => `
    ${bar(9, 60, 28, 41, 9, P.wood)}
    ${bar(14, 55, 18, 51, 12, P.m)}
    ${blob('M26 41 Q11 35 3 13 Q17 26 32 31 Z', P.m)}
    ${blob('M25 42 Q18 14 42 5 Q58 1 64 15 Q48 9 39 18 Q32 27 34 40 Z', P.m)}
    ${ball(30, 38, 5.5, P.gem)}${spot(28.3, 36.3, 1.8, '#fff', 0.85)}
    ${hi('M28 30 Q27 19 37 12')}`,
  sickle_rainbow: (P) => `
    ${bar(43, 28, 60, 9, 6, P.pipe)}
    ${blob('M5 13 L47 13 L41 39 L11 39 Z', P.m)}
    ${blob('M9 38 L43 38 L43 47 L9 47 Z', P.pipe)}
    ${wheel(17, 51, 8, P)}${wheel(36, 51, 8, P)}
    ${spot(26.5, 53, 2.4, '#d9a54a')}${spot(29, 59, 2.4, '#d9a54a')}${spot(24.5, 62, 2, '#d9a54a')}
    ${hi('M11 18 L41 18')}`,
};

const WOOD = 0xc08550;
const WOOD_OLD = 0x9a6c45;

/** 장비 id(tool_hoe_iron 등) → 인라인 SVG 문자열 */
export function gearIconSVG(id) {
  const g = GEAR[id];
  if (!g) return '';
  const tierId = id.split('_').pop();
  const draw = DRAW[`${g.kind}_${tierId}`];
  // 같은 id 의 그라데이션은 언제나 같은 내용이라 문서에 여러 번 들어가도 괜찮다
  const P = {
    m: paint(`gi-${g.kind}-${tierId}`, g.color, tierId === 'rainbow'),
    wood: paint('gi-wood', WOOD),
    woodOld: paint('gi-woodold', WOOD_OLD),
    tire: paint('gi-tire', 0x4a4a54),
    cap: paint('gi-cap', 0xdcdfe4),
    pipe: paint('gi-pipe', 0x9aa0a8),
    glass: paint('gi-glass', 0xbfe8ff),
    gem: paint('gi-gem', 0xff5a8a),
    rust: '#7a4a28',
  };
  const defs = Object.values(P).filter((p) => p.def).map((p) => p.def).join('');
  return `<svg class="gear-svg" viewBox="0 0 64 64" aria-hidden="true"><defs>${defs}</defs>${draw(P)}</svg>`;
}
