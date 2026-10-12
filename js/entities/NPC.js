import { makeCharacter } from '../world/Models.js';
import { lerpAngle } from './Player.js';

export class NPC {
  constructor(id, data, scene) {
    this.id = id;
    this.data = data;
    const c = makeCharacter(data.look);
    this.group = c.root;
    this.body = c.body;
    this.parts = c.parts;
    this.group.userData = { type: 'npc', id };
    this.group.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    scene.add(this.group);
    this.facing = data.face ?? 0;
    this.walkT = 0;
    this.moving = 0;
    this.path = null;
    this.wanderWait = 2 + Math.random() * 3;
    this.talking = false;
    this.frozen = false;
    this.action = null; // 엔딩 연출: 'clap' 박수 | 'cheer' 두 팔 번쩍 | 'wave' 손 흔들기
    this.armBaseZ = this.parts.arms.map((a) => a.rotation.z);
    this.phase = Math.random() * 10;
    this.resetHome();
  }

  get pos() {
    return this.group.position;
  }

  resetHome() {
    const [x, z] = this.data.pos;
    this.group.position.set(x, 0, z);
    this.facing = this.data.face ?? 0;
    this.group.rotation.y = this.facing;
    this.path = null;
  }

  faceTo(x, z) {
    this.facing = Math.atan2(x - this.pos.x, z - this.pos.z);
  }

  walkTo(x, z, speed = 3.5, cb) {
    this.path = { x, z, speed, cb };
  }

  update(dt, t) {
    let moving = false;
    if (this.path && !this.talking) {
      const dx = this.path.x - this.pos.x, dz = this.path.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.1) {
        const cb = this.path.cb;
        this.path = null;
        cb?.();
      } else {
        const step = Math.min(d, this.path.speed * dt);
        this.pos.x += (dx / d) * step;
        this.pos.z += (dz / d) * step;
        this.facing = Math.atan2(dx, dz);
        moving = true;
      }
    } else if (this.data.wander && !this.talking && !this.frozen) {
      this.wanderWait -= dt;
      if (this.wanderWait <= 0) {
        const w = this.data.wander;
        const a = Math.random() * Math.PI * 2;
        const r = 2.5 + Math.random() * (w.r - 2.5);
        this.walkTo(w.x + Math.cos(a) * r, w.z + Math.sin(a) * r, 2.2);
        this.wanderWait = 3 + Math.random() * 4;
      }
    }

    this.moving += ((moving ? 1 : 0) - this.moving) * Math.min(1, dt * 8);
    if (moving) this.walkT += dt * 9;
    this.group.rotation.y = lerpAngle(this.group.rotation.y, this.facing, 1 - Math.exp(-8 * dt));
    const s = Math.sin(this.walkT) * this.moving;
    this.parts.legs[0].rotation.x = s * 0.7;
    this.parts.legs[1].rotation.x = -s * 0.7;
    this.parts.arms[0].rotation.x = -s * 0.5;
    this.parts.arms[1].rotation.x = s * 0.5;
    const idle = Math.sin(t * 2 + this.phase) * 0.02;
    this.body.position.y = Math.abs(Math.sin(this.walkT)) * 0.07 * this.moving + idle;
    this.animateAction(t);
  }

  /** 박수 · 환호 · 손 흔들기 (팔 피벗 z+ 는 +x 쪽으로 벌어짐: arms[0] 은 +, arms[1] 은 - 가 안쪽) */
  animateAction(t) {
    const [a0, a1] = this.parts.arms;
    const [b0, b1] = this.armBaseZ;
    if (this.action === 'clap') {
      const k = 0.42 + 0.3 * Math.abs(Math.sin(t * 13 + this.phase));
      a0.rotation.x = a1.rotation.x = -1.25;
      a0.rotation.z = b0 + k;
      a1.rotation.z = b1 - k;
    } else if (this.action === 'cheer') {
      const k = Math.sin(t * 9 + this.phase) * 0.25;
      a0.rotation.x = a1.rotation.x = -2.8 + k;
      a0.rotation.z = b0 - 0.2;
      a1.rotation.z = b1 + 0.2;
      this.body.position.y = Math.abs(Math.sin(t * 9 + this.phase)) * 0.12;
    } else if (this.action === 'wave') {
      a1.rotation.x = -2.7;
      a1.rotation.z = b1 + 0.15 + Math.sin(t * 10) * 0.35;
      a0.rotation.z = b0;
    } else {
      a0.rotation.z = b0;
      a1.rotation.z = b1;
    }
  }
}
