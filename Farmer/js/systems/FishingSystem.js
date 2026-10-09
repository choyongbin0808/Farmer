import * as THREE from 'three';
import { G, BAG_SIZES } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { AudioManager } from '../core/AudioManager.js';
import { FISH, ROD_BY_ID, rollCatch, catchReward, weightText } from '../data/fishing.js';
import { InventorySystem } from './InventorySystem.js';
import { STREAM_Z } from '../world/World.js';
import { makeBobber } from '../world/ExtraModels.js';
import { burst } from '../world/Effects.js';
import { addTagSource, addFloatText } from '../ui/WorldMarkers.js';
import { toast, setHint } from '../ui/HUD.js';

// 낚시 흐름: 던지기(cast) → 기다리기(wait, 찌가 둥둥) → 입질(bite, ❗ — 이때 클릭/Space) → 챔질(reel) → 어망에 담기
// 입질 때 놓치면 물고기만 달아나고 찌는 그대로 — 다시 기다린다. 너무 일찍 당기면 물고기가 놀라 조금 더 기다려야 한다.

const STAND_Z = STREAM_Z + 2.7;
const tip = new THREE.Vector3();
const HOLD = { a1x: -0.9, a0x: -0.55, in0: 0.32, bx: 0.04 };

let bobber;
let line;
let linePos;

export const FishingSystem = {
  s: null,

  init(scene) {
    bobber = makeBobber();
    bobber.visible = false;
    scene.add(bobber);
    linePos = new Float32Array(6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
    line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xf6f6f0, transparent: true, opacity: 0.85 }));
    line.frustumCulled = false;
    line.visible = false;
    scene.add(line);
    addTagSource(() => {
      const s = this.s;
      if (!s || (s.phase !== 'bite' && s.phase !== 'wait')) return [];
      if (s.phase === 'wait') return [];
      return [{ key: 'fish-bite', text: '❗', x: s.spot.x, y: 1.1, z: s.spot.z, cls: 'bite' }];
    });
  },

  active() {
    return !!this.s;
  },

  /** 들고 있는 낚싯대 (핫바에서 고른 것) */
  heldRod() {
    const it = InventorySystem.getHeldItem();
    return it?.type === 'rod' ? it : null;
  },

  /** 시냇물을 눌렀을 때: 둑에 설 자리와 찌를 던질 자리 */
  spotsFor(point) {
    const x = THREE.MathUtils.clamp(point.x, -34, 34);
    return {
      stand: { x, z: STAND_Z },
      spot: { x: x + THREE.MathUtils.clamp(point.x - x, -2, 2), z: THREE.MathUtils.clamp(point.z, STREAM_Z - 1.1, STREAM_Z + 0.9) },
    };
  },

  canStart() {
    if (!InventorySystem.freeSlots('fishing')) {
      AudioManager.sfx('error');
      toast(`🎒 가방의 '낚시' 칸이 가득 찼어요 (${BAG_SIZES.fishing}칸). 오 씨에게 물고기를 넘겨요`, 'warn');
      return false;
    }
    return true;
  },

  /** 찌 던지기 (플레이어가 둑에 선 뒤 호출) */
  cast(spot, rodItem) {
    const p = G.refs.player;
    if (this.s || p.work || !this.canStart()) return;
    const rod = ROD_BY_ID[rodItem.id];
    this.s = { phase: 'cast', spot, rod, item: rodItem, t: 0, timer: 0, early: 0 };
    p.faceTo(spot.x, spot.z);
    p.keepHeld = true;
    p.stance = HOLD;
    p.startWork(0.9, () => this.landBobber(), 'cast', { item: rodItem });
    AudioManager.sfx('cast');
    setHint('🎣 찌를 던지는 중…');
  },

  landBobber() {
    const s = this.s;
    if (!s) return;
    bobber.visible = true;
    line.visible = true;
    bobber.position.set(s.spot.x, 0.08, s.spot.z);
    burst({ x: s.spot.x, y: -0.1, z: s.spot.z }, { color: 0xd8f4ff, count: 14, speed: 1.4, up: 1.6, life: 0.5 });
    AudioManager.sfx('splash');
    this.toWait();
  },

  toWait(extra = 0) {
    const s = this.s;
    s.phase = 'wait';
    s.timer = (2.5 + Math.random() * 4.5) * s.rod.wait + extra;
    s.nibble = 0.6 + Math.random();
    setHint('🎣 찌를 지켜보세요… <b>❗가 뜨면 클릭 / Space</b> · 이동하면 그만둬요');
  },

  /** 클릭 / Space / E — 낚시 중이면 처리하고 true */
  action() {
    const s = this.s;
    if (!s) return false;
    if (s.phase === 'bite') {
      s.phase = 'reel';
      G.refs.player.startWork(0.8, () => this.land(), 'reel', { item: s.item });
      AudioManager.sfx('catch');
      setHint('🎣 끌어올리는 중!');
    } else if (s.phase === 'wait') {
      s.early++;
      s.timer += 1.5;
      toast('🐟 앗, 너무 일찍 당겼어요! 찌가 쏙 들어갈 때까지 기다려요', 'warn');
    }
    return true;
  },

  land() {
    const s = this.s;
    if (!s) return;
    const c = rollCatch(s.rod);
    const f = FISH[c.id];
    const st = G.state.fishing;
    if (!InventorySystem.addFish(c)) {
      toast('🎒 가방이 가득 차서 물고기를 놓아줬어요', 'warn');
      this.finish(true);
      return;
    }
    st.caught++;
    st.counts[c.id] = (st.counts[c.id] || 0) + 1;
    const best = st.best[c.id];
    const record = !best || c.w > best;
    if (record) st.best[c.id] = c.w;
    const r = catchReward(c);
    burst({ x: s.spot.x, y: 0, z: s.spot.z }, { color: 0xbfe8ff, count: 24, speed: 2, up: 3, life: 0.7 });
    addFloatText(`${f.icon} ${'★'.repeat(f.grade)}`, { x: G.refs.player.pos.x, y: 2.6, z: G.refs.player.pos.z }, '#2a6ac8');
    const used = BAG_SIZES.fishing - InventorySystem.freeSlots('fishing');
    toast(`${f.icon} ${f.name} ${weightText(c.w)}${record ? ' · 🏆 최고 기록!' : ''} (교환 시 ${r.item === 'mat_chitosan' ? '키토산' : '타우린'} ${r.n}) · 낚시 가방 ${used}/${BAG_SIZES.fishing}`, f.grade >= 4 ? 'good' : 'info');
    EventBus.emit('fish', c);
    this.finish(true);
  },

  /** 낚시 끝 (잡았거나 그만둠) */
  finish(keepRod = false) {
    const p = G.refs.player;
    this.s = null;
    bobber.visible = false;
    line.visible = false;
    p.stance = null;
    p.keepHeld = false;
    if (!keepRod || !p.work) p.setHeld(null);
    setHint(null);
  },

  cancel(msg) {
    if (!this.s) return;
    if (msg) toast(msg);
    this.finish();
  },

  update(dt, t, blocked) {
    const s = this.s;
    if (!s) return;
    const p = G.refs.player;
    // 움직이면 그만둔다 (던지는 중·끌어올리는 중은 작업이라 못 움직임)
    if (!p.work && (p.moving > 0.3 || p.moveTarget)) {
      if (s.phase === 'wait' || s.phase === 'bite') AudioManager.sfx('escape');
      this.cancel('🎣 낚싯줄을 감았어요');
      return;
    }
    if (InventorySystem.getHeldItem()?.id !== s.item.id && !p.work) {
      this.cancel('🎣 낚싯대를 내려놓았어요');
      return;
    }
    if (!blocked) {
      if (s.phase === 'wait') {
        s.timer -= dt;
        s.nibble -= dt;
        let y = 0.08 + Math.sin(t * 3) * 0.015;
        // 가끔 톡톡 건드리는 척 (진짜 입질 아님)
        if (s.nibble < 0) {
          y -= 0.04;
          if (s.nibble < -0.12) s.nibble = 0.8 + Math.random() * 1.5;
        }
        bobber.position.y = y;
        if (s.timer <= 0) {
          s.phase = 'bite';
          s.timer = s.rod.window;
          AudioManager.sfx('bite');
          burst({ x: s.spot.x, y: -0.1, z: s.spot.z }, { color: 0xffffff, count: 10, speed: 1, up: 1.2, life: 0.4 });
          setHint('❗ <b>지금이에요! 클릭 / Space</b>');
        }
      } else if (s.phase === 'bite') {
        s.timer -= dt;
        bobber.position.y = -0.06 + Math.sin(t * 34) * 0.035;
        if (s.timer <= 0) {
          AudioManager.sfx('escape');
          toast('💨 물고기가 미끼만 먹고 달아났어요…');
          this.toWait();
        }
      }
    }
    // 낚싯줄: 낚싯대 끝 → 찌
    if (line.visible) {
      const tipObj = p.parts.handSlot.getObjectByName('rodTip');
      if (tipObj) {
        p.group.updateMatrixWorld(true);
        tipObj.getWorldPosition(tip);
        linePos.set([tip.x, tip.y, tip.z, bobber.position.x, bobber.position.y + 0.1, bobber.position.z]);
        line.geometry.attributes.position.needsUpdate = true;
      }
    }
  },

  // ─── 오 씨와 교환 ───
  /** 가방·핫바의 물고기를 종류별로 묶은 목록 [{ id, list: [{ id, w }], taurine, chitosan }] */
  creelGroups() {
    const map = new Map();
    for (const { slot } of InventorySystem.fishSlots()) {
      const c = { id: slot.id, w: slot.w ?? FISH[slot.id].w[0] };
      if (!map.has(c.id)) map.set(c.id, { id: c.id, list: [], taurine: 0, chitosan: 0 });
      const g = map.get(c.id);
      g.list.push(c);
      const r = catchReward(c);
      if (r.item === 'mat_chitosan') g.chitosan += r.n;
      else g.taurine += r.n;
    }
    return [...map.values()].sort((a, b) => FISH[b.id].grade - FISH[a.id].grade);
  },

  /** id 를 주면 그 종류만, 없으면 가진 물고기 전부 교환 */
  exchange(id = null) {
    const give = InventorySystem.fishSlots().filter(({ slot }) => !id || slot.id === id);
    if (!give.length) return;
    let taurine = 0, chitosan = 0;
    for (const { area, index, slot } of give) {
      const r = catchReward({ id: slot.id, w: slot.w ?? FISH[slot.id].w[0] });
      if (r.item === 'mat_chitosan') chitosan += r.n;
      else taurine += r.n;
      InventorySystem.slots(area)[index] = null;
    }
    EventBus.emit('inventory');
    if (taurine) InventorySystem.addOrStore('mat_taurine', taurine);
    if (chitosan) InventorySystem.addOrStore('mat_chitosan', chitosan);
    AudioManager.sfx('coin');
    const parts = [taurine && `💊 타우린 +${taurine}`, chitosan && `🐚 키토산 +${chitosan}`].filter(Boolean);
    toast(`${give.length}마리를 넘겼어요: ${parts.join(' · ')}`, 'good');
    EventBus.emit('fish');
  },

  buyRod(id) {
    const r = ROD_BY_ID[id];
    if (!r) return;
    if (InventorySystem.count(id) > 0) return toast('이미 가지고 있어요');
    if (G.state.player.money < r.price) {
      AudioManager.sfx('error');
      return toast('돈이 부족해요', 'warn');
    }
    if (!InventorySystem.canAdd(id, 1)) {
      AudioManager.sfx('error');
      return toast('가방이 가득 찼어요', 'warn');
    }
    G.state.player.money -= r.price;
    InventorySystem.add(id, 1);
    AudioManager.sfx('coin');
    toast(`🎣 ${r.name}을(를) 샀어요! 가방 '낚시' 탭에서 핫바로 옮겨 쓰세요`, 'good');
    EventBus.emit('money');
  },
};
