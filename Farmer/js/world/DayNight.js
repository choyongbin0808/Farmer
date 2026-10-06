import * as THREE from 'three';
import { SM } from './SceneManager.js';
import { WINDOW_MAT, LAMP_MAT } from './Models.js';

// [시각(시), 하늘 위 색, 지평선(안개) 색, 햇빛 세기, 하늘광 세기]
// 동물의 숲처럼 밝은 파스텔: 밤에도 푸르스름하게 잘 보이도록
const KEYS = [
  [5,    0x2a3768, 0x50608e, 0.55, 0.7],
  [6,    0x8fb4e8, 0xffd2b4, 1.0,  0.85],
  [8,    0x6fc0f2, 0xd6f0ff, 1.4,  0.85],
  [12,   0x62b8f0, 0xd2eeff, 1.5,  0.85],
  [16,   0x6fc0f2, 0xd6f0ff, 1.45, 0.85],
  [18,   0x8aa8e0, 0xffc49a, 1.25, 0.9],
  [19.5, 0x4a5490, 0xd88aa0, 0.75, 0.8],
  [21,   0x222c5c, 0x3e4c80, 0.55, 0.72],
  [26,   0x1c2552, 0x364476, 0.5,  0.7],
  [29,   0x2a3768, 0x50608e, 0.55, 0.7],
];

const topA = new THREE.Color(), topB = new THREE.Color();
const botA = new THREE.Color(), botB = new THREE.Color();
const GRAY_TOP = new THREE.Color(0x9aa8b8);
const GRAY_BOT = new THREE.Color(0xc4ccd6);
const SNOW_TOP = new THREE.Color(0xb8c8dc);
const SNOW_BOT = new THREE.Color(0xe8eef4);
const sunDir = new THREE.Vector3();

export function periodOf(minutes) {
  const h = minutes / 60;
  if (h < 12) return 'morning';
  if (h < 18) return 'day';
  return 'night';
}

export function isNight(minutes) {
  const h = minutes / 60;
  return h >= 18.7 || h < 5.5;
}

export function updateDayNight(minutes, weather, focus) {
  let h = minutes / 60;
  if (h < 5) h += 24;
  let i = 0;
  while (i < KEYS.length - 2 && h > KEYS[i + 1][0]) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = THREE.MathUtils.clamp((h - a[0]) / (b[0] - a[0]), 0, 1);

  const top = topA.setHex(a[1]).lerp(topB.setHex(b[1]), t);
  const bottom = botA.setHex(a[2]).lerp(botB.setHex(b[2]), t);
  let sunI = THREE.MathUtils.lerp(a[3], b[3], t);
  let hemiI = THREE.MathUtils.lerp(a[4], b[4], t);
  let density = 0.005;

  if (weather === 'cloudy' || weather === 'rain') {
    const rain = weather === 'rain';
    const k = rain ? 0.6 : 0.4;
    const dim = Math.min(1, sunI / 1.6 + 0.3);
    top.lerp(GRAY_TOP.clone().multiplyScalar(dim), k);
    bottom.lerp(GRAY_BOT.clone().multiplyScalar(dim), k);
    sunI *= rain ? 0.35 : 0.55;
    hemiI *= 1.1;
    density = rain ? 0.012 : 0.008;
  } else if (weather === 'snow') {
    const dim = Math.min(1, sunI / 1.6 + 0.35);
    top.lerp(SNOW_TOP.clone().multiplyScalar(dim), 0.6);
    bottom.lerp(SNOW_BOT.clone().multiplyScalar(dim), 0.6);
    sunI *= 0.55;
    hemiI *= 1.15;
    density = 0.01;
  }

  const u = SM.sky.material.uniforms;
  u.top.value.copy(top);
  u.bottom.value.copy(bottom);
  SM.scene.fog.color.copy(bottom);
  SM.scene.fog.density = density;
  SM.scene.background.copy(bottom);
  SM.hemi.intensity = hemiI;

  // 해: 06시 동쪽 → 정오에 남쪽(카메라 쪽) 높이 → 19시 서쪽. 밤에는 푸른 달빛
  const night = isNight(minutes);
  const dayT = (h - 6) / 13;
  const elev = Math.max(18, Math.sin(THREE.MathUtils.clamp(dayT, 0, 1) * Math.PI) * 60);
  const azim = (0.5 - THREE.MathUtils.clamp(dayT, 0, 1)) * Math.PI * 0.9;
  sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elev), azim);
  const fx = focus?.x ?? 0, fz = focus?.z ?? 0;
  if (night) {
    SM.sun.position.set(fx - 20, 40, fz + 25);
    SM.sun.color.setHex(0xa8bcf0);
  } else {
    SM.sun.position.set(fx + sunDir.x * 60, sunDir.y * 60, fz + sunDir.z * 60);
    const low = THREE.MathUtils.clamp(1 - (elev - 18) / 20, 0, 1) * (dayT < 0.15 || dayT > 0.85 ? 1 : 0);
    SM.sun.color.setRGB(1, 0.96 - low * 0.16, 0.9 - low * 0.28);
  }
  SM.sun.intensity = sunI;
  SM.sun.target.position.set(fx, 0, fz);

  // 반사광(하늘 환경맵)은 반 시간 단위·날씨가 바뀔 때만 다시 굽는다
  SM.updateEnvironment(`${Math.round(h * 2)}|${weather}`);

  const glow = night ? 1 : h > 18 ? (h - 18) / 0.7 : 0;
  WINDOW_MAT.emissiveIntensity = THREE.MathUtils.clamp(glow, 0, 1) * 1.2;
  LAMP_MAT.emissiveIntensity = THREE.MathUtils.clamp(glow, 0, 1) * 2;
}
