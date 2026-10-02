import { G } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { getItem } from '../data/items.js';
import { InventorySystem } from './InventorySystem.js';
import { toast } from '../ui/HUD.js';

export const StorageSystem = {
  add(id, n) {
    const s = G.state.storage;
    s[id] = (s[id] || 0) + n;
    EventBus.emit('storage');
  },

  count(id) {
    return G.state.storage[id] || 0;
  },

  remove(id, n) {
    const s = G.state.storage;
    const k = Math.min(n, s[id] || 0);
    s[id] = (s[id] || 0) - k;
    if (s[id] <= 0) delete s[id];
    EventBus.emit('storage');
    return k;
  },

  entries() {
    return Object.entries(G.state.storage).filter(([, n]) => n > 0);
  },

  totalValue() {
    return this.entries().reduce((sum, [id, n]) => sum + getItem(id).price * n, 0);
  },

  /** 창고 → 인벤토리 */
  takeOut(id, n) {
    const k = Math.min(n, this.count(id));
    if (k <= 0) return;
    if (!InventorySystem.canAdd(id, k)) {
      toast('가방이 가득 찼어요', 'warn');
      return;
    }
    this.remove(id, k);
    InventorySystem.add(id, k);
  },

  /** 인벤토리 → 창고 (작물만) */
  putIn(id) {
    const item = getItem(id);
    if (item.type !== 'crop') return;
    const n = InventorySystem.count(id);
    InventorySystem.remove(id, n);
    this.add(id, n);
  },
};
