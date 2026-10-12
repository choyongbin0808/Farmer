import { G, formatMoney } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { AudioManager } from '../core/AudioManager.js';
import { getItem } from '../data/items.js';
import { StorageSystem } from '../systems/StorageSystem.js';
import { ShopSystem } from '../systems/ShopSystem.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { openModal, refreshModal, tabsHTML, bindTabs } from './Panels.js';
import { toast } from './HUD.js';
import { itemSvg } from './ItemIcons.js';

/** 창고: 작물 보관 + 작물 출하(판매) — 작물은 여기서만 팔 수 있다 */
const TABS = [['sell', '💰 작물 판매'], ['store', '📦 보관함']];
let tab = 'sell';

function sellTab() {
  const list = ShopSystem.sellableCrops();
  const total = list.reduce((s, e) => s + e.crop.sellPrice * e.n, 0);
  if (!list.length) return '<div class="shop-list empty">팔 수 있는 작물이 없어요.<br>수확한 작물은 자동으로 창고에 들어오고, 여기서 바로 팔 수 있어요.</div>';
  return `
    <div class="sell-head"><span>창고 + 가방 작물 <b>${list.reduce((s, e) => s + e.n, 0)}개</b> · 모두 팔면 <b>${formatMoney(total)}원</b></span>
      <button class="btn primary" data-act="sellAll">모두 판매</button></div>
    <div class="shop-list scroll">${list.map((e) => `
      <div class="shop-row">
        <span class="ico big">${e.crop.icon}</span>
        <div class="info"><b>${e.crop.name}</b> <small>개당 ${e.crop.sellPrice}원 · 보유 ${e.n}개 (창고 ${StorageSystem.count(e.id)} · 가방 ${InventorySystem.count(e.id)})</small></div>
        <div class="qty">
          <button class="btn small" data-sell="${e.cropId}" data-n="1">1개</button>
          <button class="btn small" data-sell="${e.cropId}" data-n="10">10개</button>
          <button class="btn small primary" data-sell="${e.cropId}" data-n="${e.n}">전부 (${formatMoney(e.crop.sellPrice * e.n)}원)</button>
        </div>
      </div>`).join('')}</div>`;
}

function storeTab() {
  const entries = StorageSystem.entries().sort((a, b) => (getItem(b[0]).price || 0) - (getItem(a[0]).price || 0));
  const invCrops = G.state.bag.crop.concat(G.state.hotbar)
    .filter((s) => s && getItem(s.id).type === 'crop')
    .reduce((acc, s) => { acc[s.id] = (acc[s.id] || 0) + s.n; return acc; }, {});

  const rows = entries.map(([id, n]) => {
    const it = getItem(id);
    return `<div class="shop-row">
      <span class="ico big">${it.svg ? itemSvg(it.svg) : it.icon}</span>
      <div class="info"><b>${it.name}</b> <small>${n}개${it.price ? ` · 개당 ${it.price}원 · 총 ${formatMoney(it.price * n)}원` : ''}</small></div>
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
  return `<div class="shop-list scroll">${rows}</div>
    ${inv ? `<h4 class="sub-title">가방 속 작물</h4><div class="shop-list">${inv}</div>` : ''}`;
}

function render(body) {
  body.innerHTML = `
    <div class="shop-top"><span>📦 수확한 작물은 자동으로 창고에 보관돼요. <b>작물은 여기 창고에서만 팔 수 있어요.</b></span>
      <span class="money">💰 ${formatMoney(G.state.player.money)}원 · 창고 가치 ${formatMoney(StorageSystem.totalValue())}원</span></div>
    ${tabsHTML(TABS, tab)}
    ${tab === 'sell' ? sellTab() : storeTab()}`;
  bindTabs(body, (t) => { tab = t; refreshModal('storage'); });
  body.querySelectorAll('[data-take]').forEach((b) => b.addEventListener('click', () => StorageSystem.takeOut(b.dataset.take, Number(b.dataset.n))));
  body.querySelectorAll('[data-put]').forEach((b) => b.addEventListener('click', () => StorageSystem.putIn(b.dataset.put)));
  body.querySelectorAll('[data-sell]').forEach((b) => b.addEventListener('click', () => {
    const money = ShopSystem.sell(b.dataset.sell, Number(b.dataset.n));
    if (money) {
      AudioManager.sfx('coin');
      toast(`+${formatMoney(money)}원`, 'good');
    }
  }));
  body.querySelector('[data-act="sellAll"]')?.addEventListener('click', () => ShopSystem.sellAll());
}

export const StorageUI = {
  open() {
    tab = 'sell';
    openModal('storage', '📦 창고', render, { wide: true });
  },
  init() {
    for (const evt of ['storage', 'inventory', 'money']) EventBus.on(evt, () => refreshModal('storage'));
  },
};
