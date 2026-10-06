import { G, FARM_MAX, MONEY_CHEAT } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { AudioManager } from '../core/AudioManager.js';
import { saveGame } from '../core/SaveManager.js';
import { TOOL_ORDER, GEAR_ORDER, MAX_ENHANCE } from '../data/tools.js';
import { CLOTHES } from '../data/clothes.js';
import { RANKS } from '../data/ranks.js';
import { MAIN_QUESTS } from '../data/mainQuests.js';
import { SUB_QUESTS } from '../data/subQuests.js';
import { OutfitSystem } from './OutfitSystem.js';
import { GearSystem } from './GearSystem.js';
import { StaminaSystem } from './StaminaSystem.js';
import { FarmSystem } from './FarmSystem.js';
import { sparkle } from '../world/Effects.js';
import { updateDecorations } from '../world/World.js';
import { banner } from '../ui/HUD.js';

const CODE = 'farmer';
const FINAL_SET = ['cloth_chief_hat', 'cloth_chief_top', 'cloth_chief_bot'];

export const CheatSystem = {
  buffer: '',

  /** 키 입력을 받아 치트 코드가 완성되면 발동 */
  feed(code) {
    const m = code.match(/^Key([A-Z])$/);
    if (!m) return;
    this.buffer = (this.buffer + m[1].toLowerCase()).slice(-CODE.length);
    if (this.buffer === CODE && G.state && G.mode === 'play') {
      this.buffer = '';
      this.apply();
    }
  },

  /** 메인·서브 퀘스트를 모두 완료 처리하고(해금 플래그 포함) 직책을 마을 이장으로 */
  completeQuests() {
    const s = G.state;
    const q = s.quests;
    q.mainIndex = MAIN_QUESTS.length;
    q.main = null;
    q.tracked = null;
    for (const sq of SUB_QUESTS) {
      q.subs[sq.id] = { status: 'done', progress: sq.objectives.map(() => ({ n: 0, list: [], done: true, day: 0 })) };
    }
    for (const quest of [...MAIN_QUESTS, ...SUB_QUESTS]) {
      for (const f of quest.rewards?.flags || []) s.flags[f] = true;
    }
    updateDecorations(s.flags);
    s.rank = RANKS.length - 1;
    EventBus.emit('rank');
    EventBus.emit('quests');
  },

  apply() {
    const s = G.state;
    this.completeQuests();

    for (const id of GEAR_ORDER) {
      GearSystem.add(id);
      s.gear.enhance[id] = MAX_ENHANCE;
    }
    for (const k of TOOL_ORDER) GearSystem.equipBest(k);
    EventBus.emit('gear');

    for (const id of Object.keys(CLOTHES)) OutfitSystem.addClothes(id);
    for (const id of FINAL_SET) OutfitSystem.equip(id);

    FarmSystem.expand(FARM_MAX);

    s.player.money += MONEY_CHEAT;
    EventBus.emit('money');

    StaminaSystem.fill();
    AudioManager.sfx('fanfare');
    sparkle(G.refs.player.pos);
    banner('🧑‍🌾 FARMER 치트 발동!', `모든 퀘스트 완료 · ${RANKS[s.rank].name} 임명 · 모든 장비 +${MAX_ENHANCE} · 모든 옷 · 밭 ${FARM_MAX}x${FARM_MAX} · +${MONEY_CHEAT.toLocaleString()}원`);
    saveGame();
  },
};
