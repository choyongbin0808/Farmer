import { G, formatMoney } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { CROPS, CROP_ORDER, stars, seedlingDays } from '../data/crops.js';
import { FISH, FISH_ORDER, GRADE_REWARD, weightText } from '../data/fishing.js';
import { ORES, ORE_ORDER, PICKAXES } from '../data/mining.js';
import { makeCropModel } from '../world/Models.js';
import { makeFishModel, makeOreNode, setOreNode } from '../world/ExtraModels.js';
import { openModal, refreshModal, tabsHTML, bindTabs } from './Panels.js';
import { BookPreview } from './BookPreview.js';

// 도감 — 작물 · 물고기 · 광석. 한 번이라도 얻은 것만 모습이 보이고, 아직이면 ❔ 칸
const TABS = [['crop', '🌾 작물'], ['fish', '🐟 물고기'], ['ore', '⛏️ 광석']];
let tab = 'crop';
let selected = { crop: null, fish: null, ore: null };

const hex = (c) => '#' + c.toString(16).padStart(6, '0');

/** 탭별 항목: { id, icon, name, grade, count, found, color } */
function entries() {
  const s = G.state;
  if (tab === 'crop') {
    return CROP_ORDER.map((id) => {
      const c = CROPS[id];
      const count = s.stats.harvested?.[id] || 0;
      return { id, icon: c.icon, name: c.name, grade: c.grade, count, found: count > 0, color: c.color };
    });
  }
  if (tab === 'fish') {
    return FISH_ORDER.map((id) => {
      const f = FISH[id];
      const best = s.fishing.best?.[id];
      const count = Math.max(s.fishing.counts?.[id] || 0, best ? 1 : 0);
      return { id, icon: f.icon, name: f.name, grade: f.grade, count, found: count > 0, color: f.color, best };
    });
  }
  return ORE_ORDER.map((id) => {
    const o = ORES[id];
    const count = s.mine.mined?.[id] || 0;
    return { id, icon: o.icon, name: o.name, grade: o.tier + 1, count, found: count > 0, color: o.color };
  });
}

function makeModel(id) {
  if (tab === 'crop') return makeCropModel(id, 3);
  if (tab === 'fish') return makeFishModel(id);
  const node = makeOreNode();
  setOreNode(node, id);
  return node;
}

function infoHTML(e) {
  if (tab === 'crop') {
    const c = CROPS[e.id];
    return `
      <div><span>🧺 수확한 수</span><b>${e.count.toLocaleString()}개</b></div>
      <div><span>⭐ 등급</span><b class="stars">${stars(c.grade)}</b></div>
      <div><span>🌱 자라는 기간</span><b>${c.days}일</b><small>모종이면 ${seedlingDays(e.id)}일</small></div>
      <div><span>💰 판매가</span><b>${formatMoney(c.sellPrice)}원</b></div>`;
  }
  if (tab === 'fish') {
    const f = FISH[e.id];
    return `
      <div><span>🎣 잡은 수</span><b>${e.count.toLocaleString()}마리</b></div>
      <div><span>📏 최대 크기</span><b>${e.best ? weightText(e.best) : '-'}</b><small>이 종류 ${weightText(f.w[0])} ~ ${weightText(f.w[1])}</small></div>
      <div><span>⭐ 등급</span><b class="stars">${stars(f.grade)}</b></div>
      <div><span>🎁 교환</span><b>${f.crab ? '🐚 키토산' : '💊 타우린'} ${GRADE_REWARD[f.grade]}개~</b><small>무거울수록 더 많이</small></div>`;
  }
  const o = ORES[e.id];
  return `
    <div><span>⛏️ 캔 수</span><b>${e.count.toLocaleString()}개</b></div>
    <div><span>💰 판매가</span><b>${formatMoney(o.price)}원</b></div>
    <div><span>🔨 필요한 곡괭이</span><b>${PICKAXES[o.tier].name}</b><small>이상</small></div>
    <div><span>⭐ 귀한 정도</span><b class="stars">${stars(o.tier + 1)}</b></div>`;
}

const HINTS = {
  crop: '씨앗을 심어 한 번 수확하면 도감에 올라가요.',
  fish: '시냇물에서 한 번 낚으면 도감에 올라가요. 좋은 낚싯대일수록 귀한 고기가 잘 물어요.',
  ore: '광산에서 한 번 캐면 도감에 올라가요. 단단한 광석은 좋은 곡괭이가 필요해요.',
};

function detailHTML(e) {
  if (!e) return '<div class="book-detail empty">왼쪽에서 하나를 골라 보세요.</div>';
  if (!e.found) {
    return `<div class="book-detail unknown">
      <div class="book-q">❔</div>
      <h3>???</h3>
      <div class="stars">${stars(e.grade)}</div>
      <p>${HINTS[tab]}</p>
    </div>`;
  }
  return `<div class="book-detail">
    <div class="book-stage" style="--bc:${hex(e.color)}"><div class="book-3d"></div><small>드래그해서 돌려 보기</small></div>
    <h3>${e.icon} ${e.name}</h3>
    <div class="book-info">${infoHTML(e)}</div>
  </div>`;
}

function render(body) {
  const list = entries();
  if (!list.find((e) => e.id === selected[tab])) selected[tab] = (list.find((e) => e.found) || list[0]).id;
  const sel = list.find((e) => e.id === selected[tab]);
  const found = list.filter((e) => e.found).length;
  const cards = list.map((e) => `
    <button class="book-card ${e.found ? '' : 'unknown'} ${e.id === sel.id ? 'selected' : ''}" data-id="${e.id}" style="--bc:${hex(e.color)}">
      <span class="ico">${e.found ? e.icon : '❔'}</span>
      <b>${e.found ? e.name : '???'}</b>
      <small class="stars">${stars(e.grade)}</small>
    </button>`).join('');
  body.innerHTML = `
    ${tabsHTML(TABS, tab)}
    <div class="q-progress">${TABS.find(([id]) => id === tab)[1]} 도감 <b>${found} / ${list.length}</b> 발견${found === list.length ? ' · 🏆 모두 모았어요!' : ''}</div>
    <div class="book-wrap">
      <div class="book-grid scroll">${cards}</div>
      ${detailHTML(sel)}
    </div>`;
  bindTabs(body, (t) => { tab = t; refreshModal('book'); });
  body.querySelectorAll('.book-card').forEach((b) => b.addEventListener('click', () => {
    selected[tab] = b.dataset.id;
    refreshModal('book');
  }));
  if (sel.found) BookPreview.mount(body.querySelector('.book-3d'), `${tab}:${sel.id}`, () => makeModel(sel.id));
}

export const BookUI = {
  open() {
    openModal('book', '📖 도감', render, { wide: true });
  },
  init() {
    for (const evt of ['harvest', 'fish', 'mined']) EventBus.on(evt, () => refreshModal('book'));
  },
};
