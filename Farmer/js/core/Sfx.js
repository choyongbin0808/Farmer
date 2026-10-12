/**
 * 효과음 엔진 — 소리 파일 없이 Web Audio 로 '재질이 느껴지는' 소리를 합성한다.
 *
 * 기본 재료
 *  - 잡음: 흰(쉭·쉬익) · 분홍(바람·물·잎) · 갈색(흙·쿵) 세 가지
 *  - 공용 잔향(ConvolverNode): 모든 효과음이 같은 공간에서 나는 것처럼 — 바깥은 살짝, 집 안은 조금, 동굴은 크게
 * 재질별 소리
 *  - knock(나무 톡) · thud(흙 퍽) · metal(FM 쇠 쨍) · bubble(물방울 퐁) · grains(부스러기·자갈·잎 바스락)
 *  - mallet(마림바) · bell(종) · pluck(뜯는 현, Karplus-Strong)
 */
export function createSfx(ctx, dryOut) {
  const sr = ctx.sampleRate;
  const r = Math.random;

  // ── 잡음 버퍼 ──
  const len = sr * 2;
  const white = ctx.createBuffer(1, len, sr);
  const pink = ctx.createBuffer(1, len, sr);
  const brown = ctx.createBuffer(1, len, sr);
  {
    const w = white.getChannelData(0), p = pink.getChannelData(0), b = brown.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const x = r() * 2 - 1;
      w[i] = x;
      // Paul Kellet 분홍 잡음
      b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759; b2 = 0.969 * b2 + x * 0.153852;
      b3 = 0.8665 * b3 + x * 0.3104856; b4 = 0.55 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.016898;
      p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + x * 0.5362) * 0.11;
      last = (last + 0.02 * x) / 1.02;
      b[i] = last * 3.5;
    }
  }
  const BUF = { white, pink, brown };

  // ── 공용 잔향 ──
  const verb = ctx.createConvolver();
  {
    const n = Math.floor(sr * 1.6);
    const ir = ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / n, 3.2);
    }
    verb.buffer = ir;
  }
  const send = ctx.createGain();
  send.gain.value = 0.1;
  send.connect(verb).connect(dryOut);

  /** 소리 마디를 내보낸다: 바로 들리는 소리 + 잔향으로 보내는 몫(wet 배율) */
  function out(node, wet = 1) {
    node.connect(dryOut);
    if (wet > 0) {
      const g = ctx.createGain();
      g.gain.value = wet;
      node.connect(g).connect(send);
    }
  }

  const T = (when = 0) => ctx.currentTime + when;

  /** 진폭 모양: a 동안 peak 까지 올라갔다가 dur 에 걸쳐 사라짐 (hold 동안 유지) */
  function shape(g, t, { a = 0.004, peak = 0.2, dur = 0.2, hold = 0 }) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    if (hold) g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + dur);
    return t + a + hold + dur;
  }

  /** 발진기 한 음 (f → f2 로 미끄러짐) */
  function osc({ type = 'sine', f = 440, f2, when = 0, dur = 0.2, vol = 0.1, a = 0.004, hold = 0, wet = 1, glide }) {
    const t = T(when);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + (glide ?? dur));
    const end = shape(g, t, { a, peak: vol, dur, hold });
    o.connect(g);
    out(g, wet);
    o.start(t);
    o.stop(end + 0.05);
  }

  /** 걸러 낸 잡음 한 덩어리 */
  function nz({ buf = 'white', type = 'bandpass', f = 1000, f2, q = 1, when = 0, dur = 0.15, vol = 0.1, a = 0.003, hold = 0, wet = 1 }) {
    const t = T(when);
    const s = ctx.createBufferSource();
    s.buffer = BUF[buf];
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(f, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + a + hold + dur);
    fl.Q.value = q;
    const g = ctx.createGain();
    const end = shape(g, t, { a, peak: vol, dur, hold });
    s.connect(fl).connect(g);
    out(g, wet);
    s.start(t, r() * 1.5);
    s.stop(end + 0.05);
  }

  // ── 재질별 소리 ──
  /** 나무 '톡' — f 가 높을수록 작고 단단한 나무 */
  function knock(f = 800, { when = 0, vol = 0.12, wet = 0.6 } = {}) {
    osc({ f, f2: f * 0.72, when, dur: 0.07, vol, a: 0.001, wet });
    nz({ f: f * 3.2, q: 5, when, dur: 0.025, vol: vol * 0.7, a: 0.001, wet });
  }
  /** 흙 '퍽' (갈색 잡음 + 낮은 울림) */
  function thud({ when = 0, vol = 0.25, low = 75, wet = 0.4 } = {}) {
    nz({ buf: 'brown', type: 'lowpass', f: 320, q: 0.7, when, dur: 0.14, vol, a: 0.002, wet });
    osc({ f: low, f2: low * 0.6, when, dur: 0.12, vol: vol * 0.55, a: 0.002, wet });
  }
  /** 쇠 '쨍' — FM 합성 (비율이 정수가 아니면 종소리처럼 울림) */
  function metal(fc = 1800, { ratio = 1.41, index = 6, when = 0, dur = 0.35, vol = 0.08, wet = 1 } = {}) {
    const t = T(when);
    const car = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const mg = ctx.createGain();
    const g = ctx.createGain();
    car.frequency.value = fc;
    mod.frequency.value = fc * ratio;
    mg.gain.setValueAtTime(fc * index, t);
    mg.gain.exponentialRampToValueAtTime(fc * 0.2, t + dur);
    mod.connect(mg).connect(car.frequency);
    const end = shape(g, t, { a: 0.001, peak: vol, dur });
    car.connect(g);
    out(g, wet);
    car.start(t); mod.start(t);
    car.stop(end + 0.05); mod.stop(end + 0.05);
  }
  /** 물방울 '퐁' — 작은 공기 방울은 소리가 위로 올라간다 */
  function bubble(f = 600, { when = 0, vol = 0.05, wet = 0.8 } = {}) {
    const d = 0.03 + 600 / f * 0.03;
    osc({ f, f2: f * (1.6 + r() * 0.6), when, dur: d, vol, a: 0.002, wet });
  }
  /** 부스러기 알갱이 n개 (자갈 · 흙 · 잎 · 씹는 소리) */
  function grains(n, { span = 0.2, when = 0, lo = 1200, hi = 4000, vol = 0.05, dur = 0.02, buf = 'white', q = 2, wet = 0.5 } = {}) {
    for (let i = 0; i < n; i++) {
      nz({ buf, f: lo + r() * (hi - lo), q, when: when + r() * span, dur: dur * (0.6 + r() * 0.8), vol: vol * (0.5 + r() * 0.7), a: 0.001, wet });
    }
  }
  /** 마림바 한 음 */
  function mallet(f, { when = 0, vol = 0.1, wet = 0.8 } = {}) {
    osc({ f, when, dur: 0.45, vol, a: 0.002, wet });
    osc({ f: f * 3.99, when, dur: 0.08, vol: vol * 0.28, a: 0.001, wet });
    nz({ f: 2400, q: 3, when, dur: 0.012, vol: vol * 0.3, a: 0.001, wet: 0.3 });
  }
  /** 종 한 음 (배음이 정수 배가 아닌 맑은 소리) */
  function bell(f, { when = 0, vol = 0.07, dur = 1.0, wet = 1 } = {}) {
    [[1, 1, 1], [2.0, 0.45, 0.6], [2.76, 0.35, 0.45], [5.4, 0.15, 0.25]].forEach(([k, v, d]) => {
      osc({ f: f * k, when, dur: dur * d, vol: vol * v, a: 0.002, wet });
    });
  }
  /** 뜯는 현 (Karplus-Strong) — 오르골 · 낚싯줄 '팅' */
  const ksCache = new Map();
  function pluck(f, { when = 0, vol = 0.12, wet = 0.8, damp = 0.996 } = {}) {
    const key = `${Math.round(f)}|${damp}`;
    if (!ksCache.has(key)) {
      const n = Math.floor(sr * 1.4);
      const b = ctx.createBuffer(1, n, sr);
      const d = b.getChannelData(0);
      const N = Math.max(2, Math.round(sr / f));
      for (let i = 0; i < N; i++) d[i] = r() * 2 - 1;
      for (let i = N; i < n; i++) d[i] = damp * 0.5 * (d[i - N] + d[i - N + 1 < i ? i - N + 1 : i - N]);
      ksCache.set(key, b);
    }
    const t = T(when);
    const s = ctx.createBufferSource();
    s.buffer = ksCache.get(key);
    const g = ctx.createGain();
    g.gain.value = vol;
    s.connect(g);
    out(g, wet);
    s.start(t);
    s.stop(t + 1.4);
  }
  /** 바람 '휙' (대역 잡음을 훑는다) */
  function swish({ from = 500, to = 1600, when = 0, dur = 0.18, vol = 0.06, q = 1.4, buf = 'pink' } = {}) {
    nz({ buf, f: from, f2: to, q, when, dur, vol, a: dur * 0.35, wet: 0.3 });
  }
  /** 물 '첨벙' — 크기 size 0~1 */
  function splash(size = 1, when = 0) {
    nz({ buf: 'pink', f: 2600, f2: 420, q: 0.9, when, dur: 0.25 + size * 0.2, vol: 0.2 + size * 0.22, a: 0.003, wet: 0.7 });
    nz({ buf: 'brown', type: 'lowpass', f: 300, when, dur: 0.12, vol: 0.12 * size, wet: 0.4 });
    const k = 3 + Math.round(size * 6);
    for (let i = 0; i < k; i++) bubble(450 + r() * 900, { when: when + 0.05 + r() * (0.25 + size * 0.3), vol: 0.025 + size * 0.02 });
    grains(4 + Math.round(size * 6), { when: when + 0.08, span: 0.35, lo: 3000, hi: 7000, vol: 0.025, buf: 'white' });
  }

  // ── 발소리 (바닥 재질별) ──
  function step(surface) {
    const v = 0.6 + r() * 0.4;
    if (surface === 'wood') {
      knock(190 + r() * 40, { vol: 0.07 * v, wet: 0.5 });
      osc({ f: 110, f2: 80, dur: 0.06, vol: 0.04 * v, wet: 0.4 });
    } else if (surface === 'stone') {
      grains(3, { span: 0.03, lo: 2500, hi: 6000, vol: 0.03 * v, wet: 0.6 });
      thud({ vol: 0.05 * v, low: 90, wet: 0.6 });
    } else if (surface === 'path') {
      grains(6, { span: 0.06, lo: 1500, hi: 4500, vol: 0.035 * v, buf: 'white', wet: 0.2 });
      thud({ vol: 0.04 * v, low: 70, wet: 0.1 });
    } else if (surface === 'soil') {
      thud({ vol: 0.06 * v, low: 65, wet: 0.1 });
      grains(3, { span: 0.05, lo: 600, hi: 1600, vol: 0.025 * v, buf: 'pink', wet: 0.1 });
    } else {
      // 풀밭: 부드러운 '사박'
      nz({ buf: 'pink', f: 2800 + r() * 800, q: 0.8, dur: 0.08, vol: 0.035 * v, a: 0.01, wet: 0.1 });
      thud({ vol: 0.025 * v, low: 60, wet: 0 });
    }
  }

  // ── 목소리 (말풍선 글자 · 주민마다 다른 높이) ──
  const VOWELS = [[730, 1090], [270, 2290], [300, 870], [530, 1840], [570, 840]];
  function voice(pitch) {
    const t = T();
    const [f1, f2] = VOWELS[Math.floor(r() * VOWELS.length)];
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const p = pitch * (0.92 + r() * 0.16);
    o.frequency.setValueAtTime(p, t);
    o.frequency.exponentialRampToValueAtTime(p * (r() < 0.5 ? 1.12 : 0.9), t + 0.06);
    const g = ctx.createGain();
    const end = shape(g, t, { a: 0.008, peak: 0.09, dur: 0.06 });
    for (const [ff, gain] of [[f1, 1], [f2, 0.5]]) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = ff;
      bp.Q.value = 6;
      const fg = ctx.createGain();
      fg.gain.value = gain;
      o.connect(bp).connect(fg).connect(g);
    }
    out(g, 0.2);
    o.start(t);
    o.stop(end + 0.05);
  }

  // ═════════ 효과음 목록 ═════════
  const C = 261.63;
  const note = (semi) => C * Math.pow(2, semi / 12);
  const play = {
    // ── 화면 · 알림 ──
    click: () => knock(1250 + r() * 100, { vol: 0.07, wet: 0.2 }),
    error: () => { knock(260, { vol: 0.12, wet: 0.2 }); knock(200, { when: 0.11, vol: 0.12, wet: 0.2 }); },
    coin: () => { bell(1760, { vol: 0.05, dur: 0.5 }); bell(2349, { when: 0.07, vol: 0.05, dur: 0.7 }); metal(4200, { ratio: 1.33, index: 2, dur: 0.12, vol: 0.02 }); },
    quest: () => [0, 4, 7, 12].forEach((s, i) => mallet(note(s + 12), { when: i * 0.09, vol: 0.11 })),
    rank: () => {
      [0, 4, 7, 12, 16].forEach((s, i) => mallet(note(s + 12), { when: i * 0.08, vol: 0.1 }));
      [0, 4, 7].forEach((s) => bell(note(s + 24), { when: 0.42, vol: 0.04, dur: 1.4 }));
    },
    set: () => [12, 16, 19, 24, 28].forEach((s, i) => bell(note(s + 12), { when: i * 0.05, vol: 0.035, dur: 0.8 })),
    sleep: () => [12, 7, 4, 0, -5].forEach((s, i) => pluck(note(s + 12), { when: i * 0.32, vol: 0.12 })),
    fanfare: () => {
      [[0, 0], [0, 0.16], [4, 0.32], [7, 0.48], [4, 0.72], [7, 0.88], [12, 1.1]].forEach(([s, w]) => mallet(note(s + 12), { when: w, vol: 0.12 }));
      [0, 4, 7, 12].forEach((s) => bell(note(s + 24), { when: 1.1, vol: 0.035, dur: 1.6 }));
    },
    chime: () => [7, 12, 16, 19, 24].forEach((s, i) => bell(note(s + 24), { when: i * 0.16 + r() * 0.04, vol: 0.04, dur: 1.4 })),
    applause: () => {
      // 여러 사람의 박수: 손뼉마다 공명 주파수가 다르고, 둘씩 붙어 치는 소리도 섞는다
      for (let i = 0; i < 140; i++) {
        const w = r() * 3.4;
        const f = 900 + r() * 1800;
        nz({ buf: 'white', f, q: 1.6, when: w, dur: 0.035, vol: 0.05 + r() * 0.07, a: 0.001, wet: 0.6 });
        if (r() < 0.25) nz({ buf: 'white', f: f * 1.1, q: 1.6, when: w + 0.11, dur: 0.03, vol: 0.04, a: 0.001, wet: 0.6 });
      }
    },
    door: () => {
      // 나무문: 끼이익 → 덜컥
      const t = T();
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(150, t);
      o.frequency.linearRampToValueAtTime(115, t + 0.32);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 7;
      const g = ctx.createGain();
      const end = shape(g, t, { a: 0.05, peak: 0.035, dur: 0.25, hold: 0.05 });
      o.connect(bp).connect(g);
      out(g, 0.5);
      o.start(t); o.stop(end + 0.05);
      knock(170, { when: 0.34, vol: 0.14 });
      thud({ when: 0.34, vol: 0.08, low: 90 });
    },
    eat: () => {
      // 아삭아삭 세 입 → 꿀꺽
      for (let b = 0; b < 3; b++) grains(7, { when: b * 0.2, span: 0.06, lo: 1500, hi: 4500, vol: 0.032, q: 3 });
      osc({ f: 320, f2: 170, when: 0.66, dur: 0.1, vol: 0.06, wet: 0.2 });
    },
    anvil: () => {
      // 모루: 땅! 땅! (쇠끼리 부딪히는 맑은 울림)
      for (const w of [0, 0.3]) {
        metal(1320, { ratio: 2.76, index: 5, when: w, dur: 0.7, vol: 0.06 });
        nz({ f: 5000, q: 2, when: w, dur: 0.03, vol: 0.08, wet: 0.5 });
      }
    },
    brew: () => {
      // 보글보글 끓는 소리
      nz({ buf: 'brown', type: 'lowpass', f: 400, dur: 0.6, hold: 0.3, vol: 0.06, a: 0.1, wet: 0.3 });
      for (let i = 0; i < 12; i++) bubble(180 + r() * 380, { when: r() * 0.9, vol: 0.045 });
    },

    // ── 농사 ──
    till: () => grains(8, { span: 0.2, lo: 500, hi: 1800, vol: 0.04, buf: 'pink', wet: 0.2 }),
    hoeHit: () => { thud({ vol: 0.28 }); grains(10, { when: 0.02, span: 0.18, lo: 600, hi: 2200, vol: 0.04, buf: 'pink', wet: 0.2 }); },
    whoosh: () => swish({ from: 450, to: 1500 }),
    whooshLow: () => swish({ from: 300, to: 1000, vol: 0.06 }),
    water: () => nz({ buf: 'pink', f: 3000, q: 0.7, dur: 0.3, vol: 0.05, a: 0.02, wet: 0.2 }),
    pour: ({ dur = 0.5 } = {}) => {
      // 물뿌리개: 쏴아 — 물줄기가 흙과 잎에 떨어지는 소리 + 톡톡 물방울
      nz({ buf: 'pink', f: 3400, q: 0.6, dur: 0.15, hold: dur, vol: 0.07, a: 0.06, wet: 0.2 });
      nz({ buf: 'white', type: 'highpass', f: 6000, dur: 0.12, hold: dur, vol: 0.02, a: 0.06, wet: 0.1 });
      grains(Math.round(dur * 30), { span: dur, lo: 3000, hi: 7000, vol: 0.02, wet: 0.2 });
      for (let i = 0; i < Math.round(dur * 8); i++) bubble(900 + r() * 1400, { when: r() * dur, vol: 0.012 });
    },
    plant: () => { thud({ vol: 0.07, low: 110, wet: 0.1 }); thud({ when: 0.12, vol: 0.06, low: 120, wet: 0.1 }); },
    seeds: () => grains(9, { span: 0.22, lo: 4000, hi: 8000, vol: 0.04, q: 4, wet: 0.2 }),
    rustle: () => { grains(10, { span: 0.2, lo: 2500, hi: 5500, vol: 0.03, buf: 'pink', q: 1, dur: 0.04, wet: 0.2 }); },
    sickleSwish: () => swish({ from: 1200, to: 5200, dur: 0.15, vol: 0.08, q: 1.8, buf: 'white' }),
    snip: () => { nz({ type: 'highpass', f: 5500, dur: 0.04, vol: 0.1, a: 0.001, wet: 0.2 }); metal(4100, { ratio: 1.5, index: 1.5, dur: 0.08, vol: 0.018 }); grains(5, { when: 0.03, span: 0.1, lo: 2000, hi: 4500, vol: 0.03 }); },
    harvest: () => {
      // 뽁! 하고 뽑히는 소리 + 잎 흔들림
      osc({ f: 260, f2: 620, dur: 0.07, vol: 0.12, a: 0.002, wet: 0.3 });
      thud({ vol: 0.06, low: 140, wet: 0.1 });
      grains(8, { when: 0.04, span: 0.2, lo: 2500, hi: 5500, vol: 0.025, buf: 'pink', q: 1 });
    },

    // ── 낚시 ──
    rodWhoosh: () => { swish({ from: 2800, to: 600, dur: 0.22, vol: 0.09, q: 2, buf: 'white' }); pluck(220, { when: 0.05, vol: 0.05, damp: 0.99 }); },
    lineOut: () => {
      // 릴이 풀리며 지이잉 (점점 느려지는 톱니 소리)
      for (let i = 0; i < 14; i++) knock(3000 + r() * 200, { when: i * (0.016 + i * 0.004), vol: 0.025, wet: 0.1 });
      nz({ type: 'highpass', f: 6000, dur: 0.3, vol: 0.02, a: 0.02, wet: 0.1 });
    },
    splash: () => splash(0.8),
    splashSmall: () => splash(0.35),
    plip: () => bubble(520 + r() * 200, { vol: 0.05 }),
    bite: () => { bubble(380, { vol: 0.08 }); splash(0.25, 0.02); bell(1568, { when: 0.06, vol: 0.05, dur: 0.6 }); },
    reelTick: () => knock(2800 + r() * 300, { vol: 0.03, wet: 0.05 }),
    dragTick: () => knock(1500 + r() * 200, { vol: 0.025, wet: 0.05 }),
    reelFast: () => { for (let i = 0; i < 14; i++) knock(2600 + r() * 300, { when: i * 0.032, vol: 0.03, wet: 0.05 }); },
    waterOut: () => { splash(1); grains(10, { when: 0.25, span: 0.5, lo: 3000, hi: 7000, vol: 0.02 }); },
    catch: () => { splash(0.7); [7, 12, 16].forEach((s, i) => mallet(note(s + 12), { when: 0.15 + i * 0.08, vol: 0.08 })); },
    escape: () => { pluck(880, { vol: 0.08, damp: 0.98 }); osc({ f: 500, f2: 240, when: 0.05, dur: 0.25, vol: 0.04, wet: 0.3 }); splash(0.3, 0.1); },

    // ── 광산 ──
    pickHit: () => {
      const f = 1700 + r() * 700;
      metal(f, { ratio: 1.41, index: 4, dur: 0.22, vol: 0.06 });
      grains(6, { when: 0.005, span: 0.12, lo: 1500, hi: 5000, vol: 0.05 });
      thud({ vol: 0.12, low: 110 });
    },
    rock: () => {
      // 광맥이 와르르 — 부서지는 소리 + 굴러가는 돌멩이
      thud({ vol: 0.3, low: 70 });
      grains(22, { span: 0.4, lo: 600, hi: 4000, vol: 0.06, q: 1.5 });
      for (let i = 0; i < 5; i++) knock(700 + r() * 900, { when: 0.15 + i * (0.07 + r() * 0.05), vol: 0.05 * (1 - i * 0.15) });
    },

    lift: () => {
      // 승강기: 레버 덜컥 → 쇠사슬 드르륵 · 도르래가 끼익 돌며 올라감 → 쿵 도착
      knock(420, { vol: 0.1 });
      metal(900, { ratio: 1.41, index: 3, when: 0.05, dur: 0.25, vol: 0.04 });
      for (let i = 0; i < 18; i++) knock(1400 + r() * 500, { when: 0.15 + i * 0.045, vol: 0.03, wet: 0.5 });
      nz({ buf: 'brown', type: 'lowpass', f: 140, when: 0.1, dur: 0.3, hold: 0.6, vol: 0.12, a: 0.15, wet: 0.5 });
      thud({ when: 1.0, vol: 0.18, low: 70 });
    },

    // ── 농기계 ──
    engine: () => { nz({ buf: 'brown', type: 'lowpass', f: 160, dur: 0.14, vol: 0.2, wet: 0.1 }); osc({ type: 'triangle', f: 52, f2: 44, dur: 0.12, vol: 0.06, wet: 0 }); },
  };

  return {
    /** 효과음 하나 재생 */
    play(name, opt = {}) {
      const fn = play[name];
      if (fn) fn(opt);
    },
    step,
    voice,
    /** 공간 크기: 'outdoor'(바깥) · 'room'(집 안) · 'cave'(광산 · 지하) */
    setSpace(space) {
      const v = { outdoor: 0.08, room: 0.2, cave: 0.42 }[space] ?? 0.08;
      send.gain.setTargetAtTime(v, ctx.currentTime, 0.3);
    },
  };
}
