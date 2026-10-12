import { G, DAY_START, GAME_MIN_PER_SEC, SLEEP_START } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { AudioManager } from '../core/AudioManager.js';
import { saveGame } from '../core/SaveManager.js';
import { rollWeather, setWeather, WEATHERS } from '../world/Weather.js';
import { HOUSE_WAKE } from '../world/Interiors.js';
import { FarmSystem } from './FarmSystem.js';
import { StaminaSystem } from './StaminaSystem.js';
import { MiningSystem } from './MiningSystem.js';
import { QuestSystem } from './QuestSystem.js';
import { fade, banner, toast } from '../ui/HUD.js';

const pad = (n) => String(n).padStart(2, '0');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// 다음 날 아침 6시 (그날 0시 기준 분)
const NEXT_MORNING = 24 * 60 + DAY_START;

export const TimeSystem = {
  sleeping: false,

  update(dt) {
    if (this.sleeping) return;
    const t = G.state.time;
    // 저절로 잠들지 않는다: 밤을 새우면 그 자리에서 다음 날 아침 6시가 되고, 체력은 채워지지 않는다
    const add = Math.min(dt * GAME_MIN_PER_SEC, NEXT_MORNING - t.minutes);
    t.minutes += add;
    StaminaSystem.tick(add);
    // 물 준 작물은 시간이 흐르는 만큼 자란다
    FarmSystem.tick(add);
    if (t.minutes >= NEXT_MORNING) this.stayUp();
  },

  /** 밤을 새워 아침 6시가 됐을 때: 장소 · 체력은 그대로, 날짜만 넘어간다 */
  stayUp() {
    const hallDone = this.newDay({ rest: false });
    AudioManager.sfx('chime');
    const w = WEATHERS[G.state.time.weather];
    const rain = G.state.time.weather === 'rain' ? ' · 비가 와서 밭에 물이 저절로 뿌려졌어요' : '';
    banner(`☀️ ${G.state.time.day}일차 아침`, `${w.icon} 오늘의 날씨: ${w.name}${rain} · 밤을 새워서 체력은 회복되지 않았어요`);
    if (hallDone) {
      AudioManager.sfx('fanfare');
      banner('🏛️ 새 마을회관 완공!', '이장님께 가서 완료 보고를 해 보세요');
    }
  },

  clock() {
    const m = Math.floor(G.state.time.minutes) % 1440;
    const h = Math.floor(m / 60);
    const ampm = h < 12 ? '오전' : '오후';
    const h12 = h % 12 || 12;
    return `${ampm} ${pad(h12)}:${pad(m % 60)}`;
  },

  canSleep() {
    return G.state.time.minutes >= SLEEP_START;
  },

  /** 잠잘 수 있을 때까지 남은 게임 시간(분) */
  minutesUntilSleep() {
    return Math.max(0, Math.ceil(SLEEP_START - G.state.time.minutes));
  },

  /** 침대에서 자기: 다음 날 아침 집에서 눈을 뜨고 체력이 모두 회복된다 */
  async sleep() {
    if (this.sleeping) return;
    if (!this.canSleep()) return toast('아직 잘 시간이 아니에요. 밤(오후 6시)이 되면 잘 수 있어요 🌙', 'warn');
    this.sleeping = true;
    AudioManager.sfx('sleep');
    G.refs.cancelActivities?.();
    await fade(true);
    // 어디에 있었든 우리 집 침대 옆에서 눈을 뜬다
    MiningSystem.moveTo('house', HOUSE_WAKE, 0);
    const hallDone = this.newDay();
    await wait(700);
    await fade(false);
    const w = WEATHERS[G.state.time.weather];
    const rain = G.state.time.weather === 'rain' ? ' · 비가 와서 밭에 물이 저절로 뿌려졌어요' : '';
    banner(`☀️ ${G.state.time.day}일차 아침`, `${w.icon} 오늘의 날씨: ${w.name}${rain} · 체력이 모두 회복됐어요`);
    if (hallDone) {
      AudioManager.sfx('fanfare');
      banner('🏛️ 새 마을회관 완공!', '이장님께 가서 완료 보고를 해 보세요');
    }
    this.sleeping = false;
  },

  /** rest: 침대에서 잤으면 체력 회복 (밤을 새워 날이 바뀐 거면 그대로) */
  newDay({ rest = true } = {}) {
    const s = G.state;
    // 잠든 시각 → 다음 날 아침 6시까지의 밤 시간만큼 물 준 작물이 자란다 (밤을 새웠으면 이미 자라서 0)
    const night = Math.max(0, NEXT_MORNING - s.time.minutes);
    s.time.day++;
    s.time.minutes = DAY_START;
    FarmSystem.growAll(night);
    s.time.weather = rollWeather();
    if (s.time.weather === 'rain') FarmSystem.waterAllByRain();
    setWeather(s.time.weather, true);
    if (rest) StaminaSystem.fill();
    s.stats.todayHarvest = 0;
    s.talkedToday = {};
    FarmSystem.refreshAll();
    MiningSystem.newDay();
    const hallDone = QuestSystem.finishHallOvernight();
    EventBus.emit('newDay');
    saveGame();
    return hallDone;
  },
};
