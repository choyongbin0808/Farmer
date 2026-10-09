import * as THREE from 'three';

/**
 * 도감 미리보기 — 고른 작물·물고기·광석의 3D 모델을 작은 캔버스에 따로 그린다.
 * 천천히 저절로 돌고, 마우스로 드래그하면 직접 돌려 볼 수 있다. (캐릭터 미리보기와 같은 방식)
 */
let renderer = null;
let scene = null;
let camera = null;
let holder = null;
let current = { key: null, obj: null };
let raf = 0;
let yaw = 0.6;
let dragging = null;
let last = 0;

function setup() {
  const canvas = document.createElement('canvas');
  canvas.className = 'book-canvas';
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.LinearToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff6e8, 0xb89870, 2.2));
  const key = new THREE.DirectionalLight(0xfff4e2, 1.7);
  key.position.set(2, 4, 5);
  scene.add(key);
  holder = new THREE.Group();
  scene.add(holder);
  camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);

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

/** 모델 크기에 맞춰 화면 가운데 오도록 카메라를 놓는다 */
function frameObject(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  obj.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
  // 돌아가도 잘리지 않도록 가로·세로 중 큰 쪽 기준으로, 살짝 내려다보게
  const r = Math.max(Math.hypot(size.x, size.z) * 0.5, size.y * 0.55);
  const dist = r / Math.tan(THREE.MathUtils.degToRad(15)) * 1.05;
  camera.position.set(0, size.y * 0.5 + dist * 0.35, dist);
  camera.lookAt(0, size.y * 0.45, 0);
}

function frame(now) {
  const canvas = renderer.domElement;
  if (!canvas.isConnected) {
    raf = 0;
    return;
  }
  const dt = Math.min(0.05, (now - (last || now)) / 1000);
  last = now;
  if (!dragging) yaw += dt * 0.6;
  holder.rotation.y = yaw;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (w && h && (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio()))) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  renderer.render(scene, camera);
  raf = requestAnimationFrame(frame);
}

export const BookPreview = {
  /** container 안에 캔버스를 넣고 make() 로 만든 모델을 보여 준다 (key 가 같으면 다시 만들지 않음) */
  mount(container, key, make) {
    if (!container) return;
    if (!renderer) setup();
    if (current.key !== key) {
      if (current.obj) holder.remove(current.obj);
      const obj = make();
      obj.traverse((m) => { if (m.isMesh) m.castShadow = false; });
      holder.add(obj);
      frameObject(obj);
      current = { key, obj };
      yaw = 0.6;
    }
    container.appendChild(renderer.domElement);
    if (!raf) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  },
};
