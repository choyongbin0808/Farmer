import * as THREE from 'three';
import { makeCropModel } from './Models.js';
import { STORAGE_ROOF } from './World.js';
import { addFloatText } from '../ui/WorldMarkers.js';

let scene;
const active = [];

export function initEffects(s) {
  scene = s;
}

export function updateEffects(dt) {
  for (let i = active.length - 1; i >= 0; i--) {
    const e = active[i];
    e.t += dt;
    if (e.update(e.t, dt) === false) {
      e.dispose?.();
      active.splice(i, 1);
    }
  }
}

/** 수확한 작물이 튀어 올랐다가 창고로 날아가는 연출 */
export function flyToStorage(cropId, from, amount) {
  const obj = makeCropModel(cropId, 3);
  obj.scale.setScalar(0.7);
  obj.traverse((m) => { m.castShadow = false; });
  obj.position.set(from.x, 0.2, from.z);
  scene.add(obj);
  const start = new THREE.Vector3(from.x, 0.2, from.z);
  const peak = new THREE.Vector3(from.x, 1.8, from.z);
  const end = STORAGE_ROOF.clone();
  const mid = new THREE.Vector3().addVectors(peak, end).multiplyScalar(0.5);
  mid.y += 3;
  const jump = 0.35, fly = 0.8;
  active.push({
    t: 0,
    update(t) {
      if (t < jump) {
        const k = t / jump;
        obj.position.lerpVectors(start, peak, 1 - (1 - k) * (1 - k));
        obj.rotation.y += 0.2;
      } else if (t < jump + fly) {
        const k = (t - jump) / fly;
        const a = new THREE.Vector3().lerpVectors(peak, mid, k);
        const b = new THREE.Vector3().lerpVectors(mid, end, k);
        obj.position.lerpVectors(a, b, k);
        obj.scale.setScalar(0.7 * (1 - k * 0.8));
        obj.rotation.y += 0.25;
      } else {
        addFloatText(`+${amount}`, STORAGE_ROOF, '#3f7a2a');
        return false;
      }
      return true;
    },
    dispose() { scene.remove(obj); },
  });
}

/** 작은 입자 튀기기 (흙먼지, 물방울, 반짝임) */
export function burst(pos, { color = 0x8b5a3c, count = 14, speed = 2.5, size = 0.07, life = 0.7, up = 2, gravity = 6 } = {}) {
  const geo = new THREE.BufferGeometry();
  const arr = new Float32Array(count * 3);
  const vel = [];
  for (let i = 0; i < count; i++) {
    arr.set([pos.x, (pos.y ?? 0) + 0.2, pos.z], i * 3);
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.6);
    vel.push([Math.cos(a) * s, up * (0.5 + Math.random()), Math.sin(a) * s]);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const m = new THREE.PointsMaterial({ color, size, transparent: true, depthWrite: false });
  const pts = new THREE.Points(geo, m);
  scene.add(pts);
  active.push({
    t: 0,
    update(t, dt) {
      for (let i = 0; i < count; i++) {
        vel[i][1] -= gravity * dt;
        arr[i * 3] += vel[i][0] * dt;
        arr[i * 3 + 1] = Math.max(0.02, arr[i * 3 + 1] + vel[i][1] * dt);
        arr[i * 3 + 2] += vel[i][2] * dt;
      }
      geo.attributes.position.needsUpdate = true;
      m.opacity = Math.max(0, 1 - t / life);
      return t < life;
    },
    dispose() { scene.remove(pts); geo.dispose(); m.dispose(); },
  });
}

// 물뿌리개 물방울 (공용 지오메트리·재질)
const DROP_GEO = new THREE.SphereGeometry(0.045, 12, 8);
const DROP_MAT = new THREE.MeshStandardMaterial({ color: 0x8ad8ff, roughness: 0.1, emissive: 0x3aa0d8, emissiveIntensity: 0.35, transparent: true, opacity: 0.92 });

/** 물방울 하나: pos 에서 dir(앞쪽) 방향으로 톡 떨어져 땅에 닿으면 작게 튄다 */
export function waterDrop(pos, dir) {
  const m = new THREE.Mesh(DROP_GEO, DROP_MAT);
  m.position.copy(pos);
  m.scale.set(0.85, 1.35, 0.85);
  scene.add(m);
  const v = new THREE.Vector3(
    dir.x * (0.5 + Math.random() * 0.4) + (Math.random() - 0.5) * 0.35,
    -0.2 - Math.random() * 0.4,
    dir.z * (0.5 + Math.random() * 0.4) + (Math.random() - 0.5) * 0.35,
  );
  active.push({
    t: 0,
    update(t, dt) {
      v.y -= 9 * dt;
      m.position.addScaledVector(v, dt);
      if (m.position.y <= 0.13) {
        burst({ x: m.position.x, y: -0.08, z: m.position.z }, { color: 0xc4ecff, count: 4, speed: 0.7, up: 1.1, life: 0.3, size: 0.045, gravity: 7 });
        return false;
      }
      return t < 2;
    },
    dispose() { scene.remove(m); },
  });
}

export function sparkle(pos) {
  burst({ x: pos.x, y: (pos.y ?? 0) + 1, z: pos.z }, { color: 0xffe2a0, count: 40, speed: 2, up: 3, gravity: 1.5, life: 1.3, size: 0.08 });
  burst({ x: pos.x, y: (pos.y ?? 0) + 1, z: pos.z }, { color: 0xffffff, count: 25, speed: 1.6, up: 2.5, gravity: 1.2, life: 1.3, size: 0.06 });
}

/** 엔딩 꽃가루 */
export function confetti(center, duration = 10) {
  const count = 500;
  const geo = new THREE.BufferGeometry();
  const arr = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const palette = [0xff7aa8, 0xffd84d, 0x8bd16a, 0x7ec8ff, 0xffffff, 0xb48cff].map((c) => new THREE.Color(c));
  const drift = [];
  for (let i = 0; i < count; i++) {
    arr.set([center.x + (Math.random() - 0.5) * 18, 4 + Math.random() * 12, center.z + (Math.random() - 0.5) * 18], i * 3);
    const c = palette[i % palette.length];
    colors.set([c.r, c.g, c.b], i * 3);
    drift.push(Math.random() * Math.PI * 2);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const m = new THREE.PointsMaterial({ size: 0.25, vertexColors: true, transparent: true, depthWrite: false });
  const pts = new THREE.Points(geo, m);
  pts.frustumCulled = false;
  scene.add(pts);
  active.push({
    t: 0,
    update(t, dt) {
      for (let i = 0; i < count; i++) {
        arr[i * 3 + 1] -= dt * 1.4;
        arr[i * 3] += Math.sin(t * 2 + drift[i]) * dt * 0.8;
        if (arr[i * 3 + 1] < 0 && t < duration - 2) arr[i * 3 + 1] = 12 + Math.random() * 4;
      }
      geo.attributes.position.needsUpdate = true;
      if (t > duration - 2) m.opacity = Math.max(0, (duration - t) / 2);
      return t < duration;
    },
    dispose() { scene.remove(pts); geo.dispose(); m.dispose(); },
  });
}
