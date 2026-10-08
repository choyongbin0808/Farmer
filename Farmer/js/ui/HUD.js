import { G, formatMoney, HOTBAR_SIZE } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { getItem } from '../data/items.js';
import { WEATHERS } from '../world/Weather.js';
import { StaminaSystem } from '../systems/StaminaSystem.js';
import { GearSystem } from '../systems/GearSystem.js';
import { OutfitSystem } from '../systems/OutfitSystem.js';
import { RankSystem } from '../systems/RankSystem.js';
import { TimeSystem } from '../systems/TimeSystem.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { QuestSystem } from '../systems/QuestSystem.js';

const $ = (id) => document.getElementById(id);
const cache = {};
let previewCost = 0;

function setText(id, v) {
  if (cache[id] === v) return;
  cache[id] = v;
  $(id).textContent = v;
}

/** 아이템 아이콘 HTML (씨앗은 작물 아이콘을 작게 겹쳐 표시) */
export function itemIconHTML(id) {
  const it = getItem(id);
  if (!it) return '';
  if (it.type === 'seed') return `<span class="ico">🌱<span class="sub-ico">${it.subIcon}</span></span>`;
  // 도구는 장착한 장비 아이콘 (트랙터 🚜 등)
  if (it.type === 'tool' && G.state) return `<span class="ico">${GearSystem.equipped(it.toolKind).icon}</span>`;
  return `<span class="ico">${it.icon}</span>`;
}

export function slotHTML(slot) {
  if (!slot) return '';
  const it = getItem(slot.id);
  let badge = '';
  if (it.type === 'tool') {
    const id = GearSystem.equippedId(it.toolKind);
    const c = '#' + GearSystem.statsOf(id).color.toString(16).padStart(6, '0');
    badge = `<span class="lv" style="background:${c}">+${GearSystem.enhanceOf(id)}</span>`;
  }
  const count = slot.n > 1 ? `<span class="cnt">${slot.n}</span>` : '';
  return itemIconHTML(slot.id) + badge + count;
}

export function initHUD(handlers) {
  const bar = $('hotbar');
  bar.innerHTML = '';
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const s = document.createElement('div');
    s.className = 'slot hot-slot';
    s.dataset.index = i;
    s.innerHTML = `<span class="key">${i + 1}</span><div class="slot-inner"></div>`;
    s.addEventListener('click', () => InventorySystem.select('hotbar', i));
    bar.appendChild(s);
  }
  $('btn-quest').addEventListener('click', handlers.openQuests);
  $('btn-bag').addEventListener('click', handlers.openInventory);
  $('btn-menu').addEventListener('click', handlers.openMenu);
  $('quest-tracker').addEventListener('click', handlers.openQuests);

  for (const evt of ['inventory', 'held', 'gear']) EventBus.on(evt, renderHotbar);
  EventBus.on('quests', renderTracker);
  EventBus.on('staminaFloat', floatStamina);
}

export function renderHotbar() {
  if (!G.state) return;
  const slots = document.querySelectorAll('#hotbar .hot-slot');
  const h = G.ui.held;
  slots.forEach((el, i) => {
    el.querySelector('.slot-inner').innerHTML = slotHTML(G.state.hotbar[i]);
    el.classList.toggle('selected', h?.area === 'hotbar' && h.index === i);
    const it = G.state.hotbar[i] && getItem(G.state.hotbar[i].id);
    el.title = it ? (it.type === 'tool' ? GearSystem.displayName(GearSystem.equippedId(it.toolKind)) : it.name) : '빈 칸';
  });
  const held = InventorySystem.getHeld();
  const heldName = held ? (held.item.type === 'tool' ? GearSystem.displayName(GearSystem.equippedId(held.item.toolKind)) : held.item.name) : '';
  $('held-name').textContent = held ? `${heldName}${held.area !== 'hotbar' ? ' (가방)' : ''}` : '';
}

export function renderTracker() {
  const el = $('quest-tracker');
  if (!G.state) return;
  const q = QuestSystem.tracked() || QuestSystem.active()[0]?.q;
  const rec = q && QuestSystem.recordOf(q);
  if (!q || !rec) {
    el.classList.add('hidden');
    return;
  }
  el.classList.remove('hidden');
  const infos = QuestSystem.infos(q, rec);
  const done = QuestSystem.isComplete(q, rec);
  const body = done
    ? `<div class="tr-obj done">✅ ${QuestSystem.target(q)?.label ?? '완료 보고하기'}</div>`
    : infos.map((i) => `<div class="tr-obj ${i.done ? 'done' : ''}">${i.done ? '✔' : '·'} ${i.label} <b>${i.cur.toLocaleString()}/${i.need.toLocaleString()}${i.unit}</b></div>`).join('');
  el.innerHTML = `<div class="tr-title ${q.type}">${q.type === 'main' ? '⭐' : '🌿'} ${q.title}</div>${body}`;
}

export function setStaminaPreview(cost) {
  previewCost = cost || 0;
}

export function updateHUD() {
  const s = G.state;
  if (!s) return;
  setText('hud-name', s.player.name);
  setText('hud-rank', RankSystem.name());
  setText('hud-money', formatMoney(s.player.money));
  const max = StaminaSystem.max();
  const cur = s.player.stamina;
  setText('stamina-text', `${Math.floor(cur)} / ${max}`);
  const pct = Math.max(0, Math.min(1, cur / max));
  const fill = $('stamina-fill');
  fill.style.width = (pct * 100).toFixed(1) + '%';
  fill.className = pct >= 0.5 ? 'high' : pct >= 0.2 ? 'mid' : 'low';
  const prev = $('stamina-preview');
  if (previewCost > 0) {
    const pw = Math.min(cur, previewCost) / max;
    prev.style.display = 'block';
    prev.style.left = ((pct - pw) * 100).toFixed(1) + '%';
    prev.style.width = (pw * 100).toFixed(1) + '%';
    prev.classList.toggle('lack', cur < previewCost);
  } else {
    prev.style.display = 'none';
  }
  const set = OutfitSystem.activeSet();
  setText('set-badge', set ? set.icon : '');
  $('set-badge').title = set ? `${set.name}: ${set.desc}` : '';

  setText('hud-day', `${s.time.day}일차`);
  setText('hud-clock', TimeSystem.clock());
  const w = WEATHERS[s.time.weather];
  setText('hud-weather', `${w.icon} ${w.name}`);
}

function floatStamina(n) {
  const layer = $('stamina-float-layer');
  const el = document.createElement('div');
  el.className = 'stamina-float ' + (n < 0 ? 'minus' : 'plus');
  el.textContent = n < 0 ? `${n}` : `+${n}`;
  layer.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

export function toast(msg, type = 'info') {
  const box = $('toasts');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => el.classList.add('out'), 2800);
  setTimeout(() => el.remove(), 3300);
}

const bannerQueue = [];
let bannerBusy = false;
export function banner(title, sub = '') {
  bannerQueue.push({ title, sub });
  if (!bannerBusy) nextBanner();
}

function nextBanner() {
  const b = bannerQueue.shift();
  if (!b) {
    bannerBusy = false;
    return;
  }
  bannerBusy = true;
  const el = $('banner');
  el.innerHTML = `<div class="b-title">${b.title}</div><div class="b-sub">${b.sub}</div>`;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(nextBanner, 400);
  }, 2600);
}

export function fade(toBlack) {
  const el = $('fade');
  G.ui.fading = true;
  el.classList.toggle('on', toBlack);
  return new Promise((r) => setTimeout(() => {
    if (!toBlack) G.ui.fading = false;
    r();
  }, 800));
}

export function showHUD(show) {
  $('hud').classList.toggle('hidden', !show);
}
