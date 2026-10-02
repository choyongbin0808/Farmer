import { G, FARM_MAX, createNewState, newPlot } from './Game.js';

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

export function loadGame() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    migrateFarm(data);
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
