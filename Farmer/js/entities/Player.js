import * as THREE from 'three';
import { makeCharacter, makeHat, makeHeldItem, makeVehicle, VEHICLE_SEAT_Y, CHAR_SIT_HEIGHT } from '../world/Models.js';
import { resolveCollision, farmRoute } from '../world/World.js';
import { CLOTHES } from '../data/clothes.js';
import { waterDrop } from '../world/Effects.js';

const _spout = new THREE.Vector3();

const DEFAULT_LOOK = { top: 0xf2ede2, bottom: 0x5e7aa8 };

/** 키프레임 [[시점 0~1, 값], ...] 사이를 부드럽게 보간 */
function kf(k, keys) {
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (k <= t1) {
      const [t0, v0] = keys[i - 1];
      const u = (k - t0) / (t1 - t0 || 1);
      return v0 + (v1 - v0) * u * u * (3 - 2 * u);
    }
  }
  return keys[keys.length - 1][1];
}

/**
 * 작업 동작별 자세 (k = 진행도 0~1). arms[1]이 도구를 든 손.
 * a0x/a1x: 팔 앞뒤(음수 = 앞으로 듦), in0/in1: 팔을 몸 안쪽으로 모음, bx: 상체 숙임, by: 몸 높이,
 * l0x/l1x: 다리 앞뒤, slotX: 손에 든 도구 기울기
 */
const WORK_POSES = {
  // 호미: 두 손으로 머리 위까지 들어 올렸다가 땅을 찍음
  till: (k) => {
    const arm = kf(k, [[0, 0], [0.45, -2.7], [0.62, -0.5], [0.85, -0.5], [1, 0]]);
    const grip = kf(k, [[0, 0], [0.15, 0.32], [0.85, 0.32], [1, 0]]);
    return {
      a0x: arm, a1x: arm, in0: grip, in1: grip,
      bx: kf(k, [[0, 0], [0.45, -0.12], [0.62, 0.32], [0.85, 0.3], [1, 0]]),
      by: kf(k, [[0, 0], [0.62, -0.06], [0.85, -0.06], [1, 0]]),
    };
  },
  // 물뿌리개: 앞으로 들고 기울여 좌우로 흔들며 물 주기
  water: (k) => {
    const a1x = kf(k, [[0, 0], [0.2, -1.0], [0.8, -1.0], [1, 0]]);
    const pour = kf(k, [[0, 0], [0.25, 0], [0.4, 0.85], [0.75, 0.85], [0.9, 0], [1, 0]]);
    const sway = kf(k, [[0, 0], [0.38, 0], [0.45, 1], [0.7, 1], [0.78, 0], [1, 0]]) * Math.sin(k * Math.PI * 6) * 0.3;
    return {
      a1x, slotX: -a1x + pour, in1: sway,
      a0x: kf(k, [[0, 0], [0.2, -0.25], [0.8, -0.25], [1, 0]]),
      bx: kf(k, [[0, 0], [0.3, 0.12], [0.8, 0.12], [1, 0]]),
    };
  },
  // 씨앗: 반쯤 앉아 팔을 뒤로 뺐다가 앞으로 휙 뿌림
  plant: (k) => {
    const crouch = kf(k, [[0, 0], [0.25, 1], [0.8, 1], [1, 0]]);
    return {
      a1x: kf(k, [[0, 0], [0.3, 0.8], [0.55, -1.4], [0.75, -1.2], [1, 0]]),
      a0x: -0.3 * crouch,
      bx: 0.28 * crouch, by: -0.12 * crouch,
      l0x: -0.4 * crouch, l1x: 0.6 * crouch,
    };
  },
  // 낫: 숙여서 한 손으로 작물을 잡고, 낫을 옆으로 휘둘러 벤 뒤 번쩍 들어 올림
  harvest: (k) => ({
    a1x: kf(k, [[0, 0], [0.25, -1.0], [0.55, -1.0], [0.8, -0.4], [1, 0]]),
    in1: kf(k, [[0, 0], [0.25, -0.7], [0.45, 0.55], [0.6, 0.55], [0.8, 0], [1, 0]]),
    a0x: kf(k, [[0, 0], [0.3, -0.9], [0.55, -0.9], [0.8, -2.4], [0.92, -2.4], [1, 0]]),
    in0: kf(k, [[0, 0], [0.3, 0.25], [0.55, 0.25], [0.8, 0], [1, 0]]),
    bx: kf(k, [[0, 0], [0.25, 0.32], [0.55, 0.32], [0.8, -0.08], [1, 0]]),
    by: kf(k, [[0, 0], [0.25, -0.12], [0.55, -0.12], [0.8, 0.04], [1, 0]]),
    l0x: kf(k, [[0, 0], [0.25, -0.35], [0.55, -0.35], [0.8, 0], [1, 0]]),
    l1x: kf(k, [[0, 0], [0.25, 0.45], [0.55, 0.45], [0.8, 0], [1, 0]]),
  }),
};
WORK_POSES.swing = (k) => ({ a1x: -Math.sin(k * Math.PI) * 2.0, bx: Math.sin(k * Math.PI) * 0.15 });

/** 동작 한 번의 길이(초) — 작업 시간이 길면 이 동작을 여러 번 반복한다 */
const MOTION_LEN = { till: 0.8, water: 1.2, plant: 0.45, harvest: 0.85, swing: 0.6 };

export function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class Player {
  constructor(scene) {
    const c = makeCharacter({ skin: 0xf0c4a0, top: DEFAULT_LOOK.top, bottom: DEFAULT_LOOK.bottom, hair: 0x4a3020, hairStyle: 'short' });
    this.group = c.root;
    this.body = c.body;
    this.parts = c.parts;
    this.group.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    scene.add(this.group);
    this.walkT = 0;
    this.moving = 0;
    this.work = null;
    this.moveTarget = null;
    this.facing = 0;
    this.heldKey = '';
    this.onBlocked = null;
    this.armBaseZ = this.parts.arms.map((a) => a.rotation.z);
  }

  /** 자세 적용 — 지정하지 않은 값은 기본 자세(0) */
  pose({ a0x = 0, a1x = 0, in0 = 0, in1 = 0, bx = 0, by = 0, l0x = 0, l1x = 0, slotX = 0 } = {}) {
    const { arms, legs, handSlot } = this.parts;
    arms[0].rotation.x = a0x;
    arms[1].rotation.x = a1x;
    // 팔 피벗 z+ 는 +x 쪽으로 벌어짐: arms[0](-x)은 +, arms[1](+x)은 - 가 안쪽
    arms[0].rotation.z = this.armBaseZ[0] + in0;
    arms[1].rotation.z = this.armBaseZ[1] - in1;
    legs[0].rotation.x = l0x;
    legs[1].rotation.x = l1x;
    handSlot.rotation.x = slotX;
    this.body.rotation.x = bx;
    this.body.position.y = by;
  }

  get pos() {
    return this.group.position;
  }

  setPosition(x, z) {
    this.group.position.set(x, 0, z);
    this.moveTarget = null;
  }

  applyOutfit(outfit) {
    const hat = outfit.hat ? CLOTHES[outfit.hat] : null;
    const top = outfit.top ? CLOTHES[outfit.top] : null;
    const bottom = outfit.bottom ? CLOTHES[outfit.bottom] : null;
    this.parts.topM.color.setHex(top ? top.color : DEFAULT_LOOK.top);
    this.parts.botM.color.setHex(bottom ? bottom.color : DEFAULT_LOOK.bottom);
    this.parts.skirt.visible = !!bottom?.skirt;
    const slot = this.parts.hatSlot;
    while (slot.children.length) slot.remove(slot.children[0]);
    if (hat) {
      const h = makeHat(hat.style, hat.color);
      h.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      slot.add(h);
    }
  }

  /** vehicle: 'tractor' | 'seeder' 이면 손에 드는 대신 농기계에 올라탄다 */
  setHeld(item, color, vehicle = null) {
    const key = item ? `${item.id}|${color}|${vehicle}` : '';
    if (key === this.heldKey) return;
    this.heldKey = key;
    const slot = this.parts.handSlot;
    while (slot.children.length) slot.remove(slot.children[0]);
    this.setVehicle(vehicle);
    if (item && !vehicle) slot.add(makeHeldItem(item, color));
  }

  setVehicle(kind) {
    if (this.vehicle?.kind === kind) return;
    if (this.vehicle) this.group.remove(this.vehicle.root);
    this.vehicle = kind ? makeVehicle(kind) : null;
    if (this.vehicle) this.group.add(this.vehicle.root);
    if (!this.vehicle) this.pose();
  }

  /** 농기계 탑승 중 자세 · 바퀴 · 작업 애니메이션 */
  animateVehicle(dt, dist) {
    const v = this.vehicle;
    for (const w of v.wheels) w.pivot.rotation.x += dist / w.r;
    const k = this.work ? Math.sin(Math.min(1, this.work.t / this.work.dur) * Math.PI) : 0;
    for (const s of v.spinners) s.rotation.x -= dt * (2 + 26 * k) + dist * 3;
    // 엔진 진동 + 작업 중 덜컹임
    this.vibT = (this.vibT || 0) + dt;
    const shake = Math.sin(this.vibT * 45) * (0.008 + 0.025 * k + 0.012 * this.moving);
    v.root.position.y = shake;
    v.root.rotation.x = -k * 0.04;
    // 팔을 앞으로 뻗어 핸들을 잡는다
    this.pose({ a0x: -1.35, a1x: -1.35, in0: 0.2, in1: 0.2, l0x: -1.2, l1x: -1.2, bx: k * 0.08, by: VEHICLE_SEAT_Y - CHAR_SIT_HEIGHT + shake });
  }

  /**
   * motion: 'till' | 'water' | 'plant' | 'harvest' (WORK_POSES)
   * prop: 작업하는 동안만 손에 드는(또는 올라타는) 도구 { item, color, vehicle } — 끝나면 빈손으로 돌아간다
   */
  startWork(duration, cb, motion = 'swing', prop = null) {
    if (this.work) return false;
    const cycles = Math.max(1, Math.round(duration / (MOTION_LEN[motion] ?? 0.6)));
    this.work = { t: 0, dur: duration, cb, motion, cycles, k: 0 };
    this.moveTarget = null;
    this.setHeld(prop?.item ?? null, prop?.color, prop?.vehicle ?? null);
    return true;
  }

  moveTo(x, z, reach, cb) {
    const waypoints = farmRoute(this.pos, { x, z });
    this.moveTarget = { x, z, reach, cb, waypoints, stuck: 0, lastD: Infinity };
  }

  /** 진행 중인 작업의 진행도 0~1 (작업 중이 아니면 null) */
  get workProgress() {
    return this.work ? Math.min(1, this.work.t / this.work.dur) : null;
  }

  faceTo(x, z) {
    this.facing = Math.atan2(x - this.pos.x, z - this.pos.z);
  }

  /** 물뿌리개를 기울인 동안(k 0.38~0.86) 꼭지에서 물방울이 톡톡 떨어진다 */
  dripWater(dt, k) {
    if (k < 0.38 || k > 0.86) return;
    this.dripT = (this.dripT ?? 0) - dt;
    if (this.dripT > 0) return;
    this.dripT = 0.028;
    const spout = this.parts.handSlot.getObjectByName('spout');
    if (!spout) return;
    this.group.updateMatrixWorld(true);
    spout.getWorldPosition(_spout);
    const dir = { x: Math.sin(this.group.rotation.y), z: Math.cos(this.group.rotation.y) };
    waterDrop(_spout, dir);
    if (Math.random() < 0.5) waterDrop(_spout, dir);
  }

  update(dt, input, basis, canMove) {
    let mx = 0, mz = 0, run = false;
    let workPose = null;

    if (this.work) {
      const w = this.work;
      w.t += dt;
      const p = Math.min(1, w.t / w.dur);
      w.k = p >= 1 ? 1 : (p * w.cycles) % 1;
      if (!this.vehicle) workPose = (WORK_POSES[w.motion] || WORK_POSES.swing)(w.k);
      if (w.t >= w.dur) {
        this.work = null;
        workPose = null;
        this.setHeld(null);
        w.cb?.();
      }
    } else if (canMove) {
      const f = (input.isDown('KeyW', 'ArrowUp') ? 1 : 0) - (input.isDown('KeyS', 'ArrowDown') ? 1 : 0);
      const r = (input.isDown('KeyD', 'ArrowRight') ? 1 : 0) - (input.isDown('KeyA', 'ArrowLeft') ? 1 : 0);
      run = input.isDown('ShiftLeft', 'ShiftRight');
      if (f || r) {
        this.moveTarget = null;
        mx = basis.fx * f + basis.rx * r;
        mz = basis.fz * f + basis.rz * r;
      } else if (this.moveTarget?.waypoints.length) {
        const t = this.moveTarget;
        const w = t.waypoints[0];
        const dx = w.x - this.pos.x, dz = w.z - this.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > t.lastD - 0.02) t.stuck += dt;
        else t.stuck = 0;
        t.lastD = Math.min(t.lastD, d);
        if (d < 0.4 || t.stuck > 0.8) {
          t.waypoints.shift();
          t.stuck = 0;
          t.lastD = Infinity;
        } else {
          mx = dx / d;
          mz = dz / d;
          run = Math.hypot(t.x - this.pos.x, t.z - this.pos.z) > 8;
        }
      } else if (this.moveTarget) {
        const t = this.moveTarget;
        const dx = t.x - this.pos.x, dz = t.z - this.pos.z;
        const d = Math.hypot(dx, dz);
        if (d <= t.reach) {
          this.moveTarget = null;
          this.faceTo(t.x, t.z);
          t.cb?.();
        } else {
          mx = dx / d;
          mz = dz / d;
          run = d > 8;
          if (d > t.lastD - 0.02) t.stuck += dt;
          else t.stuck = 0;
          t.lastD = Math.min(t.lastD, d);
          if (t.stuck > 0.8) {
            this.moveTarget = null;
            if (d <= t.reach + 1.2) {
              this.faceTo(t.x, t.z);
              t.cb?.();
            } else {
              this.onBlocked?.();
            }
          }
        }
      }
    } else {
      this.moveTarget = null;
    }

    const len = Math.hypot(mx, mz);
    const speed = run ? 9.5 : 6;
    if (len > 0) {
      mx /= len;
      mz /= len;
      this.pos.x += mx * speed * dt;
      this.pos.z += mz * speed * dt;
      resolveCollision(this.pos, 0.4);
      this.facing = Math.atan2(mx, mz);
      this.walkT += dt * speed * 1.7;
      this.moving = Math.min(1, this.moving + dt * 8);
    } else {
      this.moving = Math.max(0, this.moving - dt * 6);
    }

    this.group.rotation.y = lerpAngle(this.group.rotation.y, this.facing, 1 - Math.exp(-14 * dt));
    if (this.vehicle) {
      this.animateVehicle(dt, len > 0 ? speed * dt : 0);
      return;
    }
    if (workPose) {
      this.pose(workPose);
      if (this.work?.motion === 'water') this.dripWater(dt, this.work.k);
      return;
    }
    const s = Math.sin(this.walkT) * this.moving;
    this.pose({ l0x: s * 0.7, l1x: -s * 0.7, a0x: -s * 0.6, a1x: s * 0.6, by: Math.abs(Math.sin(this.walkT)) * 0.08 * this.moving });
  }
}
