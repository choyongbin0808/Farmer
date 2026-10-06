import { G, BAG_AREAS } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { getItem } from '../data/items.js';
import { StorageSystem } from './StorageSystem.js';

/** 아이템이 들어갈 가방 칸(탭) */
export function bagAreaOf(id) {
  const type = getItem(id)?.type;
  return type === 'seed' || type === 'crop' || type === 'food' ? type : 'misc';
}

function arr(area) {
  return area === 'hotbar' ? G.state.hotbar : G.state.bag[area];
}

const ALL_AREAS = [...BAG_AREAS, 'hotbar'];

export const InventorySystem = {
  slots: arr,

  getHeld() {
    const h = G.ui.held;
    if (!h) return null;
    const slot = arr(h.area)?.[h.index];
    if (!slot) return null;
    return { slot, item: getItem(slot.id), area: h.area, index: h.index };
  },

  getHeldItem() {
    return this.getHeld()?.item || null;
  },

  select(area, index) {
    G.ui.held = { area, index };
    EventBus.emit('held');
  },

  canAdd(id, n) {
    const item = getItem(id);
    const max = item.stack || 99;
    let room = 0;
    for (const a of ['hotbar', bagAreaOf(id)]) {
      for (const s of arr(a)) {
        if (!s) room += max;
        else if (s.id === id) room += max - s.n;
      }
    }
    return room >= n;
  },

  /** 남은 개수 반환 (0이면 모두 들어감). 같은 아이템 칸에 먼저 쌓고, 빈 칸은 종류별 가방 칸 → 핫바 순 */
  add(id, n) {
    const item = getItem(id);
    const max = item.stack || 99;
    const area = bagAreaOf(id);
    let left = n;
    for (const a of ['hotbar', area]) {
      for (const s of arr(a)) {
        if (left <= 0) break;
        if (s && s.id === id && s.n < max) {
          const k = Math.min(max - s.n, left);
          s.n += k;
          left -= k;
        }
      }
    }
    for (const a of [area, 'hotbar']) {
      const list = arr(a);
      for (let i = 0; i < list.length && left > 0; i++) {
        if (!list[i]) {
          const k = Math.min(max, left);
          list[i] = { id, n: k };
          left -= k;
        }
      }
    }
    EventBus.emit('inventory');
    return left;
  },

  count(id) {
    let n = 0;
    for (const a of ALL_AREAS) for (const s of arr(a)) if (s && s.id === id) n += s.n;
    return n;
  },

  /** 인벤토리(가방 → 핫바 순)에서 제거, 실제로 제거한 개수 반환 */
  remove(id, n) {
    let left = n;
    for (const a of ALL_AREAS) {
      const list = arr(a);
      for (let i = 0; i < list.length && left > 0; i++) {
        const s = list[i];
        if (s && s.id === id) {
          const k = Math.min(s.n, left);
          s.n -= k;
          left -= k;
          if (s.n <= 0) list[i] = null;
        }
      }
    }
    EventBus.emit('inventory');
    return n - left;
  },

  removeFromSlot(area, index, n = 1) {
    const list = arr(area);
    const s = list[index];
    if (!s) return 0;
    const k = Math.min(n, s.n);
    s.n -= k;
    if (s.n <= 0) list[index] = null;
    EventBus.emit('inventory');
    return k;
  },

  /** 이 칸에 이 아이템을 둘 수 있는지 (핫바는 아무거나, 가방은 종류가 맞는 탭만) */
  fits(area, slot) {
    return !slot || area === 'hotbar' || bagAreaOf(slot.id) === area;
  },

  /** 두 칸 교환. 종류가 맞지 않는 가방 칸으로는 옮기지 않음 → false */
  swap(aArea, ai, bArea, bi) {
    const a = arr(aArea), b = arr(bArea);
    if (!this.fits(bArea, a[ai]) || !this.fits(aArea, b[bi])) return false;
    const tmp = a[ai];
    a[ai] = b[bi];
    b[bi] = tmp;
    EventBus.emit('inventory');
    return true;
  },

  /** 인벤토리 + 창고 합계 (퀘스트 전달·판매용) */
  countAll(id) {
    return this.count(id) + StorageSystem.count(id);
  },

  /** 들고 있는 것(인벤토리) 먼저, 부족한 만큼 창고에서 차감 */
  consumeAll(id, n) {
    const fromInv = this.remove(id, n);
    if (fromInv < n) StorageSystem.remove(id, n - fromInv);
  },
};
