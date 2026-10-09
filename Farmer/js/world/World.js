import * as THREE from 'three';
import {
  mat, surf, mesh, foliage, flowerGeometry, FLOWER_MAT, FLOWER_COLORS, makeBuilding, makeStorageBarn, makeAnvil, makeFurnace, makeTree, makeBush, makeFlower,
  makeRock, makeFenceLine, makeLamp, makeBench, makeFlowerPot, makeFishingRod, makeEasel, makeLabel, LAMP_MAT,
} from './Models.js';
import * as TX from './Textures.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeMineEntrance, makeMinecart, makeClothesline, makeGrandHall, makeScaffold } from './ExtraModels.js';

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
  mine:    { name: '광산',       x: 32,  z: 13,  w: 8,  d: 5, facing: 'west',  ix: 27.6,  iz: 13 },
};
/** 광산에서 나왔을 때 서는 자리 */
export const MINE_DOOR = { x: 27.2, z: 13 };

// 배치한 시설의 충돌체 (FacilitySystem 이 다시 만든다)
export const facilityColliders = [];

// 지금 구역의 이동 범위 (마을 / 광산)
const VILLAGE_BOUNDS = { minX: -BOUNDS, maxX: BOUNDS, minZ: -BOUNDS, maxZ: BOUNDS };
let zoneBounds = VILLAGE_BOUNDS;
export function setZoneBounds(b) {
  zoneBounds = b || VILLAGE_BOUNDS;
}

let snowCover;
let waterNormal;
const deco = {};
let hallCollider = null;
let hallUpgraded = false;
// 길 구간 (풀 심을 때 피하기용): [x1, z1, x2, z2, 폭]
const pathSegs = [];

function addBoxCollider(cx, cz, sx, sz, pad = 0.2) {
  colliders.push({ minX: cx - sx / 2 - pad, maxX: cx + sx / 2 + pad, minZ: cz - sz / 2 - pad, maxZ: cz + sz / 2 + pad });
}

function addCircle(x, z, r) {
  colliders.push({ x, z, r });
}

let pathMat = null;
function getPathMat() {
  if (!pathMat) {
    const t = TX.dirtPathTex();
    const fade = TX.edgeFadeTex();
    fade.channel = 1; // 0~1 원본 UV(uv1)로 가장자리를 흐리게
    pathMat = new THREE.MeshStandardMaterial({
      map: t.map, normalMap: t.normalMap, alphaMap: fade, transparent: true, depthWrite: false,
      color: 0xe2c79c, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
  }
  return pathMat;
}

/** 흙·자갈 길: 텍스처는 3m마다 반복(uv), 가장자리는 원본 UV(uv1)로 부드럽게 */
function strip(x1, z1, x2, z2, width, material = getPathMat(), y = 0.02) {
  pathSegs.push([x1, z1, x2, z2, width]);
  const len = Math.hypot(x2 - x1, z2 - z1) + width * 0.6;
  const g = new THREE.PlaneGeometry(len, width, Math.max(1, Math.round(len / 2)), 1);
  const uv = g.attributes.uv;
  g.setAttribute('uv1', uv.clone());
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * len) / 3, (uv.getY(i) * width) / 3);
  const m = mesh(g, material, false, true);
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = Math.atan2(-(z2 - z1), x2 - x1);
  m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
  return m;
}

export function nearPath(x, z, pad) {
  for (const [x1, z1, x2, z2, w] of pathSegs) {
    const dx = x2 - x1, dz = z2 - z1;
    const t = THREE.MathUtils.clamp(((x - x1) * dx + (z - z1) * dz) / (dx * dx + dz * dz || 1), 0, 1);
    if (Math.hypot(x - (x1 + dx * t), z - (z1 + dz * t)) < w / 2 + pad) return true;
  }
  return false;
}

function blocked(x, z, pad) {
  for (const c of colliders) {
    if ('r' in c) { if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return true; }
    else if (x > c.minX - pad && x < c.maxX + pad && z > c.minZ - pad && z < c.maxZ + pad) return true;
  }
  return false;
}

/** 넓은 지면: 반복되는 잔디 텍스처 위에 큰 얼룩(정점 색)을 얹어 반복 티를 줄인다 */
function makeGround() {
  const g = new THREE.PlaneGeometry(170, 170, 85, 85);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const n = Math.sin(x * 0.11) * Math.cos(z * 0.09) * 0.5 + Math.sin(x * 0.037 + z * 0.05) * 0.5;
    const k = 0.96 + n * 0.05;
    colors.set([k * (1 + n * 0.03), k, k * (1 - n * 0.03)], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 170 / 5, uv.getY(i) * 170 / 5);
  const t = TX.grassTex();
  const m = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, vertexColors: true, roughness: 0.96 });
  return mesh(g, m, false, true);
}

/** 풀 포기를 인스턴스로 흩뿌림 (길·건물·밭·광장·시냇물은 피함) */
function scatterGrass(scene, count) {
  const g1 = new THREE.PlaneGeometry(0.55, 0.42);
  g1.translate(0, 0.21, 0);
  const g2 = g1.clone().rotateY(Math.PI / 2);
  const parts = [g1, g2].map((g) => {
    const n = g.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
    return g;
  });
  const geo = new THREE.BufferGeometry();
  const merged = parts.reduce((acc, g) => {
    acc.pos.push(...g.attributes.position.array);
    acc.nor.push(...g.attributes.normal.array);
    acc.uv.push(...g.attributes.uv.array);
    acc.idx.push(...g.index.array.map((v) => v + acc.offset));
    acc.offset += g.attributes.position.count;
    return acc;
  }, { pos: [], nor: [], uv: [], idx: [], offset: 0 });
  geo.setAttribute('position', new THREE.Float32BufferAttribute(merged.pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(merged.nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(merged.uv, 2));
  geo.setIndex(merged.idx);
  const m = foliage(new THREE.MeshStandardMaterial({ map: TX.grassBladeTex(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1, color: 0xffffff }));
  const inst = new THREE.InstancedMesh(geo, m, count);
  inst.receiveShadow = true;
  const tmp = new THREE.Object3D();
  let n = 0, guard = 0;
  while (n < count && guard++ < count * 6) {
    const x = -40 + Math.random() * 80, z = -40 + Math.random() * 80;
    if (x > -32 && x < -12 && z > 19 && z < 38) continue; // 밭(최대 크기)
    if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < 7.4) continue;
    if (z > -35.5 && z < -28.5) continue;
    if (nearPath(x, z, 0.2) || blocked(x, z, 0.15)) continue;
    tmp.position.set(x, 0, z);
    tmp.rotation.y = Math.random() * Math.PI;
    const s = 0.6 + Math.random() * 0.8;
    tmp.scale.set(s, s * (0.7 + Math.random() * 0.6), s);
    tmp.updateMatrix();
    inst.setMatrixAt(n++, tmp.matrix);
  }
  inst.count = n;
  scene.add(inst);
}

function inZone(x, z) {
  // 나무를 심지 않을 영역
  if (x > -31 && x < -6 && z > 9) return true; // 집, 밭(최대 8x8), 창고
  if (Math.abs(x) < 26 && z > -25 && z < 7) return true; // 마을 중심
  if (z > -36 && z < -28) return true; // 시냇물
  if (x > 3 && x < 16 && z > 18 && z < 30) return true; // 꽃밭
  if (x > -2 && x < 18 && z > -30 && z < -12) return true; // 시냇물 가는 길
  if (x > 14 && z > 4 && z < 22) return true; // 윤 씨네 · 광산 입구
  return false;
}

export function buildWorld(scene) {
  worldScene = scene;
  // 지면
  scene.add(makeGround());
  snowCover = mesh(new THREE.PlaneGeometry(170, 170), new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.85, transparent: true, opacity: 0, depthWrite: false }), false, true);
  snowCover.rotation.x = -Math.PI / 2;
  snowCover.position.y = 0.045;
  snowCover.visible = false;
  scene.add(snowCover);

  // 흙·자갈 길
  scene.add(strip(-32, 4, 32, 4, 3));
  scene.add(strip(0, 4, 0, -15, 3, undefined, 0.021));
  scene.add(strip(-15, 4, -15, 20, 2.4, undefined, 0.022));
  scene.add(strip(-15, -4, -2, -4, 2.2, undefined, 0.023));
  scene.add(strip(-15, -17, -2, -17, 2.2, undefined, 0.023));
  scene.add(strip(-15, -17, -15, 4, 2.2, undefined, 0.024));
  scene.add(strip(2, -4, 15, -4, 2.2, undefined, 0.023));
  scene.add(strip(2, -17, 15, -17, 2.2, undefined, 0.023));
  scene.add(strip(15, -17, 15, 4, 2.2, undefined, 0.024));
  scene.add(strip(-15, 20, -12.6, 20, 2, undefined, 0.022));
  scene.add(strip(-12.6, 19, -12.6, 27, 1.6, undefined, 0.023));
  scene.add(strip(0, -15, 10, -28, 1.6, undefined, 0.021));
  scene.add(strip(24, 4, 27.6, 13, 2, undefined, 0.022)); // 광산 가는 길

  // 광장: 판석 포장 + 돌 경계석
  const pave = TX.pavingTex();
  const plazaGeo = new THREE.CircleGeometry(6.5, 64);
  const puv = plazaGeo.attributes.uv;
  for (let i = 0; i < puv.count; i++) puv.setXY(i, puv.getX(i) * 4.5, puv.getY(i) * 4.5);
  const plaza = mesh(plazaGeo, new THREE.MeshStandardMaterial({ map: pave.map, normalMap: pave.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), color: 0xe4d8c4, roughness: 0.85 }), false, true);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(PLAZA.x, 0.08, PLAZA.z);
  scene.add(plaza);
  const curb = mesh(new THREE.TorusGeometry(6.6, 0.2, 10, 72), mat(0xc8bca8, { roughness: 0.9 }), false, true);
  curb.rotation.x = -Math.PI / 2;
  curb.scale.z = 0.5;
  curb.position.set(PLAZA.x, 0.08, PLAZA.z);
  scene.add(curb);
  // 나무 둘레 화단 테두리
  const bed = mesh(new THREE.TorusGeometry(2.1, 0.16, 10, 48), mat(0xbfb29c, { roughness: 0.9 }), true, true);
  bed.rotation.x = -Math.PI / 2;
  bed.position.set(PLAZA.x, 0.14, PLAZA.z);
  const bedSoil = mesh(new THREE.CircleGeometry(2.05, 40), mat(0x7a5a3e, { roughness: 1 }), false, true);
  bedSoil.rotation.x = -Math.PI / 2;
  bedSoil.position.set(PLAZA.x, 0.1, PLAZA.z);
  scene.add(bed, bedSoil);
  // 광장 중앙 나무 + 화단
  const bigTree = makeTree('round', 1.5);
  bigTree.position.set(PLAZA.x, 0, PLAZA.z);
  scene.add(bigTree);
  buildFestival(scene);
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

  // 시냇물: 어두운 바닥 + 하늘을 비추는 물결 수면 + 자갈 둑
  const bedM = mesh(new THREE.PlaneGeometry(170, 4.6), mat(0x4aa8b8, { roughness: 1 }), false, true);
  bedM.rotation.x = -Math.PI / 2;
  bedM.position.set(0, 0.01, STREAM_Z);
  scene.add(bedM);
  waterNormal = TX.waterNormalTex();
  waterNormal.repeat.set(42, 1.3);
  const water = mesh(new THREE.PlaneGeometry(170, 4.1), new THREE.MeshStandardMaterial({
    color: 0x5cc8dc, roughness: 0.2, metalness: 0, normalMap: waterNormal, normalScale: new THREE.Vector2(0.18, 0.18),
    transparent: true, opacity: 0.88,
  }), false, true);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.06, STREAM_Z);
  water.userData = { type: 'water' }; // 낚싯대를 들고 누르면 낚시
  scene.add(water);
  interactables.push(water);
  // 물가의 하얀 물거품 띠
  for (const side of [-1, 1]) {
    const foam = mesh(new THREE.PlaneGeometry(170, 0.35), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, transparent: true, opacity: 0.75 }), false, false);
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(0, 0.07, STREAM_Z + side * 1.95);
    scene.add(foam);
  }
  scene.add(strip(-80, STREAM_Z - 2.5, 80, STREAM_Z - 2.5, 1.4, undefined, 0.035));
  scene.add(strip(-80, STREAM_Z + 2.5, 80, STREAM_Z + 2.5, 1.4, undefined, 0.035));
  colliders.push({ minX: -80, maxX: 80, minZ: STREAM_Z - 2, maxZ: STREAM_Z + 1.8 });
  for (let i = 0; i < 46; i++) {
    const r = makeRock(0.25 + Math.random() * 0.7);
    r.position.x = -38 + Math.random() * 76;
    r.position.z = STREAM_Z + (Math.random() < 0.5 ? -1 : 1) * (2.1 + Math.random() * 0.8);
    scene.add(r);
  }

  // 건물 (실제 시골 마을 톤: 회벽 · 목재 · 돌 / 기와·슬레이트 지붕)
  const houseMeshes = {
    house:   makeBuilding({ w: 7, d: 6, h: 3.4, wall: 0xfff4e0, roof: 0xd9614a, facing: 'east', label: '우리 집', chimney: true, trim: 0x9a6a46 }),
    storage: makeStorageBarn(),
    shop:    makeBuilding({ w: 7, d: 6, h: 3.6, wall: 0xfdf6e8, roof: 0x5a9ad0, facing: 'east', label: '상점', trim: 0x7a5a3e }),
    forge:   makeBuilding({ w: 7, d: 6, h: 3.4, wall: 0xd6c8b4, roof: 0x6e6862, facing: 'east', label: '대장간', chimney: true, wallKind: 'stone', trim: 0x7a5a3e }),
    hall:    makeBuilding({ w: 10, d: 7, h: 4.4, wall: 0xfff6e6, roof: 0x5eaa58, roofH: 2.8, facing: 'south', label: '마을회관', trim: 0x8a6444 }),
    grandma: makeBuilding({ w: 6, d: 6, h: 3.2, wall: 0xf2dfbc, roof: 0x9a78c8, facing: 'west', label: '김 할머니 댁', chimney: true, wallKind: 'wood', trim: 0x8a6444 }),
    sua:     makeBuilding({ w: 6, d: 6, h: 3.2, wall: 0xfff2f2, roof: 0xf08aa6, facing: 'west', label: '수아 꽃집', trim: 0x9a7058 }),
    mine:    makeMineEntrance(),
  };
  houseMeshes.mine.rotation.y = -Math.PI / 2; // 입구가 서쪽(마을 쪽)을 본다
  for (const [id, b] of Object.entries(BUILDINGS)) {
    const g = houseMeshes[id];
    g.position.set(b.x, 0, b.z);
    g.userData = { type: 'building', id };
    scene.add(g);
    interactables.push(g);
    const rotated = b.facing === 'east' || b.facing === 'west';
    addBoxCollider(b.x, b.z, rotated ? b.d : b.w, rotated ? b.w : b.d);
    if (id === 'hall') hallCollider = colliders[colliders.length - 1];
  }
  deco.hall = houseMeshes.hall;
  addCircle(29.4, 10.4, 0.8); // 광산 앞 수레

  // 새 마을회관(완공 후)과 공사 비계는 미리 만들어 두고 updateDecorations 에서 바꿔 끼운다
  const H = BUILDINGS.hall;
  deco.grandHall = makeGrandHall();
  deco.grandHall.position.set(H.x, 0, H.z);
  deco.grandHall.userData = { type: 'building', id: 'hall' };
  deco.scaffold = makeScaffold(H.w, H.d, 5.2);
  deco.scaffold.position.set(H.x, 0, H.z);
  deco.scaffold.visible = false;
  scene.add(deco.scaffold);

  // 윤 씨 아주머니네 빨랫줄
  const line = makeClothesline();
  line.position.set(20.2, 0, 10.8);
  scene.add(line);
  addCircle(18.6, 10.8, 0.2);
  addCircle(21.8, 10.8, 0.2);

  // 마을회관 깃발
  const pole = mesh(new THREE.CylinderGeometry(0.045, 0.06, 6, 12), surf('metal', 0xb8bcc0));
  pole.position.set(6.5, 3, -16);
  const flag = mesh(new THREE.PlaneGeometry(1.6, 1, 8, 1), surf('fabric', 0x2f5a3e, { side: THREE.DoubleSide }));
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
  const post = mesh(new THREE.BoxGeometry(0.12, 1.3, 0.12), surf('wood', 0x6a5440));
  post.position.y = 0.65;
  const signWood = surf('wood', 0x9a7c5c);
  const board = mesh(new THREE.BoxGeometry(1.2, 0.6, 0.06), [signWood, signWood, signWood, signWood, boardText('내 밭'), signWood]);
  board.position.set(0, 1.2, 0.07);
  const farmSign = makeLabel('내 밭 · 확장', { scale: 0.75 });
  farmSign.position.y = 2.3;
  sign.add(post, board, farmSign);
  sign.position.set(FARM_SIGN_POS.x, 0, FARM_SIGN_POS.z - 0.35);
  sign.userData = { type: 'farmSign' };
  scene.add(sign);
  addCircle(sign.position.x, sign.position.z, 0.2);
  interactables.push(sign);

  // 꽃밭
  // 꽃밭: 색마다 인스턴스 하나로 (그리기 호출 최소화)
  const tmp = new THREE.Object3D();
  for (const color of FLOWER_COLORS) {
    const n = 60;
    const inst = new THREE.InstancedMesh(flowerGeometry(color), FLOWER_MAT, n);
    for (let i = 0; i < n; i++) {
      tmp.position.set(5 + Math.random() * 9, 0, 20 + Math.random() * 8);
      tmp.rotation.y = Math.random() * Math.PI * 2;
      tmp.scale.setScalar(0.75 + Math.random() * 0.5);
      tmp.updateMatrix();
      inst.setMatrixAt(i, tmp.matrix);
    }
    inst.receiveShadow = true;
    scene.add(inst);
  }

  // 가로등
  const lampPos = [[-8, 5.8], [8, 5.8], [-24, 5.8], [24, 5.8], [-13.4, 12], [2, -13], [-2, -13], [-10.8, 20.8], [25.4, 10.2]];
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
  // 맵 가장자리 생울타리
  const ht = TX.foliageTex();
  const hedgeM = new THREE.MeshStandardMaterial({ color: 0x6cae4a, map: ht.map, normalMap: ht.normalMap, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.85 });
  for (const [x1, z1, x2, z2] of [[-38, -38, 38, -38], [-38, 38, 38, 38], [-38, -38, -38, 38], [38, -38, 38, 38]]) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const hg = new RoundedBoxGeometry(len, 1.6, 1.3, 4, 0.55);
    const uv = hg.attributes.uv, n = hg.attributes.normal;
    for (let i = 0; i < uv.count; i++) {
      const side = Math.abs(n.getX(i)) > 0.5 ? 1.3 : len;
      const up = Math.abs(n.getY(i)) > 0.5 ? 1.3 : 1.6;
      uv.setXY(i, (uv.getX(i) * side) / 1.6, (uv.getY(i) * up) / 1.6);
    }
    const hedge = mesh(hg, hedgeM, true, true);
    hedge.position.set((x1 + x2) / 2, 0.8, (z1 + z2) / 2);
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

  // 들풀 (건물·길·밭을 다 놓은 뒤에 빈 땅에만)
  scatterGrass(scene, 2600);

  // 하늘에 떠다니는 뭉게구름
  const cloudM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.25, fog: false });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.random() * 0.4;
    const r = 70 + Math.random() * 40;
    const c = new THREE.Group();
    const n = 3 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) {
      const puff = mesh(new THREE.SphereGeometry(3 + Math.random() * 2.5, 16, 12), cloudM, false, false);
      puff.position.set((k - (n - 1) / 2) * 3.6, Math.random() * 1.5, (Math.random() - 0.5) * 2);
      puff.scale.y = 0.7;
      c.add(puff);
    }
    c.position.set(Math.cos(a) * r, 34 + Math.random() * 14, Math.sin(a) * r);
    c.userData.speed = 0.6 + Math.random() * 0.6;
    scene.add(c);
    clouds.push(c);
  }
}
const clouds = [];

/** 나무 팻말 앞면 글씨 */
function boardText(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const ctx = c.getContext('2d');
  const w = TX.woodTex().map.image;
  ctx.drawImage(w, 0, 0, 256, 128);
  ctx.fillStyle = 'rgba(120, 92, 64, 0.55)';
  ctx.fillRect(0, 0, 256, 128);
  ctx.font = '56px Jua, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(40, 26, 14, 0.9)';
  ctx.fillText(text, 128, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 });
}

// ───────── 광장 큰 나무의 꼬마전구 (엔딩 이후 밤마다 켜진다) ─────────
const FAIRY_COLORS = [0xffe2a0, 0xff9cc0, 0x9cd8ff, 0xc8f08a];
const festival = { group: null, mats: [], light: null, force: false };

function buildFestival(scene) {
  const g = new THREE.Group();
  const groups = FAIRY_COLORS.map(() => []);
  let k = 0;
  const add = (x, y, z) => groups[k++ % groups.length].push([x, y, z]);
  const cx = PLAZA.x, cz = PLAZA.z;
  // 나무 둘레를 감아 올라가는 나선
  for (let i = 0; i < 110; i++) {
    const t = i / 110;
    const y = 3.5 + t * 4.4;
    const a = t * Math.PI * 2 * 5.5;
    const r = Math.sqrt(Math.max(0.4, 3.0 * 3.0 - (y - 5.6) ** 2)) + 0.2;
    add(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r);
  }
  // 나무에서 광장 가장자리 기둥으로 늘어진 전구 줄
  const wireM = new THREE.LineBasicMaterial({ color: 0x3a3028 });
  const poleM = surf('wood', 0x8a6a4a);
  for (let p = 0; p < 6; p++) {
    const a = (p / 6) * Math.PI * 2;
    const px = cx + Math.cos(a) * 6.0, pz = cz + Math.sin(a) * 6.0;
    const pole = mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.1, 8), poleM);
    pole.position.set(px, 1.55, pz);
    g.add(pole);
    const ax = cx + Math.cos(a) * 2.6, az = cz + Math.sin(a) * 2.6;
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const y = 4.4 + (3.05 - 4.4) * t - Math.sin(t * Math.PI) * 0.7;
      const v = new THREE.Vector3(ax + (px - ax) * t, y, az + (pz - az) * t);
      pts.push(v);
      if (i > 0 && i < 12) add(v.x, v.y - 0.08, v.z);
    }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireM));
  }
  const bulbGeo = new THREE.SphereGeometry(0.075, 8, 6);
  const tmp = new THREE.Object3D();
  groups.forEach((pts, i) => {
    const m = new THREE.MeshStandardMaterial({ color: FAIRY_COLORS[i], emissive: FAIRY_COLORS[i], emissiveIntensity: 0, roughness: 0.4 });
    const inst = new THREE.InstancedMesh(bulbGeo, m, pts.length);
    pts.forEach(([x, y, z], j) => {
      tmp.position.set(x, y, z);
      tmp.updateMatrix();
      inst.setMatrixAt(j, tmp.matrix);
    });
    g.add(inst);
    festival.mats.push(m);
  });
  // 나무 주변을 은은하게 밝히는 불빛 (개수가 바뀌지 않게 늘 두고 밝기만 조절)
  festival.light = new THREE.PointLight(0xffd8a0, 0, 20, 1.4);
  festival.light.position.set(cx, 5, cz);
  scene.add(festival.light);
  g.visible = false;
  scene.add(g);
  festival.group = g;
}

/** 꼬마전구 보이기 (force 이면 낮이어도 환하게 — 엔딩 연출용) */
export function setFestival(visible, force = false) {
  if (!festival.group) return;
  festival.group.visible = visible;
  festival.force = force;
  if (!visible) festival.light.intensity = 0;
}

function animateFestival(t) {
  if (!festival.group?.visible) return;
  // 밤에 가로등이 켜질 때 함께 켜진다
  const glow = festival.force ? 1 : Math.min(1, LAMP_MAT.emissiveIntensity / 2);
  festival.mats.forEach((m, i) => { m.emissiveIntensity = glow * (1.5 + 0.9 * Math.sin(t * 2.6 + i * 1.7)); });
  festival.light.intensity = glow * 16;
}

export function updateDecorations(flags) {
  setFestival(!!flags.endingSeen || festival.force, festival.force);
  if (deco.easel) deco.easel.visible = !!flags.deco_drawing;
  if (deco.rod) deco.rod.visible = !!flags.deco_rod;
  if (deco.scaffold) deco.scaffold.visible = !!flags.hallFunded && !flags.hallBuilt;
  setHallUpgraded(!!flags.hallBuilt);
}

/** 마을회관을 새 건물로 (또는 예전 건물로 — 새 게임을 시작할 때) 바꿔 끼운다 */
function setHallUpgraded(on) {
  if (!worldScene || !deco.hall || on === hallUpgraded) return;
  hallUpgraded = on;
  const [from, to] = on ? [deco.hall, deco.grandHall] : [deco.grandHall, deco.hall];
  worldScene.remove(from);
  worldScene.add(to);
  const i = interactables.indexOf(from);
  if (i >= 0) interactables[i] = to;
  else interactables.push(to);
  // 새 회관은 폭이 11m로 조금 넓고, 현관 기둥·화단이 있다
  const H = BUILDINGS.hall;
  const w = on ? 11 : H.w;
  Object.assign(hallCollider, { minX: H.x - w / 2 - 0.2, maxX: H.x + w / 2 + 0.2 });
  if (on) {
    deco.hallExtras = [];
    for (const x of [-3.2, -1.6, 1.6, 3.2]) deco.hallExtras.push({ x: H.x + x, z: H.z + 4.4, r: 0.25 });
    for (const sx of [-1, 1]) deco.hallExtras.push({ minX: H.x + sx * 4.4 - 1.1, maxX: H.x + sx * 4.4 + 1.1, minZ: H.z + 4.7, maxZ: H.z + 5.5 });
    colliders.push(...deco.hallExtras);
  } else if (deco.hallExtras) {
    for (const c of deco.hallExtras) colliders.splice(colliders.indexOf(c), 1);
    deco.hallExtras = null;
  }
}

export function updateWorld(dt, t) {
  if (waterNormal) waterNormal.offset.x -= dt * 0.04;
  animateFestival(t);
  for (const c of clouds) {
    c.position.x += c.userData.speed * dt;
    if (c.position.x > 120) c.position.x = -120;
  }
  if (deco.flag) {
    // 깃발 펄럭임
    const p = deco.flag.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + 0.8;
      p.setZ(i, Math.sin(t * 4 - x * 3) * 0.08 * x);
    }
    p.needsUpdate = true;
  }
}

export function setSnowLevel(v) {
  if (!snowCover) return;
  snowCover.visible = v > 0.01;
  snowCover.material.opacity = v * 1.4;
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

/**
 * 시설을 놓을 수 있는 자리인지 검사. 못 놓으면 이유 문구, 놓을 수 있으면 null
 * rect: { minX, maxX, minZ, maxZ }, ignore: 검사에서 뺄 충돌체(옮기는 중인 시설 자기 자신)
 * keepClear: 비워 둬야 하는 지점 [{ x, z }] (주민 자리 · 건물 출입구)
 */
export function placementBlocked(rect, { ignore = null, keepClear = [] } = {}) {
  const pad = 0.25;
  const L = BOUNDS - 1.5;
  if (rect.minX < -L || rect.maxX > L || rect.minZ < -L || rect.maxZ > L) return '마을 가장자리라 놓을 수 없어요';
  if (rect.minZ < STREAM_Z + 3.4) return '시냇물에 너무 가까워요';
  const farm = farmRect(8);
  if (rect.maxX > farm.x1 - pad && rect.minX < farm.x2 + pad && rect.maxZ > farm.z1 - pad && rect.minZ < farm.z2 + pad) return '밭(최대로 넓힐 자리)과 겹쳐요';
  const cx = THREE.MathUtils.clamp(PLAZA.x, rect.minX, rect.maxX), cz = THREE.MathUtils.clamp(PLAZA.z, rect.minZ, rect.maxZ);
  if (Math.hypot(cx - PLAZA.x, cz - PLAZA.z) < 7.2) return '광장에는 놓을 수 없어요';
  for (const list of [colliders, fenceColliders, facilityColliders]) for (const c of list) {
    if (c === ignore) continue;
    if ('r' in c) {
      const px = THREE.MathUtils.clamp(c.x, rect.minX, rect.maxX), pz = THREE.MathUtils.clamp(c.z, rect.minZ, rect.maxZ);
      if (Math.hypot(px - c.x, pz - c.z) < c.r + pad) return '다른 물건과 겹쳐요';
    } else if (rect.maxX > c.minX - pad && rect.minX < c.maxX + pad && rect.maxZ > c.minZ - pad && rect.minZ < c.maxZ + pad) {
      return c.minX < -70 ? '시냇물에 너무 가까워요' : '건물이나 다른 시설과 겹쳐요';
    }
  }
  for (let x = rect.minX; x <= rect.maxX + 0.01; x += 0.5) {
    for (let z = rect.minZ; z <= rect.maxZ + 0.01; z += 0.5) {
      if (nearPath(x, z, 0.15)) return '길 위에는 놓을 수 없어요';
    }
  }
  for (const p of keepClear) {
    if (p.x > rect.minX - 1.4 && p.x < rect.maxX + 1.4 && p.z > rect.minZ - 1.4 && p.z < rect.maxZ + 1.4) return '주민이나 건물 입구를 막아요';
  }
  return null;
}

export function resolveCollision(pos, radius = 0.4) {
  pos.x = THREE.MathUtils.clamp(pos.x, zoneBounds.minX, zoneBounds.maxX);
  pos.z = THREE.MathUtils.clamp(pos.z, zoneBounds.minZ, zoneBounds.maxZ);
  for (const list of [colliders, fenceColliders, facilityColliders]) for (const c of list) {
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
