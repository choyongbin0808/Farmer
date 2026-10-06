import * as THREE from 'three';

/** 동물의 숲처럼 단순한 파스텔 그라데이션 하늘 (위 → 지평선 색) */
function makeSkyDome() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color(0x6fc0f2) },
      bottom: { value: new THREE.Color(0xd6f0ff) },
      exponent: { value: 0.7 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: `
      uniform vec3 top;
      uniform vec3 bottom;
      uniform float exponent;
      varying vec3 vDir;
      void main() {
        float h = max(normalize(vDir).y, 0.0);
        gl_FragColor = vec4(mix(bottom, top, pow(h, exponent)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), mat);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  return sky;
}

export const SM = {
  scene: null,
  renderer: null,
  camera: null,
  sun: null,
  hemi: null,
  sky: null,
  pmrem: null,
  envRT: null,
  envKey: '',

  init(canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // 색이 탁해지지 않도록 필름 톤 대신 선형 톤 매핑 (밝고 선명한 파스텔)
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd6f0ff);
    scene.fog = new THREE.FogExp2(0xd6f0ff, 0.005);
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 400);

    this.sky = makeSkyDome();
    scene.add(this.sky);

    this.hemi = new THREE.HemisphereLight(0xe2f0ff, 0xb8a888, 1.0);
    scene.add(this.hemi);

    const sun = new THREE.DirectionalLight(0xfff4e2, 1.8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    const sc = sun.shadow.camera;
    sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34;
    sc.near = 1; sc.far = 160;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.025;
    sun.shadow.radius = 6;
    scene.add(sun);
    scene.add(sun.target);
    this.sun = sun;

    this.pmrem = new THREE.PMREMGenerator(renderer);

    window.addEventListener('resize', () => this.resize());
  },

  /** 하늘을 반사광(환경맵)으로 굽는다 — 하늘색이 눈에 띄게 바뀔 때만 다시 굽는다 */
  updateEnvironment(key) {
    if (key === this.envKey) return;
    this.envKey = key;
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(this.sky.geometry, this.sky.material));
    const rt = this.pmrem.fromScene(envScene, 0, 0.1, 1000);
    this.envRT?.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
  },

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  },

  render() {
    this.renderer.render(this.scene, this.camera);
  },
};
