/* =========================================================
   VNXX — DATA / CONSUMABLES
   Vật phẩm tiêu hao (dùng 1 lần hoặc passive).
   Chỉnh balance → chỉ sửa file này.

   LƯU Ý: `use(p, ctx)` nhận THÊM ctx để truy cập world (cho
   item kiểu freeze). Không import Game → tránh circular dependency.
   ========================================================= */

export const CONSUMABLES = {
  /* ===================== COMMON ===================== */
  medkit: {
    id: 'medkit',
    name: 'MEDKIT',
    rarity: 'common',
    desc: 'Hồi 45% máu tối đa',
    price: 250,
    use: (p) => {
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * .45);
    }
  },

  /* ===================== UNCOMMON ===================== */
  dmg_boost: {
    id: 'dmg_boost',
    name: 'DAMAGE BOOST',
    rarity: 'uncommon',
    desc: '+60% sát thương trong 20s',
    price: 600,
    duration: 20,
    use: (p) => {
      p.buffs.dmg = Math.max(p.buffs.dmg, 20);
    }
  },

  shield_pack: {
    id: 'shield_pack',
    name: 'SHIELD',
    rarity: 'uncommon',
    desc: '+60 giáp ảo trong 25s',
    price: 550,
    duration: 25,
    use: (p) => {
      p.buffs.shield = Math.max(p.buffs.shield, 25);
      p.shield = 60;
    }
  },

  /* ===================== RARE ===================== */
  repair: {
    id: 'repair',
    name: 'FULL REPAIR',
    rarity: 'rare',
    desc: 'Hồi đầy máu',
    price: 900,
    use: (p) => {
      p.hp = p.maxHp;
    }
  },

  /* ===================== EPIC ===================== */
  berserk: {
    id: 'berserk',
    name: 'BERSERK',
    rarity: 'epic',
    desc: '+90% tốc đánh, +30% tốc chạy (15s)',
    price: 1400,
    duration: 15,
    use: (p) => {
      p.buffs.berserk = Math.max(p.buffs.berserk, 15);
    }
  },

  freeze: {
    id: 'freeze',
    name: 'FREEZE',
    rarity: 'epic',
    desc: 'Đóng băng mọi kẻ địch 6s',
    price: 1200,
    duration: 6,
    use: (_p, ctx) => {
      const W = ctx && ctx.world;
      if (!W || !W.enemies) return;
      for (const e of W.enemies) {
        e.frozen = Math.max(e.frozen || 0, 6);
      }
    }
  },

  /* ===================== LEGENDARY ===================== */
  revive_token: {
    id: 'revive_token',
    name: 'REVIVE TOKEN',
    rarity: 'legendary',
    desc: 'Hồi sinh tại chỗ khi chết',
    price: 3500,
    passive: true,               // KHÔNG dùng trực tiếp, chỉ tiêu thụ khi chết
    use: () => { /* no-op, xử lý trong Game.revive() */ }
  },
  
  /* ===================== BUFF ĐẶC BIỆT (rương) ===================== */
  shield_buff: {
    id: 'shield_buff',
    name: 'ENERGY SHIELD',
    rarity: 'rare',
    desc: '+100 giáp ảo trong 15s',
    price: 0,
    duration: 15,
    use: (p) => {
      p.buffs.shield = Math.max(p.buffs.shield, 15);
      p.shield = 100;
    }
  },
  
  speed_boost: {
    id: 'speed_boost',
    name: 'HYPER SPEED',
    rarity: 'rare',
    desc: '+80% tốc chạy trong 12s',
    price: 0,
    duration: 12,
    use: (p) => {
      p.buffs.speedBoost = Math.max(p.buffs.speedBoost, 12);
      p.speedBoostFactor = 1.8;
    }
  },
  
  triple_shot: {
    id: 'triple_shot',
    name: 'TRIPLE SHOT',
    rarity: 'epic',
    desc: 'Bắn x3 đạn trong 10s',
    price: 0,
    duration: 10,
    use: (p) => {
      p.buffs.tripleShot = Math.max(p.buffs.tripleShot, 10);
    }
  },
  
  rapid_fire: {
    id: 'rapid_fire',
    name: 'RAPID FIRE',
    rarity: 'epic',
    desc: '+100% tốc bắn trong 12s',
    price: 0,
    duration: 12,
    use: (p) => {
      p.buffs.rapidFire = Math.max(p.buffs.rapidFire, 12);
    }
  },
  
  invincibility: {
    id: 'invincibility',
    name: 'GOD MODE',
    rarity: 'legendary',
    desc: 'Bất tử trong 5s',
    price: 0,
    duration: 5,
    use: (p) => {
      p.buffs.invincible = Math.max(p.buffs.invincible, 5);
    }
  }
};

/* =========================================================
   CONSTANTS
   ========================================================= */
export const CONSUMABLE_IDS = Object.keys(CONSUMABLES);

/** Danh sách có thể dùng trực tiếp (loại trừ passive). */
export const ACTIVE_CONSUMABLE_IDS = CONSUMABLE_IDS.filter(
  (id) => !CONSUMABLES[id].passive
);

/** Danh sách passive (không hiện nút click dùng). */
export const PASSIVE_CONSUMABLE_IDS = CONSUMABLE_IDS.filter(
  (id) => CONSUMABLES[id].passive
);

/* =========================================================
   HELPERS
   ========================================================= */

/** Lấy consumable hoặc null. */
export function getConsumable(id) {
  return CONSUMABLES[id] || null;
}

/** Random 1 consumable id (chỉ active). */
export function randomActiveConsumableId() {
  return ACTIVE_CONSUMABLE_IDS[
    Math.floor(Math.random() * ACTIVE_CONSUMABLE_IDS.length)
  ];
}

/** Kiểm tra item có phải passive không. */
export function isPassive(id) {
  return !!CONSUMABLES[id]?.passive;
}

/** Dùng 1 consumable: trừ inventory, chạy use(p, ctx).
 *  Trả về { ok, reason? }.
 *  - inventory: profile.inventory.consumables (object {id: count})
 *  - player:    world.player
 *  - ctx:       { world } (tùy chọn, cần cho item freeze)
 */
export function consume(id, inventory, player, ctx) {
  const c = CONSUMABLES[id];
  if (!c) return { ok: false, reason: 'unknown' };

  const count = inventory?.[id] || 0;
  if (count <= 0) return { ok: false, reason: 'empty' };

  if (c.passive) return { ok: false, reason: 'passive' };

  inventory[id] = count - 1;
  try {
    c.use(player, ctx);
  } catch (err) {
    console.warn('[Consumable] use failed:', id, err);
    // Không rollback vì hiếm khi xảy ra và có thể gây double-use
  }
  return { ok: true };
}

/** Đếm tổng số consumable trong inventory (dùng cho invCount). */
export function countConsumables(inventory = {}) {
  let total = 0;
  for (const id in inventory) {
    total += inventory[id] || 0;
  }
  return total;
}