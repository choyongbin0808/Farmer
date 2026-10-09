import { G } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { NPCS } from '../data/npcs.js';
import { getItem } from '../data/items.js';
import { CLOTHES } from '../data/clothes.js';
import { MAIN_QUESTS } from '../data/mainQuests.js';
import { SUB_QUESTS } from '../data/subQuests.js';
import { RANKS } from '../data/ranks.js';
import { QuestSystem } from '../systems/QuestSystem.js';
import { openModal, closeModal, refreshModal, tabsHTML, bindTabs } from './Panels.js';

// 메인 퀘스트 = 박 이장에게서만 받는 이장 퀘스트, 서브 퀘스트 = 다른 주민들의 부탁
const TABS = [['main', '⭐ 메인 퀘스트 · 박 이장'], ['sub', '🌿 서브 퀘스트 · 주민 부탁']];
let tab = 'main';
let selected = null;

function rewardText(r = {}) {
  const parts = [];
  if (r.money) parts.push(`💰 ${r.money.toLocaleString()}원`);
  for (const it of r.items || []) parts.push(`${getItem(it.id).icon} ${getItem(it.id).name} x${it.n}`);
  for (const id of r.clothes || []) parts.push(`${CLOTHES[id].icon} ${CLOTHES[id].name}`);
  if (r.expand) parts.push(`🌾 밭 ${r.expand}x${r.expand} 확장`);
  for (const f of r.flags || []) {
    parts.push({ watermelon: '🍉 수박 씨앗 해금', tea: '🍵 약초차 판매 해금', discount: '🔨 강화 10% 할인', deco_drawing: '🖼️ 민지의 그림', deco_rod: '🎣 낚싯대 장식', mine: '⛏️ 광산 출입 허가' }[f]);
  }
  if (r.ending) parts.push('🎉 마을 이장 임명!');
  return parts.join(' · ') || '-';
}

/** 이 탭의 퀘스트 목록: 진행 중 · 받을 수 있음 · 완료 */
function entries() {
  const s = G.state.quests;
  const active = QuestSystem.active().filter(({ q }) => q.type === tab).map(({ q, rec }) => ({ q, rec, kind: 'active' }));
  const out = [...active];
  if (tab === 'main') {
    const next = QuestSystem.currentMain();
    if (next && !s.main) out.push({ q: next, kind: 'available' });
    MAIN_QUESTS.slice(0, s.mainIndex).reverse().forEach((q) => out.push({ q, kind: 'done' }));
  } else {
    for (const id of Object.keys(NPCS)) {
      for (const q of QuestSystem.offersFor(id)) if (q.type === 'sub') out.push({ q, kind: 'available' });
    }
    SUB_QUESTS.filter((q) => s.subs[q.id]?.status === 'done').forEach((q) => out.push({ q, kind: 'done' }));
  }
  return out;
}

function itemHTML({ q, rec, kind }) {
  const complete = kind === 'active' && QuestSystem.isComplete(q, rec);
  const tracked = G.state.quests.tracked === q.id;
  const giver = NPCS[q.giver];
  const tag = kind === 'done'
    ? '<span class="tag">✅ 완료</span>'
    : kind === 'available'
      ? '<span class="tag next">💬 받을 수 있음</span>'
      : complete ? '<span class="tag good">완료 보고 가능</span>' : '';
  const no = q.type === 'main' ? `${MAIN_QUESTS.indexOf(q) + 1}. ` : '';
  return `<div class="q-item ${q.type} ${kind} ${q.id === selected ? 'selected' : ''}" data-id="${q.id}">
    <span class="q-type">${giver.avatar} ${giver.name}</span>
    <b>${no}${q.title}</b>
    ${tag}
    ${tracked ? '<span class="tag">📍 표시 중</span>' : ''}
  </div>`;
}

function listHTML(list) {
  const groups = [
    ['active', '진행 중'],
    ['available', '받을 수 있는 퀘스트'],
    ['done', '완료한 퀘스트'],
  ];
  const html = groups.map(([kind, title]) => {
    const items = list.filter((e) => e.kind === kind);
    if (!items.length) return '';
    return `<div class="q-section">${title} <small>${items.length}</small></div>${items.map(itemHTML).join('')}`;
  }).join('');
  return html || `<div class="q-empty">${tab === 'main' ? '박 이장님의 부탁을 모두 마쳤어요!' : '아직 받은 주민 부탁이 없어요.<br>마을 주민들에게 말을 걸면 부탁을 받을 수 있어요.'}</div>`;
}

/** 진행 중이 아닌 퀘스트의 목표 문구 (진행도 없이) */
function plainObjectives(q, done) {
  return q.objectives.map((o) => {
    const info = QuestSystem.objInfo(q, o, { n: 0, list: [], done: false, day: 0 });
    const label = info.label.replace(' (전달 완료)', '');
    return `<div class="q-obj ${done ? 'done' : ''}"><span>${done ? '✅' : '⬜'} ${label}</span><b>${done ? '완료' : `${info.need.toLocaleString()}${info.unit}`}</b></div>`;
  }).join('');
}

function detailHTML(e) {
  if (!e) return '<div class="q-detail empty">퀘스트를 선택하세요.</div>';
  const { q, rec, kind } = e;
  const giver = NPCS[q.giver];
  const head = `<div class="q-giver">${giver.avatar} ${giver.name}의 부탁 · ${q.type === 'main' ? `메인 ${MAIN_QUESTS.indexOf(q) + 1}/${MAIN_QUESTS.length}` : '서브'}</div>
    <h3>${q.title}</h3><p>${q.desc}</p>`;
  const reward = `<div class="q-reward"><b>보상</b> ${rewardText(q.rewards)}</div>`;
  if (kind === 'done') {
    return `<div class="q-detail done">${head}<div class="q-objs">${plainObjectives(q, true)}</div>
      <div class="q-complete">✅ 완료한 퀘스트예요</div>${reward}</div>`;
  }
  if (kind === 'available') {
    return `<div class="q-detail">${head}<div class="q-objs">${plainObjectives(q, false)}</div>
      <div class="q-complete avail">💬 ${giver.name}에게 말을 걸면 이 부탁을 받을 수 있어요</div>${reward}</div>`;
  }
  const infos = QuestSystem.infos(q, rec);
  const complete = QuestSystem.isComplete(q, rec);
  const tgt = QuestSystem.target(q);
  const tracked = G.state.quests.tracked === q.id;
  return `<div class="q-detail">${head}
    <div class="q-objs">${infos.map((i) => `
      <div class="q-obj ${i.done ? 'done' : ''}">
        <span>${i.done ? '✅' : '⬜'} ${i.label}</span>
        <b>${i.cur.toLocaleString()} / ${i.need.toLocaleString()}${i.unit}</b>
        <div class="bar"><div style="width:${(i.cur / i.need) * 100}%"></div></div>
      </div>`).join('')}</div>
    ${complete ? `<div class="q-complete">모든 조건을 달성했어요! ${giver.name}에게 완료 보고를 하세요.</div>` : ''}
    ${reward}
    <div class="q-loc">📍 위치: <b>${tgt?.label ?? '-'}</b></div>
    <button class="btn primary" data-act="track">${tracked ? '위치 표시 끄기' : '📍 위치 표시'}</button>
  </div>`;
}

function render(body) {
  const list = entries();
  if (!selected || !list.find((e) => e.q.id === selected)) selected = list[0]?.q.id ?? null;
  const s = G.state.quests;
  const subDone = SUB_QUESTS.filter((q) => s.subs[q.id]?.status === 'done').length;
  const next = RANKS.find((r) => r.need > s.mainIndex);
  const progress = tab === 'main'
    ? `메인 퀘스트 <b>${s.mainIndex} / ${MAIN_QUESTS.length}</b> 완료 · 현재 직책 <b>${RANKS[G.state.rank].name}</b>${next ? ` · 다음 직책 '${next.name}'까지 ${next.need - s.mainIndex}개` : ' · 🎩 마을 이장 달성!'}`
    : `서브 퀘스트 <b>${subDone} / ${SUB_QUESTS.length}</b> 완료 · 주민 부탁을 들어주면 친밀도가 올라요`;

  body.innerHTML = `
    ${tabsHTML(TABS, tab)}
    <div class="q-progress">${progress}</div>
    <div class="q-wrap">
      <div class="q-list scroll">${listHTML(list)}</div>
      ${detailHTML(list.find((e) => e.q.id === selected))}
    </div>`;
  bindTabs(body, (t) => { tab = t; selected = null; refreshModal('quests'); });
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
    // 진행 중인 메인 퀘스트가 없고 서브만 있으면 서브 탭부터
    const active = QuestSystem.active();
    if (!active.some(({ q }) => q.type === 'main') && active.some(({ q }) => q.type === 'sub')) tab = 'sub';
    openModal('quests', '📜 퀘스트', render, { wide: true });
  },
  init() {
    EventBus.on('quests', () => refreshModal('quests'));
  },
};
