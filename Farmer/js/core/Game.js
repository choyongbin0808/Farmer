export const FARM_MAX = 8;
export const MONEY_CHEAT = 10_000_000_000;
export const RESIDENTS = ['grandma', 'minji', 'sua', 'fisher', 'smith'];
export const DAY_START = 6 * 60;
export const DAY_END = 26 * 60; // 다음 날 02:00
export const SLEEP_START = 18 * 60; // 이 시각(밤)부터 잠자기 가능
export const GAME_MIN_PER_SEC = 2;

export const G = {
  state: null,
  mode: 'loading', // loading | title | play | ending
  ui: {
    held: { area: 'hotbar', index: 0 },
    modal: null,
    dialogue: false,
    fading: false,
  },
  refs: {}, // player, npcs, plots, camera ...
  settings: { bgm: 0.5, sfx: 0.7 },
};

export function newPlot() {
  return { state: 'empty', cropId: null, daysGrown: 0, watered: false, plantedDay: 0 };
}

export function createNewState(name) {
  const plots = Array.from({ length: FARM_MAX * FARM_MAX }, newPlot);
  return {
    version: 1,
    player: {
      name, x: -14, z: 18, money: 500, stamina: 100, lastPlantAt: -9999,
      outfit: { hat: null, top: null, bottom: null },
    },
    ownedClothes: [],
    time: { day: 1, minutes: DAY_START, weather: 'sunny' },
    farm: { size: 3, grid: FARM_MAX, plots },
    inventory: Array(20).fill(null),
    hotbar: [
      { id: 'tool_hoe', n: 1 },
      { id: 'tool_can', n: 1 },
      { id: 'tool_sickle', n: 1 },
      { id: 'seed_lettuce', n: 10 },
      null,
    ],
    storage: {},
    tools: { hoe: 1, can: 1, sickle: 1 },
    quests: { mainIndex: 0, main: null, subs: {}, tracked: null },
    relations: { grandma: 0, minji: 0, sua: 0, fisher: 0, smith: 0 },
    talkedToday: {},
    rank: 0,
    stats: { totalHarvest: 0, totalEarned: 0, todayHarvest: 0, totalSold: 0 },
    flags: {
      endingSeen: false, introDone: false, watermelon: false, tea: false, discount: false,
      deco_drawing: false, deco_rod: false,
    },
  };
}

export function absMinutes() {
  return G.state.time.day * 1440 + G.state.time.minutes;
}

export function isUIBlocking() {
  return !!G.ui.modal || G.ui.dialogue || G.ui.fading || G.mode !== 'play';
}

export function formatMoney(n) {
  return Math.floor(n).toLocaleString('ko-KR');
}
