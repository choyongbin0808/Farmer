import * as THREE from 'three';
import {
  MINE_ORIGIN, MINE_HALF, MINE_FLOORS, FLOOR_GAP, FLOOR_LAYOUT, ENTRANCE_PROPS, BEAMS, BEAM_HALF, LAMPS, MAX_ORES,
} from '../data/mining.js';
import { interactables, colliders, mineColliders, setZoneBounds } from './World.js';
import { setWeatherIndoor } from './Weather.js';
import {
  makeCaveShell, makeMineExit, makeMineLamp, makeSupportBeam, makePickStall, makeMinecart, makeOreNode, setOreNode,
  makeLadderDown, makeLadderUp,
} from './ExtraModels.js';
import { makeRock } from './Models.js';

// 광산 내부 — 마을과 멀리 떨어진 곳에 층마다 방을 하나씩 지어 두고(FLOOR_GAP 간격),
// 들어가거나 사다리를 타면 플레이어를 그 층으로 옮긴다.
// 카메라는 늘 위에서 비스듬히 내려다보므로 지평선(마을·다른 층)은 화면에 들어오지 않는다.

const OX = MINE_ORIGIN.x;
const W = MINE_HALF.x * 2 + 2, D = MINE_HALF.zMax - MINE_HALF.zMin + 2;

/** 층 원점 (월드 좌표) */
function originOf(f) {
  return { x: OX, z: MINE_ORIGIN.z + f * FLOOR_GAP };
}
const toWorld = (f, [x, z]) => {
  const o = originOf(f);
  return { x: o.x + x, z: o.z + z };
};

const EXIT = FLOOR_LAYOUT[0].exit;
/** 1층: 들어왔을 때 서는 자리 · 출구 (월드 좌표) */
export const MINE_SPAWN = toWorld(0, [EXIT[0] + 2.4, EXIT[1]]);
export const MINE_EXIT = toWorld(0, EXIT);

/** 층마다 이동 범위 */
export function floorBounds(f) {
  const o = originOf(f);
  return { minX: o.x - MINE_HALF.x, maxX: o.x + MINE_HALF.x, minZ: o.z + MINE_HALF.zMin, maxZ: o.z + MINE_HALF.zMax };
}

/** 사다리 위치 (월드) — dir: 'up' | 'down', 없으면 null */
export function ladderPos(f, dir) {
  const p = FLOOR_LAYOUT[f]?.[dir];
  return p ? toWorld(f, p) : null;
}

/** 층을 옮겨 왔을 때 서는 자리: 내려왔으면 그 층의 '올라가는 사다리' 옆, 올라왔으면 '내려가는 사다리' 옆 */
export function arrivalPos(f, cameFrom) {
  if (cameFrom === 'above') {
    const [x, z] = FLOOR_LAYOUT[f].up;
    return toWorld(f, [x + 2.4, z]);
  }
  const [x, z] = FLOOR_LAYOUT[f].down;
  return toWorld(f, [x - 2.6, z + 1.2]);
}

/** 광맥 모델 [층][자리] */
export const mineNodes = Array.from({ length: MINE_FLOORS }, () => []);
const lights = [];
const LIGHT_SPOTS = [[-12, -4], [12, -4], [-8, 9], [10, 9]];

function buildFloor(scene, f) {
  const L = FLOOR_LAYOUT[f];
  const o = originOf(f);
  const root = new THREE.Group();
  root.position.set(o.x, 0, o.z);
  scene.add(root);
  const circle = (x, z, r) => colliders.push({ x: o.x + x, z: o.z + z, r });

  const shellZ = (MINE_HALF.zMax + MINE_HALF.zMin) / 2;
  const shell = makeCaveShell(W, D, L.exit ? L.exit[1] - shellZ : null, L.tint);
  shell.position.z = shellZ;
  root.add(shell);

  // 출구 (1층) · 사다리
  if (L.exit) {
    const exit = makeMineExit();
    exit.position.set(L.exit[0], 0, L.exit[1]);
    exit.rotation.y = Math.PI / 2; // 방 안(동쪽)을 본다
    exit.userData = { type: 'mineExit' };
    root.add(exit);
    interactables.push(exit);
  }
  if (L.down) {
    const d = makeLadderDown(`⬇ ${f + 2}층으로`);
    d.position.set(L.down[0], 0, L.down[1]);
    d.userData = { type: 'mineLadder', floor: f, dir: 'down' };
    root.add(d);
    interactables.push(d);
    circle(L.down[0], L.down[1], 1.3);
  }
  if (L.up) {
    const u = makeLadderUp(`⬆ ${f}층으로${f === 1 ? ' (입구)' : ''}`);
    u.position.set(L.up[0], 0, L.up[1]);
    u.rotation.y = Math.PI / 2; // 서쪽 벽에 기대어
    u.userData = { type: 'mineLadder', floor: f, dir: 'up' };
    root.add(u);
    interactables.push(u);
    circle(L.up[0], L.up[1], 0.6);
  }

  // 갱목 지지대 · 등불
  for (const [x, z] of BEAMS) {
    const b = makeSupportBeam(BEAM_HALF * 2);
    b.position.set(x, 0, z);
    root.add(b);
    circle(x - BEAM_HALF, z, 0.3);
    circle(x + BEAM_HALF, z, 0.3);
  }
  for (const [x, z, ry] of LAMPS) {
    const l = makeMineLamp();
    l.position.set(x, 0, z);
    l.rotation.y = ry;
    root.add(l);
    circle(x, z, 0.25);
  }

  if (f === 0) {
    // 한 반장 옆 광차, 돌쇠의 좌판
    const [cx, cz] = ENTRANCE_PROPS.cart;
    const cart = makeMinecart(0x2e2c2a);
    cart.position.set(cx, 0, cz);
    cart.rotation.y = Math.PI / 2;
    root.add(cart);
    circle(cx, cz, 0.9);
    const [sx, sz] = ENTRANCE_PROPS.stall;
    const stall = makePickStall();
    stall.position.set(sx, 0, sz);
    root.add(stall);
    colliders.push({ minX: o.x + sx - 1.3, maxX: o.x + sx + 1.3, minZ: o.z + sz - 0.6, maxZ: o.z + sz + 0.6 });
  }
  // 구석의 잔돌
  for (const [x, z] of [[19.5, 12.5], [20.5, 10.8], [-20.5, -14.5], [18.5, -15.5]]) {
    const r = makeRock(0.6 + Math.random() * 0.5);
    r.position.set(x, r.position.y, z);
    root.add(r);
  }

  // 광맥 모델 묶음 — 자리가 정해져 있지 않아, 생길 때마다 하나를 꺼내 그 자리로 옮겨 쓴다
  for (let i = 0; i < MAX_ORES; i++) {
    const n = makeOreNode();
    n.visible = false;
    n.rotation.y = Math.random() * Math.PI * 2;
    n.userData.type = 'ore';
    n.userData.floor = f;
    n.userData.oreId = null;
    root.add(n);
    mineNodes[f].push(n);
  }
}

export function buildMine(scene) {
  for (let f = 0; f < MINE_FLOORS; f++) buildFloor(scene, f);
  // 따뜻한 등불 빛 — 층마다 따로 두지 않고, 지금 있는 층으로 옮겨 쓴다
  // (마을에 있을 때는 밝기만 0 — 개수가 바뀌면 셰이더를 다시 만들어야 해서)
  for (let i = 0; i < LIGHT_SPOTS.length; i++) {
    const p = new THREE.PointLight(0xffb868, 0, 26, 1.4);
    scene.add(p);
    lights.push(p);
  }
}

const floorColliders = Array.from({ length: MINE_FLOORS }, () => []);

/**
 * 층의 광맥을 상태대로 보여 준다 — ores: [{ id, x, z, ore }] (로컬 좌표).
 * 캐낸 광맥은 목록에서 빠지므로 아무것도 남지 않는다.
 */
export function syncFloorOres(f, ores) {
  const o = originOf(f);
  const pool = mineNodes[f];
  pool.forEach((n, i) => {
    const e = ores[i];
    const wasIn = interactables.indexOf(n);
    if (!e) {
      n.visible = false;
      n.userData.oreId = null;
      if (wasIn >= 0) interactables.splice(wasIn, 1);
      return;
    }
    n.visible = true;
    n.position.set(e.x, 0, e.z);
    n.userData.oreId = e.id;
    if (n.userData.ore !== e.ore) {
      n.userData.ore = e.ore;
      setOreNode(n, e.ore);
    }
    if (wasIn < 0) interactables.push(n);
  });
  floorColliders[f] = ores.slice(0, pool.length).map((e) => ({ x: o.x + e.x, z: o.z + e.z, r: 0.75 }));
  mineColliders.length = 0;
  for (const list of floorColliders) mineColliders.push(...list);
}

/** 지금 있는 구역(과 광산 층)에 맞춰 이동 범위 · 날씨 · 광산 조명을 바꾼다 */
export function applyZone(zone, floor = 0) {
  const mine = zone === 'mine';
  setZoneBounds(mine ? floorBounds(floor) : null);
  setWeatherIndoor(mine);
  const o = originOf(floor);
  lights.forEach((l, i) => {
    l.intensity = mine ? 30 : 0;
    l.position.set(o.x + LIGHT_SPOTS[i][0], 3.6, o.z + LIGHT_SPOTS[i][1]);
  });
}

/** 광맥(로컬 좌표 { x, z }) → 월드 좌표 */
export function oreWorldPos(f, e) {
  return toWorld(f, [e.x, e.z]);
}

/** 월드 좌표 → 층 로컬 좌표 */
export function toLocal(f, pos) {
  const o = originOf(f);
  return { x: pos.x - o.x, z: pos.z - o.z };
}
