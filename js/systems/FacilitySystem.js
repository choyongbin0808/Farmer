import { G, absMinutes, currentZone, GAME_MIN_PER_SEC } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { AudioManager } from '../core/AudioManager.js';
import { saveGame } from '../core/SaveManager.js';
import { FACILITIES, MAX_BATCH, BREW_RECIPE, BREW_OUTPUT } from '../data/facilities.js';
import { CROPS } from '../data/crops.js';
import { getItem } from '../data/items.js';
import { InventorySystem } from './InventorySystem.js';
import { StorageSystem } from './StorageSystem.js';
import { SoilBoxSystem, SOIL_ID } from './SoilBoxSystem.js';
import { interactables, facilityColliders } from '../world/World.js';
import { cellarSlot, updateCellarSlots, CELLAR_SLOT_COUNT } from '../world/Interiors.js';
import { makeBrewer, makeNursery } from '../world/ExtraModels.js';
import { burst, sparkle } from '../world/Effects.js';
import { addTagSource } from '../ui/WorldMarkers.js';
import { toast } from '../ui/HUD.js';

/**
 * 시설 (약탕기 · 육묘장) — 우리 집 지하 작업실의 정해진 자리에 놓인다.
 * 상점에서 사면 빈 자리에 바로 설치된다 (종류별 3칸).
 * state.facilities[i] = { kind, slot, x, z, rot, job: { out, n, start, doneAt } | null }
 */

let scene = null;
const built = [];

/** 초 → '20초' · '1분 40초' */
export function durationText(sec) {
  const s = Math.max(0, Math.ceil(sec));
  if (s < 60) return `${s}초`;
  return `${Math.floor(s / 60)}분${s % 60 ? ` ${s % 60}초` : ''}`;
} // state.facilities 와 같은 순서: { group, collider }

function makeModel(kind) {
  return kind === 'brewer' ? makeBrewer() : makeNursery();
}

function rectOf(kind, x, z) {
  const f = FACILITIES[kind];
  return { minX: x - f.w / 2, maxX: x + f.w / 2, minZ: z - f.d / 2, maxZ: z + f.d / 2 };
}

/** 종류별 비어 있는 첫 자리 (없으면 -1) */
function freeSlot(kind) {
  const used = new Set(G.state.facilities.filter((f) => f.kind === kind).map((f) => f.slot));
  for (let i = 0; i < CELLAR_SLOT_COUNT[kind]; i++) if (!used.has(i)) return i;
  return -1;
}

function install(kind, slot, job = null) {
  const p = cellarSlot(kind, slot);
  const f = { kind, slot, x: p.x, z: p.z, rot: 0, job };
  G.state.facilities.push(f);
  return f;
}

export const FacilitySystem = {
  init(s) {
    scene = s;
    addTagSource(() => {
      if (currentZone() !== 'cellar' || !G.state) return [];
      const out = [];
      G.state.facilities.forEach((f, i) => {
        const st = this.status(i);
        if (st === 'idle') return;
        const y = f.kind === 'brewer' ? 3.0 : 2.0;
        if (st === 'done') out.push({ key: `fac${i}`, text: `✅ ${getItem(f.job.out).name} 완성!`, x: f.x, y, z: f.z, cls: 'done' });
        else out.push({ key: `fac${i}`, text: `${f.kind === 'brewer' ? '♨️' : '🌱'} ${this.leftText(i)}`, x: f.x, y, z: f.z, cls: 'work' });
      });
      return out;
    });
  },

  /**
   * 예전 세이브 정리: 마을에 놓았던 시설 · 가방에 있던 시설 아이템을 지하 작업실 자리로 옮긴다.
   * (진행 중이던 작업은 그대로 이어진다. 자리가 모자라면 산 값을 돌려준다)
   */
  normalize() {
    const s = G.state;
    const old = s.facilities || [];
    s.facilities = [];
    let refund = 0;
    const place = (kind, job = null) => {
      const slot = freeSlot(kind);
      if (slot < 0) { refund += FACILITIES[kind].price; return; }
      install(kind, slot, job);
    };
    // 자리를 이미 가진 시설부터 (그대로 유지)
    for (const f of old) {
      if (Number.isInteger(f.slot) && f.slot < CELLAR_SLOT_COUNT[f.kind] && !s.facilities.some((g) => g.kind === f.kind && g.slot === f.slot)) {
        install(f.kind, f.slot, f.job ?? null);
        f.done = true;
      }
    }
    for (const f of old) if (!f.done && FACILITIES[f.kind]) place(f.kind, f.job ?? null);
    for (const kind of Object.keys(FACILITIES)) {
      const id = FACILITIES[kind].itemId;
      const n = InventorySystem.countAll(id);
      if (n > 0) {
        InventorySystem.consumeAll(id, n);
        for (let i = 0; i < n; i++) place(kind);
      }
    }
    if (refund) {
      s.player.money += refund;
      setTimeout(() => toast(`🏡 지하 작업실 자리가 모자라 남는 시설 값 ${refund.toLocaleString()}원을 돌려받았어요`, 'good'), 1500);
    }
    // 가방 · 창고에 있던 일반 흙은 지하 흙 상자로 옮긴다 (상자에 들어가는 만큼)
    const moveIn = (have, take) => {
      const k = Math.min(have, SoilBoxSystem.free());
      if (k > 0) {
        take(k);
        SoilBoxSystem.add(k);
      }
    };
    moveIn(InventorySystem.count(SOIL_ID), (k) => InventorySystem.remove(SOIL_ID, k));
    moveIn(StorageSystem.count(SOIL_ID), (k) => StorageSystem.remove(SOIL_ID, k));
  },

  // ─── 3D 모델 ───
  /** state.facilities 에 맞춰 모델·충돌체를 모두 다시 만든다 */
  refreshAll() {
    for (const b of built) {
      scene.remove(b.group);
      const i = interactables.indexOf(b.group);
      if (i >= 0) interactables.splice(i, 1);
    }
    built.length = 0;
    facilityColliders.length = 0;
    G.state.facilities.forEach((f, index) => {
      const group = makeModel(f.kind);
      group.position.set(f.x, 0, f.z);
      group.userData = { ...group.userData, type: 'facility', index };
      group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      scene.add(group);
      interactables.push(group);
      const r = rectOf(f.kind, f.x, f.z);
      const collider = { minX: r.minX + 0.1, maxX: r.maxX - 0.1, minZ: r.minZ + 0.1, maxZ: r.maxZ - 0.1 };
      facilityColliders.push(collider);
      built.push({ group, collider });
    });
    updateCellarSlots(G.state.facilities);
  },

  /** 약탕기 김 · 불씨 애니메이션 */
  animate(t) {
    built.forEach((b, i) => {
      const anim = b.group.userData.anim;
      if (!anim) return;
      const on = this.status(i) === 'working';
      anim.fire.visible = on;
      anim.steam.forEach((p, k) => {
        p.visible = on;
        if (!on) return;
        const u = (t * 0.5 + k / anim.steam.length) % 1;
        p.position.set(Math.sin(u * 6 + k) * 0.15, 1.9 + u * 1.4, Math.cos(u * 5 + k) * 0.1);
        p.scale.setScalar(0.6 + u * 1.4);
        p.material.opacity = 0.5 * (1 - u);
      });
    });
  },

  // ─── 구매 = 지하 작업실에 바로 설치 ───
  ownedCount(kind) {
    return G.state.facilities.filter((f) => f.kind === kind).length;
  },

  buy(kind) {
    const def = FACILITIES[kind];
    const slot = freeSlot(kind);
    if (slot < 0 || this.ownedCount(kind) >= def.max) return toast(`${def.name}은(는) 지하 작업실에 ${def.max}개까지 놓을 수 있어요`, 'warn');
    if (G.state.player.money < def.price) {
      AudioManager.sfx('error');
      return toast('돈이 부족해요', 'warn');
    }
    G.state.player.money -= def.price;
    const f = install(kind, slot);
    this.refreshAll();
    AudioManager.sfx('anvil');
    if (currentZone() === 'cellar') burst({ x: f.x, z: f.z }, { color: 0xd9b47a, count: 30, speed: 3, up: 2.5 });
    toast(`${def.icon} ${def.name}을(를) 우리 집 지하 작업실 ${slot + 1}번 자리에 설치했어요!`, 'good');
    EventBus.emit('money');
    EventBus.emit('facility');
    saveGame();
    return true;
  },

  // ─── 작업 (달이기 · 모종 키우기) ───
  status(i) {
    const job = G.state.facilities[i]?.job;
    if (!job) return 'idle';
    return absMinutes() >= job.doneAt ? 'done' : 'working';
  },

  /** 남은 실제 시간(초) — 작업은 게임 시간으로 저장되어 있다 */
  leftSeconds(i) {
    const job = G.state.facilities[i]?.job;
    return job ? Math.max(0, Math.ceil((job.doneAt - absMinutes()) / GAME_MIN_PER_SEC)) : 0;
  },

  leftText(i) {
    return durationText(this.leftSeconds(i));
  },

  /** kind 시설로 n개 만드는 데 걸리는 실제 시간(초) */
  jobSeconds(kind, n) {
    return FACILITIES[kind].seconds * Math.max(1, n);
  },

  progress(i) {
    const job = G.state.facilities[i]?.job;
    if (!job) return 0;
    return Math.min(1, (absMinutes() - job.start) / (job.doneAt - job.start || 1));
  },

  /** 약탕기로 지금 재료로 만들 수 있는 최대 개수 */
  brewMax() {
    let n = MAX_BATCH;
    for (const [id, need] of Object.entries(BREW_RECIPE)) n = Math.min(n, Math.floor(InventorySystem.countAll(id) / need));
    return Math.max(0, n);
  },

  startBrew(i, n) {
    const f = G.state.facilities[i];
    n = Math.min(n, this.brewMax());
    if (!f || f.job || n <= 0) return;
    for (const [id, need] of Object.entries(BREW_RECIPE)) InventorySystem.consumeAll(id, need * n);
    this.startJob(f, BREW_OUTPUT, n);
    AudioManager.sfx('brew');
    toast(`🍲 토양 흙 ${n}개를 달이기 시작했어요 (${this.leftText(i)})`, 'good');
  },

  /** 육묘장에 넣을 수 있는 씨앗 목록 (모종 말고 일반 씨앗 · 가방 + 창고) */
  nurserySeeds() {
    return Object.keys(CROPS).map((cropId) => ({ cropId, id: 'seed_' + cropId, n: InventorySystem.countAll('seed_' + cropId) })).filter((e) => e.n > 0);
  },

  nurseryMax(seedId) {
    return Math.max(0, Math.min(MAX_BATCH, InventorySystem.countAll(seedId), InventorySystem.countAll('soil_rich')));
  },

  startNursery(i, seedId, n) {
    const f = G.state.facilities[i];
    n = Math.min(n, this.nurseryMax(seedId));
    if (!f || f.job || n <= 0) return;
    const cropId = getItem(seedId).cropId;
    InventorySystem.consumeAll(seedId, n);
    InventorySystem.consumeAll('soil_rich', n);
    this.startJob(f, 'sapling_' + cropId, n);
    AudioManager.sfx('plant');
    toast(`🌱 ${CROPS[cropId].name} 모종 ${n}개를 키우기 시작했어요 (${this.leftText(i)})`, 'good');
  },

  startJob(f, out, n) {
    const now = absMinutes();
    // 실제 시간(초) → 게임 시간(분): 1초 = GAME_MIN_PER_SEC 분
    f.job = { out, n, start: now, doneAt: now + this.jobSeconds(f.kind, n) * GAME_MIN_PER_SEC };
    EventBus.emit('facility');
    saveGame();
  },

  collect(i) {
    const f = G.state.facilities[i];
    if (this.status(i) !== 'done') return;
    const { out, n } = f.job;
    f.job = null;
    const stored = InventorySystem.addOrStore(out, n);
    AudioManager.sfx('harvest');
    sparkle({ x: f.x, z: f.z });
    const it = getItem(out);
    toast(`${it.subIcon || it.icon} ${it.name} ${n}개를 꺼냈어요!${stored ? ` (가방이 가득 차 ${stored}개는 창고로)` : ''}`, 'good');
    EventBus.emit('facility');
    saveGame();
  },

  /** 상호작용 거리 계산용 반지름 */
  reach(i) {
    const f = G.state.facilities[i];
    const def = FACILITIES[f.kind];
    return Math.max(def.w, def.d) / 2 + 1.4;
  },
};
