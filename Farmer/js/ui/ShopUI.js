import { G, formatMoney } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { stars } from '../data/crops.js';
import { SLOT_NAMES, SETS } from '../data/clothes.js';
import { TOOLS, TOOL_ORDER, gearStats, statsText } from '../data/tools.js';
import { ShopSystem } from '../systems/ShopSystem.js';
import { StaminaSystem } from '../systems/StaminaSystem.js';
import { OutfitSystem } from '../systems/OutfitSystem.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { StorageSystem } from '../systems/StorageSystem.js';
import { AudioManager } from '../core/AudioManager.js';
import { openModal, refreshModal, tabsHTML, bindTabs } from './Panels.js';
import { toast } from './HUD.js';

const TABS = [['seed', '🌱 씨앗 구매'], ['goods', '🍞 음식·잡화·옷 구매'], ['gear', '🔧 장비 구매'], ['sell', '💰 작물 판매']];
let tab = 'seed';
let gearKind = 'hoe';

const hex = (c) => '#' + c.toString(16).padStart(6, '0');

function qtyButtons(itemId, disabled) {
  const max = ShopSystem.maxAffordable(itemId);
  return [1, 5, 10].map((n) => `<button class="btn small" data-buy="${itemId}" data-n="${n}" ${disabled ? 'disabled' : ''}>${n}</button>`).join('')
    + `<button class="btn small" data-buy="${itemId}" data-n="${max}" ${disabled || !max ? 'disabled' : ''}>최대(${max})</button>`;
}

function seedTab() {
  return `<div class="shop-list scroll">${ShopSystem.seedList().map((e) => {
    const c = e.crop;
    if (!e.unlocked) {
      return `<div class="shop-row locked"><span class="ico big">🔒</span>
        <div class="info"><b>${c.name} 씨앗</b> <span class="stars">${stars(c.grade)}</span><small>${e.req}</small></div></div>`;
    }
    return `<div class="shop-row">
      <span class="ico big">🌱<span class="sub-ico">${c.icon}</span></span>
      <div class="info">
        <b>${c.name} 씨앗</b> <span class="stars">${stars(c.grade)}</span>
        <small>${c.seedPrice}원 · 성장 ${c.days}일 · 판매가 ${c.sellPrice}원 · <span class="stam">⚡ 심기 체력 ${StaminaSystem.plantCost(e.cropId)}</span></small>
        <small class="have">가방에 ${InventorySystem.count(e.itemId)}개</small>
      </div>
      <div class="qty">${qtyButtons(e.itemId)}</div>
    </div>`;
  }).join('')}</div>`;
}

function goodsTab() {
  return `<div class="shop-list scroll">${ShopSystem.goodsList().map((e) => {
    const it = e.item;
    if (!e.unlocked) {
      return `<div class="shop-row locked"><span class="ico big">🔒</span><div class="info"><b>${it.name}</b><small>${e.req}</small></div></div>`;
    }
    if (it.type === 'cloth') {
      const owned = OutfitSystem.owns(e.itemId);
      return `<div class="shop-row">
        <span class="ico big">${it.icon}</span>
        <div class="info"><b>${it.name}</b> <small>${SLOT_NAMES[it.slot]} · 최대 체력 +${it.stamina} · ${SETS[it.setId].name}</small><small>${it.price}원</small></div>
        <div class="qty">${owned ? '<span class="tag">보유 중</span>' : `<button class="btn small primary" data-cloth="${e.itemId}">구매</button>`}</div>
      </div>`;
    }
    const effect = it.type === 'special' ? it.desc : `먹으면 체력 +${it.heal}`;
    return `<div class="shop-row">
      <span class="ico big">${it.icon}</span>
      <div class="info"><b>${it.name}</b> <small>${it.price}원 · ${effect}</small><small class="have">가방에 ${InventorySystem.count(e.itemId)}개</small></div>
      <div class="qty">${qtyButtons(e.itemId)}</div>
    </div>`;
  }).join('')}</div>`;
}

function gearTab() {
  const kinds = TOOL_ORDER.map((k) => `<button class="subtab ${k === gearKind ? 'active' : ''}" data-kind="${k}">${TOOLS[k].icon} ${TOOLS[k].name}</button>`).join('');
  const rows = ShopSystem.gearList().filter((e) => e.gear.kind === gearKind).map((e) => {
    const g = e.gear;
    const st = gearStats(e.id, 0);
    const money = G.state.player.money;
    const rankTag = e.canEquip
      ? '<span class="tag good">착용 가능</span>'
      : `<span class="tag lock">🔒 '${e.rankName}'부터 착용</span>`;
    const action = e.owned
      ? `<span class="tag ${e.equipped ? 'held' : ''}">${e.equipped ? '장착 중' : '보유 중'}</span>`
      : `<button class="btn small primary" data-gear="${e.id}" ${money < g.price ? 'disabled' : ''}>구매 ${formatMoney(g.price)}원</button>`;
    return `<div class="shop-row ${e.owned ? 'have' : ''}">
      <span class="ico big" style="color:${hex(g.color)}">${g.icon}<span class="lv" style="background:${hex(g.color)}">${g.tier + 1}</span></span>
      <div class="info"><b>${g.name}</b> ${rankTag}
        <small>${statsText(g.kind, st)} · 강화 +5까지 가능</small>
        <small>${e.owned ? '구매 완료' : `${formatMoney(g.price)}원`}</small></div>
      <div class="qty">${action}</div>
    </div>`;
  }).join('');
  return `<div class="sub-tabs">${kinds}</div>
    <div class="shop-list scroll">${rows}
    <div class="note">🔧 장비는 직책과 상관없이 살 수 있지만, <b>착용은 직책이 올라야</b> 가능해요 (등급 1단계 = 직책 1단계).<br>산 장비는 가방의 '장비' 탭에서 장착하고, 대장간에서 장비마다 따로 강화할 수 있어요.</div></div>`;
}

function sellTab() {
  const list = ShopSystem.sellableCrops();
  const total = list.reduce((s, e) => s + e.crop.sellPrice * e.n, 0);
  if (!list.length) return '<div class="shop-list empty">팔 수 있는 작물이 없어요.<br>수확한 작물은 창고로 들어가고, 여기서 바로 팔 수 있어요.</div>';
  return `
    <div class="sell-head">창고 + 가방 작물 <b>${list.reduce((s, e) => s + e.n, 0)}개</b> · 모두 팔면 <b>${formatMoney(total)}원</b>
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

function render(body) {
  body.innerHTML = `
    <div class="shop-top">🧑‍💼 최 사장: "필요한 거 있으면 말씀만 하세요!" <span class="money">💰 ${formatMoney(G.state.player.money)}원</span></div>
    ${tabsHTML(TABS, tab)}
    ${tab === 'seed' ? seedTab() : tab === 'goods' ? goodsTab() : tab === 'gear' ? gearTab() : sellTab()}`;
  bindTabs(body, (t) => { tab = t; refreshModal('shop'); });
  body.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => { gearKind = b.dataset.kind; refreshModal('shop'); }));
  body.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => ShopSystem.buy(b.dataset.buy, Number(b.dataset.n))));
  body.querySelectorAll('[data-cloth]').forEach((b) => b.addEventListener('click', () => ShopSystem.buyCloth(b.dataset.cloth)));
  body.querySelectorAll('[data-gear]').forEach((b) => b.addEventListener('click', () => ShopSystem.buyGear(b.dataset.gear)));
  body.querySelectorAll('[data-sell]').forEach((b) => b.addEventListener('click', () => {
    const money = ShopSystem.sell(b.dataset.sell, Number(b.dataset.n));
    if (money) {
      AudioManager.sfx('coin');
      toast(`+${formatMoney(money)}원`, 'good');
    }
  }));
  body.querySelector('[data-act="sellAll"]')?.addEventListener('click', () => ShopSystem.sellAll());
}

export const ShopUI = {
  open() {
    openModal('shop', '🛒 상점', render, { wide: true });
  },
  init() {
    for (const evt of ['money', 'inventory', 'storage', 'outfit', 'gear', 'rank']) EventBus.on(evt, () => refreshModal('shop'));
  },
};
