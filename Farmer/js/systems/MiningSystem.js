import { G, absMinutes, GAME_MIN_PER_SEC } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { AudioManager } from '../core/AudioManager.js';
import { saveGame } from '../core/SaveManager.js';
import { ORES, ORE_ORDER, PICKAXES, PICK_BY_ID, MINE_FLOORS, MAX_ORES, RESET_MIN, FLOOR_LAYOUT, randomOreSpot, rollOre, rollOreAmount } from '../data/mining.js';
import { InventorySystem } from './InventorySystem.js';
import { StaminaSystem } from './StaminaSystem.js';
import { MINE_DOOR } from '../world/World.js';
import { MINE_SPAWN, syncFloorOres, applyZone, oreWorldPos, arrivalPos, toLocal } from '../world/Mine.js';

/** 층에 들어섰을 때 안내 (층이 올라갈수록 좋은 광석 확률↑, 석탄·구리는 3층부터 없음) */
const FLOOR_TIPS = [
  ' — 석탄 · 구리가 흔해요',
  ' — 철 · 은이 늘어나요',
  ' — 석탄 · 구리는 더 없어요! 은 · 금이 자주 보여요',
  ' — 가장 깊은 층! 금과 자수정이 잘 나와요',
];
import { burst } from '../world/Effects.js';
import { addFloatText } from '../ui/WorldMarkers.js';
import { toast, fade } from '../ui/HUD.js';

/**
 * 광산: 광맥을 곡괭이로 캐서 광석을 얻고, 한 반장에게 판다.
 * - 광맥은 정해진 자리 없이 층 안 빈 땅에 랜덤으로 생기고, 캐면 아무것도 남지 않는다.
 * - 캔 광맥은 사라진 채로 있다가, 일정 시간(RESET_MIN)마다 광산 전체가 초기화되어 모든 층의 빈 자리가 다시 채워진다 (아래층에 있으면 1층으로)
 *   (밖에 있거나 자는 동안에도 시간은 흐른다).
 * - 단단한 광석은 곡괭이 등급이 모자라면 못 캔다. 좋은 곡괭이일수록 빠르고, 광석이 여러 개 나올 확률이 높다.
 * - 한 번 캘 때마다 체력이 조금 든다 (농사와 같은 체력을 나눠 쓰므로 농사보다 벌이가 많을 수 없다).
 */
export const MiningSystem = {
  busy: false,
  lastSwing: -1,
  respawnTimer: 0,

  /** 지금 있는 광산 층 (0 = 1층 입구) */
  floor() {
    return G.state.player.mineFloor ?? 0;
  },

  /**
   * 층 상태 { ores: [{ id, slot, x, z, ore }], seq }
   * slot: 화면의 광맥 모델 번호 — 하나를 캐도 나머지 광맥 모델이 자리를 옮기지 않도록 고정
   * 처음이거나 예전 형식(정해진 자리)이면 광맥을 가득 채워 시작한다
   * 광산 전체 초기화 시각은 state.mine.resetAt (게임 분)
   */
  floorState(f = this.floor()) {
    const m = G.state.mine;
    if (!Array.isArray(m.floors) || m.floors.length !== MINE_FLOORS || !Array.isArray(m.floors[0]?.ores)) {
      m.floors = Array.from({ length: MINE_FLOORS }, () => ({ ores: [], seq: 0 }));
      delete m.nodes;
      for (let i = 0; i < MINE_FLOORS; i++) this.spawn(i, MAX_ORES);
    }
    const st = m.floors[f];
    // 예전 세이브: 모델 번호를 붙이고, 층마다 따로 돌던 타이머는 광산 전체 타이머로 합친다
    if (!st.migrated) {
      st.migrated = true;
      const used = new Set();
      for (const o of st.ores) {
        if (!Number.isInteger(o.slot) || used.has(o.slot)) o.slot = this.freeSlot(st, used);
        used.add(o.slot);
      }
      delete st.last;
    }
    delete st.resetAt;
    // 승강기가 새로 생긴 자리에 예전 광맥이 있으면 치운다 (빈 자리는 다음 재생성 때 다른 곳에)
    if (!st.liftClear) {
      st.liftClear = true;
      const L = FLOOR_LAYOUT[f]?.lift;
      if (L) st.ores = st.ores.filter((o) => Math.hypot(o.x - L[0], o.z - L[1]) >= 3.2);
    }
    return st;
  },

  freeSlot(st, used = new Set(st.ores.map((o) => o.slot))) {
    for (let i = 0; i < MAX_ORES; i++) if (!used.has(i)) return i;
    return -1;
  },

  /** 광맥 n개를 빈자리에 새로 만든다 (플레이어 바로 옆은 피한다) */
  spawn(f, n) {
    const st = G.state.mine.floors[f];
    const avoid = [];
    if (G.state.player.zone === 'mine' && this.floor() === f && G.refs.player) avoid.push(toLocal(f, G.refs.player.pos));
    let made = 0;
    for (let k = 0; k < n && st.ores.length < MAX_ORES; k++) {
      const spot = randomOreSpot(f, st.ores, avoid);
      const slot = this.freeSlot(st);
      if (!spot || slot < 0) break;
      st.ores.push({ id: ++st.seq, slot, ...spot, ore: rollOre(f) });
      made++;
    }
    return made;
  },

  /**
   * 광산 전체 초기화: RESET_MIN 분마다 모든 층의 빈 자리를 한꺼번에 다시 채운다.
   * 초기화 시각이 지났으면 초기화하고 true (다음 초기화 시각은 지금부터 다시 RESET_MIN 뒤)
   */
  checkReset(now = absMinutes()) {
    const m = G.state.mine;
    this.floorState(0);
    if (typeof m.resetAt !== 'number') m.resetAt = now + RESET_MIN;
    if (now < m.resetAt) return false;
    for (let f = 0; f < MINE_FLOORS; f++) {
      const st = this.floorState(f);
      this.spawn(f, MAX_ORES - st.ores.length);
    }
    m.resetAt = now + RESET_MIN;
    return true;
  },

  /** 광산 전체가 다시 초기화되기까지 남은 실제 시간(초) */
  resetLeftSeconds() {
    const m = G.state.mine;
    if (typeof m.resetAt !== 'number') return Math.ceil(RESET_MIN / GAME_MIN_PER_SEC);
    return Math.max(0, Math.ceil((m.resetAt - absMinutes()) / GAME_MIN_PER_SEC));
  },

  /** 흐른 시간만큼 초기화를 반영한 뒤 모든 층의 광맥을 화면에 맞춘다 (불러오기 · 드나들 때 · 자고 일어날 때) */
  refreshVisuals() {
    this.checkReset();
    for (let f = 0; f < MINE_FLOORS; f++) syncFloorOres(f, this.floorState(f).ores);
  },

  /** 새 날: 자는 동안 초기화 시각이 지났으면 가득 차 있다 */
  newDay() {
    this.refreshVisuals();
  },

  /** 광산 안에서 1초마다: 초기화 시각이 되면 모든 층을 다시 채우고, 아래층(2~4층)에 있으면 1층 입구로 돌려보낸다 */
  update(dt) {
    // 곡괭이 '깡' 소리는 AudioManager.updateWork 가 동작 박자에 맞춰 낸다
    this.respawnTimer -= dt;
    if (this.respawnTimer > 0) return;
    this.respawnTimer = 1;
    if (this.busy || !this.checkReset()) return;
    for (let f = 0; f < MINE_FLOORS; f++) syncFloorOres(f, this.floorState(f).ores);
    if (this.floor() > 0) this.kickToEntrance();
    else {
      AudioManager.sfx('chime');
      toast('🔄 광산이 초기화됐어요! 광맥이 다시 가득 생겼어요', 'good');
    }
  },

  /** 초기화 때 아래층에 있으면 1층 입구로 */
  async kickToEntrance() {
    const from = this.floor();
    this.busy = true;
    G.refs.player.work = null;
    AudioManager.sfx('lift');
    await fade(true);
    this.moveTo('mine', MINE_SPAWN, Math.PI / 2, 0);
    await fade(false);
    this.busy = false;
    toast(`🔄 광산이 초기화됐어요! ${from + 1}층에서 1층(입구)으로 돌아왔어요 · 광맥이 다시 가득해요`, 'good');
  },

  // ─── 드나들기 ───
  async enter() {
    if (!G.state.flags.mine) {
      AudioManager.sfx('error');
      toast('⛔ 광산 입구가 굳게 닫혀 있어요. 마을 사람에게 먼저 이야기를 들어 봐요', 'warn');
      return;
    }
    if (this.busy) return;
    this.busy = true;
    AudioManager.sfx('door');
    await fade(true);
    this.moveTo('mine', MINE_SPAWN, Math.PI / 2, 0);
    await fade(false);
    this.busy = false;
    toast('⛏️ 광산 1층이에요. 광맥을 곡괭이로 캐 보세요! 동쪽 끝 사다리로 더 깊이 내려갈 수 있어요');
    if (!G.state.flags.gotPickaxe) setTimeout(() => toast('💡 한 반장에게 말을 걸면 곡괭이를 받을 수 있어요'), 1800);
  },

  async exit() {
    if (this.busy) return;
    this.busy = true;
    AudioManager.sfx('door');
    await fade(true);
    this.moveTo('village', MINE_DOOR, -Math.PI / 2);
    await fade(false);
    this.busy = false;
  },

  /** 사다리로 위·아래층 이동 */
  async changeFloor(dir) {
    if (this.busy) return;
    const from = this.floor();
    const to = dir === 'down' ? from + 1 : from - 1;
    if (to < 0 || to >= MINE_FLOORS) return;
    this.busy = true;
    AudioManager.sfx('door');
    await fade(true);
    this.moveTo('mine', arrivalPos(to, dir === 'down' ? 'above' : 'below'), dir === 'down' ? Math.PI / 2 : -Math.PI / 2, to);
    await fade(false);
    this.busy = false;
    toast(`⛏️ 광산 ${to + 1}층${to === 0 ? ' (입구)' : ''}${FLOOR_TIPS[to]}`);
  },

  /** 승강기: 2층 이하 어디서든 바로 1층(입구)으로 */
  async takeLift() {
    if (this.busy || this.floor() === 0) return;
    this.busy = true;
    const from = this.floor();
    AudioManager.sfx('lift');
    await fade(true);
    this.moveTo('mine', MINE_SPAWN, Math.PI / 2, 0);
    await fade(false);
    this.busy = false;
    toast(`🛗 승강기를 타고 ${from + 1}층에서 1층(입구)으로 올라왔어요`, 'good');
  },

  /** 플레이어를 구역(과 광산 층)으로 옮긴다 (잠들 때·불러올 때도 사용) */
  moveTo(zone, pos, facing, floor = 0) {
    const p = G.refs.player;
    G.state.player.zone = zone;
    G.state.player.mineFloor = zone === 'mine' ? floor : 0;
    applyZone(zone, G.state.player.mineFloor);
    p.setPosition(pos.x, pos.z);
    if (facing !== undefined) p.facing = facing;
    G.refs.cameraCtl?.target.copy(p.pos);
    // 밖에 있던 동안 흐른 시간만큼만 다시 생긴다
    if (zone === 'mine') this.refreshVisuals();
    EventBus.emit('zone', zone);
  },

  // ─── 캐기 ───
  heldPick() {
    const it = InventorySystem.getHeldItem();
    return it?.type === 'pick' ? it : null;
  },

  /** 광맥 찾기 (없으면 이미 캐낸 것) */
  oreById(f, id) {
    return this.floorState(f).ores.find((e) => e.id === id) || null;
  },

  mine(f, id) {
    const p = G.refs.player;
    if (p.work || f !== this.floor()) return;
    const item = this.heldPick();
    if (!item) {
      AudioManager.sfx('error');
      return toast(InventorySystem.hasType('pick') ? '⛏️ 핫바에서 곡괭이를 골라 주세요' : '⛏️ 곡괭이가 없어요. 한 반장에게 말을 걸어 보세요', 'warn');
    }
    const node = this.oreById(f, id);
    if (!node) return;
    const ore = ORES[node.ore];
    const pick = PICK_BY_ID[item.id];
    if (pick.tier < ore.tier) {
      AudioManager.sfx('error');
      return toast(`🪨 ${ore.name}은(는) 너무 단단해요! '${PICKAXES[ore.tier].name}' 이상이 필요해요`, 'warn');
    }
    if (StaminaSystem.current() < pick.stamina) {
      AudioManager.sfx('error');
      return toast('너무 피곤해요… 잠을 자거나 음식을 먹고 쉬어 가요 😴', 'warn');
    }
    const pos = oreWorldPos(f, node);
    p.faceTo(pos.x, pos.z);
    const oreId = node.ore;
    p.startWork(Math.round(pick.time * ore.hard * 100) / 100, () => {
      // 캐낸 광맥은 목록에서 빠져 아무것도 남지 않는다
      const st = this.floorState(f);
      const k = st.ores.indexOf(node);
      if (k < 0) return;
      st.ores.splice(k, 1);
      syncFloorOres(f, st.ores);
      StaminaSystem.spend(pick.stamina);
      const n = rollOreAmount(pick);
      const stored = InventorySystem.addOrStore(oreId, n);
      const mined = G.state.mine.mined;
      mined[oreId] = (mined[oreId] || 0) + n;
      burst({ x: pos.x, y: 0.4, z: pos.z }, { color: 0x8a8078, count: 26, speed: 3, up: 3, life: 0.8, size: 0.09 });
      burst({ x: pos.x, y: 0.6, z: pos.z }, { color: ore.color, count: 12, speed: 2, up: 3.5, life: 0.9, size: 0.1 });
      AudioManager.sfx('rock');
      addFloatText(`${ore.icon}+${n}`, { x: pos.x, y: 1.6, z: pos.z }, n > 1 ? '#c98a1e' : '#fff');
      toast(`${ore.icon} ${ore.name} +${n}${n > 1 ? ' · 대박! 여러 개 나왔어요' : ''}${stored ? ' (가방이 가득 차 일부는 창고로)' : ''}`, n > 1 ? 'good' : 'info');
      EventBus.emit('mined', { oreId, n });
    }, 'mine', { item });
  },

  // ─── 한 반장: 곡괭이 받기 · 광석 팔기 ───
  givePickaxe() {
    G.state.flags.gotPickaxe = true;
    if (!InventorySystem.addTool('pick_old')) {
      G.state.flags.gotPickaxe = false;
      toast('가방이 가득 차서 곡괭이를 받을 수 없어요', 'warn');
      return false;
    }
    AudioManager.sfx('quest');
    toast('⛏️ 낡은 곡괭이를 받았어요! 핫바에서 골라 광맥을 눌러 보세요', 'good');
    saveGame();
    return true;
  },

  sellableOres() {
    return ORE_ORDER.map((id) => ({ id, ore: ORES[id], n: InventorySystem.countAll(id) })).filter((e) => e.n > 0);
  },

  sell(id, n) {
    n = Math.min(n, InventorySystem.countAll(id));
    if (n <= 0) return 0;
    InventorySystem.consumeAll(id, n);
    const money = ORES[id].price * n;
    G.state.player.money += money;
    G.state.stats.oreEarned = (G.state.stats.oreEarned || 0) + money;
    EventBus.emit('money');
    return money;
  },

  sellAll() {
    let total = 0;
    for (const e of this.sellableOres()) total += this.sell(e.id, e.n);
    if (total > 0) {
      AudioManager.sfx('coin');
      toast(`광석을 모두 팔았어요! +${total.toLocaleString()}원`, 'good');
    }
  },

  // ─── 돌쇠: 곡괭이 사기 ───
  buyPick(id) {
    const pk = PICK_BY_ID[id];
    if (!pk) return;
    if (InventorySystem.count(id) > 0) return toast('이미 가지고 있어요');
    if (G.state.player.money < pk.price) {
      AudioManager.sfx('error');
      return toast('돈이 부족해요', 'warn');
    }
    if (!InventorySystem.canAdd(id, 1)) {
      AudioManager.sfx('error');
      return toast('가방이 가득 찼어요', 'warn');
    }
    G.state.player.money -= pk.price;
    InventorySystem.add(id, 1);
    AudioManager.sfx('anvil');
    toast(`⛏️ ${pk.name}을(를) 샀어요! 가방 '채광' 탭에서 핫바로 옮겨 쓰세요`, 'good');
    EventBus.emit('money');
  },
};
