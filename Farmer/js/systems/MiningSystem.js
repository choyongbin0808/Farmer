import { G, absMinutes } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { AudioManager } from '../core/AudioManager.js';
import { saveGame } from '../core/SaveManager.js';
import { ORES, ORE_ORDER, PICKAXES, PICK_BY_ID, NODE_SPOTS, RESPAWN_MIN, rollOre, rollOreAmount } from '../data/mining.js';
import { InventorySystem } from './InventorySystem.js';
import { StaminaSystem } from './StaminaSystem.js';
import { MINE_DOOR } from '../world/World.js';
import { MINE_SPAWN, showOreNode, applyZone, nodeWorldPos } from '../world/Mine.js';
import { burst } from '../world/Effects.js';
import { addFloatText } from '../ui/WorldMarkers.js';
import { toast, fade } from '../ui/HUD.js';

/**
 * 광산: 광맥을 곡괭이로 캐서 광석을 얻고, 한 반장에게 판다.
 * - 광맥은 매일 아침 모두 다시 차고, 캐낸 자리는 게임 시간 약 3시간 뒤 다시 생긴다.
 * - 단단한 광석은 곡괭이 등급이 모자라면 못 캔다. 좋은 곡괭이일수록 빠르고, 광석이 여러 개 나올 확률이 높다.
 * - 한 번 캘 때마다 체력이 조금 든다 (농사와 같은 체력을 나눠 쓰므로 농사보다 벌이가 많을 수 없다).
 */
export const MiningSystem = {
  busy: false,
  lastSwing: -1,
  respawnTimer: 0,

  nodes() {
    const m = G.state.mine;
    if (!Array.isArray(m.nodes) || m.nodes.length !== NODE_SPOTS.length) {
      m.nodes = NODE_SPOTS.map(() => ({ ore: rollOre(), respawnAt: 0 }));
    }
    return m.nodes;
  },

  refreshVisuals() {
    this.nodes().forEach((n, i) => showOreNode(i, n.ore));
  },

  /** 새 날: 광맥이 모두 다시 찬다 */
  newDay() {
    G.state.mine.nodes = NODE_SPOTS.map(() => ({ ore: rollOre(), respawnAt: 0 }));
    this.refreshVisuals();
  },

  /** 캐낸 자리 다시 채우기 (1초마다) */
  update(dt) {
    // 곡괭이로 내리찍는 순간마다 '깡' 소리
    const w = G.refs.player.work;
    if (w?.motion === 'mine') {
      const k = Math.floor((w.t / w.dur) * w.cycles + 0.4);
      if (k !== this.lastSwing) {
        this.lastSwing = k;
        if (k > 0) AudioManager.sfx('pick');
      }
    } else {
      this.lastSwing = -1;
    }
    this.respawnTimer -= dt;
    if (this.respawnTimer > 0) return;
    this.respawnTimer = 1;
    const now = absMinutes();
    this.nodes().forEach((n, i) => {
      if (!n.ore && now >= n.respawnAt) {
        n.ore = rollOre();
        showOreNode(i, n.ore);
      }
    });
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
    this.moveTo('mine', MINE_SPAWN, Math.PI / 2);
    await fade(false);
    this.busy = false;
    toast('⛏️ 광산에 들어왔어요. 광맥을 곡괭이로 캐 보세요!');
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

  /** 플레이어를 구역으로 옮긴다 (잠들 때·불러올 때도 사용) */
  moveTo(zone, pos, facing) {
    const p = G.refs.player;
    G.state.player.zone = zone;
    applyZone(zone);
    p.setPosition(pos.x, pos.z);
    if (facing !== undefined) p.facing = facing;
    G.refs.cameraCtl?.target.copy(p.pos);
    if (zone === 'mine') this.refreshVisuals();
    EventBus.emit('zone', zone);
  },

  // ─── 캐기 ───
  heldPick() {
    const it = InventorySystem.getHeldItem();
    return it?.type === 'pick' ? it : null;
  },

  mine(i) {
    const p = G.refs.player;
    if (p.work) return;
    const item = this.heldPick();
    if (!item) {
      AudioManager.sfx('error');
      return toast(InventorySystem.hasType('pick') ? '⛏️ 핫바에서 곡괭이를 골라 주세요' : '⛏️ 곡괭이가 없어요. 한 반장에게 말을 걸어 보세요', 'warn');
    }
    const node = this.nodes()[i];
    if (!node.ore) return toast('이미 캐낸 자리예요. 시간이 지나면 다시 광맥이 생겨요');
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
    const pos = nodeWorldPos(i);
    p.faceTo(pos.x, pos.z);
    const oreId = node.ore;
    p.startWork(Math.round(pick.time * ore.hard * 100) / 100, () => {
      if (node.ore !== oreId) return;
      node.ore = null;
      node.respawnAt = absMinutes() + RESPAWN_MIN * (0.8 + Math.random() * 0.4);
      showOreNode(i, null);
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
