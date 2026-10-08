import * as THREE from 'three';
import { G } from '../core/Game.js';
import { Player } from '../entities/Player.js';

/**
 * 가방 화면의 캐릭터 미리보기 — 게임 속 플레이어와 같은 3D 모델을 작은 캔버스에 따로 그린다.
 * 가만히 서 있고, 마우스로 드래그할 때만 돌아간다.
 */
let renderer = null;
let scene = null;
let camera = null;
let model = null;
let raf = 0;
let yaw = 0.35;
let dragging = null; // { x, yaw }

function setup() {
  const canvas = document.createElement('canvas');
  canvas.className = 'char-canvas';
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.LinearToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff6e8, 0xb89870, 2.2));
  const key = new THREE.DirectionalLight(0xfff4e2, 1.6);
  key.position.set(2, 4, 5);
  scene.add(key);

  model = new Player(scene);
  model.group.traverse((m) => { if (m.isMesh) m.castShadow = false; });

  // 모델 크기에 맞춰 전신이 보이도록 카메라 배치 (모자 높이만큼 위쪽 여유)
  const box = new THREE.Box3().setFromObject(model.group);
  const h = (box.max.y - box.min.y) * 1.12;
  const cy = box.min.y + h * 0.5;
  camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  const dist = (h * 0.62) / Math.tan(THREE.MathUtils.degToRad(13));
  camera.position.set(0, cy + h * 0.08, dist);
  camera.lookAt(0, cy, 0);

  canvas.addEventListener('pointerdown', (e) => {
    dragging = { x: e.clientX, yaw };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (dragging) yaw = dragging.yaw + (e.clientX - dragging.x) * 0.012;
  });
  const end = () => { dragging = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}

function frame(now) {
  const canvas = renderer.domElement;
  if (!canvas.isConnected) {
    raf = 0;
    return;
  }
  model.group.rotation.y = yaw;

  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (w && h && (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio()))) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  renderer.render(scene, camera);
  raf = requestAnimationFrame(frame);
}

export const CharacterPreview = {
  /** container 안에 미리보기 캔버스를 넣고 현재 옷차림을 입힌다 */
  mount(container) {
    if (!container) return;
    if (!renderer) setup();
    model.applyOutfit(G.state.player.outfit);
    container.appendChild(renderer.domElement);
    if (!raf) raf = requestAnimationFrame(frame);
  },
};
