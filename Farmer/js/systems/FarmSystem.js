import { G, FARM_MAX } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { AudioManager } from '../core/AudioManager.js';
import { CROPS } from '../data/crops.js';
import { rangeOffsets, rollHarvest } from '../data/tools.js';
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

function plotAt(r, c) {
  const size = G.state.farm.size;
  if (r < 0 || c < 0 || r >= size || c >= size) return null;
  return plots().find((p) => p.r === r && p.c === c) || null;
}

export const FarmSystem = {
  /** 장비 범위('single' | 'row' | 'square')에 따른 작업 대상 밭 목록 */
  rangePlots(plot, range) {
    return rangeOffsets(range).map(([dr, dc]) => plotAt(plot.r + dr, plot.c + dc)).filter(Boolean);
  },

  /** 마우스를 올렸을 때 강조할 밭 목록과 상태 */
  preview(plot) {
    if (!plot?.active) return null;
    if (plot.isReady()) return { plots: [plot], ok: this.holdingSickle() };
    const item = InventorySystem.getHeldItem();
    if (item?.type === 'tool' && item.toolKind !== 'sickle') {
      return { plots: this.rangePlots(plot, GearSystem.stats(item.toolKind).range), ok: true };
    }
    if (item?.type === 'seed') {
      const ok = plot.data.state === 'tilled' && StaminaSystem.canPlant(item.cropId);
      return { plots: [plot], ok, cost: plot.data.state === 'tilled' ? StaminaSystem.plantCost(item.cropId) : 0 };
    }
    return { plots: [plot], ok: true };
  },

  /** 자라는 중인 밭을 눌렀을 때 작업 대신 작물 정보를 보여 줄지 */
  showsInfo(plot) {
    if (!plot.active || plot.data.state !== 'planted' || plot.isReady()) return false;
    const item = InventorySystem.getHeldItem();
    if (item?.type === 'special') return false;
    if (item?.type === 'tool' && item.toolKind === 'can') {
      const needWater = this.rangePlots(plot, GearSystem.stats('can').range).some((p) => p.data.state !== 'empty' && !p.data.watered && !p.isReady());
      return !needWater;
    }
    return true;
  },

  /** 수확은 낫 계열(낫 · 파종기)을 들고 있을 때만 */
  holdingSickle() {
    const item = InventorySystem.getHeldItem();
    return item?.type === 'tool' && item.toolKind === 'sickle';
  },

  needSickle() {
    AudioManager.sfx('error');
    toast(`${GearSystem.equipped('sickle').icon} ${GearSystem.equipped('sickle').name}을(를) 들어야 수확할 수 있어요 (핫바에서 선택)`, 'warn');
  },

  usePlot(plot) {
    if (!plot.active) return;
    const player = G.refs.player;
    if (player.work) return;
    if (plot.isReady()) return this.holdingSickle() ? this.harvest(plot) : this.needSickle();

    const held = InventorySystem.getHeld();
    const item = held?.item;
    if (!item) {
      toast('핫바(1~5)에서 도구나 씨앗을 골라 주세요');
      return;
    }
    if (item.type === 'tool') {
      if (item.toolKind === 'hoe') return this.till(plot);
      if (item.toolKind === 'can') return this.water(plot);
      toast(plot.data.state === 'planted' ? '아직 다 자라지 않았어요 🌱' : '수확할 작물이 없어요');
      return;
    }
    if (item.type === 'seed') return this.plant(plot, held);
    if (item.type === 'special') return this.fertilize(plot, held);
    if (item.type === 'food') return G.refs.eatHeld?.();
    toast('이 물건은 밭에 쓸 수 없어요');
  },

  till(plot) {
    const st = GearSystem.stats('hoe');
    const targets = this.rangePlots(plot, st.range).filter((p) => p.data.state === 'empty');
    if (!targets.length) {
      toast(plot.data.state === 'planted' ? '작물이 자라고 있어요' : '이미 갈린 땅이에요');
      return;
    }
    G.refs.player.faceTo(plot.x, plot.z);
    G.refs.player.startWork(st.time, () => {
      for (const p of targets) {
        p.data.state = 'tilled';
        p.refresh();
        burst({ x: p.x, z: p.z }, { color: 0x8b5a3c });
      }
      AudioManager.sfx('till');
      EventBus.emit('till', targets.length);
    }, 'till');
  },

  water(plot) {
    const st = GearSystem.stats('can');
    const targets = this.rangePlots(plot, st.range).filter((p) => p.data.state !== 'empty' && !p.data.watered && !p.isReady());
    if (!targets.length) {
      toast(plot.data.state === 'empty' ? '먼저 호미로 땅을 갈아 주세요' : '이미 물을 줬어요 💧');
      return;
    }
    G.refs.player.faceTo(plot.x, plot.z);
    G.refs.player.startWork(st.time, () => {
      for (const p of targets) {
        p.data.watered = true;
        p.refresh();
        burst({ x: p.x, z: p.z }, { color: 0x6fc3ff, count: 18, up: 2.5 });
      }
      AudioManager.sfx('water');
      EventBus.emit('water', targets.length);
    }, 'water');
  },

  plant(plot, held) {
    const d = plot.data;
    const cropId = held.item.cropId;
    if (d.state === 'empty') return toast('먼저 호미로 땅을 갈아 주세요');
    if (d.state === 'planted') return toast('이미 작물이 심어져 있어요');
    const cost = StaminaSystem.plantCost(cropId);
    if (!StaminaSystem.canPlant(cropId)) {
      AudioManager.sfx('error');
      toast('너무 피곤해요… 잠을 자거나 음식을 먹고 쉬어 가요 😴', 'warn');
      return;
    }
    G.refs.player.faceTo(plot.x, plot.z);
    G.refs.player.startWork(0.45, () => {
      if (plot.data.state !== 'tilled' || !InventorySystem.removeFromSlot(held.area, held.index, 1)) return;
      StaminaSystem.spend(cost);
      d.state = 'planted';
      d.cropId = cropId;
      d.daysGrown = 0;
      d.plantedDay = G.state.time.day;
      plot.refresh();
      burst({ x: plot.x, z: plot.z }, { color: 0xd9b47a, count: 10, up: 1.5 });
      AudioManager.sfx('plant');
      EventBus.emit('plant', cropId);
    }, 'plant');
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
    }, 'harvest');
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
