import { G } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { FACILITIES, MAX_BATCH, BREW_RECIPE, BREW_OUTPUT } from '../data/facilities.js';
import { CROPS, growSeconds, growText } from '../data/crops.js';
import { getItem } from '../data/items.js';
import { FacilitySystem, durationText } from '../systems/FacilitySystem.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { StorageSystem } from '../systems/StorageSystem.js';
import { SoilBoxSystem, SOIL_ID } from '../systems/SoilBoxSystem.js';
import { openModal, refreshModal, closeModal } from './Panels.js';
import { itemIconHTML } from './HUD.js';

let index = -1;
let qty = 1;
let seedId = null;

/** 재료가 어디에 얼마나 있는지: 가방 · 창고 · (일반 흙) 지하 흙 상자 — 제작에는 모두 쓰인다 */
function whereHTML(id) {
  const parts = [];
  const bag = InventorySystem.count(id);
  const store = StorageSystem.count(id);
  if (id === SOIL_ID) parts.push(`📦 흙 상자 ${SoilBoxSystem.total()}`);
  parts.push(`🎒 가방 ${bag}`);
  if (store || id !== SOIL_ID) parts.push(`🏠 창고 ${store}`);
  return parts.join(' · ');
}

function qtyHTML(max) {
  qty = Math.max(1, Math.min(qty, max || 1));
  const btn = (n, label = n) => `<button class="btn small ${qty === n ? 'primary' : ''}" data-q="${n}" ${n > max ? 'disabled' : ''}>${label}</button>`;
  return `<div class="fac-qty">만들 개수:
    <button class="btn small" data-step="-1" ${qty <= 1 ? 'disabled' : ''}>−</button>
    <b>${max ? qty : 0}</b>
    <button class="btn small" data-step="1" ${qty >= max ? 'disabled' : ''}>＋</button>
    ${btn(1)}${btn(5)}${btn(10)}${max > 0 ? btn(max, `최대(${max})`) : ''}
  </div>`;
}

function jobHTML(i) {
  const f = G.state.facilities[i];
  const st = FacilitySystem.status(i);
  const it = getItem(f.job.out);
  const pct = Math.round(FacilitySystem.progress(i) * 100);
  return `<div class="fac-job ${st}">
    <div class="fac-job-head">${itemIconHTML(f.job.out)} <b>${it.name} × ${f.job.n}</b>
      <span class="tag ${st === 'done' ? 'good' : ''}">${st === 'done' ? '완성!' : `남은 시간 ${FacilitySystem.leftText(i)}`}</span></div>
    <div class="ci-bar"><div style="width:${pct}%"></div></div>
    ${st === 'done'
      ? '<button class="btn primary big" data-act="collect">꺼내기</button>'
      : '<div class="note">⏳ 시간이 지나면 완성돼요 (창을 열어 둔 동안은 멈춰요). 다른 일을 하다 오거나, 자고 일어나도 돼요.</div>'}
  </div>`;
}

function brewerHTML(i) {
  const max = FacilitySystem.brewMax();
  const mats = Object.entries(BREW_RECIPE).map(([id, need]) => {
    const have = InventorySystem.countAll(id);
    const ok = have >= need * Math.max(1, qty);
    return `<div class="mat ${ok ? '' : 'lack'}">${itemIconHTML(id)}<b>${getItem(id).name}</b><small>${need * Math.max(1, qty)}개 필요 · 모두 ${have}개</small><small class="where">${whereHTML(id)}</small></div>`;
  }).join('<span class="plus">+</span>');
  return `
    <div class="recipe">${mats}<span class="plus">→</span>
      <div class="mat out">${itemIconHTML(BREW_OUTPUT)}<b>${getItem(BREW_OUTPUT).name}</b><small>${Math.max(1, qty)}개</small></div></div>
    ${qtyHTML(max)}
    <button class="btn primary big" data-act="brew" ${max ? '' : 'disabled'}>🍲 달이기 시작 (${durationText(FacilitySystem.jobSeconds('brewer', qty))} · 1개당 ${FACILITIES.brewer.seconds}초)</button>
    <div class="note">💡 재료는 가방 · 창고 · 지하 흙 상자에 있는 것을 모두 써요. 일반 흙은 상점에서 사면 흙 상자로 바로 들어오고, 타우린(물고기)·키토산(게)은 오 씨에게 잡은 고기를 넘기면 받아요.</div>`;
}

function nurseryHTML() {
  const seeds = FacilitySystem.nurserySeeds();
  if (!seeds.find((s) => s.id === seedId)) seedId = seeds[0]?.id ?? null;
  const soil = InventorySystem.countAll('soil_rich');
  const max = seedId ? FacilitySystem.nurseryMax(seedId) : 0;
  const list = seeds.length
    ? seeds.map((s) => {
      const c = CROPS[s.cropId];
      const store = StorageSystem.count(s.id);
      return `<button class="seed-pick ${s.id === seedId ? 'on' : ''}" data-seed="${s.id}">${itemIconHTML(s.id)}<b>${c.name}</b><small>${s.n}개${store ? ` (창고 ${store})` : ''} · ${growText(c.grow)} → ${growText(growSeconds(s.cropId, true))}</small></button>`;
    }).join('')
    : '<div class="q-empty">가방·창고에 씨앗이 없어요. 상점에서 씨앗을 사 오세요.</div>';
  const c = seedId && CROPS[getItem(seedId).cropId];
  return `
    <div class="fac-sub">① 모종으로 키울 씨앗 고르기</div>
    <div class="seed-grid">${list}</div>
    <div class="fac-sub">② 토양 흙과 함께 심기 <small>토양 흙 모두 ${soil}개 (${whereHTML('soil_rich')}) · 씨앗 1개 + 토양 흙 1개 = 모종 1개</small></div>
    ${qtyHTML(max)}
    <button class="btn primary big" data-act="nursery" ${max ? '' : 'disabled'}>🌱 ${c ? `${c.name} 모종` : '모종'} 키우기 (${durationText(FacilitySystem.jobSeconds('nursery', qty))} · 1개당 ${FACILITIES.nursery.seconds}초)</button>
    <div class="note">🪴 모종은 밭에 씨앗처럼 심어요. 자라는 시간이 <b>3분의 1</b>로 줄어요 (예: 수박 ${growText(CROPS.watermelon.grow)} → ${growText(growSeconds('watermelon', true))}).${soil ? '' : '<br>⚠ 토양 흙은 약탕기에서 만들어요.'}</div>`;
}

function render(body) {
  const f = G.state.facilities[index];
  if (!f) {
    closeModal(true);
    return;
  }
  const def = FACILITIES[f.kind];
  const busy = !!f.job;
  body.innerHTML = `
    <div class="shop-top">${def.icon} ${def.desc}</div>
    ${busy ? jobHTML(index) : f.kind === 'brewer' ? brewerHTML(index) : nurseryHTML()}
    <div class="fac-foot">
      <small>🛠️ 지하 작업실 ${f.slot + 1}번 자리 · 한 번에 최대 ${MAX_BATCH}개까지 맡길 수 있어요</small>
    </div>`;
  body.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { qty = Number(b.dataset.q); refreshModal('facility'); }));
  body.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => { qty += Number(b.dataset.step); refreshModal('facility'); }));
  body.querySelectorAll('[data-seed]').forEach((b) => b.addEventListener('click', () => { seedId = b.dataset.seed; refreshModal('facility'); }));
  body.querySelector('[data-act="brew"]')?.addEventListener('click', () => FacilitySystem.startBrew(index, qty));
  body.querySelector('[data-act="nursery"]')?.addEventListener('click', () => FacilitySystem.startNursery(index, seedId, qty));
  body.querySelector('[data-act="collect"]')?.addEventListener('click', () => FacilitySystem.collect(index));
}

export const FacilityUI = {
  open(i) {
    index = i;
    qty = 1;
    const f = G.state.facilities[i];
    const def = FACILITIES[f.kind];
    openModal('facility', `${def.icon} ${def.name}`, render, { wide: true });
  },
  init() {
    for (const evt of ['facility', 'inventory', 'storage', 'soil']) EventBus.on(evt, () => refreshModal('facility'));
  },
};
