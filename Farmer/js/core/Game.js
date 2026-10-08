export const FARM_MAX = 8;
export const MONEY_CHEAT = 10_000_000_000;
export const RESIDENTS = ['grandma', 'minji', 'sua', 'fisher', 'smith'];
export const DAY_START = 6 * 60;
export const DAY_END = 26 * 60; // 다음 날 02:00
export const SLEEP_START = 18 * 60; // 이 시각(밤)부터 잠자기 가능
export const GAME_MIN_PER_SEC = 2;
/** 가방 칸: 탭(종류)마다 따로 — seed 씨앗, crop 작물, food 음식, misc 도구·특별 아이템 */
export const BAG_AREAS = ['seed', 'crop', 'food', 'misc'];
export const BAG_SIZE = 20;
/** 핫바 칸 수. 농기구는 핫바에 넣지 않는다 — 가방에서 장착한 장비가 밭 작업에 자동으로 쓰인다 */
export const HOTBAR_SIZE = 7;

export function newHotbar() {
  return Array(HOTBAR_SIZE).fill(null);
}

export function newBag() {
  return Object.fromEntries(BAG_AREAS.map((a) => [a, Array(BAG_SIZE).fill(null)]));
}

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
    bag: newBag(),
    hotbar: Object.assign(newHotbar(), { 0: { id: 'seed_lettuce', n: 10 } }),
    storage: {},
    // 농기구 장비: 종류별 장착 중인 장비 id, 보유 장비 목록, 장비별 강화 단계
    gear: {
      equipped: { hoe: 'tool_hoe_old', can: 'tool_can_old', sickle: 'tool_sickle_old' },
      owned: ['tool_hoe_old', 'tool_can_old', 'tool_sickle_old'],
      enhance: {},
    },
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
