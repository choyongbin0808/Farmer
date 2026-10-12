// 낚시 — 물고기 20종(등급 1~5 × 4종) + 게 3종
// w: 무게 범위 kg. 물고기는 오 씨에게 타우린, 게는 키토산으로 교환한다.
// 교환량 = 등급 기본량 × (잡은 무게 / 평균 무게), 최소 1
export const FISH = {
  // ★ 흔한 물고기
  fish_pirami:    { name: '피라미',     grade: 1, icon: '🐟', w: [0.02, 0.08], color: 0x9ab8c8 },
  fish_songsari:  { name: '송사리',     grade: 1, icon: '🐟', w: [0.01, 0.03], color: 0xb8c4a8 },
  fish_loach:     { name: '미꾸라지',   grade: 1, icon: '🐟', w: [0.03, 0.12], color: 0x8a7a58 },
  fish_minnow:    { name: '버들치',     grade: 1, icon: '🐟', w: [0.03, 0.1],  color: 0xa89c7c },
  // ★★
  fish_crucian:   { name: '붕어',       grade: 2, icon: '🐠', w: [0.2, 0.9],   color: 0xb89a5a },
  fish_gudgeon:   { name: '모래무지',   grade: 2, icon: '🐠', w: [0.1, 0.4],   color: 0xd8c8a0 },
  fish_dace:      { name: '갈겨니',     grade: 2, icon: '🐠', w: [0.05, 0.2],  color: 0x8ab0c0 },
  fish_bagrid:    { name: '동자개',     grade: 2, icon: '🐠', w: [0.15, 0.6],  color: 0xc8a040 },
  // ★★★
  fish_carp:      { name: '잉어',       grade: 3, icon: '🐡', w: [1.5, 6],     color: 0xd08a3a },
  fish_catfish:   { name: '메기',       grade: 3, icon: '🐡', w: [1, 5],       color: 0x5a5a4a },
  fish_kkeokji:   { name: '꺽지',       grade: 3, icon: '🐡', w: [0.2, 0.7],   color: 0x7a8a5a },
  fish_nuchi:     { name: '누치',       grade: 3, icon: '🐡', w: [0.8, 3],     color: 0xb0b8c0 },
  // ★★★★
  fish_mandarin:  { name: '쏘가리',     grade: 4, icon: '🐠', w: [0.8, 3.5],   color: 0xc8a050 },
  fish_masu:      { name: '산천어',     grade: 4, icon: '🐟', w: [0.3, 1.2],   color: 0x8aa0c8 },
  fish_lenok:     { name: '열목어',     grade: 4, icon: '🐟', w: [1, 4],       color: 0xa07a6a },
  fish_eel:       { name: '뱀장어',     grade: 4, icon: '🐍', w: [0.5, 2.5],   color: 0x4a5a3a },
  // ★★★★★ 전설
  fish_goldcarp:  { name: '황금 잉어',  grade: 5, icon: '🐡', w: [4, 12],      color: 0xf2c641 },
  fish_rainbow:   { name: '무지개송어', grade: 5, icon: '🐟', w: [2, 7],       color: 0xff8cc0 },
  fish_sturgeon:  { name: '철갑상어',   grade: 5, icon: '🦈', w: [10, 40],     color: 0x6a7a88 },
  fish_snakehead: { name: '은빛 가물치', grade: 5, icon: '🐟', w: [3, 10],     color: 0xd8e0e8 },
  // 게 (키토산)
  crab_mitten:    { name: '참게',       grade: 2, icon: '🦀', w: [0.1, 0.3],   color: 0x6a5a3a, crab: true },
  crab_blue:      { name: '꽃게',       grade: 3, icon: '🦀', w: [0.2, 0.6],   color: 0x5a7aa8, crab: true },
  crab_king:      { name: '황금 대게',  grade: 5, icon: '🦀', w: [1.5, 5],     color: 0xe8a838, crab: true },
};

export const FISH_ORDER = Object.keys(FISH);

/** 등급별 기본 교환량 (평균 무게 기준) */
export const GRADE_REWARD = [0, 1, 2, 4, 7, 12];
/** 등급별 기본 출현 가중치 (낚싯대 등급이 높으면 높은 등급 쪽으로 기운다) */
const GRADE_WEIGHT = [0, 50, 27, 14, 7, 2];
/** 같은 등급 안에서 게가 뽑힐 가중치 (물고기 한 종 = 1) */
const CRAB_WEIGHT = 1.5;

// 낚싯대 — 오 씨 퀘스트로 대나무 낚싯대를 받고, 더 좋은 낚싯대는 오 씨에게 산다
// wait: 입질까지 기다리는 시간 배율, window: 입질 때 챔질할 수 있는 시간(초), luck: 높은 등급 확률 보정
export const RODS = [
  { id: 'rod_bamboo', name: '대나무 낚싯대', price: 0,    wait: 1.0,  window: 0.95, luck: 0, color: 0xc8a050 },
  { id: 'rod_carbon', name: '카본 낚싯대',   price: 1200, wait: 0.85, window: 1.15, luck: 1, color: 0x3a3e48 },
  { id: 'rod_pro',    name: '프로 낚싯대',   price: 3000, wait: 0.7,  window: 1.35, luck: 2, color: 0x2a6ac8 },
  { id: 'rod_gold',   name: '황금 낚싯대',   price: 7000, wait: 0.55, window: 1.6,  luck: 3, color: 0xf2c641 },
];
export const ROD_BY_ID = Object.fromEntries(RODS.map((r, tier) => [r.id, { ...r, tier }]));

function pickWeighted(entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of entries) {
    r -= w;
    if (r <= 0) return v;
  }
  return entries[entries.length - 1][0];
}

/** 낚싯대 등급에 따라 물고기 한 마리를 뽑는다 → { id, w } */
export function rollCatch(rod) {
  const grade = pickWeighted([1, 2, 3, 4, 5].map((g) => [g, GRADE_WEIGHT[g] * (1 + rod.luck * 0.35 * (g - 1))]));
  const pool = FISH_ORDER.filter((id) => FISH[id].grade === grade).map((id) => [id, FISH[id].crab ? CRAB_WEIGHT : 1]);
  const id = pickWeighted(pool);
  const [a, b] = FISH[id].w;
  // 가벼운 쪽이 더 흔하게 (제곱 분포)
  const w = a + (b - a) * Math.pow(Math.random(), 1.6);
  return { id, w: Math.round(w * 100) / 100 };
}

/** 교환 보상: { item: 'taurine' | 'chitosan', n } */
export function catchReward(c) {
  const f = FISH[c.id];
  const avg = (f.w[0] + f.w[1]) / 2;
  const n = Math.max(1, Math.round(GRADE_REWARD[f.grade] * (c.w / avg)));
  return { item: f.crab ? 'mat_chitosan' : 'mat_taurine', n };
}

export function weightText(w) {
  return w < 1 ? `${Math.round(w * 1000)}g` : `${w.toFixed(2)}kg`;
}
