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
  },

  /* ===================== QUÁI ĐẶC BIỆT (THEO YÊU CẦU) ===================== */
  
  /* Slow Thrower - Ném thuốc làm chậm */
  slow_thrower: {
    id: 'slow_thrower',
    name: 'SLOW THROWER',
    hp: 38,
    speed: 55,
    damage: 6,
    radius: 16,
    color: '#aaddff',
    xp: 14,
    credits: 13,
    ai: 'slow_thrower',
    attackRange: 280,
    attackCd: 1.8,
    preferred: 220,
    projectileSpeed: 280,
    slowDuration: 2.5,
    slowFactor: 0.5,
    knockRes: .1
  },

  /* Fire Spitter - Phun lửa gây DOT */
  fire_spitter: {
    id: 'fire_spitter',
    name: 'FIRE SPITTER',
    hp: 52,
    speed: 60,
    damage: 12,
    radius: 17,
    color: '#ffaa00',
    xp: 18,
    credits: 17,
    ai: 'fire_spitter',
    attackRange: 180,
    attackCd: 1.4,
    preferred: 150,
    projectileSpeed: 320,
    dotDamage: 3,
    dotDuration: 2.0,
    knockRes: .2
  },

  /* Ice Spitter - Phun băng làm chậm */
  ice_spitter: {
    id: 'ice_spitter',
    name: 'ICE SPITTER',
    hp: 46,
    speed: 52,
    damage: 9,
    radius: 17,
    color: '#00ffff',
    xp: 16,
    credits: 15,
    ai: 'ice_spitter',
    attackRange: 240,
    attackCd: 1.6,
    preferred: 200,
    projectileSpeed: 300,
    slowDuration: 2.0,
    slowFactor: 0.45,
    knockRes: .15
  },

  /* Poison Bomber - Ném độc tạo vùng */
  poison_bomber: {
    id: 'poison_bomber',
    name: 'POISON BOMBER',
    hp: 34,
    speed: 48,
    damage: 0,
    radius: 18,
    color: '#88ff00',
    xp: 15,
    credits: 14,
    ai: 'poison_bomber',
    attackRange: 300,
    attackCd: 2.2,
    preferred: 250,
    projectileSpeed: 260,
    poisonDamage: 2,
    poisonDuration: 4.0,
    poisonRadius: 70,
    knockRes: .1
  },

  /* Shadow Assassin - Sát thủ lướt nhanh áp sát */
  shadow_assassin: {
    id: 'shadow_assassin',
    name: 'SHADOW ASSASSIN',
    hp: 42,
    speed: 120,
    damage: 22,
    radius: 14,
    color: '#8800ff',
    xp: 20,
    credits: 19,
    ai: 'shadow_assassin',
    attackRange: 36,
    attackCd: 0.9,
    dashCd: 2.0,
    dashSpeed: 720,
    dashRange: 380,
    knockRes: .35
  },

  /* Kamikaze - Quái cảm tử nổ khi chạm */
  kamikaze: {
    id: 'kamikaze',
    name: 'KAMIKAZE',
    hp: 18,
    speed: 165,
    damage: 45,
    radius: 14,
    color: '#ff00ff',
    xp: 10,
    credits: 8,
    ai: 'kamikaze',
    attackRange: 48,
    attackCd: 1,
    knockRes: .1,
    fuse: 0.8,
    blastRadius: 90
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