import * as THREE from 'three';
import {
  mat, mesh, makeBuilding, makeStorageBarn, makeAnvil, makeFurnace, makeTree, makeBush, makeFlower,
  makeRock, makeFenceLine, makeLamp, makeBench, makeFlowerPot, makeFishingRod, makeEasel, makeLabel,
} from './Models.js';

export const BOUNDS = 37;
export const STREAM_Z = -32;
export const PLAZA = new THREE.Vector3(0, 0, -6);
// 밭은 북동쪽 모서리(출입구 쪽)를 기준으로 서쪽·남쪽으로 넓어진다
export const FARM_EAST = -14.8;
export const FARM_NORTH = 22;
export const PLOT_STEP = 1.7;
export const FARM_SIGN_POS = { x: -18.4, z: FARM_NORTH - 1 };
export const STORAGE_ROOF = new THREE.Vector3(-9, 5.6, 27);

// 상호작용 대상 루트 오브젝트 (Raycaster 대상)
export const interactables = [];
// 충돌체: { minX, maxX, minZ, maxZ } 또는 { x, z, r }
export const colliders = [];
let fenceColliders = [];
let fenceGroup = null;
let fenceSize = 0;
let worldScene = null;

// 건물 정보: 상호작용 지점(ix, iz)
export const BUILDINGS = {
  house:   { name: '주인공의 집', x: -19, z: 13,  w: 7,  d: 6, facing: 'east',  ix: -14.6, iz: 13 },
  storage: { name: '창고',       x: -9,  z: 27,  w: 5,  d: 5, facing: 'west',  ix: -12.4, iz: 27 },
  shop:    { name: '상점',       x: -20, z: -4,  w: 7,  d: 6, facing: 'east',  ix: -15.6, iz: -4 },
  forge:   { name: '대장간',     x: -20, z: -17, w: 7,  d: 6, facing: 'east',  ix: -15.6, iz: -17 },
  hall:    { name: '마을회관',   x: 0,   z: -20, w: 10, d: 7, facing: 'south', ix: 0,     iz: -14.6 },
  grandma: { name: '김 할머니 집', x: 20, z: -17, w: 6,  d: 6, facing: 'west',  ix: 15.6,  iz: -17 },
  sua:     { name: '수아의 꽃집', x: 20,  z: -4,  w: 6,  d: 6, facing: 'west',  ix: 15.6,  iz: -4 },
};

let groundMat;
let streamTex;
const deco = {};

function addBoxCollider(cx, cz, sx, sz, pad = 0.2) {
  colliders.push({ minX: cx - sx / 2 - pad, maxX: cx + sx / 2 + pad, minZ: cz - sz / 2 - pad, maxZ: cz + sz / 2 + pad });
}

function addCircle(x, z, r) {
  colliders.push({ x, z, r });
}

function strip(x1, z1, x2, z2, width, color, y = 0.02) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const m = mesh(new THREE.PlaneGeometry(len, width), mat(color), false, true);
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = Math.atan2(-(z2 - z1), x2 - x1);
  m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
  return m;
}

function inZone(x, z) {
  // 나무를 심지 않을 영역
  if (x > -31 && x < -6 && z > 9) return true; // 집, 밭(최대 8x8), 창고
  if (Math.abs(x) < 26 && z > -25 && z < 7) return true; // 마을 중심
  if (z > -36 && z < -28) return true; // 시냇물
  if (x > 3 && x < 16 && z > 18 && z < 30) return true; // 꽃밭
  if (x > -2 && x < 18 && z > -30 && z < -12) return true; // 시냇물 가는 길
  return false;
}

export function buildWorld(scene) {
  worldScene = scene;
  // 지면
  groundMat = new THREE.MeshLambertMaterial({ color: 0x8bc34a });
  const ground = mesh(new THREE.PlaneGeometry(160, 160), groundMat, false, true);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // 길
  const PATH = 0xe3c99a;
  scene.add(strip(-32, 4, 32, 4, 3, PATH));
  scene.add(strip(0, 4, 0, -15, 3, PATH, 0.021));
  scene.add(strip(-15, 4, -15, 20, 2.4, PATH, 0.022));
  scene.add(strip(-15, -4, -2, -4, 2.2, PATH, 0.023));
  scene.add(strip(-15, -17, -2, -17, 2.2, PATH, 0.023));
  scene.add(strip(-15, -17, -15, 4, 2.2, PATH, 0.024));
  scene.add(strip(2, -4, 15, -4, 2.2, PATH, 0.023));
  scene.add(strip(2, -17, 15, -17, 2.2, PATH, 0.023));
  scene.add(strip(15, -17, 15, 4, 2.2, PATH, 0.024));
  scene.add(strip(-15, 20, -12.6, 20, 2, PATH, 0.022));
  scene.add(strip(-12.6, 19, -12.6, 27, 1.6, PATH, 0.023));
  scene.add(strip(0, -15, 10, -28, 1.6, PATH, 0.021));

  // 광장
  const plaza = mesh(new THREE.CircleGeometry(6.5, 40), mat(0xd9c3a0), false, true);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(PLAZA.x, 0.03, PLAZA.z);
  scene.add(plaza);
  const ring = mesh(new THREE.RingGeometry(6.5, 7, 40), mat(0xbfa580), false, true);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(PLAZA.x, 0.035, PLAZA.z);
  scene.add(ring);
  // 광장 중앙 나무 + 화단
  const bigTree = makeTree('round', 1.5);
  bigTree.position.set(PLAZA.x, 0, PLAZA.z);
  scene.add(bigTree);
  addCircle(PLAZA.x, PLAZA.z, 0.8);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const f = makeFlower();
    f.position.set(PLAZA.x + Math.cos(a) * 1.6, 0, PLAZA.z + Math.sin(a) * 1.6);
    scene.add(f);
  }
  for (const [x, z, ry] of [[-4.5, -9.5, 0.6], [4.5, -9.5, -0.6], [-4.5, -2.5, Math.PI - 0.6], [4.5, -2.5, Math.PI + 0.6]]) {
    const b = makeBench();
    b.position.set(x, 0, z);
    b.rotation.y = ry;
    scene.add(b);
  }

  // 시냇물
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5fb7e8';
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    const y = 6 + i * 7;
    for (let x = 0; x <= 256; x += 8) ctx.lineTo(x, y + Math.sin((x / 256) * Math.PI * 4 + i) * 3);
    ctx.stroke();
  }
  streamTex = new THREE.CanvasTexture(c);
  streamTex.wrapS = streamTex.wrapT = THREE.RepeatWrapping;
  streamTex.repeat.set(10, 1);
  streamTex.colorSpace = THREE.SRGBColorSpace;
  const stream = mesh(new THREE.PlaneGeometry(150, 4), new THREE.MeshLambertMaterial({ map: streamTex, transparent: true, opacity: 0.92 }), false, true);
  stream.rotation.x = -Math.PI / 2;
  stream.position.set(0, 0.04, STREAM_Z);
  scene.add(stream);
  scene.add(strip(-75, STREAM_Z - 2.3, 75, STREAM_Z - 2.3, 0.8, 0xb9a58a, 0.035));
  scene.add(strip(-75, STREAM_Z + 2.3, 75, STREAM_Z + 2.3, 0.8, 0xb9a58a, 0.035));
  colliders.push({ minX: -80, maxX: 80, minZ: STREAM_Z - 2, maxZ: STREAM_Z + 1.8 });
  for (let i = 0; i < 18; i++) {
    const r = makeRock(0.5 + Math.random() * 0.6);
    r.position.x = -34 + Math.random() * 68;
    r.position.z = STREAM_Z + (Math.random() < 0.5 ? -2.6 : 2.6);
    scene.add(r);
  }

  // 건물
  const houseMeshes = {
    house:   makeBuilding({ w: 7, d: 6, h: 3.4, wall: 0xfff3dc, roof: 0xe57361, facing: 'east', label: '우리 집', chimney: true }),
    storage: makeStorageBarn(),
    shop:    makeBuilding({ w: 7, d: 6, h: 3.6, wall: 0xfff8e7, roof: 0x5c8dd6, facing: 'east', label: '상점' }),
    forge:   makeBuilding({ w: 7, d: 6, h: 3.4, wall: 0xd9cbb8, roof: 0x6b5a4e, facing: 'east', label: '대장간', chimney: true }),
    hall:    makeBuilding({ w: 10, d: 7, h: 4.4, wall: 0xfff3dc, roof: 0x4f8a3c, roofH: 2.8, facing: 'south', label: '마을회관' }),
    grandma: makeBuilding({ w: 6, d: 6, h: 3.2, wall: 0xf7e4c8, roof: 0xb07cc6, facing: 'west', label: '김 할머니 댁', chimney: true }),
    sua:     makeBuilding({ w: 6, d: 6, h: 3.2, wall: 0xfff0f5, roof: 0xf28fb0, facing: 'west', label: '수아 꽃집' }),
  };
  for (const [id, b] of Object.entries(BUILDINGS)) {
    const g = houseMeshes[id];
    g.position.set(b.x, 0, b.z);
    g.userData = { type: 'building', id };
    scene.add(g);
    interactables.push(g);
    const rotated = b.facing === 'east' || b.facing === 'west';
    addBoxCollider(b.x, b.z, rotated ? b.d : b.w, rotated ? b.w : b.d);
  }

  // 마을회관 깃발
  const pole = mesh(new THREE.CylinderGeometry(0.06, 0.06, 6, 8), mat(0xdddddd));
  pole.position.set(6.5, 3, -16);
  const flag = mesh(new THREE.PlaneGeometry(1.6, 1), new THREE.MeshLambertMaterial({ color: 0x6fbf4a, side: THREE.DoubleSide }));
  flag.position.set(7.3, 5.4, -16);
  scene.add(pole, flag);
  deco.flag = flag;
  addCircle(6.5, -16, 0.3);

  // 대장간 소품
  const anvil = makeAnvil();
  anvil.position.set(-15.5, 0, -19.6);
  const furnace = makeFurnace();
  furnace.position.set(-16, 0, -14.2);
  furnace.rotation.y = Math.PI / 2;
  scene.add(anvil, furnace);
  addCircle(-15.5, -19.6, 0.6);
  addCircle(-16, -14.2, 0.9);

  // 꽃집 화분
  for (const [x, z] of [[16.2, -6.6], [16.2, -1.4], [16.2, -7.6]]) {
    const p = makeFlowerPot();
    p.position.set(x, 0, z);
    scene.add(p);
  }

  // 밭 울타리는 setFarmFence(size)에서 밭 크기에 맞춰 만든다
  setFarmFence(3);

  // 밭 팻말 (클릭하면 밭 확장 구매)
  const sign = new THREE.Group();
  const post = mesh(new THREE.BoxGeometry(0.16, 1.3, 0.16), mat(0x8b5e3c));
  post.position.y = 0.65;
  const board = mesh(new THREE.BoxGeometry(1.3, 0.7, 0.1), mat(0xd8b07e));
  board.position.y = 1.25;
  const farmSign = makeLabel('🌾 내 밭 · 확장', { scale: 0.75 });
  farmSign.position.y = 2.3;
  sign.add(post, board, farmSign);
  sign.position.set(FARM_SIGN_POS.x, 0, FARM_SIGN_POS.z - 0.35);
  sign.userData = { type: 'farmSign' };
  scene.add(sign);
  addCircle(sign.position.x, sign.position.z, 0.2);
  interactables.push(sign);

  // 꽃밭
  for (let i = 0; i < 70; i++) {
    const f = makeFlower();
    f.position.set(5 + Math.random() * 9, 0, 20 + Math.random() * 8);
    scene.add(f);
  }

  // 가로등
  const lampPos = [[-8, 5.8], [8, 5.8], [-24, 5.8], [24, 5.8], [-13.4, 12], [2, -13], [-2, -13], [-10.8, 20.8]];
  for (const [x, z] of lampPos) {
    const l = makeLamp();
    l.position.set(x, 0, z);
    scene.add(l);
    addCircle(x, z, 0.25);
  }

  // 나무 / 덤불 / 바위
  let placed = 0;
  let guard = 0;
  while (placed < 110 && guard++ < 3000) {
    const x = -46 + Math.random() * 92;
    const z = -46 + Math.random() * 92;
    if (inZone(x, z)) continue;
    const edge = Math.abs(x) > 30 || Math.abs(z) > 30;
    if (!edge && Math.random() < 0.6) continue;
    const t = makeTree(Math.random() < 0.35 ? 'pine' : 'round', 0.8 + Math.random() * 0.6);
    t.position.set(x, 0, z);
    scene.add(t);
    addCircle(x, z, 0.5);
    placed++;
  }
  for (let i = 0; i < 40; i++) {
    const x = -36 + Math.random() * 72;
    const z = -26 + Math.random() * 62;
    if (inZone(x, z)) continue;
    const b = makeBush();
    b.position.set(x, 0, z);
    scene.add(b);
  }
  // 맵 가장자리 울타리 (덤불 벽)
  for (const [x1, z1, x2, z2] of [[-38, -38, 38, -38], [-38, 38, 38, 38], [-38, -38, -38, 38], [38, -38, 38, 38]]) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const hedge = mesh(new THREE.BoxGeometry(len, 1.4, 1.2), mat(0x4f9a3a), true, true);
    hedge.position.set((x1 + x2) / 2, 0.7, (z1 + z2) / 2);
    hedge.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    scene.add(hedge);
  }

  // 획득형 장식 (민지의 그림, 낚싯대)
  deco.easel = makeEasel();
  deco.easel.position.set(-14.8, 0, 10.2);
  deco.easel.rotation.y = Math.PI / 2;
  deco.rod = makeFishingRod();
  deco.rod.position.set(-14.8, 0, 16);
  scene.add(deco.easel, deco.rod);
  deco.easel.visible = false;
  deco.rod.visible = false;
}

export function updateDecorations(flags) {
  if (deco.easel) deco.easel.visible = !!flags.deco_drawing;
  if (deco.rod) deco.rod.visible = !!flags.deco_rod;
}

export function updateWorld(dt, t) {
  if (streamTex) streamTex.offset.x -= dt * 0.05;
  if (deco.flag) deco.flag.rotation.y = Math.sin(t * 2) * 0.15;
}

export function setSnowLevel(v) {
  if (!groundMat) return;
  groundMat.color.setHex(0x8bc34a).lerp(new THREE.Color(0xf2f6f8), v);
}

export function plotPosition(r, c) {
  return {
    x: FARM_EAST - c * PLOT_STEP - PLOT_STEP / 2,
    z: FARM_NORTH + r * PLOT_STEP + PLOT_STEP / 2,
  };
}

/** 밭 크기(size x size)에 맞는 울타리 영역 */
function farmRect(size) {
  return {
    x1: FARM_EAST - PLOT_STEP * size - 1, x2: FARM_EAST + 1,
    z1: FARM_NORTH - 1, z2: FARM_NORTH + PLOT_STEP * size + 1,
  };
}

export function farmCenter(size) {
  return { x: FARM_EAST - (PLOT_STEP * size) / 2, z: FARM_NORTH + (PLOT_STEP * size) / 2 };
}

let FARM_RECT = farmRect(3);
// 북쪽 출입구 x: NORTH_GATE_X ~ x2, 동쪽 출입구 z: EAST_GATE_Z1 ~ EAST_GATE_Z2
const NORTH_GATE_X = -17;
const EAST_GATE_Z1 = 24.5, EAST_GATE_Z2 = 27.5;
const FARM_GATES = [
  { out: { x: -15.4, z: FARM_NORTH - 2.2 }, in: { x: -15.4, z: FARM_NORTH + 0.2 } },
  { out: { x: FARM_EAST + 2.2, z: 26 }, in: { x: FARM_EAST - 0.2, z: 26 } },
];

/** 밭 크기에 맞춰 울타리(모델 + 충돌체)를 다시 만든다 */
export function setFarmFence(size) {
  if (size === fenceSize || !worldScene) return;
  fenceSize = size;
  if (fenceGroup) worldScene.remove(fenceGroup);
  fenceGroup = new THREE.Group();
  const { x1, x2, z1, z2 } = FARM_RECT = farmRect(size);
  const lines = [
    [x1, z1, NORTH_GATE_X, z1],
    [x1, z2, x2, z2],
    [x1, z1, x1, z2],
    [x2, z1, x2, EAST_GATE_Z1],
    [x2, Math.min(EAST_GATE_Z2, z2), x2, z2],
  ];
  fenceColliders = [];
  for (const [ax, az, bx, bz] of lines) {
    if (Math.hypot(bx - ax, bz - az) < 0.3) continue;
    fenceGroup.add(makeFenceLine(ax, az, bx, bz));
    fenceColliders.push({
      minX: Math.min(ax, bx) - 0.15, maxX: Math.max(ax, bx) + 0.15,
      minZ: Math.min(az, bz) - 0.15, maxZ: Math.max(az, bz) + 0.15,
    });
  }
  fenceGroup.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  worldScene.add(fenceGroup);
}

function insideFarm(p) {
  return p.x > FARM_RECT.x1 && p.x < FARM_RECT.x2 && p.z > FARM_RECT.z1 && p.z < FARM_RECT.z2;
}

/** 울타리를 넘나드는 이동이면 출입구를 거쳐 가는 경유지 목록을 돌려준다 */
export function farmRoute(from, to) {
  const a = insideFarm(from), b = insideFarm(to);
  if (a === b) return [];
  const dist = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);
  let best = null, bestD = Infinity;
  for (const g of FARM_GATES) {
    const first = a ? g.in : g.out, second = a ? g.out : g.in;
    const d = dist(from, first) + dist(second, to);
    if (d < bestD) { bestD = d; best = [first, second]; }
  }
  return best;
}

export function resolveCollision(pos, radius = 0.4) {
  pos.x = THREE.MathUtils.clamp(pos.x, -BOUNDS, BOUNDS);
  pos.z = THREE.MathUtils.clamp(pos.z, -BOUNDS, BOUNDS);
  for (const list of [colliders, fenceColliders]) for (const c of list) {
    if ('r' in c) {
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const d = Math.hypot(dx, dz);
      const min = c.r + radius;
      if (d < min && d > 0.0001) {
        pos.x = c.x + (dx / d) * min;
        pos.z = c.z + (dz / d) * min;
      }
    } else if (pos.x > c.minX - radius && pos.x < c.maxX + radius && pos.z > c.minZ - radius && pos.z < c.maxZ + radius) {
      const pushL = pos.x - (c.minX - radius);
      const pushR = c.maxX + radius - pos.x;
      const pushU = pos.z - (c.minZ - radius);
      const pushD = c.maxZ + radius - pos.z;
      const m = Math.min(pushL, pushR, pushU, pushD);
      if (m === pushL) pos.x -= pushL;
      else if (m === pushR) pos.x += pushR;
      else if (m === pushU) pos.z -= pushU;
      else pos.z += pushD;
    }
  }
}
