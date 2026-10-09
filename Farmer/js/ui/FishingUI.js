import { G, formatMoney } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { FISH, FISH_ORDER, RODS, GRADE_REWARD, weightText } from '../data/fishing.js';
import { stars } from '../data/crops.js';
import { FishingSystem } from '../systems/FishingSystem.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { openModal, refreshModal, tabsHTML, bindTabs } from './Panels.js';

// 오 씨의 낚시 가게: 어망 교환 · 낚싯대 · 도감
const TABS = [['creel', '🐟 물고기 교환'], ['rods', '🎣 낚싯대'], ['book', '📖 물고기 도감']];
let tab = 'creel';

const hex = (c) => '#' + c.toString(16).padStart(6, '0');

function creelTab() {
  const groups = FishingSystem.creelGroups();
  if (!groups.length) {
    return `<div class="shop-list empty">가방에 물고기가 없어요.<br>핫바에서 낚싯대를 고르고 시냇물을 눌러 낚시해 보세요.<br><small>물고기 → 💊 타우린 · 게 → 🐚 키토산 (등급이 높고 무거울수록 많이 줘요)</small></div>`;
  }
  const count = groups.reduce((s, g) => s + g.list.length, 0);
  const tTotal = groups.reduce((s, g) => s + g.taurine, 0);
  const cTotal = groups.reduce((s, g) => s + g.chitosan, 0);
  return `
    <div class="sell-head"><span>가방의 물고기·게 <b>${count}</b>마리 · 모두 넘기면 <b>💊 타우린 ${tTotal}</b> · <b>🐚 키토산 ${cTotal}</b></span>
      <button class="btn primary" data-ex="all">모두 교환</button></div>
    <div class="shop-list scroll">${groups.map((g) => {
      const f = FISH[g.id];
      const ws = g.list.map((c) => weightText(c.w)).join(', ');
      const reward = [g.taurine && `💊 타우린 ${g.taurine}`, g.chitosan && `🐚 키토산 ${g.chitosan}`].filter(Boolean).join(' · ');
      return `<div class="shop-row">
        <span class="ico big fish-ico" style="--fc:${hex(f.color)}">${f.icon}</span>
        <div class="info"><b>${f.name}</b> <span class="stars">${stars(f.grade)}</span> <small>${g.list.length}마리 · ${ws}</small><small>교환: ${reward}</small></div>
        <div class="qty"><button class="btn small" data-ex="${g.id}">교환</button></div>
      </div>`;
    }).join('')}</div>
    <div class="note">💡 교환량 = 등급 기본량(★1: 1 · ★2: 2 · ★3: 4 · ★4: 7 · ★5: 12) × 평균 무게 대비 잡은 무게. 큰 놈일수록 더 많이 줘요.<br>타우린·키토산은 상점에서 산 일반 흙과 함께 <b>약탕기</b>에 달여 토양 흙을 만들어요.</div>`;
}

function rodsTab() {
  const money = G.state.player.money;
  return `<div class="shop-list scroll">${RODS.map((r, tier) => {
    const owned = InventorySystem.count(r.id) > 0;
    const action = owned
      ? '<span class="tag held">보유 중</span>'
      : r.price
        ? `<button class="btn small primary" data-rod="${r.id}" ${money < r.price ? 'disabled' : ''}>구매 ${formatMoney(r.price)}원</button>`
        : '<span class="tag">퀘스트 보상</span>';
    return `<div class="shop-row ${owned ? 'have' : ''}">
      <span class="ico big">🎣<span class="lv" style="background:${hex(r.color)}">${tier + 1}</span></span>
      <div class="info"><b>${r.name}</b>
        <small>입질 대기 ×${r.wait} · 챔질 여유 ${r.window}초 · 귀한 고기 확률 ${'▲'.repeat(r.luck) || '보통'}</small></div>
      <div class="qty">${action}</div>
    </div>`;
  }).join('')}
  <div class="note">🎣 좋은 낚싯대일수록 입질이 빨리 오고, 챔질할 여유가 길고, ★ 높은 물고기와 게가 더 잘 물어요.<br>산 낚싯대는 가방 '낚시' 탭에 들어가요. 핫바로 옮겨서 쓰세요.</div></div>`;
}

function bookTab() {
  const st = G.state.fishing;
  const found = FISH_ORDER.filter((id) => st.best[id]).length;
  return `<div class="shop-top"><span>📖 도감 <b>${found} / ${FISH_ORDER.length}</b> · 지금까지 잡은 수 <b>${st.caught}</b>마리</span></div>
    <div class="fish-book scroll">${FISH_ORDER.map((id) => {
      const f = FISH[id];
      const best = st.best[id];
      return `<div class="fish-card ${best ? '' : 'unknown'}" style="--fc:${hex(f.color)}">
        <span class="ico">${best ? f.icon : '❔'}</span>
        <b>${best ? f.name : '???'}</b>
        <span class="stars">${stars(f.grade)}</span>
        <small>${best ? `최고 ${weightText(best)}` : `${f.crab ? '🦀 게' : '🐟 물고기'}`}</small>
        <small>${f.crab ? '🐚 키토산' : '💊 타우린'} ${GRADE_REWARD[f.grade]}~</small>
      </div>`;
    }).join('')}</div>`;
}

function render(body) {
  body.innerHTML = `
    <div class="shop-top">🎣 오 씨: "느긋하게, 그러다 확! 그게 낚시라네." <span class="money">💰 ${formatMoney(G.state.player.money)}원</span></div>
    ${tabsHTML(TABS, tab)}
    ${tab === 'creel' ? creelTab() : tab === 'rods' ? rodsTab() : bookTab()}`;
  bindTabs(body, (t) => { tab = t; refreshModal('fishing'); });
  body.querySelectorAll('[data-ex]').forEach((b) => b.addEventListener('click', () => FishingSystem.exchange(b.dataset.ex === 'all' ? null : b.dataset.ex)));
  body.querySelectorAll('[data-rod]').forEach((b) => b.addEventListener('click', () => FishingSystem.buyRod(b.dataset.rod)));
}

export const FishingUI = {
  open() {
    openModal('fishing', '🎣 오 씨의 낚시터', render, { wide: true });
  },
  init() {
    for (const evt of ['fish', 'money', 'inventory']) EventBus.on(evt, () => refreshModal('fishing'));
  },
};
