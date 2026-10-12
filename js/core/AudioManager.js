import { G } from './Game.js';
import { createSfx } from './Sfx.js';

// 사운드 파일 없이 Web Audio API로 BGM·환경음·효과음을 생성

// ───────── BGM ─────────
// 시간대(아침·낮·밤)와 광산마다 여러 곡을 두고, 한 곡이 끝나면 잠깐 쉬었다가 다른 곡으로 넘어간다.
// chords: 마디마다의 화음(root 기준 반음), scale: 멜로디 음계, voice: 멜로디 음색, loops: 진행을 몇 번 반복할지
const MAJOR_PENTA = [0, 2, 4, 7, 9];
const MINOR_PENTA = [0, 3, 5, 7, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];

// 장조 화음 (root 기준 반음)
const I = [0, 4, 7], II = [2, 5, 9], III = [4, 7, 11], IV = [5, 9, 12], V = [7, 11, 14], VI = [9, 12, 16];

/*
 * 마을 곡(아침 · 낮 · 밤): 밝은 장조 · 또렷한 리듬 · 반복되는 멜로디(A-A-B-A)
 *  style 'village': 기타 스트럼 + 통통 베이스 + 마림바 멜로디 (+ perc: 셰이커 · 우드블록)
 *  style 'lullaby': 기타 분산화음 + 오르골 멜로디 (밤, 느리지만 장조)
 *  strum: 기타를 치는 8분음표 자리
 */
const SONGS = {
  morning: [
    { name: '아침 산책', style: 'village', tempo: 100, root: 60, perc: true, strum: [0, 3, 4, 6], chords: [I, V, VI, IV] },
    { name: '햇살 텃밭', style: 'village', tempo: 96, root: 67, perc: true, strum: [0, 2, 4, 6], chords: [I, VI, IV, V] },
    { name: '이슬방울', style: 'village', tempo: 104, root: 65, perc: false, strum: [0, 3, 6], chords: [I, V, VI, III, IV, I, IV, V] },
  ],
  day: [
    { name: '장날', style: 'village', tempo: 112, root: 62, perc: true, strum: [0, 2, 3, 4, 6], chords: [I, V, VI, IV] },
    { name: '바람 부는 들판', style: 'village', tempo: 106, root: 64, perc: true, strum: [0, 3, 4, 6], chords: [IV, V, III, VI, II, V, I, I] },
    { name: '새참 시간', style: 'village', tempo: 116, root: 60, perc: true, strum: [0, 2, 4, 5, 6], chords: [I, VI, IV, V] },
  ],
  night: [
    { name: '반딧불 자장가', style: 'lullaby', tempo: 76, root: 72, chords: [I, VI, IV, V] },
    { name: '달빛 마당', style: 'lullaby', tempo: 72, root: 67, chords: [I, IV, I, V] },
    { name: '별 헤는 밤', style: 'lullaby', tempo: 80, root: 65, chords: [I, VI, II, V] },
  ],
  // 광산: 낮고 신비로운 울림 + 긴 메아리
  mine: [
    { name: '깊은 갱도', tempo: 52, root: 57, scale: PHRYGIAN, voice: 'bell', loops: 3, sparse: true, drone: true, cave: true,
      chords: [[0, 3, 7], [1, 5, 8], [0, 3, 7], [-2, 1, 5]] },
    { name: '수정 동굴', tempo: 48, root: 64, scale: MINOR_PENTA, voice: 'glass', loops: 3, sparse: true, drone: true, cave: true,
      chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [0, 3, 7]] },
    { name: '광부의 등불', tempo: 56, root: 55, scale: DORIAN, voice: 'pluck', loops: 3, sparse: true, drone: true, cave: true,
      chords: [[0, 3, 7, 10], [5, 9, 12], [0, 3, 7, 10], [-2, 2, 5]] },
  ],
};

// 한 마디(8분음표 8칸) 리듬 — 1이 음이 시작되는 자리
const CALM_RHYTHMS = [
  [1, 0, 0, 0, 1, 0, 0, 0], [1, 0, 0, 1, 0, 0, 1, 0], [1, 0, 1, 0, 1, 0, 0, 0],
  [0, 0, 1, 0, 1, 0, 0, 0], [1, 0, 0, 0, 1, 0, 1, 0], [1, 0, 0, 0, 0, 0, 1, 0],
];
const SPARSE_RHYTHMS = [
  [1, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 1, 0, 0, 0], [0, 0, 1, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 1, 0],
];
// 마을 곡: 통통 튀는 리듬 (엇박 포함) / 자장가: 느긋한 리듬 / 마디 끝맺음
const CHEER_RHYTHMS = [
  [1, 0, 1, 1, 0, 1, 0, 0], [1, 0, 0, 1, 1, 0, 1, 0], [1, 1, 0, 1, 0, 0, 1, 0], [1, 0, 1, 0, 1, 1, 1, 0], [0, 0, 1, 1, 1, 0, 1, 0],
];
const LULL_RHYTHMS = [[1, 0, 0, 1, 0, 0, 1, 0], [1, 0, 1, 0, 1, 0, 0, 0], [1, 0, 0, 0, 1, 0, 1, 0]];
const END_RHYTHM = [1, 0, 1, 0, 1, 0, 0, 0];

// ───────── 작업 소리 ─────────
// 동작 한 번(0~1) 안에서 소리가 나는 시점. 동작이 여러 번 반복되면 매번 난다
const WORK_HITS = {
  till: [{ at: 0.42, snd: 'whoosh' }, { at: 0.6, snd: 'hoeHit' }],
  mine: [{ at: 0.42, snd: 'whooshLow' }, { at: 0.6, snd: 'pickHit' }],
  water: [{ at: 0.36, snd: 'pour' }],
  plant: [{ at: 0.28, snd: 'rustle' }, { at: 0.56, snd: 'seeds' }],
  harvest: [{ at: 0.3, snd: 'rustle' }, { at: 0.46, snd: 'sickleSwish' }, { at: 0.52, snd: 'snip' }],
  cast: [{ at: 0.38, snd: 'rodWhoosh' }, { at: 0.62, snd: 'lineOut' }],
  reel: [{ at: 0.0, snd: 'reelFast' }, { at: 0.3, snd: 'waterOut' }],
  swing: [{ at: 0.45, snd: 'whoosh' }],
};
const ENGINE_HITS = [{ at: 0, snd: 'engine' }, { at: 0.33, snd: 'engine' }, { at: 0.66, snd: 'engine' }];

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pc = (n) => ((n % 12) + 12) % 12;

export const AudioManager = {
  ctx: null,
  started: false,
  period: null,
  nextNote: 0,
  song: null,
  lastSong: {},
  birdTimer: 3,
  streamTimer: 0,
  bubbleTimer: 0,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);

    // BGM: bgmBus(곡 페이드) → 부드러운 저역 필터 → bgmGain(설정 음량), 메아리(딜레이)를 살짝 섞는다
    this.bgmGain = ctx.createGain();
    this.bgmGain.connect(this.master);
    this.bgmTone = ctx.createBiquadFilter();
    this.bgmTone.type = 'lowpass';
    this.bgmTone.frequency.value = 2600;
    this.bgmTone.connect(this.bgmGain);
    this.bgmBus = ctx.createGain();
    this.bgmBus.gain.value = 0;
    this.bgmBus.connect(this.bgmTone);
    this.echo = ctx.createDelay(2);
    this.echoFb = ctx.createGain();
    this.echoWet = ctx.createGain();
    this.bgmBus.connect(this.echo);
    this.echo.connect(this.echoFb).connect(this.echo);
    this.echo.connect(this.echoWet).connect(this.bgmTone);

    this.sfxGain = ctx.createGain();
    this.sfxGain.connect(this.master);
    this.fx = createSfx(ctx, this.sfxGain);
    this.voicePitch = 260;
    this.ambGain = ctx.createGain();
    this.ambGain.connect(this.master);
    this.applyVolumes();

    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    // 빗소리·바람 소리의 크기(AudioParam)
    this.rainLoop = this.makeLoop('bandpass', 1400, 0.6).gain.gain;
    this.windLoop = this.makeLoop('lowpass', 300, 1).gain.gain;
    this.makeStream();
  },

  makeLoop(type, freq, q) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(this.ambGain);
    src.start(0, Math.random());
    return { gain: g, filter: f };
  },

  /** 졸졸 흐르는 시냇물: 주파수가 계속 흔들리는 물소리 둘 + 낮은 물살 (가끔 보글 소리는 updateAmbient 에서) */
  makeStream() {
    this.streamGain = this.ctx.createGain();
    this.streamGain.gain.value = 0;
    this.streamGain.connect(this.ambGain);
    const layer = (type, freq, q, vol) => {
      const l = this.makeLoop(type, freq, q);
      l.gain.disconnect();
      l.gain.connect(this.streamGain);
      l.gain.gain.value = vol;
      return l;
    };
    this.streamBands = [layer('bandpass', 900, 2.2, 0.9), layer('bandpass', 1700, 3, 0.55)];
    layer('lowpass', 380, 0.7, 0.5);
  },

  resume() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (!this.started) {
      this.started = true;
      this.nextNote = this.ctx.currentTime + 0.5;
      setInterval(() => this.schedule(), 60);
    }
  },

  applyVolumes() {
    if (!this.ctx) return;
    // 예전보다 BGM 기본 음량을 약 1/3 로 (곡 자체도 더 작고 부드럽게) — 효과음·환경음이 묻히지 않게
    this.bgmGain.gain.value = G.settings.bgm * 0.6;
    this.sfxGain.gain.value = G.settings.sfx;
    this.ambGain.gain.value = G.settings.sfx * 0.8;
  },

  tone(freq, dur, { type = 'sine', vol = 0.2, attack = 0.01, when = 0, dest, slideTo } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  },

  /** 걸러 낸 잡음 한 번. sweepTo: 필터 주파수를 끝까지 옮김(휙 소리), hold: 그동안 크기를 유지(물 붓기 등) */
  noise(dur, { type = 'lowpass', freq = 1000, vol = 0.2, when = 0, q = 1, sweepTo, attack = 0, hold = 0, dest } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    if (attack) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + attack);
    } else {
      g.gain.setValueAtTime(vol, t);
    }
    if (hold) g.gain.setValueAtTime(vol, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, attack + hold + 0.05));
    src.connect(f).connect(g).connect(dest || this.sfxGain);
    src.start(t, Math.random());
    src.stop(t + Math.max(dur, attack + hold + 0.05) + 0.05);
  },

  /** 효과음 — 실제 소리는 Sfx.js 의 재질별 합성 소리 */
  sfx(name, opt = {}) {
    if (!this.ctx || this.ctx.state !== 'running' || !this.fx) return;
    if (name === 'talk') return this.fx.voice(this.voicePitch);
    this.fx.play(name, opt);
  },

  /** 말하는 사람이 바뀌면 목소리 높이를 정한다 (이름마다 늘 같은 높이) */
  setVoice(name = '') {
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    this.voicePitch = 170 + (h % 9) * 28;
  },

  /** 공간에 맞는 잔향: 'outdoor' · 'room' · 'cave' */
  setSpace(space) {
    if (!this.fx || space === this.space) return;
    this.space = space;
    this.fx.setSpace(space);
  },

  /** 매 프레임: 걷는 박자(walkT 반주기)마다 바닥 재질에 맞는 발소리 */
  updateSteps(walkT, moving, surface) {
    if (!this.fx || !this.ctx || this.ctx.state !== 'running') return;
    const k = Math.floor(walkT / Math.PI);
    if (k === this.lastStep) return;
    this.lastStep = k;
    if (moving > 0.5 && surface) this.fx.step(surface);
  },
  /** 매 프레임: 작업 동작의 박자(WORK_HITS)에 맞춰 도구 소리를 낸다 */
  updateWork(work, vehicle = false) {
    if (!work) return;
    if (!this.ctx || this.ctx.state !== 'running') return;
    const phase = Math.min(1, work.t / work.dur) * work.cycles;
    const last = work._snd ?? -1e-6;
    work._snd = phase;
    if (phase <= last) return;
    const hits = vehicle ? [...ENGINE_HITS, ...(WORK_HITS[work.motion] || []).slice(-1)] : WORK_HITS[work.motion] || WORK_HITS.swing;
    const cycleLen = work.dur / work.cycles;
    for (let c = Math.floor(last); c <= Math.floor(phase); c++) {
      if (c >= work.cycles) break;
      for (const h of hits) {
        const at = c + h.at;
        if (at > last && at <= phase) this.sfx(h.snd, { dur: cycleLen * 0.42 });
      }
    }
  },

  // ───────── BGM 진행 ─────────
  setPeriod(period) {
    if (!this.ctx || period === this.period) return;
    const first = this.period === null;
    this.period = period;
    if (first) return;
    // 지금 곡은 서서히 줄이고, 잠시 뒤 새 분위기의 곡을 시작
    const t = this.ctx.currentTime;
    this.fadeBus(0, t, 1.5);
    this.song = null;
    this.nextNote = t + 2.2;
  },

  fadeBus(to, t, len) {
    const g = this.bgmBus.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(to, t + len);
  },

  startSong(t) {
    const list = SONGS[this.period] || SONGS.day;
    let i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && i === this.lastSong[this.period]) i = (i + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length;
    this.lastSong[this.period] = i;
    const def = list[i];
    const stepDur = 60 / def.tempo / 2;
    this.song = def.style
      ? { def, step: 0, stepDur, plan: this.planTune(def) }
      : { def, step: 0, stepDur, bars: def.chords.length * def.loops, motif: [], prev: def.root + 7 };
    // 마을 곡은 메아리를 아주 살짝(또렷하게), 동굴 곡은 길게 · 어둡게
    const ct = this.ctx.currentTime;
    const [fb, wet, tone] = def.cave ? [0.48, 0.42, 1700] : def.style === 'lullaby' ? [0.2, 0.12, 3000] : def.style ? [0.14, 0.07, 3800] : [0.25, 0.18, 2600];
    this.echo.delayTime.setTargetAtTime(Math.min(1.5, stepDur * 3), ct, 0.1);
    this.echoFb.gain.setTargetAtTime(fb, ct, 0.3);
    this.echoWet.gain.setTargetAtTime(wet, ct, 0.3);
    this.bgmTone.frequency.setTargetAtTime(tone, ct, 0.3);
    const g = this.bgmBus.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(1, t + (def.style ? 0.6 : 2.5));
  },

  // ───────── 마을 곡 ─────────
  /**
   * 곡 전체 악보를 미리 만든다: 전주 1마디 → [A · A' · B · A'] (4마디 진행이면 두 번) → 끝맺음 1마디.
   * 같은 멜로디가 되풀이되어 귀에 붙고, A' 와 마지막은 으뜸음으로 끝나 안정감 있게 마무리된다.
   */
  planTune(def) {
    const L = def.chords.length;
    const chordsB = Array.from({ length: L }, (_, i) => [IV, I, II, V][i % 4]);
    // 멜로디 음역: 기준음 아래 4도 ~ 위 한 옥타브 (너무 높아 귀가 따갑지 않도록)
    const base = def.root + (def.root < (def.style === 'lullaby' ? 66 : 64) ? 12 : 0);
    const pool = [];
    for (let n = base - 5; n <= base + 12; n++) if (MAJOR_PENTA.includes(pc(n - def.root))) pool.push(n);
    const rhythms = def.style === 'lullaby' ? LULL_RHYTHMS : CHEER_RHYTHMS;
    const tune = { pool, root: def.root, prev: base + 4, dir: 1 };
    // A: 앞 마디들은 한 번만 만들고, 끝 마디만 '열린 끝'(다음으로 이어짐)과 '닫힌 끝'(으뜸음) 두 가지
    const rA = [pick(rhythms), pick(rhythms)];
    const headA = def.chords.slice(0, -1).map((c, i) => this.tuneBar(tune, c, rA[i % 2], i === 0));
    const save = tune.prev;
    const openA = this.tuneBar(tune, def.chords[L - 1], END_RHYTHM, false, 'open');
    tune.prev = save;
    const closeA = this.tuneBar(tune, def.chords[L - 1], END_RHYTHM, false, 'close');
    // B: 리듬 · 음역을 조금 바꿔 분위기 전환 (조금 높게 시작)
    tune.prev = base + 9;
    const rB = [pick(rhythms), pick(rhythms)];
    const melB = chordsB.map((c, i) => this.tuneBar(tune, c, i === L - 1 ? END_RHYTHM : rB[i % 2], i === 0, i === L - 1 ? 'open' : null));
    const sec = (chords, mel) => chords.map((chord, i) => ({ chord, mel: mel[i] }));
    const A1 = sec(def.chords, [...headA, openA]);
    const A2 = sec(def.chords, [...headA, closeA]);
    const B = sec(chordsB, melB);
    const plan = [{ chord: def.chords[0], mel: [], intro: true }];
    for (let r = 0; r < (L <= 4 ? 2 : 1); r++) plan.push(...A1, ...A2, ...B, ...A2);
    const rootNote = pool.reduce((a, b) => (pc(b - def.root) === 0 && Math.abs(b - base) < Math.abs(a - base) ? b : a), base);
    plan.push({ chord: I, mel: [{ step: 0, len: 8, note: rootNote }], outro: true });
    return plan;
  },

  /** 한 마디 멜로디: 강박은 화음 음, 사이는 음계를 따라 한 칸씩 오르내림. end 'open'|'close' 면 마지막 음을 정해 끝맺음 */
  tuneBar(tune, chord, rhythm, leap, end = null) {
    const { pool, root } = tune;
    const chordPcs = chord.map((c) => pc(c));
    const near = (cands) => cands.reduce((a, b) => (Math.abs(b - tune.prev) < Math.abs(a - tune.prev) ? b : a), cands[0]);
    const starts = rhythm.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
    return starts.map((step, k) => {
      const len = (starts[k + 1] ?? 8) - step;
      const last = k === starts.length - 1;
      let note;
      if (end && last) {
        // 닫힌 끝: 으뜸음(화음에 없으면 화음의 근음) / 열린 끝: 으뜸음이 아닌 화음 음
        const want = end === 'close' ? (chordPcs.includes(0) ? [0] : [chordPcs[0]]) : chordPcs.filter((p) => p !== 0);
        note = near(pool.filter((n) => want.includes(pc(n - root))));
      } else if (step === 0 || step === 4) {
        const cands = pool.filter((n) => chordPcs.includes(pc(n - root)));
        note = leap && step === 0 ? pick(cands.filter((n) => Math.abs(n - tune.prev) <= 9)) ?? near(cands) : near(cands);
      } else {
        let idx = pool.indexOf(near(pool));
        if (idx <= 1) tune.dir = 1;
        else if (idx >= pool.length - 2) tune.dir = -1;
        else if (Math.random() < 0.3) tune.dir = -tune.dir;
        idx += tune.dir * (Math.random() < 0.8 ? 1 : 2);
        note = pool[Math.max(0, Math.min(pool.length - 1, idx))];
      }
      tune.prev = note;
      return { step, len, note };
    });
  },

  /** 마을 곡의 8분음표 한 칸 */
  playTune(t) {
    const s = this.song;
    const d = s.def;
    const bar = Math.floor(s.step / 8);
    const inBar = s.step % 8;
    const barDur = s.stepDur * 8;
    if (bar >= s.plan.length) {
      this.song = null;
      this.nextNote = t + 2 + Math.random() * 3;
      return false;
    }
    const p = s.plan[bar];
    const chord = p.chord;
    const r = d.root;
    if (inBar === 0 && p.outro) this.fadeBus(0, t + barDur * 0.5, barDur * 1.5);
    const guitar = (c) => r - 12 + c;

    if (d.style === 'lullaby') {
      // 기타 분산화음(아르페지오) + 낮은 베이스 + 오르골 멜로디
      if (!p.outro || inBar < 4) {
        const tones = [guitar(chord[0]), guitar(chord[1]), guitar(chord[2]), guitar(chord[0] + 12)];
        this.pluckAt(midi(tones[[0, 1, 2, 3, 2, 1, 2, 1][inBar]]), 0.024, t, 1.2);
      }
      if (inBar === 0) this.noteAt(midi(r - 24 + chord[0]), barDur * 0.9, 'triangle', 0.035, t, 0.03);
      for (const n of p.mel) if (n.step === inBar) this.musicBoxAt(midi(n.note), Math.min(2, s.stepDur * n.len * 2), 0.05, t);
      return true;
    }

    // 기타 스트럼: 짝수 칸은 아래로(굵게), 홀수 칸은 위로(가볍게)
    const strumSteps = p.outro ? [0] : d.strum;
    if (strumSteps.includes(inBar)) {
      const notes = [guitar(chord[0]) - (chord[0] >= 5 ? 12 : 0), guitar(chord[0]), guitar(chord[1]), guitar(chord[2])];
      const up = inBar % 2 === 1;
      const order = up ? notes.slice(1).reverse() : notes;
      order.forEach((n, k) => this.pluckAt(midi(n), up ? 0.014 : 0.022, t + k * 0.013, p.outro ? 2 : 0.9));
    }
    // 통통 베이스: 1박 근음, 3박 5도
    if (inBar === 0) this.noteAt(midi(r - 24 + chord[0]), s.stepDur * 3, 'triangle', 0.055, t, 0.006);
    if (inBar === 4 && !p.outro) this.noteAt(midi(r - 24 + chord[0] + 7), s.stepDur * 2.5, 'triangle', 0.045, t, 0.006);
    // 가벼운 셰이커 · 우드블록
    if (d.perc && !p.intro && !p.outro) {
      this.shakerAt(inBar % 2 ? 0.012 : 0.005, t);
      if (inBar === 6 || (inBar === 3 && bar % 2)) this.blockAt(inBar === 6 ? 1250 : 1650, 0.016, t);
    }
    // 마림바 멜로디
    for (const n of p.mel) if (n.step === inBar) this.marimbaAt(midi(n.note), Math.min(1.1, s.stepDur * n.len * 1.6), 0.06, t);
    return true;
  },

  /** 마림바: 맑은 기본음 + 금방 사라지는 높은 배음 */
  marimbaAt(freq, dur, vol, t) {
    this.noteAt(freq, Math.max(0.35, dur), 'sine', vol, t, 0.004);
    this.noteAt(freq * 3.99, 0.09, 'sine', vol * 0.22, t, 0.002);
  },

  /** 오르골: 맑고 길게 울리는 종소리 */
  musicBoxAt(freq, dur, vol, t) {
    this.noteAt(freq, Math.max(0.8, dur), 'sine', vol, t, 0.003);
    this.noteAt(freq * 2, 0.5, 'sine', vol * 0.25, t, 0.003);
    this.noteAt(freq * 5.4, 0.12, 'sine', vol * 0.06, t, 0.002);
  },

  /** 통기타 한 줄 (Karplus-Strong 으로 만든 소리를 음높이별로 저장해 두고 재생) */
  pluckAt(freq, vol, t, dur = 1) {
    const key = Math.round(freq);
    this.ksCache ||= {};
    let buf = this.ksCache[key];
    if (!buf) {
      const sr = this.ctx.sampleRate;
      const len = Math.floor(sr * 2);
      buf = this.ksCache[key] = this.ctx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      const N = Math.max(2, Math.round(sr / freq));
      let lp = 0;
      for (let i = 0; i < N; i++) d[i] = lp = lp * 0.5 + (Math.random() * 2 - 1) * 0.5;
      const decay = freq < 150 ? 0.997 : 0.994;
      for (let i = N; i < len; i++) d[i] = decay * 0.5 * (d[i - N] + d[i - N + 1]);
      let peak = 0;
      for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
      for (let i = 0; i < len; i++) d[i] /= peak || 1;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.setTargetAtTime(0, t + dur, 0.15);
    src.connect(g).connect(this.bgmBus);
    src.start(t);
    src.stop(t + dur + 0.8);
  },

  /** 셰이커: 아주 짧은 높은 '칙' */
  shakerAt(vol, t) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    src.connect(f).connect(g).connect(this.bgmBus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + 0.09);
  },

  /** 우드블록: 짧고 둥근 '톡' */
  blockAt(freq, vol, t) {
    this.noteAt(freq, 0.06, 'sine', vol, t, 0.001);
    this.noteAt(freq * 2.3, 0.025, 'sine', vol * 0.4, t, 0.001);
  },

  schedule() {
    if (!this.ctx || this.ctx.state !== 'running' || !this.period) return;
    // 탭이 오래 쉬었다 돌아오면 밀린 음을 몰아서 내지 않도록
    if (this.nextNote < this.ctx.currentTime - 1) this.nextNote = this.ctx.currentTime + 0.1;
    while (this.nextNote < this.ctx.currentTime + 0.3) {
      if (!this.song) this.startSong(this.nextNote);
      if (!this.playStep(this.nextNote)) continue;
      this.nextNote += this.song.stepDur;
      this.song.step++;
    }
  },

  /** 8분음표 한 칸 재생. 곡이 끝났으면 쉬는 시간을 두고 false */
  playStep(t) {
    if (this.song.def.style) return this.playTune(t);
    const s = this.song;
    const d = s.def;
    const bar = Math.floor(s.step / 8);
    const inBar = s.step % 8;
    const barDur = s.stepDur * 8;
    if (bar >= s.bars) {
      // 곡 끝 → 몇 초 조용히 쉬었다가 다른 곡
      this.song = null;
      this.nextNote = t + 4 + Math.random() * 6;
      return false;
    }
    const ci = bar % d.chords.length;
    const chord = d.chords[ci];
    if (inBar === 0 && bar === s.bars - 1) this.fadeBus(0, t, barDur + 1.5);

    if (inBar === 0) {
      // 잔잔한 화음 패드 + 베이스
      for (const c of chord.slice(0, 3)) this.padAt(midi(d.root - 12 + c), barDur * 1.15, 0.011, t);
      this.noteAt(midi(d.root - 24 + chord[0]), barDur * 0.95, 'triangle', d.cave ? 0.04 : 0.03, t, 0.04);
      if (d.drone && bar % 2 === 0) this.padAt(midi(d.root - 24), barDur * 2.2, 0.02, t, 1.5);
    }
    if (!d.sparse && inBar === 4 && Math.random() < 0.5) {
      this.noteAt(midi(d.root - 24 + chord[0] + 7), barDur * 0.45, 'triangle', 0.02, t, 0.04);
    }
    // 뮤직박스처럼 아주 작은 분산화음
    if (d.arp && inBar % 2 === 1 && Math.random() < 0.7) {
      const n = chord[[0, 1, 2, 1][(inBar >> 1) % 4] % chord.length];
      this.voiceAt('bell', midi(d.root + 12 + n), s.stepDur * 3, d.arp, t);
    }

    // 멜로디: 첫 반복에서 만든 마디를 다음 반복 때 조금씩 바꿔 가며 쓴다
    if (inBar === 0) {
      const loop = Math.floor(bar / d.chords.length);
      let m = s.motif[ci];
      if (!m || (loop > 0 && Math.random() < 0.35)) m = s.motif[ci] = this.genBar(d, chord, ci);
      // 마지막 반복은 멜로디를 덜어 내 자연스럽게 끝나도록
      s.cur = loop === d.loops - 1 && ci >= d.chords.length - 2 ? m.filter((n) => n.step === 0) : m;
    }
    for (const n of s.cur || []) {
      if (n.step === inBar) this.voiceAt(d.voice, midi(n.note), s.stepDur * n.len * 1.7, d.sparse ? 0.042 : 0.048, t);
    }
    return true;
  },

  /** 한 마디의 멜로디 생성: 강박은 화음 음, 나머지는 음계를 따라 한두 칸씩 */
  genBar(d, chord, ci) {
    const s = this.song;
    let rhythm = pick(d.sparse ? SPARSE_RHYTHMS : CALM_RHYTHMS);
    // 4마디마다 끝은 길게 끌거나 쉰다 (숨 쉬는 자리)
    if (ci % 4 === 3) rhythm = Math.random() < 0.35 ? [0, 0, 0, 0, 0, 0, 0, 0] : [1, 0, 0, 0, 0, 0, 0, 0];
    const pool = [];
    for (let o = 0; o < 2; o++) for (const sc of d.scale) pool.push(d.root + sc + o * 12);
    pool.push(d.root + 24);
    const chordPcs = chord.map((c) => pc(d.root + c));
    const notes = [];
    const starts = rhythm.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
    starts.forEach((step, k) => {
      const len = (starts[k + 1] ?? 8) - step;
      let note;
      if (step === 0 || step === 4) {
        const cands = pool.filter((n) => chordPcs.includes(pc(n)));
        note = cands.reduce((a, b) => (Math.abs(b - s.prev) < Math.abs(a - s.prev) ? b : a), cands[0] ?? s.prev);
        if (Math.random() < 0.3) note = pick(cands);
      } else {
        let idx = pool.indexOf(pool.reduce((a, b) => (Math.abs(b - s.prev) < Math.abs(a - s.prev) ? b : a)));
        idx += pick([-2, -1, -1, 1, 1, 2]);
        note = pool[Math.max(0, Math.min(pool.length - 1, idx))];
      }
      s.prev = note;
      notes.push({ step, len, note });
    });
    return notes;
  },

  /** 멜로디 음색 */
  voiceAt(voice, freq, dur, vol, t) {
    if (voice === 'bell') {
      this.noteAt(freq, dur * 1.3, 'sine', vol, t, 0.01);
      this.noteAt(freq * 2, dur * 0.6, 'sine', vol * 0.18, t, 0.01);
    } else if (voice === 'glass') {
      this.noteAt(freq, dur * 1.6, 'sine', vol * 0.9, t, 0.02);
      this.noteAt(freq * 3.01, dur * 0.5, 'sine', vol * 0.1, t, 0.01);
    } else if (voice === 'flute') {
      this.padAt(freq, dur, vol * 0.85, t, Math.min(0.12, dur * 0.3));
    } else {
      this.noteAt(freq, dur, 'triangle', vol * 0.9, t, 0.008);
    }
  },

  /** 톡 치고 서서히 사라지는 음 */
  noteAt(freq, dur, type, vol, t, attack = 0.02) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.bgmBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  },

  /** 천천히 차오르고 유지되다 사라지는 음 (패드·플루트) */
  padAt(freq, dur, vol, t, attack = 0.6) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, t + Math.max(attack, dur * 0.65));
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(this.bgmBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  },

  // weather, distToStream, period 를 받아 환경음 조절
  updateAmbient(dt, { weather, distToStream, period, indoor = false, room = null }) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    if (room) {
      // 집 · 마을회관 안: 바깥 소리는 먹먹하게(빗소리만 작게), 집에서는 벽난로가 타닥타닥
      this.rainLoop.setTargetAtTime(weather === 'rain' ? 0.07 : 0, t, 0.5);
      this.streamGain.gain.setTargetAtTime(0, t, 0.4);
      this.windLoop.setTargetAtTime(0.012, t, 1);
      if (room === 'house') {
        this.birdTimer -= dt;
        if (this.birdTimer <= 0) {
          this.birdTimer = 0.08 + Math.random() * 0.5;
          this.noise(0.03 + Math.random() * 0.04, { type: 'bandpass', freq: 1500 + Math.random() * 2500, vol: 0.02 + Math.random() * 0.04, dest: this.ambGain });
          if (Math.random() < 0.15) this.noise(0.25, { freq: 220, vol: 0.05, dest: this.ambGain });
        }
      }
      return;
    }
    if (indoor) {
      // 광산 안: 낮은 바람 소리와 가끔 똑똑 떨어지는 물방울
      this.rainLoop.setTargetAtTime(0, t, 0.5);
      this.streamGain.gain.setTargetAtTime(0, t, 0.5);
      this.windLoop.setTargetAtTime(0.06, t, 1);
      this.birdTimer -= dt;
      if (this.birdTimer <= 0) {
        this.birdTimer = 2 + Math.random() * 5;
        this.tone(1400 + Math.random() * 800, 0.12, { vol: 0.025, slideTo: 600, dest: this.ambGain });
      }
      return;
    }
    const rain = weather === 'rain' ? 0.25 : 0;
    this.rainLoop.setTargetAtTime(rain, t, 0.5);

    // 시냇물: 예전보다 훨씬 작게, 가까이 가야 들리는 졸졸 소리
    const near = Math.max(0, 1 - distToStream / 14);
    // 기본 크기를 예전의 1/5 로 (0.13 → 0.026)
    this.streamGain.gain.setTargetAtTime(near * near * 0.026, t, 0.4);
    if (near > 0) {
      this.streamTimer -= dt;
      if (this.streamTimer <= 0) {
        // 물살이 바위에 부딪히며 소리 높낮이가 계속 바뀐다
        this.streamTimer = 0.06 + Math.random() * 0.1;
        const [a, b] = this.streamBands;
        a.filter.frequency.setTargetAtTime(650 + Math.random() * 700, t, 0.06);
        b.filter.frequency.setTargetAtTime(1400 + Math.random() * 1100, t, 0.05);
        a.gain.gain.setTargetAtTime(0.6 + Math.random() * 0.5, t, 0.08);
      }
      this.bubbleTimer -= dt;
      if (near > 0.2 && this.bubbleTimer <= 0) {
        this.bubbleTimer = 0.1 + Math.random() * 0.35;
        const f = 380 + Math.random() * 700;
        this.tone(f, 0.05 + Math.random() * 0.05, { vol: 0.0024 * near, slideTo: f * (1.5 + Math.random() * 0.5), dest: this.ambGain });
      }
    }

    const wind = 0.04 + Math.sin(t * 0.3) * 0.03 + (weather === 'snow' ? 0.05 : 0);
    this.windLoop.setTargetAtTime(wind, t, 1);

    if (period !== 'night' && weather !== 'rain') {
      this.birdTimer -= dt;
      if (this.birdTimer <= 0) {
        this.birdTimer = 4 + Math.random() * 8;
        const base = 2200 + Math.random() * 1500;
        const count = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
          this.tone(base, 0.09, { vol: 0.03, when: i * 0.13, slideTo: base * 1.3, dest: this.ambGain });
        }
      }
    }
  },
};
