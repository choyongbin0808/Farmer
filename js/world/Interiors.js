import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { G } from '../core/Game.js';
import { mat, surf, mesh, makeLabel, makeEasel, makeFishingRod, LAMP_MAT } from './Models.js';
import { GLOW_MAT } from './ExtraModels.js';
import { interactables, roomColliders, addDecorHook } from './World.js';
import * as TX from './Textures.js';

// ═════════════════════════════════════════════════════════════
//  건물 내부 — 우리 집 · 마을회관
//  광산처럼 마을에서 멀리 떨어진 곳(x = -300)에 방을 지어 두고, 문을 누르면 그 방으로 옮긴다.
//  카메라가 비스듬히 내려다보므로 카메라 쪽 벽은 허리 높이로 낮춰(잘라) 방 안이 보이게 한다.
// ═════════════════════════════════════════════════════════════

/**
 * 방 정보 (로컬 좌표: x 동쪽, z 남쪽 · 방 가운데가 원점)
 * hw/hd: 방 안쪽 절반 크기, door: 나가는 문(로컬), spawn: 들어왔을 때 서는 자리,
 * out: 나갔을 때 마을에서 서는 자리(월드), face: 바라보는 방향
 */
export const ROOMS = {
  house: {
    name: '우리 집', icon: '🏠', origin: { x: -300, z: 0 }, hw: 6, hd: 4.5, h: 3.0,
    door: { x: 6, z: 2, ry: -Math.PI / 2 }, spawn: { x: 4.7, z: 2 }, spawnFace: -Math.PI / 2,
    out: { x: -13.7, z: 13 }, outFace: Math.PI / 2,
  },
  hall: {
    name: '마을회관', icon: '🏛️', origin: { x: -300, z: 100 }, hw: 8, hd: 5.5, h: 3.4,
    door: { x: 0, z: 5.5, ry: Math.PI }, spawn: { x: 0, z: 4.2 }, spawnFace: Math.PI,
    out: { x: -1.9, z: -13.5 }, outFace: 0,
  },
  // 집 지하 작업실 — 집 안 계단으로 드나든다 (exitTo: 나가면 가는 곳, via: 마을에서 들어가는 건물)
  cellar: {
    name: '지하 작업실', icon: '🛠️', origin: { x: -300, z: -100 }, hw: 11, hd: 7, h: 2.8,
    door: { x: -9.4, z: -5.2, ry: Math.PI / 2 }, spawn: { x: -7.4, z: -4.4 }, spawnFace: Math.PI / 2,
    exitTo: 'house', via: 'house', outFace: Math.PI / 2,
  },
};
export const isRoom = (zone) => !!ROOMS[zone];

const toWorld = (room, x, z) => ({ x: ROOMS[room].origin.x + x, z: ROOMS[room].origin.z + z });
/** 집 안 지하 계단 (로컬) — 지하에서 올라오면 계단 옆에 선다 */
const HOUSE_STAIRS = { x: -3.7, z: 3.0 };
ROOMS.cellar.out = toWorld('house', HOUSE_STAIRS.x + 1.5, HOUSE_STAIRS.z);

/**
 * 지하 작업실의 시설 자리 (로컬) — 약탕기 · 육묘장 각 3칸.
 * 상점에서 사면 빈 자리에 차례로 자동 설치된다.
 */
// 키 큰 약탕기는 뒷벽(북쪽) 줄, 낮고 투명한 육묘장은 카메라 쪽(남쪽) 줄 — 시야를 가리지 않게
const CELLAR_SLOT_LOCAL = {
  brewer: [[-3.0, -5.4], [1.8, -5.4], [6.6, -5.4]],
  nursery: [[-4.0, 3.8], [1.8, 3.8], [7.6, 3.8]],
};
export function cellarSlot(kind, i) {
  const p = CELLAR_SLOT_LOCAL[kind]?.[i];
  return p ? toWorld('cellar', p[0], p[1]) : null;
}
export const CELLAR_SLOT_COUNT = { nursery: 3, brewer: 3 };

/** 다른 방 안에서 들어가는 입구 (지하 작업실 = 집 안의 계단), 없으면 null */
export function roomEntry(room) {
  return room === 'cellar' ? toWorld('house', HOUSE_STAIRS.x, HOUSE_STAIRS.z) : null;
}

/** 방 안 이동 범위 (월드) */
export function roomBounds(room) {
  const r = ROOMS[room];
  return { minX: r.origin.x - r.hw + 0.35, maxX: r.origin.x + r.hw - 0.35, minZ: r.origin.z - r.hd + 0.35, maxZ: r.origin.z + r.hd - 0.35 };
}
export const roomSpawn = (room) => toWorld(room, ROOMS[room].spawn.x, ROOMS[room].spawn.z);
export const roomDoor = (room) => toWorld(room, ROOMS[room].door.x, ROOMS[room].door.z);
/** 침대 옆 — 잠에서 깨어 서는 자리 */
export const HOUSE_WAKE = toWorld('house', -3.0, -1.0);

// ───────── 공용 조각 ─────────
const box = (w, h, d, r = 0.03) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) * 0.45));
const cyl = (rt, rb, h, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s);
const FIRE_MAT = new THREE.MeshStandardMaterial({ color: 0x401a08, emissive: 0xff7a24, emissiveIntensity: 2.6, roughness: 1 });
/** 방 창문 유리: 바깥 하늘빛을 시간에 따라 칠한다 (updateInteriors) */
const ROOM_GLASS = new THREE.MeshStandardMaterial({ color: 0x9cd4f0, emissive: 0x9cd4f0, emissiveIntensity: 0.6, roughness: 0.15 });

function tiledPlane(w, d, size, material) {
  const g = new THREE.PlaneGeometry(w, d);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / size, (uv.getY(i) * d) / size);
  const m = mesh(g, material, false, true);
  m.rotation.x = -Math.PI / 2;
  return m;
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 액자 (그림 텍스처) — 벽에 붙인다 (앞 = +z) */
function makeFrame(tex, w, h, frameColor = 0x8a5a36) {
  const g = new THREE.Group();
  const fr = mesh(box(w + 0.14, h + 0.14, 0.06, 0.02), surf('wood', frameColor));
  const pic = mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), false);
  pic.position.z = 0.035;
  g.add(fr, pic);
  return g;
}

/** 방 안쪽에서 본 창문 (앞 = +z) */
function makeRoomWindow(trim) {
  const g = new THREE.Group();
  const wood = surf('wood', trim);
  const glass = mesh(new THREE.PlaneGeometry(1.1, 1.0), ROOM_GLASS, false);
  glass.position.z = 0.02;
  g.add(glass);
  for (const [w, h, x, y] of [[1.3, 0.1, 0, 0.55], [1.3, 0.1, 0, -0.55], [0.1, 1.2, -0.6, 0], [0.1, 1.2, 0.6, 0], [0.05, 1.0, 0, 0], [1.1, 0.05, 0, 0]]) {
    const b = mesh(box(w, h, 0.08, 0.02), wood, false);
    b.position.set(x, y, 0.04);
    g.add(b);
  }
  const sill = mesh(box(1.45, 0.07, 0.22), wood, false);
  sill.position.set(0, -0.62, 0.1);
  g.add(sill);
  // 커튼
  for (const sx of [-1, 1]) {
    const c = mesh(box(0.28, 1.3, 0.05, 0.02), surf('fabric', 0xf2c6a0), false);
    c.position.set(sx * 0.78, 0.02, 0.1);
    g.add(c);
  }
  return g;
}

/** 나가는 문 (앞 = +z, 방 안쪽을 본다) */
function makeDoor(label) {
  const g = new THREE.Group();
  const wood = surf('wood', 0x7a5236);
  // 문틈으로 새어 드는 바깥빛
  // 문짝 · 문틀은 'tall' 그룹 — 문이 달린 벽이 잘리면(카메라 쪽) 함께 숨겨 시야를 가리지 않게
  const tall = new THREE.Group();
  tall.name = 'tall';
  g.add(tall);
  const glow = mesh(new THREE.PlaneGeometry(1.3, 2.3), new THREE.MeshBasicMaterial({ color: 0xfff1cc }), false);
  glow.position.set(0, 1.15, -0.02);
  tall.add(glow);
  const panel = mesh(box(1.1, 2.1, 0.08, 0.03), surf('wood', 0xa0704a));
  panel.position.set(-0.08, 1.08, 0.02);
  panel.rotation.y = 0.35; // 살짝 열린 문
  const knob = mesh(new THREE.SphereGeometry(0.05, 10, 8), surf('metal', 0xd8b048));
  knob.position.set(0.4, -0.08, 0.06);
  panel.add(knob);
  tall.add(panel);
  for (const sx of [-1, 1]) {
    const post = mesh(box(0.14, 2.45, 0.2), wood);
    post.position.set(sx * 0.72, 1.22, 0);
    tall.add(post);
  }
  const top = mesh(box(1.6, 0.16, 0.22), wood);
  top.position.set(0, 2.45, 0);
  tall.add(top);
  // 벽이 잘렸을 때 바닥에 남는 빛 (문 자리 표시)
  const spill = mesh(new THREE.PlaneGeometry(1.4, 1.2), new THREE.MeshBasicMaterial({ color: 0xfff1cc, transparent: true, opacity: 0.55, depthWrite: false }), false);
  spill.rotation.x = -Math.PI / 2;
  spill.position.set(0, 0.02, 0.2);
  spill.name = 'spill';
  spill.visible = false;
  g.add(spill);
  const mat_ = mesh(box(1.2, 0.03, 0.7, 0.01), surf('fabric', 0x8a6a4a), false, true);
  mat_.position.set(0, 0.015, 0.5);
  g.add(mat_);
  const sign = makeLabel(label, { scale: 0.75 });
  sign.position.set(0, 3.05, 0.1);
  g.add(sign);
  return g;
}

function makePlant(scale = 1) {
  const g = new THREE.Group();
  const pot = mesh(cyl(0.2, 0.15, 0.32, 14), surf('paint', 0xc8673e));
  pot.position.y = 0.16;
  g.add(pot);
  const leafM = mat(0x5aa04a, { roughness: 0.8 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const l = mesh(new THREE.SphereGeometry(0.17, 10, 8), leafM);
    l.position.set(Math.cos(a) * 0.12, 0.5 + (i % 2) * 0.12, Math.sin(a) * 0.12);
    g.add(l);
  }
  const top = mesh(new THREE.SphereGeometry(0.2, 10, 8), leafM);
  top.position.y = 0.7;
  g.add(top);
  g.scale.setScalar(scale);
  return g;
}

function makeChair(color = 0x9a6a46) {
  const g = new THREE.Group();
  const wood = surf('wood', color);
  const seat = mesh(box(0.46, 0.06, 0.46), wood);
  seat.position.y = 0.46;
  const back = mesh(box(0.46, 0.5, 0.06), wood);
  back.position.set(0, 0.74, -0.2);
  g.add(seat, back);
  for (const sx of [-0.19, 0.19]) for (const sz of [-0.19, 0.19]) {
    const leg = mesh(box(0.05, 0.46, 0.05), wood);
    leg.position.set(sx, 0.23, sz);
    g.add(leg);
  }
  return g;
}

// ───────── 우리 집 가구 ─────────
function makeBed() {
  const g = new THREE.Group();
  const wood = surf('wood', 0x9a6a46);
  const frame = mesh(box(2.2, 0.3, 1.5), wood);
  frame.position.y = 0.25;
  const mattress = mesh(box(2.05, 0.2, 1.38, 0.08), mat(0xf6f2ea));
  mattress.position.y = 0.5;
  const quilt = mesh(box(1.4, 0.12, 1.44, 0.06), surf('fabric', 0x7ab0d8));
  quilt.position.set(0.32, 0.6, 0);
  const pattern = mesh(box(1.42, 0.02, 0.2, 0.01), surf('fabric', 0xf6d26a), false);
  pattern.position.set(0.32, 0.67, 0.35);
  const pillow = mesh(box(0.42, 0.14, 0.9, 0.06), mat(0xffffff));
  pillow.position.set(-0.72, 0.66, 0);
  const head = mesh(box(0.12, 1.0, 1.55), wood);
  head.position.set(-1.1, 0.6, 0);
  const foot = mesh(box(0.1, 0.62, 1.55), wood);
  foot.position.set(1.1, 0.4, 0);
  g.add(frame, mattress, quilt, pattern, pillow, head, foot);
  return g;
}

function makeNightstand() {
  const g = new THREE.Group();
  const wood = surf('wood', 0xa87a52);
  const body = mesh(box(0.5, 0.55, 0.45), wood);
  body.position.y = 0.28;
  const base = mesh(cyl(0.08, 0.1, 0.06), surf('metal', 0xc8a050));
  base.position.y = 0.58;
  const stem = mesh(cyl(0.015, 0.015, 0.26, 8), surf('metal', 0xc8a050));
  stem.position.y = 0.72;
  const shade = mesh(cyl(0.1, 0.17, 0.18, 14, true), mat(0xfff0d0, { emissive: 0xffc070, emissiveIntensity: 0.8, side: THREE.DoubleSide }));
  shade.position.y = 0.9;
  g.add(body, base, stem, shade);
  return g;
}

function makeWardrobe() {
  const g = new THREE.Group();
  const wood = surf('wood', 0x8a5c3a);
  const body = mesh(box(1.4, 2.1, 0.6), wood);
  body.position.y = 1.05;
  g.add(body);
  for (const sx of [-1, 1]) {
    const door = mesh(box(0.64, 1.86, 0.04, 0.02), surf('wood', 0xa8784e));
    door.position.set(sx * 0.34, 1.08, 0.31);
    const knob = mesh(new THREE.SphereGeometry(0.035, 8, 6), surf('metal', 0xd8b048));
    knob.position.set(sx * 0.08, 1.1, 0.35);
    g.add(door, knob);
  }
  const crown = mesh(box(1.5, 0.1, 0.66), wood);
  crown.position.y = 2.12;
  g.add(crown);
  return g;
}

function makeBookshelf() {
  const g = new THREE.Group();
  const wood = surf('wood', 0x7a5236);
  const back = mesh(box(1.5, 2.0, 0.06), wood);
  back.position.set(0, 1.0, -0.17);
  g.add(back);
  for (const sx of [-0.72, 0.72]) {
    const side = mesh(box(0.06, 2.0, 0.4), wood);
    side.position.set(sx, 1.0, 0);
    g.add(side);
  }
  const colors = [0xd85a4a, 0x4a86c4, 0x5aa04a, 0xe8b53a, 0x8a62c4, 0xe07a3a, 0x3e8a8a];
  for (let s = 0; s < 4; s++) {
    const y = 0.08 + s * 0.5;
    const shelf = mesh(box(1.44, 0.05, 0.38), wood);
    shelf.position.set(0, y, 0);
    g.add(shelf);
    if (s === 3) continue;
    let x = -0.64;
    let i = s * 3;
    while (x < 0.6) {
      const w = 0.07 + ((i * 37) % 5) * 0.012;
      const h = 0.3 + ((i * 53) % 4) * 0.03;
      const b = mesh(box(w, h, 0.26, 0.01), mat(colors[i % colors.length], { roughness: 0.7 }), false);
      b.position.set(x + w / 2, y + 0.03 + h / 2, 0.02);
      if (i % 7 === 3) b.rotation.z = 0.18;
      g.add(b);
      x += w + 0.012;
      i++;
    }
  }
  const globe = mesh(new THREE.SphereGeometry(0.14, 14, 10), mat(0x6ab0d8, { roughness: 0.5 }));
  globe.position.set(0.3, 1.74, 0);
  g.add(globe);
  return g;
}

function makeKitchen() {
  const g = new THREE.Group();
  const cab = mesh(box(3.0, 0.88, 0.62), surf('wood', 0xe8d8bc));
  cab.position.y = 0.44;
  const top = mesh(box(3.1, 0.06, 0.68), surf('stone', 0xd8d0c4));
  top.position.y = 0.91;
  g.add(cab, top);
  for (let i = 0; i < 4; i++) {
    const d = mesh(box(0.66, 0.66, 0.03, 0.02), surf('wood', 0xf4e8d2));
    d.position.set(-1.1 + i * 0.74, 0.44, 0.32);
    g.add(d);
  }
  // 싱크대 · 화구 · 냄비
  const sink = mesh(box(0.6, 0.04, 0.4, 0.01), surf('metal', 0xb8c0c8));
  sink.position.set(-0.9, 0.95, 0);
  const tap = mesh(cyl(0.02, 0.02, 0.3, 8), surf('metal', 0xc8ccd0));
  tap.position.set(-0.9, 1.08, -0.24);
  const stove = mesh(box(0.7, 0.04, 0.5, 0.01), mat(0x3a3836));
  stove.position.set(0.8, 0.95, 0);
  const pot = mesh(cyl(0.18, 0.16, 0.22, 16), surf('paint', 0xd85a4a));
  pot.position.set(0.68, 1.08, 0);
  const lid = mesh(cyl(0.19, 0.19, 0.03, 16), surf('metal', 0xc8ccd0));
  lid.position.set(0.68, 1.2, 0);
  const kettle = mesh(new THREE.SphereGeometry(0.12, 12, 10), surf('paint', 0x5aa0c8));
  kettle.position.set(1.05, 1.06, 0.05);
  g.add(sink, tap, stove, pot, lid, kettle);
  // 위 선반과 병
  const shelf = mesh(box(2.6, 0.05, 0.25), surf('wood', 0xa87a52));
  shelf.position.set(0, 1.9, -0.2);
  g.add(shelf);
  [0xe8b53a, 0xd85a4a, 0x7ac05a, 0xf4f0e6, 0xc87a3a].forEach((c, i) => {
    const jar = mesh(cyl(0.07, 0.07, 0.2, 10), mat(c, { roughness: 0.4 }), false);
    jar.position.set(-1.0 + i * 0.45, 2.03, -0.2);
    g.add(jar);
  });
  return g;
}

function makeFireplace() {
  const g = new THREE.Group();
  const stone = surf('stone', 0xc8b8a4);
  const body = mesh(box(1.8, 1.3, 0.6), stone);
  body.position.y = 0.65;
  const hole = mesh(box(1.0, 0.7, 0.1, 0.02), mat(0x1c120c), false);
  hole.position.set(0, 0.5, 0.27);
  const mantel = mesh(box(2.0, 0.12, 0.72), surf('wood', 0x8a5c3a));
  mantel.position.y = 1.36;
  const chimney = mesh(box(1.0, 1.7, 0.45), stone);
  chimney.position.set(0, 2.2, -0.08);
  g.add(body, hole, mantel, chimney);
  for (const [x, rz] of [[-0.18, 0.3], [0.18, -0.3]]) {
    const log = mesh(cyl(0.07, 0.07, 0.6, 10), surf('bark', 0x6a4a30));
    log.rotation.set(0, 0, Math.PI / 2 + rz);
    log.position.set(x, 0.24, 0.24);
    g.add(log);
  }
  const fire = mesh(new THREE.ConeGeometry(0.22, 0.42, 10), FIRE_MAT, false);
  fire.position.set(0, 0.42, 0.24);
  fire.name = 'fire';
  g.add(fire);
  // 벽난로 위 소품: 화분 · 사진
  const pp = makePlant(0.6);
  pp.position.set(-0.7, 1.42, 0);
  g.add(pp);
  return g;
}

function makeRoundTable() {
  const g = new THREE.Group();
  const wood = surf('wood', 0xb8885a);
  const top = mesh(cyl(0.7, 0.7, 0.07, 24), wood);
  top.position.y = 0.74;
  const leg = mesh(cyl(0.07, 0.09, 0.72, 10), wood);
  leg.position.y = 0.37;
  const foot = mesh(cyl(0.34, 0.38, 0.05, 18), wood);
  foot.position.y = 0.03;
  const cloth = mesh(cyl(0.45, 0.45, 0.01, 24), surf('fabric', 0xf4e2c8), false);
  cloth.position.y = 0.785;
  const vase = mesh(cyl(0.07, 0.05, 0.2, 12), mat(0x6ab0d8, { roughness: 0.3 }));
  vase.position.y = 0.88;
  g.add(top, leg, foot, cloth, vase);
  [0xd94a6a, 0xf0c33c, 0xf2efe6].forEach((c, i) => {
    const f = mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(c), false);
    f.position.set(Math.cos(i * 2.1) * 0.05, 1.02 + (i % 2) * 0.03, Math.sin(i * 2.1) * 0.05);
    g.add(f);
  });
  return g;
}

function makeRug(w, d, color, border) {
  const g = new THREE.Group();
  const a = mesh(box(w, 0.02, d, 0.01), surf('fabric', border), false, true);
  const b = mesh(box(w - 0.3, 0.025, d - 0.3, 0.01), surf('fabric', color), false, true);
  g.add(a, b);
  g.position.y = 0.012;
  return g;
}

/** 벽걸이 달력 */
function makeCalendar() {
  const tex = canvasTex(128, 160, (c, w, h) => {
    c.fillStyle = '#fffaf0'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#e2685a'; c.fillRect(0, 0, w, 34);
    c.fillStyle = '#fff'; c.font = '22px Jua, sans-serif'; c.textAlign = 'center'; c.fillText('초록마을', w / 2, 25);
    c.fillStyle = '#b8a890';
    for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) c.fillRect(10 + k * 22, 48 + r * 26, 16, 18);
    c.strokeStyle = '#e2685a'; c.lineWidth = 3; c.beginPath(); c.arc(43, 83, 12, 0, Math.PI * 2); c.stroke();
  });
  return makeFrame(tex, 0.42, 0.54, 0xd8c8a8);
}

/** 이장 임명장 (엔딩 뒤) — 이름이 바뀌면 다시 그린다 */
function certificateTex(name) {
  return canvasTex(256, 180, (c, w, h) => {
    c.fillStyle = '#fbf4dc'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#c8a050'; c.lineWidth = 8; c.strokeRect(8, 8, w - 16, h - 16);
    c.fillStyle = '#6a4a30'; c.textAlign = 'center';
    c.font = '30px Jua, sans-serif'; c.fillText('임 명 장', w / 2, 52);
    c.font = '18px Jua, sans-serif';
    c.fillText(`${name} 님을`, w / 2, 92);
    c.fillText('초록마을 이장으로 임명합니다', w / 2, 118);
    c.fillStyle = '#d8503e'; c.beginPath(); c.arc(w - 50, h - 42, 16, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#6a4a30'; c.font = '14px Jua, sans-serif'; c.fillText('박 이장', w / 2, h - 30);
  });
}

// ───────── 마을회관 가구 ─────────
function makeNoticeBoard() {
  const g = new THREE.Group();
  const frame = mesh(box(1.9, 1.25, 0.08), surf('wood', 0x7a5236));
  const cork = mesh(new THREE.PlaneGeometry(1.7, 1.05), mat(0xc89a62, { roughness: 1 }), false);
  cork.position.z = 0.045;
  g.add(frame, cork);
  [[0xfff6c8, -0.55, 0.2, 0.1], [0xd8f0ff, 0.05, 0.25, -0.08], [0xffd8d8, 0.55, 0.15, 0.06], [0xe0ffd0, -0.3, -0.25, -0.05], [0xfff0e0, 0.38, -0.27, 0.1]].forEach(([c, x, y, rz]) => {
    const p = mesh(new THREE.PlaneGeometry(0.42, 0.34), mat(c), false);
    p.position.set(x, y, 0.05);
    p.rotation.z = rz;
    const pin = mesh(new THREE.SphereGeometry(0.025, 8, 6), mat(0xd8503e), false);
    pin.position.set(x, y + 0.13, 0.07);
    g.add(p, pin);
  });
  const label = makeLabel('마을 게시판', { scale: 0.6 });
  label.position.set(0, 0.95, 0.1);
  g.add(label);
  return g;
}

function makeDesk(grand) {
  const g = new THREE.Group();
  const wood = surf('wood', grand ? 0x6a3e22 : 0x9a7a58);
  const top = mesh(box(2.0, 0.08, 0.9), wood);
  top.position.y = 0.78;
  const front = mesh(box(2.0, 0.72, 0.06), wood);
  front.position.set(0, 0.38, 0.42);
  g.add(top, front);
  for (const sx of [-0.95, 0.95]) {
    const side = mesh(box(0.08, 0.76, 0.9), wood);
    side.position.set(sx, 0.38, 0);
    g.add(side);
  }
  const papers = mesh(box(0.4, 0.04, 0.3, 0.01), mat(0xfaf6ea), false);
  papers.position.set(-0.5, 0.84, 0);
  const pen = mesh(cyl(0.012, 0.012, 0.22, 6), mat(0x2a2a3a), false);
  pen.rotation.z = Math.PI / 2;
  pen.position.set(-0.45, 0.87, 0.05);
  const stamp = mesh(cyl(0.05, 0.05, 0.1, 10), surf('wood', 0x8a5c3a));
  stamp.position.set(0.55, 0.87, -0.05);
  g.add(papers, pen, stamp);
  const chair = makeChair(grand ? 0x8a2e2a : 0x8a6a4a);
  chair.scale.setScalar(grand ? 1.25 : 1);
  chair.rotation.y = Math.PI;
  chair.position.set(0, 0, -0.75);
  g.add(chair);
  return g;
}

function makeLongTable() {
  const g = new THREE.Group();
  const wood = surf('wood', 0x8a5c3a);
  const top = mesh(box(4.4, 0.08, 1.3), wood);
  top.position.y = 0.76;
  g.add(top);
  for (const sx of [-2.0, 2.0]) for (const sz of [-0.5, 0.5]) {
    const leg = mesh(box(0.1, 0.74, 0.1), wood);
    leg.position.set(sx, 0.37, sz);
    g.add(leg);
  }
  const runner = mesh(box(3.8, 0.01, 0.4, 0.004), surf('fabric', 0x3e7a4a), false);
  runner.position.y = 0.81;
  g.add(runner);
  for (const x of [-1.2, 0, 1.2]) {
    const cup = mesh(cyl(0.05, 0.04, 0.1, 10), mat(0xffffff, { roughness: 0.3 }));
    cup.position.set(x, 0.86, 0.35);
    g.add(cup);
  }
  for (const x of [-1.5, 0, 1.5]) for (const sz of [-1, 1]) {
    const c = makeChair(0x6a4a30);
    c.position.set(x, 0, sz * 0.95);
    c.rotation.y = sz > 0 ? Math.PI : 0;
    g.add(c);
  }
  return g;
}

/** 명예의 전당 진열장 (트로피) */
function makeTrophyCabinet() {
  const g = new THREE.Group();
  const wood = surf('wood', 0x6a3e22);
  // 속이 빈 장: 뒤판 · 옆판 · 위아래 (안의 트로피가 유리 너머로 보이게)
  for (const [w, h, d, x, y, z] of [[1.6, 2.0, 0.06, 0, 1.0, -0.25], [0.08, 2.0, 0.55, -0.76, 1.0, 0], [0.08, 2.0, 0.55, 0.76, 1.0, 0], [1.6, 0.12, 0.58, 0, 2.0, 0], [1.6, 0.22, 0.58, 0, 0.11, 0]]) {
    const p = mesh(box(w, h, d, 0.02), wood);
    p.position.set(x, y, z);
    g.add(p);
  }
  const inner = mesh(new THREE.PlaneGeometry(1.44, 1.76), mat(0x8a2e2a, { roughness: 0.9 }), false);
  inner.position.set(0, 1.06, -0.215);
  const glass = mesh(new THREE.PlaneGeometry(1.44, 1.72), new THREE.MeshStandardMaterial({ color: 0xd8f0ff, transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false }), false);
  glass.position.set(0, 1.06, 0.28);
  g.add(inner, glass);
  const gold = surf('metal', 0xf2c641, { roughness: 0.25, metalness: 0.6 });
  for (let s = 0; s < 3; s++) {
    const shelf = mesh(box(1.4, 0.04, 0.45), surf('wood', 0x8a5c3a), false);
    shelf.position.set(0, 0.4 + s * 0.55, 0.02);
    g.add(shelf);
    for (const x of [-0.42, 0, 0.42]) {
      const cup = mesh(cyl(0.09, 0.04, 0.16, 12), gold, false);
      cup.position.set(x, 0.55 + s * 0.55, 0.02);
      const stem = mesh(cyl(0.02, 0.05, 0.08, 8), gold, false);
      stem.position.set(x, 0.46 + s * 0.55, 0.02);
      g.add(cup, stem);
    }
  }
  const label = makeLabel('명예의 전당', { scale: 0.6 });
  label.position.set(0, 2.45, 0.1);
  g.add(label);
  return g;
}

function makeBanner(text, color) {
  const tex = canvasTex(512, 128, (c, w, h) => {
    c.fillStyle = color; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff6dc'; c.font = '64px Jua, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, w / 2, h / 2 + 4);
  });
  const g = new THREE.Group();
  const cloth = mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide }), false);
  const rod = mesh(cyl(0.03, 0.03, 3.9, 8), surf('wood', 0x6a4a30));
  rod.rotation.z = Math.PI / 2;
  rod.position.y = 0.47;
  g.add(cloth, rod);
  return g;
}

function makeClock() {
  const tex = canvasTex(128, 128, (c, w) => {
    c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(w / 2, w / 2, 60, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#6a4a30'; c.font = '16px Jua'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) { const a = (i / 12) * Math.PI * 2; c.fillText(i, w / 2 + Math.sin(a) * 46, w / 2 - Math.cos(a) * 46); }
    c.strokeStyle = '#3a2a20'; c.lineWidth = 5; c.beginPath(); c.moveTo(64, 64); c.lineTo(64, 30); c.moveTo(64, 64); c.lineTo(88, 72); c.stroke();
  });
  const g = new THREE.Group();
  const rim = mesh(cyl(0.36, 0.36, 0.08, 24), surf('wood', 0x6a3e22));
  rim.rotation.x = Math.PI / 2;
  const face = mesh(new THREE.CircleGeometry(0.3, 24), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), false);
  face.position.z = 0.045;
  g.add(rim, face);
  return g;
}

function makeChandelier() {
  const g = new THREE.Group();
  const gold = surf('metal', 0xd8b048, { roughness: 0.3, metalness: 0.5 });
  const ring = mesh(new THREE.TorusGeometry(0.5, 0.03, 8, 24), gold);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bulb = mesh(new THREE.SphereGeometry(0.08, 10, 8), GLOW_MAT, false);
    bulb.position.set(Math.cos(a) * 0.5, 0.08, Math.sin(a) * 0.5);
    g.add(bulb);
  }
  const chain = mesh(cyl(0.015, 0.015, 0.6, 6), gold);
  chain.position.y = 0.32;
  g.add(chain);
  return g;
}

function makeFlagStand() {
  const g = new THREE.Group();
  const pole = mesh(cyl(0.025, 0.025, 2.2, 8), surf('metal', 0xd8b048));
  pole.position.y = 1.1;
  const base = mesh(cyl(0.18, 0.22, 0.1, 14), surf('wood', 0x6a3e22));
  base.position.y = 0.05;
  const flag = mesh(new THREE.PlaneGeometry(0.9, 0.6), surf('fabric', 0x2f5a3e, { side: THREE.DoubleSide }), false);
  flag.position.set(0.47, 1.8, 0);
  const leaf = mesh(new THREE.CircleGeometry(0.14, 16), mat(0xf4e8b8, { side: THREE.DoubleSide }), false);
  leaf.position.set(0.47, 1.8, 0.01);
  g.add(pole, base, flag, leaf);
  return g;
}

function makeOldStove() {
  const g = new THREE.Group();
  const iron = surf('metal', 0x3a3633);
  const body = mesh(cyl(0.32, 0.36, 0.8, 16), iron);
  body.position.y = 0.45;
  const pipe = mesh(cyl(0.08, 0.08, 2.4, 10), iron);
  pipe.position.y = 2.0;
  const kettle = mesh(new THREE.SphereGeometry(0.14, 12, 10), surf('paint', 0x8a8070));
  kettle.position.y = 0.95;
  g.add(body, pipe, kettle);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = mesh(cyl(0.03, 0.03, 0.12, 6), iron);
    leg.position.set(Math.cos(a) * 0.25, 0.06, Math.sin(a) * 0.25);
    g.add(leg);
  }
  return g;
}

function makeBucket() {
  const g = new THREE.Group();
  const b = mesh(cyl(0.22, 0.18, 0.32, 16, true), surf('metal', 0x9aa0a4));
  b.position.y = 0.16;
  const water = mesh(new THREE.CircleGeometry(0.2, 16), mat(0x6ab0d8, { roughness: 0.1 }), false);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.22;
  const drop = mesh(new THREE.SphereGeometry(0.03, 8, 6), mat(0x8ad0f0, { roughness: 0.1 }), false);
  drop.name = 'drop';
  drop.position.y = 2.6;
  g.add(b, water, drop);
  return g;
}

function makeCrates() {
  const g = new THREE.Group();
  const wood = surf('wood', 0xb8905e);
  [[0, 0.3, 0, 0.6], [0.65, 0.3, 0.1, 0.6], [0.3, 0.85, 0.05, 0.5]].forEach(([x, y, z, s]) => {
    const c = mesh(box(s, s, s, 0.02), wood);
    c.position.set(x, y - (0.6 - s) / 2, z);
    c.rotation.y = x * 0.4;
    g.add(c);
  });
  return g;
}

function makeFoldingChair() {
  const c = makeChair(0x8a8070);
  c.rotation.y = Math.PI;
  return c;
}

// ───────── 지하 계단 · 작업실 소품 ─────────
/** 집 바닥의 지하 계단: 난간 두른 네모난 구멍 + 내려가는 계단 (계단은 -z 쪽으로 내려간다) */
function makeStairsDown() {
  const g = new THREE.Group();
  // 바닥 아래로 내려가는 계단을 그린 판 (아래로 갈수록 어둡게)
  const tex = canvasTex(128, 212, (c, w, h) => {
    c.fillStyle = '#120c08'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) {
      const k = 1 - i / 6;
      const y = h - (i + 1) * (h / 6.4);
      c.fillStyle = `rgb(${Math.round(150 * k + 20)}, ${Math.round(104 * k + 14)}, ${Math.round(64 * k + 10)})`;
      c.fillRect(8 + i * 3, y, w - 16 - i * 6, h / 7.2);
      c.fillStyle = `rgba(0,0,0,${0.35 + i * 0.08})`;
      c.fillRect(8 + i * 3, y + h / 7.2 - 4, w - 16 - i * 6, 4);
    }
  });
  const hole = mesh(new THREE.PlaneGeometry(1.2, 2.0), new THREE.MeshBasicMaterial({ map: tex }), false);
  hole.rotation.x = -Math.PI / 2;
  hole.position.y = 0.014;
  g.add(hole);
  const rail = surf('wood', 0x7a5236);
  for (const [w, d, x, z] of [[0.08, 2.1, -0.66, 0], [0.08, 2.1, 0.66, 0], [1.4, 0.08, 0, -1.04]]) {
    const r = mesh(box(w, 0.08, d, 0.02), rail);
    r.position.set(x, 0.85, z);
    g.add(r);
  }
  for (const [x, z] of [[-0.66, -1.04], [0.66, -1.04], [-0.66, 1.04], [0.66, 1.04], [-0.66, 0], [0.66, 0]]) {
    const p = mesh(box(0.08, 0.86, 0.08, 0.02), rail);
    p.position.set(x, 0.43, z);
    g.add(p);
  }
  const sign = makeLabel('⬇ 지하 작업실', { scale: 0.7 });
  sign.position.set(0, 1.6, 0);
  g.add(sign);
  return g;
}

/** 지하에서 올라가는 계단 (벽에 붙어 +x 방향에서 올라가 -x 쪽 벽 위로) */
function makeStairsUp() {
  const g = new THREE.Group();
  const wood = surf('wood', 0x8a6040);
  for (let i = 0; i < 7; i++) {
    const step = mesh(box(0.36, 0.2 + i * 0.36, 1.2, 0.02), wood, true, true);
    step.position.set(0.9 - i * 0.34, (0.2 + i * 0.36) / 2, 0);
    g.add(step);
  }
  const shaft = mesh(new THREE.PlaneGeometry(1.4, 1.6), new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }), false);
  shaft.rotation.y = Math.PI / 2;
  shaft.position.set(-1.2, 2.2, 0);
  g.add(shaft);
  const rail = mesh(box(2.6, 0.08, 0.08, 0.02), surf('wood', 0x6a4a30));
  rail.position.set(-0.2, 1.9, 0.65);
  rail.rotation.z = -0.78;
  g.add(rail);
  const sign = makeLabel('⬆ 우리 집으로', { scale: 0.7 });
  sign.position.set(0, 3.0, 0);
  g.add(sign);
  return g;
}

/** 빈 시설 자리: 점선 테두리 판 + 안내 */
function makeEmptySlot(w, d, text) {
  const g = new THREE.Group();
  const tex = canvasTex(256, Math.round((256 * d) / w), (c, cw, ch) => {
    c.fillStyle = 'rgba(255, 240, 200, 0.18)'; c.fillRect(0, 0, cw, ch);
    c.strokeStyle = 'rgba(255, 230, 170, 0.9)'; c.lineWidth = 6; c.setLineDash([18, 12]);
    c.strokeRect(6, 6, cw - 12, ch - 12);
  });
  const plate = mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), false);
  plate.rotation.x = -Math.PI / 2;
  plate.position.y = 0.02;
  g.add(plate);
  const sign = makeLabel(text, { scale: 0.55 });
  sign.position.set(0, 0.9, 0);
  g.add(sign);
  return g;
}

function makeShelfUnit() {
  const g = new THREE.Group();
  const wood = surf('wood', 0x7a5236);
  for (const sx of [-0.9, 0.9]) {
    const s = mesh(box(0.06, 1.9, 0.45), wood);
    s.position.set(sx, 0.95, 0);
    g.add(s);
  }
  const jarC = [0x7ac05a, 0xe8b53a, 0xc8673e, 0x6ab0d8, 0xf4f0e6];
  for (let k = 0; k < 4; k++) {
    const y = 0.1 + k * 0.58;
    const sh = mesh(box(1.86, 0.05, 0.45), wood);
    sh.position.y = y;
    g.add(sh);
    if (k === 3) continue;
    for (let i = 0; i < 5; i++) {
      const isBox = (i + k) % 3 === 0;
      const m = isBox
        ? mesh(box(0.28, 0.22, 0.3, 0.02), surf('wood', 0xc8a070), false)
        : mesh(cyl(0.08, 0.08, 0.22, 10), mat(jarC[(i + k) % jarC.length], { roughness: 0.35 }), false);
      m.position.set(-0.68 + i * 0.34, y + 0.14, 0);
      g.add(m);
    }
  }
  return g;
}

function makeWorkbench() {
  const g = new THREE.Group();
  const wood = surf('wood', 0x9a7048);
  const top = mesh(box(2.2, 0.1, 0.9), wood);
  top.position.y = 0.86;
  g.add(top);
  for (const sx of [-1, 1]) for (const sz of [-0.36, 0.36]) {
    const leg = mesh(box(0.1, 0.82, 0.1), wood);
    leg.position.set(sx, 0.41, sz);
    g.add(leg);
  }
  const shelf = mesh(box(2.0, 0.05, 0.8), wood);
  shelf.position.y = 0.25;
  g.add(shelf);
  // 화분 · 모종삽 · 씨앗 봉투
  for (const x of [-0.7, -0.35]) {
    const pot = mesh(cyl(0.11, 0.08, 0.16, 12), surf('paint', 0xc8673e));
    pot.position.set(x, 0.99, 0.1);
    const sprout = mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(0x7ac05a), false);
    sprout.position.set(x, 1.1, 0.1);
    g.add(pot, sprout);
  }
  [0xe8b53a, 0xd85a4a, 0x7ac05a].forEach((c, i) => {
    const bag = mesh(box(0.16, 0.22, 0.04, 0.01), mat(c), false);
    bag.position.set(0.25 + i * 0.22, 1.02, -0.15);
    bag.rotation.y = 0.2 - i * 0.15;
    g.add(bag);
  });
  const trowel = mesh(box(0.06, 0.02, 0.32, 0.01), surf('metal', 0xb8c0c8), false);
  trowel.position.set(0.8, 0.92, 0.2);
  trowel.rotation.y = 0.6;
  g.add(trowel);
  return g;
}

function makeBarrel() {
  const g = new THREE.Group();
  const body = mesh(cyl(0.38, 0.38, 0.9, 16), surf('wood', 0x8a5c3a));
  body.position.y = 0.45;
  g.add(body);
  for (const y of [0.15, 0.75]) {
    const hoop = mesh(new THREE.TorusGeometry(0.385, 0.025, 6, 20), surf('metal', 0x4a4644));
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = y;
    g.add(hoop);
  }
  return g;
}

function makeSoilSacks() {
  const g = new THREE.Group();
  const sackM = surf('fabric', 0xc8a878);
  [[0, 0.22, 0, 0], [0.62, 0.22, 0.1, 0.3], [0.3, 0.6, 0.05, -0.2]].forEach(([x, y, z, ry]) => {
    const s = mesh(box(0.6, 0.42, 0.4, 0.14), sackM);
    s.position.set(x, y, z);
    s.rotation.y = ry;
    g.add(s);
  });
  const lbl = makeLabel('흙', { scale: 0.45 });
  lbl.position.set(0.3, 1.15, 0);
  g.add(lbl);
  return g;
}

function makeLantern() {
  const g = new THREE.Group();
  const hook = mesh(box(0.06, 0.06, 0.3, 0.01), surf('metal', 0x3a3633));
  hook.position.set(0, 2.15, 0.15);
  const lamp = mesh(new THREE.SphereGeometry(0.12, 10, 8), GLOW_MAT, false);
  lamp.position.set(0, 1.95, 0.28);
  const cap = mesh(cyl(0.04, 0.12, 0.1, 10), surf('metal', 0x3a3633));
  cap.position.set(0, 2.08, 0.28);
  g.add(hook, lamp, cap);
  return g;
}

/** 일반 흙 상자: 뚜껑 없는 나무 상자 + 안에 쌓이는 흙 (fill 이름의 메시를 채운 양만큼 높인다) */
function makeSoilBox() {
  const g = new THREE.Group();
  const wood = surf('wood', 0xb08250);
  const W = 1.0, H = 0.62, T = 0.07;
  const bottom = mesh(box(W, T, W, 0.02), wood, true, true);
  bottom.position.y = T / 2;
  g.add(bottom);
  for (const [w, d, x, z] of [[W, T, 0, W / 2 - T / 2], [W, T, 0, -W / 2 + T / 2], [T, W, W / 2 - T / 2, 0], [T, W, -W / 2 + T / 2, 0]]) {
    const side = mesh(box(w, H, d, 0.02), wood);
    side.position.set(x, H / 2, z);
    g.add(side);
  }
  // 바깥 둘레 쇠붙이 띠 (네 면에만 — 속은 비워 둔다)
  const band = surf('metal', 0x5a4a3a);
  for (const y of [0.12, H - 0.08]) {
    for (const [w, d, x, z] of [[W + 0.02, 0.02, 0, W / 2 + 0.005], [W + 0.02, 0.02, 0, -W / 2 - 0.005], [0.02, W + 0.02, W / 2 + 0.005, 0], [0.02, W + 0.02, -W / 2 - 0.005, 0]]) {
      const b = mesh(new THREE.BoxGeometry(w, 0.05, d), band, false);
      b.position.set(x, y, z);
      g.add(b);
    }
  }
  const soilT = TX.dirtPathTex();
  const fill = mesh(box(W - T * 2 - 0.02, 1, W - T * 2 - 0.02, 0.06), new THREE.MeshStandardMaterial({ map: soilT.map, color: 0xb07a4e, roughness: 1 }), false, false); // 상자 벽 그림자에 묻히지 않게
  fill.name = 'fill';
  fill.visible = false;
  g.add(fill);
  return g;
}

/** 말린 약초 걸이 */
function makeHerbRack() {
  const g = new THREE.Group();
  const bar = mesh(cyl(0.025, 0.025, 1.6, 8), surf('wood', 0x6a4a30));
  bar.rotation.z = Math.PI / 2;
  bar.position.y = 2.1;
  g.add(bar);
  [0x7a9a4a, 0x9a8a4a, 0x5a8a4a, 0xa0703a, 0x6a9a5a].forEach((c, i) => {
    const bunch = mesh(new THREE.ConeGeometry(0.09, 0.4, 8), mat(c), false);
    bunch.rotation.x = Math.PI;
    bunch.position.set(-0.6 + i * 0.3, 1.86, 0);
    g.add(bunch);
  });
  return g;
}

// ───────── 방 짓기 ─────────
const built = {}; // room → { root, sides, stubs, lights, fire, drop, ... }

/**
 * 방 껍데기: 바닥 · 벽 4면(카메라 쪽 벽은 잘라서 허리 높이 판만 남긴다) · 방 밖 어둠
 * 벽 장식은 sides[면] 그룹에 넣어 벽과 함께 숨긴다.
 */
function buildShell(room, root, { floorColor, wallColor, wainscot, trim, wallKind = 'plaster' }) {
  const r = ROOMS[room];
  const W = r.hw * 2, D = r.hd * 2, H = r.h;
  const woodT = TX.woodTex();
  const floor = tiledPlane(W, D, 2.4, new THREE.MeshStandardMaterial({ map: woodT.map, color: floorColor, roughness: 0.8 }));
  floor.position.y = 0.005;
  root.add(floor);
  const voidM = mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshBasicMaterial({ color: 0x120d0a }), false);
  voidM.rotation.x = -Math.PI / 2;
  voidM.position.y = -0.03;
  root.add(voidM);
  const wallM = surf(wallKind, wallColor);
  const lowM = surf('wood', wainscot);
  const trimM = surf('wood', trim);
  const T = 0.25;
  const defs = {
    n: { x: 0, z: -r.hd - T / 2, len: W + T * 2, rot: 0 },
    s: { x: 0, z: r.hd + T / 2, len: W + T * 2, rot: 0 },
    w: { x: -r.hw - T / 2, z: 0, len: D, rot: Math.PI / 2 },
    e: { x: r.hw + T / 2, z: 0, len: D, rot: Math.PI / 2 },
  };
  const sides = {}, stubs = {};
  for (const [k, d] of Object.entries(defs)) {
    const full = new THREE.Group();
    const wall = mesh(box(d.len, H, T, 0.04), wallM, true, true);
    wall.position.set(d.x, H / 2, d.z);
    wall.rotation.y = d.rot;
    // 허리 높이 널빤지 + 몰딩 (방 안쪽 면)
    const inward = { n: [0, 1], s: [0, -1], w: [1, 0], e: [-1, 0] }[k];
    const band = mesh(box(k === 'n' || k === 's' ? W : D, 1.0, 0.05, 0.02), lowM, false, true);
    band.position.set(d.x + inward[0] * (T / 2 + 0.03), 0.5, d.z + inward[1] * (T / 2 + 0.03));
    band.rotation.y = d.rot;
    const cap = mesh(box(k === 'n' || k === 's' ? W : D, 0.06, 0.09, 0.02), trimM, false);
    cap.position.set(band.position.x + inward[0] * 0.02, 1.02, band.position.z + inward[1] * 0.02);
    cap.rotation.y = d.rot;
    const crown = mesh(box(k === 'n' || k === 's' ? W : D, 0.1, 0.1, 0.02), trimM, false);
    crown.position.set(d.x + inward[0] * (T / 2 + 0.04), H - 0.08, d.z + inward[1] * (T / 2 + 0.04));
    crown.rotation.y = d.rot;
    full.add(wall, band, cap, crown);
    root.add(full);
    // 잘렸을 때 남는 낮은 벽
    const stub = new THREE.Group();
    const sw = mesh(box(d.len, 0.55, T, 0.04), wallM, false, true);
    sw.position.set(d.x, 0.275, d.z);
    sw.rotation.y = d.rot;
    const sc = mesh(box(d.len, 0.06, T + 0.06, 0.02), trimM, false);
    sc.position.set(d.x, 0.58, d.z);
    sc.rotation.y = d.rot;
    stub.add(sw, sc);
    stub.visible = false;
    root.add(stub);
    sides[k] = full;
    stubs[k] = stub;
  }
  return { sides, stubs };
}

/** 가구를 놓고 (충돌 상자 · 상호작용 등록) */
function place(room, parent, obj, x, z, ry = 0, { id = null, col = null, reach = 1.6 } = {}) {
  obj.position.set(x, obj.position.y, z);
  obj.rotation.y = ry;
  parent.add(obj);
  const o = ROOMS[room].origin;
  const entry = { obj, id, col: null, x: o.x + x, z: o.z + z, reach };
  if (col) {
    const [w, d] = col;
    entry.col = { minX: o.x + x - w / 2, maxX: o.x + x + w / 2, minZ: o.z + z - d / 2, maxZ: o.z + z + d / 2 };
  }
  if (id) obj.userData = { type: 'furniture', id, room };
  return entry;
}

/** 벽 장식 (면 그룹에 붙여 벽과 함께 숨김) */
function wallDecor(room, side, obj, along, y, { id = null, reach = 2.2 } = {}) {
  const r = ROOMS[room];
  const b = built[room];
  const off = 0.03;
  const pos = {
    n: [along, -r.hd + off, 0],
    s: [along, r.hd - off, Math.PI],
    w: [-r.hw + off, along, Math.PI / 2],
    e: [r.hw - off, along, -Math.PI / 2],
  }[side];
  obj.position.set(pos[0], y, pos[1]);
  obj.rotation.y = pos[2];
  b.sides[side].add(obj);
  if (id) {
    obj.userData = { type: 'furniture', id, room };
    const o = r.origin;
    return { obj, id, x: o.x + pos[0], z: o.z + pos[1], reach, wall: side };
  }
  return null;
}

function buildHouse(scene) {
  const room = 'house';
  const r = ROOMS[room];
  const root = new THREE.Group();
  root.position.set(r.origin.x, 0, r.origin.z);
  scene.add(root);
  const b = (built[room] = { root, items: [], groups: {} });
  Object.assign(b, buildShell(room, root, { floorColor: 0xd8a878, wallColor: 0xf8ecd8, wainscot: 0xc89a6a, trim: 0x9a6a46 }));
  const add = (e) => { if (e) b.items.push(e); return e; };

  // 북쪽 벽: 부엌 · 창문 · 벽난로 · 책장
  add(place(room, root, makeKitchen(), -4.3, -4.12, 0, { id: 'kitchen', col: [3.1, 0.7], reach: 1.9 }));
  add(wallDecor(room, 'n', makeRoomWindow(0x9a6a46), -1.4, 1.75));
  add(place(room, root, makeFireplace(), 1.3, -4.18, 0, { id: 'fireplace', col: [1.8, 0.6], reach: 1.9 }));
  add(place(room, root, makeBookshelf(), 4.5, -4.25, 0, { id: 'bookshelf', col: [1.5, 0.45], reach: 1.8 }));
  add(wallDecor(room, 'n', makeCalendar(), 3.0, 1.75, { id: 'calendar' }));
  // 서쪽 벽: 침대 · 협탁 · 옷장
  add(place(room, root, makeBed(), -4.75, -1.2, 0, { id: 'bed', col: [2.2, 1.55], reach: 2.0 }));
  add(place(room, root, makeNightstand(), -5.55, -2.55, 0, { col: [0.5, 0.45] }));
  add(place(room, root, makeWardrobe(), -5.62, 2.7, Math.PI / 2, { id: 'wardrobe', col: [0.65, 1.45], reach: 1.8 }));
  // 동쪽 벽: 창문 · 문
  add(wallDecor(room, 'e', makeRoomWindow(0x9a6a46), -1.9, 1.7));
  const door = makeDoor('나가기 · 마을로');
  add(place(room, root, door, r.door.x - 0.05, r.door.z, r.door.ry, { id: 'exit', reach: 1.5 }));
  b.door = door;
  b.doorSide = 'e';
  // 가운데: 러그 · 식탁 · 의자 · 화분
  add(place(room, root, makeRug(4.2, 3.0, 0xe8a87a, 0xc8603e), 0.2, 0.6));
  add(place(room, root, makeRoundTable(), 0.4, 0.4, 0, { col: [1.3, 1.3] }));
  const c1 = makeChair(), c2 = makeChair();
  add(place(room, root, c1, -0.6, 0.6, Math.PI / 2, { col: [0.45, 0.45] }));
  add(place(room, root, c2, 1.4, 0.3, -Math.PI / 2, { col: [0.45, 0.45] }));
  add(place(room, root, makePlant(1.2), 5.4, -2.9, 0, { col: [0.5, 0.5] }));
  add(place(room, root, makePlant(1.0), -1.3, 4.0, 0, { col: [0.5, 0.5] }));
  // 지하 작업실로 내려가는 계단 (구멍이라 걸어 들어가지 못하게 충돌 상자)
  add(place(room, root, makeStairsDown(), HOUSE_STAIRS.x, HOUSE_STAIRS.z, 0, { id: 'stairs', col: [1.4, 2.2], reach: 1.9 }));

  // 퀘스트 보상 장식 (flags) — 민지의 그림 · 오 씨의 낚싯대 · 이장 임명장
  const easel = makeEasel();
  b.groups.drawing = add(place(room, root, easel, 2.9, -3.3, -0.3, { id: 'drawing', col: [0.8, 0.5], reach: 1.6 }));
  const rod = makeFishingRod();
  b.groups.rod = add(place(room, root, rod, 5.2, -0.6, -Math.PI / 2, { id: 'rodrack', col: [0.6, 0.6], reach: 1.6 }));
  const cert = makeFrame(certificateTex(''), 0.8, 0.56, 0xc8a050);
  b.groups.cert = add(wallDecor(room, 'w', cert, -1.2, 1.9, { id: 'certificate' }));
  b.certName = null;

  b.fire = root.getObjectByName('fire');
  b.lightSpots = [
    { x: 0.4, z: 0.4, y: 2.7, color: 0xffd9a0, power: 22 },   // 천장 등
    { x: 1.3, z: -3.6, y: 0.8, color: 0xff8a3a, power: 10, fire: true }, // 벽난로
    { x: -5.4, z: -2.5, y: 1.2, color: 0xffc888, power: 4 },  // 협탁 스탠드
    { x: -4.3, z: -3.2, y: 2.4, color: 0xfff0d8, power: 6 },  // 부엌
  ];
}

function buildHall(scene) {
  const room = 'hall';
  const r = ROOMS[room];
  const root = new THREE.Group();
  root.position.set(r.origin.x, 0, r.origin.z);
  scene.add(root);
  const b = (built[room] = { root, items: [], groups: {}, variants: { old: [], grand: [] } });
  Object.assign(b, buildShell(room, root, { floorColor: 0xc8a070, wallColor: 0xf4ead8, wainscot: 0x9a7048, trim: 0x7a5236 }));
  const add = (e, variant = null) => {
    if (!e) return e;
    b.items.push(e);
    if (variant) {
      e.variant = variant;
      b.variants[variant].push(e);
    }
    return e;
  };
  const door = makeDoor('나가기 · 마을로');
  add(place(room, root, door, r.door.x, r.door.z + 0.05, r.door.ry, { id: 'exit', reach: 1.6 }));
  b.door = door;
  b.doorSide = 's';
  add(wallDecor(room, 'n', makeNoticeBoard(), -4.6, 1.7, { id: 'board', reach: 2.4 }));
  add(wallDecor(room, 'w', makeRoomWindow(0x7a5236), -1.5, 1.8));
  add(wallDecor(room, 'e', makeRoomWindow(0x7a5236), -1.5, 1.8));
  add(wallDecor(room, 'w', makeRoomWindow(0x7a5236), 2.4, 1.8));
  add(wallDecor(room, 'e', makeRoomWindow(0x7a5236), 2.4, 1.8));

  // ── 완공 전: 낡은 회관 ──
  const oldBanner = makeBanner('초록마을 회관', '#8a7a62');
  add(wallDecor(room, 'n', oldBanner, 1.2, 2.5), 'old');
  b.variants.old.push({ obj: oldBanner });
  add(place(room, root, makeDesk(false), 1.2, -4.1, 0, { id: 'desk', col: [2.0, 0.9], reach: 1.9 }), 'old');
  for (const [x, z] of [[-2.4, 0], [-1.2, 0], [0, 0], [1.2, 0], [-1.8, 1.4], [0.6, 1.4]]) {
    add(place(room, root, makeFoldingChair(), x, z, 0, { col: [0.45, 0.45] }), 'old');
  }
  add(place(room, root, makeOldStove(), 6.9, -4.4, 0, { id: 'stove', col: [0.8, 0.8], reach: 1.6 }), 'old');
  add(place(room, root, makeCrates(), -6.8, 4.3, 0, { col: [1.4, 1.0] }), 'old');
  b.bucket = add(place(room, root, makeBucket(), 3.4, 1.6, 0, { id: 'bucket', col: [0.45, 0.45], reach: 1.4 }), 'old');
  add(place(room, root, makeRug(2.6, 1.6, 0x9a8a72, 0x7a6a52), -0.6, 0.6), 'old');

  // ── 완공 후: 새 회관 ──
  const grandBanner = makeBanner('초록마을 회관', '#2f5a3e');
  add(wallDecor(room, 'n', grandBanner, 1.2, 2.55), 'grand');
  b.variants.grand.push({ obj: grandBanner });
  const clock = makeClock();
  add(wallDecor(room, 'n', clock, 5.0, 2.3), 'grand');
  b.variants.grand.push({ obj: clock });
  add(place(room, root, makeRug(1.6, 9.0, 0xb8302a, 0xe8b53a), 1.2, 0.6), 'grand');
  add(place(room, root, makeDesk(true), 1.2, -4.0, 0, { id: 'desk', col: [2.0, 0.9], reach: 1.9 }), 'grand');
  add(place(room, root, makeLongTable(), -3.6, 0.6, 0, { col: [4.4, 2.6] }), 'grand');
  add(place(room, root, makeTrophyCabinet(), 6.6, -4.9, 0, { id: 'trophy', col: [1.6, 0.6], reach: 2.0 }), 'grand');
  add(place(room, root, makeFlagStand(), 3.0, -4.7, 0, { col: [0.4, 0.4] }), 'grand');
  add(place(room, root, makePlant(1.4), -7.3, -4.8, 0, { col: [0.5, 0.5] }), 'grand');
  add(place(room, root, makePlant(1.4), 7.3, 4.8, 0, { col: [0.5, 0.5] }), 'grand');
  add(place(room, root, makePlant(1.2), -7.3, 4.8, 0, { col: [0.5, 0.5] }), 'grand');
  const chand = makeChandelier();
  chand.position.y = 2.75;
  add(place(room, root, chand, -3.6, 0.6, 0), 'grand');
  // 이장 명패 (엔딩 뒤엔 내 이름)
  b.namePlateAt = { x: 1.2, z: -3.45 };
  b.namePlate = null;

  b.lightSpots = [
    { x: -3.6, z: 0.6, y: 2.6, color: 0xffe0b0, power: 26 },
    { x: 3.4, z: 0.4, y: 2.8, color: 0xffe8c8, power: 20 },
    { x: 1.2, z: -3.4, y: 2.4, color: 0xffd8a0, power: 10 },
    { x: -4.6, z: -4.4, y: 2.3, color: 0xfff0d8, power: 6 },
  ];
}

function buildCellar(scene) {
  const room = 'cellar';
  const r = ROOMS[room];
  const root = new THREE.Group();
  root.position.set(r.origin.x, 0, r.origin.z);
  scene.add(root);
  const b = (built[room] = { root, items: [], groups: {}, slotPlates: {} });
  Object.assign(b, buildShell(room, root, { floorColor: 0xa88462, wallColor: 0xb8a690, wainscot: 0x7a5a3e, trim: 0x5a4030, wallKind: 'stone' }));
  const add = (e) => { if (e) b.items.push(e); return e; };

  // 올라가는 계단 (서쪽 벽)
  add(place(room, root, makeStairsUp(), r.door.x, r.door.z, 0, { id: 'exit', col: [2.0, 1.3], reach: 1.9 }));
  // 작업대 · 선반 · 통 · 흙 포대 · 등불 · 약초 걸이
  add(place(room, root, makeWorkbench(), -8.9, 1.6, Math.PI / 2, { col: [0.9, 2.2] }));
  add(place(room, root, makeShelfUnit(), -10.7, 4.6, Math.PI / 2, { col: [0.5, 1.9] }));
  add(place(room, root, makeBarrel(), 10.3, 6.2, 0, { col: [0.8, 0.8] }));
  add(place(room, root, makeBarrel(), 9.4, 6.4, 0, { col: [0.8, 0.8] }));
  add(place(room, root, makeSoilSacks(), 10.1, 0.6, -Math.PI / 2, { col: [0.6, 1.3] }));
  // 일반 흙 상자 3개 (남서쪽 구석) — 상점에서 산 일반 흙이 바로 들어온다
  b.soilBoxes = [-9.9, -8.6, -7.3].map((x, i) => {
    const e = add(place(room, root, makeSoilBox(), x, 6.15, 0, { id: `soilbox${i}`, col: [1.0, 1.0], reach: 1.8 }));
    e.label = null;
    e.labelText = '';
    return e;
  });
  const boxSign = makeLabel('🪣 일반 흙 상자', { scale: 0.6 });
  boxSign.position.set(-8.6, 1.85, 6.15);
  root.add(boxSign);
  add(place(room, root, makeRug(3.2, 2.0, 0x8a6a4a, 0x6a4a30), -6.4, -1.6));
  for (const [side, along] of [['n', -8.2], ['n', 4.9], ['e', 0.2], ['w', -1.8]]) {
    add(wallDecor(room, side, makeLantern(), along, 0));
  }
  add(wallDecor(room, 'n', makeHerbRack(), -1.1, 0));
  const banner = makeBanner('🛠️ 지하 작업실', '#5a4030');
  banner.scale.setScalar(0.6);
  add(wallDecor(room, 'e', banner, -3.5, 2.2));

  // 시설 빈 자리 표시 (설치되면 숨김)
  for (const kind of ['nursery', 'brewer']) {
    const [w, d] = kind === 'nursery' ? [5, 2.5] : [2.5, 2.5];
    b.slotPlates[kind] = CELLAR_SLOT_LOCAL[kind].map(([x, z]) => {
      const p = makeEmptySlot(w, d, `빈 자리 · ${kind === 'nursery' ? '육묘장' : '약탕기'}`);
      p.position.set(x, 0, z);
      root.add(p);
      return p;
    });
  }

  b.lightSpots = [
    { x: -3.0, z: -3.4, y: 2.4, color: 0xffc888, power: 18 },
    { x: 5.0, z: -3.4, y: 2.4, color: 0xffc888, power: 18 },
    { x: 1.8, z: 2.0, y: 2.4, color: 0xffd8a0, power: 20 },
    { x: -8.6, z: 1.6, y: 2.2, color: 0xfff0d8, power: 8 },
  ];
  b.alwaysLit = true; // 지하라 낮에도 등불이 환하다
}

/** 흙 상자 모습: 채운 양만큼 흙이 쌓이고, 위에 'n/cap' 이름표 */
export function updateSoilBoxes(counts, cap) {
  const b = built.cellar;
  if (!b?.soilBoxes) return;
  b.soilBoxes.forEach((e, i) => {
    const n = counts[i] ?? 0;
    const fill = e.obj.getObjectByName('fill');
    const k = Math.min(1, n / cap);
    fill.visible = n > 0;
    // 상자 안쪽 높이만큼, 가득 차면 테두리 위로 소복하게
    const h = 0.04 + k * 0.64;
    fill.scale.y = h;
    fill.position.y = 0.07 + h / 2;
    const text = `${n}/${cap}`;
    if (e.labelText !== text) {
      if (e.label) e.obj.remove(e.label);
      e.label = makeLabel(text, { scale: 0.48 });
      e.label.position.set(0, 1.05, 0);
      e.obj.add(e.label);
      e.labelText = text;
    }
  });
}

/** 지하 시설 자리: 설치된 자리는 빈 자리 표시를 숨긴다 (FacilitySystem.refreshAll 에서) */
export function updateCellarSlots(facilities) {
  const b = built.cellar;
  if (!b) return;
  for (const [kind, plates] of Object.entries(b.slotPlates)) {
    plates.forEach((p, i) => { p.visible = !facilities.some((f) => f.kind === kind && f.slot === i); });
  }
}

/** 퀘스트 · 엔딩 진행에 맞춰 장식을 바꾼다 (World.updateDecorations 에서 불림) */
function updateInteriorDecor(flags) {
  const h = built.house;
  if (h) {
    setItemShown(h.groups.drawing, !!flags.deco_drawing);
    setItemShown(h.groups.rod, !!flags.deco_rod);
    const name = G.state?.player?.name ?? '';
    setItemShown(h.groups.cert, !!flags.endingSeen);
    if (flags.endingSeen && h.certName !== name) {
      h.certName = name;
      const pic = h.groups.cert.obj.children[1];
      pic.material.map?.dispose();
      pic.material.map = certificateTex(name);
      pic.material.needsUpdate = true;
    }
  }
  const hall = built.hall;
  if (hall) {
    const grand = !!flags.hallBuilt;
    for (const e of hall.variants.old) setItemShown(e, !grand);
    for (const e of hall.variants.grand) setItemShown(e, grand);
    // 명패
    const text = flags.endingSeen ? `이장 ${G.state?.player?.name ?? ''}` : '이장 박○○';
    if (hall.namePlateText !== text) {
      if (hall.namePlate) hall.root.remove(hall.namePlate);
      hall.namePlate = makeLabel(text, { scale: 0.55 });
      hall.namePlate.position.set(hall.namePlateAt.x, 1.15, hall.namePlateAt.z);
      hall.root.add(hall.namePlate);
      hall.namePlateText = text;
    }
  }
  rebuildColliders();
}

/** 장식 하나 보이기/숨기기 — 숨기면 클릭 · 충돌도 빠진다 */
function setItemShown(e, on) {
  if (!e?.obj) return;
  e.obj.visible = on;
  e.hidden = !on;
  const i = interactables.indexOf(e.obj);
  if (on && e.id && i < 0) interactables.push(e.obj);
  if (!on && i >= 0) interactables.splice(i, 1);
}

function rebuildColliders() {
  roomColliders.length = 0;
  for (const b of Object.values(built)) for (const e of b.items) if (e.col && !e.hidden) roomColliders.push(e.col);
}

export function buildInteriors(scene) {
  buildHouse(scene);
  buildHall(scene);
  buildCellar(scene);
  for (const b of Object.values(built)) for (const e of b.items) if (e.id && !interactables.includes(e.obj)) interactables.push(e.obj);
  addDecorHook(updateInteriorDecor);
  rebuildColliders();
}

/** 방 안 상호작용 지점 목록 (E 키 · 가까운 것 찾기용) */
export function roomSpots(room) {
  return (built[room]?.items ?? []).filter((e) => e.id && !e.hidden);
}

/** 방 조명 자리 (Mine.js 의 등불 4개를 옮겨 쓴다) */
export function roomLightSpots(room) {
  const b = built[room];
  const o = ROOMS[room].origin;
  return (b?.lightSpots ?? []).map((s) => ({ ...s, x: o.x + s.x, z: o.z + s.z }));
}

const _sky = new THREE.Color();
const DAY_SKY = new THREE.Color(0xbfe6ff), DUSK_SKY = new THREE.Color(0xffb88a), NIGHT_SKY = new THREE.Color(0x26305a);

/**
 * 매 프레임 (방 안에 있을 때): 카메라 쪽 벽 자르기 · 창밖 하늘빛 · 등불(밤에 더 밝게) · 벽난로 깜빡임
 * lights: Mine.js 의 공용 등불
 */
export function updateInteriors(room, cameraPos, minutes, t, lights) {
  const b = built[room];
  if (!b) return;
  const o = ROOMS[room].origin;
  const dx = cameraPos.x - o.x, dz = cameraPos.z - o.z;
  const len = Math.hypot(dx, dz) || 1;
  const nx = dx / len, nz = dz / len;
  const facing = { n: -nz, s: nz, w: -nx, e: nx };
  for (const k of Object.keys(b.sides)) {
    const cut = facing[k] > 0.35;
    b.sides[k].visible = !cut;
    b.stubs[k].visible = cut;
  }
  // 문이 달린 벽이 잘리면 문틀도 숨기고 바닥 빛만
  if (b.door) {
    const cut = facing[b.doorSide] > 0.35;
    b.door.getObjectByName('tall').visible = !cut;
    b.door.getObjectByName('spill').visible = cut;
  }
  // 창밖: 낮 하늘 → 저녁 노을 → 밤
  const h = (minutes / 60) % 24;
  if (h < 17) _sky.copy(DAY_SKY);
  else if (h < 19) _sky.copy(DAY_SKY).lerp(DUSK_SKY, (h - 17) / 2);
  else if (h < 20.5) _sky.copy(DUSK_SKY).lerp(NIGHT_SKY, (h - 19) / 1.5);
  else _sky.copy(NIGHT_SKY);
  if (h < 6.5) _sky.copy(NIGHT_SKY).lerp(DAY_SKY, Math.max(0, h - 5.5));
  ROOM_GLASS.color.copy(_sky);
  ROOM_GLASS.emissive.copy(_sky);
  // 등불: 낮엔 은은하게, 밤엔 환하게
  const night = b.alwaysLit ? 1 : THREE.MathUtils.clamp((h - 17.5) / 2, 0, 1) || (h < 6 ? 1 : 0);
  const spots = b.lightSpots;
  lights.forEach((l, i) => {
    const s = spots[i];
    if (!s) { l.intensity = 0; return; }
    let p = s.power * (0.55 + 0.45 * night);
    if (s.fire) p *= 0.85 + Math.sin(t * 9) * 0.08 + Math.sin(t * 23) * 0.06;
    l.intensity = p;
  });
  if (b.fire) {
    b.fire.scale.set(1, 0.9 + Math.sin(t * 11) * 0.12, 1);
    FIRE_MAT.emissiveIntensity = 2.3 + Math.sin(t * 13) * 0.4;
  }
  // 낡은 회관: 천장에서 물방울이 똑똑
  const drop = b.bucket?.obj.getObjectByName('drop');
  if (drop && !b.bucket.hidden) {
    const k = (t * 0.7) % 1;
    drop.position.y = 2.6 - k * k * 2.4;
    drop.visible = k < 0.97;
  }
  LAMP_MAT.emissiveIntensity = 2 * night;
}
