/* =========================================================
   VNXX — DATA / MODULES
   Module trang bị (tối đa 4 slot). Mỗi module cộng stat trực tiếp.
   Chỉnh balance → chỉ sửa file này.
   ========================================================= */

export const MODULES = {
  /* ===================== COMMON ===================== */
  red_core: {
    id: 'red_core',
    name: 'RED CORE',
    rarity: 'common',
    desc: '+15% SÁT THƯƠNG',
    price: 750,
    mod: { damageMul: .15 }
  },

  green_core: {
    id: 'green_core',
    name: 'GREEN CORE',
    rarity: 'common',
    desc: '+10% TỐC ĐỘ',
    price: 650,
    mod: { speedMul: .10 }
  },

  /* ===================== UNCOMMON ===================== */
  blue_core: {
    id: 'blue_core',
    name: 'BLUE CORE',
    rarity: 'uncommon',
    desc: '+18% GIÁP',
    price: 850,
    mod: { armor: .18 }
  },

  /* ===================== RARE ===================== */
  crit_chip: {
    id: 'crit_chip',
    name: 'CRITICAL CHIP',
    rarity: 'rare',
    desc: '+8% CHÍ MẠNG',
    price: 1100,
    mod: { critChance: .08 }
  },

  /* ===================== EPIC ===================== */
  vamp_core: {
    id: 'vamp_core',
    name: 'VAMPIRIC CORE',
    rarity: 'epic',
    desc: '+3% HÚT MÁU',
    price: 1900,
    mod: { lifesteal: .03 }
  },

  /* ===================== LEGENDARY ===================== */
  void_core: {
    id: 'void_core',
    name: 'VOID CORE',
    rarity: 'legendary',
    desc: '+25% SÁT THƯƠNG, +10% NÉ',
    price: 4200,
    mod: { damageMul: .25, dodge: .10 }
  }
};

/* =========================================================
   CONSTANTS
   ========================================================= */
export const MAX_EQUIPPED_MODULES = 4;

/** Các key stat mà module được phép cộng vào.
 *  Đây cũng là danh sách mà `moduleMods()` duyệt qua.
 */
export const MODULE_STAT_KEYS = [
  'damageMul',
  'speedMul',
  'critChance',
  'armor',
  'lifesteal',
  'luck',
  'dodge'
];

/* =========================================================
   HELPERS
   ========================================================= */

/** Lấy module hoặc null. */
export function getModule(id) {
  return MODULES[id] || null;
}

/** Lấy danh sách id của tất cả module (dùng cho shop roll). */
export const MODULE_IDS = Object.keys(MODULES);

/** Random 1 module id. */
export function randomModuleId() {
  return MODULE_IDS[Math.floor(Math.random() * MODULE_IDS.length)];
}

/** Giá của module tiếp theo khi đã sở hữu `ownedCount` bản.
 *  Công thức: giá gốc * (1 + ownedCount * 0.6)
 *  Ví dụ: red_core lần 1 = 750, lần 2 = 750 * 1.6 = 1200, lần 3 = 750 * 2.2 = 1650.
 */
export function modulePrice(id, ownedCount = 0) {
  const m = MODULES[id];
  if (!m) return 0;
  return Math.round(m.price * (1 + ownedCount * .6));
}

/** Tính tổng stat cộng dồn từ danh sách module đã trang bị.
 *  `equipped` là mảng id (tối đa MAX_EQUIPPED_MODULES phần tử).
 *  Trả về object cùng shape MODULE_STAT_KEYS, mặc định 0.
 */
export function moduleMods(equipped = []) {
  const out = {};
  for (const k of MODULE_STAT_KEYS) out[k] = 0;

  // Nếu equipped > MAX, cắt bớt (an toàn khi save bị hỏng)
  const list = equipped.slice(0, MAX_EQUIPPED_MODULES);

  for (const id of list) {
    const m = MODULES[id];
    if (!m || !m.mod) continue;
    for (const k in m.mod) {
      if (out[k] !== undefined) out[k] += m.mod[k];
    }
  }
  return out;
}

/** Kiểm tra có thể thêm 1 module nữa vào danh sách không. */
export function canEquipMore(equipped = []) {
  return equipped.length < MAX_EQUIPPED_MODULES;
}

/** Toggle: nếu đang có → bỏ ra; nếu chưa → thêm vào (nếu còn slot).
 *  Trả về { ok: boolean, action: 'add'|'remove'|'full', list }.
 *  `list` là mảng mới (đã clone) — không mutate input.
 */
export function toggleModule(equipped = [], id) {
  const list = equipped.slice();
  const i = list.indexOf(id);

  if (i >= 0) {
    list.splice(i, 1);
    return { ok: true, action: 'remove', list };
  }

  if (list.length >= MAX_EQUIPPED_MODULES) {
    return { ok: false, action: 'full', list };
  }

  list.push(id);
  return { ok: true, action: 'add', list };
}