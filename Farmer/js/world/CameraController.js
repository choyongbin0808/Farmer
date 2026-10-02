import * as THREE from 'three';

export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0.82;
    this.dist = 17;
    this.target = new THREE.Vector3(-14, 0, 18);
    this.mode = 'follow'; // follow | orbit
    this.orbitCenter = new THREE.Vector3();
    this.orbitDist = 30;
    this.orbitSpeed = 0.08;
  }

  rotate(dx) {
    this.yaw -= dx * 0.006;
  }

  zoom(dir) {
    this.dist = THREE.MathUtils.clamp(this.dist + dir * 1.5, 8, 25);
  }

  setOrbit(center, dist, speed = 0.08) {
    this.mode = 'orbit';
    this.orbitCenter.copy(center);
    this.orbitDist = dist;
    this.orbitSpeed = speed;
  }

  setFollow() {
    this.mode = 'follow';
  }

  update(dt, followPos) {
    let dist = this.dist;
    if (this.mode === 'orbit') {
      this.yaw += dt * this.orbitSpeed;
      this.target.lerp(this.orbitCenter, 1 - Math.exp(-3 * dt));
      dist = this.orbitDist;
    } else if (followPos) {
      this.target.lerp(followPos, 1 - Math.exp(-7 * dt));
    }
    const h = Math.cos(this.pitch) * dist;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * h,
      this.target.y + Math.sin(this.pitch) * dist,
      this.target.z + Math.cos(this.yaw) * h,
    );
    this.camera.lookAt(this.target.x, this.target.y + 1, this.target.z);
  }

  // 카메라 기준 앞(W)/오른쪽(D) 방향의 지면 벡터
  basis() {
    return {
      fx: -Math.sin(this.yaw), fz: -Math.cos(this.yaw),
      rx: Math.cos(this.yaw), rz: -Math.sin(this.yaw),
    };
  }
}
