import { G } from '../core/Game.js';
import { AudioManager } from '../core/AudioManager.js';

let current = null;

export function openModal(id, title, render, { wide = false, onClose } = {}) {
  closeModal(true);
  const root = document.getElementById('modal-root');
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = `
    <div class="modal panel ${wide ? 'wide' : ''}">
      <div class="modal-head"><h2>${title}</h2><button class="close-btn" title="닫기 (Esc)">✕</button></div>
      <div class="modal-body"></div>
    </div>`;
  root.appendChild(back);
  const body = back.querySelector('.modal-body');
  back.querySelector('.close-btn').addEventListener('click', () => closeModal());
  back.addEventListener('pointerdown', (e) => {
    if (e.target === back) closeModal();
  });
  current = { id, el: back, body, render, onClose };
  G.ui.modal = id;
  AudioManager.sfx('click');
  render(body);
}

export function closeModal(silent = false) {
  if (!current) return;
  const c = current;
  current = null;
  c.el.remove();
  G.ui.modal = null;
  if (!silent) AudioManager.sfx('click');
  c.onClose?.();
}

export function refreshModal(id) {
  if (current && (!id || current.id === id)) {
    const scroll = current.body.querySelector('.scroll')?.scrollTop;
    current.render(current.body);
    const s = current.body.querySelector('.scroll');
    if (s && scroll) s.scrollTop = scroll;
  }
}

export function currentModal() {
  return current?.id ?? null;
}

/** 탭 버튼 HTML */
export function tabsHTML(tabs, active) {
  return `<div class="tabs">${tabs.map(([id, label]) => `<button class="tab ${id === active ? 'active' : ''}" data-tab="${id}">${label}</button>`).join('')}</div>`;
}

export function bindTabs(body, onTab) {
  body.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
    AudioManager.sfx('click');
    onTab(b.dataset.tab);
  }));
}
