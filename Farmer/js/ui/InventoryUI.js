import { G } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { getItem, TYPE_NAMES } from '../data/items.js';
import { CLOTHES, SETS, SLOTS, SLOT_NAMES } from '../data/clothes.js';
import { CROPS, stars, growSeconds, growText } from '../data/crops.js';
import { FISH, ROD_BY_ID, weightText, catchReward } from '../data/fishing.js';
import { PICK_BY_ID } from '../data/mining.js';
import { TOOLS, TOOL_ORDER, GEAR, statsText } from '../data/tools.js';
import { RANKS } from '../data/ranks.js';
import { InventorySystem, bagAreaOf } from '../systems/InventorySystem.js';
import { OutfitSystem, BASE_STAMINA } from '../systems/OutfitSystem.js';
import { StaminaSystem } from '../systems/StaminaSystem.js';
import { GearSystem } from '../systems/GearSystem.js';
import { openModal, refreshModal, closeModal, tabsHTML, bindTabs } from './Panels.js';
import { slotHTML, itemIconHTML, toast } from './HUD.js';
import { AudioManager } from '../core/AudioManager.js';
import { CharacterPreview } from './CharacterPreview.js';
import { gearIconSVG } from './GearIcons.js';

// 씨앗·작물·음식·물품 탭은 각자 따로 된 가방 칸(state.bag[탭])을 가진다.
// '장비' 탭은 농기구 장비를 모아 보여 준다. 옷은 우리 집 옷장(WardrobeUI)에서만 갈아입는다.
// 시설(약탕기·육묘장)은 사면 지하 작업실에 바로 설치되므로 가방에 시설 탭이 없다.
const AREA_NAMES = { seed: '씨앗', crop: '작물', food: '음식', misc: '물품', mining: '채광', fishing: '낚시', facility: '시설' };
const TABS = [
  ['seed', '🌱 씨앗'], ['crop', '🥕 작물'], ['food', '🍞 음식'], ['misc', '📦 물품'],
  ['mining', '⛏️ 채광'], ['fishing', '🎣 낚시'], ['equip', '🔧 장비'],
];
let tab = 'seed';
let sel = null; // 가방·핫바 칸 { area, index }
let eqSel = null; // 장비 탭 선택 { kind: 'gear', id }
let sellConfirm = null; // 판매 확인 중인 장비 id

const hex = (c) => '#' + c.toString(16).padStart(6, '0');

function isEqSelected(kind, id) {
  return eqSel?.kind === kind && eqSel.id === id;
}

/** 왼쪽 착용 칸 — 옷(모자·상의·하의: 보기만, 갈아입기는 집 옷장)과 농기구(호미·물뿌리개·낫) */
function wornSlotHTML(s) {
  const id = G.state.player.outfit[s];
  const c = id && CLOTHES[id];
  return `<div class="slot eq-slot cloth-view ${c ? '' : 'empty'}" title="${c ? `${c.name} · 체력 +${c.stamina}` : SLOT_NAMES[s] + ' 비어 있음'} — 옷은 우리 집 옷장에서 갈아입어요">
    <div class="slot-inner">${c ? `<span class="ico">${c.icon}</span>` : `<span class="eq-ph">${SLOT_NAMES[s]}</span>`}</div>
  </div>`;
}

function toolSlotHTML(kind) {
  const id = GearSystem.equippedId(kind);
  const selected = isEqSelected('gear', id) ? 'selected' : '';
  return `<div class="slot eq-slot ${selected}" data-eq="gear" data-id="${id}" title="${GearSystem.displayName(id)}">
    <div class="slot-inner">${gearIconHTML(id)}</div>
  </div>`;
}

function gearIconHTML(id) {
  const lv = GearSystem.enhanceOf(id);
  const color = hex(GEAR[id].color);
  return `<span class="ico">${gearIconSVG(id)}</span>${lv ? `<span class="lv" style="background:${color}">+${lv}</span>` : ''}`;
}

function leftHTML() {
  const max = OutfitSystem.maxStamina();
  const clothes = OutfitSystem.clothesStamina();
  const setB = OutfitSystem.setStamina();
  const active = OutfitSystem.activeSet();
  const progress = Object.entries(SETS)
    .map(([id, s]) => [s, OutfitSystem.setProgress(id)])
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `<span class="set-chip ${n === 3 ? 'on' : ''}">${s.icon} ${s.name} ${n}/3</span>`).join('');
  const tools = TOOL_ORDER.map((k) => {
    const id = GearSystem.equippedId(k);
    return `<div>${TOOLS[k].name} : <b>${GearSystem.displayName(id)}</b> <small>${statsText(k, GearSystem.statsOf(id))}</small></div>`;
  }).join('');

  return `
    <div class="inv-left inv-frame">
      <div class="eq-board">
        <div class="eq-col">${SLOTS.map(wornSlotHTML).join('')}</div>
        <div class="eq-stage" title="드래그해서 돌려 보기"><div class="eq-floor"></div><div class="char-3d"></div></div>
        <div class="eq-col">${TOOL_ORDER.map(toolSlotHTML).join('')}</div>
      </div>
      <div class="eq-summary">
        <div class="eq-sum-title">[ 현재 착용 중인 장비 ]</div>
        <div>MAX 체력 : <b>${max}</b> <small>(기본 ${BASE_STAMINA} + 옷 ${clothes} + 세트 ${setB})</small></div>
        <div>현재 체력 : <b>${Math.floor(G.state.player.stamina)}</b></div>
        ${tools}
        <div class="eq-set">세트 효과 : ${active ? `<b>${active.icon} ${active.name}</b> — ${active.desc}` : '적용 중인 세트 효과가 없어요'}</div>
        ${progress ? `<div class="set-chips">${progress}</div>` : ''}
        <div class="eq-set">👕 옷은 <b>우리 집 옷장</b>에서 갈아입어요</div>
      </div>
    </div>`;
}

/* ───── 장비 탭 ───── */

function ownedEquipment() {
  return TOOL_ORDER.flatMap((k) => GearSystem.ownedByKind(k).map((id) => ({ kind: 'gear', id })));
}

function equipGridHTML() {
  const list = ownedEquipment();
  const cells = list.map(({ kind, id }) => {
    const worn = GearSystem.isEquipped(id);
    const locked = !GearSystem.canEquip(id);
    const name = GearSystem.displayName(id);
    const inner = gearIconHTML(id);
    return `<div class="slot ${isEqSelected(kind, id) ? 'selected' : ''} ${locked ? 'locked' : ''}" data-eq="${kind}" data-id="${id}" title="${name}">
      <div class="slot-inner">${inner}</div>
      ${worn ? '<span class="worn-badge">E</span>' : ''}
      ${locked ? '<span class="lock-badge">🔒</span>' : ''}
    </div>`;
  });
  // 빈 칸으로 줄을 채워 격자 모양을 유지
  const fill = Math.max(16, Math.ceil(list.length / 8) * 8) - list.length;
  for (let i = 0; i < fill; i++) cells.push('<div class="slot empty-cell"></div>');
  return `<div class="inv-grid equip-grid scroll">${cells.join('')}</div>`;
}

function sellBlockHTML(id, price, worn, warn) {
  if (worn) return `<button class="btn" disabled title="착용 중에는 팔 수 없어요">판매 불가 (착용 중)</button>`;
  if (sellConfirm === id) {
    return `<span class="sell-ask">정말 팔까요? <b>+${price.toLocaleString()}원</b>${warn ? `<br><small class="warn-text">${warn}</small>` : ''}</span>
      <button class="btn danger" data-act="sell-ok">판매</button>
      <button class="btn" data-act="sell-cancel">취소</button>`;
  }
  return `<button class="btn sell" data-act="sell">💰 판매 <small>+${price.toLocaleString()}원</small></button>`;
}

function equipDetailHTML() {
  if (!eqSel) return '<div class="detail empty">농기구를 클릭하면 정보가 나와요. 장착하거나 판매할 수 있어요. (옷은 우리 집 옷장에서)</div>';
  const { id } = eqSel;
  const g = GEAR[id];
  const on = GearSystem.isEquipped(id);
  const locked = !GearSystem.canEquip(id);
  return `<div class="detail">
    <div class="d-head"><span class="ico">${gearIconSVG(id)}</span> <b>${GearSystem.displayName(id)}</b> <span class="tag">${TOOLS[g.kind].name}</span> ${on ? '<span class="tag held">장착 중</span>' : ''}</div>
    <div class="d-info">${g.tier + 1}단계 장비 · ${statsText(g.kind, GearSystem.statsOf(id))}${locked ? `<br><small class="warn-text">🔒 '${RANKS[g.rank].name}' 직책부터 착용할 수 있어요</small>` : ''}</div>
    <div class="d-actions">
      ${on ? '' : `<button class="btn primary" data-act="equip" ${locked ? 'disabled' : ''}>장착</button>`}
      ${sellBlockHTML(id, GearSystem.sellPrice(id), on, '')}
    </div>
  </div>`;
}

/* ───── 일반 가방 탭 ───── */

function detailHTML() {
  const slot = sel && InventorySystem.slots(sel.area)[sel.index];
  if (!slot) return '<div class="detail empty">아이템을 클릭하면 정보가 나와요. 고른 채로 핫바 · 가방의 다른 칸을 누르거나, 꾹 눌러 끌면 옮길 수 있어요.</div>';
  const it = getItem(slot.id);
  let info = '';
  let actions = '';
  if (it.type === 'seed') {
    const c = CROPS[it.cropId];
    const days = it.seedling ? `<b>${growText(growSeconds(it.cropId, true))}</b> (모종 · 씨앗 ${growText(c.grow)}의 1/3)` : growText(c.grow);
    info = `${stars(c.grade)} · 성장 ${days} · 판매가 ${c.sellPrice}원 · 심기 체력 <b>${StaminaSystem.plantCost(it.cropId)}</b>`;
  } else if (it.type === 'rod') {
    const r = ROD_BY_ID[it.id];
    info = `${it.tier + 1}단계 낚싯대 · 입질 대기 ×${r.wait} · 챔질 여유 ${r.window}초<br><small>핫바에서 고르고 시냇물을 누르면 낚시해요</small>`;
  } else if (it.type === 'pick') {
    const p = PICK_BY_ID[it.id];
    info = `${it.tier + 1}단계 곡괭이 · 캐는 시간 ${p.time}초 · 광석 더 나올 확률 ${Math.round(p.extra * 100)}%<br><small>핫바에서 고르고 광산의 광맥을 누르면 캐요</small>`;
  } else if (it.type === 'material') {
    info = it.desc;
  } else if (it.type === 'ore') {
    info = `한 반장에게 개당 ${it.price}원에 팔 수 있어요`;
  } else if (it.type === 'crop') {
    info = `판매가 ${it.price}원 · 창고에서 다시 보관할 수 있어요`;
  } else if (it.type === 'food') {
    const heal = Math.round(it.heal * (1 + OutfitSystem.foodHealBonus()));
    info = `먹으면 체력 +${heal}`;
    actions = '<button class="btn primary" data-act="eat">먹기</button>';
  } else if (it.type === 'special') {
    info = it.desc;
  } else if (it.type === 'fish') {
    const f = FISH[it.id];
    const w = slot.w ?? f.w[0];
    const r = catchReward({ id: it.id, w });
    info = `${stars(f.grade)} ${f.crab ? '게' : '물고기'} · 무게 <b>${weightText(w)}</b> (이 종류 ${weightText(f.w[0])}~${weightText(f.w[1])})<br><small>오 씨에게 넘기면 ${r.item === 'mat_chitosan' ? '🐚 키토산' : '💊 타우린'} ${r.n}개</small>`;
  }
  // 핫바 ↔ 가방 옮기기
  actions += sel.area === 'hotbar'
    ? `<button class="btn" data-act="toBag">🎒 가방 '${AREA_NAMES[bagAreaOf(slot.id)]}' 칸에 넣기</button>`
    : '<button class="btn" data-act="toHotbar">⬇ 핫바로 옮기기</button>';
  const held = G.ui.held;
  const isHeld = held && held.area === sel.area && held.index === sel.index;
  return `<div class="detail">
    <div class="d-head">${itemIconHTML(slot.id)} <b>${it.name}</b> <span class="tag">${TYPE_NAMES[it.type]}</span> ${slot.n > 1 ? `x${slot.n}` : ''} ${isHeld ? '<span class="tag held">들고 있음</span>' : ''}</div>
    <div class="d-info">${info}</div>
    <div class="d-actions">${actions}</div>
  </div>`;
}

/** 탭마다 아래쪽 안내 문구 */
const TAB_TIPS = {
  mining: '곡괭이를 핫바로 옮겨 광맥을 캐요 · 광석은 광산의 한 반장에게 팔아요',
  fishing: '낚싯대를 핫바로 옮겨 시냇물에서 낚시해요 · 물고기·게는 오 씨에게 타우린·키토산으로 바꿔요',
  misc: '타우린·키토산·흙 같은 재료와 특별 아이템이 들어가요',
};

function gridHTML() {
  if (tab === 'equip') return equipGridHTML();
  const list = G.state.bag[tab];
  const inv = list.map((s, i) => {
    const it = s && getItem(s.id);
    const selected = sel?.area === tab && sel.index === i ? 'selected' : '';
    return `<div class="slot ${selected}" data-area="${tab}" data-index="${i}" title="${it ? it.name : ''}"><div class="slot-inner">${slotHTML(s)}</div></div>`;
  }).join('');
  return `<div class="inv-grid">${inv}</div>`;
}

function footerHTML() {
  if (tab === 'equip') {
    return `<div class="bag-foot"><span>보유 농기구 <b>${ownedEquipment().length}</b>개</span><small>현재 직책: ${RANKS[G.state.rank].name} · 새 장비는 상점, 강화는 대장간 · 옷은 집 옷장에서</small></div>`;
  }
  const list = G.state.bag[tab];
  const tip = TAB_TIPS[tab] ? `<small>${TAB_TIPS[tab]}</small>` : '';
  return `<div class="bag-foot"><span><b>${list.filter(Boolean).length}</b> / ${list.length}</span>${tip}</div>`;
}

function hotbarHTML() {
  return `<div class="inv-hotbar-label">핫바 (1~${G.state.hotbar.length}) · 아이템을 <b>끌어다 놓거나</b>, 고른 뒤 <b>옮길 칸을 클릭</b>하면 옮겨져요 · 핫바 아이템은 가방의 제 칸으로 들어가요</div><div class="inv-hotbar">${G.state.hotbar.map((s, i) => {
    const selected = sel?.area === 'hotbar' && sel.index === i ? 'selected' : '';
    return `<div class="slot ${selected}" data-area="hotbar" data-index="${i}"><span class="key">${i + 1}</span><div class="slot-inner">${slotHTML(s)}</div></div>`;
  }).join('')}</div>`;
}

/**
 * 클릭: 아이템을 고르면 정보가 나오고, 고른 채로 핫바 ↔ 가방의 다른 칸을 누르면 그리로 옮긴다.
 * 옮기고 나면 고른 상태는 풀린다 (계속 집혀 있지 않도록)
 */
function onSlotClick(area, index) {
  eqSel = null;
  sellConfirm = null;
  if (sel && !(sel.area === area && sel.index === index) && (sel.area !== area || area === 'hotbar') && InventorySystem.slots(sel.area)[sel.index]) {
    const from = sel;
    sel = null;
    dropItem(from.area, from.index, { area, index, slotEl: true });
    refreshModal('inventory');
    return;
  }
  const slot = InventorySystem.slots(area)[index];
  if (!slot || (sel && sel.area === area && sel.index === index)) {
    sel = null;
    refreshModal('inventory');
    return;
  }
  sel = { area, index };
  InventorySystem.select(area, index);
  refreshModal('inventory');
}

/* ───── 끌어다 놓기 (꾹 누르거나 누른 채 움직이면 시작) ───── */
const HOLD_MS = 110;
const MOVE_PX = 4;
let drag = null; // { area, index, x, y, started, timer, ghost, src }

function onPointerDown(e, el) {
  if (e.button !== 0) return;
  const area = el.dataset.area;
  const index = Number(el.dataset.index);
  const slot = InventorySystem.slots(area)[index];
  drag = { area, index, x: e.clientX, y: e.clientY, started: false, src: el, hasItem: !!slot };
  if (slot) drag.timer = setTimeout(() => beginDrag(drag.x, drag.y), HOLD_MS);
  e.preventDefault();
}

function beginDrag(x, y) {
  if (!drag || drag.started || !drag.hasItem) return;
  const slot = InventorySystem.slots(drag.area)[drag.index];
  if (!slot) return;
  drag.started = true;
  sel = null;
  const ghost = document.createElement('div');
  ghost.className = 'slot drag-ghost';
  ghost.innerHTML = `<div class="slot-inner">${slotHTML(slot)}</div>`;
  document.body.appendChild(ghost);
  drag.ghost = ghost;
  drag.src.classList.add('drag-src');
  document.body.classList.add('inv-dragging');
  moveGhost(x, y);
  AudioManager.sfx('click');
}

function moveGhost(x, y) {
  drag.x = x;
  drag.y = y;
  if (!drag.ghost) return;
  drag.ghost.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  // 놓을 칸 강조
  const t = dropTarget(x, y, drag.src);
  document.querySelectorAll('.slot.drop-hover, .inv-grid.drop-hover').forEach((n) => n.classList.remove('drop-hover'));
  if (t?.slotEl) t.slotEl.classList.add('drop-hover');
  else if (t?.bagEl) t.bagEl.classList.add('drop-hover');
}

/** 손을 뗀 자리: 칸이면 slotEl, 가방 격자 근처(칸 아님)면 bagEl */
function dropTarget(x, y, src) {
  const el = document.elementFromPoint(x, y);
  const modal = el?.closest('.inv-wrap');
  if (!modal) return null;
  const slotEl = el.closest('.slot[data-area]');
  if (slotEl && slotEl !== src) return { slotEl, area: slotEl.dataset.area, index: Number(slotEl.dataset.index) };
  const bagEl = el.closest('.inv-grid:not(.equip-grid)');
  return bagEl ? { bagEl } : null;
}

function endDrag(e) {
  if (!drag) return;
  clearTimeout(drag.timer);
  const d = drag;
  drag = null;
  if (!d.started) {
    // 짧게 누름 = 클릭
    if (e && Math.hypot(e.clientX - d.x, e.clientY - d.y) < MOVE_PX) onSlotClick(d.area, d.index);
    return;
  }
  d.ghost.remove();
  d.src.classList.remove('drag-src');
  document.body.classList.remove('inv-dragging');
  document.querySelectorAll('.drop-hover').forEach((n) => n.classList.remove('drop-hover'));
  const t = e ? dropTarget(e.clientX, e.clientY, d.src) : null;
  if (t) dropItem(d.area, d.index, t);
  refreshModal('inventory');
}

function fail(msg) {
  AudioManager.sfx('error');
  toast(msg, 'warn');
}

function stowFromHotbar(index) {
  const slot = G.state.hotbar[index];
  const to = InventorySystem.stow('hotbar', index);
  if (!to) return fail(`가방 '${AREA_NAMES[bagAreaOf(slot.id)]}' 칸이 가득 찼어요`);
  tab = to;
  AudioManager.sfx('click');
}

function dropItem(fromArea, fi, t) {
  const slot = InventorySystem.slots(fromArea)[fi];
  if (!slot) return;
  // 핫바 → 가방: 제 종류 탭이면 놓은 칸에, 아니면 알맞은 탭으로 자동
  if (fromArea === 'hotbar' && t.area !== 'hotbar') {
    if (t.area && t.area === bagAreaOf(slot.id)) {
      if (InventorySystem.drag('hotbar', fi, t.area, t.index)) AudioManager.sfx('click');
      return;
    }
    return stowFromHotbar(fi);
  }
  if (!t.slotEl) return;
  // 가방 → 핫바: 그 칸에 있던 아이템이 이 가방 탭에 못 들어가면 제 탭으로 먼저 보낸다
  if (t.area === 'hotbar' && fromArea !== 'hotbar') {
    const target = G.state.hotbar[t.index];
    if (target && !InventorySystem.canMerge(slot, target) && !InventorySystem.fits(fromArea, target)) {
      if (!InventorySystem.stow('hotbar', t.index)) return fail(`가방 '${AREA_NAMES[bagAreaOf(target.id)]}' 칸이 가득 차서 자리를 바꿀 수 없어요`);
    }
  }
  if (!InventorySystem.drag(fromArea, fi, t.area, t.index)) return fail('그 아이템은 이 가방 칸에 넣을 수 없어요');
  AudioManager.sfx('click');
}

document.addEventListener('pointermove', (e) => {
  if (!drag) return;
  if (!drag.started && drag.hasItem && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) >= MOVE_PX) beginDrag(e.clientX, e.clientY);
  if (drag?.started) moveGhost(e.clientX, e.clientY);
});
document.addEventListener('pointerup', (e) => endDrag(e));
document.addEventListener('pointercancel', () => endDrag(null));

/** 고른 칸을 핫바 빈칸으로, 또는 핫바에서 제 가방 탭 빈칸으로 옮긴다 */
function onMove(act) {
  const slot = InventorySystem.slots(sel.area)[sel.index];
  if (!slot) return;
  const to = act === 'toHotbar' ? 'hotbar' : bagAreaOf(slot.id);
  const j = InventorySystem.slots(to).indexOf(null);
  if (j < 0) {
    AudioManager.sfx('error');
    toast(act === 'toHotbar' ? '핫바에 빈칸이 없어요' : `가방 '${AREA_NAMES[to]}' 칸이 가득 찼어요`, 'warn');
    return;
  }
  AudioManager.sfx('click');
  InventorySystem.swap(sel.area, sel.index, to, j);
  sel = { area: to, index: j };
  if (to !== 'hotbar') tab = to;
  InventorySystem.select(to, j);
}

function onEquipClick(kind, id) {
  AudioManager.sfx('click');
  sellConfirm = null;
  if (sel?.area !== 'hotbar') sel = null;
  eqSel = isEqSelected(kind, id) ? null : { kind, id };
  if (eqSel) tab = 'equip';
  refreshModal('inventory');
}

function onEquipAction(act) {
  if (!eqSel) return;
  const { kind, id } = eqSel;
  if (act === 'equip') {
    GearSystem.equip(id);
  } else if (act === 'sell') {
    AudioManager.sfx('click');
    sellConfirm = id;
    refreshModal('inventory');
  } else if (act === 'sell-cancel') {
    sellConfirm = null;
    refreshModal('inventory');
  } else if (act === 'sell-ok') {
    sellConfirm = null;
    const ok = GearSystem.sell(id);
    if (ok) eqSel = null;
    refreshModal('inventory');
  }
}

function render(body) {
  body.innerHTML = `
    <div class="inv-wrap">
      ${leftHTML()}
      <div class="inv-right inv-frame">
        ${tabsHTML(TABS, tab)}
        ${gridHTML()}
        ${footerHTML()}
        ${tab === 'equip' ? equipDetailHTML() : detailHTML()}
        ${hotbarHTML()}
      </div>
    </div>`;
  CharacterPreview.mount(body.querySelector('.char-3d'));
  bindTabs(body, (t) => {
    tab = t;
    if (sel && sel.area !== 'hotbar') sel = null;
    if (t !== 'equip') eqSel = null;
    sellConfirm = null;
    refreshModal('inventory');
  });
  body.querySelectorAll('.slot[data-area]').forEach((el) => {
    el.addEventListener('pointerdown', (e) => onPointerDown(e, el));
  });
  body.querySelectorAll('[data-eq]').forEach((el) => {
    el.addEventListener('click', () => onEquipClick(el.dataset.eq, el.dataset.id));
  });
  body.querySelectorAll('.detail [data-act]').forEach((el) => {
    el.addEventListener('click', () => {
      const act = el.dataset.act;
      if (act === 'eat') StaminaSystem.eat(sel.area, sel.index);
      else if (act === 'toBag' || act === 'toHotbar') onMove(act);
      else onEquipAction(act);
    });
  });
}

export const InventoryUI = {
  open() {
    sel = null;
    eqSel = null;
    sellConfirm = null;
    openModal('inventory', '🎒 가방', render, { wide: true });
  },
  init() {
    for (const evt of ['inventory', 'outfit', 'held', 'gear', 'rank', 'fish']) EventBus.on(evt, () => refreshModal('inventory'));
  },
};
