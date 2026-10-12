import { G, formatMoney } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { stars, growText } from '../data/crops.js';
import { SLOT_NAMES, SETS } from '../data/clothes.js';
import { TOOLS, TOOL_ORDER, gearStats, statsText } from '../data/tools.js';
import { ShopSystem } from '../systems/ShopSystem.js';
import { StaminaSystem } from '../systems/StaminaSystem.js';
import { OutfitSystem } from '../systems/OutfitSystem.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { StorageSystem } from '../systems/StorageSystem.js';
import { AudioManager } from '../core/AudioManager.js';
import { FACILITIES, FACILITY_ORDER } from '../data/facilities.js';
import { getItem } from '../data/items.js';
import { FacilitySystem } from '../systems/FacilitySystem.js';
import { SoilBoxSystem } from '../systems/SoilBoxSystem.js';
import { openModal, refreshModal, closeModal, tabsHTML, bindTabs } from './Panels.js';
import { toast } from './HUD.js';
import { gearIconSVG } from './GearIcons.js';
import { itemSvg } from './ItemIcons.js';

// 작물 판매는 창고에서만 (StorageUI)
const TABS = [['seed', '🌱 씨앗 구매'], ['goods', '🍞 음식·잡화·옷 구매'], ['gear', '🔧 장비 구매'], ['facility', '🏡 시설·흙']];
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
        <small>${c.seedPrice}원 · 성장 ${growText(c.grow)} · 판매가 ${c.sellPrice}원 · <span class="stam">⚡ 심기 체력 ${StaminaSystem.plantCost(e.cropId)}</span></small>
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
      <span class="ico big">${it.svg ? itemSvg(it.svg) : it.icon}</span>
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
      <span class="ico big">${gearIconSVG(e.id)}<span class="lv" style="background:${hex(g.color)}">${g.tier + 1}</span></span>
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

function facilityTab() {
  const money = G.state.player.money;
  const soil = getItem('soil_plain');
  const full = SoilBoxSystem.free() <= 0;
  const soilRow = `<div class="shop-row">
    <span class="ico big">${soil.icon}</span>
    <div class="info"><b>${soil.name}</b> <small>${soil.price}원 · ${soil.desc}</small>
      <small class="have">📦 지하 흙 상자 <b>${SoilBoxSystem.total()} / ${SoilBoxSystem.capacity()}</b> (사면 상자로 바로 들어가요)</small></div>
    <div class="qty">${full ? '<span class="tag">상자가 가득 찼어요</span>' : qtyButtons('soil_plain')}</div>
  </div>`;
  const rows = FACILITY_ORDER.map((kind) => {
    const f = FACILITIES[kind];
    const owned = FacilitySystem.ownedCount(kind);
    const full = owned >= f.max;
    return `<div class="shop-row">
      <span class="ico big">${f.icon}</span>
      <div class="info"><b>${f.name}</b> <span class="tag">${'■'.repeat(owned)}${'□'.repeat(f.max - owned)}</span>
        <small>${f.desc}</small>
        <small>${formatMoney(f.price)}원 · 지하 작업실에 ${owned}/${f.max}개 설치됨</small></div>
      <div class="qty">
        <button class="btn small primary" data-fac="${kind}" ${full || money < f.price ? 'disabled' : ''}>${full ? '자리가 꽉 찼어요' : `구매·설치 ${formatMoney(f.price)}원`}</button>
      </div>
    </div>`;
  }).join('');
  return `<div class="shop-list scroll">${soilRow}${rows}
    <div class="note">🏡 시설을 사면 <b>우리 집 지하 작업실</b>의 빈 자리에 바로 설치돼요 (종류별 3칸). 집 안의 계단으로 내려가서 사용해요.<br>
    🍲 약탕기: 일반 흙 1 + 타우린 3 + 키토산 1 → 토양 흙 1 · 🏡 육묘장: 씨앗 1 + 토양 흙 1 → 모종 1 (3배 빨리 자람)</div></div>`;
}

function render(body) {
  if (!TABS.some(([id]) => id === tab)) tab = 'seed';
  body.innerHTML = `
    <div class="shop-top"><span>🧑‍💼 최 사장: "필요한 거 있으면 말씀만 하세요! 작물 판매는 창고에서 하시면 돼요."</span> <span class="money">💰 ${formatMoney(G.state.player.money)}원</span></div>
    ${tabsHTML(TABS, tab)}
    ${tab === 'seed' ? seedTab() : tab === 'goods' ? goodsTab() : tab === 'gear' ? gearTab() : facilityTab()}`;
  bindTabs(body, (t) => { tab = t; refreshModal('shop'); });
  body.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => { gearKind = b.dataset.kind; refreshModal('shop'); }));
  body.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => ShopSystem.buy(b.dataset.buy, Number(b.dataset.n))));
  body.querySelectorAll('[data-cloth]').forEach((b) => b.addEventListener('click', () => ShopSystem.buyCloth(b.dataset.cloth)));
  body.querySelectorAll('[data-gear]').forEach((b) => b.addEventListener('click', () => ShopSystem.buyGear(b.dataset.gear)));
  body.querySelectorAll('[data-fac]').forEach((b) => b.addEventListener('click', () => FacilitySystem.buy(b.dataset.fac)));
}

export const ShopUI = {
  open() {
    openModal('shop', '🛒 상점', render, { wide: true });
  },
  init() {
    for (const evt of ['money', 'inventory', 'storage', 'outfit', 'gear', 'rank', 'facility', 'soil']) EventBus.on(evt, () => refreshModal('shop'));
  },
};
