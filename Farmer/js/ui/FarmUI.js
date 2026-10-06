import { G, FARM_MAX, formatMoney } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { CROPS, stars } from '../data/crops.js';
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
  const left = Math.max(0, c.days - d.daysGrown);
  const pct = Math.round((Math.min(d.daysGrown, c.days) / c.days) * 100);
  const sickle = GearSystem.stats('sickle');
  const [hMin, hMax] = sickle.harvest;
  const income = hMin === hMax ? `${formatMoney(c.sellPrice * hMin)}원` : `${formatMoney(c.sellPrice * hMin)}~${formatMoney(c.sellPrice * hMax)}원`;
  const readyDay = s.time.day + left;

  let when;
  if (stage === 3) when = '<b class="ok">지금 바로 수확할 수 있어요!</b>';
  else if (d.watered) when = `<b>${readyDay}일차 아침</b> (${left}일 뒤)<small>매일 물을 주면 이때 다 자라요</small>`;
  else when = `<b>${readyDay}일차 아침</b> (${left}일 뒤)<small>⚠️ 오늘 물을 줘야 이 날짜에 맞출 수 있어요</small>`;

  const water = stage === 3
    ? '다 자랐어요'
    : d.watered
      ? `💧 오늘 물을 줬어요${s.time.weather === 'rain' ? ' (비)' : ''} — 자고 일어나면 하루 자라요`
      : '🏜️ 아직 물을 안 줬어요 — 물을 줘야 오늘 밤 자라요';

  body.innerHTML = `
    <div class="crop-info">
      <div class="ci-head">
        <span class="ci-icon">${c.icon}</span>
        <div><h3>${c.name}</h3><span class="stars">${stars(c.grade)}</span> <small>${c.grade}등급 작물</small></div>
        <span class="ci-stage">${STAGE_NAMES[stage]}</span>
      </div>
      <div class="ci-bar"><div style="width:${pct}%"></div></div>
      <div class="ci-bar-label">성장 ${Math.min(d.daysGrown, c.days)} / ${c.days}일 (${pct}%)</div>
      <div class="ci-grid">
        <div><span>⏰ 다 자라는 날</span>${when}</div>
        <div><span>💧 물 상태</span>${water}</div>
        <div><span>📅 심은 날</span>${d.plantedDay ? `${d.plantedDay}일차` : '-'}</div>
        <div><span>🌱 총 성장 기간</span>${c.days}일 (물 준 날만 자라요)</div>
        <div><span>💰 판매가</span>개당 ${formatMoney(c.sellPrice)}원</div>
        <div><span>🧺 예상 수확</span>${harvestText(sickle.harvest)} · ${income}<small>${GearSystem.displayName(GearSystem.equippedId('sickle'))} 기준</small></div>
        <div><span>⚡ 심기 체력</span>${StaminaSystem.plantCost(d.cropId)} (기본 ${c.staminaCost})</div>
        <div><span>🛒 씨앗 가격</span>${formatMoney(c.seedPrice)}원</div>
      </div>
      <div class="note">💡 하루는 잠을 자거나 새벽 2시가 되면 지나가요. 비 오는 날에는 물이 저절로 뿌려져요.</div>
    </div>`;
}

export const FarmUI = {
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
    for (const evt of ['water', 'harvest']) EventBus.on(evt, () => refreshModal('cropInfo'));
    EventBus.on('newDay', () => { if (G.ui.modal === 'cropInfo') closeModal(true); });
  },
};
