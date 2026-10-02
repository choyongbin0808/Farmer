import { G, FARM_MAX, MONEY_CHEAT } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { AudioManager } from '../core/AudioManager.js';
import { saveGame } from '../core/SaveManager.js';
import { TOOL_ORDER, MAX_TOOL_LEVEL } from '../data/tools.js';
import { CLOTHES } from '../data/clothes.js';
import { OutfitSystem } from './OutfitSystem.js';
import { StaminaSystem } from './StaminaSystem.js';
import { FarmSystem } from './FarmSystem.js';
import { sparkle } from '../world/Effects.js';
import { banner } from '../ui/HUD.js';

const CODE = 'farmers';
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

  apply() {
    const s = G.state;
    for (const k of TOOL_ORDER) s.tools[k] = MAX_TOOL_LEVEL;
    EventBus.emit('upgrade');

    for (const id of Object.keys(CLOTHES)) OutfitSystem.addClothes(id);
    for (const id of FINAL_SET) OutfitSystem.equip(id);

    FarmSystem.expand(FARM_MAX);

    s.player.money += MONEY_CHEAT;
    EventBus.emit('money');

    StaminaSystem.fill();
    AudioManager.sfx('fanfare');
    sparkle(G.refs.player.pos);
    banner('🧑‍🌾 FARMERS 치트 발동!', `무지개 농기구 · 모든 옷 · 밭 ${FARM_MAX}x${FARM_MAX} · +${MONEY_CHEAT.toLocaleString()}원`);
    saveGame();
  },
};
