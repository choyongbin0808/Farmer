import { G } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { AudioManager } from '../core/AudioManager.js';
import { TOOLS, TOOL_LEVELS, MAX_TOOL_LEVEL } from '../data/tools.js';
import { CLOTHES } from '../data/clothes.js';
import { ShopSystem } from './ShopSystem.js';
import { FarmSystem } from './FarmSystem.js';
import { toast } from '../ui/HUD.js';

export const ForgeSystem = {
  upgradeCost(kind) {
    const lv = G.state.tools[kind];
    if (lv >= MAX_TOOL_LEVEL) return null;
    const c = TOOL_LEVELS[lv + 1].cost;
    return G.state.flags.discount ? Math.round(c * 0.9) : c;
  },

  upgrade(kind) {
    const cost = this.upgradeCost(kind);
    if (cost === null) return;
    if (G.state.player.money < cost) {
      AudioManager.sfx('error');
      return toast('돈이 부족해요', 'warn');
    }
    G.state.player.money -= cost;
    G.state.tools[kind]++;
    const lv = G.state.tools[kind];
    AudioManager.sfx('anvil');
    toast(`🔨 ${TOOL_LEVELS[lv].name} ${TOOLS[kind].name}(으)로 강화했어요!`, 'good');
    EventBus.emit('upgrade', kind);
    EventBus.emit('money');
  },

  clothesList() {
    return Object.entries(CLOTHES).filter(([, c]) => c.shop === 'forge').map(([id, c]) => ({ id, ...c }));
  },

  buyCloth(id) {
    ShopSystem.buyCloth(id);
  },

  expandFarm() {
    FarmSystem.buyExpand();
  },
};
