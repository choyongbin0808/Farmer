export const Input = {
  keys: new Set(),
  mouse: { x: 0, y: 0, inside: false, down: false },
  handlers: {},

  init(canvas, handlers) {
    this.handlers = handlers;
    let dragging = false;
    let downPos = null;
    let lastX = 0;

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'Tab') e.preventDefault();
      this.keys.add(e.code);
      handlers.onKey?.(e.code, e);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; });
    // 왼쪽 버튼을 누르고 있는지 (낚시 미니게임) — 캔버스 밖에서 떼도 풀리도록 창 전체에서 받는다
    window.addEventListener('pointerup', (e) => { if (e.button === 0) this.mouse.down = false; });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 2) {
        dragging = true;
        lastX = e.clientX;
        canvas.setPointerCapture(e.pointerId);
      } else if (e.button === 0) {
        downPos = { x: e.clientX, y: e.clientY };
        this.mouse.down = true;
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.mouse.inside = true;
      if (dragging) {
        handlers.onRotate?.(e.clientX - lastX);
        lastX = e.clientX;
      }
    });
    canvas.addEventListener('pointerleave', () => { this.mouse.inside = false; });
    canvas.addEventListener('pointerup', (e) => {
      if (e.button === 2) {
        dragging = false;
        return;
      }
      if (e.button === 0 && downPos) {
        const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
        downPos = null;
        if (moved < 8) handlers.onClick?.(e.clientX, e.clientY);
      }
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      handlers.onZoom?.(Math.sign(e.deltaY));
    }, { passive: false });
  },

  isDown(...codes) {
    return codes.some((c) => this.keys.has(c));
  },
};
