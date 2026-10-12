import { G } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { AudioManager } from '../core/AudioManager.js';
import { CLOTHES, SETS, SLOTS, SLOT_NAMES } from '../data/clothes.js';
import { OutfitSystem, BASE_STAMINA } from '../systems/OutfitSystem.js';
import { openModal, refreshModal, tabsHTML, bindTabs } from './Panels.js';
import { CharacterPreview } from './CharacterPreview.js';

/**
 * 우리 집 옷장 — 옷은 여기서만 갈아입는다 (가방에서는 볼 수만 있다).
 * 왼쪽: 지금 입은 모습 · 착용 칸 · 체력/세트 효과, 오른쪽: 가진 옷 목록 → 입기 · 벗기 · 팔기
 */
const TABS = [['all', '👗 전체'], ['hat', '🎩 모자'], ['top', '👕 상의'], ['bottom', '👖 하의']];
let tab = 'all';
let selId = null;
let sellAsk = false;

function wornHTML() {
  return SLOTS.map((s) => {
    const id = G.state.player.outfit[s];
    const c = id && CLOTHES[id];
    return `<div class="wr-worn ${c ? '' : 'empty'}">
      <span class="ico">${c ? c.icon : '·'}</span>
      <div><small>${SLOT_NAMES[s]}</small><b>${c ? c.name : '비어 있음'}</b></div>
      ${c ? `<button class="btn small" data-off="${s}">벗기</button>` : ''}
    </div>`;
  }).join('');
}

function summaryHTML() {
  const active = OutfitSystem.activeSet();
  const chips = Object.entries(SETS)
    .map(([id, s]) => [s, OutfitSystem.setProgress(id)])
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `<span class="set-chip ${n === 3 ? 'on' : ''}">${s.icon} ${s.name} ${n}/3</span>`).join('');
  return `<div class="eq-summary">
    <div>MAX 체력 : <b>${OutfitSystem.maxStamina()}</b> <small>(기본 ${BASE_STAMINA} + 옷 ${OutfitSystem.clothesStamina()} + 세트 ${OutfitSystem.setStamina()})</small></div>
    <div class="eq-set">세트 효과 : ${active ? `<b>${active.icon} ${active.name}</b> — ${active.desc}` : '같은 세트 세 벌을 모두 입으면 효과가 생겨요'}</div>
    ${chips ? `<div class="set-chips">${chips}</div>` : ''}
  </div>`;
}

function listHTML() {
  const owned = G.state.ownedClothes
    .filter((id) => CLOTHES[id] && (tab === 'all' || CLOTHES[id].slot === tab))
    .sort((a, b) => SLOTS.indexOf(CLOTHES[a].slot) - SLOTS.indexOf(CLOTHES[b].slot) || CLOTHES[a].stamina - CLOTHES[b].stamina);
  if (!owned.length) return '<div class="q-empty">아직 이 칸에 넣을 옷이 없어요. 상점·대장간에서 사거나 퀘스트 보상으로 받아요.</div>';
  return `<div class="wr-grid scroll">${owned.map((id) => {
    const c = CLOTHES[id];
    const worn = OutfitSystem.isWorn(id);
    return `<button class="wr-card ${worn ? 'worn' : ''} ${id === selId ? 'sel' : ''}" data-id="${id}">
      ${worn ? '<span class="worn-badge">입는 중</span>' : ''}
      <span class="ico">${c.icon}</span><b>${c.name}</b>
      <small>${SLOT_NAMES[c.slot]} · 체력 +${c.stamina}</small>
      <small class="set">${SETS[c.setId].icon} ${SETS[c.setId].name}</small>
    </button>`;
  }).join('')}</div>`;
}

function detailHTML() {
  const c = selId && CLOTHES[selId];
  if (!c) return '<div class="detail empty">옷을 고르면 입어 보거나 팔 수 있어요. 캐릭터는 드래그해서 돌려 볼 수 있어요.</div>';
  const worn = OutfitSystem.isWorn(selId);
  const warn = OutfitSystem.canRebuy(selId) ? '' : `<br><small class="warn-text">⚠ ${c.source}에서 얻는 옷이라 팔면 다시 얻을 수 없어요</small>`;
  const price = OutfitSystem.sellPrice(selId);
  const sell = worn
    ? '<button class="btn" disabled>판매 불가 (입는 중)</button>'
    : sellAsk
      ? `<span class="sell-ask">정말 팔까요? <b>+${price.toLocaleString()}원</b>${warn}</span><button class="btn danger" data-act="sell-ok">판매</button><button class="btn" data-act="sell-no">취소</button>`
      : `<button class="btn sell" data-act="sell">💰 판매 <small>+${price.toLocaleString()}원</small></button>`;
  return `<div class="detail">
    <div class="d-head"><span class="ico">${c.icon}</span> <b>${c.name}</b> <span class="tag">${SLOT_NAMES[c.slot]}</span> ${worn ? '<span class="tag held">입는 중</span>' : ''}</div>
    <div class="d-info">최대 체력 +${c.stamina} · ${SETS[c.setId].icon} ${SETS[c.setId].name} (${OutfitSystem.setProgress(c.setId)}/3 입는 중) — ${SETS[c.setId].desc}<br><small>얻는 곳: ${c.source}</small></div>
    <div class="d-actions">
      ${worn ? `<button class="btn" data-act="off">벗기</button>` : '<button class="btn primary" data-act="on">👕 입기</button>'}
      ${sell}
    </div>
  </div>`;
}

function render(body) {
  body.innerHTML = `
    <div class="inv-wrap wr-wrap">
      <div class="inv-left inv-frame">
        <div class="eq-stage wr-stage" title="드래그해서 돌려 보기"><div class="eq-floor"></div><div class="char-3d"></div></div>
        <div class="wr-worn-list">${wornHTML()}</div>
        ${summaryHTML()}
      </div>
      <div class="inv-right inv-frame">
        ${tabsHTML(TABS, tab)}
        ${listHTML()}
        ${detailHTML()}
      </div>
    </div>`;
  CharacterPreview.mount(body.querySelector('.char-3d'));
  bindTabs(body, (t) => { tab = t; sellAsk = false; refreshModal('wardrobe'); });
  body.querySelectorAll('.wr-card').forEach((b) => b.addEventListener('click', () => {
    AudioManager.sfx('click');
    selId = selId === b.dataset.id ? null : b.dataset.id;
    sellAsk = false;
    refreshModal('wardrobe');
  }));
  body.querySelectorAll('[data-off]').forEach((b) => b.addEventListener('click', () => {
    AudioManager.sfx('click');
    OutfitSystem.unequip(b.dataset.off);
  }));
  body.querySelectorAll('.detail [data-act]').forEach((b) => b.addEventListener('click', () => {
    const act = b.dataset.act;
    if (act === 'on') { AudioManager.sfx('click'); OutfitSystem.equip(selId); }
    else if (act === 'off') { AudioManager.sfx('click'); OutfitSystem.unequip(CLOTHES[selId].slot); }
    else if (act === 'sell') { sellAsk = true; refreshModal('wardrobe'); }
    else if (act === 'sell-no') { sellAsk = false; refreshModal('wardrobe'); }
    else if (act === 'sell-ok') {
      sellAsk = false;
      if (OutfitSystem.sell(selId)) selId = null;
      refreshModal('wardrobe');
    }
  }));
}

export const WardrobeUI = {
  open() {
    selId = null;
    sellAsk = false;
    openModal('wardrobe', '👕 옷장', render, { wide: true });
  },
  init() {
    for (const evt of ['outfit', 'money']) EventBus.on(evt, () => refreshModal('wardrobe'));
  },
};
