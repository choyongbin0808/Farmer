import { G, RESIDENTS } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { AudioManager } from '../core/AudioManager.js';
import { saveGame } from '../core/SaveManager.js';
import { MAIN_QUESTS } from '../data/mainQuests.js';
import { SUB_QUESTS } from '../data/subQuests.js';
import { CROPS } from '../data/crops.js';
import { NPCS } from '../data/npcs.js';
import { CLOTHES } from '../data/clothes.js';
import { getItem } from '../data/items.js';
import { TOOL_ORDER } from '../data/tools.js';
import { InventorySystem } from './InventorySystem.js';
import { RelationSystem } from './RelationSystem.js';
import { OutfitSystem } from './OutfitSystem.js';
import { FarmSystem, EXPAND_COSTS } from './FarmSystem.js';
import { RankSystem } from './RankSystem.js';
import { updateDecorations, farmCenter, PLAZA } from '../world/World.js';
import { toast, banner } from '../ui/HUD.js';

const SUB_BY_ID = Object.fromEntries(SUB_QUESTS.map((q) => [q.id, q]));
const MAIN_BY_ID = Object.fromEntries(MAIN_QUESTS.map((q) => [q.id, q]));

function newProgress(q) {
  return q.objectives.map(() => ({ n: 0, list: [], done: false, day: 0 }));
}

function npcName(id) {
  return NPCS[id].name;
}

export const QuestSystem = {
  get(id) {
    return MAIN_BY_ID[id] || SUB_BY_ID[id];
  },

  currentMain() {
    const i = G.state.quests.mainIndex;
    return i < MAIN_QUESTS.length ? MAIN_QUESTS[i] : null;
  },

  /** 진행 중인 퀘스트 [{ q, rec }] */
  active() {
    const s = G.state.quests;
    const out = [];
    const m = this.currentMain();
    if (m && s.main) out.push({ q: m, rec: s.main });
    for (const q of SUB_QUESTS) {
      const rec = s.subs[q.id];
      if (rec && rec.status === 'active') out.push({ q, rec });
    }
    return out;
  },

  recordOf(q) {
    return q.type === 'main' ? G.state.quests.main : G.state.quests.subs[q.id];
  },

  /** 목표 하나의 진행 정보 */
  objInfo(q, o, p) {
    const s = G.state;
    let cur = 0, need = 1, label = '', unit = '';
    switch (o.kind) {
      case 'talk':
        cur = p.list.length; need = o.targets.length;
        label = `${o.targets.map(npcName).join(', ')}와(과) 인사하기`;
        break;
      case 'till':
        cur = p.n; need = o.count; label = '호미로 밭 갈기';
        break;
      case 'plant':
        cur = p.n; need = o.count; label = `${CROPS[o.crop].name} 씨앗 심기`;
        break;
      case 'plantedPlots':
        cur = FarmSystem.plantedCount(); need = o.count; label = '밭 모든 칸에 작물 심기';
        break;
      case 'harvest':
        cur = p.n; need = o.count; label = `${o.crop ? CROPS[o.crop].name : '작물'} 수확하기`;
        break;
      case 'earn':
        cur = p.n; need = o.amount; label = '작물 판매로 돈 벌기'; unit = '원';
        break;
      case 'sellCount':
        cur = p.n; need = o.count; label = '작물 판매하기';
        break;
      case 'deliver': {
        const have = InventorySystem.countAll(o.item);
        need = o.n;
        cur = p.done ? need : Math.min(have, need);
        label = `${npcName(o.to)}에게 ${getItem(o.item).name} 전달`;
        if (p.done) label += ' (전달 완료)';
        break;
      }
      case 'toolLevel':
        cur = TOOL_ORDER.filter((k) => s.tools[k] >= o.level).length; need = o.count;
        label = o.count >= 3 ? `모든 농기구 ${o.level}단계 이상` : `농기구 ${o.level}단계 이상으로 강화`;
        break;
      case 'relation':
        cur = RelationSystem.countWithHearts(o.hearts); need = o.count;
        label = o.count >= RESIDENTS.length ? `모든 주민과 ${o.hearts}하트 이상` : `주민과 ${o.hearts}하트 이상 친해지기`;
        break;
      case 'dayHarvest':
        cur = p.done ? o.count : p.day === s.time.day ? p.n : 0; need = o.count; label = '하루에 작물 수확하기 (오늘 기준)';
        break;
      case 'totalEarned':
        cur = s.stats.totalEarned; need = o.amount; label = '누적 판매 금액'; unit = '원';
        break;
      case 'talkRain':
        cur = p.done ? 1 : 0; need = 1; label = `비 오는 날 ${npcName(o.npc)}와(과) 이야기하기`;
        break;
      case 'talkTimes':
        cur = p.done ? o.count : p.day === s.time.day ? p.n : 0; need = o.count; label = `하루 동안 ${npcName(o.npc)}와(과) 대화하기`;
        break;
      default:
        break;
    }
    cur = Math.min(cur, need);
    return { cur, need, label, unit, done: cur >= need };
  },

  infos(q, rec) {
    return q.objectives.map((o, i) => this.objInfo(q, o, rec.progress[i]));
  },

  isComplete(q, rec) {
    return this.infos(q, rec).every((i) => i.done);
  },

  // ─── 수락 / 제안 ───
  offersFor(npcId) {
    const s = G.state;
    const out = [];
    if (npcId === 'chief' && !s.quests.main) {
      const m = this.currentMain();
      if (m) out.push(m);
    }
    for (const q of SUB_QUESTS) {
      if (q.giver !== npcId || s.quests.subs[q.id]) continue;
      const r = q.req || {};
      if (r.prev && s.quests.subs[r.prev]?.status !== 'done') continue;
      if (r.hearts && RelationSystem.hearts(npcId) < r.hearts) continue;
      out.push(q);
    }
    return out;
  },

  accept(q) {
    const rec = { status: 'active', progress: newProgress(q) };
    if (q.type === 'main') G.state.quests.main = rec;
    else G.state.quests.subs[q.id] = rec;
    if (!G.state.quests.tracked) G.state.quests.tracked = q.id;
    AudioManager.sfx('click');
    toast(`📜 새 퀘스트: ${q.title}`, 'good');
    EventBus.emit('quests');
  },

  /** 이 NPC에게 완료 보고할 수 있는 퀘스트 */
  completableFor(npcId) {
    return this.active().filter(({ q, rec }) => q.giver === npcId && this.isComplete(q, rec));
  },

  /** 이 NPC에게 전달할 수 있는 (다른 사람이 준 퀘스트의) 전달 목표 */
  deliverablesFor(npcId) {
    const out = [];
    for (const { q, rec } of this.active()) {
      if (q.giver === npcId) continue;
      q.objectives.forEach((o, i) => {
        if (o.kind === 'deliver' && o.to === npcId && !rec.progress[i].done && InventorySystem.countAll(o.item) >= o.n) {
          out.push({ q, rec, o, i });
        }
      });
    }
    return out;
  },

  deliver({ rec, o, i }) {
    InventorySystem.consumeAll(o.item, o.n);
    rec.progress[i].done = true;
    AudioManager.sfx('coin');
    toast(`🎁 ${npcName(o.to)}에게 ${getItem(o.item).name} ${o.n}개를 전달했어요`);
    EventBus.emit('quests');
  },

  complete(q) {
    const rec = this.recordOf(q);
    q.objectives.forEach((o, i) => {
      if (o.kind === 'deliver' && !rec.progress[i].done) InventorySystem.consumeAll(o.item, o.n);
    });
    const s = G.state;
    if (q.type === 'main') {
      s.quests.main = null;
      s.quests.mainIndex++;
    } else {
      rec.status = 'done';
      RelationSystem.add(q.giver, 20);
    }
    if (s.quests.tracked === q.id) s.quests.tracked = null;
    AudioManager.sfx('quest');
    banner('✨ 퀘스트 완료!', q.title);
    this.giveRewards(q.rewards || {});
    if (q.type === 'main') RankSystem.update();
    EventBus.emit('quests');
    saveGame();
  },

  giveRewards(r) {
    const s = G.state;
    const msgs = [];
    if (r.money) {
      s.player.money += r.money;
      msgs.push(`💰 ${r.money.toLocaleString()}원`);
      EventBus.emit('money');
    }
    for (const it of r.items || []) {
      const left = InventorySystem.add(it.id, it.n);
      msgs.push(`${getItem(it.id).icon} ${getItem(it.id).name} x${it.n}`);
      if (left > 0) toast('가방이 가득 차서 일부 보상을 받지 못했어요', 'warn');
    }
    for (const id of r.clothes || []) {
      OutfitSystem.addClothes(id);
      msgs.push(`${CLOTHES[id].icon} ${CLOTHES[id].name}`);
    }
    if (r.autoEquip) for (const id of r.clothes || []) OutfitSystem.equip(id);
    if (r.expand && !FarmSystem.expand(r.expand)) {
      const refund = EXPAND_COSTS[r.expand] ?? 0;
      s.player.money += refund;
      msgs.push(`🌾 밭이 이미 넓어서 대신 ${refund.toLocaleString()}원`);
      EventBus.emit('money');
    }
    for (const f of r.flags || []) {
      s.flags[f] = true;
      if (f === 'watermelon') msgs.push('🍉 수박 씨앗 해금');
      if (f === 'tea') msgs.push('🍵 상점에서 약초차 판매 시작');
      if (f === 'discount') msgs.push('🔨 강화 비용 10% 할인');
      if (f === 'deco_drawing') msgs.push('🖼️ 민지의 그림 (집 앞 장식)');
      if (f === 'deco_rod') msgs.push('🎣 낚싯대 장식 (집 앞)');
    }
    updateDecorations(s.flags);
    for (const [npc, v] of Object.entries(r.relation || {})) RelationSystem.add(npc, v);
    if (msgs.length) setTimeout(() => toast(`보상: ${msgs.join(' · ')}`, 'good'), 600);
  },

  // ─── NPC 머리 위 아이콘 ───
  npcIcon(npcId) {
    if (this.completableFor(npcId).length || this.deliverablesFor(npcId).length) return '✅';
    if (this.offersFor(npcId).length) return '❗';
    return null;
  },

  // ─── 퀘스트 위치 ───
  npcPos(id) {
    const n = G.refs.npcs?.[id];
    return n ? { x: n.pos.x, z: n.pos.z } : { x: NPCS[id].pos[0], z: NPCS[id].pos[1] };
  },

  target(q) {
    const rec = this.recordOf(q);
    if (!rec) return null;
    const farm = { ...farmCenter(G.state.farm.size), label: '내 밭' };
    if (this.isComplete(q, rec)) return { ...this.npcPos(q.giver), label: `${npcName(q.giver)}에게 보고` };
    for (let i = 0; i < q.objectives.length; i++) {
      const o = q.objectives[i];
      const info = this.objInfo(q, o, rec.progress[i]);
      if (info.done && o.kind !== 'deliver') continue;
      if (o.kind === 'deliver') {
        if (rec.progress[i].done) continue;
        if (info.done) return { ...this.npcPos(o.to), label: npcName(o.to) };
        return farm;
      }
      switch (o.kind) {
        case 'talk': {
          const left = o.targets.find((t) => !rec.progress[i].list.includes(t));
          return { ...this.npcPos(left), label: npcName(left) };
        }
        case 'earn': case 'sellCount': case 'totalEarned':
          return { ...this.npcPos('shop'), label: '상점' };
        case 'toolLevel':
          return { ...this.npcPos('smith'), label: '대장간' };
        case 'relation':
          return { x: PLAZA.x, z: PLAZA.z, label: '마을 광장' };
        case 'talkRain': case 'talkTimes':
          return { ...this.npcPos(o.npc), label: npcName(o.npc) };
        default:
          return farm;
      }
    }
    return { ...this.npcPos(q.giver), label: npcName(q.giver) };
  },

  tracked() {
    const id = G.state.quests.tracked;
    if (!id) return null;
    const q = this.get(id);
    const rec = q && this.recordOf(q);
    if (!rec || (q.type === 'sub' && rec.status !== 'active')) return null;
    return q;
  },

  setTracked(id) {
    G.state.quests.tracked = G.state.quests.tracked === id ? null : id;
    EventBus.emit('quests');
  },

  // ─── 이벤트 연결 ───
  init() {
    const each = (kinds, fn) => {
      for (const { q, rec } of this.active()) {
        q.objectives.forEach((o, i) => {
          if (kinds.includes(o.kind)) fn(o, rec.progress[i], q);
        });
      }
      EventBus.emit('quests');
    };

    EventBus.on('talk', (npcId) => each(['talk', 'talkRain', 'talkTimes'], (o, p) => {
      if (o.kind === 'talk' && o.targets.includes(npcId) && !p.list.includes(npcId)) p.list.push(npcId);
      if (o.kind === 'talkRain' && o.npc === npcId && G.state.time.weather === 'rain') p.done = true;
      if (o.kind === 'talkTimes' && o.npc === npcId && !p.done) {
        if (p.day !== G.state.time.day) { p.day = G.state.time.day; p.n = 0; }
        p.n++;
        if (p.n >= o.count) p.done = true;
      }
    }));
    EventBus.on('till', (n) => each(['till'], (o, p) => { p.n += n; }));
    EventBus.on('plant', (cropId) => each(['plant'], (o, p) => { if (o.crop === cropId) p.n++; }));
    EventBus.on('harvest', ({ cropId, amount }) => each(['harvest', 'dayHarvest'], (o, p) => {
      if (o.kind === 'harvest' && (!o.crop || o.crop === cropId)) p.n += amount;
      if (o.kind === 'dayHarvest' && !p.done) {
        if (p.day !== G.state.time.day) { p.day = G.state.time.day; p.n = 0; }
        p.n += amount;
        if (p.n >= o.count) p.done = true;
      }
    }));
    EventBus.on('sell', ({ n, money }) => each(['earn', 'sellCount'], (o, p) => {
      if (o.kind === 'earn') p.n += money;
      if (o.kind === 'sellCount') p.n += n;
    }));
    for (const evt of ['upgrade', 'relation', 'money', 'storage', 'inventory', 'farmExpand']) {
      EventBus.on(evt, () => EventBus.emit('quests'));
    }
  },
};
