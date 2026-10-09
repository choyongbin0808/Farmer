import * as THREE from 'three';

export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0.82;
    this.dist = 17;
    this.target = new THREE.Vector3(-14, 0, 18);
    this.mode = 'follow'; // follow | orbit | shot
    this.orbitCenter = new THREE.Vector3();
    this.orbitDist = 30;
    this.orbitSpeed = 0.08;
    // shot: 연출용 고정 카메라 (위치·바라보는 곳으로 부드럽게 옮겨 간다)
    this.shotPos = new THREE.Vector3();
    this.shotLook = new THREE.Vector3();
    this.lookCur = new THREE.Vector3();
    this.shotSpeed = 2;
  }

  /** 연출 카메라: pos 에서 look 을 바라본다. instant 면 바로 옮긴다 */
  setShot(pos, look, { instant = false, speed = 2 } = {}) {
    if (this.mode !== 'shot') this.lookCur.copy(this.target).add(new THREE.Vector3(0, 1, 0));
    this.mode = 'shot';
    this.shotPos.set(pos.x, pos.y, pos.z);
    this.shotLook.set(look.x, look.y, look.z);
    this.shotSpeed = speed;
    if (instant) {
      this.camera.position.copy(this.shotPos);
      this.lookCur.copy(this.shotLook);
    }
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
    if (this.mode === 'shot') {
      const k = 1 - Math.exp(-this.shotSpeed * dt);
      this.camera.position.lerp(this.shotPos, k);
      this.lookCur.lerp(this.shotLook, k);
      this.camera.lookAt(this.lookCur);
      return;
    }
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
