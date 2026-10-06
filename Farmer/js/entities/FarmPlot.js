import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { G } from '../core/Game.js';
import { CROPS } from '../data/crops.js';
import { makeCropModel } from '../world/Models.js';
import { soilTex } from '../world/Textures.js';

const SOIL_GEO = new RoundedBoxGeometry(1.5, 0.14, 1.5, 2, 0.04);
// 굳은 땅 / 고랑을 낸 마른 흙 / 물 먹은 흙
const soilMat = (kind, roughness) => {
  const t = soilTex(kind);
  return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(1.2, 1.2), roughness });
};
const MATS = {
  empty: soilMat('untilled', 0.98),
  dry: soilMat('tilled', 0.97),
  wet: soilMat('wet', 0.62),
};

export class FarmPlot {
  constructor(index, r, c, x, z, scene) {
    this.index = index;
    this.r = r;
    this.c = c;
    this.x = x;
    this.z = z;
    this.soil = new THREE.Mesh(SOIL_GEO, MATS.empty);
    this.soil.position.set(x, 0.05, z);
    this.soil.receiveShadow = true;
    this.soil.userData = { type: 'plot', index };
    this.cropGroup = new THREE.Group();
    this.cropGroup.position.set(x, 0.12, z);
    this.cropGroup.userData = { type: 'plot', index };
    this.phase = Math.random() * 10;
    this.key = '';
    scene.add(this.soil, this.cropGroup);
  }

  get data() {
    return G.state.farm.plots[this.index];
  }

  get active() {
    const size = G.state.farm.size;
    return this.r < size && this.c < size;
  }

  stage() {
    const d = this.data;
    if (d.state !== 'planted') return -1;
    const days = CROPS[d.cropId].days;
    if (d.daysGrown >= days) return 3;
    if (d.daysGrown === 0) return 0;
    return d.daysGrown / days < 0.5 ? 1 : 2;
  }

  isReady() {
    return this.stage() === 3;
  }

  refresh() {
    const active = this.active;
    this.soil.visible = active;
    this.cropGroup.visible = active;
    if (!active) return;
    const d = this.data;
    this.soil.material = d.state === 'empty' ? MATS.empty : d.watered ? MATS.wet : MATS.dry;
    const stage = this.stage();
    const key = stage < 0 ? '' : `${d.cropId}:${stage}`;
    if (key !== this.key) {
      this.key = key;
      while (this.cropGroup.children.length) this.cropGroup.remove(this.cropGroup.children[0]);
      if (stage >= 0) {
        const m = makeCropModel(d.cropId, stage);
        m.rotation.y = this.phase;
        m.traverse((o) => { if (o.isMesh) o.userData = { type: 'plot', index: this.index }; });
        this.cropGroup.add(m);
      }
    }
  }

  animate(t) {
    if (!this.cropGroup.children.length) return;
    this.cropGroup.rotation.z = Math.sin(t * 1.6 + this.phase) * 0.04;
    this.cropGroup.rotation.x = Math.cos(t * 1.3 + this.phase) * 0.03;
  }
}
