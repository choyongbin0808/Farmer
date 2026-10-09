import * as THREE from 'three';
import { G, FARM_MAX, HOTBAR_SIZE, createNewState, isUIBlocking, currentZone } from './core/Game.js';
import { EventBus } from './core/EventBus.js';
import { Input } from './core/Input.js';
import { AudioManager } from './core/AudioManager.js';
import { saveGame, loadGame, hasSave, deleteSave, loadSettings } from './core/SaveManager.js';
import { SM } from './world/SceneManager.js';
import { CameraController } from './world/CameraController.js';
import { buildWorld, updateWorld, updateDecorations, interactables, BUILDINGS, plotPosition, STREAM_Z, FARM_SIGN_POS } from './world/World.js';
import { buildMine, applyZone, MINE_EXIT, nodeWorldPos, mineNodes } from './world/Mine.js';
import { updateDayNight, periodOf } from './world/DayNight.js';
import { initWeather, setWeather, updateWeather } from './world/Weather.js';
import { initEffects, updateEffects } from './world/Effects.js';
import { Player } from './entities/Player.js';
import { NPC } from './entities/NPC.js';
import { FarmPlot } from './entities/FarmPlot.js';
import { NPCS, NPC_ORDER } from './data/npcs.js';
import { isHandTool } from './data/items.js';
import { InventorySystem } from './systems/InventorySystem.js';
import { GearSystem } from './systems/GearSystem.js';
import { StaminaSystem } from './systems/StaminaSystem.js';
import { FarmSystem } from './systems/FarmSystem.js';
import { TimeSystem } from './systems/TimeSystem.js';
import { QuestSystem } from './systems/QuestSystem.js';
import { DialogueSystem } from './systems/DialogueSystem.js';
import { CheatSystem } from './systems/CheatSystem.js';
import { FishingSystem } from './systems/FishingSystem.js';
import { MiningSystem } from './systems/MiningSystem.js';
import { FacilitySystem } from './systems/FacilitySystem.js';
import { initHUD, updateHUD, renderHotbar, renderTracker, setStaminaPreview, toast, fade, showHUD } from './ui/HUD.js';
import { FishingUI } from './ui/FishingUI.js';
import { BookUI } from './ui/BookUI.js';
import { MineUI } from './ui/MineUI.js';
import { FacilityUI } from './ui/FacilityUI.js';
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
import { playEnding, skipEnding } from './ui/EndingUI.js';

const canvas = document.getElementById('game-canvas');
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const groundHit = new THREE.Vector3();
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
  // 3D 간판 글씨(캔버스)는 그리는 순간의 글꼴로 굳어지므로, 간판 글자가 든 Jua 조각을 먼저 받아 둔다
  const SIGN_TEXT = '우리 집 창고 상점 대장간 마을회관 김 할머니 댁 수아 꽃집 내 밭 · 확장 새 광산 출구 마을로 곡괭이 팝니다 약탕기 육묘장 공사 중 0123456789';
  await Promise.race([
    Promise.all([document.fonts?.load(`40px Jua`, SIGN_TEXT), document.fonts?.ready]),
    new Promise((r) => setTimeout(r, 3000)),
  ]).catch(() => {});

  SM.init(canvas);
  buildWorld(SM.scene);
  buildMine(SM.scene);
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
    openBook: () => !isUIBlocking() && BookUI.open(),
    openInventory: () => !isUIBlocking() && InventoryUI.open(),
    openMenu: () => !isUIBlocking() && MenuUI.openPause(),
  });
  InventoryUI.init();
  QuestUI.init();
  ShopUI.init();
  ForgeUI.init();
  StorageUI.init();
  FarmUI.init();
  FishingUI.init();
  BookUI.init();
  MineUI.init();
  FacilityUI.init();
  QuestSystem.init();
  GearSystem.init();
  FishingSystem.init(SM.scene);
  FacilitySystem.init(SM.scene);

  DialogueSystem.openTrade = (what) => {
    if (what === 'shop') ShopUI.open();
    else if (what === 'forge') ForgeUI.open();
    else if (what === 'fish') FishingUI.open();
    else if (what === 'ore') MineUI.openOre();
    else if (what === 'pick') MineUI.openPick();
    else if (what === 'ending') playEnding(() => toast('🎩 이장으로서의 새로운 하루가 시작됐어요! 진행은 그대로 이어져요', 'good'));
  };
  MenuUI.onTitle = goTitle;
  MenuUI.onEnding = () => playEnding(() => toast('🎬 엔딩을 다시 봤어요. 계속 즐겨 주세요!', 'good'));
  G.refs.eatHeld = eatHeld;
  // 잠들기 · 타이틀로 갈 때 하던 낚시 · 배치를 정리
  G.refs.cancelActivities = () => {
    FishingSystem.cancel();
    FacilitySystem.cancelPlacement(true);
  };

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
  if (G.state) G.refs.cancelActivities();
  G.mode = 'title';
  applyZone('village');
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
  FacilitySystem.refreshAll();
  updateDecorations(state.flags);
  setWeather(state.time.weather, true);
  // 광산에서 저장했으면 광산 안에서 이어 한다
  const zone = state.player.zone === 'mine' && state.flags.mine ? 'mine' : 'village';
  state.player.zone = zone;
  applyZone(zone);
  MiningSystem.refreshVisuals();
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
    toast('💡 밭을 클릭하면 갈기·물 주기·수확을 알아서 해요. 심을 씨앗은 핫바에서 골라요');
    setTimeout(() => toast('💡 머리 위 빨간 ❗는 진행 중인 퀘스트와 관련된 사람이에요'), 3200);
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
    if (code === 'Escape' && G.mode === 'ending') skipEnding();
    if (code === 'Space' || code === 'Enter') DialogueUI.next();
    const m = code.match(/^Digit(\d)$/);
    if (m) DialogueUI.pickByKey(Number(m[1]));
    return;
  }
  if (code === 'Escape') {
    if (G.ui.modal) closeModal();
    else if (FacilitySystem.isPlacing()) FacilitySystem.cancelPlacement();
    else if (FishingSystem.active()) FishingSystem.cancel('🎣 낚싯줄을 감았어요');
    else if (G.mode === 'play' && !G.ui.fading) MenuUI.openPause();
    return;
  }
  if (G.ui.modal) {
    if ((code === 'KeyI' || code === 'Tab') && G.ui.modal === 'inventory') closeModal();
    if (code === 'KeyQ' && G.ui.modal === 'quests') closeModal();
    if (code === 'KeyB' && G.ui.modal === 'book') closeModal();
    return;
  }
  if (G.ui.fading || G.mode !== 'play') return;
  if (FacilitySystem.isPlacing() && code === 'KeyR') return FacilitySystem.rotatePlacement();
  if (FishingSystem.active() && (code === 'Space' || code === 'Enter' || code === 'KeyE')) {
    FishingSystem.action();
    return;
  }
  const m = code.match(/^Digit([1-9])$/);
  if (m && Number(m[1]) <= HOTBAR_SIZE) InventorySystem.select('hotbar', Number(m[1]) - 1);
  else if (code === 'KeyI' || code === 'Tab') InventoryUI.open();
  else if (code === 'KeyQ') QuestUI.open();
  else if (code === 'KeyB') BookUI.open();
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
    return { ...o.userData, point: h.point };
  }
  return null;
}

/** 마우스가 가리키는 땅 위 지점 (배치 모드용) */
function groundPoint(x, y) {
  ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, SM.camera);
  return raycaster.ray.intersectPlane(ground, groundHit);
}

function onClick(x, y) {
  if (G.mode !== 'play' || isUIBlocking()) return;
  if (FacilitySystem.isPlacing()) {
    const p = groundPoint(x, y);
    if (p) FacilitySystem.movePlacement(p.x, p.z);
    FacilitySystem.confirmPlacement();
    return;
  }
  if (FishingSystem.active()) {
    FishingSystem.action();
    return;
  }
  const hit = pick(x, y, [...interactables, ...plotMeshes]);
  // 핫바에서 시설(약탕기·육묘장)을 들고 땅을 누르면 배치 모드
  const heldItem = InventorySystem.getHeldItem();
  if (heldItem?.type === 'facility' && (!hit || hit.type === 'plot' || hit.type === 'water')) {
    FacilitySystem.startPlacement(heldItem.kind);
    const p = groundPoint(x, y);
    if (p && FacilitySystem.isPlacing()) FacilitySystem.movePlacement(p.x, p.z);
    return;
  }
  if (!hit) {
    if (heldItem?.type === 'food') eatHeld();
    return;
  }
  if (hit.type === 'plot') interactPlot(G.refs.plots[hit.index]);
  else if (hit.type === 'npc') interactNpc(hit.id);
  else if (hit.type === 'building') interactBuilding(hit.id);
  else if (hit.type === 'farmSign') interactFarmSign();
  else if (hit.type === 'water') interactWater(hit.point);
  else if (hit.type === 'facility') interactFacility(hit.index);
  else if (hit.type === 'ore') interactOre(hit.index);
  else if (hit.type === 'mineExit') interactMineExit();
}

function interactWater(point) {
  const rod = FishingSystem.heldRod();
  if (!rod) {
    if (InventorySystem.getHeldItem()?.type === 'food') return eatHeld();
    if (InventorySystem.hasType('rod')) toast(`🎣 핫바(1~${HOTBAR_SIZE})에서 낚싯대를 골라 주세요`);
    return;
  }
  if (G.refs.player.work || !FishingSystem.canStart()) return;
  const { stand, spot } = FishingSystem.spotsFor(point);
  approach(stand.x, stand.z, 0.8, () => FishingSystem.cast(spot, rod));
}

function interactFacility(i) {
  const f = G.state.facilities[i];
  if (!f) return;
  approach(f.x, f.z, FacilitySystem.reach(i), () => FacilityUI.open(i));
}

function interactOre(i) {
  const p = nodeWorldPos(i);
  approach(p.x, p.z, 1.6, () => MiningSystem.mine(i));
}

function interactMineExit() {
  approach(MINE_EXIT.x + 1.4, MINE_EXIT.z, 1.2, () => MiningSystem.exit());
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
  // 갈고 물 준 밭인데 씨앗을 안 들고 있으면: 가방의 씨앗 중에서 골라 바로 심는다
  if (FarmSystem.actionFor(plot)?.kind === 'needSeed') {
    return FarmUI.openSeedPicker((ref) => {
      InventorySystem.select(ref.area, ref.index);
      approach(plot.x, plot.z, 1.7, () => FarmSystem.usePlot(plot));
    });
  }
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
    else if (id === 'mine') MiningSystem.enter();
    else if (BUILDING_NPC[id]) DialogueSystem.talkTo(BUILDING_NPC[id]);
  });
}

function interactNearest() {
  let best = null;
  let bestD = 3.2;
  const near = (x, z, fn, extra = 0) => {
    const d = Math.hypot(x - player.pos.x, z - player.pos.z) - extra;
    if (d < bestD) { bestD = d; best = fn; }
  };
  const zone = currentZone();
  for (const id of NPC_ORDER) {
    if ((NPCS[id].zone ?? 'village') !== zone) continue;
    const n = G.refs.npcs[id];
    near(n.pos.x, n.pos.z, () => interactNpc(id));
  }
  if (zone === 'mine') {
    mineNodes.forEach((_, i) => {
      const p = nodeWorldPos(i);
      near(p.x, p.z, () => interactOre(i), 0.6);
    });
    near(MINE_EXIT.x, MINE_EXIT.z, interactMineExit, 0.6);
  } else {
    for (const [id, b] of Object.entries(BUILDINGS)) {
      if (BUILDING_NPC[id]) continue;
      near(b.ix, b.iz, () => interactBuilding(id));
    }
    near(FARM_SIGN_POS.x, FARM_SIGN_POS.z, interactFarmSign);
    G.state.facilities.forEach((f, i) => near(f.x, f.z, () => interactFacility(i), FacilitySystem.reach(i) - 1.4));
  }
  if (best) best();
  else toast('가까이에 상호작용할 대상이 없어요');
}

function eatHeld() {
  const h = InventorySystem.getHeld();
  if (h?.item.type === 'food') StaminaSystem.eat(h.area, h.index);
}

/**
 * 손에 드는 모델: 핫바에서 낚싯대·곡괭이를 고르면 늘 손에 들고 다닌다.
 * 그 밖에는 빈손 — 농기구·씨앗은 밭 작업을 하는 동안만 나타난다 (Player.startWork)
 */
function updateHeldModel() {
  if (player.work || FishingSystem.active()) return;
  const it = G.mode === 'play' ? InventorySystem.getHeldItem() : null;
  player.setHeld(isHandTool(it) ? it : null, it?.color);
}

// ───────── 마우스 오버 미리보기 ─────────
function updateHover() {
  for (const h of highlights) h.visible = false;
  setStaminaPreview(0);
  if (G.mode !== 'play' || isUIBlocking() || !Input.mouse.inside) {
    canvas.style.cursor = 'default';
    return;
  }
  if (FacilitySystem.isPlacing()) {
    const p = groundPoint(Input.mouse.x, Input.mouse.y);
    if (p) FacilitySystem.movePlacement(p.x, p.z);
    canvas.style.cursor = 'crosshair';
    return;
  }
  if (FishingSystem.active()) {
    canvas.style.cursor = 'pointer';
    return;
  }
  const hit = pick(Input.mouse.x, Input.mouse.y, [...interactables, ...plotMeshes]);
  const usable = hit && (hit.type !== 'water' || FishingSystem.heldRod());
  canvas.style.cursor = usable ? 'pointer' : 'default';
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

  const inMine = playing && currentZone() === 'mine';
  if (free) TimeSystem.update(dt);
  player.update(dt, Input, cam.basis(), free);
  for (const n of Object.values(G.refs.npcs)) n.update(dt, clock);
  for (const p of G.refs.plots) p.animate(clock);
  updateHeldModel();
  if (playing) {
    FishingSystem.update(dt, clock, !free);
    if (inMine) MiningSystem.update(dt);
    FacilitySystem.animate(clock);
  }
  updateEffects(dt);
  updateWorld(dt, clock);

  // 엔딩 연출 중에는 잠시 밤하늘·맑은 날씨로 (실제 게임 시간은 그대로)
  const env = G.ui.envOverride;
  const minutes = env ? env.minutes : G.state ? G.state.time.minutes : 9.5 * 60;
  const weather = env ? env.weather : G.state ? G.state.time.weather : 'sunny';
  const focus = G.mode === 'title' ? TITLE_CENTER : player.pos;
  updateDayNight(minutes, weather, focus, inMine);
  if (env?.dim) {
    // 예고편처럼 어둑한 밤 — 꼬마전구·가로등 불빛이 돋보이게
    SM.hemi.intensity *= env.dim;
    SM.sun.intensity *= env.dim;
  }
  updateWeather(dt, focus, clock);
  cam.update(dt, player.pos);

  const period = periodOf(minutes);
  AudioManager.setPeriod(period);
  AudioManager.updateAmbient(dt, { weather, period, distToStream: Math.abs(focus.z - STREAM_Z), indoor: inMine });

  hoverTimer -= dt;
  if (hoverTimer <= 0) {
    hoverTimer = 0.06;
    updateHover();
  }

  SM.render();
  updateMarkers(dt, clock, player.pos, playing);
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
