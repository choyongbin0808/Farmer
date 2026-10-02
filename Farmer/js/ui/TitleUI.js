import { AudioManager } from '../core/AudioManager.js';

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const OPENING = [
  '매일 같은 지하철, 같은 사무실, 같은 야근….',
  '도시의 소음에 지친 어느 날, 나는 짐을 쌌다.',
  '할아버지가 남겨 주신 시골집이 있는 작은 마을, \'초록마을\'로.',
  '남은 건 낡은 집과 밭 하나뿐이지만… 이곳에서 다시 시작해 보려 한다.',
];

export const TitleUI = {
  show({ hasSave, onNew, onContinue, onSettings }) {
    const el = $('title-screen');
    el.classList.remove('hidden');
    el.innerHTML = `
      <div class="title-card">
        <div class="logo">🌱 FARMER</div>
        <div class="subtitle">도시에 지친 귀농인이 마을 이장이 되기까지</div>
        <div class="genre">3D 힐링 농사 RPG</div>
        <div class="title-buttons">
          <button class="btn primary big" data-act="new">새 게임</button>
          <button class="btn big" data-act="continue" ${hasSave ? '' : 'disabled'}>이어하기</button>
          <button class="btn big" data-act="settings">설정</button>
        </div>
        <div class="title-hint">WASD 이동 · 클릭 상호작용 · 1~5 핫바</div>
      </div>`;
    el.querySelector('[data-act="new"]').onclick = () => {
      AudioManager.resume();
      AudioManager.sfx('click');
      if (hasSave && !confirm('저장된 게임이 있어요. 새로 시작하면 기존 기록이 지워져요. 계속할까요?')) return;
      this.askName(onNew);
    };
    el.querySelector('[data-act="continue"]').onclick = () => {
      AudioManager.resume();
      AudioManager.sfx('click');
      this.hide();
      onContinue();
    };
    el.querySelector('[data-act="settings"]').onclick = () => {
      AudioManager.resume();
      onSettings();
    };
  },

  askName(onNew) {
    const el = $('title-screen');
    el.innerHTML = `
      <div class="title-card name-card">
        <h2>당신의 이름은?</h2>
        <input id="name-input" maxlength="8" placeholder="이름 (최대 8자)" value="귀농인" autocomplete="off">
        <div class="title-buttons row">
          <button class="btn primary big" data-act="ok">시작하기</button>
        </div>
      </div>`;
    const input = $('name-input');
    input.focus();
    input.select();
    const go = () => {
      const name = input.value.trim() || '귀농인';
      AudioManager.sfx('click');
      this.opening(name, onNew);
    };
    el.querySelector('[data-act="ok"]').onclick = go;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  },

  async opening(name, onNew) {
    const el = $('title-screen');
    el.innerHTML = `<div class="opening"><p id="opening-text"></p><small>클릭하면 넘어가요</small></div>`;
    el.classList.add('dark');
    const p = $('opening-text');
    let skip = false;
    el.onclick = () => { skip = true; };
    for (const line of OPENING) {
      p.classList.remove('show');
      await wait(250);
      p.textContent = line;
      p.classList.add('show');
      skip = false;
      for (let t = 0; t < 2600 && !skip; t += 50) await wait(50);
    }
    el.onclick = null;
    el.classList.remove('dark');
    this.hide();
    onNew(name);
  },

  hide() {
    const el = $('title-screen');
    el.classList.add('hidden');
    el.innerHTML = '';
  },
};
