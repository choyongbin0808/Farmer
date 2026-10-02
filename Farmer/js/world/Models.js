import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CROPS } from '../data/crops.js';

// ───────── 공용 머티리얼 / 지오메트리 캐시 ─────────
const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + '|' + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return matCache.get(key);
}

const geoCache = new Map();
function geo(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}

export function mesh(geometry, material, cast = true, receive = false) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

const sphere = (r, ws = 14, hs = 10) => geo(`s${r}|${ws}`, () => new THREE.SphereGeometry(r, ws, hs));
const cyl = (rt, rb, h, s = 12) => geo(`c${rt}|${rb}|${h}|${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const cone = (r, h, s = 12) => geo(`k${r}|${h}|${s}`, () => new THREE.ConeGeometry(r, h, s));
const rbox = (w, h, d, r = 0.08) => geo(`b${w}|${h}|${d}|${r}`, () => new RoundedBoxGeometry(w, h, d, 2, r));
const capsule = (r, l) => geo(`p${r}|${l}`, () => new THREE.CapsuleGeometry(r, l, 4, 10));

// 밤에 켜지는 창문 / 가로등 (DayNight에서 emissive 조절)
export const WINDOW_MAT = new THREE.MeshLambertMaterial({ color: 0xfff1c1, emissive: 0xffc861, emissiveIntensity: 0 });
export const LAMP_MAT = new THREE.MeshLambertMaterial({ color: 0xfff6d8, emissive: 0xffd27a, emissiveIntensity: 0 });

// ───────── 글자 라벨 (Sprite) ─────────
export function makeLabel(text, { bg = '#fff8e7', fg = '#6b4226', scale = 1 } = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = 'bold 44px Jua, "Gowun Dodum", sans-serif';
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 48;
  canvas.width = w;
  canvas.height = 76;
  ctx.font = font;
  ctx.fillStyle = bg;
  ctx.strokeStyle = '#8b5e3c';
  ctx.lineWidth = 6;
  roundRect(ctx, 3, 3, w - 6, 70, 22);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, 40);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  sp.scale.set((w / 76) * 0.9 * scale, 0.9 * scale, 1);
  return sp;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ───────── 건물 ─────────
function gableRoof(w, d, h, color) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 - 0.45, 0);
  shape.lineTo(w / 2 + 0.45, 0);
  shape.lineTo(0, h);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: d + 0.7, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2 });
  g.translate(0, 0, -(d + 0.7) / 2);
  return mesh(g, mat(color));
}

/**
 * 문이 로컬 +z 쪽에 있는 건물을 만든 뒤 facing 방향으로 회전
 * facing: 'south'(+z) | 'east'(+x) | 'west'(-x) | 'north'(-z)
 */
export function makeBuilding({ w, d, h, wall, roof, roofH = 2.2, facing = 'south', label, chimney = false, trim = 0x8b5e3c }) {
  const g = new THREE.Group();
  const body = mesh(rbox(w, h, d, 0.25), mat(wall), true, true);
  body.position.y = h / 2;
  g.add(body);

  const base = mesh(rbox(w + 0.3, 0.35, d + 0.3, 0.1), mat(0xb9a58a), true, true);
  base.position.y = 0.17;
  g.add(base);

  const r = gableRoof(w, d, roofH, roof);
  r.position.y = h - 0.05;
  g.add(r);

  const door = mesh(rbox(1.3, 2.1, 0.2, 0.08), mat(trim));
  door.position.set(0, 1.05, d / 2 + 0.05);
  g.add(door);
  const knob = mesh(sphere(0.07), mat(0xf2c641));
  knob.position.set(0.4, 1.05, d / 2 + 0.18);
  g.add(knob);

  for (const sx of [-1, 1]) {
    if (w < 4) break;
    const win = mesh(rbox(1, 0.9, 0.12, 0.05), WINDOW_MAT, false);
    win.position.set(sx * (w / 2 - 1.1), h * 0.58, d / 2 + 0.04);
    g.add(win);
    const frame = mesh(rbox(1.2, 1.1, 0.08, 0.04), mat(trim), false);
    frame.position.set(sx * (w / 2 - 1.1), h * 0.58, d / 2 + 0.0);
    g.add(frame);
  }

  if (chimney) {
    const ch = mesh(rbox(0.7, 1.6, 0.7, 0.08), mat(0x9a6b4f));
    ch.position.set(w / 4, h + roofH * 0.6, -d / 5);
    g.add(ch);
  }

  if (label) {
    const sp = makeLabel(label);
    sp.position.set(0, h + roofH + 0.9, d / 2);
    g.add(sp);
  }

  g.rotation.y = { south: 0, east: Math.PI / 2, west: -Math.PI / 2, north: Math.PI }[facing];
  return g;
}

export function makeStorageBarn() {
  const g = makeBuilding({ w: 5, d: 5, h: 3.2, wall: 0xc8483b, roof: 0x7a2d26, roofH: 2, facing: 'west', label: '창고', trim: 0xfff3dc });
  return g;
}

export function makeAnvil() {
  const g = new THREE.Group();
  const base = mesh(rbox(0.5, 0.5, 0.4, 0.05), mat(0x5b4a3e));
  base.position.y = 0.25;
  const top = mesh(rbox(1, 0.3, 0.45, 0.06), mat(0x55585e));
  top.position.y = 0.65;
  g.add(base, top);
  return g;
}

export function makeFurnace() {
  const g = new THREE.Group();
  const body = mesh(rbox(1.4, 1.4, 1.2, 0.2), mat(0x8e6a55));
  body.position.y = 0.7;
  const fire = mesh(rbox(0.7, 0.5, 0.1, 0.05), new THREE.MeshLambertMaterial({ color: 0xff9a3c, emissive: 0xff6a00, emissiveIntensity: 1.2 }), false);
  fire.position.set(0, 0.55, 0.6);
  g.add(body, fire);
  return g;
}

// ───────── 자연물 ─────────
const LEAF_COLORS = [0x6fbf4a, 0x5aa83f, 0x86c95a, 0x4f9a3a];
export function makeTree(kind = 'round', scale = 1) {
  const g = new THREE.Group();
  const trunk = mesh(cyl(0.18, 0.26, 1.4, 8), mat(0x8b5a3c));
  trunk.position.y = 0.7;
  g.add(trunk);
  const leaf = mat(LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)]);
  if (kind === 'pine') {
    for (let i = 0; i < 3; i++) {
      const c = mesh(cone(1.1 - i * 0.28, 1.3, 10), leaf);
      c.position.y = 1.6 + i * 0.75;
      g.add(c);
    }
  } else {
    const parts = [[0, 2.1, 0, 1.05], [0.55, 1.8, 0.2, 0.7], [-0.5, 1.85, -0.2, 0.75], [0.1, 2.75, 0.1, 0.7]];
    for (const [x, y, z, r] of parts) {
      const s = mesh(sphere(r, 12, 9), leaf);
      s.position.set(x, y, z);
      g.add(s);
    }
  }
  g.scale.setScalar(scale);
  g.rotation.y = Math.random() * Math.PI * 2;
  return g;
}

export function makeBush(color = 0x5fae45) {
  const g = new THREE.Group();
  for (const [x, z, r] of [[0, 0, 0.55], [0.45, 0.1, 0.4], [-0.4, 0.05, 0.42]]) {
    const s = mesh(sphere(r, 10, 8), mat(color));
    s.position.set(x, r * 0.8, z);
    g.add(s);
  }
  return g;
}

const FLOWER_COLORS = [0xff7aa8, 0xffd84d, 0xffffff, 0xb48cff, 0xff9a5a];
export function makeFlower(color) {
  const g = new THREE.Group();
  const stem = mesh(cyl(0.025, 0.025, 0.4, 5), mat(0x4f9a3a), false);
  stem.position.y = 0.2;
  const head = mesh(sphere(0.11, 8, 6), mat(color ?? FLOWER_COLORS[Math.floor(Math.random() * FLOWER_COLORS.length)]), false);
  head.position.y = 0.42;
  g.add(stem, head);
  return g;
}

export function makeRock(scale = 1) {
  const m = mesh(geo('rock', () => new THREE.DodecahedronGeometry(0.5, 0)), mat(0xa8a39a));
  m.scale.set(scale, scale * 0.7, scale);
  m.rotation.set(Math.random(), Math.random(), Math.random());
  m.position.y = 0.2 * scale;
  return m;
}

export function makeFencePost() {
  const m = mesh(rbox(0.2, 1, 0.2, 0.05), mat(0xc49a6c));
  m.position.y = 0.5;
  return m;
}

export function makeFenceLine(x1, z1, x2, z2) {
  const g = new THREE.Group();
  const len = Math.hypot(x2 - x1, z2 - z1);
  const n = Math.max(1, Math.round(len / 1.6));
  for (let i = 0; i <= n; i++) {
    const p = makeFencePost();
    p.position.x = x1 + ((x2 - x1) * i) / n;
    p.position.z = z1 + ((z2 - z1) * i) / n;
    g.add(p);
  }
  for (const y of [0.35, 0.75]) {
    const rail = mesh(rbox(len, 0.1, 0.08, 0.03), mat(0xd8b07e));
    rail.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
    rail.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    g.add(rail);
  }
  return g;
}

export function makeLamp() {
  const g = new THREE.Group();
  const post = mesh(cyl(0.07, 0.1, 2.6, 8), mat(0x4a4a52));
  post.position.y = 1.3;
  const head = mesh(sphere(0.25, 12, 10), LAMP_MAT, false);
  head.position.y = 2.75;
  const cap = mesh(cone(0.32, 0.25, 10), mat(0x4a4a52));
  cap.position.y = 3.05;
  g.add(post, head, cap);
  return g;
}

export function makeBench() {
  const g = new THREE.Group();
  const seat = mesh(rbox(1.8, 0.12, 0.5, 0.04), mat(0xb07d4b));
  seat.position.y = 0.45;
  const back = mesh(rbox(1.8, 0.4, 0.1, 0.04), mat(0xb07d4b));
  back.position.set(0, 0.75, -0.22);
  g.add(seat, back);
  for (const x of [-0.75, 0.75]) {
    const leg = mesh(rbox(0.1, 0.45, 0.4, 0.02), mat(0x5b4a3e));
    leg.position.set(x, 0.22, 0);
    g.add(leg);
  }
  return g;
}

export function makeFlowerPot() {
  const g = new THREE.Group();
  const pot = mesh(cyl(0.28, 0.2, 0.4, 10), mat(0xc0683f));
  pot.position.y = 0.2;
  g.add(pot);
  for (let i = 0; i < 3; i++) {
    const f = makeFlower();
    f.position.set((Math.random() - 0.5) * 0.25, 0.25, (Math.random() - 0.5) * 0.25);
    g.add(f);
  }
  return g;
}

export function makeFishingRod() {
  const g = new THREE.Group();
  const rod = mesh(cyl(0.03, 0.04, 2.2, 6), mat(0x8b5a3c));
  rod.rotation.z = 0.5;
  rod.position.set(0.5, 1, 0);
  const bucket = mesh(cyl(0.25, 0.2, 0.35, 10), mat(0x5a8fc2));
  bucket.position.set(-0.3, 0.18, 0.2);
  g.add(rod, bucket);
  return g;
}

export function makeEasel() {
  const g = new THREE.Group();
  const board = mesh(rbox(0.9, 0.7, 0.06, 0.03), mat(0xfff8e7));
  board.position.set(0, 1.1, 0);
  board.rotation.x = -0.15;
  const pic = mesh(rbox(0.6, 0.45, 0.02, 0.01), mat(0xffb3c7), false);
  pic.position.set(0, 1.12, 0.05);
  pic.rotation.x = -0.15;
  const sun = mesh(sphere(0.08, 8, 6), mat(0xffd84d), false);
  sun.position.set(0.15, 1.22, 0.08);
  g.add(board, pic, sun);
  for (const x of [-0.3, 0.3]) {
    const leg = mesh(cyl(0.03, 0.03, 1.3, 5), mat(0x8b5a3c));
    leg.position.set(x, 0.65, 0.1);
    g.add(leg);
  }
  return g;
}

// ───────── 캐릭터 ─────────
/**
 * look: { skin, top, bottom, hair, hairStyle, beard, glasses, cap, hatStraw, scale }
 * 반환값의 parts 로 애니메이션 / 옷 교체
 */
export function makeCharacter(look = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const skinM = mat(look.skin ?? 0xf3c9a0);
  const topM = new THREE.MeshLambertMaterial({ color: look.top ?? 0xffffff });
  const botM = new THREE.MeshLambertMaterial({ color: look.bottom ?? 0x7a6a5a });

  const legs = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.17, 0.62, 0);
    const leg = mesh(capsule(0.13, 0.36), botM);
    leg.position.y = -0.3;
    const shoe = mesh(rbox(0.26, 0.14, 0.34, 0.06), mat(0x5b4030));
    shoe.position.set(0, -0.56, 0.04);
    pivot.add(leg, shoe);
    body.add(pivot);
    legs.push(pivot);
  }

  const skirt = mesh(cone(0.5, 0.55, 14), botM);
  skirt.position.y = 0.72;
  skirt.visible = false;
  body.add(skirt);

  const torso = mesh(capsule(0.33, 0.38), topM);
  torso.position.y = 1.08;
  body.add(torso);

  const arms = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.42, 1.32, 0);
    const arm = mesh(capsule(0.1, 0.36), topM);
    arm.position.y = -0.28;
    const hand = mesh(sphere(0.11, 10, 8), skinM);
    hand.position.y = -0.55;
    pivot.add(arm, hand);
    body.add(pivot);
    arms.push(pivot);
  }
  const handSlot = new THREE.Group();
  handSlot.position.set(0, -0.6, 0.08);
  arms[1].add(handSlot);

  const head = new THREE.Group();
  head.position.y = 1.78;
  body.add(head);
  const face = mesh(sphere(0.36, 18, 14), skinM);
  head.add(face);
  for (const sx of [-1, 1]) {
    const eye = mesh(sphere(0.045, 8, 6), mat(0x2b2b2b), false);
    eye.position.set(sx * 0.13, 0.03, 0.33);
    const cheek = mesh(sphere(0.06, 8, 6), mat(0xffa3a3), false);
    cheek.position.set(sx * 0.21, -0.08, 0.28);
    cheek.scale.z = 0.4;
    head.add(eye, cheek);
  }
  if (look.glasses) {
    for (const sx of [-1, 1]) {
      const ring = mesh(geo('glass', () => new THREE.TorusGeometry(0.07, 0.015, 6, 16)), mat(0x333333), false);
      ring.position.set(sx * 0.13, 0.03, 0.35);
      head.add(ring);
    }
  }
  if (look.beard) {
    const b = mesh(sphere(0.22, 12, 10), mat(look.beard));
    b.position.set(0, -0.22, 0.2);
    b.scale.set(1.1, 0.8, 0.8);
    head.add(b);
  }

  const hairM = mat(look.hair ?? 0x3b2a1e);
  const hair = new THREE.Group();
  head.add(hair);
  const style = look.hairStyle ?? 'short';
  if (style !== 'bald') {
    const cap = mesh(geo('haircap', () => new THREE.SphereGeometry(0.38, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55)), hairM);
    cap.position.y = 0.02;
    cap.rotation.x = -0.25;
    hair.add(cap);
  } else {
    for (const sx of [-1, 1]) {
      const side = mesh(sphere(0.12, 8, 6), hairM);
      side.position.set(sx * 0.32, 0, -0.08);
      hair.add(side);
    }
  }
  if (style === 'bun') {
    const bun = mesh(sphere(0.16, 10, 8), hairM);
    bun.position.set(0, 0.3, -0.25);
    hair.add(bun);
  } else if (style === 'pigtail') {
    for (const sx of [-1, 1]) {
      const t = mesh(sphere(0.14, 10, 8), hairM);
      t.position.set(sx * 0.38, 0.05, -0.12);
      hair.add(t);
    }
  } else if (style === 'long') {
    const back = mesh(rbox(0.62, 0.7, 0.2, 0.08), hairM);
    back.position.set(0, -0.2, -0.24);
    hair.add(back);
  }

  const hatSlot = new THREE.Group();
  head.add(hatSlot);
  if (look.cap) hatSlot.add(makeHat('cap', look.cap));
  if (look.hatStraw) hatSlot.add(makeHat('straw', look.hatStraw));

  root.scale.setScalar(look.scale ?? 1);
  return { root, body, parts: { legs, arms, head, torso, skirt, hatSlot, handSlot, topM, botM, hair } };
}

export function makeHat(style, color) {
  const g = new THREE.Group();
  const m = mat(color);
  if (style === 'straw') {
    const brim = mesh(cyl(0.62, 0.62, 0.05, 20), m);
    brim.position.y = 0.2;
    const crown = mesh(cyl(0.3, 0.34, 0.28, 16), m);
    crown.position.y = 0.36;
    const band = mesh(cyl(0.345, 0.345, 0.07, 16), mat(0xc0483b));
    band.position.y = 0.25;
    g.add(brim, crown, band);
  } else if (style === 'cap') {
    const top = mesh(geo('capdome', () => new THREE.SphereGeometry(0.39, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5)), m);
    top.position.y = 0.06;
    const visor = mesh(rbox(0.5, 0.05, 0.32, 0.02), m);
    visor.position.set(0, 0.08, 0.42);
    g.add(top, visor);
  } else if (style === 'headband') {
    const band = mesh(geo('band', () => new THREE.TorusGeometry(0.36, 0.045, 8, 24)), mat(0x6fbf4a));
    band.rotation.x = Math.PI / 2 - 0.3;
    band.position.y = 0.16;
    g.add(band);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const f = mesh(sphere(0.07, 8, 6), mat(i % 2 ? color : 0xffffff));
      f.position.set(Math.cos(a) * 0.36, 0.16 + Math.sin(a) * 0.1, Math.sin(a) * 0.35);
      g.add(f);
    }
  } else if (style === 'bandana') {
    const top = mesh(geo('bandana', () => new THREE.SphereGeometry(0.4, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5)), m);
    top.position.y = 0.02;
    top.rotation.x = -0.2;
    const knot = mesh(sphere(0.1, 8, 6), m);
    knot.position.set(0, 0.05, -0.4);
    g.add(top, knot);
  } else if (style === 'fedora') {
    const brim = mesh(cyl(0.52, 0.52, 0.05, 20), m);
    brim.position.y = 0.24;
    const crown = mesh(cyl(0.28, 0.32, 0.36, 16), m);
    crown.position.y = 0.44;
    const band = mesh(cyl(0.325, 0.325, 0.08, 16), mat(0xb8860b));
    band.position.y = 0.3;
    g.add(brim, crown, band);
  }
  return g;
}

// ───────── 손에 드는 아이템 ─────────
export function makeHeldItem(item, toolColor = 0x8a7b6a) {
  const g = new THREE.Group();
  if (!item) return g;
  const stick = mat(0x9b6b43);
  if (item.type === 'tool') {
    if (item.toolKind === 'hoe') {
      const h = mesh(cyl(0.03, 0.03, 0.9, 6), stick);
      h.position.y = -0.2;
      const blade = mesh(rbox(0.32, 0.06, 0.2, 0.02), mat(toolColor));
      blade.position.set(0, -0.62, 0.1);
      g.add(h, blade);
    } else if (item.toolKind === 'can') {
      const body = mesh(cyl(0.16, 0.18, 0.3, 12), mat(toolColor));
      body.position.y = -0.15;
      const spout = mesh(cyl(0.03, 0.04, 0.35, 6), mat(toolColor));
      spout.rotation.x = Math.PI / 3;
      spout.position.set(0, -0.08, 0.25);
      g.add(body, spout);
    } else {
      const h = mesh(cyl(0.03, 0.03, 0.5, 6), stick);
      h.position.y = -0.1;
      const blade = mesh(geo('sickle', () => new THREE.TorusGeometry(0.2, 0.03, 6, 14, Math.PI)), mat(toolColor));
      blade.position.set(0, -0.35, 0.18);
      blade.rotation.y = Math.PI / 2;
      g.add(h, blade);
    }
    g.rotation.x = Math.PI / 2.4;
  } else if (item.type === 'seed') {
    const bag = mesh(sphere(0.14, 10, 8), mat(0xe8d6a8));
    bag.scale.y = 1.2;
    g.add(bag);
  } else if (item.type === 'crop') {
    const c = mesh(sphere(0.15, 10, 8), mat(CROPS[item.cropId].color));
    g.add(c);
  } else if (item.type === 'food') {
    const f = mesh(rbox(0.26, 0.16, 0.2, 0.05), mat(0xf2c47e));
    g.add(f);
  } else if (item.type === 'special') {
    const b = mesh(cyl(0.1, 0.1, 0.25, 10), mat(0x7ccf5a));
    g.add(b);
  }
  return g;
}

// ───────── 작물 성장 단계 모델 ─────────
const LEAF = () => mat(0x5fb544);
const LEAF_LIGHT = () => mat(0x8bd16a);

function leafBlade(h = 0.35, w = 0.08) {
  return mesh(geo(`blade${h}|${w}`, () => {
    const g = new THREE.SphereGeometry(1, 8, 6);
    g.scale(w, h, w * 0.4);
    g.translate(0, h, 0);
    return g;
  }), LEAF());
}

function sprout(scale = 1) {
  const g = new THREE.Group();
  const stem = mesh(cyl(0.02, 0.02, 0.18, 5), LEAF(), false);
  stem.position.y = 0.09;
  g.add(stem);
  for (const sx of [-1, 1]) {
    const l = mesh(sphere(0.08, 8, 6), LEAF_LIGHT(), false);
    l.scale.set(1.3, 0.4, 0.8);
    l.position.set(sx * 0.08, 0.18, 0);
    g.add(l);
  }
  g.scale.setScalar(scale);
  return g;
}

function growing(cropId) {
  const g = new THREE.Group();
  const tall = cropId === 'corn' || cropId === 'tomato';
  const n = 5;
  for (let i = 0; i < n; i++) {
    const b = leafBlade(tall ? 0.42 : 0.26, 0.09);
    b.rotation.z = Math.cos((i / n) * Math.PI * 2) * 0.6;
    b.rotation.x = Math.sin((i / n) * Math.PI * 2) * 0.6;
    g.add(b);
  }
  if (tall) {
    const stem = mesh(cyl(0.035, 0.04, 0.6, 6), LEAF());
    stem.position.y = 0.3;
    g.add(stem);
  }
  return g;
}

function ripe(cropId) {
  const g = new THREE.Group();
  const c = CROPS[cropId];
  const fruit = mat(c.color);
  switch (cropId) {
    case 'lettuce': {
      for (const [x, z, r] of [[0, 0, 0.26], [0.18, 0.1, 0.18], [-0.17, 0.08, 0.18], [0.05, -0.18, 0.18], [-0.08, 0.18, 0.16]]) {
        const s = mesh(sphere(r, 10, 8), fruit);
        s.position.set(x, r * 0.85, z);
        g.add(s);
      }
      break;
    }
    case 'radish': {
      const root = mesh(cyl(0.16, 0.1, 0.32, 10), fruit);
      root.position.y = 0.12;
      g.add(root);
      for (let i = 0; i < 4; i++) {
        const b = leafBlade(0.32, 0.08);
        b.position.y = 0.26;
        b.rotation.z = Math.cos(i * 1.6) * 0.5;
        b.rotation.x = Math.sin(i * 1.6) * 0.5;
        g.add(b);
      }
      break;
    }
    case 'potato': {
      for (const [x, z, r] of [[0, 0, 0.28], [0.2, 0.1, 0.2], [-0.2, 0.05, 0.2]]) {
        const s = mesh(sphere(r, 10, 8), LEAF());
        s.position.set(x, r + 0.05, z);
        g.add(s);
      }
      for (const [x, z] of [[0.25, 0.25], [-0.22, 0.25]]) {
        const p = mesh(sphere(0.11, 8, 6), fruit);
        p.position.set(x, 0.07, z);
        g.add(p);
      }
      break;
    }
    case 'carrot': {
      const top = mesh(cyl(0.13, 0.13, 0.08, 10), fruit);
      top.position.y = 0.04;
      g.add(top);
      for (let i = 0; i < 6; i++) {
        const b = leafBlade(0.36, 0.05);
        b.position.y = 0.06;
        b.rotation.z = Math.cos(i) * 0.45;
        b.rotation.x = Math.sin(i) * 0.45;
        g.add(b);
      }
      break;
    }
    case 'tomato': {
      const stake = mesh(cyl(0.025, 0.025, 1.1, 5), mat(0x9b6b43));
      stake.position.y = 0.55;
      g.add(stake);
      for (const [x, y, z, r] of [[0, 0.5, 0, 0.3], [0.1, 0.85, 0.05, 0.22]]) {
        const s = mesh(sphere(r, 10, 8), LEAF());
        s.position.set(x, y, z);
        g.add(s);
      }
      for (const [x, y, z] of [[0.24, 0.45, 0.15], [-0.22, 0.6, 0.15], [0.05, 0.35, 0.28], [0.18, 0.8, 0.18]]) {
        const t = mesh(sphere(0.11, 10, 8), fruit);
        t.position.set(x, y, z);
        g.add(t);
      }
      break;
    }
    case 'corn': {
      const stalk = mesh(cyl(0.05, 0.07, 1.5, 7), LEAF());
      stalk.position.y = 0.75;
      g.add(stalk);
      for (let i = 0; i < 4; i++) {
        const b = leafBlade(0.45, 0.07);
        b.position.y = 0.3 + i * 0.25;
        b.rotation.z = (i % 2 ? 1 : -1) * 0.9;
        b.rotation.y = i;
        g.add(b);
      }
      const cob = mesh(capsule(0.09, 0.28), fruit);
      cob.position.set(0.12, 0.95, 0);
      cob.rotation.z = -0.3;
      g.add(cob);
      break;
    }
    case 'strawberry': {
      for (const [x, z] of [[0, 0], [0.2, 0.1], [-0.18, 0.1], [0, -0.18]]) {
        const l = mesh(sphere(0.14, 8, 6), LEAF());
        l.scale.y = 0.5;
        l.position.set(x, 0.1, z);
        g.add(l);
      }
      for (const [x, z] of [[0.22, 0.22], [-0.22, 0.2], [0.05, 0.28], [0.25, -0.12]]) {
        const b = mesh(cone(0.08, 0.16, 8), fruit);
        b.rotation.x = Math.PI;
        b.position.set(x, 0.1, z);
        g.add(b);
      }
      break;
    }
    case 'pumpkin': {
      const p = mesh(geo('pumpkin', () => new THREE.SphereGeometry(0.42, 16, 12)), fruit);
      p.scale.y = 0.72;
      p.position.y = 0.3;
      const stem = mesh(cyl(0.04, 0.06, 0.18, 6), mat(0x6b8e23));
      stem.position.y = 0.66;
      const leaf = mesh(sphere(0.2, 8, 6), LEAF());
      leaf.scale.y = 0.3;
      leaf.position.set(-0.35, 0.1, 0.25);
      g.add(p, stem, leaf);
      break;
    }
    case 'watermelon': {
      const w = mesh(geo('melon', () => new THREE.SphereGeometry(0.42, 16, 12)), stripedMelon());
      w.scale.set(1, 0.82, 1.2);
      w.position.y = 0.33;
      const leaf = mesh(sphere(0.22, 8, 6), LEAF());
      leaf.scale.y = 0.3;
      leaf.position.set(0.4, 0.1, -0.3);
      g.add(w, leaf);
      break;
    }
    default:
      g.add(mesh(sphere(0.25), fruit));
  }
  return g;
}

let melonMat = null;
function stripedMelon() {
  if (melonMat) return melonMat;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#4fae45';
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = '#23602a';
  for (let i = 0; i < 8; i++) ctx.fillRect(i * 16, 0, 7, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  melonMat = new THREE.MeshLambertMaterial({ map: tex });
  return melonMat;
}

/** stage: 0 씨앗, 1 새싹, 2 성장, 3 다 자람 */
export function makeCropModel(cropId, stage) {
  if (stage === 0) {
    const g = new THREE.Group();
    for (const [x, z] of [[0.08, 0.05], [-0.1, 0.02], [0, -0.1]]) {
      const s = mesh(sphere(0.05, 6, 5), mat(0x6b4a2b), false);
      s.position.set(x, 0.03, z);
      g.add(s);
    }
    return g;
  }
  if (stage === 1) return sprout(1.3);
  if (stage === 2) return growing(cropId);
  return ripe(cropId);
}
