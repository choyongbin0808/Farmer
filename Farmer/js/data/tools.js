export const TOOLS = {
  hoe:    { name: '호미',     itemId: 'tool_hoe',    icon: '⛏️', desc: '땅 갈기' },
  can:    { name: '물뿌리개', itemId: 'tool_can',    icon: '💧', desc: '물 주기' },
  sickle: { name: '낫',       itemId: 'tool_sickle', icon: '✂️', desc: '수확' },
};

export const TOOL_ORDER = ['hoe', 'can', 'sickle'];

// index = 단계 (1 ~ 5)
export const TOOL_LEVELS = [
  null,
  { name: '낡은',   cost: 0,    range: 'single', rangeText: '1칸',   harvest: [1, 1], time: 0.8,  color: 0x8a7b6a },
  { name: '구리',   cost: 300,  range: 'single', rangeText: '1칸',   harvest: [1, 2], time: 0.6,  color: 0xc8733a },
  { name: '철',     cost: 800,  range: 'row',    rangeText: '1x3칸', harvest: [2, 2], time: 0.45, color: 0xb8c0c8 },
  { name: '금',     cost: 2000, range: 'square', rangeText: '3x3칸', harvest: [2, 3], time: 0.3,  color: 0xf2c641 },
  { name: '무지개', cost: 5000, range: 'square', rangeText: '3x3칸', harvest: [3, 3], time: 0.15, color: 0xff77cc },
];

export const MAX_TOOL_LEVEL = 5;

export function harvestText(level) {
  const [a, b] = TOOL_LEVELS[level].harvest;
  return a === b ? `${a}개` : `${a}~${b}개`;
}

export function rollHarvest(level) {
  const [a, b] = TOOL_LEVELS[level].harvest;
  return a + Math.floor(Math.random() * (b - a + 1));
}

export function rangeOffsets(level) {
  const r = TOOL_LEVELS[level].range;
  if (r === 'row') return [[0, -1], [0, 0], [0, 1]];
  if (r === 'square') {
    const out = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) out.push([dr, dc]);
    return out;
  }
  return [[0, 0]];
}
