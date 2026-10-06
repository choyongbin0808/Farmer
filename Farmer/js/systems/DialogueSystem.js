import { G } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { NPCS } from '../data/npcs.js';
import { getItem } from '../data/items.js';
import { RelationSystem } from './RelationSystem.js';
import { QuestSystem } from './QuestSystem.js';
import { DialogueUI } from '../ui/DialogueUI.js';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function speaker(id) {
  const n = NPCS[id];
  const hearts = RelationSystem.isResident(id) ? ' ' + '❤️'.repeat(RelationSystem.hearts(id)) : '';
  return { name: `${n.name} · ${n.role}${hearts}`, avatar: n.avatar };
}

function objectiveSummary(q) {
  return q.objectives.map((o) => {
    const fake = { n: 0, list: [], done: false, day: 0 };
    const info = QuestSystem.objInfo(q, o, fake);
    return `· ${info.label} (${info.need.toLocaleString()}${info.unit})`;
  }).join('\n');
}

function greeting(id, first) {
  const n = NPCS[id];
  const w = G.state.time.weather;
  const h = G.state.time.minutes / 60;
  if (first && w === 'rain') return pick(['비가 오네. 작물들은 좋아하겠어.', '오늘은 비 덕분에 물 줄 걱정은 없겠구먼.', n.greet[0]]);
  if (first && w === 'snow') return pick(['눈이 오니 마을이 하얗네!', '춥지 않게 조심해.', n.greet[0]]);
  if (h >= 20) return pick(['밤이 늦었네. 얼른 들어가 쉬어.', '이 시간까지 일하는 거야? 무리하지 마.', ...n.greet]);
  return pick(n.greet);
}

export const DialogueSystem = {
  /** 상점/대장간 등 거래 화면 열기 (main.js에서 연결) */
  openTrade: null,

  async talkTo(npcId) {
    if (G.ui.dialogue) return;
    const npcEnt = G.refs.npcs[npcId];
    const player = G.refs.player;
    G.ui.dialogue = true;
    npcEnt.talking = true;
    npcEnt.faceTo(player.pos.x, player.pos.z);
    player.faceTo(npcEnt.pos.x, npcEnt.pos.z);

    const first = RelationSystem.dailyTalk(npcId);
    EventBus.emit('talk', npcId);

    let openAfter = null;
    try {
      await DialogueUI.say(speaker(npcId), [greeting(npcId, first)]);
      let loop = true;
      while (loop) {
        // 줄 수 있는 부탁이 있으면 이야기하자마자 들려주고 자동으로 수락 (완료 보고 뒤 새로 생긴 부탁도 포함)
        for (const q of QuestSystem.offersFor(npcId)) await this.doOffer(npcId, q);
        const opts = [];
        for (const d of QuestSystem.deliverablesFor(npcId)) {
          opts.push({ label: `🎁 ${getItem(d.o.item).name} ${d.o.n}개 전달하기`, highlight: true, run: () => this.doDeliver(npcId, d) });
        }
        for (const { q } of QuestSystem.completableFor(npcId)) {
          opts.push({ label: `✅ 부탁 완료 보고: ${q.title}`, highlight: true, run: () => this.doComplete(npcId, q) });
        }
        if (npcId === 'shop') opts.push({ label: '🛒 거래하기', run: () => { openAfter = 'shop'; return false; } });
        if (npcId === 'smith') opts.push({ label: '🔨 대장간 이용하기', run: () => { openAfter = 'forge'; return false; } });
        opts.push({ label: '💬 이야기하기', run: () => this.chat(npcId) });
        opts.push({ label: '👋 작별 인사', run: () => false });
        const choice = await DialogueUI.choose(speaker(npcId), null, opts);
        loop = await choice.run();
        if (loop === 'ending') {
          openAfter = 'ending';
          loop = false;
        }
      }
    } finally {
      DialogueUI.hide();
      G.ui.dialogue = false;
      npcEnt.talking = false;
    }
    if (openAfter) this.openTrade?.(openAfter);
  },

  async chat(npcId) {
    const n = NPCS[npcId];
    await DialogueUI.say(speaker(npcId), [pick(n.chat)]);
    return true;
  },

  /** 부탁 내용을 들려주고 바로 수락 처리 (수락 버튼 없음) */
  async doOffer(npcId, q) {
    await DialogueUI.say(speaker(npcId), q.offer);
    QuestSystem.accept(q);
    EventBus.emit('talkAccepted', npcId);
    const thanks = npcId === 'chief'
      ? '그럼 잘 부탁하네! 할 일과 위치는 퀘스트 창(📜)에서 확인할 수 있을 걸세.'
      : '그럼 잘 부탁해!';
    await DialogueUI.say(speaker(npcId), [`📜 새 부탁 [${q.title}]\n${objectiveSummary(q)}`, thanks]);
    return true;
  },

  async doDeliver(npcId, d) {
    QuestSystem.deliver(d);
    await DialogueUI.say(speaker(npcId), ['와, 이걸 나한테? 정말 고마워!', `${NPCS[d.q.giver].name}에게도 고맙다고 전해 줘.`]);
    RelationSystem.add(npcId, 5);
    return true;
  },

  async doComplete(npcId, q) {
    await DialogueUI.say(speaker(npcId), q.done);
    QuestSystem.complete(q);
    if (q.rewards?.ending) return 'ending';
    return true;
  },

  /** 오프닝: 이장이 주인공을 맞이하고 첫 퀘스트를 줌 */
  async intro() {
    const chief = G.refs.npcs.chief;
    const player = G.refs.player;
    G.ui.dialogue = true;
    chief.frozen = true;
    chief.group.position.set(player.pos.x + 2.2, 0, player.pos.z - 1.5);
    chief.faceTo(player.pos.x, player.pos.z);
    player.faceTo(chief.pos.x, chief.pos.z);
    const name = G.state.player.name;
    try {
      await DialogueUI.say(speaker('chief'), [
        `자네가 이번에 새로 이사 온 ${name} 씨로구먼! 초록마을에 온 걸 환영하네.`,
        '나는 이 마을 이장일세. 낡은 집이랑 밭 하나뿐이지만, 정 붙이고 살다 보면 금세 고향 같아질 걸세.',
        '사실… 나도 이제 나이가 들어서 마을 일을 맡아 줄 사람을 찾고 있었다네.',
        '내가 부탁하는 일들을 하나씩 해 주겠나? 다 해내면 자네에게 이 마을을 맡기고 싶네.',
      ]);
      QuestSystem.accept(QuestSystem.currentMain());
      await DialogueUI.say(speaker('chief'), [
        '첫 부탁은 간단하네. 마을 사람들에게 인사부터 하고 오게.',
        '궁금한 건 언제든 마을회관으로 찾아오게나. 허허.',
      ]);
    } finally {
      DialogueUI.hide();
      G.ui.dialogue = false;
    }
    const [hx, hz] = NPCS.chief.pos;
    chief.walkTo(-14.5, 4, 4, () => chief.walkTo(2.5, 3, 4, () => chief.walkTo(2.5, -13, 4, () => chief.walkTo(hx, hz, 4, () => {
      chief.frozen = false;
      chief.resetHome();
    }))));
  },
};
