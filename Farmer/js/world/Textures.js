import * as THREE from 'three';

// ───────── 절차적(코드로 그리는) 텍스처 ─────────
// 외부 이미지 없이 캔버스에 그린다. 동물의 숲처럼 대비가 낮고 둥근 무늬의 부드러운 표면.
// 같은 키는 한 번만 만든다.

const cache = new Map();

// 결정적 난수 (텍스처가 매번 같게)
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

// 타일링되는 값 노이즈 (주기 period 격자)
function makeNoise(seed, period) {
  const r = rng(seed);
  const grid = new Float32Array(period * period);
  for (let i = 0; i < grid.length; i++) grid[i] = r();
  const at = (x, y) => grid[((y % period + period) % period) * period + ((x % period + period) % period)];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/** 타일링 fBm: (u, v) ∈ [0,1) → 0~1 */
function fbm(seed, base = 4, octaves = 3) {
  const layers = [];
  for (let o = 0; o < octaves; o++) layers.push({ n: makeNoise(seed + o * 101, base << o), f: base << o, a: 0.5 ** o });
  const norm = layers.reduce((s, l) => s + l.a, 0);
  return (u, v) => {
    let s = 0;
    for (const l of layers) s += l.n(u * l.f, v * l.f) * l.a;
    return s / norm;
  };
}

function canvas(size, h = size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = h;
  return c;
}

/** 픽셀마다 fn(u, v) → [r, g, b] 로 채움 */
function paint(c, fn) {
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(c.width, c.height);
  const d = img.data;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const [r, g, b, a = 255] = fn(x / c.width, y / c.height, x, y);
      const i = (y * c.width + x) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return ctx;
}

const mix = (a, b, t) => a + (b - a) * t;
const clamp = (v, a = 0, b = 255) => Math.max(a, Math.min(b, v));
const lerp3 = (c1, c2, t) => [mix(c1[0], c2[0], t), mix(c1[1], c2[1], t), mix(c1[2], c2[2], t)];
const rgb = ([r, g, b]) => `rgb(${r | 0},${g | 0},${b | 0})`;

function toTexture(c, { repeat = 1, color = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 밝기(높이) 캔버스에서 노멀맵을 만든다 */
function normalFrom(heightCanvas, strength = 2) {
  const w = heightCanvas.width, h = heightCanvas.height;
  const src = heightCanvas.getContext('2d').getImageData(0, 0, w, h).data;
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  const c = canvas(w, h);
  paint(c, (u, v, x, y) => {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
    const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const len = Math.hypot(dx, dy, 1);
    return [(-dx / len * 0.5 + 0.5) * 255, (-dy / len * 0.5 + 0.5) * 255, (1 / len * 0.5 + 0.5) * 255];
  });
  return c;
}

function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

/** 가장자리에서 반대편으로 이어지도록 9방향에 그린다 (타일링) */
function wrapDraw(size, x, y, draw) {
  for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) draw(x + ox, y + oy);
}

/** { map, normalMap } — heightCanvas 를 주면 그 높이로 은은한 노멀맵을 만든다 */
function pack(c, heightCanvas = null, strength = 1) {
  return { map: toTexture(c), normalMap: heightCanvas ? toTexture(normalFrom(heightCanvas, strength), { color: false }) : null };
}

// ───────── 지면 ─────────

/** 밝은 연두 잔디 + 작은 풀 무늬 */
export function grassTex() {
  return cached('grass', () => {
    const size = 512;
    const c = canvas(size);
    const n = fbm(11, 3, 2);
    const ctx = paint(c, (u, v) => {
      const k = n(u, v);
      return lerp3([112, 190, 88], [128, 200, 98], k);
    });
    const r = rng(12);
    for (let i = 0; i < 260; i++) {
      const x = r() * size, y = r() * size, s = 5 + r() * 4;
      const light = r() < 0.6;
      ctx.strokeStyle = light ? 'rgba(170,224,130,0.9)' : 'rgba(84,160,70,0.8)';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      wrapDraw(size, x, y, (px, py) => {
        ctx.beginPath();
        ctx.moveTo(px - s * 0.6, py - s * 0.5);
        ctx.lineTo(px, py + s * 0.4);
        ctx.lineTo(px + s * 0.6, py - s * 0.5);
        ctx.stroke();
      });
    }
    for (let i = 0; i < 40; i++) {
      const x = r() * size, y = r() * size;
      ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.75)' : 'rgba(255,230,120,0.8)';
      wrapDraw(size, x, y, (px, py) => { ctx.beginPath(); ctx.arc(px, py, 2.2, 0, Math.PI * 2); ctx.fill(); });
    }
    return pack(c);
  });
}

/** 모래빛 흙길 + 동글동글한 자갈 */
export function dirtPathTex() {
  return cached('path', () => {
    const size = 512;
    const c = canvas(size);
    const n = fbm(21, 4, 2);
    const ctx = paint(c, (u, v) => lerp3([226, 200, 152], [236, 212, 166], n(u, v)));
    const r = rng(23);
    for (let i = 0; i < 110; i++) {
      const x = r() * size, y = r() * size, pr = 3 + r() * 4;
      const g = lerp3([206, 180, 136], [246, 232, 204], r());
      ctx.fillStyle = rgb(g);
      wrapDraw(size, x, y, (px, py) => { ctx.beginPath(); ctx.ellipse(px, py, pr, pr * 0.75, 0, 0, Math.PI * 2); ctx.fill(); });
    }
    return pack(c);
  });
}

/** 광장: 둥근 모서리의 크림색 판석 */
export function pavingTex() {
  return cached('paving', () => {
    const size = 512;
    const c = canvas(size);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#d9cbb0';
    ctx.fillRect(0, 0, size, size);
    const r = rng(33);
    const rows = 8, h = size / rows;
    const height = canvas(size);
    const hctx = height.getContext('2d');
    hctx.fillStyle = '#000';
    hctx.fillRect(0, 0, size, size);
    for (let row = 0; row < rows; row++) {
      let x = row % 2 ? -h * 0.5 : 0;
      while (x < size) {
        const w = h * (1 + r() * 0.8);
        const tone = lerp3([238, 228, 208], [248, 240, 224], r());
        for (const [g, col] of [[ctx, rgb(tone)], [hctx, '#fff']]) {
          g.fillStyle = col;
          g.beginPath();
          g.roundRect(x + 3, row * h + 3, w - 6, h - 6, 12);
          g.fill();
          if (x + w > size) { g.beginPath(); g.roundRect(x - size + 3, row * h + 3, w - 6, h - 6, 12); g.fill(); }
        }
        x += w;
      }
    }
    return pack(c, height, 1.2);
  });
}

/** 밭 흙: kind = 'tilled'(고랑) | 'wet'(물 먹은 흙) | 'untilled'(굳은 땅) */
export function soilTex(kind) {
  return cached('soil_' + kind, () => {
    const size = 256;
    const c = canvas(size);
    const n = fbm(41, 4, 2);
    const furrows = kind !== 'untilled';
    const [a, b] = kind === 'wet' ? [[124, 84, 58], [138, 96, 66]] : kind === 'tilled' ? [[186, 132, 88], [198, 146, 100]] : [[150, 170, 96], [164, 180, 104]];
    const ctx = paint(c, (u, v) => {
      let col = lerp3(a, b, n(u, v));
      if (furrows) {
        const ridge = 0.5 + 0.5 * Math.cos(v * Math.PI * 2 * 5);
        const s = 0.82 + ridge * 0.22;
        col = [col[0] * s, col[1] * s, col[2] * s];
      }
      return col;
    });
    if (!furrows) {
      const r = rng(43);
      for (let i = 0; i < 50; i++) {
        const x = r() * size, y = r() * size;
        ctx.strokeStyle = 'rgba(120,170,80,0.8)';
        ctx.lineWidth = 2;
        wrapDraw(size, x, y, (px, py) => { ctx.beginPath(); ctx.moveTo(px - 3, py - 3); ctx.lineTo(px, py + 2); ctx.lineTo(px + 3, py - 3); ctx.stroke(); });
      }
    }
    const height = canvas(size);
    paint(height, (u, v) => { const k = (furrows ? 0.5 + 0.5 * Math.cos(v * Math.PI * 2 * 5) : 0.5) * 255; return [k, k, k]; });
    return pack(c, furrows ? height : null, 2.5);
  });
}

// ───────── 건축 재료 (밝은 회색조 — 재질 color 로 색을 입힌다) ─────────

/** 거의 매끈한 벽 */
export function plasterTex() {
  return cached('plaster', () => {
    const c = canvas(128);
    const n = fbm(51, 4, 2);
    paint(c, (u, v) => { const k = 240 + n(u, v) * 12; return [k, k, k]; });
    return pack(c);
  });
}

/** 부드러운 널빤지 (결은 은은하게, 이음매만 살짝) */
export function woodTex() {
  return cached('wood', () => {
    const size = 256;
    const c = canvas(size);
    const r = rng(63);
    const planks = 5;
    const tones = Array.from({ length: planks }, () => r());
    const grain = makeNoise(62, 8);
    paint(c, (u, v) => {
      const p = Math.floor(u * planks);
      const pu = u * planks - p;
      let k = 222 + tones[p] * 22 + Math.sin((u * 24 + grain(u * 8, v * 2) * 2) * Math.PI) * 5;
      if (pu < 0.04 || pu > 0.96) k *= 0.82;
      return [k, k * 0.97, k * 0.94];
    });
    return pack(c);
  });
}

export function barkTex() {
  return cached('bark', () => {
    const size = 128;
    const c = canvas(size);
    const n = makeNoise(71, 8);
    paint(c, (u, v) => {
      const ridge = Math.abs(Math.sin((u * 6 + n(u * 8, v * 2) * 1.2) * Math.PI));
      const k = 214 + ridge * 30;
      return [k, k * 0.95, k * 0.9];
    });
    return pack(c);
  });
}

/** 동물의 숲 지붕처럼 둥근 비늘 기와 */
export function shingleTex() {
  return cached('shingle', () => {
    const size = 256;
    const c = canvas(size);
    const ctx = c.getContext('2d');
    const height = canvas(size);
    const hctx = height.getContext('2d');
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(0, 0, size, size);
    hctx.fillStyle = '#000';
    hctx.fillRect(0, 0, size, size);
    const rows = 8, cols = 8;
    const w = size / cols, h = size / rows;
    // 아래 줄부터 그려서 윗줄이 아랫줄을 살짝 덮게
    for (let row = rows; row >= -1; row--) {
      const off = row % 2 ? w / 2 : 0;
      for (let col = -1; col <= cols; col++) {
        const x = col * w + off + w / 2, y = row * h;
        const grad = ctx.createLinearGradient(0, y, 0, y + h * 1.1);
        grad.addColorStop(0, '#f2f2f2');
        grad.addColorStop(1, '#d2d2d2');
        ctx.fillStyle = grad;
        ctx.strokeStyle = '#a8a8a8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - w / 2 + 1, y);
        ctx.lineTo(x - w / 2 + 1, y + h * 0.55);
        ctx.arc(x, y + h * 0.55, w / 2 - 1, Math.PI, 0, true);
        ctx.lineTo(x + w / 2 - 1, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        const hg = hctx.createLinearGradient(0, y, 0, y + h * 1.1);
        hg.addColorStop(0, '#333');
        hg.addColorStop(1, '#fff');
        hctx.fillStyle = hg;
        hctx.beginPath();
        hctx.moveTo(x - w / 2 + 1, y);
        hctx.lineTo(x - w / 2 + 1, y + h * 0.55);
        hctx.arc(x, y + h * 0.55, w / 2 - 1, Math.PI, 0, true);
        hctx.lineTo(x + w / 2 - 1, y);
        hctx.closePath();
        hctx.fill();
      }
    }
    return pack(c, height, 2);
  });
}

/** 동글동글한 조약돌 벽 */
export function stoneWallTex() {
  return cached('stonewall', () => {
    const size = 256;
    const c = canvas(size);
    const ctx = c.getContext('2d');
    const height = canvas(size);
    const hctx = height.getContext('2d');
    ctx.fillStyle = '#b8b2a8';
    ctx.fillRect(0, 0, size, size);
    hctx.fillStyle = '#000';
    hctx.fillRect(0, 0, size, size);
    const r = rng(92);
    const rows = 6, h = size / rows;
    for (let row = 0; row < rows; row++) {
      let x = row % 2 ? -h * 0.4 : 0;
      while (x < size + h) {
        const w = h * (0.9 + r() * 0.7);
        const tone = lerp3([222, 218, 210], [246, 242, 236], r());
        for (const [g, col] of [[ctx, rgb(tone)], [hctx, '#fff']]) {
          g.fillStyle = col;
          g.beginPath();
          g.ellipse(((x + w / 2) % size + size) % size, row * h + h / 2, w / 2 - 3, h / 2 - 3, 0, 0, Math.PI * 2);
          g.fill();
        }
        x += w;
      }
    }
    return pack(c, height, 1.5);
  });
}

export function metalTex() {
  return cached('metal', () => {
    const c = canvas(64);
    paint(c, () => [235, 235, 235]);
    return pack(c);
  });
}

export function fabricTex() {
  return cached('fabric3', () => {
    const c = canvas(64);
    paint(c, (u, v, x, y) => { const k = 240 + (((x >> 1) + (y >> 1)) % 2) * 6; return [k, k, k]; });
    const t = pack(c);
    t.map.repeat.set(6, 6);
    return t;
  });
}

/** 타이어: 굵고 둥근 홈 */
export function tireTex() {
  return cached('tire', () => {
    const c = canvas(128);
    paint(c, (u) => { const k = Math.abs((u * 8) % 1 - 0.5) < 0.18 ? 62 : 84; return [k, k, k]; });
    return pack(c);
  });
}

// ───────── 식물 ─────────

/** 동글동글한 나무·덤불 표면: 큼직하고 대비가 낮은 잎 무늬 (재질 색으로 물들임) */
export function foliageTex() {
  return cached('foliage2', () => {
    const size = 256;
    const c = canvas(size);
    const ctx = c.getContext('2d');
    const height = canvas(size);
    const hctx = height.getContext('2d');
    ctx.fillStyle = 'rgb(212,212,212)';
    ctx.fillRect(0, 0, size, size);
    hctx.fillStyle = '#777';
    hctx.fillRect(0, 0, size, size);
    const r = rng(181);
    for (let i = 0; i < 240; i++) {
      const x = r() * size, y = r() * size;
      const k = 200 + r() * 55;
      const len = 16 + r() * 10;
      const a = r() * Math.PI * 2;
      ctx.fillStyle = `rgb(${k | 0},${k | 0},${k | 0})`;
      hctx.fillStyle = `rgb(${(k - 60) | 0},${(k - 60) | 0},${(k - 60) | 0})`;
      wrapDraw(size, x, y, (px, py) => {
        for (const g of [ctx, hctx]) {
          g.save();
          g.translate(px, py);
          g.rotate(a);
          g.beginPath();
          g.ellipse(0, 0, len / 2, len / 2.6, 0, 0, Math.PI * 2);
          g.fill();
          g.restore();
        }
      });
    }
    return pack(c, height, 1.2);
  });
}

/** 가로(v) 방향으로 가장자리가 부드럽게 사라지는 알파 (길 가장자리용) */
export function edgeFadeTex() {
  return cached('edgefade', () => {
    const c = canvas(16, 128);
    const n = makeNoise(161, 8);
    paint(c, (u, v) => {
      const edge = Math.min(v, 1 - v);
      const k = clamp((edge - 0.03 + (n(u * 8, v * 8) - 0.5) * 0.05) / 0.08, 0, 1) * 255;
      return [k, k, k];
    });
    const t = toTexture(c, { color: false });
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}

/** 잎 한 장 (작물용): 가운데 잎맥만 살짝 */
export function leafTex(color = [74, 120, 46]) {
  const key = 'leaf' + color.join(',');
  return cached(key, () => {
    const c = canvas(64);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 64, 0);
    grad.addColorStop(0, rgb(color.map((v) => v * 0.9)));
    grad.addColorStop(0.5, rgb(color.map((v) => Math.min(255, v * 1.08))));
    grad.addColorStop(1, rgb(color.map((v) => v * 0.9)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = rgb(color.map((v) => Math.min(255, v * 1.3)));
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(32, 0);
    ctx.lineTo(32, 64);
    ctx.stroke();
    return toTexture(c);
  });
}

/** 수박 껍질 줄무늬 */
export function melonTex() {
  return cached('melon', () => {
    const c = canvas(256, 128);
    const n = makeNoise(121, 16);
    paint(c, (u, v) => {
      const stripe = Math.sin((u * 12 + n(u * 16, v * 8) * 0.4) * Math.PI * 2);
      return stripe > 0.15 ? [46, 120, 52] : [126, 196, 92];
    });
    return toTexture(c);
  });
}

/** 물 노멀맵 (시냇물 잔물결 — 아주 은은하게) */
export function waterNormalTex() {
  return cached('waternormal', () => {
    const c = canvas(256);
    const n = fbm(131, 4, 2);
    paint(c, (u, v) => { const k = n(u, v) * 255; return [k, k, k]; });
    return toTexture(normalFrom(c, 3), { color: false });
  });
}

/** 동글동글한 세 갈래 풀 포기 (알파) */
export function grassBladeTex() {
  return cached('blade2', () => {
    const c = canvas(64, 64);
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgb(118,196,92)';
    for (const [x, lean, h] of [[22, -10, 40], [32, 0, 52], [42, 10, 40]]) {
      ctx.beginPath();
      ctx.moveTo(x - 6, 64);
      ctx.quadraticCurveTo(x - 6 + lean * 0.3, 64 - h * 0.6, x + lean, 64 - h);
      ctx.quadraticCurveTo(x + 6 + lean * 0.3, 64 - h * 0.6, x + 6, 64);
      ctx.closePath();
      ctx.fill();
    }
    return toTexture(c);
  });
}
