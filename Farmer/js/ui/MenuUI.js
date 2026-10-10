import { G } from '../core/Game.js';
import { AudioManager } from '../core/AudioManager.js';
import { saveGame, saveSettings } from '../core/SaveManager.js';
import { openModal, closeModal } from './Panels.js';
import { toast } from './HUD.js';
import { TimeSystem } from '../systems/TimeSystem.js';

const HELP = `
  <table class="help">
    <tr><td>W A S D</td><td>이동 (Shift: 달리기)</td></tr>
    <tr><td>1 ~ 7</td><td>핫바 슬롯 선택 (씨앗·모종·음식·특별 아이템·낚싯대·곡괭이)</td></tr>
    <tr><td>좌클릭 (밭)</td><td>밭 상태에 맞춰 자동 작업 — 빈 땅: 갈기 · 물 안 준 땅: 물 주기 · 갈고 물 준 땅 + 씨앗: 심기(체력 소모)</td></tr>
    <tr><td>좌클릭 (수확 표시)</td><td>다 자란 작물 수확 → 창고로 자동 보관 (수확한 밭은 다시 갈아야 해요)</td></tr>
    <tr><td>농기구</td><td>가방 '장비' 탭에서 장착한 호미·물뿌리개·낫이 자동으로 쓰여요</td></tr>
    <tr><td>좌클릭 (자라는 작물)</td><td>작물 상세 정보 (다 자라는 날, 판매가, 예상 수확량)</td></tr>
    <tr><td>좌클릭 (내 밭 팻말)</td><td>밭 확장 구매 (최대 8x8, 울타리도 함께 넓어짐)</td></tr>
    <tr><td>좌클릭 (주민·건물)</td><td>대화 · 거래 · 창고 · 잠자기(집, 밤 오후 6시부터)</td></tr>
    <tr><td>낚시</td><td>핫바에서 낚싯대 → 시냇물 클릭 → 파워 게이지를 클릭/Space로 멈춰 던지기(멀리 던질수록 귀한 고기) → ❗ 입질에 클릭 → <b>꾹 누르면 초록 막대가 올라가요</b>, 물고기를 막대 안에 붙잡아 게이지를 채우면 낚아요 (이동하면 그만둠) · 잡은 고기는 오 씨에게 타우린·키토산으로 교환</td></tr>
    <tr><td>광산</td><td>윤 씨 아주머니 부탁 뒤 동쪽 끝 광산 입장 · 핫바에서 곡괭이를 고르고 광맥 클릭 (체력 소모) · 광석은 한 반장에게 판매</td></tr>
    <tr><td>시설 배치</td><td>상점 '시설·흙' 탭에서 구매 → 마우스로 자리 고르기 · R 회전 · 클릭 놓기 · Esc 취소</td></tr>
    <tr><td>약탕기 / 육묘장</td><td>일반 흙 + 타우린 + 키토산 → 토양 흙 · 씨앗 + 토양 흙 → 모종 (3배 빨리 자람)</td></tr>
    <tr><td>E</td><td>가까운 주민·건물과 상호작용</td></tr>
    <tr><td>I / Tab</td><td>가방 (옷 착용 포함)</td></tr>
    <tr><td>Q</td><td>퀘스트 목록</td></tr>
    <tr><td>휠 / 우클릭 드래그</td><td>카메라 줌 / 회전</td></tr>
    <tr><td>Esc</td><td>창 닫기 · 메뉴</td></tr>
  </table>`;

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
          <button class="btn big" data-act="help">조작법</button>
          ${G.state?.flags.endingSeen ? '<button class="btn big" data-act="ending">🎬 엔딩 다시 보기</button>' : ''}
          <button class="btn big" data-act="title">타이틀로</button>
        </div>`;
      body.querySelector('[data-act="ending"]')?.addEventListener('click', () => { closeModal(); this.onEnding?.(); });
      body.querySelector('[data-act="resume"]').onclick = () => closeModal();
      body.querySelector('[data-act="save"]').onclick = () => { saveGame(); toast('💾 저장했어요', 'good'); closeModal(); };
      body.querySelector('[data-act="settings"]').onclick = () => this.openSettings();
      body.querySelector('[data-act="help"]').onclick = () => this.openHelp();
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

  openHelp() {
    openModal('help', '🎮 조작법', (body) => { body.innerHTML = HELP; });
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
