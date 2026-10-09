import { G } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { getItem, TYPE_NAMES } from '../data/items.js';
import { CLOTHES, SETS, SLOTS, SLOT_NAMES } from '../data/clothes.js';
import { CROPS, stars, seedlingDays } from '../data/crops.js';
import { FISH, ROD_BY_ID, weightText, catchReward } from '../data/fishing.js';
import { PICK_BY_ID } from '../data/mining.js';
import { FacilitySystem } from '../systems/FacilitySystem.js';
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
// '장비' 탭은 보유한 옷과 농기구 장비를 한 격자에 모아 보여 준다.
const AREA_NAMES = { seed: '씨앗', crop: '작물', food: '음식', misc: '물품', mining: '채광', fishing: '낚시', facility: '시설' };
const TABS = [
  ['seed', '🌱 씨앗'], ['crop', '🥕 작물'], ['food', '🍞 음식'], ['misc', '📦 물품'],
  ['mining', '⛏️ 채광'], ['fishing', '🎣 낚시'], ['facility', '🏡 시설'], ['equip', '👕 장비'],
];
let tab = 'seed';
let sel = null; // 가방·핫바 칸 { area, index }
let eqSel = null; // 장비 탭 선택 { kind: 'cloth' | 'gear', id }
let sellConfirm = null; // 판매 확인 중인 장비 id

const hex = (c) => '#' + c.toString(16).padStart(6, '0');

function isEqSelected(kind, id) {
  return eqSel?.kind === kind && eqSel.id === id;
}

/** 왼쪽 착용 칸 — 옷(모자·상의·하의)과 농기구(호미·물뿌리개·낫) */
function wornSlotHTML(s) {
  const id = G.state.player.outfit[s];
  const c = id && CLOTHES[id];
  const selected = c && isEqSelected('cloth', id) ? 'selected' : '';
  return `<div class="slot eq-slot ${c ? '' : 'empty'} ${selected}" ${c ? `data-eq="cloth" data-id="${id}"` : ''} title="${c ? c.name : SLOT_NAMES[s] + ' 비어 있음'}">
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
      </div>
    </div>`;
}

/* ───── 장비 탭 ───── */

function ownedEquipment() {
  const clothes = [...G.state.ownedClothes]
    .sort((a, b) => SLOTS.indexOf(CLOTHES[a].slot) - SLOTS.indexOf(CLOTHES[b].slot))
    .map((id) => ({ kind: 'cloth', id }));
  const gear = TOOL_ORDER.flatMap((k) => GearSystem.ownedByKind(k).map((id) => ({ kind: 'gear', id })));
  return [...clothes, ...gear];
}

function equipGridHTML() {
  const list = ownedEquipment();
  const cells = list.map(({ kind, id }) => {
    const worn = kind === 'cloth' ? OutfitSystem.isWorn(id) : GearSystem.isEquipped(id);
    const locked = kind === 'gear' && !GearSystem.canEquip(id);
    const name = kind === 'cloth' ? CLOTHES[id].name : GearSystem.displayName(id);
    const inner = kind === 'cloth' ? `<span class="ico">${CLOTHES[id].icon}</span>` : gearIconHTML(id);
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
  if (!eqSel) return '<div class="detail empty">장비를 클릭하면 정보가 나와요. 장착하거나 판매할 수 있어요.</div>';
  const { kind, id } = eqSel;
  if (kind === 'cloth') {
    const c = CLOTHES[id];
    const worn = OutfitSystem.isWorn(id);
    const warn = OutfitSystem.canRebuy(id) ? '' : `⚠ ${c.source}에서 얻는 옷이라 팔면 다시 얻을 수 없어요`;
    return `<div class="detail">
      <div class="d-head"><span class="ico">${c.icon}</span> <b>${c.name}</b> <span class="tag">${SLOT_NAMES[c.slot]}</span> ${worn ? '<span class="tag held">착용 중</span>' : ''}</div>
      <div class="d-info">최대 체력 +${c.stamina} · ${SETS[c.setId].icon} ${SETS[c.setId].name} (${OutfitSystem.setProgress(c.setId)}/3) · ${SETS[c.setId].desc}<br><small>획득처: ${c.source}</small></div>
      <div class="d-actions">
        ${worn ? '<button class="btn" data-act="unequip">벗기</button>' : '<button class="btn primary" data-act="equip">입기</button>'}
        ${sellBlockHTML(id, OutfitSystem.sellPrice(id), worn, warn)}
      </div>
    </div>`;
  }
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
  if (!slot) return '<div class="detail empty">아이템을 클릭하면 정보가 나와요. 핫바로 옮기거나 가방에 넣을 수 있어요.</div>';
  const it = getItem(slot.id);
  let info = '';
  let actions = '';
  if (it.type === 'seed') {
    const c = CROPS[it.cropId];
    const days = it.seedling ? `<b>${seedlingDays(it.cropId)}일</b> (모종 · 씨앗 ${c.days}일의 1/3)` : `${c.days}일`;
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
  } else if (it.type === 'facility') {
    info = `${it.desc}<br><small>원하는 빈 땅에 직접 놓아요 (R 회전 · Esc 취소)</small>`;
    actions = '<button class="btn primary" data-act="place">📐 배치하기</button>';
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
  facility: "시설을 눌러 '배치하기' — 마을 빈 땅에 놓아요 · 새 시설은 상점 '시설·흙' 탭에서",
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
    return `<div class="bag-foot"><span>보유 장비 <b>${ownedEquipment().length}</b>개</span><small>현재 직책: ${RANKS[G.state.rank].name} · 새 장비는 상점, 강화는 대장간에서</small></div>`;
  }
  const list = G.state.bag[tab];
  const tip = TAB_TIPS[tab] ? `<small>${TAB_TIPS[tab]}</small>` : '';
  return `<div class="bag-foot"><span><b>${list.filter(Boolean).length}</b> / ${list.length}</span>${tip}</div>`;
}

function hotbarHTML() {
  return `<div class="inv-hotbar-label">핫바 (1~${G.state.hotbar.length}) · 아이템을 고른 뒤 칸을 누르면 자리를 바꿔요</div><div class="inv-hotbar">${G.state.hotbar.map((s, i) => {
    const selected = sel?.area === 'hotbar' && sel.index === i ? 'selected' : '';
    return `<div class="slot ${selected}" data-area="hotbar" data-index="${i}"><span class="key">${i + 1}</span><div class="slot-inner">${slotHTML(s)}</div></div>`;
  }).join('')}</div>`;
}

function onSlotClick(area, index) {
  eqSel = null;
  sellConfirm = null;
  if (sel && !(sel.area === area && sel.index === index)) {
    const cross = sel.area !== area || area === 'hotbar';
    const from = InventorySystem.slots(sel.area)[sel.index];
    if (cross && from) {
      if (!InventorySystem.swap(sel.area, sel.index, area, index)) {
        AudioManager.sfx('error');
        toast('그 아이템은 이 가방 칸에 넣을 수 없어요', 'warn');
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
    if (kind === 'cloth') OutfitSystem.equip(id);
    else GearSystem.equip(id);
  } else if (act === 'unequip') {
    OutfitSystem.unequip(CLOTHES[id].slot);
  } else if (act === 'sell') {
    AudioManager.sfx('click');
    sellConfirm = id;
    refreshModal('inventory');
  } else if (act === 'sell-cancel') {
    sellConfirm = null;
    refreshModal('inventory');
  } else if (act === 'sell-ok') {
    sellConfirm = null;
    const ok = kind === 'cloth' ? OutfitSystem.sell(id) : GearSystem.sell(id);
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
    el.addEventListener('click', () => onSlotClick(el.dataset.area, Number(el.dataset.index)));
  });
  body.querySelectorAll('[data-eq]').forEach((el) => {
    el.addEventListener('click', () => onEquipClick(el.dataset.eq, el.dataset.id));
  });
  body.querySelectorAll('.detail [data-act]').forEach((el) => {
    el.addEventListener('click', () => {
      const act = el.dataset.act;
      if (act === 'eat') StaminaSystem.eat(sel.area, sel.index);
      else if (act === 'toBag' || act === 'toHotbar') onMove(act);
      else if (act === 'place') {
        const it = getItem(InventorySystem.slots(sel.area)[sel.index].id);
        closeModal();
        FacilitySystem.startPlacement(it.kind);
      } else onEquipAction(act);
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
