import * as THREE from 'three';
import { G } from '../core/Game.js';
import { NPC_ORDER, NPCS } from '../data/npcs.js';
import { QuestSystem } from '../systems/QuestSystem.js';

const v = new THREE.Vector3();
let root;
let camera;
const plotIcons = [];
const npcTags = {};
const floats = [];
let beacon;
let arrow;
let onPlotClick = null;

function project(x, y, z) {
  v.set(x, y, z).project(camera);
  return {
    x: (v.x * 0.5 + 0.5) * window.innerWidth,
    y: (-v.y * 0.5 + 0.5) * window.innerHeight,
    behind: v.z > 1,
  };
}

export function initMarkers(scene, cam, handlers) {
  root = document.getElementById('markers');
  camera = cam;
  onPlotClick = handlers.onPlotClick;
  for (const plot of G.refs.plots) {
    const el = document.createElement('div');
    el.className = 'mk harvest hidden';
    el.textContent = '🧺';
    el.title = '클릭해서 수확';
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onPlotClick?.(plot);
    });
    root.appendChild(el);
    plotIcons.push({ plot, el });
  }
  for (const id of NPC_ORDER) {
    const el = document.createElement('div');
    el.className = 'mk npc-tag';
    el.innerHTML = `<div class="bubble hidden"></div><div class="nm">${NPCS[id].name}</div>`;
    root.appendChild(el);
    npcTags[id] = { el, bubble: el.querySelector('.bubble'), last: '' };
  }

  const geo = new THREE.CylinderGeometry(0.6, 0.6, 30, 16, 1, true);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  beacon = new THREE.Mesh(geo, mat);
  beacon.position.y = 15;
  beacon.visible = false;
  scene.add(beacon);

  arrow = document.getElementById('edge-arrow');
}

export function addFloatText(text, pos, color = '#fff') {
  const el = document.createElement('div');
  el.className = 'mk float-text';
  el.textContent = text;
  el.style.color = color;
  root.appendChild(el);
  floats.push({ el, x: pos.x, y: pos.y, z: pos.z, t: 0 });
}

export function updateMarkers(dt, t, playerPos, visible) {
  root.classList.toggle('hidden', !visible);
  if (!visible) {
    beacon.visible = false;
    arrow.classList.add('hidden');
    return;
  }

  for (const { plot, el } of plotIcons) {
    const show = plot.active && plot.isReady();
    if (!show) {
      el.classList.add('hidden');
      continue;
    }
    const p = project(plot.x, 1.3 + Math.sin(t * 3 + plot.phase) * 0.12, plot.z);
    el.classList.toggle('hidden', p.behind);
    el.style.transform = `translate(${p.x}px, ${p.y}px)`;
  }

  for (const id of NPC_ORDER) {
    const tag = npcTags[id];
    const npc = G.refs.npcs[id];
    const d = Math.hypot(npc.pos.x - playerPos.x, npc.pos.z - playerPos.z);
    const h = 2.6 * (NPCS[id].look.scale ?? 1);
    const p = project(npc.pos.x, npc.pos.y + h, npc.pos.z);
    const qIcon = G.mode === 'play' ? QuestSystem.npcIcon(id) : null;
    const icon = qIcon || (d < 5 && G.mode === 'play' ? '💬' : '');
    if (icon !== tag.last) {
      tag.last = icon;
      tag.bubble.textContent = icon;
      tag.bubble.classList.toggle('hidden', !icon);
      tag.bubble.classList.toggle('quest', icon === '❗' || icon === '✅');
    }
    const showName = d < 14 || !!qIcon;
    tag.el.classList.toggle('hidden', p.behind || (!showName && !icon));
    tag.el.querySelector('.nm').classList.toggle('hidden', !showName);
    tag.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
  }

  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.t += dt;
    const p = project(f.x, f.y + f.t * 1.2, f.z);
    f.el.style.transform = `translate(${p.x}px, ${p.y}px)`;
    f.el.style.opacity = String(Math.max(0, 1 - f.t / 1.4));
    if (f.t > 1.4) {
      f.el.remove();
      floats.splice(i, 1);
    }
  }

  // 퀘스트 위치 표시
  const q = G.mode === 'play' ? QuestSystem.tracked() : null;
  const tgt = q && QuestSystem.target(q);
  if (!tgt) {
    beacon.visible = false;
    arrow.classList.add('hidden');
    return;
  }
  beacon.visible = true;
  beacon.position.x = tgt.x;
  beacon.position.z = tgt.z;
  beacon.material.opacity = 0.2 + Math.sin(t * 3) * 0.08;
  const dist = Math.hypot(tgt.x - playerPos.x, tgt.z - playerPos.z);
  const p = project(tgt.x, 1.5, tgt.z);
  const W = window.innerWidth, H = window.innerHeight, m = 60;
  const off = p.behind || p.x < m || p.x > W - m || p.y < m || p.y > H - m;
  if (!off || dist < 4) {
    arrow.classList.add('hidden');
    return;
  }
  let dx = p.x - W / 2, dy = p.y - H / 2;
  if (p.behind) { dx = -dx; dy = -dy; }
  const ang = Math.atan2(dy, dx);
  const k = Math.min((W / 2 - m) / Math.abs(Math.cos(ang) || 1e-6), (H / 2 - m) / Math.abs(Math.sin(ang) || 1e-6));
  arrow.classList.remove('hidden');
  arrow.style.transform = `translate(${W / 2 + Math.cos(ang) * k}px, ${H / 2 + Math.sin(ang) * k}px)`;
  arrow.querySelector('.arr').style.transform = `rotate(${ang}rad)`;
  arrow.querySelector('.lbl').textContent = `${tgt.label} · ${Math.round(dist)}m`;
}
