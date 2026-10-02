import { G } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { NPCS } from '../data/npcs.js';
import { getItem } from '../data/items.js';
import { CLOTHES } from '../data/clothes.js';
import { MAIN_QUESTS } from '../data/mainQuests.js';
import { RANKS } from '../data/ranks.js';
import { QuestSystem } from '../systems/QuestSystem.js';
import { openModal, closeModal, refreshModal } from './Panels.js';

let selected = null;

function rewardText(r = {}) {
  const parts = [];
  if (r.money) parts.push(`💰 ${r.money.toLocaleString()}원`);
  for (const it of r.items || []) parts.push(`${getItem(it.id).icon} ${getItem(it.id).name} x${it.n}`);
  for (const id of r.clothes || []) parts.push(`${CLOTHES[id].icon} ${CLOTHES[id].name}`);
  if (r.expand) parts.push(`🌾 밭 ${r.expand}x${r.expand} 확장`);
  for (const f of r.flags || []) {
    parts.push({ watermelon: '🍉 수박 씨앗 해금', tea: '🍵 약초차 판매 해금', discount: '🔨 강화 10% 할인', deco_drawing: '🖼️ 민지의 그림', deco_rod: '🎣 낚싯대 장식' }[f]);
  }
  if (r.ending) parts.push('🎉 마을 이장 임명!');
  return parts.join(' · ') || '-';
}

function render(body) {
  const list = QuestSystem.active();
  if (!selected || !list.find((e) => e.q.id === selected)) selected = list[0]?.q.id ?? null;
  const done = G.state.quests.mainIndex;
  const next = RANKS.find((r) => r.need > done);

  const items = list.map(({ q, rec }) => {
    const complete = QuestSystem.isComplete(q, rec);
    const tracked = G.state.quests.tracked === q.id;
    return `<div class="q-item ${q.type} ${q.id === selected ? 'selected' : ''}" data-id="${q.id}">
      <span class="q-type">${q.type === 'main' ? '⭐ 메인' : '🌿 서브'}</span>
      <b>${q.title}</b>
      ${complete ? '<span class="tag good">완료 가능</span>' : ''}
      ${tracked ? '<span class="tag">📍 표시 중</span>' : ''}
    </div>`;
  }).join('') || '<div class="q-empty">진행 중인 퀘스트가 없어요.<br>머리 위에 ❗ 표시가 있는 주민에게 말을 걸어 보세요.</div>';

  let detail = '<div class="q-detail empty">퀘스트를 선택하세요.</div>';
  const sel = list.find((e) => e.q.id === selected);
  if (sel) {
    const { q, rec } = sel;
    const infos = QuestSystem.infos(q, rec);
    const complete = QuestSystem.isComplete(q, rec);
    const tgt = QuestSystem.target(q);
    const tracked = G.state.quests.tracked === q.id;
    detail = `<div class="q-detail">
      <div class="q-giver">${NPCS[q.giver].avatar} ${NPCS[q.giver].name}의 부탁</div>
      <h3>${q.title}</h3>
      <p>${q.desc}</p>
      <div class="q-objs">${infos.map((i) => `
        <div class="q-obj ${i.done ? 'done' : ''}">
          <span>${i.done ? '✅' : '⬜'} ${i.label}</span>
          <b>${i.cur.toLocaleString()} / ${i.need.toLocaleString()}${i.unit}</b>
          <div class="bar"><div style="width:${(i.cur / i.need) * 100}%"></div></div>
        </div>`).join('')}</div>
      ${complete ? `<div class="q-complete">모든 조건을 달성했어요! ${NPCS[q.giver].name}에게 완료 보고를 하세요.</div>` : ''}
      <div class="q-reward"><b>보상</b> ${rewardText(q.rewards)}</div>
      <div class="q-loc">📍 위치: <b>${tgt?.label ?? '-'}</b></div>
      <button class="btn primary" data-act="track">${tracked ? '위치 표시 끄기' : '📍 위치 표시'}</button>
    </div>`;
  }

  body.innerHTML = `
    <div class="q-progress">메인 퀘스트 <b>${done} / ${MAIN_QUESTS.length}</b> 완료 · 현재 직책 <b>${RANKS[G.state.rank].name}</b>${next ? ` · 다음 직책 '${next.name}'까지 ${next.need - done}개` : ''}</div>
    <div class="q-wrap">
      <div class="q-list scroll">${items}</div>
      ${detail}
    </div>`;
  body.querySelectorAll('.q-item').forEach((el) => el.addEventListener('click', () => {
    selected = el.dataset.id;
    refreshModal('quests');
  }));
  body.querySelector('[data-act="track"]')?.addEventListener('click', () => {
    const wasTracked = G.state.quests.tracked === selected;
    QuestSystem.setTracked(selected);
    if (!wasTracked) closeModal();
  });
}

export const QuestUI = {
  open() {
    openModal('quests', '📜 퀘스트', render, { wide: true });
  },
  init() {
    EventBus.on('quests', () => refreshModal('quests'));
  },
};
