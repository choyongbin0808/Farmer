import * as THREE from 'three';
import { G, absMinutes, currentZone } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { AudioManager } from '../core/AudioManager.js';
import { saveGame } from '../core/SaveManager.js';
import { FACILITIES, MAX_BATCH, BREW_RECIPE, BREW_OUTPUT } from '../data/facilities.js';
import { CROPS } from '../data/crops.js';
import { NPCS } from '../data/npcs.js';
import { getItem } from '../data/items.js';
import { InventorySystem } from './InventorySystem.js';
import { interactables, facilityColliders, placementBlocked, BUILDINGS, FARM_SIGN_POS, MINE_DOOR } from '../world/World.js';
import { makeBrewer, makeNursery } from '../world/ExtraModels.js';
import { burst, sparkle } from '../world/Effects.js';
import { addTagSource } from '../ui/WorldMarkers.js';
import { toast, setHint } from '../ui/HUD.js';

/**
 * 직접 배치하는 시설 (약탕기 · 육묘장)
 * state.facilities[i] = { kind, x, z, rot(0~3, 90도 단위), job: { out, n, start, doneAt } | null }
 * 사 두고 아직 배치하지 않은 시설은 가방 '시설' 칸의 아이템(fac_brewer · fac_nursery)
 */

let scene = null;
const built = []; // state.facilities 와 같은 순서: { group, collider }

function makeModel(kind) {
  return kind === 'brewer' ? makeBrewer() : makeNursery();
}

/** 90도 단위 회전에 따른 바닥 크기 */
function footprint(kind, rot) {
  const f = FACILITIES[kind];
  return rot % 2 ? { w: f.d, d: f.w } : { w: f.w, d: f.d };
}

function rectOf(kind, x, z, rot) {
  const { w, d } = footprint(kind, rot);
  return { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 };
}

/** 비워 둬야 하는 곳: 마을 주민 자리, 건물 출입구, 밭 팻말, 광산 입구 */
function keepClear() {
  const pts = Object.entries(NPCS).filter(([, n]) => !n.zone).map(([, n]) => ({ x: n.pos[0], z: n.pos[1] }));
  for (const b of Object.values(BUILDINGS)) pts.push({ x: b.ix, z: b.iz });
  pts.push(FARM_SIGN_POS, MINE_DOOR);
  return pts;
}

/** 배치 미리보기용 반투명 재질 */
function ghostify(group) {
  group.traverse((o) => {
    if (o.isMesh) {
      o.material = o.material.clone();
      o.material.transparent = true;
      o.material.opacity = Math.min(o.material.opacity, 0.55);
      o.material.depthWrite = false;
      o.castShadow = false;
    } else if (o.isSprite) {
      o.visible = false;
    }
  });
}

export const FacilitySystem = {
  placing: null,

  init(s) {
    scene = s;
    addTagSource(() => {
      if (currentZone() !== 'village' || !G.state) return [];
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
      group.rotation.y = (f.rot * Math.PI) / 2;
      group.userData = { ...group.userData, type: 'facility', index };
      group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      scene.add(group);
      interactables.push(group);
      const r = rectOf(f.kind, f.x, f.z, f.rot);
      const collider = { minX: r.minX + 0.1, maxX: r.maxX - 0.1, minZ: r.minZ + 0.1, maxZ: r.maxZ - 0.1 };
      facilityColliders.push(collider);
      built.push({ group, collider });
    });
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

  // ─── 구매 · 보유 (배치 전 시설은 가방 '시설' 칸의 아이템) ───
  /** 가방·핫바·창고에 있는 (아직 배치하지 않은) 시설 수 */
  stockCount(kind) {
    return InventorySystem.countAll(FACILITIES[kind].itemId);
  },

  ownedCount(kind) {
    return G.state.facilities.filter((f) => f.kind === kind).length + this.stockCount(kind);
  },

  buy(kind) {
    const f = FACILITIES[kind];
    if (this.ownedCount(kind) >= f.max) return toast(`${f.name}은(는) 최대 ${f.max}개까지 가질 수 있어요`, 'warn');
    if (G.state.player.money < f.price) {
      AudioManager.sfx('error');
      return toast('돈이 부족해요', 'warn');
    }
    if (!InventorySystem.canAdd(f.itemId, 1)) {
      AudioManager.sfx('error');
      return toast('가방이 가득 찼어요', 'warn');
    }
    G.state.player.money -= f.price;
    InventorySystem.add(f.itemId, 1);
    AudioManager.sfx('coin');
    EventBus.emit('money');
    EventBus.emit('facility');
    return true;
  },

  /** 배치한 시설을 다시 보관함으로 (진행 중인 작업이 없을 때만) */
  store(i) {
    const f = G.state.facilities[i];
    if (!f) return false;
    if (f.job) {
      toast('만들고 있는 게 있으면 거둬들일 수 없어요', 'warn');
      return false;
    }
    G.state.facilities.splice(i, 1);
    InventorySystem.addOrStore(FACILITIES[f.kind].itemId, 1);
    this.refreshAll();
    toast(`📦 ${FACILITIES[f.kind].name}을(를) 거둬들였어요. 가방 '시설' 탭에서 다시 배치할 수 있어요`);
    EventBus.emit('facility');
    saveGame();
    return true;
  },

  // ─── 배치 모드 ───
  /** kind 를 새로 배치(index = null)하거나, 이미 놓은 시설 index 를 옮긴다 */
  startPlacement(kind, index = null) {
    if (currentZone() !== 'village') return toast('시설은 마을에만 놓을 수 있어요', 'warn');
    if (index === null && !this.stockCount(kind)) return toast('배치할 시설이 없어요. 상점에서 사 오세요', 'warn');
    this.cancelPlacement(true);
    const ghost = makeModel(kind);
    ghostify(ghost);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x7cc05a, transparent: true, opacity: 0.45, depthWrite: false }));
    plate.rotation.x = -Math.PI / 2;
    plate.position.y = 0.05;
    const root = new THREE.Group();
    root.add(ghost, plate);
    scene.add(root);
    const f = index !== null ? G.state.facilities[index] : null;
    this.placing = { kind, index, rot: f?.rot ?? 0, x: f?.x ?? G.refs.player.pos.x, z: f?.z ?? G.refs.player.pos.z, root, ghost, plate, reason: '자리를 골라 주세요' };
    if (f) built[index].group.visible = false;
    this.applyPlacement();
  },

  isPlacing() {
    return !!this.placing;
  },

  /** 마우스가 가리키는 땅 위치로 미리보기를 옮긴다 */
  movePlacement(x, z) {
    const p = this.placing;
    if (!p) return;
    p.x = Math.round(x * 2) / 2;
    p.z = Math.round(z * 2) / 2;
    this.applyPlacement();
  },

  rotatePlacement() {
    const p = this.placing;
    if (!p) return;
    p.rot = (p.rot + 1) % 4;
    AudioManager.sfx('click');
    this.applyPlacement();
  },

  applyPlacement() {
    const p = this.placing;
    const { w, d } = footprint(p.kind, p.rot);
    p.root.position.set(p.x, 0, p.z);
    p.ghost.rotation.y = (p.rot * Math.PI) / 2;
    p.plate.scale.set(w, d, 1);
    const ignore = p.index !== null ? built[p.index]?.collider : null;
    const player = G.refs.player.pos;
    const r = rectOf(p.kind, p.x, p.z, p.rot);
    p.reason = placementBlocked(r, { ignore, keepClear: keepClear() });
    if (!p.reason && player.x > r.minX - 0.3 && player.x < r.maxX + 0.3 && player.z > r.minZ - 0.3 && player.z < r.maxZ + 0.3) p.reason = '내가 서 있는 자리예요';
    p.plate.material.color.setHex(p.reason ? 0xe2685a : 0x7cc05a);
    const name = FACILITIES[p.kind].name;
    setHint(`🏗️ <b>${name} 배치</b> · ${p.reason ? `<span class="bad">${p.reason}</span>` : '<span class="ok">여기에 놓을 수 있어요 — 클릭!</span>'} · R 회전 · Esc 취소`);
  },

  confirmPlacement() {
    const p = this.placing;
    if (!p) return;
    if (p.reason) {
      AudioManager.sfx('error');
      return toast(p.reason, 'warn');
    }
    if (p.index === null) {
      if (!this.stockCount(p.kind)) return this.cancelPlacement();
      InventorySystem.consumeAll(FACILITIES[p.kind].itemId, 1);
      G.state.facilities.push({ kind: p.kind, x: p.x, z: p.z, rot: p.rot, job: null });
    } else {
      Object.assign(G.state.facilities[p.index], { x: p.x, z: p.z, rot: p.rot });
    }
    const name = FACILITIES[p.kind].name;
    this.cancelPlacement(true);
    this.refreshAll();
    AudioManager.sfx('anvil');
    burst({ x: p.x, z: p.z }, { color: 0xd9b47a, count: 30, speed: 3, up: 2.5 });
    toast(`🏗️ ${name}을(를) 놓았어요! 눌러서 사용해요`, 'good');
    EventBus.emit('facility');
    saveGame();
  },

  cancelPlacement(silent = false) {
    const p = this.placing;
    if (!p) return;
    scene.remove(p.root);
    if (p.index !== null && built[p.index]) built[p.index].group.visible = true;
    this.placing = null;
    setHint(null);
    if (!silent) toast('배치를 취소했어요');
  },

  // ─── 작업 (달이기 · 모종 키우기) ───
  status(i) {
    const job = G.state.facilities[i]?.job;
    if (!job) return 'idle';
    return absMinutes() >= job.doneAt ? 'done' : 'working';
  },

  leftMinutes(i) {
    const job = G.state.facilities[i]?.job;
    return job ? Math.max(0, Math.ceil(job.doneAt - absMinutes())) : 0;
  },

  leftText(i) {
    const m = this.leftMinutes(i);
    return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60 ? `${m % 60}분` : ''}`.trim() : `${m}분`;
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

  /** 육묘장에 넣을 수 있는 씨앗 목록 (모종 말고 일반 씨앗) */
  nurserySeeds() {
    return Object.keys(CROPS).map((cropId) => ({ cropId, id: 'seed_' + cropId, n: InventorySystem.count('seed_' + cropId) })).filter((e) => e.n > 0);
  },

  nurseryMax(seedId) {
    return Math.max(0, Math.min(MAX_BATCH, InventorySystem.count(seedId), InventorySystem.countAll('soil_rich')));
  },

  startNursery(i, seedId, n) {
    const f = G.state.facilities[i];
    n = Math.min(n, this.nurseryMax(seedId));
    if (!f || f.job || n <= 0) return;
    const cropId = getItem(seedId).cropId;
    InventorySystem.remove(seedId, n);
    InventorySystem.consumeAll('soil_rich', n);
    this.startJob(f, 'sapling_' + cropId, n);
    AudioManager.sfx('plant');
    toast(`🌱 ${CROPS[cropId].name} 모종 ${n}개를 키우기 시작했어요 (${this.leftText(i)})`, 'good');
  },

  startJob(f, out, n) {
    const now = absMinutes();
    f.job = { out, n, start: now, doneAt: now + FACILITIES[f.kind].minutes * n };
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
    const { w, d } = footprint(f.kind, f.rot);
    return Math.max(w, d) / 2 + 1.4;
  },
};
