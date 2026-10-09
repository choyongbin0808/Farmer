// 광산 — 농사에 지친 사람을 위한 쉬어 가는 콘텐츠. 벌이는 농사보다 적게 잡는다.
// 광맥은 하루가 지나면 모두 다시 생기고, 캐낸 자리는 게임 시간 RESPAWN_MIN 분 뒤 다시 생긴다.
// tier: 캐는 데 필요한 곡괭이 등급, hard: 캐는 시간 배율, weight: 광맥 출현 가중치
export const ORES = {
  ore_coal:     { name: '석탄',      icon: '⚫', price: 5,   tier: 0, hard: 1.0, weight: 30, color: 0x2e2c2a, glow: 0x000000 },
  ore_copper:   { name: '구리 광석', icon: '🟠', price: 10,  tier: 0, hard: 1.1, weight: 28, color: 0xd8783a, glow: 0x000000 },
  ore_iron:     { name: '철 광석',   icon: '⚪', price: 18,  tier: 1, hard: 1.3, weight: 20, color: 0xc0c4c8, glow: 0x000000 },
  ore_silver:   { name: '은 광석',   icon: '🩶', price: 30,  tier: 2, hard: 1.5, weight: 12, color: 0xe8eef6, glow: 0x30343a },
  ore_gold:     { name: '금 광석',   icon: '🟡', price: 50,  tier: 3, hard: 1.7, weight: 7,  color: 0xf2c641, glow: 0x5a4008 },
  ore_amethyst: { name: '자수정',    icon: '💎', price: 100, tier: 4, hard: 2.0, weight: 3,  color: 0xb070f0, glow: 0x4a1878 },
};
export const ORE_ORDER = Object.keys(ORES);

// 곡괭이 — 한 반장에게 낡은 곡괭이를 받고, 더 좋은 곡괭이는 돌쇠에게 산다
// time: 기본 캐는 시간(초), extra: 광석이 하나 더 나올 확률(최고 등급은 두 개 더 나올 수도), stamina: 한 번 캘 때 체력
export const PICKAXES = [
  { id: 'pick_old',     name: '낡은 곡괭이',   price: 0,    time: 2.6, extra: 0.05, stamina: 3, color: 0x8a7b6a },
  { id: 'pick_copper',  name: '구리 곡괭이',   price: 600,  time: 2.1, extra: 0.15, stamina: 3, color: 0xc8733a },
  { id: 'pick_iron',    name: '철 곡괭이',     price: 1500, time: 1.7, extra: 0.25, stamina: 2, color: 0xb8c0c8 },
  { id: 'pick_gold',    name: '금 곡괭이',     price: 3500, time: 1.3, extra: 0.4,  stamina: 2, color: 0xf2c641 },
  { id: 'pick_diamond', name: '다이아 곡괭이', price: 8000, time: 0.9, extra: 0.55, stamina: 2, color: 0x7ee0f0 },
];
export const PICK_BY_ID = Object.fromEntries(PICKAXES.map((p, tier) => [p.id, { ...p, tier }]));

/** 광산 내부가 놓인 곳 (마을과 멀리 떨어진 별도 공간) — 내부 좌표는 이 점 기준 */
export const MINE_ORIGIN = { x: 0, z: 260 };
/** 광산 내부 이동 범위 (로컬) */
export const MINE_HALF = { x: 15, zMin: -11.5, zMax: 10.5 };

/** 캐낸 자리가 다시 생기는 시간 (게임 분) */
export const RESPAWN_MIN = 180;

/** 광산 안 광맥 자리 (광산 중심 기준 로컬 좌표) */
export const NODE_SPOTS = [
  [-11, -8], [-7, -9.5], [-2.5, -8.5], [2, -9.5], [6.5, -8.5], [11, -9],
  [-12.5, -3.5], [-8.5, -4.5], [-4, -3], [0.5, -4.5], [5, -3.5], [9, -4.5], [12.5, -3],
  [-10.5, 1], [-6, 0.5], [7, 0.5], [11, 1.5], [-1.5, 0],
];

/** 광맥 종류를 하나 뽑는다 */
export function rollOre() {
  const total = ORE_ORDER.reduce((s, id) => s + ORES[id].weight, 0);
  let r = Math.random() * total;
  for (const id of ORE_ORDER) {
    r -= ORES[id].weight;
    if (r <= 0) return id;
  }
  return ORE_ORDER[0];
}

/** 곡괭이 등급에 따라 나오는 광석 수: 1개 + 확률로 1개 더 (+ 그 절반 확률로 또 1개) */
export function rollOreAmount(pick) {
  let n = 1;
  if (Math.random() < pick.extra) {
    n++;
    if (Math.random() < pick.extra / 2) n++;
  }
  return n;
}
