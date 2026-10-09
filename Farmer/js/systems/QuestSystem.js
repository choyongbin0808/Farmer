import { G, RESIDENTS, currentZone } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { AudioManager } from '../core/AudioManager.js';
import { saveGame } from '../core/SaveManager.js';
import { MAIN_QUESTS, HALL_COST } from '../data/mainQuests.js';
import { SUB_QUESTS } from '../data/subQuests.js';
import { CROPS } from '../data/crops.js';
import { NPCS } from '../data/npcs.js';
import { CLOTHES } from '../data/clothes.js';
import { getItem, isHandTool } from '../data/items.js';
import { StorageSystem } from './StorageSystem.js';
import { MINE_EXIT } from '../world/Mine.js';
import { TOOL_ORDER, TIERS } from '../data/tools.js';
import { InventorySystem } from './InventorySystem.js';
import { GearSystem } from './GearSystem.js';
import { RelationSystem } from './RelationSystem.js';
import { OutfitSystem } from './OutfitSystem.js';
import { FarmSystem, EXPAND_COSTS } from './FarmSystem.js';
import { RankSystem } from './RankSystem.js';
import { updateDecorations, farmCenter, PLAZA, BUILDINGS, MINE_DOOR } from '../world/World.js';
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
      case 'toolLevel': {
        // 장착한 장비 등급(낡은 1 ~ 무지개 6) 기준
        cur = TOOL_ORDER.filter((k) => GearSystem.levelOf(k) >= o.level).length; need = o.count;
        const tierName = TIERS[o.level - 1]?.name ?? '';
        label = o.count >= 3 ? `모든 농기구를 ${o.level}단계(${tierName}) 이상 장비로 장착` : `${o.level}단계(${tierName}) 이상 농기구 장착`;
        break;
      }
      case 'enhance':
        // 장착한 장비의 강화 단계 기준
        cur = GearSystem.countEnhanced(o.level); need = o.count;
        label = o.count >= 3 ? `장착한 모든 농기구를 +${o.level} 이상 강화` : `장착한 농기구를 +${o.level} 이상 강화`;
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
      case 'hallFund':
        cur = s.flags.hallFunded ? 1 : 0; need = 1; label = `이장님께 건축비 ${o.amount.toLocaleString()}원 내기`;
        break;
      case 'hallBuilt':
        cur = s.flags.hallBuilt ? 1 : 0; need = 1; label = s.flags.hallFunded ? '새 마을회관 완공 (하룻밤 자고 나면)' : '새 마을회관 완공';
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
      if (r.mainDone && s.quests.mainIndex < r.mainDone) continue;
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
      const item = getItem(it.id);
      if (isHandTool(item)) {
        // 낚싯대·곡괭이는 바로 쓸 수 있게 핫바 빈칸으로
        if (!InventorySystem.addTool(it.id)) StorageSystem.add(it.id, 1);
      } else {
        InventorySystem.addOrStore(it.id, it.n);
      }
      msgs.push(`${item.icon} ${item.name} x${it.n}`);
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
      if (f === 'mine') msgs.push('⛏️ 광산 출입 허가 (마을 동쪽 끝)');
    }
    updateDecorations(s.flags);
    for (const [npc, v] of Object.entries(r.relation || {})) RelationSystem.add(npc, v);
    if (msgs.length) setTimeout(() => toast(`보상: ${msgs.join(' · ')}`, 'good'), 600);
  },

  // ─── NPC 머리 위 아이콘 ───
  /**
   * 머리 위 표시: ✅ 완료 보고·전달할 수 있음 / ❗(빨강) 진행 중인 퀘스트와 관련된 사람
   * 아직 받지 않은 퀘스트는 표시하지 않는다 (퀘스트 창의 '받을 수 있는 퀘스트'에서 확인)
   */
  npcIcon(npcId) {
    if (this.completableFor(npcId).length || this.deliverablesFor(npcId).length) return '✅';
    if (this.inProgressWith(npcId)) return '❗';
    return null;
  },

  /** 진행 중인 퀘스트를 준 사람이거나, 아직 끝나지 않은 목표의 상대(대화·전달)인지 */
  inProgressWith(npcId) {
    if (npcId === 'han' && G.state.flags.mine && !G.state.flags.gotPickaxe) return true;
    return this.active().some(({ q, rec }) => {
      if (q.giver === npcId) return true;
      return q.objectives.some((o, i) => {
        const p = rec.progress[i];
        if (o.kind === 'talk') return o.targets.includes(npcId) && !p.list.includes(npcId);
        if (o.kind === 'deliver') return o.to === npcId && !p.done;
        if (o.kind === 'talkRain' || o.kind === 'talkTimes') return o.npc === npcId && !p.done;
        return false;
      });
    });
  },

  // ─── 새 마을회관 ───
  /** 회관 퀘스트를 받았고 아직 건축비를 안 냈는지 */
  canFundHall() {
    const m = this.currentMain();
    return !!(m?.objectives.some((o) => o.kind === 'hallFund') && G.state.quests.main && !G.state.flags.hallFunded);
  },

  fundHall() {
    const s = G.state;
    if (!this.canFundHall()) return false;
    if (s.player.money < HALL_COST) {
      AudioManager.sfx('error');
      toast(`건축비가 모자라요 (${HALL_COST.toLocaleString()}원 필요)`, 'warn');
      return false;
    }
    s.player.money -= HALL_COST;
    s.flags.hallFunded = true;
    updateDecorations(s.flags);
    AudioManager.sfx('anvil');
    banner('🏗️ 마을회관 공사 시작!', '하룻밤 자고 나면 새 마을회관이 완공돼요');
    EventBus.emit('money');
    EventBus.emit('quests');
    saveGame();
    return true;
  },

  /** 잠자고 일어날 때: 건축비를 냈으면 회관 완공 */
  finishHallOvernight() {
    const s = G.state;
    if (!s.flags.hallFunded || s.flags.hallBuilt) return false;
    s.flags.hallBuilt = true;
    updateDecorations(s.flags);
    EventBus.emit('quests');
    return true;
  },

  // ─── 퀘스트 위치 ───
  /** 다른 구역(광산 ↔ 마을)에 있는 곳이면 그 구역으로 가는 출입구를 가리킨다 */
  zoned(pos, zone, label) {
    const here = currentZone();
    if (zone === here) return { ...pos, label };
    if (here === 'village') return { ...MINE_DOOR, label: `광산 입구 → ${label}` };
    return { ...MINE_EXIT, label: `광산 출구 → ${label}` };
  },

  npcPos(id) {
    const n = G.refs.npcs?.[id];
    return n ? { x: n.pos.x, z: n.pos.z } : { x: NPCS[id].pos[0], z: NPCS[id].pos[1] };
  },

  /** 주민 위치 + 이름표 + 구역 */
  npcAt(id, label = npcName(id)) {
    return { ...this.npcPos(id), label, zone: NPCS[id].zone ?? 'village' };
  },

  /** 위치 표시 대상 (지금 구역 기준으로, 다른 구역이면 출입구) */
  target(q) {
    const t = this.rawTarget(q);
    return t && this.zoned(t, t.zone ?? 'village', t.label);
  },

  rawTarget(q) {
    const rec = this.recordOf(q);
    if (!rec) return null;
    const farm = { ...farmCenter(G.state.farm.size), label: '내 밭' };
    if (this.isComplete(q, rec)) return this.npcAt(q.giver, `${npcName(q.giver)}에게 보고`);
    for (let i = 0; i < q.objectives.length; i++) {
      const o = q.objectives[i];
      const info = this.objInfo(q, o, rec.progress[i]);
      if (info.done && o.kind !== 'deliver') continue;
      if (o.kind === 'deliver') {
        if (rec.progress[i].done) continue;
        if (info.done) return this.npcAt(o.to);
        return farm;
      }
      switch (o.kind) {
        case 'talk': {
          const left = o.targets.find((t) => !rec.progress[i].list.includes(t));
          return this.npcAt(left);
        }
        case 'earn': case 'sellCount': case 'totalEarned':
          return this.npcAt('shop', '상점');
        case 'toolLevel':
          return this.npcAt('shop', '상점');
        case 'enhance':
          return this.npcAt('smith', '대장간');
        case 'relation':
          return { x: PLAZA.x, z: PLAZA.z, label: '마을 광장' };
        case 'talkRain': case 'talkTimes':
          return this.npcAt(o.npc);
        case 'hallFund':
          return this.npcAt('chief', '이장님께 건축비 내기');
        case 'hallBuilt': {
          const h = BUILDINGS.house;
          return { x: h.ix, z: h.iz, label: '집에서 하룻밤 자기' };
        }
        default:
          return farm;
      }
    }
    return this.npcAt(q.giver);
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
    for (const evt of ['gear', 'relation', 'money', 'storage', 'inventory', 'farmExpand']) {
      EventBus.on(evt, () => EventBus.emit('quests'));
    }
  },
};
