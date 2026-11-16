/* =========================================================
   VNXX — DATA / ENEMIES
   Roster quái + Affix hệ thống (elite modifier).
   Chỉnh balance → chỉ sửa file này.

   AI hiện có:
   chase · ranged · assassin · exploder · charger · sniper
   summoner · brute · turret · burrow · support

   Field mới:
   - armor    : giảm sát thương nhận vào (0..0.8)
   - poise    : thanh cân bằng; đánh đủ → BREAK (choáng + nhận thêm ST)
   - flying   : bỏ qua vật cản
   - onDeath  : 'split' | 'volatile' | null
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
    knockRes: 0,
    visualArchetype: 'drone'
  },

  runner: {
    id: 'runner',
    name: 'RUNNER',
    hp: 22,
    speed: 158,
    damage: 7,
    radius: 13,
    color: '#ffb03a',
    xp: 6,
    credits: 5,
    ai: 'chase',
    attackRange: 32,
    attackCd: .7,
    knockRes: 0,
    visualArchetype: 'runner'
  },

  swarm: {
    id: 'swarm',
    name: 'SWARM',
    hp: 11,
    speed: 132,
    damage: 4,
    radius: 10,
    color: '#ffe14d',
    xp: 3,
    credits: 2,
    ai: 'chase',
    attackRange: 28,
    attackCd: .55,
    knockRes: 0,
    visualArchetype: 'swarm'
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
    knockRes: .1,
    visualArchetype: 'shooter'
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
    knockRes: .3,
    visualArchetype: 'assassin'
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
    blastRadius: 110,
    visualArchetype: 'exploder'
  },

  /* ===================== MỚI — CHARGER ===================== */
  charger: {
    id: 'charger',
    name: 'CHARGER',
    hp: 62,
    speed: 74,
    damage: 22,
    radius: 19,
    color: '#ff9d3d',
    xp: 18,
    credits: 16,
    ai: 'charger',
    attackRange: 42,
    attackCd: 1.1,
    dashCd: 2.4,
    dashSpeed: 780,
    knockRes: .45,
    poise: 90,
    visualArchetype: 'tank'
  },

  /* ===================== MỚI — SNIPER ===================== */
  sniper_unit: {
    id: 'sniper_unit',
    name: 'MARKSMAN',
    hp: 40,
    speed: 52,
    damage: 26,
    radius: 15,
    color: '#ff3b52',
    xp: 22,
    credits: 20,
    ai: 'sniper',
    attackRange: 760,
    attackCd: 3.2,
    preferred: 520,
    projectileSpeed: 1250,
    knockRes: .15,
    visualArchetype: 'shooter'
  },

  /* ===================== MỚI — SUMMONER ===================== */
  summoner: {
    id: 'summoner',
    name: 'SUMMONER',
    hp: 78,
    speed: 58,
    damage: 8,
    radius: 18,
    color: '#b06bff',
    xp: 26,
    credits: 24,
    ai: 'summoner',
    attackRange: 420,
    attackCd: 4.6,
    preferred: 400,
    projectileSpeed: 300,
    knockRes: .3,
    summonType: 'swarm',
    summonCount: 3,
    poise: 70,
    visualArchetype: 'shield'
  },

  /* ===================== MỚI — SPLITTER ===================== */
  splitter: {
    id: 'splitter',
    name: 'SPLITTER',
    hp: 96,
    speed: 66,
    damage: 14,
    radius: 24,
    color: '#2bffb0',
    xp: 24,
    credits: 22,
    ai: 'chase',
    attackRange: 44,
    attackCd: 1.2,
    knockRes: .35,
    onDeath: 'split',
    splitInto: 'swarm',
    splitCount: 3,
    poise: 80,
    visualArchetype: 'shield'
  },

  /* ===================== MỚI — FLYER ===================== */
  flyer: {
    id: 'flyer',
    name: 'FLYER',
    hp: 26,
    speed: 175,
    damage: 11,
    radius: 14,
    color: '#9fe8ff',
    xp: 13,
    credits: 11,
    ai: 'chase',
    attackRange: 34,
    attackCd: .85,
    knockRes: 0,
    flying: true,
    visualArchetype: 'swarm'
  },

  /* ===================== MỚI — TURRET ===================== */
  turret: {
    id: 'turret',
    name: 'TURRET',
    hp: 120,
    speed: 0,
    damage: 9,
    radius: 20,
    color: '#ffc44d',
    xp: 20,
    credits: 18,
    ai: 'turret',
    attackRange: 460,
    attackCd: .85,
    projectileSpeed: 520,
    knockRes: .9,
    poise: 100,
    visualArchetype: 'drone'
  },

  /* ===================== MỚI — BURROWER ===================== */
  burrower: {
    id: 'burrower',
    name: 'BURROWER',
    hp: 70,
    speed: 96,
    damage: 24,
    radius: 17,
    color: '#8b5a2b',
    xp: 23,
    credits: 21,
    ai: 'burrow',
    attackRange: 46,
    attackCd: 1.4,
    knockRes: .4,
    poise: 70,
    visualArchetype: 'exploder'
  },

  /* ===================== MỚI — BRUTE ===================== */
  brute: {
    id: 'brute',
    name: 'BRUTE',
    hp: 260,
    speed: 48,
    damage: 34,
    radius: 30,
    color: '#c0392b',
    xp: 42,
    credits: 40,
    ai: 'brute',
    attackRange: 62,
    attackCd: 2.1,
    knockRes: .85,
    armor: .25,
    poise: 220,
    blastRadius: 150,
    visualArchetype: 'tank'
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
    knockRes: .75,
    armor: .18,
    poise: 150,
    visualArchetype: 'tank'
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
    shieldRegen: 6,
    visualArchetype: 'shield'
  },

  /* ===================== MỚI — LEECH ===================== */
  leech: {
    id: 'leech',
    name: 'LEECH',
    hp: 84,
    speed: 112,
    damage: 12,
    radius: 18,
    color: '#ff2f6a',
    xp: 21,
    credits: 19,
    ai: 'chase',
    attackRange: 40,
    attackCd: .9,
    knockRes: .3,
    lifesteal: .8,
    poise: 60,
    visualArchetype: 'assassin'
  }
};

/* =========================================================
   CHI PHÍ BUDGET THEO LOẠI (dùng cho wave spawn queue)
   ========================================================= */
export const ENEMY_COST = {
  swarm: 1,
  runner: 2,
  drone: 2,
  shooter: 2,
  flyer: 2,
  exploder: 3,
  shield: 3,
  assassin: 4,
  leech: 4,
  sniper_unit: 4,
  charger: 4,
  burrower: 4,
  splitter: 5,
  turret: 5,
  tank: 5,
  summoner: 6,
  brute: 8
};

export function queueCost(type) {
  if (type && type.startsWith && type.startsWith('ELITE_')) {
    return (ENEMY_COST[type.slice(6)] || 3) * 3;
  }
  return ENEMY_COST[type] || 2;
}

/* =========================================================
   AFFIX (ELITE MODIFIER) — mở rộng
   Mỗi affix có apply(e) chạy sau khi enemy được tạo.
   ========================================================= */
export const ELITE_MODS = {
  frenzy: {
    id: 'frenzy',
    name: 'FRENZY',
    color: '#ff2f6a',
    apply: (e) => {
      e.speed *= 1.45;
      e.attackCd *= .6;
      e.color = '#ff2f6a';
    }
  },

  regenerating: {
    id: 'regenerating',
    name: 'REGENERATING',
    color: '#39ff9e',
    apply: (e) => {
      e.regen = e.maxHp * .035;
      e.color = '#39ff9e';
    }
  },

  armored: {
    id: 'armored',
    name: 'ARMORED',
    color: '#8fa9c0',
    apply: (e) => {
      e.armor = Math.min(.8, (e.armor || 0) + .35);
      e.poiseMax *= 1.6;
      e.poise = e.poiseMax;
      e.color = '#8fa9c0';
    }
  },

  vampiric: {
    id: 'vampiric',
    name: 'VAMPIRIC',
    color: '#c0392b',
    apply: (e) => {
      e.lifesteal = .8;
      e.color = '#c0392b';
    }
  },

  teleporting: {
    id: 'teleporting',
    name: 'TELEPORTING',
    color: '#b06bff',
    apply: (e) => {
      e.teleportCd = 3.2;
      e.color = '#b06bff';
    }
  },

  volatile: {
    id: 'volatile',
    name: 'VOLATILE',
    color: '#ff7a2f',
    apply: (e) => {
      e.onDeath = 'volatile';
      e.deathBlast = 130;
      e.color = '#ff7a2f';
    }
  },

  frostbound: {
    id: 'frostbound',
    name: 'FROSTBOUND',
    color: '#7fd8ff',
    apply: (e) => {
      e.contactStatus = { id: 'chill', dur: 2.4, power: 1 };
      e.color = '#7fd8ff';
    }
  },

  venomous: {
    id: 'venomous',
    name: 'VENOMOUS',
    color: '#88ff00',
    apply: (e) => {
      e.contactStatus = { id: 'poison', dur: 4, power: 3 };
      e.color = '#88ff00';
    }
  },

  thorns: {
    id: 'thorns',
    name: 'THORNS',
    color: '#ffb03a',
    apply: (e) => {
      e.thorns = .18;
      e.color = '#ffb03a';
    }
  },

  berserker: {
    id: 'berserker',
    name: 'BERSERKER',
    color: '#ff003c',
    apply: (e) => {
      e.berserk = true;
      e.color = '#ff003c';
    }
  },

  swift: {
    id: 'swift',
    name: 'SWIFT',
    color: '#9fe8ff',
    apply: (e) => {
      e.speed *= 1.28;
      e.dodgeTimer = .1;
      e.evasion = .25;
      e.color = '#9fe8ff';
    }
  }
};

/* =========================================================
   HELPERS
   ========================================================= */
export const ENEMY_IDS = Object.keys(ENEMIES);

export function getEnemy(id) {
  return ENEMIES[id] || null;
}

export function randomEliteModId() {
  const keys = Object.keys(ELITE_MODS);
  return keys[Math.floor(Math.random() * keys.length)];
}

/** Áp n affix ngẫu nhiên (không trùng) lên enemy. Trả về mảng id. */
export function applyEliteMods(e, n = 1) {
  const keys = Object.keys(ELITE_MODS);
  const used = [];
  let guard = 0;

  for (let i = 0; i < n && guard < 30; i++) {
    let id;
    do {
      id = keys[Math.floor(Math.random() * keys.length)];
      guard++;
    } while (used.includes(id) && guard < 30);

    if (used.includes(id)) continue;
    used.push(id);
    ELITE_MODS[id].apply(e);
  }
  return used;
}

/** Tên hiển thị ghép của nhiều affix: "FRENZY + ARMORED". */
export function eliteModNames(ids) {
  return ids.map((id) => (ELITE_MODS[id] ? ELITE_MODS[id].name : id)).join(' + ');
}
