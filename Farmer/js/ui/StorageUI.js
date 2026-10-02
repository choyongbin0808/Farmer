import { G, formatMoney } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { getItem } from '../data/items.js';
import { StorageSystem } from '../systems/StorageSystem.js';
import { openModal, refreshModal } from './Panels.js';

function render(body) {
  const entries = StorageSystem.entries().sort((a, b) => getItem(b[0]).price - getItem(a[0]).price);
  const invCrops = G.state.inventory.concat(G.state.hotbar)
    .filter((s) => s && getItem(s.id).type === 'crop')
    .reduce((acc, s) => { acc[s.id] = (acc[s.id] || 0) + s.n; return acc; }, {});

  const rows = entries.map(([id, n]) => {
    const it = getItem(id);
    return `<div class="shop-row">
      <span class="ico big">${it.icon}</span>
      <div class="info"><b>${it.name}</b> <small>${n}개 · 개당 ${it.price}원 · 총 ${formatMoney(it.price * n)}원</small></div>
      <div class="qty">
        <button class="btn small" data-take="${id}" data-n="1">1개 꺼내기</button>
        <button class="btn small" data-take="${id}" data-n="10">10개</button>
        <button class="btn small" data-take="${id}" data-n="${n}">전부</button>
      </div>
    </div>`;
  }).join('') || '<div class="shop-list empty">창고가 비어 있어요. 수확한 작물은 자동으로 여기에 들어와요.</div>';

  const inv = Object.entries(invCrops).map(([id, n]) => {
    const it = getItem(id);
    return `<div class="shop-row compact">
      <span class="ico">${it.icon}</span>
      <div class="info"><b>${it.name}</b> <small>가방에 ${n}개</small></div>
      <div class="qty"><button class="btn small" data-put="${id}">창고에 넣기</button></div>
    </div>`;
  }).join('');

  body.innerHTML = `
    <div class="shop-top">📦 수확한 작물은 자동으로 창고에 보관돼요. 상점 판매·퀘스트 전달에 바로 쓰여요.
      <span class="money">총 가치 ${formatMoney(StorageSystem.totalValue())}원</span></div>
    <div class="shop-list scroll">${rows}</div>
    ${inv ? `<h4 class="sub-title">가방 속 작물</h4><div class="shop-list">${inv}</div>` : ''}`;
  body.querySelectorAll('[data-take]').forEach((b) => b.addEventListener('click', () => StorageSystem.takeOut(b.dataset.take, Number(b.dataset.n))));
  body.querySelectorAll('[data-put]').forEach((b) => b.addEventListener('click', () => StorageSystem.putIn(b.dataset.put)));
}

export const StorageUI = {
  open() {
    openModal('storage', '📦 창고', render, { wide: true });
  },
  init() {
    for (const evt of ['storage', 'inventory']) EventBus.on(evt, () => refreshModal('storage'));
  },
};
