/* =========================================================
   VNXX — SYSTEMS / SOUND
   WebAudio synth: SFX + nhạc nền procedural.
   Không import Game → chỉ đọc Settings.
   ========================================================= */

import Settings from '../core/settings.js';

/* =========================================================
   PATTERN NHẠC NỀN
   Mỗi pattern: bpm, bass (8 step), lead (8 step), sóng.
   null = nghỉ. Số = bán cung so với gốc.
   ========================================================= */
const MUSIC_PATTERNS = {
  menu: {
    bpm: 84,
    bass: [0, null, -5, null, 3, null, -2, null],
    lead: [12, 15, 12, 10, 12, 7, 5, 7],
    wave: 'triangle'
  },
  game: {
    bpm: 118,
    bass: [0, 0, 3, null, 5, 5, -2, null],
    lead: [12, 10, 7, 10, 12, 15, 14, 12],
    wave: 'triangle'
  },
  boss: {
    bpm: 146,
    bass: [0, 0, 0, -1, 0, 0, -3, -1],
    lead: [12, 13, 12, 10, 12, 15, 17, 15],
    wave: 'sawtooth'
  },
  over: {
    bpm: 66,
    bass: [0, null, -2, null, -4, null, -5, null],
    lead: [],
    wave: 'sine'
  }
};

/* =========================================================
   SOUND MODULE
   ========================================================= */
const Sound = {
  ctx: null,
  master: null,
  musicGain: null,
  sfxGain: null,
  ready: false,

  /* Trạng thái nhạc */
  musicTimer: null,
  step: 0,
  nextTime: 0,
  curPattern: null,
  curName: null,

  /* =========================================================
     INIT / RESUME
     ========================================================= */
  init() {
    if (this.ready) return;

    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;

      this.ctx = new AC();

      /* Bus trung tâm */
      this.master = this.ctx.createGain();
      this.master.gain.value = (Settings.get('masterVol') / 100) * .9;
      this.master.connect(this.ctx.destination);

      /* Bus nhạc */
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = (Settings.get('musicVol') / 100) * .5;
      this.musicGain.connect(this.master);

      /* Bus SFX */
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = (Settings.get('sfxVol') / 100) * .7;
      this.sfxGain.connect(this.master);

      this.ready = true;
    } catch (err) {
      console.warn('[Sound] init failed:', err);
    }
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  },

  /* =========================================================
     VOLUME SETTERS
     ========================================================= */
  setMaster(v) {
    if (this.master) this.master.gain.value = (v / 100) * .9;
  },
  setMusicVol(v) {
    if (this.musicGain) this.musicGain.gain.value = (v / 100) * .5;
  },
  setSfxVol(v) {
    if (this.sfxGain) this.sfxGain.gain.value = (v / 100) * .7;
  },

  /* =========================================================
     SFX PRIMITIVES
     ========================================================= */
  tone(freq, dur, type, vol, delay = 0, slideTo) {
    if (!this.ready || !Settings.get('sfxOn')) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) {
      o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    }

    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol || .16, t + .008);
    g.gain.exponentialRampToValueAtTime(.0008, t + dur);

    o.connect(g);
    g.connect(this.sfxGain);
    o.start(t);
    o.stop(t + dur + .03);
  },

  noise(dur, vol, filterFreq) {
    if (!this.ready || !Settings.get('sfxOn')) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);

    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 1800;

    const g = this.ctx.createGain();
    g.gain.value = vol || .12;

    src.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    src.start(t);
  },

  /* =========================================================
     SFX DISPATCH
     ========================================================= */
  sfx(kind) {
    if (!this.ready || !Settings.get('sfxOn')) return;

    switch (kind) {
      case 'attack':
        this.tone(720, .07, 'square', .08, 0, 320);
        break;
      case 'shoot':
        this.tone(880, .05, 'square', .07, 0, 300);
        break;
      case 'shotgun':
        this.noise(.14, .16, 2400);
        this.tone(160, .12, 'sawtooth', .08);
        break;
      case 'sniper':
        this.tone(1400, .18, 'sawtooth', .13, 0, 180);
        this.noise(.2, .1, 3000);
        break;
      case 'hit':
        this.noise(.06, .11, 2600);
        this.tone(340, .05, 'square', .07);
        break;
      case 'crit':
        this.tone(1300, .1, 'square', .13, 0, 600);
        this.noise(.07, .1, 3400);
        break;
      case 'enemyDeath':
        this.noise(.22, .14, 1400);
        this.tone(180, .2, 'sawtooth', .09, 0, 60);
        break;
      case 'playerHit':
        this.tone(200, .16, 'sawtooth', .14, 0, 80);
        this.noise(.1, .1, 900);
        break;
      case 'pickup':
        this.tone(1100, .06, 'sine', .08, 0, 1500);
        break;
      case 'levelup':
        [523, 659, 784, 1046].forEach((f, i) =>
          this.tone(f, .18, 'sine', .11, i * .075)
        );
        break;
      case 'shop':
        this.tone(660, .08, 'sine', .09);
        this.tone(990, .1, 'sine', .08, .07);
        break;
      case 'button':
        this.tone(560, .045, 'square', .06);
        break;
      case 'boss':
        this.tone(90, .7, 'sawtooth', .17, 0, 45);
        this.noise(.6, .13, 700);
        break;
      case 'warning':
        this.tone(420, .3, 'square', .12);
        this.tone(420, .3, 'square', .12, .36);
        break;
      case 'explosion':
        this.noise(.4, .2, 900);
        this.tone(70, .4, 'sawtooth', .16, 0, 32);
        break;
      case 'dash':
        this.tone(300, .14, 'sine', .09, 0, 900);
        break;
      case 'chest':
        [659, 880, 1174].forEach((f, i) =>
          this.tone(f, .2, 'triangle', .1, i * .09)
        );
        break;
      case 'death':
        [400, 330, 260, 180].forEach((f, i) =>
          this.tone(f, .35, 'sawtooth', .13, i * .16)
        );
        break;
      case 'achievement':
        [784, 988, 1318].forEach((f, i) =>
          this.tone(f, .22, 'sine', .11, i * .1)
        );
        break;
      case 'event':
        this.tone(320, .35, 'sine', .11, 0, 520);
        break;
      default:
        break;
    }
  },

  /* =========================================================
     MUSIC (procedural, không dùng file mp3)
     ========================================================= */
  startMusic(name) {
    if (!this.ready) return;
    if (this.curName === name && this.musicTimer) return;

    this.stopMusic();
    this.curName = name;
    this.curPattern = MUSIC_PATTERNS[name] || MUSIC_PATTERNS.game;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + .05;
    this.musicTimer = setInterval(() => this.musicTick(), 60);
  },

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.curName = null;
  },

  musicTick() {
    if (!this.ready || !this.curPattern) return;
    if (!Settings.get('musicOn')) return;

    const spb = 60 / this.curPattern.bpm;
    const stepDur = spb / 2;

    while (this.nextTime < this.ctx.currentTime + .25) {
      this.playStep(this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 8;
    }
  },

  playStep(i, t, dur) {
    const P = this.curPattern;

    /* Bass */
    const bass = P.bass[i];
    if (bass !== null && bass !== undefined) {
      const f = 55 * Math.pow(2, bass / 12);
      this.mnote(f, t, dur * 1.7, 'sawtooth', .24, 600);
    }

    /* Lead */
    const lead = P.lead[i];
    if (lead !== null && lead !== undefined) {
      const f = 220 * Math.pow(2, lead / 12);
      this.mnote(f, t, dur * .9, P.wave || 'triangle', .11, 3200);
    }

    /* Kick đơn giản mỗi 2 step */
    if (i % 2 === 0) {
      this.mnote(70, t, .05, 'square', .05, 400);
    }
  },

  mnote(freq, t, dur, type, vol, cutoff) {
    if (!this.ctx || !this.musicGain) return;

    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();

    o.type = type;
    o.frequency.setValueAtTime(freq, t);

    f.type = 'lowpass';
    f.frequency.value = cutoff || 2000;

    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + .012);
    g.gain.exponentialRampToValueAtTime(.0008, t + dur);

    o.connect(f);
    f.connect(g);
    g.connect(this.musicGain);
    o.start(t);
    o.stop(t + dur + .03);
  }
};

export default Sound;