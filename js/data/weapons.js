/* =========================================================
   VNXX — DATA / WEAPONS
   Vũ khí + hệ thống status on-hit.

   Field mới:
   - status    : { id, dur, power, chance } — áp trạng thái khi trúng
   - chain     : { count, range, falloff }  — sét lan (arcgun)
   - charge    : thời gian vận chiêu (railgun)
   - burst     : số viên mỗi loạt (bắn liên thanh)
   ========================================================= */

export const WEAPONS = {
  /* ===================== COMMON ===================== */
  blade: {
    id: 'blade',
    name: 'ENERGY BLADE',
    rarity: 'common',
    type: 'melee',
    damage: 32,
    fireRate: 2.9,
    range: 92,
    projectileSpeed: 0,
    projectileCount: 0,
    spread: .58,
    critChance: .10,
    critMul: 2.0,
    penetration: 99,
    splash: 0,
    knockback: 320,
    price: 0,
    magazine: 0,
    reloadTime: 0,
    status: { id: 'bleed', dur: 2.6, power: 3.5, chance: .45 },
    desc: 'Cận chiến. Sát thương cao, gây CHẢY MÁU.'
  },

  pistol: {
    id: 'pistol',
    name: 'PISTOL',
    rarity: 'common',
    type: 'ranged',
    damage: 16,
    fireRate: 3.7,
    range: 430,
    projectileSpeed: 740,
    projectileCount: 1,
    spread: .042,
    critChance: .07,
    critMul: 1.8,
    penetration: 0,
    splash: 0,
    knockback: 70,
    price: 0,
    magazine: 15,
    reloadTime: 1.2,
    desc: 'Sát thương trung bình, bắn nhanh, ổn định. 15 viên/băng.'
  },

  /* ===================== UNCOMMON ===================== */
  shotgun: {
    id: 'shotgun',
    name: 'SHOTGUN',
    rarity: 'uncommon',
    type: 'ranged',
    damage: 14,
    fireRate: 1.18,
    range: 275,
    projectileSpeed: 660,
    projectileCount: 7,
    spread: .34,
    critChance: .06,
    critMul: 1.7,
    penetration: 0,
    splash: 0,
    knockback: 220,
    price: 900,
    magazine: 10,
    reloadTime: 1.0,
    desc: 'Nhiều đạn xé toạc. 10 viên/băng, nạp 1s.'
  },

  smg: {
    id: 'smg',
    name: 'SMG',
    rarity: 'uncommon',
    type: 'ranged',
    damage: 5.5,
    fireRate: 10.5,
    range: 390,
    projectileSpeed: 780,
    projectileCount: 1,
    spread: .14,
    critChance: .05,
    critMul: 1.6,
    penetration: 0,
    splash: 0,
    knockback: 35,
    price: 1000,
    magazine: 35,
    reloadTime: 2.0,
    desc: 'Tốc độ bắn cực cao, sát thương thấp. 35 viên/băng.'
  },

  needler: {
    id: 'needler',
    name: 'NEEDLER',
    rarity: 'uncommon',
    type: 'ranged',
    damage: 6,
    fireRate: 8.2,
    range: 400,
    projectileSpeed: 880,
    projectileCount: 1,
    spread: .09,
    critChance: .08,
    critMul: 1.7,
    penetration: 0,
    splash: 0,
    knockback: 30,
    price: 1150,
    magazine: 28,
    reloadTime: 1.7,
    status: { id: 'bleed', dur: 3.2, power: 5, chance: .55 },
    desc: 'Kim găm gây CHẢY MÁU liên tục. 28 viên/băng.'
  },

  /* Đạn nảy tường — dọn góc khuất cực tốt */
  ricochet: {
    id: 'ricochet',
    name: 'RICOCHET SMG',
    rarity: 'uncommon',
    type: 'ranged',
    damage: 9,
    fireRate: 6.5,
    range: 460,
    projectileSpeed: 820,
    projectileCount: 1,
    spread: .06,
    critChance: .08,
    critMul: 1.8,
    penetration: 0,
    splash: 0,
    knockback: 40,
    price: 1900,
    magazine: 24,
    reloadTime: 1.6,
    bounce: 3,
    desc: 'Đạn NẢY TƯỜNG 3 lần. Bắn vào góc để dọn quái khuất.'
  },

  /* ===================== RARE ===================== */
  rifle: {
    id: 'rifle',
    name: 'RIFLE',
    rarity: 'rare',
    type: 'ranged',
    damage: 30,
    fireRate: 5.2,
    range: 530,
    projectileSpeed: 920,
    projectileCount: 1,
    spread: .05,
    critChance: .09,
    critMul: 1.9,
    penetration: 1,
    splash: 0,
    knockback: 80,
    price: 1600,
    magazine: 5,
    reloadTime: 2.6,
    desc: 'Xuyên 1 mục tiêu. 5 viên/băng, nạp 2.6s.'
  },

  sniper: {
    id: 'sniper',
    name: 'SNIPER',
    rarity: 'rare',
    type: 'ranged',
    damage: 82,
    fireRate: .74,
    range: 940,
    projectileSpeed: 1560,
    projectileCount: 1,
    spread: .008,
    critChance: .16,
    critMul: 2.3,
    penetration: 2,
    splash: 0,
    knockback: 280,
    price: 2400,
    magazine: 5,
    reloadTime: 2.4,
    status: { id: 'bleed', dur: 3.5, power: 9, chance: .7 },
    desc: 'Sát thương cực cao, xuyên 2 mục tiêu, gây CHẢY MÁU nặng.'
  },

  flamer: {
    id: 'flamer',
    name: 'FLAMER',
    rarity: 'rare',
    type: 'ranged',
    damage: 7,
    fireRate: 9.5,
    range: 215,
    projectileSpeed: 420,
    projectileCount: 3,
    spread: .30,
    critChance: .04,
    critMul: 1.5,
    penetration: 2,
    splash: 0,
    knockback: 18,
    price: 2800,
    magazine: 70,
    reloadTime: 2.6,
    status: { id: 'burn', dur: 3.4, power: 6, chance: .85 },
    desc: 'Phun lửa tầm gần, thiêu đốt mọi thứ. 70 "nhiên liệu"/băng.'
  },

  /* Dao cắt plasma — cận chiến diện rộng */
  cutter: {
    id: 'cutter',
    name: 'PLASMA CUTTER',
    rarity: 'rare',
    type: 'melee',
    damage: 26,
    fireRate: 3.5,
    range: 112,
    projectileSpeed: 0,
    projectileCount: 0,
    spread: .92,
    critChance: .15,
    critMul: 2.05,
    penetration: 99,
    splash: 0,
    knockback: 280,
    price: 2600,
    magazine: 0,
    reloadTime: 0,
    status: { id: 'burn', dur: 3.2, power: 6, chance: .65 },
    desc: 'Vung cung rộng 105°, thiêu đốt mọi thứ trong tầm. Đánh nhanh.'
  },

  /* Lưỡi băng — xuyên + làm chậm */
  cryo: {
    id: 'cryo',
    name: 'CRYO LANCE',
    rarity: 'rare',
    type: 'ranged',
    damage: 31,
    fireRate: 2.0,
    range: 560,
    projectileSpeed: 900,
    projectileCount: 1,
    spread: .018,
    critChance: .13,
    critMul: 2.1,
    penetration: 2,
    splash: 0,
    knockback: 95,
    price: 3000,
    magazine: 6,
    reloadTime: 2.0,
    status: { id: 'chill', dur: 3.2, power: 1, chance: .92 },
    unlock: 'stage2',
    desc: 'Tia băng xuyên 2 mục tiêu, làm CHẬM rồi ĐÓNG BĂNG.'
  },

  /* ===================== EPIC ===================== */
  plasma: {
    id: 'plasma',
    name: 'PLASMA CANNON',
    rarity: 'epic',
    type: 'ranged',
    damage: 46,
    fireRate: 1.55,
    range: 610,
    projectileSpeed: 490,
    projectileCount: 1,
    spread: .02,
    critChance: .08,
    critMul: 1.9,
    penetration: 5,
    splash: 74,
    knockback: 180,
    price: 3600,
    magazine: 8,
    reloadTime: 2.0,
    status: { id: 'corrode', dur: 5, power: 2, chance: .8 },
    desc: 'Đạn plasma xuyên nhiều địch, nổ nhẹ, gây ĂN MÒN.'
  },

  grenade: {
    id: 'grenade',
    name: 'GRENADE LAUNCHER',
    rarity: 'epic',
    type: 'ranged',
    damage: 74,
    fireRate: 1.05,
    range: 660,
    projectileSpeed: 520,
    projectileCount: 1,
    spread: .03,
    critChance: .06,
    critMul: 1.8,
    penetration: 0,
    splash: 178,
    knockback: 360,
    price: 4000,
    magazine: 5,
    reloadTime: 2.4,
    status: { id: 'burn', dur: 2.6, power: 5, chance: .6 },
    desc: 'Bán kính nổ khổng lồ, thiêu đốt vùng ảnh hưởng.'
  },

  arcgun: {
    id: 'arcgun',
    name: 'ARC COIL',
    rarity: 'epic',
    type: 'ranged',
    damage: 26,
    fireRate: 2.6,
    range: 520,
    projectileSpeed: 1000,
    projectileCount: 1,
    spread: .03,
    critChance: .10,
    critMul: 2.0,
    penetration: 0,
    splash: 0,
    knockback: 90,
    price: 4400,
    magazine: 12,
    reloadTime: 1.9,
    status: { id: 'shock', dur: 3.6, power: 2, chance: .9 },
    chain: { count: 4, range: 240, falloff: .72 },
    desc: 'Sét lan tới 4 mục tiêu gần nhau. Gây TÊ LIỆT.'
  },

  rocket: {
    id: 'rocket',
    name: 'ROCKET LAUNCHER',
    rarity: 'epic',
    type: 'ranged',
    damage: 66,
    fireRate: .96,
    range: 650,
    projectileSpeed: 450,
    projectileCount: 1,
    spread: .03,
    critChance: .06,
    critMul: 1.8,
    penetration: 0,
    splash: 158,
    knockback: 340,
    price: 4200,
    magazine: 4,
    reloadTime: 2.4,
    desc: 'Sát thương lan rộng. 4 viên/băng, nạp 2.4s.'
  },

  /* Pháo hoa cầu — nhiều mảnh nổ */
  flak: {
    id: 'flak',
    name: 'FLAK CANNON',
    rarity: 'epic',
    type: 'ranged',
    damage: 12,
    fireRate: 1.1,
    range: 330,
    projectileSpeed: 640,
    projectileCount: 8,
    spread: .42,
    critChance: .05,
    critMul: 1.7,
    penetration: 0,
    splash: 62,
    knockback: 190,
    price: 4800,
    magazine: 6,
    reloadTime: 2.2,
    status: { id: 'burn', dur: 2.4, power: 4, chance: .5 },
    unlock: 'stage2',
    desc: '8 mảnh đạn nổ lan. Cực mạnh khi quái bu lại đông.'
  },

  /* Tên lửa bám đuôi của player */
  hunter: {
    id: 'hunter',
    name: 'HUNTER KILLER',
    rarity: 'epic',
    type: 'ranged',
    damage: 26,
    fireRate: 1.6,
    range: 620,
    projectileSpeed: 420,
    projectileCount: 2,
    spread: .18,
    critChance: .10,
    critMul: 2.0,
    penetration: 0,
    splash: 40,
    knockback: 120,
    price: 5200,
    magazine: 6,
    reloadTime: 2.2,
    homing: { turnRate: 3.2, speed: 540 },
    unlock: 'bosses2',
    desc: '2 tên lửa TỰ BÁM mục tiêu gần nhất. Không cần ngắm giỏi.'
  },

  /* Sét dây chuyền — dọn bầy */
  tesla: {
    id: 'tesla',
    name: 'STORM COIL',
    rarity: 'epic',
    type: 'ranged',
    damage: 18,
    fireRate: 3.0,
    range: 500,
    projectileSpeed: 940,
    projectileCount: 1,
    spread: .05,
    critChance: .08,
    critMul: 1.9,
    penetration: 0,
    splash: 0,
    knockback: 60,
    price: 5400,
    magazine: 10,
    reloadTime: 1.8,
    status: { id: 'shock', dur: 3.4, power: 2, chance: .95 },
    chain: { count: 7, range: 270, falloff: .8 },
    unlock: 'stage3',
    desc: 'Sét lan tới 7 mục tiêu. Càng đông quái càng mạnh.'
  },

  /* ===================== LEGENDARY ===================== */
  railgun: {
    id: 'railgun',
    name: 'RAILGUN',
    rarity: 'legendary',
    type: 'ranged',
    damage: 118,
    fireRate: .62,
    range: 1120,
    projectileSpeed: 2600,
    projectileCount: 1,
    spread: .004,
    critChance: .14,
    critMul: 2.2,
    penetration: 99,
    splash: 0,
    knockback: 360,
    price: 6000,
    desc: 'VẬN CHIÊU 1s ĐỂ BẮN TIA XUYÊN PHÁ. SÁT THƯƠNG X2.5 KHI ĐẦY.',
    unlock: 'bosses3',
    charge: 1.0,
    chargeDamageMul: 2.5,
    recoil: 1400,
    beamWidth: 14,
    beamDuration: .35,
    status: { id: 'shock', dur: 3, power: 3, chance: 1 },
    magazine: 0,
    reloadTime: 0
  },

  /* ===================== MYTHIC ===================== */
  voidw: {
    id: 'voidw',
    name: 'VOID WEAPON',
    rarity: 'mythic',
    type: 'ranged',
    damage: 54,
    fireRate: 2.15,
    range: 570,
    projectileSpeed: 620,
    projectileCount: 3,
    spread: .22,
    critChance: .20,
    critMul: 2.6,
    penetration: 3,
    splash: 64,
    knockback: 150,
    price: 9000,
    magazine: 20,
    reloadTime: 2.0,
    status: { id: 'weaken', dur: 4.5, power: 1, chance: .8 },
    desc: 'Vũ khí hư không. 3 viên/lần, gây SUY YẾU. 20 viên/băng.',
    unlock: 'stage3'
  }
};

/* ===================== HELPERS ===================== */

export const DEFAULT_WEAPONS = ['blade', 'pistol'];

export function getShopWeapons(profile) {
  const owned = (profile && profile.inventory && profile.inventory.weapons) || [];
  const stats = (profile && profile.statistics) || {};
  const stage = (profile && profile.currentStage) || 1;

  return Object.values(WEAPONS).filter((w) => {
    if (w.price <= 0) return false;
    if (owned.includes(w.id)) return false;

    switch (w.unlock) {
      case 'bosses2': if ((stats.bossesKilled || 0) < 2) return false; break;
      case 'bosses3': if ((stats.bossesKilled || 0) < 3) return false; break;
      case 'stage2':  if (stage < 2) return false; break;
      case 'stage3':  if (stage < 3) return false; break;
      default: break;
    }
    return true;
  });
}

export function getWeapon(id) {
  return WEAPONS[id] || WEAPONS.pistol;
}

export function hasMagazine(id) {
  const w = WEAPONS[id];
  return !!(w && w.magazine > 0 && w.type !== 'melee');
}

/** Sát thương mỗi giây ước tính — dùng cho shop so sánh. */
export function weaponDps(w) {
  if (!w) return 0;
  if (w.type === 'melee') return w.damage * w.fireRate;
  if (w.charge > 0) {
    return (w.damage * w.chargeDamageMul) / (w.charge + 1 / w.fireRate);
  }
  const shots = w.projectileCount || 1;
  return w.damage * shots * w.fireRate;
}
