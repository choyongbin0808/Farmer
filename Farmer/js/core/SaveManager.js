import { G, FARM_MAX, createNewState, newPlot, newBag } from './Game.js';
import { GEAR, TOOL_ORDER, startingGear } from '../data/tools.js';
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

export function loadGame() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    migrateFarm(data);
    migrateTools(data);
    migrateBag(data);
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
