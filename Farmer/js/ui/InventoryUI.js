import { G } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { getItem, TYPE_NAMES } from '../data/items.js';
import { CLOTHES, SETS, SLOTS, SLOT_NAMES } from '../data/clothes.js';
import { CROPS, stars } from '../data/crops.js';
import { TOOLS, TOOL_ORDER, GEAR, statsText } from '../data/tools.js';
import { RANKS } from '../data/ranks.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { OutfitSystem, BASE_STAMINA } from '../systems/OutfitSystem.js';
import { StaminaSystem } from '../systems/StaminaSystem.js';
import { GearSystem } from '../systems/GearSystem.js';
import { openModal, refreshModal, tabsHTML, bindTabs } from './Panels.js';
import { slotHTML, itemIconHTML, toast } from './HUD.js';
import { AudioManager } from '../core/AudioManager.js';

// 씨앗·작물·음식·기타 탭은 각자 따로 된 가방 칸(state.bag[탭])을 가진다
const TABS = [['seed', '씨앗'], ['crop', '작물'], ['food', '음식'], ['misc', '기타'], ['tool', '장비'], ['cloth', '옷']];
const EMPTY_TEXT = {
  seed: '씨앗은 상점에서 살 수 있어요.',
  crop: '수확한 작물은 창고로 들어가요. 창고에서 꺼낸 작물이 여기 담겨요.',
  food: '음식은 상점에서 살 수 있어요. 먹으면 체력이 회복돼요.',
  misc: '비료·성장 촉진제 같은 특별 아이템과 핫바에서 뺀 도구가 여기 담겨요.',
};
let tab = 'seed';
let sel = null; // { area, index }

const hex = (c) => '#' + c.toString(16).padStart(6, '0');

function clothTooltip(id) {
  const c = CLOTHES[id];
  return `${c.name} · ${SLOT_NAMES[c.slot]} · 최대 체력 +${c.stamina} · ${SETS[c.setId].name} (${OutfitSystem.setProgress(c.setId)}/3)`;
}

function previewHTML() {
  const e = OutfitSystem.equipped();
  const top = e.top ? hex(e.top.color) : '#f2ede2';
  const bot = e.bottom ? hex(e.bottom.color) : '#5e7aa8';
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
    const id = GearSystem.equippedId(it.toolKind);
    info = `장착 중: <b>${GearSystem.displayName(id)}</b> · ${TOOLS[it.toolKind].desc} · ${statsText(it.toolKind, GearSystem.statsOf(id))}<br><small>'장비' 탭에서 다른 장비로 바꿀 수 있어요</small>`;
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

function gearCard(id) {
  const g = GEAR[id];
  const on = GearSystem.isEquipped(id);
  const locked = !GearSystem.canEquip(id);
  const st = GearSystem.statsOf(id);
  const title = locked ? `'${RANKS[g.rank].name}' 직책부터 착용할 수 있어요` : on ? '장착 중' : '클릭해서 장착';
  return `<div class="cloth-card gear-card ${on ? 'on' : ''} ${locked ? 'locked' : ''}" data-gear="${id}" title="${title}">
    <span class="ico" style="color:${hex(g.color)}">${locked ? '🔒' : g.icon}</span>
    <div><b>${GearSystem.displayName(id)}</b><small>${statsText(g.kind, st)}</small><small>${locked ? `🔒 '${RANKS[g.rank].name}' 직책 필요` : `${g.tier + 1}단계 장비`}</small></div>
    ${on ? '<span class="tag held">장착 중</span>' : ''}
  </div>`;
}

function gearHTML() {
  const sections = TOOL_ORDER.map((kind) => {
    const t = TOOLS[kind];
    const owned = GearSystem.ownedByKind(kind);
    return `<div class="gear-section"><div class="shop-section">${t.icon} ${t.name} <small>${t.desc} · 보유 ${owned.length}개</small></div>
      <div class="wardrobe">${owned.map(gearCard).join('')}</div></div>`;
  }).join('');
  return `<div class="gear-wrap scroll">${sections}
    <div class="note">현재 직책: <b>${RANKS[G.state.rank].name}</b> (${G.state.rank + 1}단계 장비까지 착용 가능) · 새 장비는 상점, 강화는 대장간에서.</div></div>`;
}

function gridHTML() {
  if (tab === 'tool') return gearHTML();
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
  const list = G.state.bag[tab];
  const inv = list.map((s, i) => {
    const it = s && getItem(s.id);
    const selected = sel?.area === tab && sel.index === i ? 'selected' : '';
    return `<div class="slot ${selected}" data-area="${tab}" data-index="${i}" title="${it ? it.name : ''}"><div class="slot-inner">${slotHTML(s)}</div></div>`;
  }).join('');
  const empty = list.every((s) => !s) ? `<div class="note">${EMPTY_TEXT[tab]}</div>` : '';
  return `<div class="inv-grid">${inv}</div>${empty}`;
}

function hotbarHTML() {
  return `<div class="inv-hotbar-label">핫바 (1~${G.state.hotbar.length}) · 1~3번 칸은 농기구 고정</div><div class="inv-hotbar">${G.state.hotbar.map((s, i) => {
    const selected = sel?.area === 'hotbar' && sel.index === i ? 'selected' : '';
    const fixed = InventorySystem.isFixed('hotbar', i) ? 'fixed' : '';
    return `<div class="slot ${selected} ${fixed}" data-area="hotbar" data-index="${i}"><span class="key">${i + 1}</span><div class="slot-inner">${slotHTML(s)}</div></div>`;
  }).join('')}</div>`;
}

function onSlotClick(area, index) {
  if (sel && !(sel.area === area && sel.index === index)) {
    const cross = sel.area !== area || area === 'hotbar';
    const from = InventorySystem.slots(sel.area)[sel.index];
    // 고정 칸(농기구)을 고른 상태에서 다른 칸을 누르면 옮기지 않고 그 칸을 고른다
    if (cross && from && !InventorySystem.isFixed(sel.area, sel.index)) {
      if (!InventorySystem.swap(sel.area, sel.index, area, index)) {
        AudioManager.sfx('error');
        toast(InventorySystem.isFixed(area, index) ? '핫바 1~3번 칸은 농기구 고정 칸이에요' : '그 아이템은 이 가방 칸에 넣을 수 없어요', 'warn');
        return;
      }
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
        ${tab === 'cloth' || tab === 'tool' ? '' : detailHTML()}
        ${hotbarHTML()}
      </div>
    </div>`;
  bindTabs(body, (t) => {
    tab = t;
    if (sel && sel.area !== 'hotbar') sel = null;
    refreshModal('inventory');
  });
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
  body.querySelectorAll('.gear-card').forEach((el) => {
    el.addEventListener('click', () => GearSystem.equip(el.dataset.gear));
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
    for (const evt of ['inventory', 'outfit', 'held', 'gear', 'rank']) EventBus.on(evt, () => refreshModal('inventory'));
  },
};
