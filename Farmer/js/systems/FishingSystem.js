import * as THREE from 'three';
import { G, BAG_SIZES } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { AudioManager } from '../core/AudioManager.js';
import { FISH, ROD_BY_ID, rollCatch, catchReward, weightText } from '../data/fishing.js';
import { InventorySystem } from './InventorySystem.js';
import { Input } from '../core/Input.js';
import { STREAM_Z } from '../world/World.js';
import { makeBobber } from '../world/ExtraModels.js';
import { burst } from '../world/Effects.js';
import { addTagSource, addFloatText } from '../ui/WorldMarkers.js';
import { toast, setHint } from '../ui/HUD.js';

/*
 * 낚시 (스타듀밸리 · 팰월드 방식)
 *  ① charge  — 파워 게이지가 오르내린다. 클릭/Space 로 멈춰 던진다 (멀리 던질수록 귀한 고기, 끝까지 차면 '완벽!')
 *  ② cast    — 찌가 날아가 물에 떨어진다
 *  ③ wait    — 물고기 그림자가 찌 주위를 맴돌다 다가온다 (팰월드)
 *  ④ bite    — ❗ 입질! 짧은 시간 안에 클릭/Space 로 챔질
 *  ⑤ game    — 미니게임 (스타듀밸리): 꾹 누르면 초록 막대가 올라가고 떼면 내려간다.
 *              위아래로 날뛰는 물고기를 막대 안에 붙잡아 두면 게이지가 차오르고, 놓치면 줄어든다.
 *              가득 차면 낚고, 다 비면 놓친다. 좋은 낚싯대일수록 막대가 크다.
 */

const STAND_Z = STREAM_Z + 2.7;
const tip = new THREE.Vector3();
const HOLD = { a1x: -0.9, a0x: -0.55, in0: 0.32, bx: 0.04 };
/** 낚싯대 등급별 초록 막대 크기 (게이지 높이 대비) */
const BAR_SIZE = [0.3, 0.34, 0.39, 0.45];

let bobber;
let shadow;
let line;
let linePos;
let ui = null; // 파워 게이지 · 미니게임 화면

function buildUI() {
  const el = document.createElement('div');
  el.id = 'fish-ui';
  el.className = 'hidden';
  el.innerHTML = `
    <div class="fu-power"><div class="fu-power-fill"></div><span class="fu-perfect">완벽!</span></div>
    <div class="fu-game">
      <div class="fu-track"><div class="fu-water"></div><div class="fu-bar"></div><div class="fu-fish">🐟</div></div>
      <div class="fu-prog"><i></i></div>
    </div>`;
  document.getElementById('app').appendChild(el);
  return {
    el,
    power: el.querySelector('.fu-power'),
    powerFill: el.querySelector('.fu-power-fill'),
    perfect: el.querySelector('.fu-perfect'),
    game: el.querySelector('.fu-game'),
    bar: el.querySelector('.fu-bar'),
    fish: el.querySelector('.fu-fish'),
    prog: el.querySelector('.fu-prog i'),
  };
}

/** mode: null(숨김) | 'power' | 'game' */
function showUI(mode) {
  ui.el.classList.toggle('hidden', !mode);
  ui.power.classList.toggle('hidden', mode !== 'power');
  ui.game.classList.toggle('hidden', mode !== 'game');
}

export const FishingSystem = {
  s: null,

  init(scene) {
    bobber = makeBobber();
    bobber.visible = false;
    scene.add(bobber);
    // 찌 주위를 맴도는 물고기 그림자
    shadow = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20), new THREE.MeshBasicMaterial({ color: 0x0a1a24, transparent: true, opacity: 0.35, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(1.8, 0.7, 1);
    shadow.visible = false;
    scene.add(shadow);
    linePos = new Float32Array(6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
    line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xf6f6f0, transparent: true, opacity: 0.85 }));
    line.frustumCulled = false;
    line.visible = false;
    scene.add(line);
    ui = buildUI();
    addTagSource(() => {
      const s = this.s;
      if (s?.phase !== 'bite') return [];
      return [{ key: 'fish-bite', text: '❗', x: s.spot.x, y: 1.1, z: s.spot.z, cls: 'bite' }];
    });
  },

  active() {
    return !!this.s;
  },

  /** 들고 있는 낚싯대 (핫바에서 고른 것) */
  heldRod() {
    const it = InventorySystem.getHeldItem();
    return it?.type === 'rod' ? it : null;
  },

  /** 시냇물을 눌렀을 때: 둑에 설 자리와 찌를 던질 자리 */
  spotsFor(point) {
    const x = THREE.MathUtils.clamp(point.x, -34, 34);
    return {
      stand: { x, z: STAND_Z },
      spot: { x: x + THREE.MathUtils.clamp(point.x - x, -2, 2), z: THREE.MathUtils.clamp(point.z, STREAM_Z - 1.1, STREAM_Z + 0.9) },
    };
  },

  canStart() {
    if (!InventorySystem.freeSlots('fishing')) {
      AudioManager.sfx('error');
      toast(`🎒 가방의 '낚시' 칸이 가득 찼어요 (${BAG_SIZES.fishing}칸). 오 씨에게 물고기를 넘겨요`, 'warn');
      return false;
    }
    return true;
  },

  /** 둑에 선 뒤 호출 — 파워 게이지부터 (spot.x: 찌를 던질 방향) */
  cast(spot, rodItem) {
    const p = G.refs.player;
    if (this.s || p.work || !this.canStart()) return;
    const rod = ROD_BY_ID[rodItem.id];
    this.s = { phase: 'charge', spot: { ...spot }, rod, item: rodItem, power: 0, dir: 1, timer: 0, bonus: 0 };
    p.faceTo(spot.x, STREAM_Z);
    p.keepHeld = true;
    p.stance = HOLD;
    p.setHeld(rodItem, rodItem.color);
    showUI('power');
    setHint('🎣 <b>클릭 / Space</b> 로 던지기 — 멀리 던질수록 귀한 고기가 물어요');
  },

  /** 파워를 정하고 찌를 던진다 */
  throwLine() {
    const s = this.s;
    const p = G.refs.player;
    const perfect = s.power >= 0.94;
    s.bonus = s.power * 0.8 + (perfect ? 0.5 : 0);
    // 약하게 던지면 둑 가까이, 세게 던지면 건너편 가까이
    s.spot = { x: p.pos.x + (Math.random() - 0.5) * 1.2, z: STREAM_Z + 1.1 - s.power * 2.2 };
    s.phase = 'cast';
    showUI(null);
    if (perfect) addFloatText('완벽!', { x: p.pos.x, y: 2.8, z: p.pos.z }, '#e6a93a');
    p.faceTo(s.spot.x, s.spot.z);
    p.startWork(0.9, () => this.landBobber(), 'cast', { item: s.item });
    AudioManager.sfx('cast');
    setHint('🎣 찌를 던지는 중…');
  },

  landBobber() {
    const s = this.s;
    if (!s) return;
    bobber.visible = true;
    line.visible = true;
    bobber.position.set(s.spot.x, 0.08, s.spot.z);
    burst({ x: s.spot.x, y: -0.1, z: s.spot.z }, { color: 0xd8f4ff, count: 14, speed: 1.4, up: 1.6, life: 0.5 });
    AudioManager.sfx('splash');
    this.toWait();
  },

  toWait() {
    const s = this.s;
    s.phase = 'wait';
    s.timer = (3 + Math.random() * 5) * s.rod.wait;
    s.waitTotal = s.timer;
    s.angle = Math.random() * Math.PI * 2;
    shadow.visible = true;
    setHint('🎣 물고기가 다가오고 있어요… <b>❗가 뜨면 클릭 / Space</b> · 이동하면 그만둬요');
  },

  /** 입질에 챔질 성공 → 미니게임 */
  startGame() {
    const s = this.s;
    // 어떤 고기인지는 이때 정한다 (던진 힘이 셀수록 귀한 고기)
    s.catch = rollCatch({ ...s.rod, luck: s.rod.luck + s.bonus });
    const f = FISH[s.catch.id];
    s.phase = 'game';
    s.bar = 0.1;
    s.barVel = 0;
    s.barSize = BAR_SIZE[s.rod.tier] ?? 0.3;
    s.fishY = 0.4;
    s.fishTarget = 0.5;
    s.fishTimer = 0;
    s.progress = 0.3;
    // 등급이 높을수록 빠르고 변덕스럽다. 게는 느리고 바닥 쪽을 좋아한다
    s.diff = f.crab ? 0.6 + f.grade * 0.12 : 0.5 + f.grade * 0.32;
    shadow.visible = false;
    ui.fish.textContent = '🐟';
    showUI('game');
    // 줄을 당기며 버티는 자세 (낚싯대가 부들부들)
    G.refs.player.stance = () => ({ ...HOLD, a1x: -1.45 + Math.sin(performance.now() / 55) * 0.07, a0x: -1.0, bx: -0.1 });
    AudioManager.sfx('bite');
    setHint('🎣 <b>꾹 누르면</b> 막대가 올라가고, 떼면 내려가요 — 물고기를 초록 막대 안에!');
  },

  /** 미니게임 한 프레임 */
  updateGame(dt, t) {
    const s = this.s;
    const f = FISH[s.catch.id];
    const hold = Input.isDown('Space') || Input.mouse.down;
    // 초록 막대: 누르면 위로 힘, 떼면 중력. 바닥에 닿으면 살짝 튄다
    s.barVel += (hold ? 2.4 : -2.0) * dt;
    s.barVel = THREE.MathUtils.clamp(s.barVel, -1.0, 1.0);
    s.bar += s.barVel * dt;
    if (s.bar < 0) { s.bar = 0; s.barVel = Math.abs(s.barVel) * 0.3; }
    if (s.bar > 1 - s.barSize) { s.bar = 1 - s.barSize; s.barVel = 0; }
    // 물고기: 목표 지점을 자꾸 바꾸며 움직인다
    s.fishTimer -= dt;
    s.dart = Math.max(0, (s.dart || 0) - dt);
    if (s.fishTimer <= 0) {
      const lo = f.crab ? 0 : 0.02, hi = f.crab ? 0.6 : 0.98;
      s.fishTarget = lo + Math.random() * (hi - lo);
      s.fishTimer = (0.5 + Math.random() * 1.4) / (0.6 + s.diff * 0.25);
      // 귀한 고기(★3 이상)는 가끔 반대편 끝으로 확 내달린다
      if (f.grade >= 3 && Math.random() < 0.12 * (f.grade - 2)) {
        s.fishTarget = s.fishY > 0.5 ? lo + Math.random() * 0.2 : hi - Math.random() * 0.2;
        s.dart = 0.6;
      }
    }
    const speed = (0.12 + s.diff * 0.26) * (s.dart > 0 ? 2.1 : 1);
    s.fishY += THREE.MathUtils.clamp(s.fishTarget - s.fishY, -speed * dt, speed * dt) + Math.sin(t * 9) * 0.002 * s.diff;
    s.fishY = THREE.MathUtils.clamp(s.fishY, 0, 1);
    const inside = s.fishY >= s.bar && s.fishY <= s.bar + s.barSize;
    s.progress += (inside ? 0.42 * (1 + s.rod.tier * 0.06) : -0.22 * (1 - s.rod.tier * 0.08)) * dt;
    // 화면
    ui.bar.style.bottom = `${s.bar * 100}%`;
    ui.bar.style.height = `${s.barSize * 100}%`;
    ui.bar.classList.toggle('on', inside);
    ui.fish.style.bottom = `calc(${s.fishY * 100}% - 14px)`;
    ui.prog.style.height = `${THREE.MathUtils.clamp(s.progress, 0, 1) * 100}%`;
    ui.prog.style.background = `hsl(${THREE.MathUtils.clamp(s.progress, 0, 1) * 110}, 70%, 52%)`;
    bobber.position.y = -0.05 + Math.sin(t * 26) * 0.04;
    bobber.position.x = s.spot.x + Math.sin(t * 5) * 0.25;
    if (s.progress >= 1) {
      // 낚았다! 번쩍 끌어올리는 동작 뒤 가방으로
      s.phase = 'reel';
      showUI(null);
      AudioManager.sfx('catch');
      G.refs.player.startWork(0.7, () => this.land(), 'reel', { item: s.item });
      setHint('🎣 끌어올리는 중!');
    } else if (s.progress <= 0) {
      AudioManager.sfx('escape');
      toast(`💨 ${f.crab ? '게' : '물고기'}가 줄을 끊고 달아났어요…`);
      this.finish();
    }
  },

  /** 클릭 / Space / E — 낚시 중이면 처리하고 true */
  action() {
    const s = this.s;
    if (!s) return false;
    if (s.phase === 'charge') this.throwLine();
    else if (s.phase === 'bite') this.startGame();
    else if (s.phase === 'wait') {
      s.timer += 1.2;
      toast('🐟 앗, 너무 일찍 당겼어요! 물고기가 놀랐어요', 'warn');
    }
    return true;
  },

  land() {
    const s = this.s;
    if (!s) return;
    const c = s.catch || rollCatch(s.rod);
    const f = FISH[c.id];
    const st = G.state.fishing;
    if (!InventorySystem.addFish(c)) {
      toast('🎒 가방이 가득 차서 물고기를 놓아줬어요', 'warn');
      this.finish(true);
      return;
    }
    st.caught++;
    st.counts[c.id] = (st.counts[c.id] || 0) + 1;
    const best = st.best[c.id];
    const record = !best || c.w > best;
    if (record) st.best[c.id] = c.w;
    const r = catchReward(c);
    burst({ x: s.spot.x, y: 0, z: s.spot.z }, { color: 0xbfe8ff, count: 24, speed: 2, up: 3, life: 0.7 });
    addFloatText(`${f.icon} ${'★'.repeat(f.grade)}`, { x: G.refs.player.pos.x, y: 2.6, z: G.refs.player.pos.z }, '#2a6ac8');
    const used = BAG_SIZES.fishing - InventorySystem.freeSlots('fishing');
    toast(`${f.icon} ${f.name} ${weightText(c.w)}${record ? ' · 🏆 최고 기록!' : ''} (교환 시 ${r.item === 'mat_chitosan' ? '키토산' : '타우린'} ${r.n}) · 낚시 가방 ${used}/${BAG_SIZES.fishing}`, f.grade >= 4 ? 'good' : 'info');
    EventBus.emit('fish', c);
    this.finish(true);
  },

  /** 낚시 끝 (잡았거나 그만둠) */
  finish(keepRod = false) {
    const p = G.refs.player;
    this.s = null;
    bobber.visible = false;
    shadow.visible = false;
    line.visible = false;
    showUI(null);
    p.stance = null;
    p.keepHeld = false;
    if (!keepRod || !p.work) p.setHeld(null);
    setHint(null);
  },

  cancel(msg) {
    if (!this.s) return;
    if (msg) toast(msg);
    this.finish();
  },

  update(dt, t, blocked) {
    const s = this.s;
    if (!s) return;
    const p = G.refs.player;
    // 움직이면 그만둔다 (던지는 중·끌어올리는 중은 작업이라 못 움직임)
    if (!p.work && (p.moving > 0.3 || p.moveTarget)) {
      if (s.phase === 'wait' || s.phase === 'bite' || s.phase === 'game') AudioManager.sfx('escape');
      this.cancel('🎣 낚싯줄을 감았어요');
      return;
    }
    if (InventorySystem.getHeldItem()?.id !== s.item.id && !p.work) {
      this.cancel('🎣 낚싯대를 내려놓았어요');
      return;
    }
    if (!blocked) {
      if (s.phase === 'charge') {
        // 파워 게이지가 0 ↔ 1 을 오르내린다
        s.power += s.dir * dt * 1.25;
        if (s.power >= 1) { s.power = 1; s.dir = -1; }
        if (s.power <= 0) { s.power = 0; s.dir = 1; }
        ui.powerFill.style.height = `${s.power * 100}%`;
        ui.powerFill.style.background = `hsl(${s.power * 110}, 75%, 52%)`;
        ui.perfect.classList.toggle('show', s.power >= 0.94);
      } else if (s.phase === 'wait') {
        s.timer -= dt;
        // 물고기 그림자가 찌 주위를 맴돌며 점점 다가온다
        const k = THREE.MathUtils.clamp(s.timer / s.waitTotal, 0, 1);
        s.angle += dt * (0.8 + (1 - k) * 1.6);
        const r = 0.35 + k * 1.6;
        shadow.position.set(s.spot.x + Math.cos(s.angle) * r, 0.075, s.spot.z + Math.sin(s.angle) * r * 0.55);
        shadow.rotation.z = -s.angle - Math.PI / 2;
        let y = 0.08 + Math.sin(t * 3) * 0.015;
        if (k < 0.25 && Math.sin(t * 13) > 0.85) y -= 0.035; // 톡톡 건드리는 척
        bobber.position.y = y;
        if (s.timer <= 0) {
          s.phase = 'bite';
          s.timer = s.rod.window;
          shadow.position.set(s.spot.x, 0.075, s.spot.z);
          AudioManager.sfx('bite');
          burst({ x: s.spot.x, y: -0.1, z: s.spot.z }, { color: 0xffffff, count: 10, speed: 1, up: 1.2, life: 0.4 });
          setHint('❗ <b>입질! 클릭 / Space</b>');
        }
      } else if (s.phase === 'bite') {
        s.timer -= dt;
        bobber.position.y = -0.06 + Math.sin(t * 34) * 0.035;
        if (s.timer <= 0) {
          AudioManager.sfx('escape');
          toast('💨 물고기가 미끼만 먹고 달아났어요…');
          this.toWait();
        }
      } else if (s.phase === 'game') {
        this.updateGame(dt, t);
        if (!this.s) return;
      }
    }
    // 낚싯줄: 낚싯대 끝 → 찌
    if (line.visible) {
      const tipObj = p.parts.handSlot.getObjectByName('rodTip');
      if (tipObj) {
        p.group.updateMatrixWorld(true);
        tipObj.getWorldPosition(tip);
        linePos.set([tip.x, tip.y, tip.z, bobber.position.x, bobber.position.y + 0.1, bobber.position.z]);
        line.geometry.attributes.position.needsUpdate = true;
      }
    }
  },

  // ─── 오 씨와 교환 ───
  /** 가방·핫바의 물고기를 종류별로 묶은 목록 [{ id, list: [{ id, w }], taurine, chitosan }] */
  creelGroups() {
    const map = new Map();
    for (const { slot } of InventorySystem.fishSlots()) {
      const c = { id: slot.id, w: slot.w ?? FISH[slot.id].w[0] };
      if (!map.has(c.id)) map.set(c.id, { id: c.id, list: [], taurine: 0, chitosan: 0 });
      const g = map.get(c.id);
      g.list.push(c);
      const r = catchReward(c);
      if (r.item === 'mat_chitosan') g.chitosan += r.n;
      else g.taurine += r.n;
    }
    return [...map.values()].sort((a, b) => FISH[b.id].grade - FISH[a.id].grade);
  },

  /** id 를 주면 그 종류만, 없으면 가진 물고기 전부 교환 */
  exchange(id = null) {
    const give = InventorySystem.fishSlots().filter(({ slot }) => !id || slot.id === id);
    if (!give.length) return;
    let taurine = 0, chitosan = 0;
    for (const { area, index, slot } of give) {
      const r = catchReward({ id: slot.id, w: slot.w ?? FISH[slot.id].w[0] });
      if (r.item === 'mat_chitosan') chitosan += r.n;
      else taurine += r.n;
      InventorySystem.slots(area)[index] = null;
    }
    EventBus.emit('inventory');
    if (taurine) InventorySystem.addOrStore('mat_taurine', taurine);
    if (chitosan) InventorySystem.addOrStore('mat_chitosan', chitosan);
    AudioManager.sfx('coin');
    const parts = [taurine && `💊 타우린 +${taurine}`, chitosan && `🐚 키토산 +${chitosan}`].filter(Boolean);
    toast(`${give.length}마리를 넘겼어요: ${parts.join(' · ')}`, 'good');
    EventBus.emit('fish');
  },

  buyRod(id) {
    const r = ROD_BY_ID[id];
    if (!r) return;
    if (InventorySystem.count(id) > 0) return toast('이미 가지고 있어요');
    if (G.state.player.money < r.price) {
      AudioManager.sfx('error');
      return toast('돈이 부족해요', 'warn');
    }
    if (!InventorySystem.canAdd(id, 1)) {
      AudioManager.sfx('error');
      return toast('가방이 가득 찼어요', 'warn');
    }
    G.state.player.money -= r.price;
    InventorySystem.add(id, 1);
    AudioManager.sfx('coin');
    toast(`🎣 ${r.name}을(를) 샀어요! 가방 '낚시' 탭에서 핫바로 옮겨 쓰세요`, 'good');
    EventBus.emit('money');
  },
};
