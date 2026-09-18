/* =========================================================
   VNXX — DATA / BOSSES
   5 boss tương ứng 5 stage. Chỉnh balance → chỉ sửa file này.
   ========================================================= */

export const BOSSES = {
  /* ===================== STAGE 1 ===================== */
  'SENTINEL PRIME': {
    name: 'SENTINEL PRIME',
    hp: 1250,
    radius: 42,
    color: '#ff5a6e',
    speed: 58,
    xp: 280,
    credits: 900,
    phases:  ['spread', 'dash', 'summon'],
    enrage:  ['spread', 'ring', 'dash']
  },

  /* ===================== STAGE 2 ===================== */
  'FORGE TITAN': {
    name: 'FORGE TITAN',
    hp: 1900,
    radius: 50,
    color: '#ffa53a',
    speed: 48,
    xp: 400,
    credits: 1300,
    phases:  ['ring', 'summon', 'spread'],
    enrage:  ['ring', 'ring', 'dash']
  },

  /* ===================== STAGE 3 ===================== */
  'GLITCH WRAITH': {
    name: 'GLITCH WRAITH',
    hp: 2400,
    radius: 40,
    color: '#ff2fd0',
    speed: 92,
    xp: 520,
    credits: 1700,
    phases:  ['dash', 'spread', 'summon'],
    enrage:  ['dash', 'spread', 'dash']
  },

  /* ===================== STAGE 4 ===================== */
  'REAPER UNIT': {
    name: 'REAPER UNIT',
    hp: 3200,
    radius: 46,
    color: '#ff3b52',
    speed: 70,
    xp: 680,
    credits: 2200,
    phases:  ['ring', 'dash', 'summon'],
    enrage:  ['ring', 'dash', 'ring']
  },

  /* ===================== STAGE 5 ===================== */
  'VOID REAPER': {
    name: 'VOID REAPER',
    hp: 4600,
    radius: 52,
    color: '#a06bff',
    speed: 78,
    xp: 950,
    credits: 3200,
    phases:  ['spread', 'ring', 'summon', 'dash'],
    enrage:  ['ring', 'spread', 'dash', 'ring']
  }
};

/* =========================================================
   BOSS ABILITY PATTERNS — định nghĩa hành vi từng pattern.
   File này chỉ mô tả THÔNG SỐ; logic thi hành ở game/boss.js.
   ========================================================= */
export const BOSS_PATTERNS = {
  spread: {
    id: 'spread',
    bulletCount: { normal: 7, enraged: 11 },
    spreadArc: 1.1,          // radian
    bulletSpeed: 340,
    bulletRadius: 7,
    damageMul: .65,
    projectileLife: 3,
    color: '#ff5a6e',
    sfx: 'shotgun'
  },

  ring: {
    id: 'ring',
    bulletCount: { normal: 14, enraged: 22 },
    bulletSpeed: 280,
    bulletRadius: 6,
    damageMul: .55,
    projectileLife: 3.4,
    color: '#ffa53a',
    sfx: 'explosion'
  },

  dash: {
    id: 'dash',
    dashDuration: .42,
    dashSpeed: 680,
    cooldownAfter: 1.1,
    color: '#ff2fd0',
    sfx: 'dash'
  },

  summon: {
    id: 'summon',
    count: { normal: 3, enraged: 5 },
    radius: 140,             // vòng tròn spawn quanh boss
    color: '#a06bff',
    sfx: 'warning'
  }
};

/* =========================================================
   BOSS TIMING
   ========================================================= */
export const BOSS_TIMING = {
  spawnAnim:       1.2,      // giây hiện animation xuất hiện
  abilityBaseCd:   2.0,      // giây giữa 2 ability
  abilityEnragedCd:1.25,
  abilityJitter:   .6,       // random cộng thêm
  telegraphDur:    1.1,      // giây báo trước khi đổi phase
  enrageThreshold: .18,      // % hp còn lại để enrage
  phaseThresholds: [.75, .50, .25]   // % hp mốc đổi phase (2, 3, 4)
};

/* =========================================================
   HELPERS
   ========================================================= */

/** Lấy boss theo tên hoặc null. */
export function getBoss(name) {
  return BOSSES[name] || null;
}

/** Lấy pattern theo id hoặc null. */
export function getBossPattern(id) {
  return BOSS_PATTERNS[id] || null;
}

/** Tính phase hiện tại (1..4) từ % máu còn lại. */
export function getBossPhase(hp, maxHp) {
  const frac = hp / maxHp;
  const T = BOSS_TIMING.phaseThresholds;
  if (frac < T[2]) return 4;
  if (frac < T[1]) return 3;
  if (frac < T[0]) return 2;
  return 1;
}

/** Kiểm tra boss có nên enrage chưa. */
export function shouldEnrage(hp, maxHp) {
  return hp / maxHp < BOSS_TIMING.enrageThreshold;
}