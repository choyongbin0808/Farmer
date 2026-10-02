import { AudioManager } from '../core/AudioManager.js';

const el = {};
let typing = null;
let advance = null;

export const DialogueUI = {
  init() {
    el.root = document.getElementById('dialogue');
    el.avatar = document.getElementById('dlg-avatar');
    el.name = document.getElementById('dlg-name');
    el.text = document.getElementById('dlg-text');
    el.options = document.getElementById('dlg-options');
    el.next = document.getElementById('dlg-next');
    el.root.addEventListener('click', (e) => {
      if (e.target.closest('.dlg-option')) return;
      this.next();
    });
  },

  show() {
    el.root.classList.remove('hidden');
  },

  hide() {
    el.root.classList.add('hidden');
    el.options.innerHTML = '';
  },

  next() {
    if (typing) {
      typing.finish();
      return;
    }
    if (advance) {
      const a = advance;
      advance = null;
      a();
    }
  },

  setSpeaker(speaker) {
    el.avatar.textContent = speaker.avatar || '🙂';
    el.name.textContent = speaker.name;
  },

  /** 대사 여러 줄을 순서대로 보여 주고 모두 넘기면 resolve */
  async say(speaker, lines) {
    this.show();
    this.setSpeaker(speaker);
    el.options.innerHTML = '';
    for (const line of lines) {
      await this.type(line);
      el.next.classList.remove('hidden');
      await new Promise((r) => { advance = r; });
      el.next.classList.add('hidden');
    }
  },

  type(text) {
    return new Promise((resolve) => {
      el.text.textContent = '';
      let i = 0;
      const timer = setInterval(() => {
        i++;
        el.text.textContent = text.slice(0, i);
        if (i % 3 === 0) AudioManager.sfx('talk');
        if (i >= text.length) done();
      }, 28);
      const done = () => {
        clearInterval(timer);
        el.text.textContent = text;
        typing = null;
        resolve();
      };
      typing = { finish: done };
    });
  },

  /** 선택지를 보여 주고 고른 항목 resolve. prompt 가 있으면 먼저 표시 */
  async choose(speaker, prompt, options) {
    this.show();
    this.setSpeaker(speaker);
    if (prompt) await this.type(prompt);
    el.next.classList.add('hidden');
    return new Promise((resolve) => {
      el.options.innerHTML = '';
      options.forEach((opt, idx) => {
        const b = document.createElement('button');
        b.className = 'dlg-option' + (opt.highlight ? ' highlight' : '');
        b.innerHTML = `<span class="key">${idx + 1}</span> ${opt.label}`;
        b.addEventListener('click', () => {
          AudioManager.sfx('click');
          el.options.innerHTML = '';
          resolve(opt);
        });
        el.options.appendChild(b);
      });
    });
  },

  /** 숫자 키로 선택지 고르기 */
  pickByKey(n) {
    const b = el.options.querySelectorAll('.dlg-option')[n - 1];
    if (b) b.click();
    return !!b;
  },
};
