import { G } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { AudioManager } from '../core/AudioManager.js';
import { GEAR, TIERS, TOOL_ORDER, MAX_ENHANCE, gearStats, enhanceCost, startingGear } from '../data/tools.js';
import { RANKS } from '../data/ranks.js';
import { toast } from '../ui/HUD.js';

/**
 * 농기구 장비 시스템
 * - 종류(호미/물뿌리개/낫)마다 장비 하나를 장착하고, 핫바의 도구 아이템은 장착한 장비의 능력치를 따른다.
 * - 구매는 직책과 무관, 장착은 장비 등급 ≤ 현재 직책 단계일 때만 가능.
 * - 강화(+0 ~ +5)는 장비 아이템마다 따로 저장된다.
 */
export const GearSystem = {
  equippedId(kind) {
    return G.state.gear.equipped[kind] || startingGear(kind);
  },

  equipped(kind) {
    return GEAR[this.equippedId(kind)];
  },

  enhanceOf(id) {
    return G.state.gear.enhance[id] || 0;
  },

  statsOf(id) {
    return gearStats(id, this.enhanceOf(id));
  },

  /** 종류별로 장착 중인 장비의 실제 능력치 */
  stats(kind) {
    return this.statsOf(this.equippedId(kind));
  },

  /** 퀘스트용 '단계' = 장착한 장비 등급(낡은 1 ~ 무지개 6) */
  levelOf(kind) {
    return this.equipped(kind).tier + 1;
  },

  displayName(id) {
    const e = this.enhanceOf(id);
    return GEAR[id].name + (e ? ` +${e}` : '');
  },

  owns(id) {
    return G.state.gear.owned.includes(id);
  },

  isEquipped(id) {
    return this.equippedId(GEAR[id].kind) === id;
  },

  canEquip(id) {
    return G.state.rank >= GEAR[id].rank;
  },

  requiredRankName(id) {
    return RANKS[GEAR[id].rank].name;
  },

  ownedByKind(kind) {
    return G.state.gear.owned.filter((id) => GEAR[id].kind === kind).sort((a, b) => GEAR[a].tier - GEAR[b].tier);
  },

  add(id) {
    if (!this.owns(id)) G.state.gear.owned.push(id);
    EventBus.emit('gear');
  },

  equip(id, { silent = false } = {}) {
    const g = GEAR[id];
    if (!g || !this.owns(id)) return false;
    if (!this.canEquip(id)) {
      AudioManager.sfx('error');
      toast(`'${this.requiredRankName(id)}' 직책부터 착용할 수 있어요`, 'warn');
      return false;
    }
    if (this.isEquipped(id)) return true;
    G.state.gear.equipped[g.kind] = id;
    if (!silent) {
      AudioManager.sfx('click');
      toast(`${g.icon} ${this.displayName(id)}을(를) 장착했어요`);
    }
    EventBus.emit('gear', g.kind);
    return true;
  },

  /** 보유 중이면서 직책상 착용 가능한 가장 높은 등급의 장비를 장착 */
  equipBest(kind) {
    const best = this.ownedByKind(kind).filter((id) => this.canEquip(id)).pop();
    if (best) this.equip(best, { silent: true });
  },

  enhanceCost(id) {
    const c = enhanceCost(id, this.enhanceOf(id));
    if (c === null) return null;
    return G.state.flags.discount ? Math.round(c * 0.9) : c;
  },

  enhance(id) {
    if (!this.owns(id)) return;
    const cost = this.enhanceCost(id);
    if (cost === null) return toast('이미 최대 강화예요');
    if (G.state.player.money < cost) {
      AudioManager.sfx('error');
      return toast('돈이 부족해요', 'warn');
    }
    G.state.player.money -= cost;
    G.state.gear.enhance[id] = this.enhanceOf(id) + 1;
    AudioManager.sfx('anvil');
    toast(`🔨 ${this.displayName(id)}(으)로 강화했어요!`, 'good');
    EventBus.emit('gear', GEAR[id].kind);
    EventBus.emit('money');
  },

  /** 강화 단계가 level 이상인 장착 장비 수 (퀘스트용) */
  countEnhanced(level) {
    return TOOL_ORDER.filter((k) => this.enhanceOf(this.equippedId(k)) >= level).length;
  },

  /** 직책이 오르면 새로 착용 가능해진 보유 장비를 알려 준다 */
  init() {
    EventBus.on('rank', () => {
      const tier = TIERS[G.state.rank];
      if (!tier) return;
      const newly = G.state.gear.owned.filter((id) => GEAR[id].rank === G.state.rank);
      if (newly.length) toast(`🔧 이제 ${tier.name} 장비를 착용할 수 있어요! 가방의 '장비' 탭에서 장착하세요`, 'good');
    });
  },

  maxEnhance: MAX_ENHANCE,
};
