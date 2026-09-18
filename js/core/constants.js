/* =========================================================
   VNXX — CORE / CONSTANTS
   State enum, screen map, config, difficulty, rarity.
   Không chứa data gameplay (weapons/enemies/... → js/data/*).
   ========================================================= */

/* ===================== GAME STATE ENUM ===================== */
export const ST = {
  BOOT:            'BOOT',
  INTRO:           'INTRO',
  MAIN_MENU:       'MAIN_MENU',
  PROFILE_CREATION:'PROFILE_CREATION',
  LOADING:         'LOADING',
  LOAD_MENU:       'LOAD_MENU',
  SETTINGS:        'SETTINGS',
  ACHIEVEMENTS:    'ACHIEVEMENTS',
  PLAYING:         'PLAYING',
  PAUSED:          'PAUSED',
  SHOP:            'SHOP',
  INVENTORY:       'INVENTORY',
  LEVEL_UP:        'LEVEL_UP',
  BOSS:            'BOSS',
  GAME_OVER:       'GAME_OVER',
  HARDCORE_DEAD:   'HARDCORE_DEAD',
  WATCH_MODE:      'WATCH_MODE',
  STAGE_CLEAR:     'STAGE_CLEAR',
  EVENT:           'EVENT',
  LAN:             'LAN'
};

/** Map state -> DOM screen id (dùng cho showScreen). */
export const SCREEN_MAP = {
  MAIN_MENU:        'screen-menu',
  PROFILE_CREATION: 'screen-profile',
  LOAD_MENU:        'screen-load',
  SETTINGS:         'screen-settings',
  ACHIEVEMENTS:     'screen-achievements',
  PAUSED:           'screen-pause',
  LEVEL_UP:         'screen-levelup',
  SHOP:             'screen-shop',
  INVENTORY:        'screen-inventory',
  GAME_OVER:        'screen-gameover',
  HARDCORE_DEAD:    'screen-hardcore',
  STAGE_CLEAR:      'screen-stageclear',
  EVENT:            'screen-event',
  LOADING:          'screen-loading',
  INTRO:            'screen-intro',
  LAN:              'screen-lan'
};

/* ===================== CONFIG ===================== */
export const CFG = {
  SAVE_VERSION:   1,
  SAVE_PREFIX:    'VNXX_SAVE_',
  SETTINGS_KEY:   'VNXX_SETTINGS',
  META_KEY:       'VNXX_META',
  MAX_SAVES:      8,

  PLAYER: {
    radius:        17,
    baseHp:        100,
    baseSpeed:     225,
    accel:         2600,
    friction:      11,
    critChance:    .05,
    critMul:       1.75,
    iframeHit:     .45,
    pickupRange:   110,
    interactRange: 120,
    dashCd:        6,
    dashSpeed:     900,
    dashTime:      .16
  },

  XP_BASE:        20,
  XP_GROWTH:      1.24,
  MAX_PARTICLES:  340,
  MAX_ENEMIES:    90
};

/* ===================== DIFFICULTY ===================== */
export const DIFFICULTIES = {
  easy: {
    id: 'easy',
    name: 'DỄ',
    desc: 'Quái yếu, nhiều tài nguyên, spawn chậm.',
    hp: .70, dmg: .55, speed: .92,
    spawnInterval: 1.30, count: .80,
    loot: 1.55, xp: 1.35,
    eliteChance: .45, revive: true
  },
  normal: {
    id: 'normal',
    name: 'TRUNG BÌNH',
    desc: 'Cân bằng. Trải nghiệm tiêu chuẩn.',
    hp: 1, dmg: 1, speed: 1,
    spawnInterval: 1, count: 1,
    loot: 1, xp: 1,
    eliteChance: 1, revive: true
  },
  hard: {
    id: 'hard',
    name: 'KHÓ',
    desc: 'Quái mạnh, spawn nhanh, ít tài nguyên.',
    hp: 1.55, dmg: 1.45, speed: 1.10,
    spawnInterval: .72, count: 1.30,
    loot: .75, xp: .85,
    eliteChance: 1.7, revive: true
  },
  hardcore: {
    id: 'hardcore',
    name: 'HARDCORE',
    desc: '☠ CHẾT LÀ KẾT THÚC. Không revive. Save bị đánh dấu vĩnh viễn.',
    hp: 1.85, dmg: 1.75, speed: 1.16,
    spawnInterval: .62, count: 1.50,
    loot: .70, xp: .80,
    eliteChance: 2.1, revive: false
  }
};

/* ===================== RARITY ===================== */
export const RARITY = {
  common:    { name: 'COMMON',    stars: '★',     color: '#9fb4c4', mult: 1.00, priceMul: 1  },
  uncommon:  { name: 'UNCOMMON',  stars: '★★',    color: '#39ff9e', mult: 1.15, priceMul: 1.6 },
  rare:      { name: 'RARE',      stars: '★★★',   color: '#5aa9ff', mult: 1.32, priceMul: 2.6 },
  epic:      { name: 'EPIC',      stars: '★★★★',  color: '#a06bff', mult: 1.55, priceMul: 4.2 },
  legendary: { name: 'LEGENDARY', stars: '★★★★★', color: '#ffc44d', mult: 1.85, priceMul: 7  },
  mythic:    { name: 'MYTHIC',    stars: '★★★★★★',color: '#ff5ad0', mult: 2.25, priceMul: 12 }
};