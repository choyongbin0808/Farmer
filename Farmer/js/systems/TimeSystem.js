import { G, DAY_START, DAY_END, GAME_MIN_PER_SEC, SLEEP_START } from '../core/Game.js';
import { EventBus } from '../core/EventBus.js';
import { AudioManager } from '../core/AudioManager.js';
import { saveGame } from '../core/SaveManager.js';
import { rollWeather, setWeather, WEATHERS } from '../world/Weather.js';
import { BUILDINGS } from '../world/World.js';
import { FarmSystem } from './FarmSystem.js';
import { StaminaSystem } from './StaminaSystem.js';
import { MiningSystem } from './MiningSystem.js';
import { QuestSystem } from './QuestSystem.js';
import { fade, banner, toast } from '../ui/HUD.js';

const pad = (n) => String(n).padStart(2, '0');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export const TimeSystem = {
  sleeping: false,

  update(dt) {
    const t = G.state.time;
    const add = dt * GAME_MIN_PER_SEC;
    t.minutes += add;
    StaminaSystem.tick(add);
    if (t.minutes >= DAY_END) {
      t.minutes = DAY_END;
      this.sleep(true);
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

  async sleep(auto = false) {
    if (this.sleeping) return;
    if (!auto && !this.canSleep()) return toast('아직 잘 시간이 아니에요. 밤(오후 6시)이 되면 잘 수 있어요 🌙', 'warn');
    this.sleeping = true;
    AudioManager.sfx('sleep');
    if (auto) toast('너무 늦었어요… 집으로 돌아가 잠이 들었어요 💤');
    G.refs.cancelActivities?.();
    await fade(true);
    const h = BUILDINGS.house;
    // 광산에 있었어도 집에서 눈을 뜬다
    MiningSystem.moveTo('village', { x: h.ix + 0.6, z: h.iz }, Math.PI / 2);
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

  newDay() {
    const s = G.state;
    s.time.day++;
    s.time.minutes = DAY_START;
    FarmSystem.growAll();
    s.time.weather = rollWeather();
    if (s.time.weather === 'rain') FarmSystem.waterAllByRain();
    setWeather(s.time.weather, true);
    StaminaSystem.fill();
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
