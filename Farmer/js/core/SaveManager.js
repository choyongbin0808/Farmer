import { G, FARM_MAX, HOTBAR_SIZE, SAVE_VERSION, BAG_AREAS, createNewState, newPlot, newBag, newHotbar } from './Game.js';
import { GEAR, TOOLS, TOOL_ORDER, startingGear } from '../data/tools.js';
import { getItem } from '../data/items.js';
import { bagAreaOf } from '../systems/InventorySystem.js';

const KEY = 'farmer_save_v1';
const SETTINGS_KEY = 'farmer_settings';

export function hasSave() {
  return !!localStorage.getItem(KEY);
}

export function saveGame() {
  if (!G.state) return;
  const p = G.refs.player;
  if (p) {
    G.state.player.x = p.group.position.x;
    G.state.player.z = p.group.position.z;
  }
  localStorage.setItem(KEY, JSON.stringify(G.state));
}

function mergeDefaults(target, defaults) {
  for (const [k, v] of Object.entries(defaults)) {
    if (!(k in target)) target[k] = v;
    else if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') {
      mergeDefaults(target[k], v);
    }
  }
  return target;
}

/** 밭 격자 크기가 바뀐 예전 세이브(6x6 격자)의 밭 칸을 새 격자 위치로 옮긴다 */
function migrateFarm(data) {
  const farm = data.farm;
  if (!farm?.plots) return;
  const oldGrid = farm.grid ?? 6;
  if (oldGrid !== FARM_MAX) {
    const plots = Array.from({ length: FARM_MAX * FARM_MAX }, newPlot);
    farm.plots.forEach((p, i) => {
      const r = Math.floor(i / oldGrid), c = i % oldGrid;
      if (r < FARM_MAX && c < FARM_MAX) plots[r * FARM_MAX + c] = { ...newPlot(), ...p };
    });
    farm.plots = plots;
    farm.grid = FARM_MAX;
  }
  farm.size = Math.min(farm.size, FARM_MAX);
}

/** 예전 세이브(도구 종류별 강화 단계 1~5)를 장비 시스템(state.gear)으로 옮긴다 */
function migrateTools(data) {
  if (data.gear || !data.tools) return;
  // 예전 단계 → 새 장비 등급 (낡은·구리·철·금·무지개)
  const OLD_TIER = [null, 'old', 'copper', 'iron', 'gold', 'rainbow'];
  const gear = { equipped: {}, owned: [], enhance: {} };
  const rank = data.rank ?? 0;
  for (const kind of TOOL_ORDER) {
    const lv = Math.max(1, Math.min(5, data.tools[kind] || 1));
    for (let i = 1; i <= lv; i++) gear.owned.push(`tool_${kind}_${OLD_TIER[i]}`);
    const best = gear.owned.filter((id) => GEAR[id].kind === kind && GEAR[id].rank <= rank).sort((a, b) => GEAR[a].tier - GEAR[b].tier).pop();
    gear.equipped[kind] = best || startingGear(kind);
  }
  data.gear = gear;
  delete data.tools;
}

/** 예전 세이브의 하나짜리 가방(inventory 20칸)을 종류별 가방 칸(bag)으로 나눠 담는다 */
function migrateBag(data) {
  if (data.bag || !Array.isArray(data.inventory)) return;
  const bag = newBag();
  for (const s of data.inventory) {
    if (!s || !getItem(s.id)) continue;
    const list = bag[bagAreaOf(s.id)];
    const i = list.indexOf(null);
    if (i >= 0) list[i] = s;
  }
  data.bag = bag;
  delete data.inventory;
}

/** 예전 세이브의 핫바·가방에 있던 농기구 아이템 — 이제는 장착 장비가 자동으로 쓰이므로 치운다 */
const OLD_TOOL_ITEMS = Object.values(TOOLS).map((t) => t.itemId);

/** 핫바를 7칸으로 맞추고(넘치는 아이템은 가방으로), 핫바·가방의 농기구 아이템을 치운다 */
function migrateHotbar(data) {
  if (!Array.isArray(data.hotbar)) data.hotbar = newHotbar();
  const toBag = (s) => {
    const list = data.bag?.[bagAreaOf(s.id)];
    const i = list ? list.indexOf(null) : -1;
    if (i >= 0) list[i] = s;
  };
  const hotbar = data.hotbar.slice(0, HOTBAR_SIZE);
  while (hotbar.length < HOTBAR_SIZE) hotbar.push(null);
  data.hotbar.slice(HOTBAR_SIZE).forEach((s) => s && toBag(s));
  data.hotbar = hotbar;

  for (const list of [data.hotbar, ...Object.values(data.bag || {})]) {
    list.forEach((s, i) => { if (s && OLD_TOOL_ITEMS.includes(s.id)) list[i] = null; });
  }
}

/**
 * 가방 탭이 늘어남(채광 · 낚시 · 시설): 새 탭을 만들고, 제자리가 아닌 아이템을 알맞은 탭으로 옮긴다.
 * 예전 어망(fishing.creel)의 물고기는 '낚시' 칸으로, 배치 전 시설 수(facilityStock)는 '시설' 칸 아이템으로.
 */
function migrateBagAreas(data) {
  const bag = data.bag;
  if (!bag) return;
  const fresh = newBag();
  for (const a of BAG_AREAS) {
    if (!Array.isArray(bag[a])) bag[a] = fresh[a];
    while (bag[a].length < fresh[a].length) bag[a].push(null);
  }
  for (const a of BAG_AREAS) {
    bag[a].forEach((s, i) => {
      if (!s || !getItem(s.id)) return;
      const want = bagAreaOf(s.id);
      if (want === a) return;
      const j = bag[want].indexOf(null);
      if (j < 0) return;
      bag[want][j] = s;
      bag[a][i] = null;
    });
  }
  const creel = data.fishing?.creel;
  if (Array.isArray(creel)) {
    for (const c of creel) {
      const j = bag.fishing.indexOf(null);
      if (j < 0 || !getItem(c.id)) continue;
      bag.fishing[j] = { id: c.id, n: 1, w: c.w };
    }
    delete data.fishing.creel;
  }
  if (data.facilityStock) {
    for (const [kind, n] of Object.entries(data.facilityStock)) {
      const j = bag.facility.indexOf(null);
      if (n > 0 && j >= 0) bag.facility[j] = { id: `fac_${kind}`, n };
    }
    delete data.facilityStock;
  }
}

/**
 * 버전 1 → 2: 메인 퀘스트 15번째에 '새 마을회관'이 끼어들었다.
 * 이미 마지막 퀘스트까지 끝낸 세이브는 회관도 지은 것으로, 마지막 퀘스트를 하던 세이브는 회관 퀘스트부터 다시 받는다.
 */
function migrateQuests(data) {
  if ((data.version ?? 1) >= SAVE_VERSION || !data.quests) return;
  const q = data.quests;
  data.flags = data.flags || {};
  if (q.mainIndex >= 15) {
    q.mainIndex = 16;
    data.flags.hallFunded = true;
    data.flags.hallBuilt = true;
  } else if (q.mainIndex === 14) {
    q.main = null;
    if (q.tracked === 'main_15') q.tracked = null;
  }
  data.version = SAVE_VERSION;
}

/**
 * 도감 기록이 생기기 전 세이브: 지금 가진 것(창고·가방·핫바)으로 기록을 채워 시작한다.
 * 작물·광석은 가진 개수를 수확·채굴 수로, 잡아 본 물고기(최고 무게 기록)는 최소 1마리로.
 */
function migrateBook(data) {
  const owned = {};
  const count = (id, n) => { owned[id] = (owned[id] || 0) + n; };
  for (const [id, n] of Object.entries(data.storage || {})) count(id, n);
  for (const list of [data.hotbar || [], ...Object.values(data.bag || {})]) {
    for (const s of list) if (s) count(s.id, s.n || 1);
  }
  if (data.stats && !data.stats.harvested) {
    data.stats.harvested = {};
    for (const [id, n] of Object.entries(owned)) if (id.startsWith('crop_')) data.stats.harvested[id.slice(5)] = n;
  }
  if (data.mine && !data.mine.mined) {
    data.mine.mined = {};
    for (const [id, n] of Object.entries(owned)) if (id.startsWith('ore_')) data.mine.mined[id] = n;
  }
  if (data.fishing && !data.fishing.counts) {
    data.fishing.counts = {};
    for (const id of Object.keys(data.fishing.best || {})) data.fishing.counts[id] = 1;
  }
}

export function loadGame() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    migrateFarm(data);
    migrateTools(data);
    migrateBag(data);
    migrateBagAreas(data);
    migrateHotbar(data);
    migrateQuests(data);
    migrateBook(data);
    return mergeDefaults(data, createNewState(data.player?.name || '귀농인'));
  } catch (e) {
    console.warn('세이브 데이터를 불러오지 못했습니다.', e);
    return null;
  }
}

export function deleteSave() {
  localStorage.removeItem(KEY);
}

export function loadSettings() {
  try {
    Object.assign(G.settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
  } catch {
    /* 기본값 사용 */
  }
}

export function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(G.settings));
}
