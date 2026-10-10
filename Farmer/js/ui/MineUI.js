import { G, formatMoney } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { AudioManager } from '../core/AudioManager.js';
import { ORES, PICKAXES } from '../data/mining.js';
import { MiningSystem } from '../systems/MiningSystem.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { StorageSystem } from '../systems/StorageSystem.js';
import { openModal, refreshModal } from './Panels.js';
import { toast } from './HUD.js';

const hex = (c) => '#' + c.toString(16).padStart(6, '0');

// ───── 한 반장: 광석 팔기 ─────
function renderOre(body) {
  const list = MiningSystem.sellableOres();
  const total = list.reduce((s, e) => s + e.ore.price * e.n, 0);
  const table = Object.entries(ORES).map(([, o]) => `<span class="ore-chip">${o.icon} ${o.name} <b>${o.price}원</b> <small>${PICKAXES[o.tier].name.replace(' 곡괭이', '')}↑</small></span>`).join('');
  const rows = list.length
    ? `<div class="sell-head"><span>가방 + 창고 광석 <b>${list.reduce((s, e) => s + e.n, 0)}개</b> · 모두 팔면 <b>${formatMoney(total)}원</b></span>
        <button class="btn primary" data-act="sellAll">모두 판매</button></div>
      <div class="shop-list scroll">${list.map((e) => `
        <div class="shop-row">
          <span class="ico big">${e.ore.icon}</span>
          <div class="info"><b>${e.ore.name}</b> <small>개당 ${e.ore.price}원 · 보유 ${e.n}개 (가방 ${InventorySystem.count(e.id)} · 창고 ${StorageSystem.count(e.id)})</small></div>
          <div class="qty">
            <button class="btn small" data-sell="${e.id}" data-n="1">1개</button>
            <button class="btn small" data-sell="${e.id}" data-n="10">10개</button>
            <button class="btn small primary" data-sell="${e.id}" data-n="${e.n}">전부 (${formatMoney(e.ore.price * e.n)}원)</button>
          </div>
        </div>`).join('')}</div>`
    : '<div class="shop-list empty">팔 광석이 없어요.<br>곡괭이로 광맥을 캐서 가져오게나.</div>';
  body.innerHTML = `
    <div class="shop-top">👷 한 반장: "땀 흘려 캔 광석, 값은 제대로 쳐주지!" <span class="money">💰 ${formatMoney(G.state.player.money)}원</span></div>
    ${rows}
    <div class="note">⛏️ 광석 시세 (필요 곡괭이): <div class="ore-table">${table}</div>
    광산은 <b>4층</b>까지 있어요. 층이 올라갈수록 좋은 광석이 잘 나오고, 3층부터는 석탄·구리가 나오지 않아요.<br>
    광맥은 아무 데나 생기고, 시간이 지나면 조금씩 다시 생겨요. 캘 때마다 체력이 조금 들어요.</div>`;
  body.querySelectorAll('[data-sell]').forEach((b) => b.addEventListener('click', () => {
    const money = MiningSystem.sell(b.dataset.sell, Number(b.dataset.n));
    if (money) {
      AudioManager.sfx('coin');
      toast(`+${formatMoney(money)}원`, 'good');
    }
  }));
  body.querySelector('[data-act="sellAll"]')?.addEventListener('click', () => MiningSystem.sellAll());
}

// ───── 돌쇠: 곡괭이 사기 ─────
function renderPick(body) {
  const money = G.state.player.money;
  const rows = PICKAXES.map((p, tier) => {
    const owned = InventorySystem.count(p.id) > 0;
    const canMine = Object.values(ORES).filter((o) => o.tier <= tier).map((o) => o.icon).join('');
    const action = owned
      ? '<span class="tag held">보유 중</span>'
      : p.price
        ? `<button class="btn small primary" data-pick="${p.id}" ${money < p.price ? 'disabled' : ''}>구매 ${formatMoney(p.price)}원</button>`
        : '<span class="tag">한 반장이 줘요</span>';
    return `<div class="shop-row ${owned ? 'have' : ''}">
      <span class="ico big">⛏️<span class="lv" style="background:${hex(p.color)}">${tier + 1}</span></span>
      <div class="info"><b>${p.name}</b>
        <small>캐는 시간 ${p.time}초 · 광석 더 나올 확률 ${Math.round(p.extra * 100)}% · 체력 ${p.stamina}</small>
        <small>캘 수 있는 광석: ${canMine}</small></div>
      <div class="qty">${action}</div>
    </div>`;
  }).join('');
  body.innerHTML = `
    <div class="shop-top">🧑‍🔧 돌쇠: "좋은 곡괭이 하나면 광산이 달라 보여요!" <span class="money">💰 ${formatMoney(money)}원</span></div>
    <div class="shop-list scroll">${rows}</div>
    <div class="note">⛏️ 등급이 높을수록 빨리 캐고, 광석이 여러 개 나올 확률이 올라가요. 단단한 광석은 좋은 곡괭이로만 캘 수 있어요.<br>산 곡괭이는 가방 '채광' 탭에 들어가요. 핫바로 옮겨서 쓰세요.</div>`;
  body.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => MiningSystem.buyPick(b.dataset.pick)));
}

export const MineUI = {
  openOre() {
    openModal('ore', '⛏️ 광석 팔기', renderOre, { wide: true });
  },
  openPick() {
    openModal('pick', '🛒 돌쇠의 곡괭이 가게', renderPick, { wide: true });
  },
  init() {
    for (const evt of ['money', 'inventory', 'storage']) {
      EventBus.on(evt, () => { refreshModal('ore'); refreshModal('pick'); });
    }
  },
};
