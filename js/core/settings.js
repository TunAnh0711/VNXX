/* =========================================================
   VNXX — CORE / SETTINGS
   Quản lý cài đặt người chơi (âm thanh, FX, perf, mobile).
   Persist vào localStorage qua CFG.SETTINGS_KEY.
   ========================================================= */

import { CFG } from './constants.js';

/* ===================== DEFAULTS ===================== */
const DEFAULTS = {
  sfxOn:      true,
  musicOn:    true,
  fxOn:       true,
  shakeOn:    true,
  perf:       'auto',        // 'auto' | 'high' | 'low'
  masterVol:  70,            // 0..100
  musicVol:   45,            // 0..100
  sfxVol:     75,            // 0..100
  tutorial:   true,
  mobileMode: false          // ← joystick + action buttons, mặc định TẮT
};

/* ===================== SETTINGS MODULE ===================== */
const Settings = {
  data: { ...DEFAULTS },

  /* =========================================================
     LOAD / SAVE
     ========================================================= */
  load() {
    try {
      const raw = localStorage.getItem(CFG.SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          Object.assign(this.data, parsed);
        }
      }
    } catch (err) {
      console.warn('[Settings] load failed:', err);
    }
    this._sanitize();
    return this.data;
  },

  save() {
    try {
      localStorage.setItem(CFG.SETTINGS_KEY, JSON.stringify(this.data));
      return true;
    } catch (err) {
      console.warn('[Settings] save failed:', err);
      return false;
    }
  },

  /* =========================================================
     GET / SET
     ========================================================= */
  get(key) {
    return this.data[key];
  },

  set(key, value) {
    if (!(key in DEFAULTS)) {
      console.warn('[Settings] unknown key:', key);
      return;
    }
    this.data[key] = value;
    this._sanitizeOne(key);
    this.save();
  },

  /** Toggle boolean + tự lưu. Trả về giá trị mới. */
  toggle(key) {
    if (typeof this.data[key] !== 'boolean') return this.data[key];
    this.data[key] = !this.data[key];
    this.save();
    return this.data[key];
  },

  /* =========================================================
     VALIDATE / SANITIZE
     ========================================================= */
  _sanitize() {
    for (const k of Object.keys(DEFAULTS)) {
      this._sanitizeOne(k);
    }
  },

  _sanitizeOne(key) {
    const v = this.data[key];
    switch (key) {
      case 'sfxOn':
      case 'musicOn':
      case 'fxOn':
      case 'shakeOn':
      case 'tutorial':
      case 'mobileMode':
        this.data[key] = !!v;
        break;

      case 'perf':
        if (!['auto', 'high', 'low'].includes(v)) this.data[key] = 'auto';
        break;

      case 'masterVol':
      case 'musicVol':
      case 'sfxVol':
        this.data[key] = Math.max(0, Math.min(100, Number(v) || 0));
        break;
    }
  },

  /* =========================================================
     RESET
     ========================================================= */
  reset() {
    this.data = { ...DEFAULTS };
    this.save();
  },

  /* =========================================================
     HELPERS
     ========================================================= */

  /** true nếu đang ở chế độ hiệu năng thấp (dùng để cắt particle, FX). */
  isLowPerf() {
    return this.data.perf === 'low';
  },

  /** true nếu nên vẽ particle (fxOn + không low perf). */
  shouldRenderFx() {
    return this.data.fxOn && this.data.perf !== 'low';
  },

  /** Hệ số nhân số lượng particle khi perf=low (0.5) hay bình thường (1). */
  particleMul() {
    return this.data.perf === 'low' ? 0.5 : 1;
  }
};

export default Settings;