export const FARM_MAX = 8;
/** 치트(master / farmer)로 받는 돈: 10억 */
export const MONEY_CHEAT = 1_000_000_000;
export const SAVE_VERSION = 2;
export const RESIDENTS = ['grandma', 'minji', 'sua', 'fisher', 'smith'];
export const DAY_START = 6 * 60;
export const DAY_END = 26 * 60; // 다음 날 02:00
export const SLEEP_START = 18 * 60; // 이 시각(밤)부터 잠자기 가능
export const GAME_MIN_PER_SEC = 2;
/**
 * 가방 칸: 탭(종류)마다 따로 — seed 씨앗·모종, crop 작물, food 음식, misc 물품(재료·특별 아이템),
 * mining 채광(곡괭이·광석), fishing 낚시(낚싯대·물고기·게), facility 시설(약탕기·육묘장)
 */
export const BAG_AREAS = ['seed', 'crop', 'food', 'misc', 'mining', 'fishing', 'facility'];
export const BAG_SIZE = 20;
/** 칸 수가 다른 탭 (물고기는 무게가 제각각이라 한 칸에 한 마리씩) */
export const BAG_SIZES = { fishing: 40 };
/** 핫바 칸 수. 농기구는 핫바에 넣지 않는다 — 가방에서 장착한 장비가 밭 작업에 자동으로 쓰인다 */
export const HOTBAR_SIZE = 7;

export function newHotbar() {
  return Array(HOTBAR_SIZE).fill(null);
}

export function newBag() {
  return Object.fromEntries(BAG_AREAS.map((a) => [a, Array(BAG_SIZES[a] ?? BAG_SIZE).fill(null)]));
}

export const G = {
  state: null,
  mode: 'loading', // loading | title | play | ending
  ui: {
    held: { area: 'hotbar', index: 0 },
    modal: null,
    envOverride: null, // 엔딩 연출 중 하늘·날씨를 잠시 바꿀 때 { minutes, weather }
    dialogue: false,
    fading: false,
  },
  refs: {}, // player, npcs, plots, camera ...
  settings: { bgm: 0.5, sfx: 0.7 },
};

export function newPlot() {
  return { state: 'empty', cropId: null, seedling: false, daysGrown: 0, watered: false, plantedDay: 0 };
}

export function createNewState(name) {
  const plots = Array.from({ length: FARM_MAX * FARM_MAX }, newPlot);
  return {
    version: SAVE_VERSION,
    player: {
      name, x: -14, z: 18, money: 500, stamina: 100, lastPlantAt: -9999, zone: 'village', mineFloor: 0,
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
    // harvested: 작물별 누적 수확 수 (도감)
    stats: { totalHarvest: 0, totalEarned: 0, todayHarvest: 0, totalSold: 0, harvested: {} },
    flags: {
      endingSeen: false, introDone: false, watermelon: false, tea: false, discount: false,
      deco_drawing: false, deco_rod: false,
      mine: false, gotPickaxe: false, hallFunded: false, hallBuilt: false,
    },
    // 낚시: 종류별 최고 무게 · 종류별 잡은 수(도감), 전체 잡은 수 (잡은 고기는 가방 '낚시' 칸에 { id, n: 1, w } 로 담긴다)
    fishing: { best: {}, counts: {}, caught: 0 },
    // 광산: 층마다 광맥 자리 [{ ore, respawnAt }] (null = 아직 만들지 않음), 광석별 캔 수(도감)
    mine: { floors: null, mined: {} },
    // 배치한 시설: { kind, x, z, rot, job: { out, n, doneAt } | null } (배치 전 시설은 가방 '시설' 칸의 아이템)
    facilities: [],
  };
}

export function absMinutes() {
  return G.state.time.day * 1440 + G.state.time.minutes;
}

export function isUIBlocking() {
  return !!G.ui.modal || G.ui.dialogue || G.ui.fading || G.mode !== 'play';
}

/** 지금 플레이어가 있는 곳: 'village' | 'mine' */
export function currentZone() {
  return G.state?.player.zone ?? 'village';
}

/** 광산 안이면 지금 층 (0 = 1층 입구) */
export function currentMineFloor() {
  return currentZone() === 'mine' ? (G.state.player.mineFloor ?? 0) : 0;
}

export function formatMoney(n) {
  return Math.floor(n).toLocaleString('ko-KR');
}
