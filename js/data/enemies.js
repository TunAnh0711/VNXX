/* =========================================================
   VNXX — DATA / ENEMIES
   Toàn bộ enemy thường + Elite modifier.
   Chỉnh balance → chỉ sửa file này.
   ========================================================= */

/* =========================================================
   BASE ENEMIES
   Fields bắt buộc: id, name, hp, speed, damage, radius,
                    color, xp, credits, ai, attackRange,
                    attackCd, knockRes
   Fields tùy chọn: shield, shieldRegen, preferred,
                    projectileSpeed, dashCd, dashSpeed,
                    fuse, blastRadius
   ========================================================= */
export const ENEMIES = {
  /* ===================== CƠ BẢN ===================== */
  drone: {
    id: 'drone',
    name: 'DRONE',
    hp: 34,
    speed: 80,
    damage: 9,
    radius: 16,
    color: '#ff5a6e',
    xp: 7,
    credits: 6,
    ai: 'chase',
    attackRange: 36,
    attackCd: 1.0,
    knockRes: 0
  },

  runner: {
    id: 'runner',
    name: 'RUNNER',
    hp: 22,
    speed: 150,
    damage: 7,
    radius: 13,
    color: '#ffb03a',
    xp: 6,
    credits: 5,
    ai: 'chase',
    attackRange: 32,
    attackCd: .7,
    knockRes: 0
  },

  swarm: {
    id: 'swarm',
    name: 'SWARM',
    hp: 11,
    speed: 128,
    damage: 4,
    radius: 10,
    color: '#ffe14d',
    xp: 3,
    credits: 2,
    ai: 'chase',
    attackRange: 28,
    attackCd: .55,
    knockRes: 0
  },

  /* ===================== TRUNG BÌNH ===================== */
  shooter: {
    id: 'shooter',
    name: 'SHOOTER',
    hp: 32,
    speed: 62,
    damage: 10,
    radius: 15,
    color: '#3affd0',
    xp: 11,
    credits: 11,
    ai: 'ranged',
    attackRange: 340,
    attackCd: 1.7,
    preferred: 280,
    projectileSpeed: 360,
    knockRes: .1
  },

  assassin: {
    id: 'assassin',
    name: 'ASSASSIN',
    hp: 48,
    speed: 100,
    damage: 16,
    radius: 15,
    color: '#ff2fd0',
    xp: 17,
    credits: 16,
    ai: 'assassin',
    attackRange: 36,
    attackCd: 1.0,
    dashCd: 2.6,
    dashSpeed: 640,
    knockRes: .3
  },

  exploder: {
    id: 'exploder',
    name: 'EXPLODER',
    hp: 28,
    speed: 110,
    damage: 30,
    radius: 16,
    color: '#ff7a2f',
    xp: 12,
    credits: 10,
    ai: 'exploder',
    attackRange: 52,
    attackCd: 1,
    knockRes: .2,
    fuse: 1.1,
    blastRadius: 110
  },

  /* ===================== NẶNG ===================== */
  tank: {
    id: 'tank',
    name: 'TANK',
    hp: 140,
    speed: 44,
    damage: 20,
    radius: 25,
    color: '#a06bff',
    xp: 20,
    credits: 22,
    ai: 'chase',
    attackRange: 46,
    attackCd: 1.4,
    knockRes: .75
  },

  shield: {
    id: 'shield',
    name: 'SHIELD',
    hp: 74,
    shield: 56,
    speed: 58,
    damage: 13,
    radius: 20,
    color: '#5aa9ff',
    xp: 16,
    credits: 15,
    ai: 'chase',
    attackRange: 40,
    attackCd: 1.2,
    knockRes: .5,
    shieldRegen: 6
  }
};

/* =========================================================
   ELITE MODIFIERS
   Mỗi mod có hàm apply(e) chạy SAU khi enemy được tạo,
   cho phép nhân stat / override màu / thêm hành vi.
   ========================================================= */
export const ELITE_MODS = {
  frenzy: {
    id: 'frenzy',
    name: 'FRENZY',
    apply: (e) => {
      e.speed *= 1.45;
      e.attackCd *= .6;
      e.color = '#ff2f6a';
    }
  },

  regenerating: {
    id: 'regenerating',
    name: 'REGENERATING',
    apply: (e) => {
      e.regen = e.maxHp * .035;
      e.color = '#39ff9e';
    }
  },

  armored: {
    id: 'armored',
    name: 'ARMORED',
    apply: (e) => {
      e.dmgReduce = .45;
      e.color = '#8fa9c0';
    }
  },

  vampiric: {
    id: 'vampiric',
    name: 'VAMPIRIC',
    apply: (e) => {
      e.lifesteal = .6;
      e.color = '#c0392b';
    }
  },

  teleporting: {
    id: 'teleporting',
    name: 'TELEPORTING',
    apply: (e) => {
      e.teleportCd = 3.2;
      e.color = '#b06bff';
    }
  }
};

/* =========================================================
   HELPERS
   ========================================================= */

/** List tất cả id enemy (dùng cho debug/wave pool validation). */
export const ENEMY_IDS = Object.keys(ENEMIES);

/** Lấy enemy base hoặc null nếu id sai. */
export function getEnemy(id) {
  return ENEMIES[id] || null;
}

/** Random 1 elite mod id. */
export function randomEliteModId() {
  const keys = Object.keys(ELITE_MODS);
  return keys[Math.floor(Math.random() * keys.length)];
}

/** Áp n elite mod ngẫu nhiên (không trùng) lên enemy.
 *  Trả về mảng các mod id đã áp.
 */
export function applyEliteMods(e, n = 1) {
  const keys = Object.keys(ELITE_MODS);
  const used = [];
  let guard = 0;
  for (let i = 0; i < n && guard < 20; i++) {
    let id;
    do {
      id = keys[Math.floor(Math.random() * keys.length)];
      guard++;
    } while (used.includes(id) && guard < 20);
    used.push(id);
    ELITE_MODS[id].apply(e);
  }
  return used;
}

/** Tên hiển thị ghép của nhiều mod: "FRENZY + ARMORED". */
export function eliteModNames(ids) {
  return ids.map((id) => ELITE_MODS[id]?.name || id).join(' + ');
}