import { G, FARM_MAX, MONEY_CHEAT } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { AudioManager } from '../core/AudioManager.js';
import { saveGame } from '../core/SaveManager.js';
import { TOOL_ORDER, GEAR_ORDER, MAX_ENHANCE } from '../data/tools.js';
import { CLOTHES } from '../data/clothes.js';
import { RANKS } from '../data/ranks.js';
import { MAIN_QUESTS } from '../data/mainQuests.js';
import { SUB_QUESTS } from '../data/subQuests.js';
import { RODS, FISH, FISH_ORDER } from '../data/fishing.js';
import { PICKAXES, ORE_ORDER } from '../data/mining.js';
import { CROP_ORDER } from '../data/crops.js';
import { OutfitSystem } from './OutfitSystem.js';
import { GearSystem } from './GearSystem.js';
import { StaminaSystem } from './StaminaSystem.js';
import { FarmSystem } from './FarmSystem.js';
import { InventorySystem } from './InventorySystem.js';
import { StorageSystem } from './StorageSystem.js';
import { SoilBoxSystem } from './SoilBoxSystem.js';
import { ITEMS } from '../data/items.js';
import { sparkle } from '../world/Effects.js';
import { updateDecorations } from '../world/World.js';
import { banner } from '../ui/HUD.js';

/**
 * 치트 코드 (게임 중에 키보드로 입력)
 *  master: 메인·서브 퀘스트 전부 완료 + 최종 장비·옷 + 최고 낚싯대·곡괭이 + 10억 + 마을 이장 + 도감 모두 공개
 *          + 모든 아이템 한 스택씩 (씨앗·모종·작물·음식·특별·재료·광석 99개, 물고기·게 한 마리씩)
 *  farmer: 메인 퀘스트만 전부 완료 + 최종 장비·옷 + 최고 낚싯대·곡괭이 + 10억 + 마을 이장 + 도감 모두 공개
 *  money:  돈만 100억 (퀘스트 · 장비 · 직책 등 다른 것은 그대로)
 */
const CODES = { master: { subs: true }, farmer: { subs: false }, money: { moneyOnly: true } };
const MONEY_ONLY = 10_000_000_000;
const MAX_LEN = Math.max(...Object.keys(CODES).map((c) => c.length));
const FINAL_SET = ['cloth_chief_hat', 'cloth_chief_top', 'cloth_chief_bot'];
const BEST_ROD = RODS[RODS.length - 1].id;
const BEST_PICK = PICKAXES[PICKAXES.length - 1].id;

export const CheatSystem = {
  buffer: '',

  /** 키 입력을 받아 치트 코드가 완성되면 발동 */
  feed(code) {
    const m = code.match(/^Key([A-Z])$/);
    if (!m) return;
    this.buffer = (this.buffer + m[1].toLowerCase()).slice(-MAX_LEN);
    if (!G.state || G.mode !== 'play') return;
    for (const [word, opt] of Object.entries(CODES)) {
      if (this.buffer.endsWith(word)) {
        this.buffer = '';
        this.apply(word, opt);
        return;
      }
    }
  },

  /** 메인 퀘스트(+ subs 이면 서브 퀘스트도)를 모두 완료 처리하고 해금 플래그를 켠다 */
  completeQuests(subs) {
    const s = G.state;
    const q = s.quests;
    q.mainIndex = MAIN_QUESTS.length;
    q.main = null;
    const done = [...MAIN_QUESTS];
    if (subs) {
      for (const sq of SUB_QUESTS) {
        q.subs[sq.id] = { status: 'done', progress: sq.objectives.map(() => ({ n: 0, list: [], done: true, day: 0 })) };
      }
      done.push(...SUB_QUESTS);
      s.flags.gotPickaxe = true;
    }
    const tracked = q.tracked && [...MAIN_QUESTS, ...(subs ? SUB_QUESTS : [])].some((x) => x.id === q.tracked);
    if (tracked) q.tracked = null;
    for (const quest of done) {
      for (const f of quest.rewards?.flags || []) s.flags[f] = true;
    }
    // 마을회관도 다 지은 것으로
    s.flags.hallFunded = true;
    s.flags.hallBuilt = true;
    // 메인 퀘스트를 다 끝냈으니 엔딩을 본 것으로 → 메뉴의 '엔딩 다시 보기' · 광장 꼬마전구
    s.flags.endingSeen = true;
    updateDecorations(s.flags);
    s.rank = RANKS.length - 1;
    EventBus.emit('rank');
    EventBus.emit('quests');
  },

  /** 최고 등급 낚싯대·곡괭이 (없을 때만, 핫바 빈칸 우선 → 가방 → 창고) */
  giveHandTools() {
    for (const id of [BEST_ROD, BEST_PICK]) {
      if (InventorySystem.count(id) > 0) continue;
      if (!InventorySystem.addTool(id)) StorageSystem.add(id, 1);
    }
  },

  /** 도감 모두 채우기: 아직 못 얻은 작물·물고기·광석을 1개(마리)씩 얻은 것으로 (이미 있는 기록은 그대로) */
  fillBook() {
    const s = G.state;
    for (const id of CROP_ORDER) s.stats.harvested[id] = Math.max(1, s.stats.harvested[id] || 0);
    for (const id of FISH_ORDER) {
      s.fishing.counts[id] = Math.max(1, s.fishing.counts[id] || 0);
      // 잡아 본 적 없는 고기는 그 종류의 최대 무게를 최고 기록으로
      if (!s.fishing.best[id]) s.fishing.best[id] = FISH[id].w[1];
    }
    for (const id of ORE_ORDER) s.mine.mined[id] = Math.max(1, s.mine.mined[id] || 0);
    for (const evt of ['harvest', 'fish', 'mined']) EventBus.emit(evt, {});
  },

  /**
   * (master 전용) 모든 아이템 한 스택씩: 씨앗 · 모종 · 작물 · 음식 · 특별 아이템 · 재료 · 광석은 한 스택(99개)이 되도록 채우고,
   * 물고기 · 게는 한 마리씩(무게는 그 종류의 중간). 가방이 모자라면 남는 건 창고로. 지하 흙 상자도 가득.
   * 도구 · 장비 · 옷 · 낚싯대 · 곡괭이 · 시설은 따로 지급하므로 뺀다.
   */
  giveAllItems() {
    const STACK_TYPES = ['seed', 'crop', 'food', 'special', 'material', 'ore'];
    let stored = 0;
    for (const it of Object.values(ITEMS)) {
      if (!STACK_TYPES.includes(it.type)) continue;
      const need = (it.stack || 99) - InventorySystem.count(it.id);
      if (need > 0) stored += InventorySystem.addOrStore(it.id, need);
    }
    for (const id of FISH_ORDER) {
      if (InventorySystem.count(id) > 0) continue;
      const [lo, hi] = FISH[id].w;
      if (!InventorySystem.addFish({ id, w: Math.round(((lo + hi) / 2) * 100) / 100 })) break;
    }
    SoilBoxSystem.add(SoilBoxSystem.free());
    EventBus.emit('inventory');
    return stored;
  },

  /** money: 돈만 100억 */
  giveMoney() {
    G.state.player.money += MONEY_ONLY;
    EventBus.emit('money');
    AudioManager.sfx('coin');
    sparkle(G.refs.player.pos);
    banner('💰 MONEY 치트 발동!', `+${MONEY_ONLY.toLocaleString()}원 (100억) · 다른 것은 그대로예요`);
    saveGame();
  },

  apply(word, { subs, moneyOnly }) {
    if (moneyOnly) return this.giveMoney();
    const s = G.state;
    this.completeQuests(subs);
    this.fillBook();
    const stored = word === 'master' ? this.giveAllItems() : 0;

    for (const id of GEAR_ORDER) {
      GearSystem.add(id);
      s.gear.enhance[id] = MAX_ENHANCE;
    }
    for (const k of TOOL_ORDER) GearSystem.equipBest(k);
    EventBus.emit('gear');

    for (const id of Object.keys(CLOTHES)) OutfitSystem.addClothes(id);
    for (const id of FINAL_SET) OutfitSystem.equip(id);

    this.giveHandTools();
    FarmSystem.expand(FARM_MAX);

    s.player.money += MONEY_CHEAT;
    EventBus.emit('money');

    StaminaSystem.fill();
    AudioManager.sfx('fanfare');
    sparkle(G.refs.player.pos);
    const what = subs ? '메인·서브 퀘스트 모두 완료' : '메인 퀘스트 모두 완료';
    const items = word === 'master' ? ` · 모든 아이템 한 스택씩${stored ? ` (가방에 못 들어간 ${stored}개는 창고로)` : ''}` : '';
    banner(`🧑‍🌾 ${word.toUpperCase()} 치트 발동!`, `${what} · ${RANKS[s.rank].name} 임명 · 최종 장비 +${MAX_ENHANCE} · 이장 옷 · 황금 낚싯대 · 다이아 곡괭이 · 도감 모두 공개 · +${MONEY_CHEAT.toLocaleString()}원${items}`);
    saveGame();
  },
};
