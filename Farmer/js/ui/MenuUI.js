import { G } from '../core/Game.js';
import { AudioManager } from '../core/AudioManager.js';
import { saveGame, saveSettings } from '../core/SaveManager.js';
import { openModal, closeModal } from './Panels.js';
import { toast } from './HUD.js';
import { TimeSystem } from '../systems/TimeSystem.js';
import { HelpUI } from './HelpUI.js';

export const MenuUI = {
  onTitle: null,
  onEnding: null,

  openPause() {
    openModal('menu', '⏸️ 메뉴', (body) => {
      body.innerHTML = `
        <div class="menu-buttons">
          <button class="btn primary big" data-act="resume">계속하기</button>
          <button class="btn big" data-act="save">저장하기</button>
          <button class="btn big" data-act="settings">설정</button>
          <button class="btn big" data-act="help">📖 도움말</button>
          ${G.state?.flags.endingSeen ? '<button class="btn big" data-act="ending">🎬 엔딩 다시 보기</button>' : ''}
          <button class="btn big" data-act="title">타이틀로</button>
        </div>`;
      body.querySelector('[data-act="ending"]')?.addEventListener('click', () => { closeModal(); this.onEnding?.(); });
      body.querySelector('[data-act="resume"]').onclick = () => closeModal();
      body.querySelector('[data-act="save"]').onclick = () => { saveGame(); toast('💾 저장했어요', 'good'); closeModal(); };
      body.querySelector('[data-act="settings"]').onclick = () => this.openSettings();
      body.querySelector('[data-act="help"]').onclick = () => HelpUI.open();
      body.querySelector('[data-act="title"]').onclick = () => { saveGame(); closeModal(); this.onTitle?.(); };
    });
  },

  openSettings() {
    openModal('settings', '⚙️ 설정', (body) => {
      body.innerHTML = `
        <div class="settings">
          <label>🎵 배경음악 <input type="range" min="0" max="1" step="0.05" value="${G.settings.bgm}" data-k="bgm"></label>
          <label>🔔 효과음 · 환경음 <input type="range" min="0" max="1" step="0.05" value="${G.settings.sfx}" data-k="sfx"></label>
        </div>`;
      body.querySelectorAll('input[type=range]').forEach((inp) => inp.addEventListener('input', () => {
        G.settings[inp.dataset.k] = Number(inp.value);
        AudioManager.applyVolumes();
        saveSettings();
      }));
    });
  },

  confirmSleep(onSleep) {
    openModal('sleep', '🛏️ 우리 집', (body) => {
      const can = TimeSystem.canSleep();
      const left = TimeSystem.minutesUntilSleep();
      const wait = left >= 60 ? `${Math.floor(left / 60)}시간 ${left % 60 ? `${left % 60}분` : ''}` : `${left}분`;
      const msg = can
        ? '침대에서 푹 자고 다음 날 아침으로 넘어갈까요?<br><small>잠을 자면 체력이 모두 회복되고, 물을 준 작물이 자라요. 게임도 자동 저장돼요.</small>'
        : `아직 해가 떠 있어서 잠이 오지 않아요… ☀️<br><small>밤(오후 6시)부터 잘 수 있어요 · 앞으로 약 ${wait.trim()} 남았어요 (지금 ${TimeSystem.clock()})</small>`;
      body.innerHTML = `
        <p class="confirm-msg">${msg}</p>
        <div class="menu-buttons row">
          <button class="btn primary big" data-act="sleep" ${can ? '' : 'disabled'}>💤 잠자기</button>
          <button class="btn big" data-act="cancel">${can ? '취소' : '확인'}</button>
        </div>`;
      body.querySelector('[data-act="sleep"]').onclick = () => { if (!TimeSystem.canSleep()) return; closeModal(); onSleep(); };
      body.querySelector('[data-act="cancel"]').onclick = () => closeModal();
    });
  },
};
