import { G, RESIDENTS, formatMoney, currentZone } from '../core/Game.js';
import { AudioManager } from '../core/AudioManager.js';
import { ROOMS, roomSpawn } from '../world/Interiors.js';
import { WEATHERS } from '../world/Weather.js';
import { NPCS } from '../data/npcs.js';
import { RANKS } from '../data/ranks.js';
import { CROP_ORDER } from '../data/crops.js';
import { FISH, FISH_ORDER, weightText } from '../data/fishing.js';
import { ORE_ORDER } from '../data/mining.js';
import { MiningSystem } from './MiningSystem.js';
import { TimeSystem } from './TimeSystem.js';
import { StaminaSystem } from './StaminaSystem.js';
import { fade, toast } from '../ui/HUD.js';
import { openModal } from '../ui/Panels.js';
import { MenuUI } from '../ui/MenuUI.js';
import { WardrobeUI } from '../ui/WardrobeUI.js';
import { SoilBoxUI } from '../ui/SoilBoxUI.js';
import { BookUI } from '../ui/BookUI.js';
import { QuestUI } from '../ui/QuestUI.js';

const FIRST_VISIT = {
  house: ['visitedHouse', '🏠 우리 집이에요! 침대에서 자고, 옷장에서 옷을 갈아입고, 책장에서 도감을 볼 수 있어요'],
  hall: ['visitedHall', '🏛️ 마을회관이에요. 게시판에서 퀘스트를 확인할 수 있어요'],
  cellar: ['visitedCellar', '🛠️ 지하 작업실이에요! 상점에서 약탕기·육묘장을 사면 여기에 자동으로 설치돼요'],
};

/** 집 · 마을회관 드나들기와 방 안 가구 */
export const InteriorSystem = {
  busy: false,

  async enter(room) {
    if (this.busy || !ROOMS[room]) return;
    this.busy = true;
    G.refs.cancelActivities?.();
    AudioManager.sfx('door');
    await fade(true);
    MiningSystem.moveTo(room, roomSpawn(room), ROOMS[room].spawnFace);
    await fade(false);
    this.busy = false;
    const [flag, msg] = FIRST_VISIT[room];
    if (!G.state.flags[flag]) {
      G.state.flags[flag] = true;
      toast(msg, 'good');
    }
  },

  async exit() {
    const room = currentZone();
    if (this.busy || !ROOMS[room]) return;
    this.busy = true;
    AudioManager.sfx('door');
    await fade(true);
    // 지하 작업실은 집 안으로, 나머지는 마을로
    MiningSystem.moveTo(ROOMS[room].exitTo ?? 'village', ROOMS[room].out, ROOMS[room].outFace);
    await fade(false);
    this.busy = false;
  },

  /** 방 안 가구 · 장식을 눌렀을 때 */
  interact(id) {
    const s = G.state;
    const name = s.player.name;
    switch (id) {
      case 'exit': return this.exit();
      case 'bed': return MenuUI.confirmSleep(() => TimeSystem.sleep());
      case 'wardrobe': return WardrobeUI.open();
      case 'stairs': return this.enter('cellar');
      case 'soilbox0': case 'soilbox1': case 'soilbox2': return SoilBoxUI.open();
      case 'bookshelf':
        toast('📚 책장에 그동안 모은 도감이 꽂혀 있어요');
        return BookUI.open();
      case 'calendar': {
        const w = WEATHERS[s.time.weather];
        return toast(`📅 귀농 ${s.time.day}일차 · ${TimeSystem.clock()} · 오늘 날씨 ${w.icon} ${w.name}`);
      }
      case 'fireplace':
        // 하루 한 번, 따뜻한 불 앞에서 쉬면 체력이 조금 돌아온다
        if (s.player.fireDay !== s.time.day && StaminaSystem.current() < StaminaSystem.max()) {
          s.player.fireDay = s.time.day;
          const n = StaminaSystem.recover(10);
          return toast(`🔥 타닥타닥… 불 앞에서 몸을 녹였어요 · 체력 +${n}`, 'good');
        }
        return toast('🔥 타닥타닥… 장작 타는 소리가 포근해요');
      case 'kitchen':
        if (s.player.teaDay !== s.time.day && StaminaSystem.current() < StaminaSystem.max()) {
          s.player.teaDay = s.time.day;
          const n = StaminaSystem.recover(5);
          return toast(`🍵 따뜻한 보리차를 한 잔 마셨어요 · 체력 +${n}`, 'good');
        }
        return toast(s.player.teaDay === s.time.day ? '🍳 부엌이에요. 오늘은 차를 이미 마셨어요' : '🍳 부엌이에요. 지금은 기운이 넘쳐서 차는 나중에 마실래요');
      case 'drawing': return toast('🖼️ 민지가 그려 준 그림이에요. 볼 때마다 웃음이 나요');
      case 'rodrack': return toast('🎣 오 씨가 준 낚싯대예요. 시냇물 소리가 들리는 것 같아요');
      case 'certificate': return toast(`📜 "${name} 님을 초록마을 이장으로 임명합니다" — 박 이장 (지금은 부이장)`, 'good');
      case 'board':
        AudioManager.sfx('click');
        return QuestUI.open();
      case 'desk':
        if (s.flags.endingSeen) return toast(`🎩 이장 ${name}의 책상이에요. 오늘도 마을을 잘 부탁해요!`, 'good');
        return toast(s.flags.hallBuilt ? '📋 박 이장님의 새 책상이에요. 반짝반짝 윤이 나요' : '📋 박 이장님의 낡은 책상이에요. 서류가 산더미처럼 쌓여 있어요');
      case 'stove': return toast('🔥 낡은 난로예요… 연기가 조금 새요');
      case 'bucket': return toast('💧 천장에서 비가 새요… 새 마을회관이 꼭 필요해 보여요');
      case 'trophy': return this.openRecords();
      default: return null;
    }
  },

  /** 명예의 전당: 지금까지의 기록 */
  openRecords() {
    openModal('records', '🏆 명예의 전당', (body) => {
      const s = G.state;
      const bestId = Object.entries(s.fishing.best).sort((a, b) => b[1] - a[1])[0];
      const mined = Object.values(s.mine.mined || {}).reduce((a, b) => a + b, 0);
      const book = [
        ['🌾 작물', CROP_ORDER.filter((id) => s.stats.harvested?.[id]).length, CROP_ORDER.length],
        ['🐟 물고기', FISH_ORDER.filter((id) => s.fishing.counts[id]).length, FISH_ORDER.length],
        ['⛏️ 광석', ORE_ORDER.filter((id) => s.mine.mined?.[id]).length, ORE_ORDER.length],
      ];
      body.innerHTML = `
        <div class="records">
          <div class="rec-name">${s.flags.endingSeen ? '🎩 초록마을 이장' : '🌱 귀농인'} <b>${s.player.name}</b> <small>${RANKS[s.rank].name}</small></div>
          <div class="rec-grid">
            <div><span>📅 귀농한 지</span><b>${s.time.day}일</b></div>
            <div><span>🌾 수확한 작물</span><b>${formatMoney(s.stats.totalHarvest)}개</b></div>
            <div><span>💰 누적 판매 금액</span><b>${formatMoney(s.stats.totalEarned)}원</b></div>
            <div><span>🎣 잡은 물고기</span><b>${formatMoney(s.fishing.caught)}마리</b></div>
            <div><span>🏆 가장 무거운 고기</span><b>${bestId ? `${FISH[bestId[0]].icon} ${FISH[bestId[0]].name} ${weightText(bestId[1])}` : '—'}</b></div>
            <div><span>⛏️ 캔 광석</span><b>${formatMoney(mined)}개</b></div>
          </div>
          <h4>📖 도감</h4>
          <div class="rec-book">${book.map(([n, a, b]) => `<div><span>${n}</span><i style="--p:${(a / b) * 100}%"></i><b>${a} / ${b}</b></div>`).join('')}</div>
        </div>`;
    });
  },
};
