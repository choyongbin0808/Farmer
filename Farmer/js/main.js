import * as THREE from 'three';
import { G, FARM_MAX, createNewState, isUIBlocking } from './core/Game.js';
import { EventBus } from './core/EventBus.js';
import { Input } from './core/Input.js';
import { AudioManager } from './core/AudioManager.js';
import { saveGame, loadGame, hasSave, deleteSave, loadSettings } from './core/SaveManager.js';
import { SM } from './world/SceneManager.js';
import { CameraController } from './world/CameraController.js';
import { buildWorld, updateWorld, updateDecorations, interactables, BUILDINGS, plotPosition, STREAM_Z, FARM_SIGN_POS } from './world/World.js';
import { updateDayNight, periodOf } from './world/DayNight.js';
import { initWeather, setWeather, updateWeather } from './world/Weather.js';
import { initEffects, updateEffects } from './world/Effects.js';
import { Player } from './entities/Player.js';
import { NPC } from './entities/NPC.js';
import { FarmPlot } from './entities/FarmPlot.js';
import { NPCS, NPC_ORDER } from './data/npcs.js';
import { TOOL_LEVELS } from './data/tools.js';
import { InventorySystem } from './systems/InventorySystem.js';
import { StaminaSystem } from './systems/StaminaSystem.js';
import { FarmSystem } from './systems/FarmSystem.js';
import { TimeSystem } from './systems/TimeSystem.js';
import { QuestSystem } from './systems/QuestSystem.js';
import { DialogueSystem } from './systems/DialogueSystem.js';
import { CheatSystem } from './systems/CheatSystem.js';
import { initHUD, updateHUD, renderHotbar, renderTracker, setStaminaPreview, toast, fade, showHUD } from './ui/HUD.js';
import { closeModal } from './ui/Panels.js';
import { DialogueUI } from './ui/DialogueUI.js';
import { InventoryUI } from './ui/InventoryUI.js';
import { QuestUI } from './ui/QuestUI.js';
import { ShopUI } from './ui/ShopUI.js';
import { ForgeUI } from './ui/ForgeUI.js';
import { StorageUI } from './ui/StorageUI.js';
import { FarmUI } from './ui/FarmUI.js';
import { MenuUI } from './ui/MenuUI.js';
import { TitleUI } from './ui/TitleUI.js';
import { initMarkers, updateMarkers } from './ui/WorldMarkers.js';
import { playEnding } from './ui/EndingUI.js';

const canvas = document.getElementById('game-canvas');
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const TITLE_CENTER = new THREE.Vector3(-4, 0, 2);

let player, cam;
let plotMeshes = [];
const highlights = [];
let clock = 0;
let last = performance.now();
let saveTimer = 0;
let hoverTimer = 0;

// ───────── 초기화 ─────────
async function boot() {
  loadSettings();
  await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 1500))]);

  SM.init(canvas);
  buildWorld(SM.scene);
  initWeather(SM.scene);
  initEffects(SM.scene);

  player = new Player(SM.scene);
  player.onBlocked = () => toast('길이 막혀 있어요. 직접 걸어가 볼까요?');
  G.refs.player = player;

  G.refs.npcs = {};
  for (const id of NPC_ORDER) {
    const n = new NPC(id, NPCS[id], SM.scene);
    G.refs.npcs[id] = n;
    interactables.push(n.group);
  }

  G.refs.plots = [];
  for (let r = 0; r < FARM_MAX; r++) {
    for (let c = 0; c < FARM_MAX; c++) {
      const { x, z } = plotPosition(r, c);
      const p = new FarmPlot(r * FARM_MAX + c, r, c, x, z, SM.scene);
      p.soil.visible = r < 3 && c < 3;
      G.refs.plots.push(p);
    }
  }
  plotMeshes = G.refs.plots.flatMap((p) => [p.soil, p.cropGroup]);

  const hlGeo = new THREE.PlaneGeometry(1.6, 1.6);
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(hlGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    SM.scene.add(m);
    highlights.push(m);
  }

  cam = new CameraController(SM.camera);
  G.refs.cameraCtl = cam;

  initMarkers(SM.scene, SM.camera, { onPlotClick: interactPlot });
  DialogueUI.init();
  initHUD({
    openQuests: () => !isUIBlocking() && QuestUI.open(),
    openInventory: () => !isUIBlocking() && InventoryUI.open(),
    openMenu: () => !isUIBlocking() && MenuUI.openPause(),
  });
  InventoryUI.init();
  QuestUI.init();
  ShopUI.init();
  ForgeUI.init();
  StorageUI.init();
  FarmUI.init();
  QuestSystem.init();

  DialogueSystem.openTrade = (what) => {
    if (what === 'shop') ShopUI.open();
    else if (what === 'forge') ForgeUI.open();
    else if (what === 'ending') playEnding(() => toast('🎩 이장으로서의 새로운 하루가 시작됐어요!', 'good'));
  };
  MenuUI.onTitle = goTitle;
  G.refs.eatHeld = eatHeld;

  for (const evt of ['held', 'inventory', 'upgrade']) EventBus.on(evt, updateHeldModel);
  EventBus.on('heartUp', (id) => toast(`❤️ ${NPCS[id].name}와(과) 더 친해졌어요!`, 'good'));

  Input.init(canvas, {
    onKey,
    onClick,
    onRotate: (dx) => cam.rotate(dx),
    onZoom: (d) => cam.zoom(d),
  });

  window.addEventListener('pagehide', () => { if (G.mode === 'play') saveGame(); });

  document.getElementById('loading').classList.add('hidden');
  goTitle();
  requestAnimationFrame(loop);
}

// ───────── 타이틀 / 게임 시작 ─────────
function goTitle() {
  G.mode = 'title';
  closeModal(true);
  DialogueUI.hide();
  showHUD(false);
  cam.setOrbit(TITLE_CENTER, 44, 0.04);
  TitleUI.show({
    hasSave: hasSave(),
    onNew: (name) => {
      deleteSave();
      begin(createNewState(name), true);
    },
    onContinue: () => {
      const s = loadGame();
      if (s) begin(s, false);
      else goTitle();
    },
    onSettings: () => MenuUI.openSettings(),
  });
}

async function begin(state, isNew) {
  await fade(true);
  G.state = state;
  G.ui.held = { area: 'hotbar', index: 0 };
  player.setPosition(state.player.x, state.player.z);
  player.facing = Math.PI;
  player.applyOutfit(state.player.outfit);
  for (const n of Object.values(G.refs.npcs)) {
    n.frozen = false;
    n.talking = false;
    n.resetHome();
  }
  FarmSystem.refreshAll();
  updateDecorations(state.flags);
  setWeather(state.time.weather, true);
  cam.setFollow();
  cam.yaw = 0;
  cam.target.copy(player.pos);
  G.mode = 'play';
  showHUD(true);
  renderHotbar();
  renderTracker();
  updateHeldModel();
  await fade(false);

  if (isNew || !state.flags.introDone) {
    saveGame();
    await DialogueSystem.intro();
    state.flags.introDone = true;
    saveGame();
    toast('💡 WASD로 이동하고, 1~5 키로 도구를 골라요');
    setTimeout(() => toast('💡 머리 위에 ❗가 있는 사람에게 말을 걸어 보세요'), 3200);
    setTimeout(() => toast('💡 📜 퀘스트 창에서 "위치 표시"를 누르면 길을 알려 줘요'), 6400);
  } else {
    toast(`🌱 ${state.player.name} 님, 다시 오신 걸 환영해요!`, 'good');
  }
}

// ───────── 입력 ─────────
function onKey(code) {
  if (G.mode === 'play') CheatSystem.feed(code);
  if (G.mode === 'title') {
    if (code === 'Escape') closeModal();
    return;
  }
  if (G.ui.dialogue || G.mode === 'ending') {
    if (code === 'Space' || code === 'Enter') DialogueUI.next();
    const m = code.match(/^Digit(\d)$/);
    if (m) DialogueUI.pickByKey(Number(m[1]));
    return;
  }
  if (code === 'Escape') {
    if (G.ui.modal) closeModal();
    else if (G.mode === 'play' && !G.ui.fading) MenuUI.openPause();
    return;
  }
  if (G.ui.modal) {
    if ((code === 'KeyI' || code === 'Tab') && G.ui.modal === 'inventory') closeModal();
    if (code === 'KeyQ' && G.ui.modal === 'quests') closeModal();
    return;
  }
  if (G.ui.fading || G.mode !== 'play') return;
  const m = code.match(/^Digit([1-5])$/);
  if (m) InventorySystem.select('hotbar', Number(m[1]) - 1);
  else if (code === 'KeyI' || code === 'Tab') InventoryUI.open();
  else if (code === 'KeyQ') QuestUI.open();
  else if (code === 'KeyE') interactNearest();
}

function pick(x, y, targets) {
  ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, SM.camera);
  const hits = raycaster.intersectObjects(targets, true);
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData?.type) o = o.parent;
    if (!o) continue;
    if (o.userData.type === 'plot' && !G.refs.plots[o.userData.index].active) continue;
    return o.userData;
  }
  return null;
}

function onClick(x, y) {
  if (G.mode !== 'play' || isUIBlocking()) return;
  const hit = pick(x, y, [...interactables, ...plotMeshes]);
  if (!hit) {
    if (InventorySystem.getHeldItem()?.type === 'food') eatHeld();
    return;
  }
  if (hit.type === 'plot') interactPlot(G.refs.plots[hit.index]);
  else if (hit.type === 'npc') interactNpc(hit.id);
  else if (hit.type === 'building') interactBuilding(hit.id);
  else if (hit.type === 'farmSign') interactFarmSign();
}

function interactFarmSign() {
  approach(FARM_SIGN_POS.x, FARM_SIGN_POS.z - 1, 2.4, () => FarmUI.openExpand());
}

function approach(x, z, reach, cb) {
  const d = Math.hypot(x - player.pos.x, z - player.pos.z);
  if (d <= reach) {
    player.faceTo(x, z);
    cb();
  } else {
    player.moveTo(x, z, reach, cb);
  }
}

function interactPlot(plot) {
  if (G.mode !== 'play' || isUIBlocking() || !plot.active) return;
  if (FarmSystem.showsInfo(plot)) return FarmUI.openCropInfo(plot);
  approach(plot.x, plot.z, 1.7, () => FarmSystem.usePlot(plot));
}

function interactNpc(id) {
  const n = G.refs.npcs[id];
  approach(n.pos.x, n.pos.z, 2.4, () => DialogueSystem.talkTo(id));
}

const BUILDING_NPC = { shop: 'shop', forge: 'smith', hall: 'chief', grandma: 'grandma', sua: 'sua' };

function interactBuilding(id) {
  const b = BUILDINGS[id];
  approach(b.ix, b.iz, 2.4, () => {
    if (id === 'house') MenuUI.confirmSleep(() => TimeSystem.sleep());
    else if (id === 'storage') StorageUI.open();
    else if (BUILDING_NPC[id]) DialogueSystem.talkTo(BUILDING_NPC[id]);
  });
}

function interactNearest() {
  let best = null;
  let bestD = 3.2;
  for (const id of NPC_ORDER) {
    const n = G.refs.npcs[id];
    const d = Math.hypot(n.pos.x - player.pos.x, n.pos.z - player.pos.z);
    if (d < bestD) { bestD = d; best = () => interactNpc(id); }
  }
  for (const [id, b] of Object.entries(BUILDINGS)) {
    if (BUILDING_NPC[id]) continue;
    const d = Math.hypot(b.ix - player.pos.x, b.iz - player.pos.z);
    if (d < bestD) { bestD = d; best = () => interactBuilding(id); }
  }
  const sd = Math.hypot(FARM_SIGN_POS.x - player.pos.x, FARM_SIGN_POS.z - player.pos.z);
  if (sd < bestD) best = interactFarmSign;
  if (best) best();
  else toast('가까이에 상호작용할 대상이 없어요');
}

function eatHeld() {
  const h = InventorySystem.getHeld();
  if (h?.item.type === 'food') StaminaSystem.eat(h.area, h.index);
}

function updateHeldModel() {
  if (!G.state) return;
  const item = InventorySystem.getHeldItem();
  const color = item?.type === 'tool' ? TOOL_LEVELS[G.state.tools[item.toolKind]].color : 0x8a7b6a;
  player.setHeld(item, color);
}

// ───────── 마우스 오버 미리보기 ─────────
function updateHover() {
  for (const h of highlights) h.visible = false;
  setStaminaPreview(0);
  if (G.mode !== 'play' || isUIBlocking() || !Input.mouse.inside) {
    canvas.style.cursor = 'default';
    return;
  }
  const hit = pick(Input.mouse.x, Input.mouse.y, [...interactables, ...plotMeshes]);
  canvas.style.cursor = hit ? 'pointer' : 'default';
  if (hit?.type !== 'plot') return;
  const plot = G.refs.plots[hit.index];
  const pv = FarmSystem.preview(plot);
  if (!pv) return;
  pv.plots.forEach((p, i) => {
    const m = highlights[i];
    if (!m) return;
    m.visible = true;
    m.position.set(p.x, 0.16, p.z);
    m.material.color.setHex(pv.ok ? (p === plot ? 0xfff6a0 : 0xffffff) : 0xff5a5a);
  });
  if (pv.cost) setStaminaPreview(pv.cost);
}

// ───────── 메인 루프 ─────────
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;
  const playing = G.mode === 'play';
  const free = playing && !isUIBlocking();

  if (free) TimeSystem.update(dt);
  player.update(dt, Input, cam.basis(), free);
  for (const n of Object.values(G.refs.npcs)) n.update(dt, clock);
  for (const p of G.refs.plots) p.animate(clock);
  updateEffects(dt);
  updateWorld(dt, clock);

  const minutes = G.state ? G.state.time.minutes : 9.5 * 60;
  const weather = G.state ? G.state.time.weather : 'sunny';
  const focus = G.mode === 'title' ? TITLE_CENTER : player.pos;
  updateDayNight(minutes, weather, focus);
  updateWeather(dt, focus, clock);
  cam.update(dt, player.pos);

  const period = periodOf(minutes);
  AudioManager.setPeriod(period);
  AudioManager.updateAmbient(dt, { weather, period, distToStream: Math.abs(focus.z - STREAM_Z) });

  hoverTimer -= dt;
  if (hoverTimer <= 0) {
    hoverTimer = 0.06;
    updateHover();
  }

  SM.render();
  updateMarkers(dt, clock, player.pos, playing || G.mode === 'ending');
  if (G.state) updateHUD();

  if (playing) {
    saveTimer += dt;
    if (saveTimer > 300) {
      saveTimer = 0;
      saveGame();
    }
  }
  requestAnimationFrame(loop);
}

boot().catch((e) => {
  console.error(e);
  const el = document.getElementById('loading');
  el.textContent = '게임을 불러오지 못했어요: ' + e.message;
  el.classList.remove('hidden');
});
