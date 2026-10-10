import { AudioManager } from '../core/AudioManager.js';
import { HOTBAR_SIZE } from '../core/Game.js';
import { prologueComicHTML } from './PrologueComic.js';

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const OPENING = [
  '매일 같은 지하철, 같은 사무실, 같은 야근….',
  '도시의 소음에 지친 어느 날, 나는 짐을 쌌다.',
  '할아버지가 남겨 주신 시골집이 있는 작은 마을, \'초록마을\'로.',
  '남은 건 낡은 집과 밭 하나뿐이지만… 이곳에서 다시 시작해 보려 한다.',
];

export const TitleUI = {
  show(opts) {
    const { hasSave, onNew, onContinue, onSettings } = opts;
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
        <div class="title-hint">WASD 이동 · 클릭 상호작용 · 1~${HOTBAR_SIZE} 핫바</div>
      </div>`;
    el.querySelector('[data-act="new"]').onclick = () => {
      AudioManager.resume();
      AudioManager.sfx('click');
      // 브라우저 confirm()은 막혀 있는 환경(앱 내장 브라우저 등)에서 바로 false가 돼 새 게임이 안 됐음 → 화면 안 확인 창
      if (hasSave) this.confirmNew(opts);
      else this.askName(onNew);
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

  confirmNew(opts) {
    const el = $('title-screen');
    el.innerHTML = `
      <div class="title-card name-card">
        <h2>새 게임을 시작할까요?</h2>
        <p class="confirm-msg">저장된 게임이 있어요.<br>새로 시작하면 기존 기록이 지워져요.</p>
        <div class="title-buttons row">
          <button class="btn primary big" data-act="yes">새로 시작</button>
          <button class="btn big" data-act="no">돌아가기</button>
        </div>
      </div>`;
    el.querySelector('[data-act="yes"]').onclick = () => {
      AudioManager.sfx('click');
      this.askName(opts.onNew);
    };
    el.querySelector('[data-act="no"]').onclick = () => {
      AudioManager.sfx('click');
      this.show(opts);
    };
  },

  askName(onNew) {
    const el = $('title-screen');
    el.innerHTML = `
      <div class="title-card name-card">
        <h2>당신의 이름은?</h2>
        <input id="name-input" maxlength="8" placeholder="이름을 입력하세요 (최대 8자)" value="" autocomplete="off">
        <div class="title-buttons row">
          <button class="btn primary big" data-act="ok">시작하기</button>
        </div>
      </div>`;
    const input = $('name-input');
    input.focus();
    const go = () => {
      const name = input.value.trim();
      if (!name) {
        AudioManager.sfx('error');
        input.placeholder = '이름을 먼저 입력해 주세요!';
        input.focus();
        return;
      }
      AudioManager.sfx('click');
      this.opening(name, onNew);
    };
    el.querySelector('[data-act="ok"]').onclick = go;
    // 한글 입력 중(조합 중) Enter 는 글자 확정용이라 무시 — 마지막 글자가 빠지거나 두 번 들어가는 것을 막는다
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) go(); });
  },

  /** 프롤로그 4컷 만화: 한 컷씩 나타나고(클릭 또는 잠시 후 다음 컷), 다 보면 출발 버튼 */
  async opening(name, onNew) {
    const el = $('title-screen');
    el.innerHTML = prologueComicHTML(OPENING);
    el.classList.add('comic-bg');
    const cuts = [...el.querySelectorAll('.cut')];
    let next = null;
    let skipAll = false;
    el.onclick = () => next?.();
    el.querySelector('.comic-skip').onclick = (e) => {
      e.stopPropagation();
      skipAll = true;
      next?.();
    };
    await wait(300);
    for (const cut of cuts) {
      if (skipAll) break;
      cut.classList.add('show');
      AudioManager.sfx('click');
      await new Promise((r) => { next = r; setTimeout(r, 4200); });
    }
    if (!skipAll) {
      el.querySelector('.comic-hint').classList.add('hidden');
      const start = el.querySelector('.comic-start');
      start.classList.remove('hidden');
      await new Promise((r) => { next = r; });
      AudioManager.sfx('click');
    }
    el.onclick = null;
    el.classList.remove('comic-bg');
    this.hide();
    onNew(name);
  },

  hide() {
    const el = $('title-screen');
    el.classList.add('hidden');
    el.innerHTML = '';
  },
};
