import { G, formatMoney } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { TOOLS, TOOL_ORDER, GEAR, MAX_ENHANCE, gearStats, statsText } from '../data/tools.js';
import { SLOT_NAMES, SETS } from '../data/clothes.js';
import { RANKS } from '../data/ranks.js';
import { ForgeSystem } from '../systems/ForgeSystem.js';
import { FarmSystem } from '../systems/FarmSystem.js';
import { OutfitSystem } from '../systems/OutfitSystem.js';
import { GearSystem } from '../systems/GearSystem.js';
import { openModal, refreshModal, tabsHTML, bindTabs } from './Panels.js';
import { gearIconSVG } from './GearIcons.js';

const TABS = [['tools', '🔨 장비 강화'], ['clothes', '👕 옷 구매']];
let tab = 'tools';

const hex = (c) => '#' + c.toString(16).padStart(6, '0');

function gearRow(id) {
  const g = GEAR[id];
  const e = GearSystem.enhanceOf(id);
  const st = GearSystem.statsOf(id);
  const cost = ForgeSystem.enhanceCost(id);
  const equipped = GearSystem.isEquipped(id);
  const locked = !GearSystem.canEquip(id);
  const next = e < MAX_ENHANCE
    ? `<div class="next">▶ +${e + 1}: ${statsText(g.kind, gearStats(id, e + 1))}</div>`
    : '<div class="next max">최대 강화예요!</div>';
  const tags = (equipped ? '<span class="tag held">장착 중</span>' : '')
    + (locked ? `<span class="tag lock">🔒 '${RANKS[g.rank].name}'부터 착용</span>` : '');
  return `<div class="shop-row tool-row">
    <span class="ico big">${gearIconSVG(id)}<span class="lv" style="background:${hex(g.color)}">+${e}</span></span>
    <div class="info"><b>${GearSystem.displayName(id)}</b> ${tags}<small>${TOOLS[g.kind].desc} · ${statsText(g.kind, st)}</small>${next}</div>
    <div class="qty">${cost !== null ? `<button class="btn primary" data-up="${id}" ${G.state.player.money < cost ? 'disabled' : ''}>강화 ${formatMoney(cost)}원</button>` : ''}</div>
  </div>`;
}

function toolsTab() {
  const rows = TOOL_ORDER.map((kind) => {
    const t = TOOLS[kind];
    const owned = GearSystem.ownedByKind(kind);
    return `<div class="shop-section">${t.icon} ${t.name} <small>보유 ${owned.length}개</small></div>${owned.map(gearRow).join('')}`;
  }).join('');
  const next = FarmSystem.nextExpand();
  const size = G.state.farm.size;
  const expand = next
    ? `<div class="shop-row"><span class="ico big">🌾</span>
        <div class="info"><b>밭 확장 (${size}x${size} → ${next.size}x${next.size})</b><small>울타리를 옮기고 흙을 손봐서 밭을 ${next.size * next.size - size * size}칸 넓혀 줄게.</small></div>
        <div class="qty"><button class="btn primary" data-act="expand" ${G.state.player.money < next.cost ? 'disabled' : ''}>확장 ${formatMoney(next.cost)}원</button></div></div>`
    : '';
  return `<div class="shop-list scroll">${rows}${expand}
    <div class="note">🔨 강화는 장비마다 따로 올라가요 (+5까지). 새 장비는 상점에서 살 수 있어요.${G.state.flags.discount ? '<br>강 대장 할인 적용 중 (10%)' : ''}</div></div>`;
}

function clothesTab() {
  return `<div class="shop-list scroll">${ForgeSystem.clothesList().map((c) => {
    const owned = OutfitSystem.owns(c.id);
    const locked = c.rank && G.state.rank < c.rank;
    return `<div class="shop-row ${locked ? 'locked' : ''}">
      <span class="ico big">${locked ? '🔒' : c.icon}</span>
      <div class="info"><b>${c.name}</b> <small>${SLOT_NAMES[c.slot]} · 최대 체력 +${c.stamina} · ${SETS[c.setId].name}</small>
        <small>${locked ? `'${RANKS[c.rank].name}' 직책 필요` : `${formatMoney(c.price)}원`}</small></div>
      <div class="qty">${owned ? '<span class="tag">보유 중</span>' : locked ? '' : `<button class="btn small primary" data-cloth="${c.id}">구매</button>`}</div>
    </div>`;
  }).join('')}
  <div class="note">같은 세트의 모자·상의·하의를 모두 입으면 세트 효과가 생겨요.</div></div>`;
}

function render(body) {
  body.innerHTML = `
    <div class="shop-top">🧔 강 대장: "…뭘 손봐 줄까." <span class="money">💰 ${formatMoney(G.state.player.money)}원</span></div>
    ${tabsHTML(TABS, tab)}
    ${tab === 'tools' ? toolsTab() : clothesTab()}`;
  bindTabs(body, (t) => { tab = t; refreshModal('forge'); });
  body.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => ForgeSystem.enhance(b.dataset.up)));
  body.querySelectorAll('[data-cloth]').forEach((b) => b.addEventListener('click', () => ForgeSystem.buyCloth(b.dataset.cloth)));
  body.querySelector('[data-act="expand"]')?.addEventListener('click', () => ForgeSystem.expandFarm());
}

export const ForgeUI = {
  open() {
    openModal('forge', '🔨 대장간', render, { wide: true });
  },
  init() {
    for (const evt of ['money', 'gear', 'outfit', 'farmExpand']) EventBus.on(evt, () => refreshModal('forge'));
  },
};
