export const CROPS = {
  lettuce:    { name: '상추',   icon: '🥬', grade: 1, seedPrice: 10,  days: 2,  sellPrice: 25,  staminaCost: 2,  color: 0x7ccf5a, unlockRank: 0 },
  radish:     { name: '무',     icon: '🧄', grade: 1, seedPrice: 15,  days: 3,  sellPrice: 40,  staminaCost: 3,  color: 0xf4f1e6, unlockRank: 0 },
  potato:     { name: '감자',   icon: '🥔', grade: 1, seedPrice: 20,  days: 3,  sellPrice: 55,  staminaCost: 3,  color: 0xc79a5b, unlockRank: 0 },
  carrot:     { name: '당근',   icon: '🥕', grade: 2, seedPrice: 25,  days: 4,  sellPrice: 70,  staminaCost: 4,  color: 0xf28a2e, unlockRank: 1 },
  tomato:     { name: '토마토', icon: '🍅', grade: 2, seedPrice: 40,  days: 5,  sellPrice: 120, staminaCost: 6,  color: 0xe5483b, unlockRank: 1 },
  strawberry: { name: '딸기',   icon: '🍓', grade: 3, seedPrice: 70,  days: 6,  sellPrice: 220, staminaCost: 9,  color: 0xe8304a, unlockRank: 2 },
  corn:       { name: '옥수수', icon: '🌽', grade: 3, seedPrice: 50,  days: 6,  sellPrice: 160, staminaCost: 7,  color: 0xf5d142, unlockRank: 3 },
  pumpkin:    { name: '호박',   icon: '🎃', grade: 4, seedPrice: 100, days: 8,  sellPrice: 350, staminaCost: 12, color: 0xf08a24, unlockRank: 4 },
  watermelon: { name: '수박',   icon: '🍉', grade: 5, seedPrice: 150, days: 10, sellPrice: 550, staminaCost: 15, color: 0x3f9a3a, unlockRank: 0, unlockFlag: 'watermelon' },
};

export const CROP_ORDER = Object.keys(CROPS);

export function isCropUnlocked(cropId, state) {
  const c = CROPS[cropId];
  if (c.unlockFlag && !state.flags[c.unlockFlag]) return false;
  return state.rank >= c.unlockRank;
}

export function stars(grade) {
  return '★'.repeat(grade);
}
