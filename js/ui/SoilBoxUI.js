import { EventBus } from '../core/EventBus.js';
import { AudioManager } from '../core/AudioManager.js';
import { SoilBoxSystem, SOIL_ID, SOIL_BOX_CAP } from '../systems/SoilBoxSystem.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { openModal, refreshModal } from './Panels.js';
import { toast } from './HUD.js';

/** 지하 작업실 일반 흙 상자 3개 — 얼마나 찼는지 보고, 가방에 든 일반 흙을 넣을 수 있다 */
function render(body) {
  const boxes = SoilBoxSystem.boxes();
  const bag = InventorySystem.count(SOIL_ID);
  body.innerHTML = `
    <div class="shop-top"><span>🪣 상점에서 산 일반 흙은 이 상자들로 바로 들어와요. 약탕기로 토양 흙을 만들 때 여기 흙을 그대로 써요.</span>
      <span class="money">모두 <b>${SoilBoxSystem.total()} / ${SoilBoxSystem.capacity()}</b></span></div>
    <div class="soil-boxes">${boxes.map((n, i) => `
      <div class="soil-box ${n >= SOIL_BOX_CAP ? 'full' : n ? '' : 'empty'}">
        <div class="sb-crate"><i style="height:${(n / SOIL_BOX_CAP) * 100}%"></i></div>
        <b>${i + 1}번 상자</b><small>${n} / ${SOIL_BOX_CAP}${n >= SOIL_BOX_CAP ? ' · 가득!' : ''}</small>
      </div>`).join('')}</div>
    <div class="fac-foot">
      <button class="btn small primary" data-act="put" ${bag && SoilBoxSystem.free() ? '' : 'disabled'}>🎒 가방의 일반 흙 넣기 (${bag}개)</button>
      <small>상자 하나에 ${SOIL_BOX_CAP}개씩, 모두 ${SoilBoxSystem.capacity()}개까지 · 앞 상자부터 채우고 뒤 상자부터 써요</small>
    </div>`;
  body.querySelector('[data-act="put"]').addEventListener('click', () => {
    const k = Math.min(InventorySystem.count(SOIL_ID), SoilBoxSystem.free());
    if (k <= 0) return;
    InventorySystem.remove(SOIL_ID, k);
    SoilBoxSystem.add(k);
    AudioManager.sfx('click');
    toast(`🪣 일반 흙 ${k}개를 상자에 넣었어요`, 'good');
    EventBus.emit('inventory');
  });
}

export const SoilBoxUI = {
  open() {
    openModal('soilbox', '🪣 일반 흙 상자', render, { wide: true });
  },
  init() {
    for (const evt of ['soil', 'inventory']) EventBus.on(evt, () => refreshModal('soilbox'));
  },
};
