import * as THREE from 'three';
import { SM } from './SceneManager.js';
import { WINDOW_MAT, LAMP_MAT } from './Models.js';

// [시각(시), 하늘색, 태양 세기, 반구광 세기]
const KEYS = [
  [5,    0x2b3a67, 0.3, 0.5],
  [6,    0xf6c9a0, 1.2, 0.9],
  [8,    0xbfe3ff, 2.2, 1.3],
  [12,   0xa8dcff, 2.6, 1.45],
  [16,   0xbfe3ff, 2.3, 1.35],
  [18,   0xf7a76c, 1.4, 1.0],
  [19.5, 0x5b4a8a, 0.6, 0.65],
  [21,   0x1d2547, 0.35, 0.5],
  [26,   0x151b38, 0.3, 0.45],
  [29,   0x2b3a67, 0.3, 0.5],
];

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();
const GRAY = new THREE.Color(0x9aa6b2);
const SNOW_SKY = new THREE.Color(0xdfe6ee);

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

  tmpA.setHex(a[1]);
  tmpB.setHex(b[1]);
  const sky = tmpA.lerp(tmpB, t);
  let sunI = THREE.MathUtils.lerp(a[2], b[2], t);
  let hemiI = THREE.MathUtils.lerp(a[3], b[3], t);

  if (weather === 'cloudy' || weather === 'rain') {
    sky.lerp(GRAY, weather === 'rain' ? 0.55 : 0.35);
    sunI *= weather === 'rain' ? 0.45 : 0.65;
    hemiI *= 0.9;
  } else if (weather === 'snow') {
    sky.lerp(SNOW_SKY, 0.5);
    sunI *= 0.7;
  }

  SM.scene.background.copy(sky);
  SM.scene.fog.color.copy(sky);
  SM.sun.intensity = sunI;
  SM.hemi.intensity = hemiI;

  // 태양 위치: 06시 동쪽 → 12시 머리 위 → 19시 서쪽, 밤에는 달빛
  const night = isNight(minutes);
  const dayT = THREE.MathUtils.clamp((h - 6) / 13, 0, 1);
  const ang = night ? Math.PI * 0.35 : Math.PI * (0.08 + dayT * 0.84);
  const fx = focus?.x ?? 0, fz = focus?.z ?? 0;
  SM.sun.position.set(fx + Math.cos(ang) * 40, Math.sin(ang) * 45 + 8, fz + 18);
  SM.sun.target.position.set(fx, 0, fz);
  SM.sun.color.setHex(night ? 0x9fb4ff : h < 8 || h > 17 ? 0xffd2a1 : 0xfff1d6);

  const glow = night ? 1 : h > 18 ? (h - 18) / 0.7 : 0;
  WINDOW_MAT.emissiveIntensity = THREE.MathUtils.clamp(glow, 0, 1) * 0.9;
  LAMP_MAT.emissiveIntensity = THREE.MathUtils.clamp(glow, 0, 1) * 1.4;
}
