/* =========================================================
   VNXX — SYSTEMS / SOUND
   WebAudio synth: SFX + nhạc nền procedural.
   Không import Game → chỉ đọc Settings.
   ========================================================= */

import Settings from '../core/settings.js';
import Music from './music.js';

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

      /* Limiter: chặn vỡ tiếng khi hàng chục SFX cùng lúc */
      try {
        this.comp = this.ctx.createDynamicsCompressor();
        this.comp.threshold.value = -11;
        this.comp.knee.value = 22;
        this.comp.ratio.value = 7;
        this.comp.attack.value = .003;
        this.comp.release.value = .20;
        this.master.connect(this.comp);
        this.comp.connect(this.ctx.destination);
      } catch (e) {
        this.master.connect(this.ctx.destination);
      }

      /* Bus nhạc */
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = (Settings.get('musicVol') / 100) * .5;
      this.musicGain.connect(this.master);

      /* Bus SFX */
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = (Settings.get('sfxVol') / 100) * .7;
      this.sfxGain.connect(this.master);

      /* Engine nhạc sinh bằng công thức toán */
      Music.init(this.ctx, this.musicGain);

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

  /** Tần số ngẫu nhiên hoá nhẹ — tránh tiếng súng bị đơn điệu. */
  _v(base, spread = .06) {
    return base * (1 - spread + Math.random() * spread * 2);
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
        this.tone(this._v(880), .05, 'square', .07, 0, this._v(300, .12));
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
        this.tone(this._v(340, .09), .05, 'square', .07);
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
      case 'click':
        this.tone(760, .028, 'triangle', .05, 0, 980);
        break;
      case 'error':
        this.tone(180, .18, 'square', .10, 0, 120);
        this.tone(140, .18, 'square', .08, .09, 95);
        break;
      case 'equip':
        this.tone(520, .07, 'triangle', .08, 0, 700);
        this.tone(880, .1, 'sine', .07, .06, 1100);
        break;
      case 'ricochet':
        this.tone(1500, .05, 'triangle', .07, 0, 700);
        this.tone(2100, .04, 'sine', .05, .02, 1200);
        break;
      case 'freeze':
        this.noise(.18, .09, 5200);
        this.tone(1400, .16, 'sine', .07, 0, 480);
        break;
      case 'chain':
        this.tone(2200, .04, 'sawtooth', .05, 0, 900);
        this.noise(.05, .06, 4200);
        break;
      case 'hunter':
        this.tone(260, .22, 'sawtooth', .09, 0, 640);
        this.noise(.16, .07, 1500);
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

      /* ---------- KỸ NĂNG QUÁI / BOSS ---------- */
      case 'charge':
        this.tone(120, .5, 'sawtooth', .07, 0, 420);
        this.noise(.35, .05, 900);
        break;
      case 'skill':
        this.tone(520, .16, 'square', .09, 0, 900);
        this.tone(780, .12, 'square', .06, .05);
        break;
      case 'slam':
        this.noise(.32, .22, 620);
        this.tone(64, .38, 'sine', .2, 0, 30);
        this.tone(180, .12, 'square', .07);
        break;
      case 'shockwave':
        this.noise(.28, .14, 1500);
        this.tone(220, .3, 'sawtooth', .1, 0, 60);
        break;
      case 'laser':
        this.tone(1800, .22, 'sawtooth', .11, 0, 260);
        this.noise(.18, .07, 4200);
        break;
      case 'beam':
        this.tone(1200, .3, 'square', .08, 0, 1500);
        break;
      case 'summon':
        this.tone(180, .45, 'sine', .1, 0, 420);
        this.tone(360, .3, 'triangle', .07, .1);
        this.noise(.25, .05, 1200);
        break;
      case 'enrage':
        this.tone(90, .8, 'sawtooth', .16, 0, 40);
        this.tone(135, .7, 'square', .08, .1, 60);
        this.noise(.6, .1, 500);
        break;
      default:
        break;
    }
  },

  /* =========================================================
     MUSIC — delegate sang engine toán học (systems/music.js)
     ========================================================= */
  startMusic(name) {
    if (!this.ready) return;
    if (!Settings.get('musicOn')) return;
    Music.play(name);
  },

  stopMusic() {
    Music.stop(.45);
  },

  /** Độ căng thẳng 0..1 — mở layer + đổi bài boss theo % máu. */
  setDanger(x) {
    Music.setDanger(x);
  },

  /** Vào trận boss: warning → criticality → meltdown. */
  startBossMusic() {
    if (!this.ready || !Settings.get('musicOn')) return;
    Music.playBoss();
  },

  get musicTrack() {
    return Music.currentName;
  }
};

export default Sound;
