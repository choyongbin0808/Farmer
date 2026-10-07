import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CROPS } from '../data/crops.js';
import * as TX from './Textures.js';

// ═════════════════════════════════════════════════════════════
//  공용 재질 / 지오메트리
//  실사 스타일: 물리 기반 재질(MeshStandardMaterial) + 절차적 텍스처
// ═════════════════════════════════════════════════════════════

const matCache = new Map();
function optKey(opts) {
  return Object.entries(opts).map(([k, v]) => `${k}:${v?.isTexture ? v.uuid : v}`).join(',');
}

/** 기본 재질 (색 + 거칠기). opts 로 roughness/metalness/map 등 지정 */
export function mat(color, opts = {}) {
  const key = color + '|' + optKey(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...opts }));
  return matCache.get(key);
}

// 장난감처럼 부드러운 무광 재질 (금속도 살짝 반짝이는 정도)
const SURFACES = {
  plaster: { tex: TX.plasterTex, roughness: 0.9, normalScale: 0 },
  wood: { tex: TX.woodTex, roughness: 0.85, normalScale: 0 },
  bark: { tex: TX.barkTex, roughness: 0.9, normalScale: 0 },
  shingle: { tex: TX.shingleTex, roughness: 0.75, normalScale: 1.4 },
  stone: { tex: TX.stoneWallTex, roughness: 0.85, normalScale: 1.4 },
  metal: { tex: TX.metalTex, roughness: 0.45, metalness: 0.3, normalScale: 0 },
  paint: { tex: TX.metalTex, roughness: 0.45, metalness: 0.06, normalScale: 0 },
  fabric: { tex: TX.fabricTex, roughness: 0.9, normalScale: 0 },
  tire: { tex: TX.tireTex, roughness: 0.85, normalScale: 0 },
};

/** 텍스처가 있는 재질: kind = plaster | wood | bark | shingle | stone | metal | paint | fabric | tire */
export function surf(kind, color = 0xffffff, opts = {}) {
  const key = `surf:${kind}|${color}|${optKey(opts)}`;
  if (!matCache.has(key)) {
    const s = SURFACES[kind];
    const t = s.tex();
    // 요철은 은은하게 (실사보다 부드러운 표면)
    const ns = s.normalScale * 0.5;
    matCache.set(key, new THREE.MeshStandardMaterial({
      color, map: t.map, normalMap: ns ? t.normalMap : null,
      normalScale: new THREE.Vector2(ns, ns),
      roughness: s.roughness, metalness: s.metalness ?? 0, ...opts,
    }));
  }
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

/** 면 방향에 맞춰 월드 단위(scale m당 1번 반복) UV를 다시 계산 — 크기가 달라도 텍스처 밀도가 같다 */
function boxUV(g, scale = 1, swapTop = false) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) [u, v] = swapTop ? [z, x] : [x, z];
    else if (ax >= az) [u, v] = [z, y];
    else [u, v] = [x, y];
    uv.setXY(i, u / scale, v / scale);
  }
  uv.needsUpdate = true;
  return g;
}

function scaleUV(g, su, sv) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return g;
}

const sphere = (r, ws = 20, hs = 14) => geo(`s${r}|${ws}|${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
const cyl = (rt, rb, h, s = 16) => geo(`c${rt}|${rb}|${h}|${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const cone = (r, h, s = 16) => geo(`k${r}|${h}|${s}`, () => new THREE.ConeGeometry(r, h, s));
const rbox = (w, h, d, r = 0.02) => geo(`b${w}|${h}|${d}|${r}`, () => new RoundedBoxGeometry(w, h, d, 2, r));
const capsule = (r, l) => geo(`p${r}|${l}`, () => new THREE.CapsuleGeometry(r, l, 6, 14));
/** 월드 UV 상자 (텍스처용) — 모서리를 둥글게 깎아 아기자기한 느낌 */
const uvBox = (w, h, d, s = 1, swap = false) => geo(`ub${w}|${h}|${d}|${s}|${swap}`, () => {
  const r = Math.min(0.09, Math.min(w, h, d) * 0.3);
  return boxUV(new RoundedBoxGeometry(w, h, d, 3, r), s, swap);
});

// 밤에 켜지는 창문 / 가로등 (DayNight에서 emissive 조절)
export const WINDOW_MAT = new THREE.MeshStandardMaterial({ color: 0x9cc4dc, roughness: 0.12, metalness: 0.1, emissive: 0xffb562, emissiveIntensity: 0 });
export const LAMP_MAT = new THREE.MeshStandardMaterial({ color: 0xfff2d0, roughness: 0.3, emissive: 0xffc777, emissiveIntensity: 0 });

// ───────── 글자 라벨 (Sprite) ─────────
export function makeLabel(text, { scale = 1 } = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = '40px Jua, sans-serif';
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 48;
  canvas.width = w;
  canvas.height = 68;
  ctx.font = font;
  ctx.fillStyle = 'rgba(255, 249, 234, 0.95)';
  roundRect(ctx, 3, 3, w - 6, 62, 31);
  ctx.fill();
  ctx.strokeStyle = 'rgba(201, 170, 120, 0.9)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#6a4a30';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, 36);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, toneMapped: false, fog: false }));
  sp.scale.set((w / 68) * 0.62 * scale, 0.62 * scale, 1);
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

// ═════════════════════════════════════════════════════════════
//  건물
// ═════════════════════════════════════════════════════════════

function makeWindow(trimM) {
  const g = new THREE.Group();
  const frame = mesh(uvBox(1.0, 1.15, 0.12), trimM);
  const glass = mesh(new THREE.BoxGeometry(0.82, 0.97, 0.04), WINDOW_MAT, false);
  glass.position.z = 0.05;
  g.add(frame, glass);
  const v = mesh(uvBox(0.05, 0.97, 0.06), trimM, false);
  v.position.z = 0.08;
  const h = mesh(uvBox(0.82, 0.05, 0.06), trimM, false);
  h.position.z = 0.08;
  const sill = mesh(uvBox(1.18, 0.07, 0.24), trimM);
  sill.position.set(0, -0.6, 0.08);
  const lintel = mesh(uvBox(1.18, 0.1, 0.16), trimM);
  lintel.position.set(0, 0.62, 0.04);
  g.add(v, h, sill, lintel);
  return g;
}

/**
 * 문이 로컬 +z 쪽에 있는 건물을 만든 뒤 facing 방향으로 회전
 * facing: 'south'(+z) | 'east'(+x) | 'west'(-x) | 'north'(-z)
 * wallKind: 'plaster'(회벽) | 'wood'(널빤지) | 'stone'(돌벽), barn: 큰 미닫이 창고 문
 */
export function makeBuilding({ w, d, h, wall, roof, roofH = 2.2, facing = 'south', label, chimney = false, trim = 0x5a4030, wallKind = 'plaster', barn = false }) {
  const g = new THREE.Group();
  const wallM = surf(wallKind, wall);
  const trimM = surf('wood', trim);
  const stoneM = surf('stone', 0xc4bcb0);
  const roofM = surf('shingle', roof);

  // 돌 기초 + 벽
  const base = mesh(uvBox(w + 0.24, 0.5, d + 0.24), stoneM, true, true);
  base.position.y = 0.25;
  const body = mesh(uvBox(w, h - 0.45, d, wallKind === 'wood' ? 2 : 2.5), wallM, true, true);
  body.position.y = 0.45 + (h - 0.45) / 2;
  g.add(base, body);

  // 모서리 기둥 + 처마 아래 보 (목조 골조)
  if (wallKind !== 'stone') {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const post = mesh(uvBox(0.2, h - 0.45, 0.2), trimM);
      post.position.set(sx * (w / 2), 0.45 + (h - 0.45) / 2, sz * (d / 2));
      g.add(post);
    }
  }
  const beam = mesh(uvBox(w + 0.16, 0.2, d + 0.16), trimM);
  beam.position.y = h - 0.1;
  g.add(beam);

  // 박공 지붕: 박공벽 + 경사 지붕판 두 장 + 용마루
  const hw = w / 2 + 0.5;
  const e = roofH * (hw - w / 2) / hw;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(w / 2, e);
  shape.lineTo(0, roofH);
  shape.lineTo(-w / 2, e);
  shape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
  gableGeo.translate(0, 0, -d / 2);
  boxUV(gableGeo, 2.5);
  const gable = mesh(gableGeo, wallKind === 'stone' ? surf('plaster', 0xd8d0c2) : wallM);
  gable.position.y = h;
  g.add(gable);

  const a = Math.atan2(roofH, hw);
  const L = Math.hypot(hw, roofH) + 0.06;
  const slabGeo = boxUV(new THREE.BoxGeometry(L, 0.14, d + 0.9), 2, true);
  for (const sx of [-1, 1]) {
    const slab = mesh(slabGeo, roofM, true, true);
    slab.rotation.z = -sx * a;
    slab.position.set(sx * (hw / 2) + sx * Math.sin(a) * 0.07, h + roofH / 2 + Math.cos(a) * 0.07, 0);
    g.add(slab);
    // 처마 끝 판 (지붕 두께가 보이게)
    const fascia = mesh(uvBox(0.06, 0.22, d + 0.92), trimM);
    fascia.position.set(sx * (hw + 0.02), h - 0.02, 0);
    g.add(fascia);
  }
  const ridge = mesh(uvBox(0.26, 0.14, d + 0.94), surf('shingle', new THREE.Color(roof).multiplyScalar(0.7).getHex()));
  ridge.position.y = h + roofH + 0.1;
  g.add(ridge);

  // 문
  if (barn) {
    const doorW = Math.min(w - 1.2, 2.6), doorH = Math.min(h - 0.7, 2.6);
    for (const sx of [-1, 1]) {
      const leaf = mesh(uvBox(doorW / 2, doorH, 0.08), surf('wood', 0xb24a34));
      leaf.position.set(sx * doorW / 4, 0.45 + doorH / 2, d / 2 + 0.05);
      g.add(leaf);
      // X 보강대
      for (const s of [-1, 1]) {
        const brace = mesh(uvBox(0.1, Math.hypot(doorW / 2, doorH) - 0.15, 0.04), surf('wood', 0xd8d0c0));
        brace.position.set(sx * doorW / 4, 0.45 + doorH / 2, d / 2 + 0.11);
        brace.rotation.z = s * Math.atan2(doorW / 2, doorH);
        g.add(brace);
      }
    }
    const rail = mesh(uvBox(doorW + 0.6, 0.1, 0.1), surf('metal', 0x3a3a3a));
    rail.position.set(0, 0.5 + doorH, d / 2 + 0.1);
    g.add(rail);
  } else {
    const door = mesh(uvBox(1.1, 2.15, 0.1, 1.5), surf('wood', 0xa8784e));
    door.position.set(0, 0.45 + 1.075, d / 2 + 0.04);
    g.add(door);
    for (const sx of [-1, 1]) {
      const jamb = mesh(uvBox(0.14, 2.3, 0.14), trimM);
      jamb.position.set(sx * 0.62, 0.45 + 1.15, d / 2 + 0.05);
      g.add(jamb);
    }
    const head = mesh(uvBox(1.4, 0.16, 0.16), trimM);
    head.position.set(0, 0.45 + 2.3, d / 2 + 0.05);
    const knob = mesh(sphere(0.045, 12, 8), surf('metal', 0xb08d57));
    knob.position.set(0.38, 0.45 + 1.05, d / 2 + 0.11);
    const step = mesh(uvBox(1.6, 0.18, 0.7), stoneM, true, true);
    step.position.set(0, 0.09, d / 2 + 0.47);
    // 문 위 작은 차양
    const canopy = mesh(uvBox(1.7, 0.08, 0.7, 2, true), roofM);
    canopy.position.set(0, 0.45 + 2.55, d / 2 + 0.36);
    canopy.rotation.x = 0.28;
    g.add(head, knob, step, canopy);
    for (const sx of [-1, 1]) {
      const bracket = mesh(uvBox(0.07, 0.07, 0.62), trimM);
      bracket.position.set(sx * 0.75, 0.45 + 2.42, d / 2 + 0.3);
      bracket.rotation.x = -0.6;
      g.add(bracket);
    }
  }

  // 창문 (앞면 양쪽 + 옆면)
  const winY = 0.45 + (h - 0.45) * 0.55;
  if (w >= 4) {
    for (const sx of [-1, 1]) {
      const win = makeWindow(trimM);
      win.position.set(sx * (w / 2 - (barn ? 0.55 : 1.15)), winY, d / 2 + 0.02);
      if (barn) win.scale.setScalar(0.6);
      g.add(win);
    }
  }
  if (d >= 4) {
    for (const sx of [-1, 1]) {
      const win = makeWindow(trimM);
      win.position.set(sx * (w / 2 + 0.02), winY, 0);
      win.rotation.y = sx * Math.PI / 2;
      g.add(win);
    }
  }

  if (chimney) {
    const ch = mesh(uvBox(0.62, roofH + 1.1, 0.62), stoneM);
    ch.position.set(w / 4, h + (roofH + 1.1) / 2 - 0.1, -d / 5);
    const cap = mesh(uvBox(0.78, 0.1, 0.78), surf('stone', 0x6d6964));
    cap.position.set(w / 4, h + roofH + 1.0, -d / 5);
    g.add(ch, cap);
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
  return makeBuilding({ w: 5, d: 5, h: 3.4, wall: 0xd0583e, roof: 0x7a7e86, roofH: 2, facing: 'west', label: '창고', trim: 0xfff0dc, wallKind: 'wood', barn: true });
}

export function makeAnvil() {
  const g = new THREE.Group();
  const stump = mesh(cyl(0.3, 0.34, 0.55, 16), surf('bark', 0x8a7058));
  stump.position.y = 0.275;
  const top = mesh(cyl(0.29, 0.29, 0.02, 16), surf('wood', 0xb89a74));
  top.position.y = 0.56;
  const iron = surf('metal', 0x3c3e42, { roughness: 0.5 });
  const waist = mesh(rbox(0.22, 0.16, 0.18, 0.02), iron);
  waist.position.y = 0.65;
  const face = mesh(rbox(0.6, 0.12, 0.2, 0.02), iron);
  face.position.y = 0.78;
  const horn = mesh(cone(0.09, 0.32, 14), iron);
  horn.rotation.z = -Math.PI / 2;
  horn.position.set(0.46, 0.78, 0);
  horn.scale.z = 0.8;
  g.add(stump, top, waist, face, horn);
  return g;
}

export function makeFurnace() {
  const g = new THREE.Group();
  const stone = surf('stone', 0x8a7a6c);
  const body = mesh(uvBox(1.5, 1.0, 1.3), stone, true, true);
  body.position.y = 0.5;
  const hearth = mesh(uvBox(1.2, 0.08, 1.0), surf('stone', 0x3a3632));
  hearth.position.y = 1.02;
  const coals = mesh(new THREE.BoxGeometry(0.9, 0.08, 0.7), new THREE.MeshStandardMaterial({ color: 0x401a08, emissive: 0xff5a10, emissiveIntensity: 2.2, roughness: 1 }), false);
  coals.position.y = 1.08;
  const hood = mesh(cyl(0.25, 0.7, 0.7, 4), surf('metal', 0x3a3633));
  hood.rotation.y = Math.PI / 4;
  hood.position.y = 1.85;
  const flue = mesh(cyl(0.18, 0.18, 1.8, 12), surf('metal', 0x2e2c2a));
  flue.position.y = 3.0;
  g.add(body, hearth, coals, hood, flue);
  for (const sx of [-1, 1]) {
    const leg = mesh(uvBox(0.08, 0.9, 0.08), surf('metal', 0x2e2c2a));
    leg.position.set(sx * 0.55, 1.5, 0.45);
    g.add(leg);
  }
  return g;
}

// ═════════════════════════════════════════════════════════════
//  자연물: 잎 카드(알파 텍스처 평면)를 모아 만든 나무 / 덤불
// ═════════════════════════════════════════════════════════════

/**
 * 잎·풀처럼 얇은 양면 재질: 뒷면에서도 노멀을 뒤집지 않아 앞뒤가 같은 밝기로 보인다
 * (실제 잎은 빛이 비쳐서 뒷면이 새까맣게 보이지 않음)
 */
export function foliage(material) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0'),
    );
  };
  material.customProgramCacheKey = () => 'foliage';
  return material;
}

/** 줄기 + 가지 (껍질 텍스처) */
function trunkGeo(h, r0, r1, branches) {
  const parts = [];
  const t = new THREE.CylinderGeometry(r1, r0, h, 10, 4);
  // 줄기를 살짝 휘게
  const p = t.attributes.position;
  const bend = (Math.random() - 0.5) * 0.25;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / h + 0.5;
    p.setX(i, p.getX(i) + Math.sin(y * Math.PI) * bend);
  }
  t.translate(0, h / 2, 0);
  scaleUV(t, 2, h);
  parts.push(t);
  for (const [y, ang, len, rad] of branches) {
    const b = new THREE.CylinderGeometry(rad * 0.4, rad, len, 7);
    b.translate(0, len / 2, 0);
    b.rotateZ(0.9);
    b.rotateY(ang);
    b.translate(0, y, 0);
    scaleUV(b, 1, len);
    parts.push(b);
  }
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}

/** 울퉁불퉁하고 동그란 잎 덩어리 하나 (노멀은 구 모양 그대로 → 부드럽게 둥근 음영) */
function blob(r, cx, cy, cz, squash = 0.92) {
  const g = new THREE.IcosahedronGeometry(r, 4);
  const p = g.attributes.position, n = g.attributes.normal;
  const v = new THREE.Vector3();
  const seed = Math.random() * 10;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const dir = v.clone().normalize();
    const k = 1 + 0.07 * Math.sin(dir.x * 7 + seed) + 0.06 * Math.sin(dir.y * 8 + seed * 2) + 0.06 * Math.sin(dir.z * 6 + seed * 3);
    v.multiplyScalar(k);
    p.setXYZ(i, v.x + cx, v.y * squash + cy, v.z + cz);
    n.setXYZ(i, dir.x, dir.y, dir.z);
  }
  return g;
}

function blobCluster(blobs) {
  const g = mergeGeometries(blobs);
  return boxUV(g, 1.4);
}

const FOLIAGE_COLORS = { round: [0x58a838, 0x68b444, 0x4c9a32], pine: [0x3a8a48, 0x449652] };
const foliageMats = {};
function foliageMat(color) {
  if (!foliageMats[color]) {
    const t = TX.foliageTex();
    foliageMats[color] = new THREE.MeshStandardMaterial({ color, map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.85 });
  }
  return foliageMats[color];
}

const TREE_VARIANTS = { round: [], pine: [] };
function treeVariant(kind) {
  const list = TREE_VARIANTS[kind];
  if (list.length < 5) {
    let trunk, crown;
    if (kind === 'pine') {
      // 동글납작한 층을 쌓은 삼나무
      trunk = trunkGeo(4.4, 0.24, 0.1, []);
      const blobs = [];
      for (let i = 0; i < 5; i++) blobs.push(blob(1.5 - i * 0.26, 0, 1.8 + i * 0.72, 0, 0.72));
      crown = blobCluster(blobs);
    } else {
      // 뭉게구름처럼 동그란 활엽수
      trunk = trunkGeo(2.4, 0.28, 0.18, [[1.9, Math.random() * 6, 0.8, 0.1], [2.1, Math.random() * 6, 0.7, 0.09]]);
      const blobs = [blob(1.45, 0, 3.6, 0)];
      const n = 5;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + Math.random() * 0.6;
        blobs.push(blob(0.9 + Math.random() * 0.25, Math.cos(a) * 1.0, 3.1 + Math.random() * 0.8, Math.sin(a) * 1.0));
      }
      blobs.push(blob(0.95, 0.1, 4.55, -0.05));
      crown = blobCluster(blobs);
    }
    list.push({ trunk, crown });
  }
  return list[Math.floor(Math.random() * list.length)];
}

export function makeTree(kind = 'round', scale = 1) {
  const g = new THREE.Group();
  const v = treeVariant(kind);
  const trunk = mesh(v.trunk, surf('bark', kind === 'pine' ? 0xa08870 : 0xb09078), true, true);
  const colors = FOLIAGE_COLORS[kind] || FOLIAGE_COLORS.round;
  const crown = mesh(v.crown, foliageMat(colors[Math.floor(Math.random() * colors.length)]), true, true);
  g.add(trunk, crown);
  g.scale.setScalar(scale);
  g.rotation.y = Math.random() * Math.PI * 2;
  return g;
}

const BUSH_GEOS = [];
export function makeBush() {
  if (BUSH_GEOS.length < 3) {
    BUSH_GEOS.push(blobCluster([blob(0.55, 0, 0.42, 0, 0.85), blob(0.42, 0.45, 0.32, 0.1, 0.85), blob(0.44, -0.42, 0.32, 0.05, 0.85), blob(0.38, 0.05, 0.3, 0.4, 0.85)]));
  }
  const m = mesh(BUSH_GEOS[Math.floor(Math.random() * BUSH_GEOS.length)], foliageMat(FOLIAGE_COLORS.round[Math.floor(Math.random() * 3)]), true, true);
  const g = new THREE.Group();
  g.add(m);
  g.rotation.y = Math.random() * Math.PI * 2;
  g.scale.setScalar(0.8 + Math.random() * 0.5);
  return g;
}

export const FLOWER_COLORS = [0xd94a6a, 0xf0c33c, 0xf2efe6, 0x8a62c4, 0xe07a3a];
export const FLOWER_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });

/** 꽃 한 송이(줄기 + 꽃잎 5장 + 꽃술 + 잎)를 정점 색이 있는 지오메트리 하나로 합친다 — 그리기 호출 1번 */
export function flowerGeometry(color) {
  return geo(`flower${color}`, () => {
    const parts = [];
    const add = (g, c, m) => {
      g.applyMatrix4(m);
      const col = new THREE.Color(c);
      const arr = new Float32Array(g.attributes.position.count * 3);
      for (let i = 0; i < arr.length; i += 3) arr.set([col.r, col.g, col.b], i);
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      g.deleteAttribute('uv');
      parts.push(g.index ? g.toNonIndexed() : g);
    };
    const m = new THREE.Matrix4();
    // 동물의 숲처럼 꽃잎이 큼직하고 통통한 꽃
    const h = 0.26;
    add(new THREE.CylinderGeometry(0.014, 0.018, h, 6), 0x5aa640, m.clone().makeTranslation(0, h / 2, 0));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const t = new THREE.Object3D();
      t.position.set(Math.cos(a) * 0.048, h, Math.sin(a) * 0.048);
      t.rotation.y = -a;
      t.scale.set(1, 0.38, 0.75);
      t.updateMatrix();
      add(new THREE.SphereGeometry(0.052, 12, 8), color, t.matrix);
    }
    add(new THREE.SphereGeometry(0.028, 12, 8), 0xffcf3a, m.clone().makeTranslation(0, h + 0.012, 0));
    for (const s of [-1, 1]) {
      const lt = new THREE.Object3D();
      lt.position.set(s * 0.05, h * 0.35, 0);
      lt.rotation.z = s * 0.5;
      lt.scale.set(1, 0.28, 0.55);
      lt.updateMatrix();
      add(new THREE.SphereGeometry(0.06, 10, 8), 0x62b048, lt.matrix);
    }
    return mergeGeometries(parts);
  });
}

export function makeFlower(color) {
  const c = color ?? FLOWER_COLORS[Math.floor(Math.random() * FLOWER_COLORS.length)];
  const m = mesh(flowerGeometry(c), FLOWER_MAT, false);
  m.scale.setScalar(0.75 + Math.random() * 0.5);
  m.rotation.y = Math.random() * Math.PI * 2;
  return m;
}

const ROCK_GEOS = [];
function rockGeo() {
  if (ROCK_GEOS.length < 5) {
    const g = new THREE.IcosahedronGeometry(0.5, 2);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    const seed = Math.random() * 10;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = 1 + Math.sin(v.x * 4 + seed) * 0.05 + Math.sin(v.y * 5 + seed * 2) * 0.04 + Math.sin(v.z * 4 + seed * 3) * 0.05;
      v.multiplyScalar(n);
      if (v.y < -0.15) v.y = -0.15 + (v.y + 0.15) * 0.3;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    boxUV(g, 0.6);
    ROCK_GEOS.push(g);
  }
  return ROCK_GEOS[Math.floor(Math.random() * ROCK_GEOS.length)];
}

export function makeRock(scale = 1) {
  const m = mesh(rockGeo(), mat(0xbab6b0, { roughness: 0.85 }), true, true);
  m.scale.set(scale, scale * 0.65, scale * (0.8 + Math.random() * 0.4));
  m.rotation.y = Math.random() * Math.PI * 2;
  m.position.y = 0.06 * scale;
  return m;
}

export function makeFencePost() {
  const g = new THREE.Group();
  const wood = surf('wood', 0xc8a47c);
  const post = mesh(cyl(0.08, 0.085, 1.05, 14), wood);
  post.position.y = 0.52;
  const top = mesh(sphere(0.08, 14, 8), wood);
  top.scale.y = 0.6;
  top.position.y = 1.05;
  g.add(post, top);
  return g;
}

export function makeFenceLine(x1, z1, x2, z2) {
  const g = new THREE.Group();
  const len = Math.hypot(x2 - x1, z2 - z1);
  const n = Math.max(1, Math.round(len / 2));
  for (let i = 0; i <= n; i++) {
    const p = makeFencePost();
    p.position.x = x1 + ((x2 - x1) * i) / n;
    p.position.z = z1 + ((z2 - z1) * i) / n;
    g.add(p);
  }
  for (const y of [0.42, 0.85]) {
    const rail = mesh(boxUV(new RoundedBoxGeometry(len, 0.1, 0.07, 2, 0.03), 1.2), surf('wood', 0xd8b890));
    rail.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
    rail.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    g.add(rail);
  }
  return g;
}

export function makeLamp() {
  const g = new THREE.Group();
  // 둥근 유리구슬 가로등
  const iron = surf('paint', 0x3e5a4a, { roughness: 0.5 });
  const foot = mesh(cyl(0.18, 0.22, 0.28, 20), iron);
  foot.position.y = 0.14;
  const post = mesh(cyl(0.07, 0.08, 2.6, 16), iron);
  post.position.y = 1.5;
  const collar = mesh(sphere(0.11, 16, 12), iron);
  collar.position.y = 2.82;
  const globe = mesh(sphere(0.26, 24, 18), LAMP_MAT, false);
  globe.position.y = 3.1;
  const cap = mesh(sphere(0.2, 20, 10, ), iron);
  cap.scale.y = 0.45;
  cap.position.y = 3.34;
  const finial = mesh(sphere(0.05, 10, 8), iron);
  finial.position.y = 3.44;
  g.add(foot, post, collar, globe, cap, finial);
  return g;
}

export function makeBench() {
  const g = new THREE.Group();
  const wood = surf('wood', 0xc8925c);
  const iron = surf('paint', 0x3e5a4a, { roughness: 0.5 });
  for (let i = 0; i < 4; i++) {
    const slat = mesh(uvBox(1.8, 0.04, 0.1), wood);
    slat.position.set(0, 0.45, -0.18 + i * 0.12);
    g.add(slat);
  }
  for (let i = 0; i < 3; i++) {
    const slat = mesh(uvBox(1.8, 0.1, 0.035), wood);
    slat.position.set(0, 0.62 + i * 0.13, -0.27 - i * 0.02);
    slat.rotation.x = -0.18;
    g.add(slat);
  }
  for (const x of [-0.75, 0.75]) {
    const leg = mesh(uvBox(0.05, 0.45, 0.5), iron);
    leg.position.set(x, 0.22, 0);
    const back = mesh(uvBox(0.05, 0.5, 0.05), iron);
    back.position.set(x, 0.7, -0.28);
    back.rotation.x = -0.18;
    g.add(leg, back);
  }
  return g;
}

export function makeFlowerPot() {
  const g = new THREE.Group();
  const pot = mesh(cyl(0.24, 0.17, 0.36, 18), mat(0xa4573a, { roughness: 0.9 }));
  pot.position.y = 0.18;
  const rim = mesh(cyl(0.26, 0.26, 0.05, 18), mat(0x9a5034, { roughness: 0.9 }));
  rim.position.y = 0.36;
  const soil = mesh(cyl(0.22, 0.22, 0.02, 16), mat(0x3a2a1e, { roughness: 1 }));
  soil.position.y = 0.36;
  g.add(pot, rim, soil);
  for (let i = 0; i < 4; i++) {
    const f = makeFlower();
    f.position.set((Math.random() - 0.5) * 0.24, 0.36, (Math.random() - 0.5) * 0.24);
    g.add(f);
  }
  return g;
}

export function makeFishingRod() {
  const g = new THREE.Group();
  const rod = mesh(cyl(0.012, 0.025, 2.4, 8), mat(0x3a2a20, { roughness: 0.5 }));
  rod.rotation.z = 0.55;
  rod.position.set(0.55, 1.0, 0);
  const reel = mesh(cyl(0.05, 0.05, 0.05, 12), surf('metal', 0x8a8d90));
  reel.rotation.x = Math.PI / 2;
  reel.position.set(1.05, 0.25, 0);
  const bucket = mesh(cyl(0.2, 0.17, 0.32, 18, true), surf('metal', 0x9aa0a4));
  bucket.position.set(-0.3, 0.16, 0.2);
  const handle = mesh(geo('bucketHandle', () => new THREE.TorusGeometry(0.2, 0.008, 6, 20, Math.PI)), surf('metal', 0x6a6d70));
  handle.position.set(-0.3, 0.32, 0.2);
  g.add(rod, reel, bucket, handle);
  return g;
}

let drawingTex = null;
function childDrawing() {
  if (drawingTex) return drawingTex;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 192;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f4efe2';
  ctx.fillRect(0, 0, 256, 192);
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#3f8a3a';
  ctx.beginPath(); ctx.moveTo(0, 150); ctx.lineTo(256, 150); ctx.stroke();
  ctx.fillStyle = '#e8b53a';
  ctx.beginPath(); ctx.arc(200, 45, 22, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#b5482e';
  ctx.strokeRect(50, 90, 70, 60);
  ctx.beginPath(); ctx.moveTo(42, 92); ctx.lineTo(85, 55); ctx.lineTo(128, 92); ctx.stroke();
  ctx.strokeStyle = '#2b2b2b';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(170, 118, 10, 0, Math.PI * 2); ctx.moveTo(170, 128); ctx.lineTo(170, 150); ctx.stroke();
  drawingTex = new THREE.CanvasTexture(c);
  drawingTex.colorSpace = THREE.SRGBColorSpace;
  return drawingTex;
}

export function makeEasel() {
  const g = new THREE.Group();
  const wood = surf('wood', 0x8a6a4a);
  const board = mesh(new THREE.BoxGeometry(0.8, 0.6, 0.03), [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ map: childDrawing(), roughness: 0.9 }), wood]);
  board.position.set(0, 1.15, 0.02);
  board.rotation.x = -0.12;
  const ledge = mesh(uvBox(0.9, 0.04, 0.1), wood);
  ledge.position.set(0, 0.83, 0.08);
  g.add(board, ledge);
  for (const [x, rz] of [[-0.3, -0.12], [0.3, 0.12]]) {
    const leg = mesh(uvBox(0.04, 1.6, 0.04), wood);
    leg.position.set(x, 0.78, 0.08);
    leg.rotation.set(-0.12, 0, rz);
    g.add(leg);
  }
  const back = mesh(uvBox(0.04, 1.5, 0.04), wood);
  back.position.set(0, 0.72, -0.25);
  back.rotation.x = 0.35;
  g.add(back);
  return g;
}

// ═════════════════════════════════════════════════════════════
//  캐릭터 (키 약 1.6m, 머리가 큰 2.5등신 — 매끈하게 이어진 장난감 인형 느낌)
//  몸통·다리·팔은 이음매 없는 회전체(Lathe), 얼굴은 머리에 그려 넣은 텍스처,
//  머리카락은 머리를 감싸는 한 덩어리 껍질
// ═════════════════════════════════════════════════════════════

/** 캐릭터 전체 크기 배율 (body 그룹에 적용 — 탈것은 root 에 붙으므로 커지지 않음) */
const CHAR_SCALE = 1.18;
/** 앉았을 때 엉덩이 바닥 높이 (탈것 좌석 높이 계산용) */
export const CHAR_SIT_HEIGHT = 0.46 * CHAR_SCALE;

/** 회전체. 단면은 위→아래, 아래→위 어느 쪽으로 적어도 된다 (면이 바깥을 보도록 아래→위로 맞춤) */
const lathe = (key, pts, seg = 28) => geo(key, () => {
  const ordered = pts[0][1] > pts[pts.length - 1][1] ? [...pts].reverse() : pts;
  const g = new THREE.LatheGeometry(ordered.map(([x, y]) => new THREE.Vector2(x, y)), seg);
  g.computeVertexNormals();
  return g;
});

// 머리 내부 좌표는 반지름 0.36 기준 (모자 좌표와 같음)
const HEAD_R = 0.36;
const FACE_R = 0.362;

/** 얼굴(눈·눈썹·볼터치·입)을 그린 캔버스 텍스처 — 정면에서 평면 투영 */
const faceTexCache = new Map();
function faceTexture(browColor) {
  if (faceTexCache.has(browColor)) return faceTexCache.get(browColor);
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  // 머리 좌표(x, y) → 캔버스 픽셀
  const px = (x) => (x / FACE_R * 0.5 + 0.5) * S;
  const py = (y) => (0.5 - y / FACE_R * 0.5) * S;
  const u = S / (FACE_R * 2); // 머리 좌표 1 당 픽셀

  // 볼터치
  for (const sx of [-1, 1]) {
    const g = ctx.createRadialGradient(px(sx * 0.2), py(-0.085), 0, px(sx * 0.2), py(-0.085), 0.075 * u);
    g.addColorStop(0, 'rgba(240,120,110,0.55)');
    g.addColorStop(1, 'rgba(240,120,110,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(px(sx * 0.2), py(-0.085), 0.075 * u, 0.05 * u, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // 동그랗고 큰 눈: 흰자 + 갈색 눈동자 + 반짝임
  for (const sx of [-1, 1]) {
    const ex = px(sx * 0.125), ey = py(0.0);
    ctx.fillStyle = '#fbfaf6';
    ctx.strokeStyle = '#3a2418';
    ctx.lineWidth = 0.009 * u;
    ctx.beginPath();
    ctx.ellipse(ex, ey, 0.058 * u, 0.066 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#5a3420';
    ctx.beginPath();
    ctx.ellipse(ex - sx * 0.006 * u, ey + 0.006 * u, 0.04 * u, 0.047 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#24140c';
    ctx.beginPath();
    ctx.ellipse(ex - sx * 0.006 * u, ey + 0.008 * u, 0.024 * u, 0.029 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex + 0.012 * u, ey - 0.02 * u, 0.013 * u, 0, Math.PI * 2);
    ctx.fill();
    // 눈썹: 짧고 둥근 호
    ctx.strokeStyle = '#' + browColor.toString(16).padStart(6, '0');
    ctx.lineWidth = 0.016 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(ex, py(0.085) + 0.06 * u, 0.06 * u, Math.PI * 1.32, Math.PI * 1.68);
    ctx.stroke();
  }
  // 입: 살짝 웃는 곡선
  ctx.strokeStyle = '#7a3a30';
  ctx.lineWidth = 0.013 * u;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(px(0), py(-0.125), 0.05 * u, Math.PI * 0.18, Math.PI * 0.82);
  ctx.stroke();

  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  faceTexCache.set(browColor, t);
  return t;
}

/** 얼굴 앞쪽을 덮는 얇은 껍질 — UV를 정면(xy) 평면 투영으로 다시 계산 */
const faceShellGeo = () => geo('faceShell', () => {
  const g = new THREE.SphereGeometry(FACE_R, 40, 28, 0, Math.PI, Math.PI * 0.18, Math.PI * 0.62);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / FACE_R * 0.5 + 0.5, p.getY(i) / FACE_R * 0.5 + 0.5);
  return g;
});

/**
 * 머리카락: 머리를 감싸는 구 껍질 하나. hairline(방위각 a, 0 = 정면)보다 아래의 정점은
 * 머리 속으로 밀어 넣어 숨긴다 → 이음매 없이 한 덩어리로 덮인 헬멧 같은 머리
 * mask(a, y) 가 true 인 정점만 머리카락으로 남는다
 */
function hairShellGeo(key, mask, R = 0.385) {
  return geo('hair:' + key, () => {
    const g = new THREE.SphereGeometry(R, 96, 64);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const a = Math.atan2(v.x, v.z);
      const y = v.y / R;
      // mask 는 머리카락 안쪽일수록 큰 값(경계 = 0)을 돌려준다 → 경계에서 둥글게 말려 들어감
      const k = smooth(-0.05, 0.03, mask(a, y));
      v.multiplyScalar(0.8 + 0.2 * Math.sqrt(k));
      v.y += Math.max(0, y) * 0.03 * k; // 정수리를 살짝 봉긋하게
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  });
}

const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
/** 앞머리(둥근 물결) → 옆머리 → 뒷머리로 내려가는 머리선 높이 (y / R) */
function bangsLine(a, front = 0.32, back = -0.55) {
  const s = Math.abs(a);
  const wave = 0.07 * Math.abs(Math.sin(a * 5.2));
  const f = front + wave;
  const side = 0.02;
  if (s < 1.1) return f + (side - f) * smooth(0.55, 1.1, s);
  return side + (back - side) * smooth(1.3, 2.6, s);
}

// 머리카락 영역 함수: 양수 = 머리카락, 0 = 머리선
const HAIR_MASKS = {
  short: (a, y) => y - bangsLine(a),
  // 앞머리 없이 뒤로 넘긴 머리
  bun: (a, y) => y - bangsLine(a, 0.52, -0.5) + 0.07 * Math.abs(Math.sin(a * 5.2)),
  // 정수리는 비고 옆·뒤에만 남은 머리
  bald: (a, y) => Math.min((Math.abs(a) - 1.25) * 0.4, 0.25 - y, y + 0.5),
};

/**
 * look: { skin, top, bottom, hair, hairStyle, beard, glasses, cap, hatStraw, scale }
 * 반환값의 parts 로 애니메이션 / 옷 교체
 */
export function makeCharacter(look = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(CHAR_SCALE);
  root.add(body);

  const skinM = mat(look.skin ?? 0xf0c4a0, { roughness: 0.62 });
  const fab = TX.fabricTex();
  const topM = new THREE.MeshStandardMaterial({ color: look.top ?? 0xf2ede2, map: fab.map, roughness: 0.85 });
  const botM = new THREE.MeshStandardMaterial({ color: look.bottom ?? 0x5e7aa8, map: fab.map, roughness: 0.85 });
  const shoeM = mat(0x6a4630, { roughness: 0.55 });
  const soleM = mat(0xf2ece0, { roughness: 0.7 });

  // 다리: 엉덩이 관절에서 회전. 짧고 통통한 한 덩어리 + 동글동글한 신발
  const legs = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.095, 0.5, 0);
    const leg = mesh(lathe('leg5', [
      [0, 0.07], [0.06, 0.062], [0.094, 0.03], [0.104, -0.02], [0.1, -0.14], [0.092, -0.28], [0.086, -0.37], [0.05, -0.405], [0, -0.41],
    ], 22), botM);
    const shoe = mesh(sphere(0.1, 20, 14), shoeM);
    shoe.scale.set(1.05, 0.66, 1.42);
    shoe.position.set(0, -0.435, 0.035);
    const sole = mesh(cyl(0.098, 0.1, 0.025, 20), soleM);
    sole.scale.set(1.05, 1, 1.4);
    sole.position.set(0, -0.488, 0.035);
    pivot.add(leg, shoe, sole);
    body.add(pivot);
    legs.push(pivot);
  }

  // 몸통: 바지(아래) + 윗옷(위)이 같은 단면으로 이어진 통통한 콩 모양.
  // 윗옷 밑단이 바지보다 살짝 넓어 옷이 겹쳐 입혀진 것처럼 보인다
  const pelvis = mesh(lathe('pelvis5', [
    [0, 0.4], [0.1, 0.405], [0.165, 0.43], [0.2, 0.47], [0.213, 0.52], [0.214, 0.6], [0.2, 0.64],
  ]), botM);
  pelvis.scale.z = 0.84;
  body.add(pelvis);

  const skirt = mesh(lathe('skirt5', [[0.2, 0.6], [0.225, 0.55], [0.27, 0.44], [0.3, 0.33], [0.29, 0.315]]), botM);
  skirt.scale.z = 0.88;
  skirt.visible = false;
  body.add(skirt);

  const torso = mesh(lathe('torso5', [
    [0.205, 0.555], [0.226, 0.565], [0.232, 0.6], [0.23, 0.68], [0.22, 0.77], [0.2, 0.85],
    [0.168, 0.915], [0.115, 0.965], [0.06, 0.99], [0, 0.998],
  ]), topM);
  torso.scale.z = 0.84;
  body.add(torso);

  // 팔: 어깨 관절에서 회전. 몸통 속에서 뻗어 나오는 둥근 반소매 + 팔 + 동그란 주먹손 (손이 엉덩이 높이까지 내려옴)
  const arms = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.15, 0.84, 0);
    pivot.rotation.z = sx * 0.36;
    // 소매 윗부분은 몸통 속에 묻혀 어깨에서 자연스럽게 이어진다
    const sleeve = mesh(lathe('sleeve6', [
      [0, 0.03], [0.06, 0.02], [0.084, -0.01], [0.087, -0.1], [0.089, -0.135], [0.072, -0.142],
    ], 20), topM);
    const arm = mesh(capsule(0.056, 0.25), skinM);
    arm.position.y = -0.2;
    const hand = mesh(sphere(0.074, 18, 14), skinM);
    hand.scale.set(1, 0.98, 0.92);
    hand.position.y = -0.38;
    pivot.add(sleeve, arm, hand);
    body.add(pivot);
    arms.push(pivot);
  }
  const handSlot = new THREE.Group();
  handSlot.position.set(0, -0.41, 0.02);
  arms[1].add(handSlot);

  // 머리: 몸통 위에 목 없이 바로 얹힌 큰 머리 (내부 좌표 반지름 0.36, 그룹 스케일로 크기 조절)
  const head = new THREE.Group();
  head.position.y = 1.245;
  head.scale.setScalar(0.9);
  body.add(head);
  const face = new THREE.Group(); // 두상 비율 (조금 넓적한 동그라미)
  face.scale.set(1.04, 0.96, 0.98);
  head.add(face);
  const skull = mesh(sphere(HEAD_R, 40, 30), skinM);
  const faceM = new THREE.MeshStandardMaterial({
    map: faceTexture(look.hair ?? 0x3a2618), transparent: true, depthWrite: false, roughness: 0.62,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const facePaint = mesh(faceShellGeo(), faceM, false);
  face.add(skull, facePaint);
  for (const sx of [-1, 1]) {
    const ear = mesh(sphere(0.075, 16, 12), skinM);
    ear.scale.set(0.5, 0.9, 0.72);
    ear.position.set(sx * 0.345, -0.03, -0.01);
    face.add(ear);
  }
  const nose = mesh(sphere(0.042, 16, 12), skinM);
  nose.scale.set(1.1, 0.9, 0.8);
  nose.position.set(0, -0.06, 0.352);
  face.add(nose);
  if (look.glasses) {
    const gM = mat(0x2a2420, { roughness: 0.4, metalness: 0.3 });
    for (const sx of [-1, 1]) {
      const ring = mesh(geo('glass3', () => new THREE.TorusGeometry(0.082, 0.01, 6, 24)), gM, false);
      ring.position.set(sx * 0.125, 0.0, 0.365);
      const temple = mesh(cyl(0.008, 0.008, 0.3, 5), gM, false);
      temple.rotation.x = Math.PI / 2;
      temple.position.set(sx * 0.22, 0.02, 0.21);
      face.add(ring, temple);
    }
    const bridge = mesh(cyl(0.009, 0.009, 0.06, 5), gM, false);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.02, 0.372);
    face.add(bridge);
  }

  const hairM = mat(look.hair ?? 0x2a1e16, { roughness: 0.6 });
  if (look.beard) {
    const beardM = mat(look.beard, { roughness: 0.9 });
    const b = mesh(sphere(0.3, 24, 16), beardM);
    b.scale.set(0.9, 0.62, 0.8);
    b.position.set(0, -0.2, 0.09);
    const mustache = mesh(capsule(0.032, 0.12), beardM);
    mustache.rotation.z = Math.PI / 2;
    mustache.position.set(0, -0.115, 0.33);
    face.add(b, mustache);
  }
  const hair = new THREE.Group();
  face.add(hair);
  const style = look.hairStyle ?? 'short';
  const maskKey = HAIR_MASKS[style] ? style : 'short';
  hair.add(mesh(hairShellGeo(maskKey, HAIR_MASKS[maskKey]), hairM));
  if (style === 'bun') {
    const bun = mesh(sphere(0.15, 18, 14), hairM);
    bun.position.set(0, 0.26, -0.27);
    hair.add(bun);
  } else if (style === 'pigtail') {
    for (const sx of [-1, 1]) {
      const tail = mesh(capsule(0.085, 0.2), hairM);
      tail.position.set(sx * 0.36, -0.12, -0.12);
      tail.rotation.z = sx * 0.35;
      const tie = mesh(geo('tie2', () => new THREE.TorusGeometry(0.07, 0.022, 8, 16)), mat(0xd04050, { roughness: 0.5 }));
      tie.rotation.set(Math.PI / 2, 0, sx * 0.35);
      tie.position.set(sx * 0.32, 0.0, -0.12);
      hair.add(tail, tie);
    }
  } else if (style === 'long') {
    // 뒷머리: 위쪽은 머리 껍질 속에 묻히고, 아래로 갈수록 그 곡면을 그대로 이어 내려온다
    const back = mesh(lathe('longHair3', [[0, 0.25], [0.33, 0.15], [0.37, 0.0], [0.365, -0.2], [0.335, -0.4], [0.27, -0.53], [0, -0.57]], 32), hairM);
    back.scale.set(1.0, 1, 0.72);
    back.position.set(0, 0, -0.1);
    hair.add(back);
  }

  const hatSlot = new THREE.Group();
  face.add(hatSlot);
  if (look.cap) hatSlot.add(makeHat('cap', look.cap));
  if (look.hatStraw) hatSlot.add(makeHat('straw', look.hatStraw));

  root.scale.setScalar(look.scale ?? 1);
  return { root, body, parts: { legs, arms, head, torso, skirt, hatSlot, handSlot, topM, botM, hair } };
}

/** 모자 (머리 내부 좌표 = 반지름 0.36 기준) */
export function makeHat(style, color) {
  const g = new THREE.Group();
  if (style === 'straw') {
    const straw = surf('fabric', color, { roughness: 0.95 });
    const brim = mesh(cyl(0.66, 0.7, 0.04, 36), straw);
    brim.position.y = 0.14;
    const crown = mesh(cyl(0.3, 0.36, 0.3, 28), straw);
    crown.position.y = 0.3;
    const top = mesh(cyl(0.3, 0.3, 0.02, 28), straw);
    top.position.y = 0.46;
    const band = mesh(cyl(0.365, 0.365, 0.07, 28), mat(0x3a2a22, { roughness: 0.6 }));
    band.position.y = 0.2;
    g.add(brim, crown, top, band);
  } else if (style === 'cap') {
    const m = surf('fabric', color);
    const dome = mesh(geo('capdome2', () => new THREE.SphereGeometry(0.42, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.5)), m);
    dome.scale.set(0.95, 0.85, 1);
    dome.position.y = 0.05;
    const visor = mesh(geo('visor', () => {
      const s = new THREE.Shape();
      s.absarc(0, 0, 0.3, 0, Math.PI, false);
      const gg = new THREE.ExtrudeGeometry(s, { depth: 0.025, bevelEnabled: false });
      gg.rotateX(Math.PI / 2);
      return gg;
    }), m);
    visor.position.set(0, 0.08, 0.3);
    visor.rotation.x = -0.12;
    const button = mesh(sphere(0.035, 8, 6), m);
    button.position.y = 0.41;
    g.add(dome, visor, button);
  } else if (style === 'headband') {
    const band = mesh(geo('band2', () => new THREE.TorusGeometry(0.35, 0.025, 8, 32)), mat(0x5a7a3a, { roughness: 0.7 }));
    band.rotation.x = Math.PI / 2 - 0.35;
    band.position.y = 0.16;
    g.add(band);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const f = new THREE.Group();
      const pc = i % 3 === 0 ? 0xf2ede2 : color;
      for (let k = 0; k < 5; k++) {
        const p = mesh(sphere(0.035, 8, 6), mat(pc, { roughness: 0.6 }));
        const b = (k / 5) * Math.PI * 2;
        p.scale.set(1, 0.35, 0.65);
        p.position.set(Math.cos(b) * 0.035, 0, Math.sin(b) * 0.035);
        f.add(p);
      }
      const c = mesh(sphere(0.018, 6, 5), mat(0xd8a830));
      f.add(c);
      f.position.set(Math.cos(a) * 0.35, 0.16 + Math.sin(a) * 0.12, Math.sin(a) * 0.33);
      f.rotation.set(Math.PI / 2 - 0.35 + Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.6);
      g.add(f);
    }
  } else if (style === 'bandana') {
    const m = surf('fabric', color);
    const top = mesh(geo('bandana2', () => new THREE.SphereGeometry(0.415, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.5)), m);
    top.scale.set(0.92, 0.9, 1);
    top.position.y = 0.03;
    top.rotation.x = -0.25;
    const knot = mesh(sphere(0.07, 10, 8), m);
    knot.position.set(0, 0.0, -0.4);
    g.add(top, knot);
    for (const s of [-1, 1]) {
      const tail = mesh(rbox(0.1, 0.22, 0.02, 0.01), m);
      tail.position.set(s * 0.05, -0.12, -0.42);
      tail.rotation.z = s * 0.25;
      g.add(tail);
    }
  } else if (style === 'fedora') {
    const felt = surf('fabric', color, { roughness: 0.85 });
    const brim = mesh(cyl(0.56, 0.58, 0.03, 36), felt);
    brim.position.y = 0.2;
    const rim = mesh(geo('fedoraRim', () => new THREE.TorusGeometry(0.565, 0.018, 6, 36)), felt);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.22;
    const crown = mesh(cyl(0.29, 0.34, 0.36, 28), felt);
    crown.scale.z = 0.88;
    crown.position.y = 0.39;
    const dent = mesh(sphere(0.29, 20, 10), felt);
    dent.scale.set(1, 0.25, 0.85);
    dent.position.y = 0.56;
    const band = mesh(cyl(0.343, 0.343, 0.08, 28), mat(0x1a1612, { roughness: 0.4 }));
    band.scale.z = 0.88;
    band.position.y = 0.26;
    g.add(brim, rim, crown, dent, band);
  }
  return g;
}

// ───────── 손에 드는 아이템 ─────────
export function makeHeldItem(item, toolColor = 0x8a7b6a) {
  const g = new THREE.Group();
  if (!item) return g;
  const stick = surf('wood', 0x9a7a58);
  // 손(원점)에서 앞(+z)으로 뻗게 잡는다 — 날은 앞쪽 끝
  if (item.type === 'tool') {
    const metal = surf('metal', toolColor, { roughness: 0.38 });
    if (item.toolKind === 'hoe') {
      // 손잡이 끝을 쥐고, 앞쪽 끝의 날이 땅(아래)을 향함
      const h = mesh(cyl(0.017, 0.02, 0.72, 10), stick);
      h.rotation.x = Math.PI / 2;
      h.position.z = 0.26;
      const neck = mesh(cyl(0.014, 0.014, 0.14, 6), metal);
      neck.position.set(0, -0.05, 0.6);
      const blade = mesh(rbox(0.2, 0.15, 0.012, 0.004), metal);
      blade.position.set(0, -0.15, 0.58);
      blade.rotation.x = -0.35;
      g.add(h, neck, blade);
      g.rotation.x = 0.35;
    } else if (item.toolKind === 'can') {
      // 위쪽 손잡이를 쥐고 통은 손 아래에, 꼭지는 앞을 향함
      const body = mesh(cyl(0.11, 0.12, 0.24, 24), metal);
      body.position.y = -0.2;
      const grip = mesh(geo('canGrip2', () => new THREE.TorusGeometry(0.08, 0.012, 6, 16, Math.PI)), metal);
      grip.rotation.y = Math.PI / 2;
      grip.position.y = -0.08;
      const spout = mesh(cyl(0.012, 0.025, 0.3, 10), metal);
      spout.rotation.x = Math.PI / 4;
      spout.position.set(0, -0.17, 0.2);
      const rose = mesh(cyl(0.045, 0.02, 0.04, 14), metal);
      rose.rotation.x = Math.PI / 4;
      rose.position.set(0, -0.06, 0.31);
      rose.name = 'spout'; // 물방울이 나오는 꼭지 (Player에서 위치를 찾음)
      g.add(body, grip, spout, rose);
    } else {
      // 짧은 손잡이를 쥐고, 앞쪽 끝에서 날이 안쪽으로 휨
      const h = mesh(cyl(0.02, 0.022, 0.3, 10), stick);
      h.rotation.x = Math.PI / 2;
      h.position.z = 0.09;
      const ring = mesh(cyl(0.025, 0.025, 0.04, 10), metal);
      ring.rotation.x = Math.PI / 2;
      ring.position.z = 0.24;
      const blade = mesh(geo('sickle2', () => new THREE.TorusGeometry(0.15, 0.022, 4, 24, Math.PI * 0.9)), metal);
      blade.rotation.x = Math.PI / 2;
      blade.scale.z = 0.25;
      blade.position.set(-0.15, 0, 0.25);
      g.add(h, ring, blade);
      g.rotation.x = 0.25;
    }
  } else if (item.type === 'seed') {
    const bag = mesh(sphere(0.09, 14, 10), surf('fabric', 0xc8b48a));
    bag.scale.set(1, 1.3, 0.7);
    bag.position.y = -0.08;
    const tie = mesh(cyl(0.03, 0.04, 0.04, 10), mat(0x6a5038));
    tie.position.y = 0.04;
    g.add(bag, tie);
  } else if (item.type === 'crop') {
    const c = makeCropModel(item.cropId, 3);
    c.scale.setScalar(0.3);
    c.position.y = -0.1;
    g.add(c);
  } else if (item.type === 'food') {
    const f = mesh(sphere(0.08, 14, 10), mat(0xb98a4a, { roughness: 0.8 }));
    f.scale.set(1.4, 0.7, 1);
    f.position.y = -0.04;
    g.add(f);
  } else if (item.type === 'special') {
    const b = mesh(cyl(0.04, 0.045, 0.14, 14), mat(0x6a8a5a, { roughness: 0.2, transparent: true, opacity: 0.85 }));
    b.position.y = -0.06;
    const cork = mesh(cyl(0.022, 0.022, 0.03, 10), mat(0x8a6a48));
    cork.position.y = 0.025;
    g.add(b, cork);
  }
  return g;
}

// ═════════════════════════════════════════════════════════════
//  농기계 (트랙터 / 파종기) — 앞쪽 = +z, 좌석은 원점 근처
// ═════════════════════════════════════════════════════════════
export const VEHICLE_SEAT_Y = 1.02;

/** 바퀴(타이어 + 휠 + 너트). 굴러가는 회전용 피벗을 반환 */
function makeWheel(R, width, rimM) {
  const pivot = new THREE.Group();
  // 도넛처럼 둥글고 통통한 장난감 타이어
  const tube = Math.min(width / 2, R * 0.32);
  const tire = mesh(geo(`tire3${R}|${tube}`, () => new THREE.TorusGeometry(R - tube, tube, 16, 36)), mat(0x4a4648, { roughness: 0.85 }));
  tire.rotation.y = Math.PI / 2;
  const fill = mesh(cyl(R - tube, R - tube, width * 0.8, 28), mat(0x4a4648, { roughness: 0.85 }));
  fill.rotation.z = Math.PI / 2;
  pivot.add(fill);
  const rim = mesh(cyl(R * 0.6, R * 0.6, width * 0.86, 24), rimM);
  rim.rotation.z = Math.PI / 2;
  const hub = mesh(cyl(R * 0.22, R * 0.22, width + 0.06, 16), surf('metal', 0x8a8d90));
  hub.rotation.z = Math.PI / 2;
  pivot.add(tire, rim, hub);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    for (const s of [-1, 1]) {
      const nut = mesh(cyl(0.018, 0.018, 0.02, 6), surf('metal', 0x5a5d60), false);
      nut.rotation.z = Math.PI / 2;
      nut.position.set(s * (width / 2 + 0.04), Math.cos(a) * R * 0.15, Math.sin(a) * R * 0.15);
      pivot.add(nut);
    }
  }
  return pivot;
}

function addWheel(v, parent, R, width, rimM, x, y, z) {
  const w = makeWheel(R, width, rimM);
  w.position.set(x, y, z);
  parent.add(w);
  v.wheels.push({ pivot: w, r: R });
}

function seatAndBack(g) {
  const pad = mat(0x1e1e1e, { roughness: 0.55 });
  const seat = mesh(rbox(0.5, 0.09, 0.46, 0.04), pad);
  seat.position.set(0, VEHICLE_SEAT_Y - 0.045, -0.08);
  const back = mesh(rbox(0.5, 0.42, 0.08, 0.04), pad);
  back.position.set(0, VEHICLE_SEAT_Y + 0.22, -0.34);
  back.rotation.x = -0.15;
  const post = mesh(uvBox(0.1, 0.3, 0.1), surf('metal', 0x3a3a3a));
  post.position.set(0, VEHICLE_SEAT_Y - 0.24, -0.08);
  g.add(seat, back, post);
}

function steering(g, z) {
  const dark = mat(0x1c1c1c, { roughness: 0.5 });
  const column = mesh(cyl(0.025, 0.03, 0.5, 10), dark);
  column.position.set(0, 1.22, z + 0.08);
  column.rotation.x = -0.75;
  const wheel = mesh(geo('steer2', () => new THREE.TorusGeometry(0.19, 0.018, 8, 28)), dark);
  wheel.position.set(0, 1.4, z - 0.04);
  wheel.rotation.x = -Math.PI / 2 + 0.75;
  const spoke = mesh(uvBox(0.36, 0.02, 0.02), dark);
  spoke.position.copy(wheel.position);
  spoke.rotation.x = wheel.rotation.x + Math.PI / 2;
  g.add(column, wheel, spoke);
}

/** 운전석 보호 프레임 (ROPS) */
function rollBar(g, z, color) {
  const m = surf('paint', color);
  for (const sx of [-1, 1]) {
    const p = mesh(cyl(0.035, 0.035, 1.5, 10), m);
    p.position.set(sx * 0.48, 1.55, z);
    g.add(p);
  }
  const top = mesh(cyl(0.035, 0.035, 0.96, 10), m);
  top.rotation.z = Math.PI / 2;
  top.position.set(0, 2.3, z);
  g.add(top);
}

function makeTractor() {
  const g = new THREE.Group();
  const v = { root: g, wheels: [], spinners: [], kind: 'tractor' };
  const paint = surf('paint', 0xdc4a2c);
  const dark = surf('metal', 0x2a2a2a, { roughness: 0.6, metalness: 0.4 });
  const steel = surf('metal', 0x9aa0a6);

  // 프레임 + 엔진 보닛
  const frame = mesh(uvBox(0.56, 0.32, 2.3), dark);
  frame.position.set(0, 0.55, 0.65);
  const hood = mesh(rbox(0.74, 0.62, 1.3, 0.06), paint);
  hood.position.set(0, 1.0, 1.22);
  const hoodTop = mesh(rbox(0.7, 0.05, 1.25, 0.02), paint);
  hoodTop.position.set(0, 1.33, 1.22);
  g.add(frame, hood, hoodTop);
  // 앞 그릴 + 전조등
  const grill = mesh(uvBox(0.6, 0.5, 0.04), dark);
  grill.position.set(0, 0.98, 1.88);
  g.add(grill);
  for (let i = 0; i < 5; i++) {
    const slat = mesh(uvBox(0.56, 0.025, 0.03), steel, false);
    slat.position.set(0, 0.8 + i * 0.09, 1.9);
    g.add(slat);
  }
  for (const sx of [-1, 1]) {
    const lamp = mesh(cyl(0.065, 0.065, 0.06, 16), mat(0xe8e4d8, { roughness: 0.1, metalness: 0.2 }));
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(sx * 0.27, 1.2, 1.88);
    const bezel = mesh(geo('bezel', () => new THREE.TorusGeometry(0.068, 0.012, 6, 18)), steel);
    bezel.position.set(sx * 0.27, 1.2, 1.91);
    // 엔진 측면 통풍구
    const vent = mesh(uvBox(0.02, 0.22, 0.5), dark, false);
    vent.position.set(sx * 0.375, 1.02, 1.3);
    g.add(lamp, bezel, vent);
  }
  // 배기관
  const pipe = mesh(cyl(0.04, 0.045, 0.75, 12), surf('metal', 0x3a3a3a));
  pipe.position.set(0.24, 1.66, 1.45);
  const pipeCap = mesh(cyl(0.05, 0.045, 0.08, 12), surf('metal', 0x3a3a3a));
  pipeCap.position.set(0.24, 2.06, 1.45);
  g.add(pipe, pipeCap);

  // 계기판 + 핸들
  const dash = mesh(rbox(0.6, 0.5, 0.24, 0.04), paint);
  dash.position.set(0, 1.12, 0.56);
  const panel = mesh(uvBox(0.4, 0.14, 0.02), mat(0x111111, { roughness: 0.3 }), false);
  panel.position.set(0, 1.3, 0.43);
  panel.rotation.x = -0.5;
  g.add(dash, panel);
  steering(g, 0.42);
  seatAndBack(g);

  // 발판
  for (const sx of [-1, 1]) {
    const step = mesh(uvBox(0.36, 0.035, 0.7), surf('metal', 0x3a3a3a, { roughness: 0.7 }));
    step.position.set(sx * 0.4, 0.48, 0.2);
    g.add(step);
  }

  // 큰 뒷바퀴 + 흙받기, 작은 앞바퀴
  const rimM = surf('paint', 0xc9b98a);
  for (const sx of [-1, 1]) {
    addWheel(v, g, 0.62, 0.34, rimM, sx * 0.76, 0.62, -0.12);
    // 바퀴 윗부분을 덮는 둥근 흙받기 (원통 일부: z축 90° 회전 후 θ=π/2 가 위쪽)
    const fender = mesh(geo('fender3', () => new THREE.CylinderGeometry(0.7, 0.7, 0.44, 24, 1, true, Math.PI * 0.1, Math.PI * 0.8)), new THREE.MeshStandardMaterial({ color: 0xdc4a2c, roughness: 0.4, metalness: 0.25, side: THREE.DoubleSide }));
    fender.rotation.z = Math.PI / 2;
    fender.position.set(sx * 0.76, 0.62, -0.12);
    const deck = mesh(uvBox(0.36, 0.035, 0.66), paint);
    deck.position.set(sx * 0.62, 1.0, -0.12);
    g.add(fender, deck);
    addWheel(v, g, 0.36, 0.2, rimM, sx * 0.62, 0.36, 1.58);
  }
  const axle = mesh(cyl(0.05, 0.05, 1.3, 10), dark);
  axle.rotation.z = Math.PI / 2;
  axle.position.set(0, 0.36, 1.58);
  g.add(axle);

  rollBar(g, -0.55, 0x2a2a2a);

  // 뒤 3점 링크 + 로터리 경운기 (칼날이 돈다)
  for (const sx of [-1, 1]) {
    const link = mesh(uvBox(0.06, 0.06, 0.7), dark);
    link.position.set(sx * 0.3, 0.55, -0.85);
    link.rotation.x = 0.35;
    g.add(link);
  }
  const cover = mesh(geo('tillCover2', () => new THREE.CylinderGeometry(0.32, 0.32, 1.5, 20, 1, true, 0, Math.PI)), new THREE.MeshStandardMaterial({ color: 0xdc4a2c, roughness: 0.4, metalness: 0.25, side: THREE.DoubleSide }));
  cover.rotation.z = Math.PI / 2;
  cover.position.set(0, 0.34, -1.3);
  const gearbox = mesh(uvBox(0.22, 0.3, 0.3), dark);
  gearbox.position.set(0, 0.68, -1.25);
  g.add(cover, gearbox);
  const rotor = new THREE.Group();
  rotor.position.set(0, 0.3, -1.3);
  const shaft = mesh(cyl(0.035, 0.035, 1.42, 10), steel);
  shaft.rotation.z = Math.PI / 2;
  rotor.add(shaft);
  for (let i = 0; i < 8; i++) {
    for (let k = 0; k < 3; k++) {
      const blade = mesh(uvBox(0.015, 0.2, 0.05), steel);
      const a = (k / 3) * Math.PI * 2 + i * 0.8;
      blade.position.set(-0.63 + i * 0.18, Math.cos(a) * 0.14, Math.sin(a) * 0.14);
      blade.rotation.x = -a;
      rotor.add(blade);
    }
  }
  g.add(rotor);
  v.spinners.push(rotor);
  return v;
}

function makeSeeder() {
  const g = new THREE.Group();
  const v = { root: g, wheels: [], spinners: [], kind: 'seeder' };
  const paint = surf('paint', 0x46a058);
  const dark = surf('metal', 0x2a2a2a, { roughness: 0.6, metalness: 0.4 });
  const steel = surf('metal', 0x9aa0a6);
  const galv = surf('metal', 0xb8bcc0, { roughness: 0.5 });

  // 앞쪽 엔진 커버 + 프레임
  const frame = mesh(uvBox(0.6, 0.3, 2.4), dark);
  frame.position.set(0, 0.55, -0.1);
  const hood = mesh(rbox(0.72, 0.5, 0.9, 0.06), paint);
  hood.position.set(0, 0.92, 0.95);
  const grill = mesh(uvBox(0.56, 0.36, 0.03), dark);
  grill.position.set(0, 0.92, 1.41);
  g.add(frame, hood, grill);
  for (const sx of [-1, 1]) {
    const lamp = mesh(cyl(0.05, 0.05, 0.05, 14), mat(0xe8e4d8, { roughness: 0.1, metalness: 0.2 }));
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(sx * 0.24, 1.08, 1.41);
    g.add(lamp);
  }
  const dash = mesh(rbox(0.56, 0.44, 0.2, 0.04), paint);
  dash.position.set(0, 1.1, 0.5);
  g.add(dash);
  steering(g, 0.4);
  seatAndBack(g);
  for (const sx of [-1, 1]) {
    const step = mesh(uvBox(0.34, 0.035, 0.7), surf('metal', 0x3a3a3a, { roughness: 0.7 }));
    step.position.set(sx * 0.42, 0.48, 0.15);
    g.add(step);
  }

  const rimM = surf('paint', 0xc9c4b4);
  for (const sx of [-1, 1]) {
    addWheel(v, g, 0.34, 0.2, rimM, sx * 0.56, 0.34, 0.9);
    addWheel(v, g, 0.46, 0.26, rimM, sx * 0.64, 0.46, -0.4);
    const fender = mesh(uvBox(0.3, 0.035, 0.7), paint);
    fender.position.set(sx * 0.64, 0.98, -0.4);
    g.add(fender);
  }
  rollBar(g, -0.5, 0x2a2a2a);

  // 운전석 뒤 씨앗 통 (아연 도금 강판 깔때기)
  const HZ = -0.95;
  const hopper = mesh(geo('hopper', () => new THREE.CylinderGeometry(0.58, 0.26, 0.62, 4, 1)), galv);
  hopper.rotation.y = Math.PI / 4;
  hopper.position.set(0, 1.32, HZ);
  const lid = mesh(uvBox(0.86, 0.04, 0.86), paint);
  lid.position.set(0, 1.65, HZ);
  const stand = mesh(uvBox(0.5, 0.5, 0.4), dark);
  stand.position.set(0, 0.8, HZ);
  g.add(hopper, lid, stand);

  // 씨앗 통 아래 파종 바: 씨앗 관 4개 + 도는 원판
  const PZ = -1.32;
  const beam = mesh(uvBox(1.5, 0.1, 0.1), steel);
  beam.position.set(0, 0.5, PZ);
  g.add(beam);
  const discs = new THREE.Group();
  discs.position.set(0, 0.17, PZ - 0.05);
  for (let i = 0; i < 4; i++) {
    const x = -0.54 + i * 0.36;
    const tube = mesh(cyl(0.022, 0.022, 0.75, 8), mat(0x1c1c1c, { roughness: 0.6 }));
    tube.position.set(x * 0.6, 0.85, (HZ + PZ) / 2);
    tube.rotation.set(0.45, 0, -x * 0.5);
    const shank = mesh(uvBox(0.04, 0.32, 0.06), dark);
    shank.position.set(x, 0.33, PZ - 0.05);
    g.add(tube, shank);
    for (const s of [-1, 1]) {
      const disc = mesh(cyl(0.15, 0.15, 0.012, 22), steel);
      disc.rotation.z = Math.PI / 2 + s * 0.08;
      disc.position.x = x + s * 0.025;
      discs.add(disc);
    }
  }
  g.add(discs);
  v.spinners.push(discs);
  return v;
}

/** 탈것 모델: { root, wheels: [{ pivot, r }], spinners: [Group], kind } */
export function makeVehicle(kind) {
  return kind === 'seeder' ? makeSeeder() : makeTractor();
}

// ═════════════════════════════════════════════════════════════
//  작물 (잎맥 텍스처를 입힌 휘어진 잎 + 열매)
// ═════════════════════════════════════════════════════════════

/** 잎 한 장: 밑동(0,0)에서 +y로 자라고, 끝으로 갈수록 뒤로(+z) 휘며 가운데가 오목함 */
function leafGeo(len, wid, bend) {
  return geo(`leaf${len}|${wid}|${bend}`, () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(wid * 0.6, len * 0.15, wid * 0.55, len * 0.7, 0, len);
    s.bezierCurveTo(-wid * 0.55, len * 0.7, -wid * 0.6, len * 0.15, 0, 0);
    const g = new THREE.ShapeGeometry(s, 8);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      const t = y / len;
      p.setZ(i, bend * t * t * len + Math.abs(x) / wid * wid * 0.25);
      uv.setXY(i, x / wid + 0.5, t);
    }
    g.computeVertexNormals();
    // 잎을 눕히면(tilt) 앞면 노멀이 아래를 향하므로 뒤집어서 하늘 쪽을 보게 한다
    const n = g.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
    return g;
  });
}

const cropLeafMats = {};
function cropLeafMat(rgb) {
  const k = rgb.join(',');
  if (!cropLeafMats[k]) cropLeafMats[k] = foliage(new THREE.MeshStandardMaterial({ map: TX.leafTex(rgb), side: THREE.DoubleSide, roughness: 0.65 }));
  return cropLeafMats[k];
}

const GREEN = [96, 160, 60];
const LIGHT_GREEN = [150, 200, 92];
const DARK_GREEN = [72, 132, 54];

/** 잎을 하나 붙인다: yaw(둘레 방향), tilt(세운 각도 0 → 눕힘 1.5), y(높이) */
function addLeaf(parent, { len, wid, bend = 0.3, color = GREEN, yaw = 0, tilt = 0.8, y = 0, r = 0 }) {
  const holder = new THREE.Group();
  holder.rotation.y = yaw;
  holder.position.y = y;
  const leaf = mesh(leafGeo(len, wid, bend), cropLeafMat(color));
  leaf.rotation.x = tilt;
  leaf.position.z = r;
  holder.add(leaf);
  parent.add(holder);
  return holder;
}

function rosette(parent, n, opts) {
  for (let i = 0; i < n; i++) {
    addLeaf(parent, { ...opts, yaw: (i / n) * Math.PI * 2 + Math.random() * 0.4, tilt: opts.tilt + (Math.random() - 0.5) * 0.2, len: opts.len * (0.85 + Math.random() * 0.3) });
  }
}

function stem(parent, h, r = 0.012, color = 0x4f7a34) {
  const s = mesh(cyl(r * 0.7, r, h, 6), mat(color, { roughness: 0.7 }));
  s.position.y = h / 2;
  parent.add(s);
  return s;
}

function sprout(scale = 1) {
  const g = new THREE.Group();
  stem(g, 0.09, 0.01);
  addLeaf(g, { len: 0.07, wid: 0.06, bend: 0.2, color: LIGHT_GREEN, yaw: 0, tilt: 1.2, y: 0.085 });
  addLeaf(g, { len: 0.07, wid: 0.06, bend: 0.2, color: LIGHT_GREEN, yaw: Math.PI, tilt: 1.2, y: 0.085 });
  addLeaf(g, { len: 0.05, wid: 0.03, bend: 0.1, color: GREEN, yaw: Math.PI / 2, tilt: 0.3, y: 0.09 });
  g.scale.setScalar(scale);
  return g;
}

function growing(cropId) {
  const g = new THREE.Group();
  if (cropId === 'corn') {
    stem(g, 0.55, 0.025);
    for (let i = 0; i < 6; i++) addLeaf(g, { len: 0.4, wid: 0.06, bend: 0.5, yaw: i * 2.4, tilt: 0.7, y: 0.08 + i * 0.08 });
  } else if (cropId === 'tomato') {
    stem(g, 0.42, 0.014);
    for (let i = 0; i < 8; i++) addLeaf(g, { len: 0.14, wid: 0.09, bend: 0.3, color: DARK_GREEN, yaw: i * 2.2, tilt: 1.0, y: 0.08 + i * 0.045 });
  } else if (cropId === 'carrot') {
    rosette(g, 8, { len: 0.22, wid: 0.04, bend: 0.3, tilt: 0.45 });
  } else if (cropId === 'pumpkin' || cropId === 'watermelon') {
    rosette(g, 5, { len: 0.2, wid: 0.18, bend: 0.4, tilt: 1.2, color: DARK_GREEN });
  } else {
    rosette(g, 7, { len: 0.2, wid: 0.12, bend: 0.4, tilt: 0.9 });
  }
  return g;
}

const fruitMat = (color, rough = 0.4) => mat(color, { roughness: rough });

function ripe(cropId) {
  const g = new THREE.Group();
  switch (cropId) {
    case 'lettuce': {
      rosette(g, 11, { len: 0.3, wid: 0.26, bend: 0.6, tilt: 1.15, color: [90, 140, 52] });
      rosette(g, 8, { len: 0.25, wid: 0.22, bend: 0.5, tilt: 0.7, color: [112, 160, 64], y: 0.01 });
      rosette(g, 5, { len: 0.17, wid: 0.16, bend: 0.4, tilt: 0.25, color: [150, 188, 92], y: 0.02 });
      break;
    }
    case 'radish': {
      const root = mesh(cyl(0.07, 0.055, 0.1, 18), fruitMat(0xece6d8, 0.5));
      root.position.y = 0.02;
      const shoulder = mesh(cyl(0.062, 0.07, 0.05, 18), fruitMat(0xb4c48a, 0.5));
      shoulder.position.y = 0.09;
      g.add(root, shoulder);
      rosette(g, 8, { len: 0.36, wid: 0.12, bend: 0.5, tilt: 0.55, y: 0.11 });
      break;
    }
    case 'potato': {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const branch = new THREE.Group();
        branch.rotation.set(0.5, a, 0);
        stem(branch, 0.3, 0.012);
        for (let k = 0; k < 3; k++) addLeaf(branch, { len: 0.13, wid: 0.08, bend: 0.3, color: DARK_GREEN, yaw: k * 2.1, tilt: 1.1, y: 0.12 + k * 0.08 });
        g.add(branch);
      }
      for (const [x, z] of [[0.2, 0.18], [-0.22, 0.14], [0.05, -0.24]]) {
        const p = mesh(sphere(0.06, 14, 10), fruitMat(0xa07a4e, 0.9));
        p.scale.set(1.25, 0.85, 1);
        p.position.set(x, 0.01, z);
        g.add(p);
      }
      for (let i = 0; i < 4; i++) {
        const f = mesh(sphere(0.015, 6, 5), mat(0xf2eee6));
        f.position.set(Math.cos(i * 1.6) * 0.15, 0.32, Math.sin(i * 1.6) * 0.15);
        g.add(f);
      }
      break;
    }
    case 'carrot': {
      const top = mesh(cyl(0.04, 0.03, 0.06, 14), fruitMat(0xd2641c, 0.6));
      top.position.y = 0.01;
      g.add(top);
      rosette(g, 12, { len: 0.36, wid: 0.045, bend: 0.4, tilt: 0.35, y: 0.03 });
      break;
    }
    case 'tomato': {
      const stake = mesh(cyl(0.012, 0.014, 1.25, 6), surf('wood', 0x8a6a48));
      stake.position.set(0.06, 0.62, 0);
      g.add(stake);
      stem(g, 1.05, 0.016);
      for (let i = 0; i < 14; i++) addLeaf(g, { len: 0.16, wid: 0.1, bend: 0.35, color: DARK_GREEN, yaw: i * 2.3, tilt: 1.05, y: 0.12 + i * 0.065 });
      for (const [x, y, z] of [[0.12, 0.42, 0.08], [-0.1, 0.55, 0.1], [0.06, 0.32, -0.12], [0.14, 0.75, -0.04], [-0.12, 0.85, 0.02], [0.02, 0.62, 0.15]]) {
        const t = mesh(sphere(0.06, 18, 12), fruitMat(0xbf2a1a, 0.32));
        t.scale.y = 0.85;
        t.position.set(x, y, z);
        const calyx = mesh(cone(0.025, 0.02, 5), mat(0x3f6a2a));
        calyx.position.set(x, y + 0.05, z);
        g.add(t, calyx);
      }
      break;
    }
    case 'corn': {
      stem(g, 1.75, 0.032, 0x6a8a3a);
      for (let i = 0; i < 9; i++) addLeaf(g, { len: 0.7, wid: 0.075, bend: 0.65, color: [86, 124, 48], yaw: i * Math.PI + (i % 3) * 0.3, tilt: 0.75, y: 0.15 + i * 0.16 });
      const tassel = new THREE.Group();
      tassel.position.y = 1.75;
      for (let i = 0; i < 6; i++) {
        const t = mesh(cyl(0.004, 0.006, 0.22, 4), mat(0xb89a5a));
        t.rotation.set(0.5, i, 0);
        t.position.y = 0.08;
        tassel.add(t);
      }
      g.add(tassel);
      for (const [y, a] of [[0.85, 0], [1.05, Math.PI]]) {
        const ear = new THREE.Group();
        ear.position.y = y;
        ear.rotation.set(0, a, 0.4);
        const husk = mesh(capsule(0.045, 0.2), fruitMat(0x9aac5a, 0.7));
        husk.position.set(0.06, 0.12, 0);
        const kernels = mesh(capsule(0.038, 0.12), fruitMat(0xe2b83a, 0.45));
        kernels.position.set(0.075, 0.2, 0.02);
        ear.add(husk, kernels);
        g.add(ear);
      }
      break;
    }
    case 'strawberry': {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const petiole = new THREE.Group();
        petiole.rotation.set(0.7, a, 0);
        stem(petiole, 0.16, 0.007);
        for (let k = 0; k < 3; k++) addLeaf(petiole, { len: 0.11, wid: 0.1, bend: 0.25, color: DARK_GREEN, yaw: (k - 1) * 1.1, tilt: 1.2, y: 0.16 });
        g.add(petiole);
      }
      const berryGeo = geo('berry', () => new THREE.LatheGeometry([[0, -0.05], [0.02, -0.04], [0.035, -0.015], [0.038, 0.01], [0.03, 0.025], [0, 0.03]].map(([x, y]) => new THREE.Vector2(x, y)), 14));
      for (const [x, z] of [[0.18, 0.12], [-0.17, 0.15], [0.05, 0.22], [0.2, -0.1], [-0.12, -0.17]]) {
        const b = mesh(berryGeo, fruitMat(0xb81428, 0.35));
        b.position.set(x, 0.035, z);
        b.rotation.z = 0.4;
        const calyx = mesh(cone(0.03, 0.012, 6), mat(0x4a7a30));
        calyx.position.set(x, 0.065, z);
        g.add(b, calyx);
      }
      break;
    }
    case 'pumpkin': {
      rosette(g, 6, { len: 0.38, wid: 0.36, bend: 0.5, tilt: 1.1, color: DARK_GREEN, y: 0.03 });
      const pg = geo('pumpkin2', () => {
        const s = new THREE.SphereGeometry(0.34, 40, 24);
        const p = s.attributes.position;
        const v = new THREE.Vector3();
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i);
          const ang = Math.atan2(v.z, v.x);
          v.x *= 1 - 0.07 * Math.abs(Math.sin(ang * 5)) ** 0.6;
          v.z *= 1 - 0.07 * Math.abs(Math.sin(ang * 5)) ** 0.6;
          p.setXYZ(i, v.x, v.y, v.z);
        }
        s.computeVertexNormals();
        return s;
      });
      const p = mesh(pg, fruitMat(0xc8641c, 0.55));
      p.scale.y = 0.7;
      p.position.set(0.1, 0.22, 0.08);
      const st = mesh(cyl(0.025, 0.04, 0.12, 8), mat(0x5a5a2a, { roughness: 0.8 }));
      st.position.set(0.1, 0.48, 0.08);
      st.rotation.z = 0.3;
      g.add(p, st);
      break;
    }
    case 'watermelon': {
      rosette(g, 6, { len: 0.34, wid: 0.32, bend: 0.5, tilt: 1.1, color: DARK_GREEN, y: 0.03 });
      const w = mesh(sphere(0.33, 32, 20), new THREE.MeshStandardMaterial({ map: TX.melonTex(), roughness: 0.35 }));
      w.scale.set(1, 0.82, 1.22);
      w.position.set(-0.05, 0.25, 0.05);
      g.add(w);
      break;
    }
    default:
      g.add(mesh(sphere(0.2), fruitMat(CROPS[cropId]?.color ?? 0x88aa44)));
  }
  return g;
}

/** stage: 0 씨앗, 1 새싹, 2 성장, 3 다 자람 */
export function makeCropModel(cropId, stage) {
  if (stage === 0) {
    // 씨앗을 묻고 덮은 작은 흙더미
    const g = new THREE.Group();
    const mound = mesh(sphere(0.16, 16, 8), mat(0x4a3424, { roughness: 1 }), false, true);
    mound.scale.set(1.3, 0.22, 1.3);
    g.add(mound);
    return g;
  }
  if (stage === 1) return sprout(1.6);
  if (stage === 2) return growing(cropId);
  return ripe(cropId);
}
