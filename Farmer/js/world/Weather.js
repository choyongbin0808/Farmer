import * as THREE from 'three';
import { setSnowLevel } from './World.js';

export const WEATHERS = {
  sunny:  { name: '맑음', icon: '☀️' },
  cloudy: { name: '흐림', icon: '☁️' },
  rain:   { name: '비',   icon: '🌧️' },
  snow:   { name: '눈',   icon: '❄️' },
};

export function rollWeather() {
  const r = Math.random();
  if (r < 0.6) return 'sunny';
  if (r < 0.75) return 'cloudy';
  if (r < 0.95) return 'rain';
  return 'snow';
}

const RAIN_COUNT = 1800;
const SNOW_COUNT = 1400;
const AREA = 44;
const HEIGHT = 22;

let rain, snow, rainPos, snowPos, snowDrift;
let current = 'sunny';
let snowLevel = 0;

function snowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export function initWeather(scene) {
  rainPos = new Float32Array(RAIN_COUNT * 6);
  for (let i = 0; i < RAIN_COUNT; i++) {
    const x = (Math.random() - 0.5) * AREA, y = Math.random() * HEIGHT, z = (Math.random() - 0.5) * AREA;
    rainPos.set([x, y, z, x + 0.05, y - 0.6, z], i * 6);
  }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xaecbe6, transparent: true, opacity: 0.6 }));
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);

  snowPos = new Float32Array(SNOW_COUNT * 3);
  snowDrift = new Float32Array(SNOW_COUNT);
  for (let i = 0; i < SNOW_COUNT; i++) {
    snowPos.set([(Math.random() - 0.5) * AREA, Math.random() * HEIGHT, (Math.random() - 0.5) * AREA], i * 3);
    snowDrift[i] = Math.random() * Math.PI * 2;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  snow = new THREE.Points(sg, new THREE.PointsMaterial({
    size: 0.35, map: snowTexture(), transparent: true, depthWrite: false, color: 0xffffff,
  }));
  snow.frustumCulled = false;
  snow.visible = false;
  scene.add(snow);
}

export function setWeather(w, instant = false) {
  current = w;
  rain.visible = w === 'rain';
  snow.visible = w === 'snow';
  if (instant) {
    snowLevel = w === 'snow' ? 0.55 : 0;
    setSnowLevel(snowLevel);
  }
}

export function updateWeather(dt, center, t) {
  const target = current === 'snow' ? 0.55 : 0;
  snowLevel += (target - snowLevel) * Math.min(1, dt * 0.3);
  setSnowLevel(snowLevel);

  if (rain.visible) {
    rain.position.set(center.x, 0, center.z);
    for (let i = 0; i < RAIN_COUNT; i++) {
      const o = i * 6;
      rainPos[o + 1] -= dt * 28;
      rainPos[o + 4] -= dt * 28;
      if (rainPos[o + 4] < 0) {
        const x = (Math.random() - 0.5) * AREA, z = (Math.random() - 0.5) * AREA;
        const y = HEIGHT * (0.8 + Math.random() * 0.2);
        rainPos[o] = x; rainPos[o + 1] = y; rainPos[o + 2] = z;
        rainPos[o + 3] = x + 0.05; rainPos[o + 4] = y - 0.6; rainPos[o + 5] = z;
      }
    }
    rain.geometry.attributes.position.needsUpdate = true;
  }
  if (snow.visible) {
    snow.position.set(center.x, 0, center.z);
    for (let i = 0; i < SNOW_COUNT; i++) {
      const o = i * 3;
      snowPos[o + 1] -= dt * 1.8;
      snowPos[o] += Math.sin(t + snowDrift[i]) * dt * 0.5;
      if (snowPos[o + 1] < 0) {
        snowPos[o] = (Math.random() - 0.5) * AREA;
        snowPos[o + 1] = HEIGHT;
        snowPos[o + 2] = (Math.random() - 0.5) * AREA;
      }
    }
    snow.geometry.attributes.position.needsUpdate = true;
  }
}
