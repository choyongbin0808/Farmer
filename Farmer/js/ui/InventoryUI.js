import { G } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { getItem, TYPE_NAMES } from '../data/items.js';
import { CLOTHES, SETS, SLOTS, SLOT_NAMES } from '../data/clothes.js';
import { CROPS, stars } from '../data/crops.js';
import { TOOLS, TOOL_LEVELS, harvestText } from '../data/tools.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { OutfitSystem, BASE_STAMINA } from '../systems/OutfitSystem.js';
import { StaminaSystem } from '../systems/StaminaSystem.js';
import { openModal, refreshModal, tabsHTML, bindTabs } from './Panels.js';
import { slotHTML, itemIconHTML } from './HUD.js';

const TABS = [['all', '전체'], ['seed', '씨앗'], ['crop', '작물'], ['food', '음식'], ['tool', '장비'], ['cloth', '옷']];
let tab = 'all';
let sel = null; // { area, index }

const hex = (c) => '#' + c.toString(16).padStart(6, '0');

function matchesTab(item) {
  if (tab === 'all') return true;
  if (tab === 'tool') return item.type === 'tool' || item.type === 'special';
  return item.type === tab;
}

function clothTooltip(id) {
  const c = CLOTHES[id];
  return `${c.name} · ${SLOT_NAMES[c.slot]} · 최대 체력 +${c.stamina} · ${SETS[c.setId].name} (${OutfitSystem.setProgress(c.setId)}/3)`;
}

function previewHTML() {
  const e = OutfitSystem.equipped();
  const top = e.top ? hex(e.top.color) : '#f5f0e6';
  const bot = e.bottom ? hex(e.bottom.color) : '#6d7f99';
  const hat = e.hat ? `<div class="pv-hat pv-${e.hat.style}" style="background:${hex(e.hat.color)}"></div>` : '';
  return `
    <div class="char-preview">
      ${hat}
      <div class="pv-head"><i></i><i></i></div>
      <div class="pv-body" style="background:${top}"></div>
      <div class="pv-legs ${e.bottom?.skirt ? 'skirt' : ''}" style="--c:${bot}"><span></span><span></span></div>
    </div>`;
}

function leftHTML() {
  const e = OutfitSystem.equipped();
  const slots = SLOTS.map((s) => {
    const c = e[s];
    return `<div class="equip-slot ${c ? 'filled' : ''}" data-slot="${s}" title="${c ? clothTooltip(G.state.player.outfit[s]) + ' · 클릭해서 벗기' : SLOT_NAMES[s] + ' 비어 있음'}">
      <span class="eq-label">${SLOT_NAMES[s]}</span>
      <span class="ico">${c ? c.icon : '·'}</span>
      <span class="eq-name">${c ? c.name : '없음'}</span>
      <span class="eq-stat">${c ? '+' + c.stamina : ''}</span>
    </div>`;
  }).join('');

  const max = OutfitSystem.maxStamina();
  const clothes = OutfitSystem.clothesStamina();
  const setB = OutfitSystem.setStamina();
  const activeId = OutfitSystem.activeSetId();
  const sets = Object.entries(SETS).map(([id, s]) => {
    const n = OutfitSystem.setProgress(id);
    if (!n && id !== activeId) return '';
    return `<div class="set-row ${id === activeId ? 'active' : ''}">
      <span>${s.icon} ${s.name} <b>${n}/3</b></span>
      <small>${id === activeId ? '발동 중 · ' : '3부위 착용 시 · '}${s.desc}</small>
    </div>`;
  }).join('') || '<div class="set-row empty"><small>같은 세트의 모자·상의·하의를 모두 입으면 세트 효과가 생겨요.</small></div>';

  return `
    <div class="inv-left">
      ${previewHTML()}
      <div class="equip-slots">${slots}</div>
      <div class="stamina-info">
        <div>⚡ 체력 <b>${Math.floor(G.state.player.stamina)} / ${max}</b></div>
        <small>최대 체력 ${BASE_STAMINA} + 옷 ${clothes} + 세트 ${setB} = <b>${max}</b></small>
      </div>
      <div class="sets">${sets}</div>
    </div>`;
}

function detailHTML() {
  if (!sel) return '<div class="detail empty">아이템을 클릭하면 정보가 나와요. 선택한 뒤 아래 핫바 칸을 클릭하면 핫바에 등록돼요.</div>';
  const slot = InventorySystem.slots(sel.area)[sel.index];
  if (!slot) return '<div class="detail empty">빈 칸이에요.</div>';
  const it = getItem(slot.id);
  let info = '';
  let actions = '';
  if (it.type === 'seed') {
    const c = CROPS[it.cropId];
    info = `${stars(c.grade)} · 성장 ${c.days}일 · 판매가 ${c.sellPrice}원 · 심기 체력 <b>${StaminaSystem.plantCost(it.cropId)}</b>`;
  } else if (it.type === 'crop') {
    info = `판매가 ${it.price}원 · 창고에서 다시 보관할 수 있어요`;
  } else if (it.type === 'food') {
    const heal = Math.round(it.heal * (1 + OutfitSystem.foodHealBonus()));
    info = `먹으면 체력 +${heal}`;
    actions = '<button class="btn primary" data-act="eat">먹기</button>';
  } else if (it.type === 'tool') {
    const lv = G.state.tools[it.toolKind];
    const L = TOOL_LEVELS[lv];
    info = `${L.name} ${TOOLS[it.toolKind].name} (Lv${lv}) · ${TOOLS[it.toolKind].desc} · 범위 ${it.toolKind === 'sickle' ? '1칸' : L.rangeText}${it.toolKind === 'sickle' ? ' · 수확량 ' + harvestText(lv) : ''} · 작업 ${L.time}초`;
  } else if (it.type === 'special') {
    info = it.desc;
  }
  const held = G.ui.held;
  const isHeld = held && held.area === sel.area && held.index === sel.index;
  return `<div class="detail">
    <div class="d-head">${itemIconHTML(slot.id)} <b>${it.name}</b> <span class="tag">${TYPE_NAMES[it.type]}</span> ${slot.n > 1 ? `x${slot.n}` : ''} ${isHeld ? '<span class="tag held">들고 있음</span>' : ''}</div>
    <div class="d-info">${info}</div>
    <div class="d-actions">${actions}</div>
  </div>`;
}

function gridHTML() {
  if (tab === 'cloth') {
    const owned = G.state.ownedClothes;
    if (!owned.length) return '<div class="wardrobe empty">아직 옷이 없어요. 퀘스트 보상이나 상점·대장간에서 얻을 수 있어요.</div>';
    return `<div class="wardrobe">${owned.map((id) => {
      const c = CLOTHES[id];
      const on = G.state.player.outfit[c.slot] === id;
      return `<div class="cloth-card ${on ? 'on' : ''}" data-cloth="${id}" title="${clothTooltip(id)}">
        <span class="ico">${c.icon}</span>
        <div><b>${c.name}</b><small>${SLOT_NAMES[c.slot]} · 체력 +${c.stamina}</small><small>${SETS[c.setId].name} ${OutfitSystem.setProgress(c.setId)}/3</small></div>
        ${on ? '<span class="tag held">착용 중</span>' : ''}
      </div>`;
    }).join('')}</div>`;
  }
  const inv = G.state.inventory.map((s, i) => {
    const it = s && getItem(s.id);
    const dim = it && !matchesTab(it) ? 'dim' : '';
    const selected = sel?.area === 'inventory' && sel.index === i ? 'selected' : '';
    return `<div class="slot ${dim} ${selected}" data-area="inventory" data-index="${i}" title="${it ? it.name : ''}"><div class="slot-inner">${slotHTML(s)}</div></div>`;
  }).join('');
  return `<div class="inv-grid">${inv}</div>`;
}

function hotbarHTML() {
  return `<div class="inv-hotbar-label">핫바 (1~5)</div><div class="inv-hotbar">${G.state.hotbar.map((s, i) => {
    const selected = sel?.area === 'hotbar' && sel.index === i ? 'selected' : '';
    return `<div class="slot ${selected}" data-area="hotbar" data-index="${i}"><span class="key">${i + 1}</span><div class="slot-inner">${slotHTML(s)}</div></div>`;
  }).join('')}</div>`;
}

function onSlotClick(area, index) {
  if (sel && !(sel.area === area && sel.index === index)) {
    const cross = sel.area !== area || area === 'hotbar';
    const from = InventorySystem.slots(sel.area)[sel.index];
    if (cross && from) {
      InventorySystem.swap(sel.area, sel.index, area, index);
      sel = { area, index };
      InventorySystem.select(area, index);
      return;
    }
  }
  if (sel && sel.area === area && sel.index === index) {
    sel = null;
    refreshModal('inventory');
    return;
  }
  sel = { area, index };
  if (InventorySystem.slots(area)[index]) InventorySystem.select(area, index);
  refreshModal('inventory');
}

function render(body) {
  body.innerHTML = `
    <div class="inv-wrap">
      ${leftHTML()}
      <div class="inv-right">
        ${tabsHTML(TABS, tab)}
        ${gridHTML()}
        ${tab === 'cloth' ? '' : detailHTML()}
        ${hotbarHTML()}
      </div>
    </div>`;
  bindTabs(body, (t) => { tab = t; refreshModal('inventory'); });
  body.querySelectorAll('.slot[data-area]').forEach((el) => {
    el.addEventListener('click', () => onSlotClick(el.dataset.area, Number(el.dataset.index)));
  });
  body.querySelectorAll('.equip-slot.filled').forEach((el) => {
    el.addEventListener('click', () => OutfitSystem.unequip(el.dataset.slot));
  });
  body.querySelectorAll('.cloth-card').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.cloth;
      const c = CLOTHES[id];
      if (G.state.player.outfit[c.slot] === id) OutfitSystem.unequip(c.slot);
      else OutfitSystem.equip(id);
    });
  });
  body.querySelector('[data-act="eat"]')?.addEventListener('click', () => {
    StaminaSystem.eat(sel.area, sel.index);
  });
}

export const InventoryUI = {
  open() {
    sel = null;
    openModal('inventory', '🎒 가방', render, { wide: true });
  },
  init() {
    for (const evt of ['inventory', 'outfit', 'held', 'upgrade']) EventBus.on(evt, () => refreshModal('inventory'));
  },
};
