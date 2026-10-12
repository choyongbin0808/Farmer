import { G } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';

/**
 * 지하 작업실의 일반 흙 상자 3개 (상자마다 50개까지).
 * 상점에서 산 일반 흙은 가방 대신 여기로 바로 들어가고, 약탕기 제작에 그대로 쓰인다.
 * state.soilBoxes = [n, n, n]
 */
export const SOIL_ID = 'soil_plain';
export const SOIL_BOX_CAP = 50;
export const SOIL_BOX_COUNT = 3;

function boxes() {
  const s = G.state;
  if (!Array.isArray(s.soilBoxes)) s.soilBoxes = Array(SOIL_BOX_COUNT).fill(0);
  while (s.soilBoxes.length < SOIL_BOX_COUNT) s.soilBoxes.push(0);
  return s.soilBoxes;
}

export const SoilBoxSystem = {
  boxes,

  total() {
    return boxes().reduce((a, b) => a + b, 0);
  },

  capacity() {
    return SOIL_BOX_CAP * SOIL_BOX_COUNT;
  },

  free() {
    return this.capacity() - this.total();
  },

  /** 앞 상자부터 채운다. 실제로 넣은 개수 */
  add(n) {
    const b = boxes();
    let left = Math.max(0, Math.floor(n));
    for (let i = 0; i < b.length && left > 0; i++) {
      const k = Math.min(SOIL_BOX_CAP - b[i], left);
      b[i] += k;
      left -= k;
    }
    const added = n - left;
    if (added) EventBus.emit('soil');
    return added;
  },

  /** 뒤 상자부터 꺼낸다 (앞 상자가 늘 가득 차 보이게). 실제로 꺼낸 개수 */
  take(n) {
    const b = boxes();
    let left = Math.max(0, Math.floor(n));
    for (let i = b.length - 1; i >= 0 && left > 0; i--) {
      const k = Math.min(b[i], left);
      b[i] -= k;
      left -= k;
    }
    const taken = n - left;
    if (taken) EventBus.emit('soil');
    return taken;
  },
};
