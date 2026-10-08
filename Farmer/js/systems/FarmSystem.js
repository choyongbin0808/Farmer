import { G, FARM_MAX, HOTBAR_SIZE } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { AudioManager } from '../core/AudioManager.js';
import { CROPS } from '../data/crops.js';
import { TOOLS, rollHarvest } from '../data/tools.js';
import { getItem } from '../data/items.js';
import { InventorySystem } from './InventorySystem.js';
import { GearSystem } from './GearSystem.js';
import { StorageSystem } from './StorageSystem.js';
import { StaminaSystem } from './StaminaSystem.js';
import { burst, flyToStorage } from '../world/Effects.js';
import { setFarmFence, farmCenter } from '../world/World.js';
import { toast } from '../ui/HUD.js';

/** 다음 크기로 넓힐 때의 가격 (key = 넓힌 뒤 한 변의 칸 수) */
export const EXPAND_COSTS = { 4: 800, 5: 2000, 6: 4000, 7: 7000, 8: 12000 };

function plots() {
  return G.refs.plots;
}

export const FarmSystem = {
  /** 물을 줘야 하는 밭인지 (갈았거나 심었고, 아직 물을 안 줬고, 다 자라지 않음) */
  needsWater(p) {
    return p.data.state !== 'empty' && !p.data.watered && !p.isReady();
  },

  /**
   * 밭 상태(+ 핫바에서 고른 씨앗·특별 아이템)에 따라 할 작업을 고른다. 농기구는 장착한 장비를 자동으로 쓴다.
   *  다 자람 → 수확(낫) · 성장 아이템을 들고 자라는 작물 → 사용 · 빈 땅 → 갈기(호미)
   *  물 안 준 땅 → 물 주기(물뿌리개) · 갈고 물 준 땅 + 씨앗 → 심기 · 물 준 자라는 작물 → 정보
   *  씨앗은 갈고 물까지 준 땅에만 심을 수 있다.
   */
  actionFor(plot) {
    if (!plot?.active) return null;
    const d = plot.data;
    const held = InventorySystem.getHeld();
    const item = held?.item;
    if (plot.isReady()) return { kind: 'harvest' };
    if (item?.type === 'special' && d.state === 'planted') return { kind: 'fertilize', held };
    if (d.state === 'empty') return { kind: 'till' };
    if (this.needsWater(plot)) return { kind: 'water' };
    if (d.state === 'tilled' && item?.type === 'seed') return { kind: 'plant', held };
    if (d.state === 'planted') return { kind: 'info' };
    return { kind: 'needSeed' };
  },

  /** 마우스를 올렸을 때 강조할 밭 목록과 상태 (모든 작업은 1칸) */
  preview(plot) {
    const a = this.actionFor(plot);
    if (!a) return null;
    if (a.kind === 'plant') {
      const cropId = a.held.item.cropId;
      return { plots: [plot], ok: StaminaSystem.canPlant(cropId), cost: StaminaSystem.plantCost(cropId) };
    }
    return { plots: [plot], ok: a.kind !== 'needSeed' };
  },

  /** 자라는 중인 밭을 눌렀을 때 작업 대신 작물 정보를 보여 줄지 */
  showsInfo(plot) {
    return this.actionFor(plot)?.kind === 'info';
  },

  usePlot(plot) {
    if (!plot.active) return;
    if (G.refs.player.work) return;
    const a = this.actionFor(plot);
    if (!a) return;
    if (a.kind === 'harvest') return this.harvest(plot);
    if (a.kind === 'till') return this.till(plot);
    if (a.kind === 'water') return this.water(plot);
    if (a.kind === 'plant') return this.plant(plot, a.held);
    if (a.kind === 'fertilize') return this.fertilize(plot, a.held);
    if (a.kind === 'needSeed') toast(`🌱 핫바(1~${HOTBAR_SIZE})에서 심을 씨앗을 골라 주세요`);
  },

  /** 작업하는 동안 손에 드는 농기구 (무지개 등급 일부는 농기계에 올라탄다) */
  toolProp(kind) {
    return { item: getItem(TOOLS[kind].itemId), color: GearSystem.stats(kind).color, vehicle: GearSystem.equipped(kind).vehicle ?? null };
  },

  till(plot) {
    if (plot.data.state !== 'empty') return;
    G.refs.player.faceTo(plot.x, plot.z);
    G.refs.player.startWork(GearSystem.stats('hoe').time, () => {
      if (plot.data.state !== 'empty') return;
      plot.data.state = 'tilled';
      plot.refresh();
      burst({ x: plot.x, z: plot.z }, { color: 0x8b5a3c });
      AudioManager.sfx('till');
      EventBus.emit('till', 1);
    }, 'till', this.toolProp('hoe'));
  },

  water(plot) {
    if (!this.needsWater(plot)) return;
    G.refs.player.faceTo(plot.x, plot.z);
    G.refs.player.startWork(GearSystem.stats('can').time, () => {
      if (!this.needsWater(plot)) return;
      plot.data.watered = true;
      plot.refresh();
      burst({ x: plot.x, z: plot.z }, { color: 0x6fc3ff, count: 18, up: 2.5 });
      AudioManager.sfx('water');
      EventBus.emit('water', 1);
    }, 'water', this.toolProp('can'));
  },

  plant(plot, held) {
    const d = plot.data;
    const cropId = held.item.cropId;
    if (d.state === 'empty') return toast('먼저 호미로 땅을 갈아 주세요');
    if (d.state === 'planted') return toast('이미 작물이 심어져 있어요');
    if (!d.watered) return toast('💧 먼저 물을 줘야 씨앗을 심을 수 있어요');
    const cost = StaminaSystem.plantCost(cropId);
    if (!StaminaSystem.canPlant(cropId)) {
      AudioManager.sfx('error');
      toast('너무 피곤해요… 잠을 자거나 음식을 먹고 쉬어 가요 😴', 'warn');
      return;
    }
    G.refs.player.faceTo(plot.x, plot.z);
    G.refs.player.startWork(0.45, () => {
      if (plot.data.state !== 'tilled' || !plot.data.watered || !InventorySystem.removeFromSlot(held.area, held.index, 1)) return;
      StaminaSystem.spend(cost);
      d.state = 'planted';
      d.cropId = cropId;
      d.daysGrown = 0;
      d.plantedDay = G.state.time.day;
      plot.refresh();
      burst({ x: plot.x, z: plot.z }, { color: 0xd9b47a, count: 10, up: 1.5 });
      AudioManager.sfx('plant');
      EventBus.emit('plant', cropId);
    }, 'plant', { item: held.item });
  },

  /** 성장 아이템(비료 · 성장 촉진제): item.growDays 만큼 성장, 'all'이면 바로 다 자람 */
  fertilize(plot, held) {
    const d = plot.data;
    const item = held.item;
    if (d.state !== 'planted' || plot.isReady()) return toast('자라고 있는 작물에만 쓸 수 있어요');
    InventorySystem.removeFromSlot(held.area, held.index, 1);
    const days = CROPS[d.cropId].days;
    d.daysGrown = item.growDays === 'all' ? days : Math.min(days, d.daysGrown + (item.growDays ?? 1));
    plot.refresh();
    burst({ x: plot.x, z: plot.z }, { color: 0x9be36a, count: 24, up: 3 });
    AudioManager.sfx('plant');
    toast(plot.isReady() ? `${item.icon} ${CROPS[d.cropId].name}이(가) 다 자랐어요! 바로 수확할 수 있어요` : `${item.icon} ${item.name} 덕분에 작물이 쑥 자랐어요!`, 'good');
  },

  harvest(plot) {
    const st = GearSystem.stats('sickle');
    G.refs.player.faceTo(plot.x, plot.z);
    G.refs.player.startWork(st.time, () => {
      const d = plot.data;
      if (!plot.isReady()) return;
      const cropId = d.cropId;
      const amount = rollHarvest(st.harvest);
      StorageSystem.add('crop_' + cropId, amount);
      G.state.stats.totalHarvest += amount;
      G.state.stats.todayHarvest += amount;
      // 수확한 땅은 굳어서 다시 호미로 갈아야 함
      d.state = 'empty';
      d.cropId = null;
      d.daysGrown = 0;
      d.watered = false;
      plot.refresh();
      flyToStorage(cropId, plot, amount);
      AudioManager.sfx('harvest');
      toast(`${CROPS[cropId].icon} +${amount} ${CROPS[cropId].name} → 창고`);
      EventBus.emit('harvest', { cropId, amount });
    }, 'harvest', this.toolProp('sickle'));
  },

  /** 잠자고 일어날 때: 물 준 작물 성장 */
  growAll() {
    for (const p of plots()) {
      const d = p.data;
      if (d.state === 'planted' && d.watered && d.daysGrown < CROPS[d.cropId].days) d.daysGrown++;
      d.watered = false;
    }
  },

  waterAllByRain() {
    for (const p of plots()) {
      if (p.active && p.data.state !== 'empty') p.data.watered = true;
    }
  },

  refreshAll() {
    setFarmFence(G.state.farm.size);
    for (const p of plots()) p.refresh();
  },

  plantedCount() {
    return plots().filter((p) => p.active && p.data.state === 'planted').length;
  },

  expand(size) {
    size = Math.min(size, FARM_MAX);
    if (G.state.farm.size >= size) return false;
    G.state.farm.size = size;
    this.refreshAll();
    const c = farmCenter(size);
    burst({ x: c.x, z: c.z }, { color: 0x9be36a, count: 60, speed: 5, up: 4, life: 1.2 });
    toast(`🌾 밭과 울타리가 ${size}x${size}(${size * size}칸)로 넓어졌어요!`, 'good');
    EventBus.emit('farmExpand', size);
    return true;
  },

  /** 다음 확장 정보: { size, cost } 또는 최대면 null */
  nextExpand() {
    const size = G.state.farm.size + 1;
    return size <= FARM_MAX ? { size, cost: EXPAND_COSTS[size] } : null;
  },

  buyExpand() {
    const next = this.nextExpand();
    if (!next) return toast('밭이 이미 최대 크기예요');
    if (G.state.player.money < next.cost) {
      AudioManager.sfx('error');
      return toast('돈이 부족해요', 'warn');
    }
    G.state.player.money -= next.cost;
    AudioManager.sfx('anvil');
    this.expand(next.size);
    EventBus.emit('money');
  },
};
