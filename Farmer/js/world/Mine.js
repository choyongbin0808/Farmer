import * as THREE from 'three';
import { MINE_ORIGIN, MINE_HALF, NODE_SPOTS } from '../data/mining.js';
import { interactables, colliders, setZoneBounds } from './World.js';
import { setWeatherIndoor } from './Weather.js';
import {
  makeCaveShell, makeMineExit, makeMineLamp, makeSupportBeam, makePickStall, makeMinecart, makeOreNode, setOreNode,
} from './ExtraModels.js';
import { makeRock } from './Models.js';

// 광산 내부 — 마을과 멀리 떨어진 곳(MINE_ORIGIN)에 따로 지어 두고, 들어가면 플레이어를 그쪽으로 옮긴다.
// 카메라는 늘 위에서 비스듬히 내려다보므로 지평선(마을)은 화면에 들어오지 않는다.

const OX = MINE_ORIGIN.x, OZ = MINE_ORIGIN.z;
const W = MINE_HALF.x * 2 + 2, D = MINE_HALF.zMax - MINE_HALF.zMin + 2;

// 출구는 서쪽 벽에 둔다 (남쪽에 두면 카메라와 플레이어 사이를 가린다)
const EXIT_Z = 7.5;
/** 광산 안에서 들어왔을 때 서는 자리 · 출구 (월드 좌표) */
export const MINE_SPAWN = { x: OX - MINE_HALF.x + 2.2, z: OZ + EXIT_Z };
export const MINE_EXIT = { x: OX - MINE_HALF.x - 0.3, z: OZ + EXIT_Z };
const MINE_BOUNDS = { minX: OX - MINE_HALF.x, maxX: OX + MINE_HALF.x, minZ: OZ + MINE_HALF.zMin, maxZ: OZ + MINE_HALF.zMax };

/** 광맥 모델 (NODE_SPOTS 순서) */
export const mineNodes = [];
const lights = [];

function circle(x, z, r) {
  colliders.push({ x: OX + x, z: OZ + z, r });
}

export function buildMine(scene) {
  const root = new THREE.Group();
  root.position.set(OX, 0, OZ);
  scene.add(root);

  const shellZ = (MINE_HALF.zMax + MINE_HALF.zMin) / 2;
  const shell = makeCaveShell(W, D, EXIT_Z - shellZ);
  shell.position.z = shellZ;
  root.add(shell);

  const exit = makeMineExit();
  exit.position.set(-MINE_HALF.x - 0.3, 0, EXIT_Z);
  exit.rotation.y = Math.PI / 2; // 방 안(동쪽)을 본다
  exit.userData = { type: 'mineExit' };
  root.add(exit);
  interactables.push(exit);

  // 갱목 지지대 · 등불
  for (const z of [-6.5, 3.5]) {
    for (const x of [-9, 9]) {
      const b = makeSupportBeam(3.2);
      b.position.set(x, 0, z);
      root.add(b);
      circle(x - 1.6, z, 0.3);
      circle(x + 1.6, z, 0.3);
    }
  }
  for (const [x, z, ry] of [[-13.6, -6.5, 0], [13.6, -6.5, Math.PI], [-13.6, 4, 0], [13.6, 4, Math.PI], [0, -11, -Math.PI / 2]]) {
    const l = makeMineLamp();
    l.position.set(x, 0, z);
    l.rotation.y = ry;
    root.add(l);
    circle(x, z, 0.25);
  }

  // 한 반장 옆 광차 + 레일, 돌쇠의 좌판
  const cart = makeMinecart(0x2e2c2a);
  cart.position.set(-7.6, 0, 9.4);
  cart.rotation.y = Math.PI / 2;
  root.add(cart);
  circle(-7.6, 9.4, 0.9);
  const stall = makePickStall();
  stall.position.set(5, 0, 4.2);
  root.add(stall);
  colliders.push({ minX: OX + 3.7, maxX: OX + 6.3, minZ: OZ + 3.6, maxZ: OZ + 4.8 });
  // 상자 · 잔돌
  for (const [x, z] of [[12.5, 8.8], [13, 7.2], [11.6, 9.6]]) {
    const r = makeRock(0.6 + Math.random() * 0.4);
    r.position.set(x, r.position.y, z);
    root.add(r);
  }

  // 광맥
  NODE_SPOTS.forEach(([x, z], i) => {
    const n = makeOreNode();
    n.position.set(x, 0, z);
    n.rotation.y = Math.random() * Math.PI * 2;
    n.userData.type = 'ore';
    n.userData.index = i;
    root.add(n);
    interactables.push(n);
    mineNodes.push(n);
    circle(x, z, 0.75);
  });

  // 따뜻한 등불 빛 (마을에 있을 때는 꺼 둔다 — 개수가 바뀌면 셰이더를 다시 만들어야 해서 밝기만 0으로)
  for (const [x, z] of [[-8, -3], [8, -3], [0, 5]]) {
    const p = new THREE.PointLight(0xffb868, 0, 22, 1.4);
    p.position.set(x, 3.4, z);
    root.add(p);
    lights.push(p);
  }
}

/** 광맥 모양 갱신 (oreId 가 null 이면 캐낸 자리) */
export function showOreNode(i, oreId) {
  const n = mineNodes[i];
  if (!n || n.userData.ore === oreId) return;
  n.userData.ore = oreId;
  setOreNode(n, oreId);
}

/** 지금 있는 구역에 맞춰 이동 범위 · 날씨 · 광산 조명을 바꾼다 */
export function applyZone(zone) {
  const mine = zone === 'mine';
  setZoneBounds(mine ? MINE_BOUNDS : null);
  setWeatherIndoor(mine);
  for (const l of lights) l.intensity = mine ? 28 : 0;
}

/** 광맥 위치 → 월드 좌표 */
export function nodeWorldPos(i) {
  const [x, z] = NODE_SPOTS[i];
  return { x: OX + x, z: OZ + z };
}
