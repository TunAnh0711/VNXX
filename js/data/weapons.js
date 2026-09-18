/* =========================================================
   VNXX — DATA / WEAPONS
   Toàn bộ vũ khí trong game.
   Chỉnh balance → chỉ sửa file này.
   ========================================================= */

export const WEAPONS = {
  /* ===================== COMMON ===================== */
  blade: {
    id: 'blade',
    name: 'ENERGY BLADE',
    rarity: 'common',
    type: 'melee',
    damage: 30,
    fireRate: 2.8,
    range: 84,
    projectileSpeed: 0,
    projectileCount: 0,
    spread: .55,
    critChance: .10,
    critMul: 2.0,
    penetration: 99,
    splash: 0,
    knockback: 300,
    price: 0,
    desc: 'Cận chiến. Sát thương cao, tầm ngắn, cooldown thấp.'
  },

  pistol: {
    id: 'pistol',
    name: 'PISTOL',
    rarity: 'common',
    type: 'ranged',
    damage: 15,
    fireRate: 3.6,
    range: 420,
    projectileSpeed: 720,
    projectileCount: 1,
    spread: .045,
    critChance: .07,
    critMul: 1.8,
    penetration: 0,
    splash: 0,
    knockback: 70,
    price: 0,
    desc: 'Sát thương trung bình, bắn nhanh, ổn định.'
  },

  /* ===================== UNCOMMON ===================== */
  shotgun: {
    id: 'shotgun',
    name: 'SHOTGUN',
    rarity: 'uncommon',
    type: 'ranged',
    damage: 10,
    fireRate: 1.15,
    range: 270,
    projectileSpeed: 640,
    projectileCount: 7,
    spread: .34,
    critChance: .06,
    critMul: 1.7,
    penetration: 0,
    splash: 0,
    knockback: 220,
    price: 900,
    desc: 'Nhiều đạn xé toạc. Sát thương cực cao ở cự ly gần.'
  },

  smg: {
    id: 'smg',
    name: 'SMG',
    rarity: 'uncommon',
    type: 'ranged',
    damage: 8,
    fireRate: 10.5,
    range: 380,
    projectileSpeed: 760,
    projectileCount: 1,
    spread: .14,
    critChance: .05,
    critMul: 1.6,
    penetration: 0,
    splash: 0,
    knockback: 35,
    price: 1000,
    desc: 'Tốc độ bắn cực cao, sát thương thấp, tản mát.'
  },

  /* ===================== RARE ===================== */
  rifle: {
    id: 'rifle',
    name: 'RIFLE',
    rarity: 'rare',
    type: 'ranged',
    damage: 19,
    fireRate: 5.2,
    range: 520,
    projectileSpeed: 900,
    projectileCount: 1,
    spread: .05,
    critChance: .09,
    critMul: 1.9,
    penetration: 1,
    splash: 0,
    knockback: 80,
    price: 1600,
    desc: 'Cân bằng. Xuyên 1 mục tiêu.'
  },

  sniper: {
    id: 'sniper',
    name: 'SNIPER',
    rarity: 'rare',
    type: 'ranged',
    damage: 78,
    fireRate: .72,
    range: 900,
    projectileSpeed: 1500,
    projectileCount: 1,
    spread: .008,
    critChance: .16,
    critMul: 2.3,
    penetration: 2,
    splash: 0,
    knockback: 280,
    price: 2400,
    desc: 'Sát thương cực cao, tốc độ bắn rất thấp, xuyên 2 mục tiêu.'
  },

  /* ===================== EPIC ===================== */
  plasma: {
    id: 'plasma',
    name: 'PLASMA CANNON',
    rarity: 'epic',
    type: 'ranged',
    damage: 44,
    fireRate: 1.5,
    range: 600,
    projectileSpeed: 470,
    projectileCount: 1,
    spread: .02,
    critChance: .08,
    critMul: 1.9,
    penetration: 5,
    splash: 70,
    knockback: 180,
    price: 3600,
    desc: 'Đạn plasma lớn, xuyên nhiều kẻ địch, nổ nhẹ.'
  },

  rocket: {
    id: 'rocket',
    name: 'ROCKET LAUNCHER',
    rarity: 'epic',
    type: 'ranged',
    damage: 62,
    fireRate: .95,
    range: 640,
    projectileSpeed: 430,
    projectileCount: 1,
    spread: .03,
    critChance: .06,
    critMul: 1.8,
    penetration: 0,
    splash: 150,
    knockback: 340,
    price: 4200,
    desc: 'Sát thương lan trên diện rộng. Nguy hiểm ở cự ly gần.'
  },

  /* ===================== LEGENDARY ===================== */
  railgun: {
    id: 'railgun',
    name: 'RAILGUN',
    rarity: 'legendary',
    type: 'ranged',
    damage: 110,
    fireRate: .62,
    range: 1100,
    projectileSpeed: 2600,
    projectileCount: 1,
    spread: .004,
    critChance: .14,
    critMul: 2.2,
    penetration: 99,
    splash: 0,
    knockback: 360,
    price: 6000,
    desc: 'VẬN CHIÊU 1s ĐỂ BẮN TIA XUYÊN PHÁ. SÁT THƯƠNG X2 KHI ĐẦY.',
    unlock: 'bosses3',

    /* ====== NÂNG CẤP CHARGE ====== */
    charge: 1.0,
    chargeDamageMul: 2.5,
    recoil: 1400,
    beamWidth: 14,
    beamDuration: .35
  },

  /* ===================== MYTHIC ===================== */
  voidw: {
    id: 'voidw',
    name: 'VOID WEAPON',
    rarity: 'mythic',
    type: 'ranged',
    damage: 52,
    fireRate: 2.1,
    range: 560,
    projectileSpeed: 600,
    projectileCount: 3,
    spread: .22,
    critChance: .20,
    critMul: 2.6,
    penetration: 3,
    splash: 60,
    knockback: 150,
    price: 9000,
    desc: 'Vũ khí hư không. Hiệu ứng đặc biệt, chí mạng cực cao.',
    unlock: 'stage3'
  }
};

/* ===================== HELPERS ===================== */

/** Danh sách id vũ khí mặc định (nhân vật mới). */
export const DEFAULT_WEAPONS = ['blade', 'pistol'];

/** Vũ khí mua được ở shop (có price > 0 và không bị lock). */
export function getShopWeapons(profile) {
  const owned = profile?.inventory?.weapons || [];
  const stats = profile?.statistics || {};
  const stage = profile?.currentStage || 1;

  return Object.values(WEAPONS).filter((w) => {
    if (w.price <= 0) return false;
    if (owned.includes(w.id)) return false;

    if (w.unlock === 'bosses3' && (stats.bossesKilled || 0) < 3) return false;
    if (w.unlock === 'stage3'  && stage < 3) return false;

    return true;
  });
}

/** Lấy weapon hoặc trả về pistol nếu id sai. */
export function getWeapon(id) {
  return WEAPONS[id] || WEAPONS.pistol;
}