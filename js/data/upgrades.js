/* =========================================================
   VNXX — DATA / UPGRADES
   Level-up cards (chọn 1 trong 3 mỗi lần lên cấp).
   Chỉnh balance → chỉ sửa file này.
   ========================================================= */

export const UPGRADES = [
  {
    id: 'hp',
    icon: '❤',
    name: '+22% MÁU TỐI ĐA',
    desc: 'Tăng máu tối đa và hồi đầy',
    apply: (p) => {
      p.maxHp = Math.round(p.maxHp * 1.22);
      p.hp = p.maxHp;
    }
  },

  {
    id: 'dmg',
    icon: '⚔',
    name: '+15% SÁT THƯƠNG',
    desc: 'Tất cả vũ khí mạnh hơn',
    apply: (p) => { p.up.damageMul += .15; }
  },

  {
    id: 'spd',
    icon: '➤',
    name: '+12% TỐC ĐỘ',
    desc: 'Di chuyển nhanh hơn',
    apply: (p) => { p.up.speedMul += .12; }
  },

  {
    id: 'as',
    icon: '⚡',
    name: '+14% TỐC ĐỘ ĐÁNH',
    desc: 'Giảm cooldown tấn công',
    apply: (p) => { p.up.attackSpeedMul += .14; }
  },

  {
    id: 'crit',
    icon: '✷',
    name: '+8% CHÍ MẠNG',
    desc: 'Tăng tỉ lệ chí mạng',
    apply: (p) => { p.up.critChance += .08; }
  },

  {
    id: 'critd',
    icon: '✦',
    name: '+35% SÁT THƯƠNG CHÍ MẠNG',
    desc: 'Chí mạng gây nhiều sát thương hơn',
    apply: (p) => { p.up.critMul += .35; }
  },

  {
    id: 'armor',
    icon: '🛡',
    name: '+12% GIÁP',
    desc: 'Giảm sát thương nhận vào',
    apply: (p) => { p.up.armor += .12; }
  },

  {
    id: 'dodge',
    icon: '💨',
    name: '+7% NÉ TRÁNH',
    desc: 'Cơ hội bỏ qua hoàn toàn sát thương',
    apply: (p) => { p.up.dodge += .07; }
  },

  {
    id: 'ls',
    icon: '🩸',
    name: '+3% HÚT MÁU',
    desc: 'Hồi máu theo sát thương gây ra',
    apply: (p) => { p.up.lifesteal += .03; }
  },

  {
    id: 'range',
    icon: '◎',
    name: '+15% TẦM BẮN',
    desc: 'Tăng tầm và tốc độ đạn',
    apply: (p) => { p.up.rangeMul += .15; }
  },

  {
    id: 'luck',
    icon: '🍀',
    name: '+15% MAY MẮN',
    desc: 'Nhiều loot và tỉ lệ hiếm hơn',
    apply: (p) => { p.up.luck += .15; }
  },

  {
    id: 'heal',
    icon: '✚',
    name: 'HỒI MÁU NGAY',
    desc: 'Hồi 60% máu tối đa',
    apply: (p) => { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * .6); }
  }
];

/* =========================================================
   HELPERS
   ========================================================= */

/** Map id -> upgrade để lookup O(1). */
export const UPGRADE_BY_ID = Object.fromEntries(
  UPGRADES.map((u) => [u.id, u])
);

/** Trả về n upgrade ngẫu nhiên KHÔNG trùng, đã shuffle.
 *  Mặc định n = 3 như game gốc.
 */
export function pickUpgrades(n = 3, exclude = []) {
  const pool = UPGRADES.filter((u) => !exclude.includes(u.id));
  const out = [];
  const copy = pool.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  for (let i = 0; i < n && i < copy.length; i++) out.push(copy[i]);
  return out;
}

/** Áp upgrade theo id lên player. Trả về true nếu thành công. */
export function applyUpgrade(id, player) {
  const u = UPGRADE_BY_ID[id];
  if (!u || typeof u.apply !== 'function') return false;
  u.apply(player);
  return true;
}