export const TOOLS = {
  hoe:    { name: '호미',     itemId: 'tool_hoe',    icon: '⛏️', desc: '땅 갈기' },
  can:    { name: '물뿌리개', itemId: 'tool_can',    icon: '💧', desc: '물 주기' },
  sickle: { name: '낫',       itemId: 'tool_sickle', icon: '✂️', desc: '수확' },
};

export const TOOL_ORDER = ['hoe', 'can', 'sickle'];

// 장비 등급 — index = 착용에 필요한 직책 단계(RANKS index). 구매는 직책과 무관.
// price: 상점 구매가, enhanceBase: 강화 1단계 기본 비용(+n 강화 비용 = enhanceBase * n)
export const TIERS = [
  { id: 'old',     name: '낡은',   price: 0,    enhanceBase: 60,   range: 'single', rangeText: '1칸',   harvest: [1, 1], time: 0.8,  color: 0x8a7b6a },
  { id: 'copper',  name: '구리',   price: 300,  enhanceBase: 120,  range: 'single', rangeText: '1칸',   harvest: [1, 2], time: 0.65, color: 0xc8733a },
  { id: 'iron',    name: '철',     price: 800,  enhanceBase: 250,  range: 'row',    rangeText: '1x3칸', harvest: [2, 2], time: 0.5,  color: 0xb8c0c8 },
  { id: 'silver',  name: '은',     price: 1800, enhanceBase: 450,  range: 'row',    rangeText: '1x3칸', harvest: [2, 3], time: 0.4,  color: 0xe4e9f0 },
  { id: 'gold',    name: '금',     price: 3500, enhanceBase: 800,  range: 'square', rangeText: '3x3칸', harvest: [3, 3], time: 0.3,  color: 0xf2c641 },
  { id: 'rainbow', name: '무지개', price: 7000, enhanceBase: 1400, range: 'square', rangeText: '3x3칸', harvest: [3, 4], time: 0.2,  color: 0xff77cc },
];

export const MAX_TIER = TIERS.length - 1;
export const MAX_ENHANCE = 5;
/** 강화 1단계당 작업 시간 감소 비율 */
export const ENHANCE_TIME_PER_LEVEL = 0.07;

// 최종(무지개) 등급 일부는 농기계 — 들고 있으면 손에 쥐는 대신 올라탄다 (vehicle: Models.makeVehicle 종류)
const MACHINES = {
  tool_hoe_rainbow:    { name: '트랙터', icon: '🚜', vehicle: 'tractor' },
  tool_sickle_rainbow: { name: '파종기', icon: '🌾', vehicle: 'seeder' },
};

/** 장비 아이템: id → { id, kind, tier, name, icon, price, rank, color, vehicle? } */
export const GEAR = {};
export const GEAR_ORDER = [];
for (const kind of TOOL_ORDER) {
  TIERS.forEach((T, tier) => {
    const id = `tool_${kind}_${T.id}`;
    GEAR[id] = { id, kind, tier, name: `${T.name} ${TOOLS[kind].name}`, icon: TOOLS[kind].icon, price: T.price, rank: tier, color: T.color, ...MACHINES[id] };
    GEAR_ORDER.push(id);
  });
}

export function startingGear(kind) {
  return `tool_${kind}_old`;
}

/** 장비 등급 + 강화 단계에 따른 실제 능력치 */
export function gearStats(gearId, enhance = 0) {
  const T = TIERS[GEAR[gearId].tier];
  const time = Math.round(T.time * (1 - ENHANCE_TIME_PER_LEVEL * enhance) * 100) / 100;
  const [a, b] = T.harvest;
  // 강화 +2마다 최대 수확량 +1, +4부터 최소 수확량 +1
  const harvest = [a + Math.floor(enhance / 4), b + Math.floor(enhance / 2)];
  return { tier: T, range: T.range, rangeText: T.rangeText, time, harvest, color: T.color };
}

/** 현재 강화 단계(enhance)에서 다음 단계로 올리는 비용. 최대면 null */
export function enhanceCost(gearId, enhance) {
  if (enhance >= MAX_ENHANCE) return null;
  return TIERS[GEAR[gearId].tier].enhanceBase * (enhance + 1);
}

export function harvestText(harvest) {
  const [a, b] = harvest;
  return a === b ? `${a}개` : `${a}~${b}개`;
}

/** UI용 능력치 요약: 낫은 수확량, 호미·물뿌리개는 범위 */
export function statsText(kind, stats) {
  const main = kind === 'sickle' ? `수확량 ${harvestText(stats.harvest)}` : `범위 ${stats.rangeText}`;
  return `${main} · 작업 ${stats.time}초`;
}

export function rollHarvest(harvest) {
  const [a, b] = harvest;
  return a + Math.floor(Math.random() * (b - a + 1));
}

export function rangeOffsets(range) {
  if (range === 'row') return [[0, -1], [0, 0], [0, 1]];
  if (range === 'square') {
    const out = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) out.push([dr, dc]);
    return out;
  }
  return [[0, 0]];
}
