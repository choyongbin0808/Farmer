import { G, RESIDENTS } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';

export const RelationSystem = {
  isResident(id) {
    return RESIDENTS.includes(id);
  },

  value(id) {
    return G.state.relations[id] ?? 0;
  },

  hearts(id) {
    return Math.min(5, Math.floor(this.value(id) / 20));
  },

  add(id, v) {
    if (!this.isResident(id)) return;
    const before = this.hearts(id);
    G.state.relations[id] = Math.min(100, this.value(id) + v);
    if (this.hearts(id) > before) EventBus.emit('heartUp', id);
    EventBus.emit('relation', id);
  },

  /** 하루 첫 대화면 +5, 첫 대화 여부 반환 */
  dailyTalk(id) {
    const t = G.state.talkedToday;
    if (t[id]) return false;
    t[id] = true;
    this.add(id, 5);
    return true;
  },

  countWithHearts(h) {
    return RESIDENTS.filter((id) => this.hearts(id) >= h).length;
  },
};
