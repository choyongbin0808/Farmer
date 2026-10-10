// 광산 — 농사에 지친 사람을 위한 쉬어 가는 콘텐츠. 벌이는 농사보다 적게 잡는다.
// 광맥은 층 안 아무 데나 생기고, 게임 시간 REGEN_MIN 분마다 하나씩 다시 생긴다 (층마다 최대 MAX_ORES 개).
// tier: 캐는 데 필요한 곡괭이 등급, hard: 캐는 시간 배율 (출현 확률은 층마다 FLOOR_LAYOUT.weights)
export const ORES = {
  ore_coal:     { name: '석탄',      icon: '⚫', price: 5,   tier: 0, hard: 1.0, color: 0x2e2c2a, glow: 0x000000 },
  ore_copper:   { name: '구리 광석', icon: '🟠', price: 10,  tier: 0, hard: 1.1, color: 0xd8783a, glow: 0x000000 },
  ore_iron:     { name: '철 광석',   icon: '⚪', price: 18,  tier: 1, hard: 1.3, color: 0xc0c4c8, glow: 0x000000 },
  ore_silver:   { name: '은 광석',   icon: '🩶', price: 30,  tier: 2, hard: 1.5, color: 0xe8eef6, glow: 0x30343a },
  ore_gold:     { name: '금 광석',   icon: '🟡', price: 50,  tier: 3, hard: 1.7,  color: 0xf2c641, glow: 0x5a4008 },
  ore_amethyst: { name: '자수정',    icon: '💎', price: 100, tier: 4, hard: 2.0,  color: 0xb070f0, glow: 0x4a1878 },
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

/** 광산 1층(입구)이 놓인 곳 (마을과 멀리 떨어진 별도 공간) — 내부 좌표는 각 층 원점 기준 */
export const MINE_ORIGIN = { x: 0, z: 260 };
/** 광산 층 수 · 층 사이 간격 (층마다 따로 지은 방을 FLOOR_GAP 만큼 떨어뜨려 둔다) */
export const MINE_FLOORS = 4;
export const FLOOR_GAP = 100;
/** 한 층의 이동 범위 (로컬) — 44 x 32m */
export const MINE_HALF = { x: 22, zMin: -17, zMax: 15 };

/**
 * 층별 배치 (로컬 좌표)
 * exit: 마을로 나가는 출구(1층만), up/down: 위·아래층 사다리, tint: 바닥·벽 색
 * weights: 광맥 출현 가중치 — 광석 종류는 모든 층이 같고, 층이 올라갈수록(1층 → 4층) 좋은 광석 확률이 오른다.
 *          처음 광석인 석탄·구리는 3층부터 나오지 않는다.
 */
export const FLOOR_LAYOUT = [
  { exit: [-22.3, 10], up: null, down: [19, -13], tint: 0x8a7462,
    weights: { ore_coal: 35, ore_copper: 32, ore_iron: 20, ore_silver: 9, ore_gold: 3, ore_amethyst: 1 } },
  { up: [-20.4, 11], down: [19, -13], tint: 0x7e6a5c,
    weights: { ore_coal: 16, ore_copper: 20, ore_iron: 32, ore_silver: 20, ore_gold: 9, ore_amethyst: 3 } },
  { up: [-20.4, 11], down: [19, -13], tint: 0x6e6460,
    weights: { ore_coal: 0, ore_copper: 0, ore_iron: 36, ore_silver: 34, ore_gold: 22, ore_amethyst: 8 } },
  { up: [-20.4, 11], down: null, tint: 0x6a5c72,
    weights: { ore_coal: 0, ore_copper: 0, ore_iron: 18, ore_silver: 34, ore_gold: 32, ore_amethyst: 16 } },
];

/** 1층 입구 쪽 시설 (광맥이 생기지 않는 자리): 한 반장 · 돌쇠 · 좌판 · 광차 */
export const ENTRANCE_PROPS = { han: [-14, 8], dolsoe: [-8, 8], stall: [-8, 6.6], cart: [-17.5, 12.6] };
/** 층마다 같은 자리에 있는 갱목 지지대(기둥 두 개) · 등불 */
export const BEAMS = [[-12, -9], [0, -9], [12, -9], [-12, 2], [0, 2], [12, 2]];
export const BEAM_HALF = 1.6;
export const LAMPS = [[-21, -10, 0], [21, -10, Math.PI], [-21, 3, 0], [21, 3, Math.PI], [-10, -16.4, -Math.PI / 2], [10, -16.4, -Math.PI / 2]];

/**
 * 광맥 생성 — 정해진 자리가 없고, 층 안 빈 땅 아무 데나 생긴다.
 * 층마다 최대 MAX_ORES 개까지, 게임 시간 REGEN_MIN 분마다 하나씩 새로 생긴다 (자는 동안·밖에 있는 동안에도 시간만큼).
 */
export const MAX_ORES = 30;
export const REGEN_MIN = 30;
/** 광맥끼리 · 플레이어와 떨어져야 하는 거리 */
const ORE_GAP = 2.6;

const keepCache = [];
/** 광맥이 생기면 안 되는 곳 [[x, z, 반지름]] — 사다리 · 출구 · 시설 · 기둥 · 등불 주변 */
function keepOuts(floor) {
  if (keepCache[floor]) return keepCache[floor];
  const L = FLOOR_LAYOUT[floor];
  const keep = [];
  for (const [x, z] of BEAMS) keep.push([x - BEAM_HALF, z, 1.5], [x + BEAM_HALF, z, 1.5]);
  for (const [x, z] of LAMPS) keep.push([x, z, 1.6]);
  if (L.up) keep.push([...L.up, 3.6]);
  if (L.down) keep.push([...L.down, 3.6]);
  if (L.exit) keep.push([L.exit[0] + 2, L.exit[1], 4.2]);
  if (floor === 0) for (const [x, z] of Object.values(ENTRANCE_PROPS)) keep.push([x, z, 3.2]);
  keepCache[floor] = keep;
  return keep;
}

/**
 * 광맥이 새로 생길 빈자리(로컬 좌표) — 다른 광맥과 avoid(플레이어 등)에서 떨어진 곳. 못 찾으면 null
 * taken: [{ x, z }] 이미 있는 광맥, avoid: [{ x, z }] 비켜야 할 곳
 */
export function randomOreSpot(floor, taken, avoid = []) {
  const keep = keepOuts(floor);
  for (let tries = 0; tries < 40; tries++) {
    const x = (Math.random() * 2 - 1) * (MINE_HALF.x - 2.2);
    const z = MINE_HALF.zMin + 2.2 + Math.random() * (MINE_HALF.zMax - MINE_HALF.zMin - 4.4);
    if (keep.some(([kx, kz, r]) => Math.hypot(x - kx, z - kz) < r)) continue;
    if (taken.some((o) => Math.hypot(x - o.x, z - o.z) < ORE_GAP)) continue;
    if (avoid.some((o) => Math.hypot(x - o.x, z - o.z) < ORE_GAP)) continue;
    return { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 };
  }
  return null;
}

/** 이 층에서 광맥 종류를 하나 뽑는다 (층 가중치 FLOOR_LAYOUT.weights) */
export function rollOre(floor = 0) {
  const w = FLOOR_LAYOUT[floor].weights;
  const ids = ORE_ORDER.filter((id) => w[id] > 0);
  const total = ids.reduce((s, id) => s + w[id], 0);
  let r = Math.random() * total;
  for (const id of ids) {
    r -= w[id];
    if (r <= 0) return id;
  }
  return ids[ids.length - 1];
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
