import { G, absMinutes } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { CROPS } from '../data/crops.js';
import { OutfitSystem } from './OutfitSystem.js';
import { InventorySystem } from './InventorySystem.js';
import { getItem } from '../data/items.js';
import { AudioManager } from '../core/AudioManager.js';
import { toast } from '../ui/HUD.js';

const REGEN_PER_HOUR = 2;
const REGEN_DELAY = 30; // 마지막으로 심은 뒤 게임 시간(분)

export const StaminaSystem = {
  max() {
    return OutfitSystem.maxStamina();
  },

  current() {
    return G.state.player.stamina;
  },

  plantCost(cropId) {
    const base = CROPS[cropId].staminaCost;
    const reduce = OutfitSystem.plantCostReduce();
    return Math.max(1, Math.round(base * (1 - reduce)));
  },

  canPlant(cropId) {
    return this.current() >= this.plantCost(cropId);
  },

  spend(n) {
    const p = G.state.player;
    p.stamina = Math.max(0, p.stamina - n);
    p.lastPlantAt = absMinutes();
    EventBus.emit('staminaFloat', -n);
  },

  recover(n) {
    const p = G.state.player;
    const before = p.stamina;
    p.stamina = Math.min(this.max(), p.stamina + n);
    const gained = Math.round(p.stamina - before);
    if (gained > 0) EventBus.emit('staminaFloat', gained);
    return gained;
  },

  fill() {
    G.state.player.stamina = this.max();
  },

  /** 슬롯의 음식 먹기 (꽃 세트 효과: 회복량 +50%) */
  eat(area, index) {
    const slot = InventorySystem.slots(area)[index];
    const item = slot && getItem(slot.id);
    if (!item || item.type !== 'food') return false;
    if (this.current() >= this.max()) {
      toast('체력이 이미 가득해요');
      return false;
    }
    const heal = Math.round(item.heal * (1 + OutfitSystem.foodHealBonus()));
    InventorySystem.removeFromSlot(area, index, 1);
    const gained = this.recover(heal);
    AudioManager.sfx('eat');
    toast(`${item.icon} ${item.name}을(를) 먹었어요. 체력 +${gained}`, 'good');
    return true;
  },

  /** 게임 시간 gameMinutes 만큼 흐를 때 자연 회복 */
  tick(gameMinutes) {
    const p = G.state.player;
    if (absMinutes() - p.lastPlantAt < REGEN_DELAY) return;
    p.stamina = Math.min(this.max(), p.stamina + (REGEN_PER_HOUR / 60) * gameMinutes);
  },
};
