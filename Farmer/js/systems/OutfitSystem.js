import { G } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { CLOTHES, SETS, SLOTS } from '../data/clothes.js';
import { AudioManager } from '../core/AudioManager.js';
import { sparkle } from '../world/Effects.js';
import { toast } from '../ui/HUD.js';

export const BASE_STAMINA = 100;

export const OutfitSystem = {
  equipped() {
    const o = G.state.player.outfit;
    return { hat: o.hat && CLOTHES[o.hat], top: o.top && CLOTHES[o.top], bottom: o.bottom && CLOTHES[o.bottom] };
  },

  activeSetId() {
    const o = G.state.player.outfit;
    if (!o.hat || !o.top || !o.bottom) return null;
    const s = CLOTHES[o.hat].setId;
    return CLOTHES[o.top].setId === s && CLOTHES[o.bottom].setId === s ? s : null;
  },

  activeSet() {
    const id = this.activeSetId();
    return id ? SETS[id] : null;
  },

  /** 세트별로 착용 중인 부위 수 */
  setProgress(setId) {
    const o = G.state.player.outfit;
    return SLOTS.filter((s) => o[s] && CLOTHES[o[s]].setId === setId).length;
  },

  clothesStamina() {
    const e = this.equipped();
    return (e.hat?.stamina ?? 0) + (e.top?.stamina ?? 0) + (e.bottom?.stamina ?? 0);
  },

  setStamina() {
    return this.activeSet()?.bonus.stamina ?? 0;
  },

  maxStamina() {
    return BASE_STAMINA + this.clothesStamina() + this.setStamina();
  },

  plantCostReduce() {
    return this.activeSet()?.bonus.plantCostReduce ?? 0;
  },

  foodHealBonus() {
    return this.activeSet()?.bonus.foodHealBonus ?? 0;
  },

  owns(id) {
    return G.state.ownedClothes.includes(id);
  },

  addClothes(id) {
    if (!this.owns(id)) G.state.ownedClothes.push(id);
    EventBus.emit('outfit');
  },

  isWorn(id) {
    const c = CLOTHES[id];
    return !!c && G.state.player.outfit[c.slot] === id;
  },

  /** 상점·대장간에서 다시 살 수 있는 옷인지 (아니면 팔면 다시 못 얻는다) */
  canRebuy(id) {
    return !!CLOTHES[id]?.shop;
  },

  /** 판매가: 파는 옷은 구매가의 절반, 보상 옷은 최대 체력 보너스 × 20원 */
  sellPrice(id) {
    const c = CLOTHES[id];
    return c.price ? Math.floor(c.price / 2) : c.stamina * 20;
  },

  sell(id) {
    const c = CLOTHES[id];
    if (!c || !this.owns(id)) return false;
    if (this.isWorn(id)) {
      AudioManager.sfx('error');
      toast('입고 있는 옷은 팔 수 없어요', 'warn');
      return false;
    }
    const money = this.sellPrice(id);
    G.state.ownedClothes = G.state.ownedClothes.filter((o) => o !== id);
    G.state.player.money += money;
    AudioManager.sfx('coin');
    toast(`${c.icon} ${c.name}을(를) 팔았어요 (+${money.toLocaleString()}원)`, 'good');
    EventBus.emit('outfit');
    EventBus.emit('money');
    return true;
  },

  equip(id) {
    const c = CLOTHES[id];
    if (!c || !this.owns(id)) return;
    const before = this.activeSetId();
    G.state.player.outfit[c.slot] = id;
    this.afterChange(before);
  },

  unequip(slot) {
    const before = this.activeSetId();
    G.state.player.outfit[slot] = null;
    this.afterChange(before);
  },

  afterChange(beforeSet) {
    const p = G.state.player;
    p.stamina = Math.min(p.stamina, this.maxStamina());
    G.refs.player?.applyOutfit(p.outfit);
    const now = this.activeSetId();
    if (now && now !== beforeSet) {
      AudioManager.sfx('set');
      sparkle(G.refs.player.pos);
      toast(`${SETS[now].icon} ${SETS[now].name} 효과 발동! (${SETS[now].desc})`, 'good');
    }
    EventBus.emit('outfit');
  },
};
