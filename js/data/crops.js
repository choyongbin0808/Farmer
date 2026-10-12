import { GAME_MIN_PER_SEC } from '../core/Game.js';

/**
 * grow: 다 자라는 데 걸리는 실제 시간(초) — 물을 준 날에는 시간이 흐르는 동안 계속 자란다 (자는 동안의 밤 시간도).
 * 엔딩까지 빡빡하게 약 25분 · 느긋하게 1시간 안쪽이 되도록 맞춘 값을 두 번 절반으로 줄인 값 (상추 23초 ~ 수박 1분 45초).
 */
export const CROPS = {
  lettuce:    { name: '상추',   icon: '🥬', grade: 1, seedPrice: 10,  grow: 23,  sellPrice: 25,  staminaCost: 2,  color: 0x7ccf5a, unlockRank: 0 },
  radish:     { name: '무',     icon: '🧄', grade: 1, seedPrice: 15,  grow: 38,  sellPrice: 40,  staminaCost: 3,  color: 0xf4f1e6, unlockRank: 0 },
  potato:     { name: '감자',   icon: '🥔', grade: 1, seedPrice: 20,  grow: 38,  sellPrice: 55,  staminaCost: 3,  color: 0xc79a5b, unlockRank: 0 },
  carrot:     { name: '당근',   icon: '🥕', grade: 2, seedPrice: 25,  grow: 45,  sellPrice: 70,  staminaCost: 4,  color: 0xf28a2e, unlockRank: 1 },
  tomato:     { name: '토마토', icon: '🍅', grade: 2, seedPrice: 40,  grow: 60,  sellPrice: 120, staminaCost: 6,  color: 0xe5483b, unlockRank: 1 },
  strawberry: { name: '딸기',   icon: '🍓', grade: 3, seedPrice: 70,  grow: 75,  sellPrice: 220, staminaCost: 9,  color: 0xe8304a, unlockRank: 2 },
  corn:       { name: '옥수수', icon: '🌽', grade: 3, seedPrice: 50,  grow: 75,  sellPrice: 160, staminaCost: 7,  color: 0xf5d142, unlockRank: 3 },
  pumpkin:    { name: '호박',   icon: '🎃', grade: 4, seedPrice: 100, grow: 90,  sellPrice: 350, staminaCost: 12, color: 0xf08a24, unlockRank: 4 },
  watermelon: { name: '수박',   icon: '🍉', grade: 5, seedPrice: 150, grow: 105, sellPrice: 550, staminaCost: 15, color: 0x3f9a3a, unlockRank: 0, unlockFlag: 'watermelon' },
};

export const CROP_ORDER = Object.keys(CROPS);

export function isCropUnlocked(cropId, state) {
  const c = CROPS[cropId];
  if (c.unlockFlag && !state.flags[c.unlockFlag]) return false;
  return state.rank >= c.unlockRank;
}

/** 다 자라는 데 걸리는 실제 시간(초) — 모종은 1/3 (5초 단위, 최소 5초) */
export function growSeconds(cropId, seedling = false) {
  const s = CROPS[cropId].grow;
  return seedling ? Math.max(5, Math.round(s / 3 / 5) * 5) : s;
}

/** 밭 한 칸이 다 자라는 데 필요한 실제 시간(초) */
export function plotGrowSeconds(d) {
  return growSeconds(d.cropId, d.seedling);
}

/** 밭 한 칸이 다 자라는 데 필요한 게임 시간(분) — 밭에는 자란 양을 게임 분(d.grown)으로 쌓는다 */
export function plotGrowMinutes(d) {
  return plotGrowSeconds(d) * GAME_MIN_PER_SEC;
}

/** 초 → '1분 30초' · '5분' · '40초' */
export function growText(sec) {
  const s = Math.max(0, Math.ceil(sec));
  if (s < 60) return `${s}초`;
  return `${Math.floor(s / 60)}분${s % 60 ? ` ${s % 60}초` : ''}`;
}

/** 받침에 맞는 조사: josa('토마토', '을', '를') → '를' */
export function josa(word, withBatchim, without) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code < 11172 && code % 28 ? withBatchim : without;
}

export function stars(grade) {
  return '★'.repeat(grade);
}
