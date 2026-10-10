import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, surf, mesh, makeLabel, makeBuilding, makeRock } from './Models.js';
import { ORES } from '../data/mining.js';
import { FISH } from '../data/fishing.js';
import * as TX from './Textures.js';

// ═════════════════════════════════════════════════════════════
//  낚시 · 광산 · 시설 · 새 마을회관 모델
// ═════════════════════════════════════════════════════════════

const box = (w, h, d, r = 0.03) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) * 0.45));
const cyl = (rt, rb, h, s = 14) => new THREE.CylinderGeometry(rt, rb, h, s);

/** 늘 켜져 있는 등불 유리 (광산 안 · 약탕기 불씨) */
export const GLOW_MAT = new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffb050, emissiveIntensity: 2.2, roughness: 0.4 });
const FIRE_MAT = new THREE.MeshStandardMaterial({ color: 0x401a08, emissive: 0xff6a18, emissiveIntensity: 2.4, roughness: 1 });

/** 크기에 맞춰 UV를 늘린 평면 (텍스처가 size m 마다 반복) */
function tiledPlane(w, d, size, material) {
  const g = new THREE.PlaneGeometry(w, d);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / size, (uv.getY(i) * d) / size);
  const m = mesh(g, material, false, true);
  m.rotation.x = -Math.PI / 2;
  return m;
}

// ───────── 낚시 찌 ─────────
export function makeBobber() {
  const g = new THREE.Group();
  const top = mesh(new THREE.SphereGeometry(0.09, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xe8443a, { roughness: 0.4 }), false);
  const bot = mesh(new THREE.SphereGeometry(0.09, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(0xf4f0e8, { roughness: 0.4 }), false);
  const stick = mesh(cyl(0.008, 0.008, 0.16, 6), mat(0xe8443a), false);
  stick.position.y = 0.14;
  g.add(top, bot, stick);
  return g;
}

// ───────── 도감용 물고기 · 게 (앞 = +x) ─────────
const LONG_FISH = { fish_eel: 2.8, fish_loach: 2.4, fish_sturgeon: 2.1, fish_snakehead: 1.8 };

export function makeFishModel(id) {
  const f = FISH[id];
  const g = new THREE.Group();
  const bodyM = mat(f.color, { roughness: 0.35, metalness: f.grade >= 5 ? 0.35 : 0.12 });
  const finM = mat(new THREE.Color(f.color).multiplyScalar(0.75).getHex(), { roughness: 0.5 });
  const eyeW = mat(0xffffff, { roughness: 0.3 });
  const eyeB = mat(0x1a1410, { roughness: 0.2 });
  if (f.crab) {
    const shell = mesh(new THREE.SphereGeometry(0.5, 24, 16), bodyM);
    shell.scale.set(1.25, 0.5, 1);
    shell.position.y = 0.32;
    g.add(shell);
    for (const s of [-1, 1]) {
      // 다리 세 쌍
      for (let i = 0; i < 3; i++) {
        const leg = mesh(cyl(0.035, 0.025, 0.55, 8), finM);
        leg.position.set(-0.25 + i * 0.25, 0.2, s * 0.55);
        leg.rotation.x = s * 1.1;
        g.add(leg);
      }
      // 집게
      const arm = mesh(cyl(0.05, 0.05, 0.4, 8), finM);
      arm.position.set(0.55, 0.3, s * 0.32);
      arm.rotation.z = -1.1;
      const claw = mesh(new THREE.SphereGeometry(0.16, 14, 10), bodyM);
      claw.scale.set(1.5, 0.8, 0.9);
      claw.position.set(0.78, 0.42, s * 0.36);
      g.add(arm, claw);
      // 눈자루
      const stalk = mesh(cyl(0.02, 0.02, 0.18, 6), finM);
      stalk.position.set(0.42, 0.5, s * 0.12);
      const eye = mesh(new THREE.SphereGeometry(0.05, 10, 8), eyeB);
      eye.position.set(0.42, 0.6, s * 0.12);
      g.add(stalk, eye);
    }
    return g;
  }
  const len = LONG_FISH[id] ?? 1.4;
  const body = mesh(new THREE.SphereGeometry(0.5, 28, 18), bodyM);
  body.scale.set(len, len > 2 ? 0.34 : 0.62, len > 2 ? 0.32 : 0.36);
  body.position.y = 0.6;
  g.add(body);
  // 꼬리지느러미 (납작한 부채꼴)
  const tail = mesh(new THREE.ConeGeometry(0.32, 0.5, 4), finM);
  tail.rotation.z = -Math.PI / 2;
  tail.scale.z = 0.25;
  tail.position.set(-len * 0.5 - 0.18, 0.6, 0);
  // 등지느러미 · 배지느러미
  const dorsal = mesh(new THREE.ConeGeometry(0.16, 0.3, 4), finM);
  dorsal.scale.set(len > 2 ? 2.4 : 1.2, 1, 0.25);
  dorsal.position.set(-0.05, 0.6 + (len > 2 ? 0.2 : 0.34), 0);
  g.add(tail, dorsal);
  for (const s of [-1, 1]) {
    const fin = mesh(new THREE.ConeGeometry(0.1, 0.24, 4), finM);
    fin.rotation.set(s * 0.9, 0, 0.4);
    fin.scale.z = 0.3;
    fin.position.set(len * 0.12, 0.48, s * 0.16);
    const eye = mesh(new THREE.SphereGeometry(0.075, 12, 10), eyeW);
    eye.position.set(len * 0.36, 0.66, s * (len > 2 ? 0.1 : 0.15));
    const pupil = mesh(new THREE.SphereGeometry(0.042, 10, 8), eyeB);
    pupil.position.set(len * 0.36 + 0.035, 0.66, s * (len > 2 ? 0.14 : 0.2));
    g.add(fin, eye, pupil);
  }
  return g;
}

// ───────── 윤 씨 아주머니네 빨랫줄 ─────────
export function makeClothesline() {
  const g = new THREE.Group();
  const wood = surf('wood', 0x9a7a58);
  for (const x of [-1.6, 1.6]) {
    const post = mesh(cyl(0.05, 0.06, 1.9, 10), wood);
    post.position.set(x, 0.95, 0);
    const arm = mesh(box(0.08, 0.06, 0.5), wood);
    arm.position.set(x, 1.8, 0);
    g.add(post, arm);
  }
  const line = mesh(cyl(0.008, 0.008, 3.2, 4), mat(0xf0ece0), false);
  line.rotation.z = Math.PI / 2;
  line.position.y = 1.78;
  g.add(line);
  [[-1.0, 0xf0a0a0, 0.55], [-0.2, 0xa8c8f0, 0.7], [0.65, 0xf6e6a0, 0.5]].forEach(([x, c, h]) => {
    const cloth = mesh(new THREE.PlaneGeometry(0.6, h), surf('fabric', c, { side: THREE.DoubleSide }));
    cloth.position.set(x, 1.78 - h / 2, 0);
    g.add(cloth);
  });
  const basket = mesh(cyl(0.3, 0.24, 0.26, 16), surf('fabric', 0xc8a06a));
  basket.position.set(2.1, 0.13, 0.3);
  g.add(basket);
  return g;
}

// ───────── 광산 입구 (마을 동쪽 끝) — 앞 = +z ─────────
export function makeMineEntrance() {
  const g = new THREE.Group();
  const rockM = surf('stone', 0x9a9088);
  // 바위 언덕
  const hill = mesh(new THREE.SphereGeometry(4.2, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), rockM, true, true);
  hill.scale.set(1.15, 0.85, 0.8);
  hill.position.z = -1.2;
  g.add(hill);
  for (const [x, z, s] of [[-3.4, 0.6, 1.6], [3.5, 0.4, 1.8], [-2.6, -2.5, 2.2], [2.8, -2.6, 2.0], [0.4, -3.2, 2.4], [-4.3, -1, 1.3], [4.4, -1.2, 1.4]]) {
    const r = makeRock(s);
    r.position.set(x, r.position.y, z);
    g.add(r);
  }
  // 어두운 입구
  const hole = mesh(new THREE.PlaneGeometry(2.2, 2.6), new THREE.MeshBasicMaterial({ color: 0x120e0a }), false);
  hole.position.set(0, 1.3, 1.95);
  g.add(hole);
  const tunnel = mesh(box(2.4, 2.8, 1.2), new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 1 }));
  tunnel.position.set(0, 1.4, 1.3);
  g.add(tunnel);
  // 나무 갱목 틀
  const timber = surf('wood', 0x7a5a3a);
  for (const sx of [-1, 1]) {
    const post = mesh(box(0.28, 3.0, 0.28), timber);
    post.position.set(sx * 1.3, 1.5, 2.05);
    g.add(post);
  }
  const lintel = mesh(box(3.3, 0.32, 0.34), timber);
  lintel.position.set(0, 3.05, 2.05);
  g.add(lintel);
  // 걸린 등불
  const lamp = mesh(new THREE.SphereGeometry(0.13, 12, 10), GLOW_MAT, false);
  lamp.position.set(1.0, 2.6, 2.3);
  const hook = mesh(cyl(0.01, 0.01, 0.3, 4), mat(0x3a3a3a), false);
  hook.position.set(1.0, 2.82, 2.3);
  g.add(lamp, hook);
  // 레일 + 침목
  const railM = surf('metal', 0x6a6460);
  for (const sx of [-0.45, 0.45]) {
    const rail = mesh(box(0.06, 0.06, 2.6), railM);
    rail.position.set(sx, 0.1, 3.1);
    g.add(rail);
  }
  for (let i = 0; i < 5; i++) {
    const tie = mesh(box(1.2, 0.06, 0.18), timber);
    tie.position.set(0, 0.05, 2.0 + i * 0.55);
    g.add(tie);
  }
  // 광석 실은 수레
  const cart = makeMinecart(0xc8733a);
  cart.position.set(-2.6, 0, 2.6);
  cart.rotation.y = 0.4;
  g.add(cart);
  const label = makeLabel('광산');
  label.position.set(0, 4.6, 1.6);
  g.add(label);
  return g;
}

export function makeMinecart(oreColor = 0x2e2c2a) {
  const g = new THREE.Group();
  const metal = surf('metal', 0x6a5a4a);
  const tub = mesh(box(1.0, 0.55, 1.4, 0.06), metal);
  tub.position.y = 0.55;
  g.add(tub);
  for (const sx of [-0.5, 0.5]) for (const sz of [-0.45, 0.45]) {
    const w = mesh(cyl(0.16, 0.16, 0.08, 14), mat(0x2e2c2a, { roughness: 0.6 }));
    w.rotation.z = Math.PI / 2;
    w.position.set(sx, 0.18, sz);
    g.add(w);
  }
  for (let i = 0; i < 5; i++) {
    const lump = mesh(new THREE.DodecahedronGeometry(0.17 + Math.random() * 0.06), mat(oreColor, { roughness: 0.6 }));
    lump.position.set((Math.random() - 0.5) * 0.6, 0.85, (Math.random() - 0.5) * 0.9);
    g.add(lump);
  }
  return g;
}

// ───────── 광산 내부 ─────────

/** 광산 안 등불 기둥 */
export function makeMineLamp() {
  const g = new THREE.Group();
  const post = mesh(box(0.18, 2.4, 0.18), surf('wood', 0x6a4a30));
  post.position.y = 1.2;
  const arm = mesh(box(0.5, 0.1, 0.1), surf('wood', 0x6a4a30));
  arm.position.set(0.22, 2.3, 0);
  const lamp = mesh(new THREE.SphereGeometry(0.16, 12, 10), GLOW_MAT, false);
  lamp.position.set(0.42, 2.05, 0);
  const cap = mesh(cyl(0.05, 0.16, 0.12, 10), surf('metal', 0x3a3633));
  cap.position.set(0.42, 2.24, 0);
  g.add(post, arm, lamp, cap);
  return g;
}

/** 갱목 지지대 (기둥 두 개 + 들보) */
export function makeSupportBeam(width = 4) {
  const g = new THREE.Group();
  const timber = surf('wood', 0x6e4e32);
  for (const sx of [-1, 1]) {
    const post = mesh(box(0.3, 3.4, 0.3), timber);
    post.position.set(sx * width / 2, 1.7, 0);
    g.add(post);
  }
  const beam = mesh(box(width + 0.5, 0.32, 0.34), timber);
  beam.position.y = 3.45;
  g.add(beam);
  return g;
}

/** 광산 출구: 바깥 햇빛이 새어 드는 나무 틀 */
export function makeMineExit() {
  const g = new THREE.Group();
  const light = mesh(new THREE.PlaneGeometry(2.4, 2.8), new THREE.MeshBasicMaterial({ color: 0xfff4d0, side: THREE.DoubleSide }), false);
  light.position.set(0, 1.4, 0.2);
  g.add(light);
  const timber = surf('wood', 0x7a5a3a);
  for (const sx of [-1, 1]) {
    const post = mesh(box(0.3, 3.1, 0.3), timber);
    post.position.set(sx * 1.4, 1.55, 0);
    g.add(post);
  }
  const lintel = mesh(box(3.4, 0.32, 0.34), timber);
  lintel.position.set(0, 3.1, 0);
  g.add(lintel);
  const label = makeLabel('출구 · 마을로');
  label.position.set(0, 3.9, 0);
  g.add(label);
  return g;
}

/** 아래층으로 내려가는 구멍 + 사다리 머리 */
export function makeLadderDown(label) {
  const g = new THREE.Group();
  const pit = mesh(new THREE.CircleGeometry(1.25, 28), new THREE.MeshBasicMaterial({ color: 0x0c0907 }), false);
  pit.rotation.x = -Math.PI / 2;
  pit.position.y = 0.03;
  g.add(pit);
  const rimM = mat(0x5a4c40, { roughness: 0.95 });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const r = makeRock(0.38 + Math.random() * 0.18);
    r.material = rimM;
    r.position.set(Math.cos(a) * 1.4, r.position.y, Math.sin(a) * 1.4);
    g.add(r);
  }
  const wood = surf('wood', 0x8a6444);
  for (const sx of [-0.32, 0.32]) {
    const rail = mesh(box(0.08, 1.2, 0.08), wood);
    rail.position.set(sx, 0.35, -0.2);
    rail.rotation.x = 0.25;
    g.add(rail);
  }
  for (let i = 0; i < 3; i++) {
    const rung = mesh(box(0.64, 0.06, 0.06), wood);
    rung.position.set(0, 0.05 + i * 0.32, -0.12 - i * 0.08);
    g.add(rung);
  }
  // 나무 틀 + 등불
  for (const sx of [-1, 1]) {
    const post = mesh(box(0.16, 2.2, 0.16), wood);
    post.position.set(sx * 1.55, 1.1, -1.1);
    g.add(post);
  }
  const beam = mesh(box(3.4, 0.18, 0.18), wood);
  beam.position.set(0, 2.2, -1.1);
  const lamp = mesh(new THREE.SphereGeometry(0.13, 12, 10), GLOW_MAT, false);
  lamp.position.set(0, 1.92, -1.1);
  g.add(beam, lamp);
  const sign = makeLabel(label, { scale: 0.8 });
  sign.position.set(0, 3.0, -1.1);
  g.add(sign);
  return g;
}

/** 위층으로 올라가는 사다리 (벽에 기대어 위로) + 위에서 내려오는 빛 */
export function makeLadderUp(label) {
  const g = new THREE.Group();
  const wood = surf('wood', 0x8a6444);
  for (const sx of [-0.4, 0.4]) {
    const rail = mesh(box(0.09, 4.6, 0.09), wood);
    rail.position.set(sx, 2.2, -0.35);
    rail.rotation.x = -0.18;
    g.add(rail);
  }
  for (let i = 0; i < 9; i++) {
    const rung = mesh(box(0.8, 0.06, 0.06), wood);
    rung.position.set(0, 0.3 + i * 0.48, -0.35 - i * 0.085);
    g.add(rung);
  }
  const shaft = mesh(new THREE.CylinderGeometry(0.9, 1.3, 4.5, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }), false);
  shaft.position.set(0, 2.25, -0.6);
  g.add(shaft);
  const sign = makeLabel(label, { scale: 0.8 });
  sign.position.set(0, 5.2, -0.4);
  g.add(sign);
  return g;
}

/** 돌쇠의 곡괭이 좌판 */
export function makePickStall() {
  const g = new THREE.Group();
  const wood = surf('wood', 0xa07850);
  const top = mesh(box(2.4, 0.1, 0.9), wood);
  top.position.y = 0.85;
  g.add(top);
  for (const sx of [-1.05, 1.05]) for (const sz of [-0.35, 0.35]) {
    const leg = mesh(box(0.1, 0.85, 0.1), wood);
    leg.position.set(sx, 0.42, sz);
    g.add(leg);
  }
  [0xc8733a, 0xb8c0c8, 0xf2c641, 0x7ee0f0].forEach((c, i) => {
    const h = mesh(cyl(0.025, 0.025, 0.7, 8), surf('wood', 0x9a7a58));
    h.rotation.z = Math.PI / 2;
    h.position.set(-0.8 + i * 0.52, 0.94, 0.1 - (i % 2) * 0.2);
    h.rotation.y = 0.5;
    const head = mesh(box(0.08, 0.06, 0.42), surf('metal', c, { roughness: 0.35 }));
    head.position.set(-0.8 + i * 0.52 + 0.28, 0.94, 0.1 - (i % 2) * 0.2 - 0.16);
    head.rotation.y = 0.5;
    g.add(h, head);
  });
  const label = makeLabel('곡괭이 팝니다', { scale: 0.7 });
  label.position.set(0, 2.2, 0);
  g.add(label);
  return g;
}

/** 광산 바닥 + 바위벽 (로컬 좌표, 바닥 크기 w x d, exitZ: 서쪽 벽 출구 자리 · null 이면 출구 없음, tint: 바닥 색) */
export function makeCaveShell(w, d, exitZ = null, tint = 0x8a7462) {
  const g = new THREE.Group();
  const floorTex = TX.dirtPathTex();
  const floor = tiledPlane(110, 110, 3, new THREE.MeshStandardMaterial({ map: floorTex.map, normalMap: floorTex.normalMap, color: tint, roughness: 0.95 }));
  floor.position.y = 0.0;
  g.add(floor);
  // 바깥 어둠: 방 밖은 낮은 바위 지붕처럼 덮는다
  const tc = new THREE.Color(tint);
  const wallM = surf('stone', tc.clone().multiplyScalar(0.78).getHex());
  const rockC = tc.clone().multiplyScalar(0.9).getHex();
  const hw = w / 2, hd = d / 2;
  // 카메라는 남쪽(+z)에서 내려다보므로 남쪽 벽은 낮게
  const walls = [
    [0, -hd - 1.6, w + 7, 3.2, 5.2],
    [-hw - 1.6, 0, 3.2, d + 4, 4.6],
    [hw + 1.6, 0, 3.2, d + 4, 4.6],
    [0, hd + 1.6, w + 7, 2.6, 0.5],
  ];
  for (const [x, z, sx, sz, h] of walls) {
    const wall = mesh(box(sx, h, sz, Math.min(0.4, h / 2)), wallM, true, true);
    wall.position.set(x, h / 2, z);
    g.add(wall);
  }
  // 벽 앞 울퉁불퉁한 바위 (서쪽 출구 자리는 비움)
  const rocks = [];
  for (let x = -hw; x <= hw; x += 2.2) rocks.push([x, -hd - 0.2, 1.6 + Math.random()]);
  for (let z = -hd; z <= hd; z += 2.4) {
    if (exitZ === null || z < exitZ - 2.2 || z > exitZ + 2.2) rocks.push([-hw - 0.2, z, 1.3 + Math.random() * 0.8]);
    rocks.push([hw + 0.2, z, 1.3 + Math.random() * 0.8]);
  }
  for (let x = -hw; x <= hw; x += 2.6) rocks.push([x, hd + 0.5, 0.5 + Math.random() * 0.3]);
  for (const [x, z, s] of rocks) {
    const r = makeRock(s);
    r.material = mat(rockC, { roughness: 0.9 });
    r.position.set(x + (Math.random() - 0.5) * 0.6, r.position.y, z + (Math.random() - 0.5) * 0.4);
    g.add(r);
  }
  return g;
}

// ───────── 광맥 ─────────
/** 광맥: 바위 위에 광석 덩어리(결정)가 박혀 있다. userData.ore 로 다시 칠할 수 있게 crystals 그룹을 둔다 */
export function makeOreNode() {
  const g = new THREE.Group();
  const base = mesh(new THREE.DodecahedronGeometry(0.75, 0), mat(0x6e6660, { roughness: 0.9 }), true, true);
  base.scale.set(1.15, 0.75, 1);
  base.position.y = 0.42;
  base.rotation.y = Math.random() * Math.PI;
  const crystals = new THREE.Group();
  g.add(base, crystals);
  g.userData.crystals = crystals;
  g.userData.base = base;
  return g;
}

const crystalMats = {};
function crystalMat(oreId) {
  if (!crystalMats[oreId]) {
    const o = ORES[oreId];
    const shiny = oreId !== 'ore_coal';
    crystalMats[oreId] = new THREE.MeshStandardMaterial({
      color: o.color, roughness: shiny ? 0.25 : 0.7, metalness: shiny ? 0.35 : 0,
      emissive: o.glow, emissiveIntensity: 1,
    });
  }
  return crystalMats[oreId];
}

/** 광맥 모양을 광석 종류에 맞게 다시 만든다 (oreId 가 null 이면 캐낸 자리 = 낮은 돌무더기) */
export function setOreNode(node, oreId) {
  const c = node.userData.crystals;
  while (c.children.length) c.remove(c.children[0]);
  node.userData.base.scale.set(1.15, oreId ? 0.75 : 0.32, 1);
  node.userData.base.position.y = oreId ? 0.42 : 0.18;
  if (!oreId) return;
  const m = crystalMat(oreId);
  const gem = oreId === 'ore_amethyst';
  const n = gem ? 6 : 5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const piece = gem
      ? mesh(new THREE.OctahedronGeometry(0.2 + Math.random() * 0.1), m)
      : mesh(new THREE.DodecahedronGeometry(0.14 + Math.random() * 0.08), m);
    if (gem) piece.scale.y = 1.8;
    piece.position.set(Math.cos(a) * 0.5, 0.55 + Math.random() * 0.3, Math.sin(a) * 0.42);
    piece.rotation.set(Math.random() * 0.6, Math.random() * 3, Math.random() * 0.6);
    c.add(piece);
  }
}

// ───────── 시설: 약탕기 (2.5 x 2.5) ─────────
export function makeBrewer() {
  const g = new THREE.Group();
  const stone = surf('stone', 0xa49a8e);
  const hearth = mesh(cyl(0.85, 0.95, 0.55, 18), stone, true, true);
  hearth.position.y = 0.27;
  const fire = mesh(cyl(0.45, 0.45, 0.06, 14), FIRE_MAT, false);
  fire.position.y = 0.56;
  // 옹기 약탕기
  const potM = mat(0x5a3a26, { roughness: 0.35 });
  const pot = mesh(new THREE.SphereGeometry(0.6, 22, 16), potM);
  pot.scale.set(1, 0.85, 1);
  pot.position.y = 1.05;
  const rim = mesh(cyl(0.38, 0.42, 0.12, 18), potM);
  rim.position.y = 1.55;
  const lid = mesh(new THREE.SphereGeometry(0.36, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x6a4a32, { roughness: 0.4 }));
  lid.scale.y = 0.5;
  lid.position.y = 1.6;
  const knob = mesh(new THREE.SphereGeometry(0.07, 10, 8), mat(0x6a4a32));
  knob.position.y = 1.8;
  const spout = mesh(cyl(0.05, 0.09, 0.4, 10), potM);
  spout.rotation.z = -1.0;
  spout.position.set(0.68, 1.15, 0);
  const handle = mesh(cyl(0.05, 0.05, 0.5, 8), surf('wood', 0x7a5a3a));
  handle.rotation.z = Math.PI / 2;
  handle.position.set(-0.8, 1.1, 0);
  g.add(hearth, fire, pot, rim, lid, knob, spout, handle);
  // 작은 기와 지붕 (네 기둥)
  const wood = surf('wood', 0x8a6444);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const post = mesh(box(0.12, 2.3, 0.12), wood);
    post.position.set(sx * 1.05, 1.15, sz * 1.05);
    g.add(post);
  }
  const roofM = surf('shingle', 0x8a5a4a);
  for (const sx of [-1, 1]) {
    const slab = mesh(new THREE.BoxGeometry(1.6, 0.08, 2.7), roofM, true, true);
    slab.rotation.z = -sx * 0.5;
    slab.position.set(sx * 0.68, 2.62, 0);
    g.add(slab);
  }
  // 김 (애니메이션)
  const steam = [];
  const steamM = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, roughness: 1 });
  for (let i = 0; i < 4; i++) {
    const puff = mesh(new THREE.SphereGeometry(0.16, 10, 8), steamM.clone(), false);
    puff.position.set(0, 1.9, 0);
    g.add(puff);
    steam.push(puff);
  }
  const label = makeLabel('약탕기', { scale: 0.8 });
  label.position.y = 3.5;
  g.add(label);
  g.userData.anim = { steam, fire };
  return g;
}

// ───────── 시설: 육묘장 (5 x 2.5) — 작은 비닐하우스 ─────────
export function makeNursery() {
  const g = new THREE.Group();
  const L = 4.8, R = 1.15;
  const wood = surf('wood', 0x9a7450);
  const base = mesh(box(L, 0.2, 2.4), wood, true, true);
  base.position.y = 0.1;
  g.add(base);
  const soil = mesh(box(L - 0.3, 0.06, 2.1), mat(0x5a4030, { roughness: 1 }), false, true);
  soil.position.y = 0.22;
  g.add(soil);
  // 모판 + 새싹
  const tray = mat(0x2e5a3a, { roughness: 0.7 });
  const sproutM = mat(0x7cc05a, { roughness: 0.6 });
  for (let i = 0; i < 4; i++) for (const sz of [-0.5, 0.5]) {
    const t = mesh(box(0.95, 0.12, 0.8), tray);
    t.position.set(-1.65 + i * 1.1, 0.32, sz);
    g.add(t);
    for (let k = 0; k < 6; k++) {
      const s = mesh(new THREE.ConeGeometry(0.05, 0.18, 5), sproutM, false);
      s.position.set(-1.65 + i * 1.1 + ((k % 3) - 1) * 0.28, 0.46, sz + (k < 3 ? -0.2 : 0.2));
      g.add(s);
    }
  }
  // 반원 비닐 지붕 + 쇠 활대
  const film = new THREE.MeshStandardMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.38, roughness: 0.2, side: THREE.DoubleSide, depthWrite: false });
  const cover = mesh(new THREE.CylinderGeometry(R, R, L, 28, 1, true, 0, Math.PI), film, false);
  cover.rotation.z = Math.PI / 2;
  cover.position.y = 0.2;
  g.add(cover);
  const hoopM = surf('metal', 0xd8dce0);
  for (let i = 0; i <= 4; i++) {
    const hoop = mesh(new THREE.TorusGeometry(R, 0.03, 6, 24, Math.PI), hoopM);
    hoop.rotation.y = Math.PI / 2;
    hoop.position.set(-L / 2 + (L / 4) * i, 0.2, 0);
    g.add(hoop);
  }
  for (const sx of [-1, 1]) {
    const end = mesh(new THREE.CircleGeometry(R, 24, 0, Math.PI), film, false);
    end.rotation.y = sx * Math.PI / 2;
    end.position.set(sx * L / 2, 0.2, 0);
    g.add(end);
  }
  const label = makeLabel('육묘장', { scale: 0.8 });
  label.position.y = 2.3;
  g.add(label);
  return g;
}

// ───────── 새 마을회관 (완공 후) — 앞 = +z ─────────
export function makeGrandHall() {
  const g = makeBuilding({ w: 11, d: 7, h: 5.2, wall: 0xfdf8ee, roof: 0x3e8a4e, roofH: 3.0, facing: 'south', label: '새 마을회관', trim: 0x6a4a30, wallKind: 'plaster' });
  // makeBuilding 이 이미 방향대로 돌려 두었으니(south = 0) 로컬 좌표 그대로 덧붙인다
  // 간판은 시계탑 위로 올린다
  const sign = g.children.find((c) => c.isSprite);
  if (sign) sign.position.y = 5.2 + 3.0 + 4.3;
  // 시계탑
  const towerM = surf('plaster', 0xfffaf0);
  const tower = mesh(box(1.8, 2.4, 1.8, 0.06), towerM, true, true);
  tower.position.set(0, 5.2 + 3.0 + 0.6, 0.6);
  const towerRoof = mesh(new THREE.ConeGeometry(1.5, 1.6, 4), surf('shingle', 0x2e6a3a));
  towerRoof.rotation.y = Math.PI / 4;
  towerRoof.position.set(0, 5.2 + 3.0 + 2.6, 0.6);
  g.add(tower, towerRoof);
  const face = mesh(new THREE.CircleGeometry(0.62, 32), new THREE.MeshStandardMaterial({ map: clockTexture(), roughness: 0.5 }), false);
  face.position.set(0, 5.2 + 3.0 + 0.7, 1.52);
  g.add(face);
  // 현관 기둥 + 차양
  const colM = surf('plaster', 0xf6f0e4);
  for (const x of [-3.2, -1.6, 1.6, 3.2]) {
    const col = mesh(cyl(0.18, 0.2, 3.2, 16), colM);
    col.position.set(x, 1.6 + 0.45, 3.5 + 0.9);
    g.add(col);
  }
  const porch = mesh(box(7.6, 0.25, 2.2, 0.06), surf('shingle', 0x3e8a4e), true, true);
  porch.position.set(0, 3.75 + 0.45, 3.5 + 0.8);
  g.add(porch);
  const stairs = mesh(box(4.2, 0.2, 1.4, 0.04), surf('stone', 0xc4bcb0), true, true);
  stairs.position.set(0, 0.1, 3.5 + 0.9);
  g.add(stairs);
  // 양쪽 화단
  for (const sx of [-1, 1]) {
    const bed = mesh(box(2.2, 0.4, 0.8), surf('stone', 0xb8ae9e), true, true);
    bed.position.set(sx * 4.4, 0.2, 3.5 + 1.6);
    g.add(bed);
    const bush = mesh(new THREE.SphereGeometry(0.45, 12, 10), mat(0x5aa04a, { roughness: 0.9 }));
    bush.scale.set(2, 0.8, 0.9);
    bush.position.set(sx * 4.4, 0.6, 3.5 + 1.6);
    g.add(bush);
  }
  return g;
}

function clockTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fffaf0';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#4a3a2a';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(64, 64, 58, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.fillStyle = '#4a3a2a';
    ctx.beginPath(); ctx.arc(64 + Math.cos(a) * 46, 64 + Math.sin(a) * 46, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.lineCap = 'round';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(64, 64); ctx.lineTo(64, 30); ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(64, 64); ctx.lineTo(90, 70); ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 공사 중 비계 (건물 크기 w x d 를 둘러쌈) */
export function makeScaffold(w, d, h) {
  const g = new THREE.Group();
  const pipe = surf('metal', 0x9aa0a6);
  const plank = surf('wood', 0xc8a070);
  const pts = [];
  for (let x = -w / 2 - 0.6; x <= w / 2 + 0.7; x += 2.4) { pts.push([x, d / 2 + 0.6]); pts.push([x, -d / 2 - 0.6]); }
  for (let z = -d / 2 + 1.2; z < d / 2; z += 2.4) { pts.push([-w / 2 - 0.6, z]); pts.push([w / 2 + 0.6, z]); }
  for (const [x, z] of pts) {
    const p = mesh(cyl(0.05, 0.05, h, 6), pipe);
    p.position.set(x, h / 2, z);
    g.add(p);
  }
  for (const y of [1.6, 3.2, h - 0.2]) {
    for (const sz of [-1, 1]) {
      const pl = mesh(box(w + 1.4, 0.08, 0.5), plank);
      pl.position.set(0, y, sz * (d / 2 + 0.6));
      g.add(pl);
    }
    for (const sx of [-1, 1]) {
      const pl = mesh(box(0.5, 0.08, d + 1.4), plank);
      pl.position.set(sx * (w / 2 + 0.6), y, 0);
      g.add(pl);
    }
  }
  // 쌓아 둔 자재
  for (let i = 0; i < 4; i++) {
    const b = mesh(box(2.2, 0.16, 0.4), plank);
    b.position.set(w / 2 + 2.2, 0.1 + i * 0.17, d / 2 + 1.6);
    g.add(b);
  }
  const sign = makeLabel('🚧 공사 중', { scale: 0.8 });
  sign.position.set(0, h + 1.2, d / 2 + 0.6);
  g.add(sign);
  return g;
}
