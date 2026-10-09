import { CROPS } from './crops.js';
import { CLOTHES } from './clothes.js';
import { TOOLS, GEAR } from './tools.js';
import { RODS, FISH } from './fishing.js';
import { PICKAXES, ORES } from './mining.js';
import { FACILITIES } from './facilities.js';

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

// 모종 (육묘장에서 씨앗 + 토양 흙으로 만든다) — 씨앗처럼 심고, 3배 빨리 자란다
for (const [id, c] of Object.entries(CROPS)) {
  ITEMS['sapling_' + id] = {
    id: 'sapling_' + id, name: c.name + ' 모종', type: 'seed', cropId: id, seedling: true,
    icon: '🪴', subIcon: c.icon, stack: 99,
  };
}

// 핫바에 넣고 쓰는 도구: 낚싯대(시냇물 클릭) · 곡괭이(광맥 클릭)
RODS.forEach((r, tier) => {
  ITEMS[r.id] = { id: r.id, name: r.name, type: 'rod', tier, icon: '🎣', color: r.color, price: r.price, stack: 1 };
});
PICKAXES.forEach((p, tier) => {
  ITEMS[p.id] = { id: p.id, name: p.name, type: 'pick', tier, icon: '⛏️', color: p.color, price: p.price, stack: 1 };
});

// 재료: 흙 · 낚시 교환품
Object.assign(ITEMS, {
  soil_plain:   { id: 'soil_plain',   name: '일반 흙', type: 'material', icon: '🟫', price: 20, stack: 99, desc: '약탕기에서 토양 흙을 만드는 재료예요.' },
  soil_rich:    { id: 'soil_rich',    name: '토양 흙', type: 'material', icon: '🟫', subIcon: '✨', stack: 99, desc: '육묘장에서 씨앗과 함께 모종을 키우는 영양 흙이에요.' },
  mat_taurine:  { id: 'mat_taurine',  name: '타우린',  type: 'material', icon: '💊', stack: 99, desc: '오 씨에게 물고기를 넘기고 받은 타우린. 약탕기 재료예요.' },
  mat_chitosan: { id: 'mat_chitosan', name: '키토산',  type: 'material', icon: '🐚', stack: 99, desc: '오 씨에게 게를 넘기고 받은 키토산. 약탕기 재료예요.' },
});

// 광석 (광산에서 캐서 한 반장에게 판다)
for (const [id, o] of Object.entries(ORES)) {
  ITEMS[id] = { id, name: o.name, type: 'ore', icon: o.icon, price: o.price, stack: 99 };
}

// 물고기 · 게 — 한 마리마다 무게가 달라 겹쳐 쌓지 않는다 (칸 = { id, n: 1, w })
for (const [id, f] of Object.entries(FISH)) {
  ITEMS[id] = { id, name: f.name, type: 'fish', crab: !!f.crab, grade: f.grade, icon: f.icon, color: f.color, stack: 1 };
}

// 시설 (상점에서 사서 가방 '시설' 칸에 두었다가 배치)
for (const [kind, f] of Object.entries(FACILITIES)) {
  ITEMS[f.itemId] = { id: f.itemId, name: f.name, type: 'facility', kind, icon: f.icon, price: f.price, stack: 99, desc: f.desc };
}

export function getItem(id) {
  return ITEMS[id];
}

/** 핫바에 넣고 쓰는 도구(낚싯대·곡괭이)인지 */
export function isHandTool(item) {
  return item?.type === 'rod' || item?.type === 'pick';
}

export const TYPE_NAMES = {
  seed: '씨앗', crop: '작물', food: '음식', tool: '장비', gear: '장비', special: '특별', cloth: '옷',
  rod: '낚싯대', pick: '곡괭이', material: '재료', ore: '광석', fish: '물고기', facility: '시설',
};
