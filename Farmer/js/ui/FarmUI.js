import { G, FARM_MAX, formatMoney, GAME_MIN_PER_SEC } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { CROPS, stars, plotGrowSeconds, growSeconds, growText, josa } from '../data/crops.js';
import { getItem } from '../data/items.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { AudioManager } from '../core/AudioManager.js';
import { itemIconHTML, toast } from './HUD.js';
import { itemSvg } from './ItemIcons.js';
import { harvestText } from '../data/tools.js';
import { FarmSystem, EXPAND_COSTS } from '../systems/FarmSystem.js';
import { StaminaSystem } from '../systems/StaminaSystem.js';
import { GearSystem } from '../systems/GearSystem.js';
import { openModal, refreshModal, closeModal } from './Panels.js';

const STAGE_NAMES = ['🌰 씨앗', '🌱 새싹', '🌿 자라는 중', '🧺 수확 가능'];
let infoPlot = null;

// ───── 밭 확장 ─────
function gridHTML(size, nextSize) {
  let cells = '';
  for (let r = 0; r < FARM_MAX; r++) {
    // 화면에서 동쪽(출입구 쪽)이 오른쪽이 되도록 열을 뒤집어 그린다
    for (let c = FARM_MAX - 1; c >= 0; c--) {
      const cls = r < size && c < size ? 'own' : r < nextSize && c < nextSize ? 'next' : '';
      cells += `<i class="${cls}"></i>`;
    }
  }
  return `<div class="farm-grid" style="--n:${FARM_MAX}">${cells}</div>`;
}

function renderExpand(body) {
  const size = G.state.farm.size;
  const next = FarmSystem.nextExpand();
  const rows = Object.entries(EXPAND_COSTS).map(([s, cost]) => {
    s = Number(s);
    const state = s <= size ? '<span class="tag">완료</span>' : s === next?.size ? '<span class="tag next">다음 단계</span>' : '';
    return `<div class="shop-row compact ${s <= size ? 'have' : ''}">
      <span class="ico">🌾</span>
      <div class="info"><b>${s}x${s}</b> <small>${s * s}칸 · ${formatMoney(cost)}원</small></div>
      <div class="qty">${state}</div>
    </div>`;
  }).join('');
  body.innerHTML = `
    <div class="shop-top">🌾 지금 밭: <b>${size}x${size} (${size * size}칸)</b>
      <span class="money">💰 ${formatMoney(G.state.player.money)}원</span></div>
    <div class="expand-wrap">
      <div>
        ${gridHTML(size, next?.size ?? size)}
        <div class="note">🟫 지금 밭 · 🟩 이번에 늘어나는 칸<br>울타리도 함께 서쪽·남쪽으로 넓어져요.</div>
      </div>
      <div class="expand-side">
        <div class="shop-list">${rows}</div>
        ${next
          ? `<button class="btn primary big" data-act="buy" ${G.state.player.money < next.cost ? 'disabled' : ''}>
              ${next.size}x${next.size}로 넓히기 (${formatMoney(next.cost)}원)</button>`
          : '<div class="q-complete">🎉 밭이 최대 크기예요!</div>'}
      </div>
    </div>`;
  body.querySelector('[data-act="buy"]')?.addEventListener('click', () => FarmSystem.buyExpand());
}

// ───── 작물 상세 정보 ─────
function renderInfo(body) {
  const plot = infoPlot;
  const d = plot?.data;
  if (!d || d.state !== 'planted') {
    body.innerHTML = '<div class="q-empty">이 밭에는 작물이 없어요.</div>';
    return;
  }
  const c = CROPS[d.cropId];
  const s = G.state;
  const stage = plot.stage();
  const total = plotGrowSeconds(d);
  const grownSec = Math.min(total, (d.grown || 0) / GAME_MIN_PER_SEC);
  const left = Math.max(0, total - grownSec);
  const pct = Math.round((grownSec / total) * 100);
  const sickle = GearSystem.stats('sickle');
  const [hMin, hMax] = sickle.harvest;
  const boosters = InventorySystem.count('special_growth');
  const income = hMin === hMax ? `${formatMoney(c.sellPrice * hMin)}원` : `${formatMoney(c.sellPrice * hMin)}~${formatMoney(c.sellPrice * hMax)}원`;

  let when;
  if (stage === 3) when = '<b class="ok">지금 바로 수확할 수 있어요!</b>';
  else if (d.watered) when = `<b>약 ${growText(left)} 뒤</b><small>물을 준 오늘은 시간이 흐르는 만큼 자라요 (자는 동안에도)</small>`;
  else when = `<b>${growText(left)} 더 자라야 해요</b><small>⚠️ 지금은 물이 말라서 멈춰 있어요 — 물을 주면 다시 자라요</small>`;

  const water = stage === 3
    ? '다 자랐어요'
    : d.watered
      ? `💧 오늘 물을 줬어요${s.time.weather === 'rain' ? ' (비)' : ''} — 지금 자라는 중`
      : '🏜️ 아직 물을 안 줬어요 — 물을 줘야 자라요';

  body.innerHTML = `
    <div class="crop-info">
      <div class="ci-head">
        <span class="ci-icon">${c.icon}</span>
        <div><h3>${c.name}${d.seedling ? ' <small class="tag good">🪴 모종</small>' : ''}</h3><span class="stars">${stars(c.grade)}</span> <small>${c.grade}등급 작물</small></div>
        <span class="ci-stage">${STAGE_NAMES[stage]}</span>
      </div>
      <div class="ci-bar"><div style="width:${pct}%"></div></div>
      <div class="ci-bar-label">성장 ${growText(grownSec)} / ${growText(total)} (${pct}%)</div>
      <div class="ci-acts">
        <button class="ci-act boost" data-act="boost" ${boosters && stage < 3 ? '' : 'disabled'}>
          <span class="ci-act-ico">${itemSvg('hourglass')}</span>
          <span class="ci-act-txt"><b>성장 촉진제</b><small>${stage === 3 ? '이미 다 자랐어요' : boosters ? `${boosters}개 있음 · 바로 다 자라요` : `없음 · 상점에서 ${getItem('special_growth').price}원`}</small></span>
        </button>
        <button class="ci-act plow" data-act="plow">
          <span class="ci-act-ico">${itemSvg('plow')}</span>
          <span class="ci-act-txt"><b>갈아엎기</b><small>작물을 없애고 다시 심어요</small></span>
        </button>
      </div>
      <div class="ci-grid">
        <div><span>⏰ 다 자라기까지</span>${when}</div>
        <div><span>💧 물 상태</span>${water}</div>
        <div><span>📅 심은 날</span>${d.plantedDay ? `${d.plantedDay}일차` : '-'}</div>
        <div><span>🌱 총 성장 시간</span>${growText(total)} (물 준 날만 자라요)${d.seedling ? `<small>모종이라 씨앗(${growText(growSeconds(d.cropId))})보다 3배 빨라요</small>` : ''}</div>
        <div><span>💰 판매가</span>개당 ${formatMoney(c.sellPrice)}원</div>
        <div><span>🧺 예상 수확</span>${harvestText(sickle.harvest)} · ${income}<small>${GearSystem.displayName(GearSystem.equippedId('sickle'))} 기준</small></div>
        <div><span>⚡ 심기 체력</span>${StaminaSystem.plantCost(d.cropId)} (기본 ${c.staminaCost})</div>
        <div><span>🛒 씨앗 가격</span>${formatMoney(c.seedPrice)}원</div>
      </div>
      <div class="note">💡 물을 준 날에는 시간이 흐르는 동안 계속 자라고, 밤에 자는 동안에도 자라요. 아침이 되면 물이 마르니 다시 줘야 해요. 비 오는 날에는 물이 저절로 뿌려져요.</div>
    </div>`;

  body.querySelector('[data-act="boost"]').addEventListener('click', () => {
    closeModal();
    FarmSystem.useBooster(plot);
  });
  // 갈아엎기는 되돌릴 수 없으니 한 번 더 눌러야 실행
  const plowBtn = body.querySelector('[data-act="plow"]');
  plowBtn.addEventListener('click', () => {
    if (!plowBtn.classList.contains('confirm')) {
      plowBtn.classList.add('confirm');
      plowBtn.querySelector('.ci-act-txt').innerHTML = `<b>정말 갈아엎을까요?</b><small>한 번 더 누르면 ${c.name}${josa(c.name, '이', '가')} 사라져요</small>`;
      AudioManager.sfx('click');
      return;
    }
    closeModal();
    FarmSystem.plowUnder(plot);
  });
}

// ───── 씨앗 고르기 (갈고 물 준 밭을 씨앗 없이 눌렀을 때) ─────
/** 가방(씨앗 칸)·핫바에 있는 씨앗·모종을 종류별로: [{ id, item, n, ref: { area, index } }] */
function ownedSeeds() {
  const map = new Map();
  for (const area of ['hotbar', 'seed']) {
    InventorySystem.slots(area).forEach((s, index) => {
      const item = s && getItem(s.id);
      if (item?.type !== 'seed') return;
      if (!map.has(s.id)) map.set(s.id, { id: s.id, item, n: 0, ref: { area, index } });
      map.get(s.id).n += s.n;
    });
  }
  // 모종 먼저, 그다음 작물 등급 순
  return [...map.values()].sort((a, b) => (b.item.seedling ? 1 : 0) - (a.item.seedling ? 1 : 0) || CROPS[a.item.cropId].grade - CROPS[b.item.cropId].grade);
}

let pickCb = null;

function renderSeedPicker(body) {
  const seeds = ownedSeeds();
  body.innerHTML = `
    <div class="shop-top"><span>🌱 이 밭에 무엇을 심을까요? <small>고른 씨앗은 손에 들려서, 다른 밭도 바로 눌러 심을 수 있어요</small></span></div>
    <div class="seed-grid seed-pick-grid">${seeds.map((e) => {
      const c = CROPS[e.item.cropId];
      const t = growText(growSeconds(e.item.cropId, e.item.seedling));
      return `<button class="seed-pick" data-id="${e.id}">
        ${itemIconHTML(e.id)}<b>${e.item.name}</b>
        <small>${e.n}개 · ${t}${e.item.seedling ? ' (모종)' : ''} · ⚡${StaminaSystem.plantCost(e.item.cropId)}</small>
      </button>`;
    }).join('')}</div>`;
  body.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => {
    const e = seeds.find((x) => x.id === b.dataset.id);
    const cb = pickCb;
    pickCb = null;
    closeModal();
    cb?.(e.ref);
  }));
}

export const FarmUI = {
  /** 심을 씨앗을 고르게 하고, 고르면 onPick({ area, index }) */
  openSeedPicker(onPick) {
    if (!ownedSeeds().length) {
      AudioManager.sfx('error');
      toast('🌱 가방에 씨앗이 없어요. 상점에서 씨앗을 사 오세요', 'warn');
      return;
    }
    pickCb = onPick;
    openModal('seedPick', '🌱 씨앗 고르기', renderSeedPicker, { onClose: () => { pickCb = null; } });
  },

  openExpand() {
    openModal('farmExpand', '🌾 밭 확장', renderExpand, { wide: true });
  },

  openCropInfo(plot) {
    infoPlot = plot;
    const c = CROPS[plot.data.cropId];
    openModal('cropInfo', `${c.icon} 작물 정보`, renderInfo, { onClose: () => { infoPlot = null; } });
  },

  init() {
    for (const evt of ['money', 'farmExpand']) EventBus.on(evt, () => refreshModal('farmExpand'));
    for (const evt of ['water', 'harvest', 'grow', 'inventory']) EventBus.on(evt, () => refreshModal('cropInfo'));
    EventBus.on('newDay', () => { if (G.ui.modal === 'cropInfo') closeModal(true); });
  },
};
