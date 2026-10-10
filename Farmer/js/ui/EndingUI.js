import * as THREE from 'three';
import { G, RESIDENTS, formatMoney, currentZone } from '../core/Game.js';
import { AudioManager } from '../core/AudioManager.js';
import { saveGame } from '../core/SaveManager.js';
import { NPCS, NPC_ORDER } from '../data/npcs.js';
import { RelationSystem } from '../systems/RelationSystem.js';
import { MiningSystem } from '../systems/MiningSystem.js';
import { PLAZA, setFestival, updateDecorations } from '../world/World.js';
import { setWeather } from '../world/Weather.js';
import { confetti, sparkle } from '../world/Effects.js';
import { DialogueUI } from './DialogueUI.js';
import { fade, showHUD } from './HUD.js';

/**
 * 엔딩 — 예고편처럼 연출되는 밤의 광장
 * 민지가 뛰노는 광장의 큰 나무에 꼬마전구를 달고, 마을 사람 모두가 모인 가운데
 * 박 이장이 귀농인을 새 마을 이장으로 인정한다 → 모두 박수 → "게임을 클리어해 주셔서 감사합니다"
 * 게임 데이터는 그대로 두고, 끝나면 이어서 플레이한다.
 */

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const NIGHT = 21.4 * 60;

const LINES = {
  minji: '와아! 우리 이장님이다! 이제 매일매일 같이 놀아 줘야 해!',
  grandma: '아이고, 우리 이장님! 할미가 맛있는 거 많이 해 줄게.',
  sua: '처음 왔을 때가 엊그제 같은데… 정말 대단해. 축하해!',
  fisher: '허허, 느긋하게, 그래도 꾸준하게. 자네다운 결과일세.',
  smith: '…축하한다. 도구가 필요하면 언제든 와라.',
  shop: '이장님 취임 기념 세일이라도 해야겠네요! 축하드려요!',
  yun: '어머머, 우리 이웃이 이장님이 됐네! 오늘은 잔치예요!',
  han: '허허, 광산에서 땀 흘리던 그 친구가 이장이라니! 축하하네!',
  dolsoe: '이장님 취임 기념! 다음 곡괭이는 반짝반짝 닦아 드릴게요!',
};
// 민지를 맨 앞에 — 늘 광장에서 뛰노는 아이라 오늘의 주인공 자리
const CROWD = ['minji', 'grandma', 'sua', 'fisher', 'smith', 'shop', 'yun', 'han', 'dolsoe'];

// 나무 앞: 이장(나무를 등지고) ↔ 귀농인, 양옆으로 주민들
const TREE = { x: PLAZA.x, z: PLAZA.z };
const CENTER = { x: PLAZA.x, z: PLAZA.z + 4 };
const CHIEF_AT = { x: PLAZA.x, z: PLAZA.z + 3 };
const PLAYER_AT = { x: PLAZA.x, z: PLAZA.z + 5.1 };
const SLOTS = [55, 125, 28, 152, 0, 180, -28, 208, -55].map((d) => (d * Math.PI) / 180);

const $ = (id) => document.getElementById(id);

// ───────── 건너뛰기 ─────────
const SKIP = Symbol('skip');
let skipCtl = null;

/** 연출 중이면 건너뛴다 (버튼 · Esc). 처음 보는 엔딩에서는 버튼이 없다 */
export function skipEnding() {
  if (!skipCtl || !$('ending-skip')) return false;
  AudioManager.sfx('click');
  skipCtl();
  return true;
}

function showSkipButton(on) {
  $('ending-skip')?.remove();
  if (!on) return;
  const b = document.createElement('button');
  b.id = 'ending-skip';
  b.className = 'btn small';
  b.textContent = '건너뛰기 ⏭';
  b.title = '건너뛰기 (Esc)';
  b.onclick = (e) => {
    e.stopPropagation();
    skipEnding();
  };
  document.getElementById('app').appendChild(b);
}

function speaker(id) {
  return { name: `${NPCS[id].name} · ${NPCS[id].role}`, avatar: NPCS[id].avatar };
}

/** 화면 위아래 검은 띠 (영화처럼) */
function cinema(on) {
  $('cinema').classList.toggle('hidden', !on);
  requestAnimationFrame(() => $('cinema').classList.toggle('on', on));
}

/** 화면 가운데 자막 (big 이면 크게) */
async function caption(text, ms, big = false) {
  const el = $('cinema').querySelector('.caption');
  el.className = `caption ${big ? 'big' : ''}`;
  el.innerHTML = text;
  el.classList.add('show');
  await wait(ms);
  el.classList.remove('show');
  await wait(700);
}

/** 대상 앞에서 얼굴을 비추는 카메라 */
function shotOn(ent, { dist = 3, side = 0.8, height = 1.9, lookY = 1.4 } = {}) {
  const f = ent.facing;
  const fx = Math.sin(f), fz = Math.cos(f);
  const s = ent.group?.scale.x ?? 1;
  const p = ent.pos;
  G.refs.cameraCtl.setShot(
    { x: p.x + fx * dist + fz * side, y: height * Math.max(0.8, s), z: p.z + fz * dist - fx * side },
    { x: p.x, y: lookY * s, z: p.z },
    { speed: 2.4 },
  );
}

function crowd(action, except = null) {
  for (const id of CROWD) if (id !== except) G.refs.npcs[id].action = action;
}

/** 귀농인 자세 */
const BOW = { bx: 0.5, by: -0.05, a0x: 0.25, a1x: 0.25 };
const WAVE = () => ({ a1x: -2.7, in1: Math.sin(performance.now() / 100) * 0.35 });
const CLAP = () => {
  const k = 0.4 + 0.3 * Math.abs(Math.sin(performance.now() / 75));
  return { a0x: -1.25, a1x: -1.25, in0: k, in1: k };
};

function arrange() {
  const player = G.refs.player;
  player.setPosition(PLAYER_AT.x, PLAYER_AT.z);
  player.faceTo(CHIEF_AT.x, CHIEF_AT.z);
  player.group.rotation.y = player.facing;
  const chief = G.refs.npcs.chief;
  chief.frozen = true;
  chief.path = null;
  chief.group.position.set(CHIEF_AT.x, 0, CHIEF_AT.z);
  chief.faceTo(PLAYER_AT.x, PLAYER_AT.z);
  chief.group.rotation.y = chief.facing;
  CROWD.forEach((id, i) => {
    const n = G.refs.npcs[id];
    const a = SLOTS[i % SLOTS.length];
    n.frozen = true;
    n.path = null;
    n.action = null;
    n.group.position.set(CENTER.x + Math.cos(a) * 3, 0, CENTER.z + Math.sin(a) * 3);
    n.faceTo(CENTER.x, CENTER.z);
    n.group.rotation.y = n.facing;
  });
}

function endCard(s, name) {
  return `
    <div class="ending-card panel">
      <div class="end-badge">🎩</div>
      <h1>게임을 클리어해 주셔서<br>감사합니다!</h1>
      <h2>새로운 마을 이장 <b>${name}</b></h2>
      <p>도시에 지친 귀농인이 초록마을의 이장이 되었습니다.</p>
      <div class="end-stats">
        <div><span>플레이 일수</span><b>${s.time.day}일</b></div>
        <div><span>총 수확량</span><b>${s.stats.totalHarvest.toLocaleString()}개</b></div>
        <div><span>작물 판매 수익</span><b>${formatMoney(s.stats.totalEarned)}원</b></div>
        <div><span>낚은 물고기</span><b>${(s.fishing?.caught ?? 0).toLocaleString()}마리</b></div>
        <div><span>주민 친밀도</span><b>${RESIDENTS.map((id) => `${NPCS[id].avatar}${'❤️'.repeat(RelationSystem.hearts(id))}`).join(' ')}</b></div>
      </div>
      <div class="credits">FARMER — 3D 힐링 농사 RPG</div>
      <div class="end-note">💾 진행 상황은 그대로 저장돼 있어요. 남은 농사 · 낚시 · 광산 · 시설을 마음껏 즐겨 주세요!</div>
      <button class="btn primary big" id="btn-continue">🌾 계속 플레이하기</button>
    </div>`;
}

export async function playEnding(onFinish) {
  const player = G.refs.player;
  const cam = G.refs.cameraCtl;
  const s = G.state;
  const name = s.player.name;
  G.refs.cancelActivities?.();
  G.mode = 'ending';
  await fade(true);
  showHUD(false);
  if (currentZone() !== 'village') MiningSystem.moveTo('village', PLAYER_AT);

  // 밤하늘 · 맑은 날씨 · 나무에 꼬마전구
  G.ui.envOverride = { minutes: NIGHT, weather: 'sunny', dim: 0.5 };
  setWeather('sunny', true);
  setFestival(true, true);
  arrange();
  cinema(true);
  cam.setOrbit(new THREE.Vector3(TREE.x, 1.5, TREE.z + 2), 28, 0.07);
  cam.yaw = -0.5;
  cam.target.set(TREE.x, 1.5, TREE.z + 2);
  await wait(500);
  await fade(false);

  // 한 번 본 엔딩이면 오른쪽 위 '건너뛰기' (Esc 로도) → 바로 감사 카드로
  let skipReject;
  const skipP = new Promise((_, rej) => { skipReject = rej; });
  skipP.catch(() => {});
  const g = (p) => Promise.race([p, skipP]);
  skipCtl = () => skipReject(SKIP);
  showSkipButton(s.flags.endingSeen);

  try {
    // ① 오프닝 — 불 켜진 나무를 천천히 돌며
    AudioManager.sfx('chime');
    await g(caption('그날 밤, 초록마을 광장', 2800));
    await g(caption('민지가 뛰놀던 큰 나무에 하나둘 불이 켜지고<br>마을 사람들이 모두 모였습니다', 3400));

    // ② 이장과 귀농인 — 최종 장비(넓은 모자)를 쓴 귀농인이 이장을 가리지 않도록
    //    두 사람을 잇는 선에서 비켜난 옆쪽에서 비춘다
    cam.setShot({ x: 5.2, y: 2.4, z: PLAYER_AT.z + 0.6 }, { x: 0, y: 1.5, z: CENTER.z }, { speed: 1.2 });
    await g(wait(1600));
    cam.setShot({ x: 1.4, y: 1.95, z: CHIEF_AT.z + 2.0 }, { x: CHIEF_AT.x, y: 1.45, z: CHIEF_AT.z }, { speed: 2.4 });
    await g(DialogueUI.say(speaker('chief'), [
      '모두 모였구먼. 오늘은 우리 초록마을에 아주 특별한 날이라네.',
      `도시에 지쳐 이곳에 왔던 ${name} 씨가, 이제는 누구보다 이 마을을 아끼는 사람이 되었지.`,
    ]));
    cam.setShot({ x: -1.3, y: 1.95, z: PLAYER_AT.z - 2.0 }, { x: PLAYER_AT.x, y: 1.5, z: PLAYER_AT.z }, { speed: 2.4 });
    await g(DialogueUI.say(speaker('chief'), [
      '밭을 일구고, 이웃을 돕고, 새 마을회관까지 지어 주었네.',
      '그러니 이제 이 마을을… 자네에게 맡기겠네.',
    ]));

    // ③ 인정 — 모두 박수 (비스듬히 높은 곳에서 두 사람이 모두 보이게)
    cam.setShot({ x: 4.5, y: 6.4, z: PLAYER_AT.z + 7.5 }, { x: 0, y: 1.6, z: CENTER.z - 0.6 }, { speed: 1.6 });
    player.stance = BOW;
    await g(DialogueUI.say(speaker('chief'), [`새로운 마을 이장, ${name}! 내 자네를 이 마을의 이장으로 인정하네!`]));
    DialogueUI.hide();
    player.stance = WAVE;
    crowd('clap');
    G.refs.npcs.chief.action = 'clap';
    G.refs.npcs.minji.action = 'cheer';
    AudioManager.sfx('applause');
    AudioManager.sfx('fanfare');
    setTimeout(() => { if (G.mode === 'ending') AudioManager.sfx('applause'); }, 2200);
    confetti({ x: CENTER.x, z: CENTER.z }, 16);
    sparkle(player.pos);
    await g(caption(`👏 새로운 마을 이장 · ${name} 👏`, 3600, true));

    // ④ 주민 한마디씩 (말하는 사람은 손을 흔들고, 나머지는 계속 박수)
    player.stance = CLAP;
    for (const id of CROWD) {
      const n = G.refs.npcs[id];
      n.action = id === 'minji' ? 'cheer' : 'wave';
      shotOn(n, { dist: 2.8, side: 0.6 });
      await g(DialogueUI.say(speaker(id), [LINES[id]]));
      n.action = 'clap';
    }
    cam.setShot({ x: 1.3, y: 1.95, z: PLAYER_AT.z - 2.0 }, { x: PLAYER_AT.x, y: 1.5, z: PLAYER_AT.z }, { speed: 2.4 });
    player.stance = WAVE;
    await g(DialogueUI.say({ name, avatar: '🧑‍🌾' }, ['모두 정말 고마워요. 앞으로도 이 마을에서 함께 행복하게 지내요!']));
    DialogueUI.hide();

    // ⑤ 마지막 — 다시 박수, 카메라가 천천히 물러나며
    player.stance = CLAP;
    crowd('clap');
    G.refs.npcs.minji.action = 'cheer';
    AudioManager.sfx('applause');
    confetti({ x: CENTER.x, z: CENTER.z }, 14);
    cam.setOrbit(new THREE.Vector3(TREE.x, 2, TREE.z + 2.5), 26, 0.12);
    cam.yaw = 0.25;
    await g(caption('🎉 게임을 클리어해 주셔서 감사합니다! 🎉', 4200, true));
  } catch (e) {
    if (e !== SKIP) throw e;
    // 건너뛰기: 대사·자막을 끊고 모두 박수 치는 마지막 장면으로
    DialogueUI.abort();
    $('cinema').querySelector('.caption').classList.remove('show');
    player.stance = CLAP;
    crowd('clap');
    G.refs.npcs.minji.action = 'cheer';
    cam.setOrbit(new THREE.Vector3(TREE.x, 2, TREE.z + 2.5), 26, 0.12);
    cam.yaw = 0.25;
  }
  skipCtl = null;
  showSkipButton(false);

  // ⑥ 감사 카드 — 데이터는 초기화하지 않는다
  s.flags.endingSeen = true;
  saveGame();
  const el = $('ending');
  el.innerHTML = endCard(s, name);
  el.classList.remove('hidden');
  await new Promise((r) => { $('btn-continue').onclick = r; });
  AudioManager.sfx('click');

  await fade(true);
  el.classList.add('hidden');
  cinema(false);
  G.ui.envOverride = null;
  setWeather(s.time.weather, true);
  setFestival(true, false); // 꼬마전구는 남겨 두고, 이제 밤에만 켜진다
  updateDecorations(s.flags);
  player.stance = null;
  for (const id of NPC_ORDER) {
    const n = G.refs.npcs[id];
    n.action = null;
    n.frozen = false;
    n.resetHome();
  }
  player.setPosition(PLAYER_AT.x, PLAYER_AT.z + 1.5);
  cam.setFollow();
  cam.yaw = 0;
  cam.target.copy(player.pos);
  G.mode = 'play';
  showHUD(true);
  onFinish?.();
  await fade(false);
}
