import { CROPS } from './crops.js';
import { CLOTHES } from './clothes.js';
import { TOOLS } from './tools.js';

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

for (const [kind, t] of Object.entries(TOOLS)) {
  ITEMS[t.itemId] = { id: t.itemId, name: t.name, type: 'tool', toolKind: kind, icon: t.icon, stack: 1 };
}

Object.assign(ITEMS, {
  food_bread:    { id: 'food_bread',    name: '새참 빵',       type: 'food', heal: 20, price: 40, icon: '🍞', stack: 99 },
  food_tea:      { id: 'food_tea',      name: '시냇물 약초차', type: 'food', heal: 30, price: 80, icon: '🍵', stack: 99, unlockFlag: 'tea' },
  food_lunchbox: { id: 'food_lunchbox', name: '할머니 도시락', type: 'food', heal: 50, icon: '🍱', stack: 99 },
  special_fertilizer: {
    id: 'special_fertilizer', name: '할머니의 비료', type: 'special', icon: '🧪', stack: 99,
    desc: '자라고 있는 작물에 사용하면 성장이 하루 앞당겨져요.',
  },
});

for (const [id, c] of Object.entries(CLOTHES)) {
  ITEMS[id] = { ...c, id, type: 'cloth', stack: 1 };
}

export function getItem(id) {
  return ITEMS[id];
}

export const TYPE_NAMES = { seed: '씨앗', crop: '작물', food: '음식', tool: '장비', special: '특별', cloth: '옷' };
