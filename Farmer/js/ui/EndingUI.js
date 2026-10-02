import * as THREE from 'three';
import { G, RESIDENTS, formatMoney } from '../core/Game.js';
import { AudioManager } from '../core/AudioManager.js';
import { saveGame } from '../core/SaveManager.js';
import { NPCS, NPC_ORDER } from '../data/npcs.js';
import { RelationSystem } from '../systems/RelationSystem.js';
import { PLAZA } from '../world/World.js';
import { confetti, sparkle } from '../world/Effects.js';
import { DialogueUI } from './DialogueUI.js';
import { fade, showHUD } from './HUD.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const LINES = {
  grandma: '아이고, 우리 이장님! 할미가 맛있는 거 많이 해 줄게.',
  minji: '이장님이다! 이제 매일매일 같이 놀아 줘야 해!',
  sua: '처음 왔을 때가 엊그제 같은데… 정말 대단해. 축하해!',
  fisher: '허허, 느긋하게, 그래도 꾸준하게. 자네다운 결과일세.',
  smith: '…축하한다. 도구가 필요하면 언제든 와라.',
  shop: '이장님 취임 기념 세일이라도 해야겠네요! 축하드려요!',
};

function speaker(id) {
  return { name: NPCS[id].name, avatar: NPCS[id].avatar };
}

export async function playEnding(onFinish) {
  const player = G.refs.player;
  const cam = G.refs.cameraCtl;
  const name = G.state.player.name;
  G.mode = 'ending';
  await fade(true);
  showHUD(false);

  const center = new THREE.Vector3(PLAZA.x, 0, PLAZA.z + 3);
  player.setPosition(center.x, center.z);
  player.facing = 0;
  player.group.rotation.y = 0;
  const others = NPC_ORDER.filter((id) => id !== 'chief');
  const chief = G.refs.npcs.chief;
  chief.frozen = true;
  chief.group.position.set(center.x, 0, center.z + 2);
  chief.faceTo(center.x, center.z);
  others.forEach((id, i) => {
    const n = G.refs.npcs[id];
    n.frozen = true;
    n.path = null;
    const a = Math.PI * 0.15 + (i / (others.length - 1)) * Math.PI * 0.7;
    n.group.position.set(center.x + Math.cos(a) * 4.2, 0, center.z + Math.sin(a) * 4.2 - 0.5);
    n.faceTo(center.x, center.z);
  });
  cam.setOrbit(new THREE.Vector3(center.x, 0, center.z + 1), 15, 0.1);

  await wait(400);
  await fade(false);
  await DialogueUI.say(speaker('chief'), [
    '모두 모였구먼. 오늘은 우리 초록마을에 아주 특별한 날이라네.',
    `도시에 지쳐 이곳에 왔던 ${name} 씨가, 이제는 누구보다 이 마을을 아끼는 사람이 되었지.`,
    '이제 이 마을을 자네에게 맡기겠네.',
    `새로운 마을 이장, ${name}! 축하하네!`,
  ]);
  AudioManager.sfx('fanfare');
  confetti(center, 14);
  sparkle(player.pos);
  await wait(600);
  for (const id of others) await DialogueUI.say(speaker(id), [LINES[id]]);
  await DialogueUI.say({ name, avatar: '🧑‍🌾' }, ['모두 정말 고마워요. 앞으로도 이 마을에서 함께 행복하게 지내요!']);
  DialogueUI.hide();
  await wait(800);

  const s = G.state;
  const el = document.getElementById('ending');
  el.innerHTML = `
    <div class="ending-card panel">
      <div class="end-badge">🎉</div>
      <h1>축하합니다!</h1>
      <h2>새로운 마을 이장 <b>${name}</b></h2>
      <p>도시에 지친 귀농인이 초록마을의 이장이 되었습니다.</p>
      <div class="end-stats">
        <div><span>플레이 일수</span><b>${s.time.day}일</b></div>
        <div><span>총 수확량</span><b>${s.stats.totalHarvest.toLocaleString()}개</b></div>
        <div><span>총 수익</span><b>${formatMoney(s.stats.totalEarned)}원</b></div>
        <div><span>주민 친밀도</span><b>${RESIDENTS.map((id) => `${NPCS[id].avatar}${'❤️'.repeat(RelationSystem.hearts(id))}`).join(' ')}</b></div>
      </div>
      <div class="credits">FARMER — 3D 힐링 농사 RPG<br>기획 · 조용빈 (3718)</div>
      <button class="btn primary big" id="btn-continue">🌾 계속 농사짓기</button>
    </div>`;
  el.classList.remove('hidden');
  s.flags.endingSeen = true;
  saveGame();

  await new Promise((r) => { document.getElementById('btn-continue').onclick = r; });
  AudioManager.sfx('click');
  await fade(true);
  el.classList.add('hidden');
  for (const id of NPC_ORDER) {
    G.refs.npcs[id].frozen = false;
    G.refs.npcs[id].resetHome();
  }
  cam.setFollow();
  G.mode = 'play';
  showHUD(true);
  onFinish?.();
  await fade(false);
}
