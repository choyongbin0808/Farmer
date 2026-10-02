import * as THREE from 'three';
import { makeCharacter, makeHat, makeHeldItem } from '../world/Models.js';
import { resolveCollision, farmRoute } from '../world/World.js';
import { CLOTHES } from '../data/clothes.js';

const DEFAULT_LOOK = { top: 0xf5f0e6, bottom: 0x6d7f99 };

export function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class Player {
  constructor(scene) {
    const c = makeCharacter({ skin: 0xf3c9a0, top: DEFAULT_LOOK.top, bottom: DEFAULT_LOOK.bottom, hair: 0x4a3222, hairStyle: 'short' });
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

  setHeld(item, color) {
    const key = item ? `${item.id}|${color}` : '';
    if (key === this.heldKey) return;
    this.heldKey = key;
    const slot = this.parts.handSlot;
    while (slot.children.length) slot.remove(slot.children[0]);
    if (item) slot.add(makeHeldItem(item, color));
  }

  startWork(duration, cb) {
    if (this.work) return false;
    this.work = { t: 0, dur: duration, cb };
    this.moveTarget = null;
    return true;
  }

  moveTo(x, z, reach, cb) {
    const waypoints = farmRoute(this.pos, { x, z });
    this.moveTarget = { x, z, reach, cb, waypoints, stuck: 0, lastD: Infinity };
  }

  faceTo(x, z) {
    this.facing = Math.atan2(x - this.pos.x, z - this.pos.z);
  }

  update(dt, input, basis, canMove) {
    let mx = 0, mz = 0, run = false;
    const arms = this.parts.arms;

    if (this.work) {
      const w = this.work;
      w.t += dt;
      const k = Math.min(1, w.t / w.dur);
      arms[1].rotation.x = -Math.sin(k * Math.PI) * 2.0;
      this.body.rotation.x = Math.sin(k * Math.PI) * 0.15;
      if (w.t >= w.dur) {
        this.work = null;
        arms[1].rotation.x = 0;
        this.body.rotation.x = 0;
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
    if (len > 0) {
      mx /= len;
      mz /= len;
      const speed = run ? 9.5 : 6;
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
    const s = Math.sin(this.walkT) * this.moving;
    this.parts.legs[0].rotation.x = s * 0.7;
    this.parts.legs[1].rotation.x = -s * 0.7;
    arms[0].rotation.x = -s * 0.6;
    if (!this.work) arms[1].rotation.x = s * 0.6;
    this.body.position.y = Math.abs(Math.sin(this.walkT)) * 0.08 * this.moving;
  }
}
