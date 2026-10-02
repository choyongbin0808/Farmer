import { G, formatMoney } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { TOOLS, TOOL_ORDER, TOOL_LEVELS, MAX_TOOL_LEVEL, harvestText } from '../data/tools.js';
import { SLOT_NAMES, SETS } from '../data/clothes.js';
import { RANKS } from '../data/ranks.js';
import { ForgeSystem } from '../systems/ForgeSystem.js';
import { FarmSystem } from '../systems/FarmSystem.js';
import { OutfitSystem } from '../systems/OutfitSystem.js';
import { openModal, refreshModal, tabsHTML, bindTabs } from './Panels.js';

const TABS = [['tools', '🔨 도구 강화'], ['clothes', '👕 옷 구매']];
let tab = 'tools';

function effectText(kind, lv) {
  const L = TOOL_LEVELS[lv];
  if (kind === 'sickle') return `수확량 ${harvestText(lv)} · 작업 ${L.time}초`;
  return `범위 ${L.rangeText} · 작업 ${L.time}초`;
}

function toolsTab() {
  const rows = TOOL_ORDER.map((kind) => {
    const t = TOOLS[kind];
    const lv = G.state.tools[kind];
    const cost = ForgeSystem.upgradeCost(kind);
    const color = '#' + TOOL_LEVELS[lv].color.toString(16).padStart(6, '0');
    const next = lv < MAX_TOOL_LEVEL
      ? `<div class="next">▶ ${TOOL_LEVELS[lv + 1].name} (Lv${lv + 1}): ${effectText(kind, lv + 1)}</div>`
      : '<div class="next max">최고 단계예요!</div>';
    return `<div class="shop-row tool-row">
      <span class="ico big">${t.icon}<span class="lv" style="background:${color}">Lv${lv}</span></span>
      <div class="info"><b>${TOOL_LEVELS[lv].name} ${t.name}</b> <small>${t.desc} · ${effectText(kind, lv)}</small>${next}</div>
      <div class="qty">${cost !== null ? `<button class="btn primary" data-up="${kind}" ${G.state.player.money < cost ? 'disabled' : ''}>강화 ${formatMoney(cost)}원</button>` : ''}</div>
    </div>`;
  }).join('');
  const next = FarmSystem.nextExpand();
  const size = G.state.farm.size;
  const expand = next
    ? `<div class="shop-row"><span class="ico big">🌾</span>
        <div class="info"><b>밭 확장 (${size}x${size} → ${next.size}x${next.size})</b><small>울타리를 옮기고 흙을 손봐서 밭을 ${next.size * next.size - size * size}칸 넓혀 줄게.</small></div>
        <div class="qty"><button class="btn primary" data-act="expand" ${G.state.player.money < next.cost ? 'disabled' : ''}>확장 ${formatMoney(next.cost)}원</button></div></div>`
    : '';
  return `<div class="shop-list scroll">${rows}${expand}
    ${G.state.flags.discount ? '<div class="note">🔨 강 대장 할인 적용 중 (10%)</div>' : ''}</div>`;
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
  body.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => ForgeSystem.upgrade(b.dataset.up)));
  body.querySelectorAll('[data-cloth]').forEach((b) => b.addEventListener('click', () => ForgeSystem.buyCloth(b.dataset.cloth)));
  body.querySelector('[data-act="expand"]')?.addEventListener('click', () => ForgeSystem.expandFarm());
}

export const ForgeUI = {
  open() {
    openModal('forge', '🔨 대장간', render, { wide: true });
  },
  init() {
    for (const evt of ['money', 'upgrade', 'outfit', 'farmExpand']) EventBus.on(evt, () => refreshModal('forge'));
  },
};
