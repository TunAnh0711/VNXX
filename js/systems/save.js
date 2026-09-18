/* =========================================================
   VNXX — SYSTEMS / SAVE
   Lưu/đọc profile vào localStorage. Validate + migrate schema.
   Không import Game → tránh circular dependency.
   ========================================================= */

import { CFG, DIFFICULTIES } from '../core/constants.js';
import { DEFAULT_WEAPONS } from '../data/weapons.js';

/* =========================================================
   SAVE MODULE
   ========================================================= */
const Save = {
  /* dùng cho debounce auto-save indicator */
  _t: null,

  /* =========================================================
     LIST / READ / WRITE / REMOVE
     ========================================================= */
  list() {
    const out = [];
    for (let i = 1; i <= CFG.MAX_SAVES; i++) {
      const key = this._key(i);
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const d = JSON.parse(raw);
        if (!this.validate(d)) continue;
        out.push(this.migrate(d));
      } catch (err) {
        console.warn('[Save] corrupt save slot', i, err);
      }
    }
    return out.sort((a, b) => b.timestamp - a.timestamp);
  },

  read(slot) {
    try {
      const raw = localStorage.getItem(this._key(slot));
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!this.validate(d)) return null;
      return this.migrate(d);
    } catch (err) {
      console.warn('[Save] read failed:', slot, err);
      return null;
    }
  },

  write(profile) {
    if (!profile) return false;
    try {
      profile.timestamp = Date.now();
      profile.saveVersion = CFG.SAVE_VERSION;
      localStorage.setItem(this._key(profile.slot), JSON.stringify(profile));
      return true;
    } catch (err) {
      console.error('[Save] write failed:', err);
      this._notify('LỖI LƯU DỮ LIỆU!');
      return false;
    }
  },

  remove(slot) {
    try {
      localStorage.removeItem(this._key(slot));
      return true;
    } catch (err) {
      console.warn('[Save] remove failed:', slot, err);
      return false;
    }
  },

  wipeAll() {
    try {
      for (let i = 1; i <= CFG.MAX_SAVES; i++) {
        localStorage.removeItem(this._key(i));
      }
      localStorage.removeItem(CFG.SETTINGS_KEY);
      localStorage.removeItem(CFG.META_KEY);
      return true;
    } catch (err) {
      console.warn('[Save] wipeAll failed:', err);
      return false;
    }
  },

  /* =========================================================
     SLOT HELPERS
     ========================================================= */
  _key(slot) {
    return CFG.SAVE_PREFIX + String(slot).padStart(3, '0');
  },

  freeSlot() {
    for (let i = 1; i <= CFG.MAX_SAVES; i++) {
      const key = this._key(i);
      if (!localStorage.getItem(key)) return i;
    }
    return -1;
  },

  /* =========================================================
     VALIDATE / MIGRATE
     ========================================================= */
  validate(d) {
    if (!d || typeof d !== 'object') return false;
    if (typeof d.playerName !== 'string' || d.playerName.length < 1) return false;
    if (!DIFFICULTIES[d.difficulty]) return false;
    if (typeof d.currentStage !== 'number') return false;
    if (typeof d.currentWave !== 'number') return false;
    return true;
  },

  /** Đảm bảo mọi field tồn tại — chống save cũ thiếu field. */
  migrate(d) {
    const def = this.createBlank('X', 'normal', d.slot || 1);
    const merged = Object.assign({}, def, d);

    merged.statistics  = Object.assign({}, def.statistics,  d.statistics  || {});
    merged.upgrades    = Object.assign({}, def.upgrades,    d.upgrades    || {});
    merged.inventory   = Object.assign({}, def.inventory,   d.inventory   || {});
    merged.inventory.weapons     = Array.isArray(d.inventory?.weapons)
      ? d.inventory.weapons
      : def.inventory.weapons.slice();
    merged.inventory.modules     = Object.assign({}, def.inventory.modules,     d.inventory?.modules     || {});
    merged.inventory.consumables = Object.assign({}, def.inventory.consumables, d.inventory?.consumables || {});

    merged.equippedModules = Array.isArray(d.equippedModules)
      ? d.equippedModules.slice(0, 4)
      : [];

    merged.unlockedWeapons  = Array.isArray(d.unlockedWeapons)  ? d.unlockedWeapons.slice()  : def.unlockedWeapons.slice();
    merged.unlockedItems    = Array.isArray(d.unlockedItems)    ? d.unlockedItems.slice()    : [];
    merged.achievements     = Array.isArray(d.achievements)     ? d.achievements.slice()     : [];

    merged.saveVersion = CFG.SAVE_VERSION;
    return merged;
  },

  /* =========================================================
     CREATE BLANK PROFILE
     ========================================================= */
  createBlank(name, difficulty, slot, seed) {
    const hc = difficulty === 'hardcore';

    return {
      saveVersion: CFG.SAVE_VERSION,
      slot,
      playerName: name,
      difficulty,
      hardcore: hc,
      dead: false,

      /* ---------- PROGRESS ---------- */
      level: 1,
      xp: 0,
      money: 0,
      shards: 0,

      /* ---------- HP ---------- */
      hp: CFG.PLAYER.baseHp,
      maxHp: CFG.PLAYER.baseHp,

      /* ---------- WEAPON / INVENTORY ---------- */
      weapon: 'pistol',
      inventory: {
        weapons: DEFAULT_WEAPONS.slice(),
        modules: {},
        consumables: { medkit: 2, revive_token: hc ? 0 : 1 },
        capacity: 12
      },
      equippedModules: [],

      /* ---------- UPGRADES (delta so với base) ---------- */
      upgrades: {
        damageMul: 0,
        speedMul: 0,
        maxHpMul: 0,
        critChance: 0,
        critMul: 0,
        armor: 0,
        lifesteal: 0,
        attackSpeedMul: 0,
        luck: 0,
        rangeMul: 0,
        dodge: 0
      },

      /* ---------- STAGE / WAVE ---------- */
      currentStage: 1,
      currentWave: 1,

      /* ---------- UNLOCKS ---------- */
      unlockedWeapons: DEFAULT_WEAPONS.slice(),
      unlockedItems: [],

      /* ---------- STATISTICS ---------- */
      statistics: {
        kills: 0,
        deaths: 0,
        playTime: 0,
        highestWave: 0,
        highestLevel: 1,
        bossesKilled: 0,
        creditsEarned: 0,
        weaponsUnlocked: DEFAULT_WEAPONS.length,
        wavesCleared: 0,
        hardcoreStages: 0
      },

      achievements: [],

      /* ---------- MISC ---------- */
      seed: seed || Math.floor(Math.random() * 900000) + 100000,
      timestamp: Date.now()
    };
  },

  /* =========================================================
     AUTO-SAVE (gọi bởi Game)
     ========================================================= */
  auto(profile) {
    if (!profile) return false;
    const ok = this.write(profile);
    if (ok) this._showIndicator();
    return ok;
  },

  /* =========================================================
     UI FEEDBACK (không import ui/hud.js → tránh phụ thuộc vòng)
     ========================================================= */
  _showIndicator() {
    const el = document.getElementById('saveIndicator');
    if (!el) return;
    el.classList.add('on');
    clearTimeout(this._t);
    this._t = setTimeout(() => el.classList.remove('on'), 1400);
  },

  _notify(msg) {
    // Nếu ui/hud.js đã expose window.addToast → dùng; nếu không thì console.
    if (typeof window.addToast === 'function') {
      window.addToast(msg);
    } else {
      console.warn('[Save]', msg);
    }
  }
};

export default Save;