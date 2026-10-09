import { G } from './Game.js';

// 사운드 파일 없이 Web Audio API로 BGM·환경음·효과음을 생성
const PATTERNS = {
  morning: { tempo: 92,  root: 60, wave: 'triangle', decay: 0.9, melodyVol: 0.07, chords: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]] },
  day:     { tempo: 104, root: 62, wave: 'sine',     decay: 0.6, melodyVol: 0.08, chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]] },
  night:   { tempo: 66,  root: 72, wave: 'sine',     decay: 1.6, melodyVol: 0.05, chords: [[0, 3, 7], [5, 8, 12], [3, 7, 10], [7, 10, 14]] },
};

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export const AudioManager = {
  ctx: null,
  started: false,
  period: null,
  nextNote: 0,
  step: 0,
  birdTimer: 3,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.bgmGain = ctx.createGain();
    this.bgmBus = ctx.createGain();
    this.bgmBus.connect(this.bgmGain).connect(this.master);
    this.sfxGain = ctx.createGain();
    this.sfxGain.connect(this.master);
    this.ambGain = ctx.createGain();
    this.ambGain.connect(this.master);
    this.applyVolumes();

    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this.rainLoop = this.makeLoop('bandpass', 1400, 0.6);
    this.streamLoop = this.makeLoop('lowpass', 700, 1);
    this.windLoop = this.makeLoop('lowpass', 300, 1);
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
    src.start();
    return g;
  },

  resume() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (!this.started) {
      this.started = true;
      this.nextNote = this.ctx.currentTime + 0.2;
      setInterval(() => this.schedule(), 60);
    }
  },

  applyVolumes() {
    if (!this.ctx) return;
    this.bgmGain.gain.value = G.settings.bgm * 0.9;
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

  noise(dur, { type = 'lowpass', freq = 1000, vol = 0.2, when = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  },

  sfx(name) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    switch (name) {
      case 'till': this.noise(0.18, { freq: 500, vol: 0.35 }); this.tone(110, 0.12, { type: 'triangle', vol: 0.15 }); break;
      case 'water': this.noise(0.45, { type: 'highpass', freq: 2500, vol: 0.12 }); break;
      case 'plant': this.tone(520, 0.12, { type: 'triangle', vol: 0.15 }); this.tone(780, 0.15, { type: 'triangle', vol: 0.12, when: 0.07 }); break;
      case 'harvest': this.tone(400, 0.15, { vol: 0.25, slideTo: 900 }); this.tone(1200, 0.12, { vol: 0.1, when: 0.1 }); break;
      case 'coin': this.tone(988, 0.1, { type: 'square', vol: 0.06 }); this.tone(1319, 0.25, { type: 'square', vol: 0.06, when: 0.08 }); break;
      case 'click': this.tone(700, 0.05, { type: 'triangle', vol: 0.08 }); break;
      case 'talk': this.tone(600 + Math.random() * 200, 0.04, { type: 'triangle', vol: 0.05 }); break;
      case 'error': this.tone(220, 0.15, { type: 'square', vol: 0.05 }); this.tone(180, 0.2, { type: 'square', vol: 0.05, when: 0.1 }); break;
      case 'eat': this.tone(300, 0.08, { vol: 0.15 }); this.tone(380, 0.1, { vol: 0.15, when: 0.1 }); this.tone(460, 0.15, { vol: 0.15, when: 0.2 }); break;
      case 'anvil': this.tone(1800, 0.4, { type: 'square', vol: 0.05 }); this.noise(0.1, { type: 'highpass', freq: 3000, vol: 0.2 }); this.tone(1800, 0.4, { type: 'square', vol: 0.04, when: 0.25 }); break;
      case 'quest': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.12, when: i * 0.09 })); break;
      case 'rank': [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.4, { type: 'triangle', vol: 0.12, when: i * 0.1 })); break;
      case 'set': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.35, { vol: 0.1, when: i * 0.06 })); break;
      case 'sleep': [523, 440, 349, 262].forEach((f, i) => this.tone(f, 0.6, { vol: 0.1, when: i * 0.25 })); break;
      case 'fanfare': [523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.45, { type: 'triangle', vol: 0.14, when: i * 0.18 })); break;
      case 'cast': this.noise(0.25, { type: 'highpass', freq: 1800, vol: 0.12 }); this.tone(900, 0.25, { vol: 0.05, slideTo: 300 }); break;
      case 'splash': this.noise(0.35, { type: 'bandpass', freq: 900, vol: 0.25 }); break;
      case 'bite': this.tone(1046, 0.08, { type: 'square', vol: 0.07 }); this.tone(1318, 0.12, { type: 'square', vol: 0.07, when: 0.09 }); break;
      case 'catch': this.noise(0.3, { type: 'bandpass', freq: 1200, vol: 0.2 }); [659, 880, 1175].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', vol: 0.12, when: 0.1 + i * 0.08 })); break;
      case 'escape': this.tone(440, 0.2, { type: 'triangle', vol: 0.1, slideTo: 220 }); break;
      case 'pick': this.tone(2400 + Math.random() * 400, 0.12, { type: 'square', vol: 0.04 }); this.noise(0.08, { type: 'highpass', freq: 2500, vol: 0.2 }); break;
      case 'rock': this.noise(0.4, { freq: 400, vol: 0.4 }); this.tone(90, 0.3, { type: 'triangle', vol: 0.15 }); break;
      case 'brew': [0, 0.15, 0.3, 0.45].forEach((w) => this.tone(200 + Math.random() * 200, 0.08, { vol: 0.08, when: w, slideTo: 500 })); break;
      case 'door': this.noise(0.5, { freq: 300, vol: 0.25 }); this.tone(160, 0.4, { type: 'triangle', vol: 0.08 }); break;
      // 여러 사람의 박수: 짧은 잡음을 무작위 시점에 잔뜩
      case 'applause':
        for (let i = 0; i < 110; i++) {
          this.noise(0.05, { type: 'bandpass', freq: 1100 + Math.random() * 2400, vol: 0.05 + Math.random() * 0.1, when: Math.random() * 3.6 });
        }
        break;
      case 'chime': [784, 1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, 0.9, { vol: 0.07, when: i * 0.14 })); break;
      default: break;
    }
  },

  setPeriod(period) {
    if (!this.ctx || period === this.period) return;
    const t = this.ctx.currentTime;
    const first = this.period === null;
    this.period = period;
    if (first) return;
    this.bgmBus.gain.cancelScheduledValues(t);
    this.bgmBus.gain.setValueAtTime(this.bgmBus.gain.value, t);
    this.bgmBus.gain.linearRampToValueAtTime(0, t + 1.2);
    this.bgmBus.gain.linearRampToValueAtTime(1, t + 3);
  },

  schedule() {
    if (!this.ctx || this.ctx.state !== 'running' || !this.period) return;
    const p = PATTERNS[this.period];
    const stepDur = 60 / p.tempo / 2;
    while (this.nextNote < this.ctx.currentTime + 0.25) {
      const bar = Math.floor(this.step / 8) % p.chords.length;
      const chord = p.chords[bar];
      const inBar = this.step % 8;
      if (inBar === 0) {
        this.toneAt(midi(p.root - 24 + chord[0]), stepDur * 7, p.wave, 0.07, this.nextNote);
        this.toneAt(midi(p.root - 12 + chord[1]), stepDur * 7, 'sine', 0.025, this.nextNote);
      }
      if (Math.random() < (this.period === 'night' ? 0.4 : 0.6)) {
        const note = chord[Math.floor(Math.random() * chord.length)] + (Math.random() < 0.3 ? 12 : 0);
        this.toneAt(midi(p.root + note), stepDur * 2 * p.decay, p.wave, p.melodyVol, this.nextNote);
      }
      this.nextNote += stepDur;
      this.step++;
    }
  },

  toneAt(freq, dur, type, vol, t) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.bgmBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  },

  // weather, distToStream, period 를 받아 환경음 조절
  updateAmbient(dt, { weather, distToStream, period, indoor = false }) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    if (indoor) {
      // 광산 안: 낮은 바람 소리와 가끔 똑똑 떨어지는 물방울
      this.rainLoop.gain.setTargetAtTime(0, t, 0.5);
      this.streamLoop.gain.setTargetAtTime(0, t, 0.5);
      this.windLoop.gain.setTargetAtTime(0.07, t, 1);
      this.birdTimer -= dt;
      if (this.birdTimer <= 0) {
        this.birdTimer = 2 + Math.random() * 5;
        this.tone(1400 + Math.random() * 800, 0.12, { vol: 0.03, slideTo: 600, dest: this.ambGain });
      }
      return;
    }
    const rain = weather === 'rain' ? 0.25 : 0;
    this.rainLoop.gain.setTargetAtTime(rain, t, 0.5);
    const stream = Math.max(0, 1 - distToStream / 18) * 0.35;
    this.streamLoop.gain.setTargetAtTime(stream, t, 0.5);
    const wind = 0.04 + Math.sin(t * 0.3) * 0.03 + (weather === 'snow' ? 0.05 : 0);
    this.windLoop.gain.setTargetAtTime(wind, t, 1);

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
