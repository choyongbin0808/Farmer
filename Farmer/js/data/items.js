import { CROPS } from './crops.js';
import { CLOTHES } from './clothes.js';
import { TOOLS, GEAR } from './tools.js';

export const ITEMS = {};

for (const [id, c] of Object.entries(CROPS)) {
  ITEMS['seed_' + id] = {
    id: 'seed_' + id, name: c.name + ' 씨앗', type: 'seed', cropId: id,
    icon: '🌱', subIcon: c.icon, price: c.seedPrice, stack: 99,
  };
  ITEMS['crop_' + id] = {
    id: 'crop_' + id, name: c.name, type: 'crop', cropId: id,
    icon: c.icon, price: c.sellPrice, stack: 99,
  };
}

// 핫바용 도구 아이템 — 실제 능력치는 장착한 장비(GEAR)를 따른다
for (const [kind, t] of Object.entries(TOOLS)) {
  ITEMS[t.itemId] = { id: t.itemId, name: t.name, type: 'tool', toolKind: kind, icon: t.icon, stack: 1 };
}

// 장비 아이템(상점 구매 · 가방 '장비' 탭에서 장착) — 인벤토리 칸을 차지하지 않고 state.gear에 보관
for (const [id, g] of Object.entries(GEAR)) {
  ITEMS[id] = { ...g, type: 'gear', stack: 1 };
}

Object.assign(ITEMS, {
  food_bread:    { id: 'food_bread',    name: '새참 빵',       type: 'food', heal: 20, price: 40, icon: '🍞', stack: 99 },
  food_tea:      { id: 'food_tea',      name: '시냇물 약초차', type: 'food', heal: 30, price: 80, icon: '🍵', stack: 99, unlockFlag: 'tea' },
  food_lunchbox: { id: 'food_lunchbox', name: '할머니 도시락', type: 'food', heal: 50, icon: '🍱', stack: 99 },
  // growDays: 사용 시 앞당기는 성장 일수 ('all' = 바로 다 자람)
  special_fertilizer: {
    id: 'special_fertilizer', name: '할머니의 비료', type: 'special', icon: '🧪', stack: 99, growDays: 1,
    desc: '자라고 있는 작물에 사용하면 성장이 하루 앞당겨져요.',
  },
  special_growth: {
    id: 'special_growth', name: '성장 촉진제', type: 'special', icon: '⏩', stack: 99, growDays: 'all', price: 300,
    desc: '자라고 있는 작물에 사용하면 남은 시간을 모두 앞당겨 바로 다 자라요.',
  },
});

for (const [id, c] of Object.entries(CLOTHES)) {
  ITEMS[id] = { ...c, id, type: 'cloth', stack: 1 };
}

export function getItem(id) {
  return ITEMS[id];
}

export const TYPE_NAMES = { seed: '씨앗', crop: '작물', food: '음식', tool: '장비', gear: '장비', special: '특별', cloth: '옷' };
