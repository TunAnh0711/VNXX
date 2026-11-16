/* =========================================================
   VNXX — DATA / SHOP
   Sinh stock cho shop: theo tier (stage + wave), trọng số rarity,
   reroll leo thang, cửa hàng Hư Không (shards), và bán lại.
   ========================================================= */

import { RARITY } from '../core/constants.js';
import { WEAPONS, getShopWeapons, weaponDps } from './weapons.js';
import { MODULES, modulePrice, MODULE_IDS } from './modules.js';
import { CONSUMABLES, ACTIVE_CONSUMABLE_IDS } from './consumables.js';
import { clamp, pick } from '../core/utils.js';

/* =========================================================
   TIER — càng về sau càng nhiều đồ xịn
   ========================================================= */
export function shopTier(stage, wave) {
  const s = stage || 1;
  const w = wave || 1;
  if (s >= 4 || (s >= 3 && w >= 6)) return 3;
  if (s >= 2 || w >= 5) return 2;
  return 1;
}

const TIER_WEIGHT = {
  1: { common: 60, uncommon: 30, rare: 9, epic: 1, legendary: 0, mythic: 0 },
  2: { common: 30, uncommon: 38, rare: 22, epic: 9, legendary: 1, mythic: 0 },
  3: { common: 12, uncommon: 28, rare: 32, epic: 21, legendary: 6, mythic: 1 }
};

function weightedRarity(tier, luck = 0) {
  const table = TIER_WEIGHT[tier] || TIER_WEIGHT[1];
  const keys = Object.keys(table);

  let total = 0;
  const weights = keys.map((k) => {
    let w = table[k];
    /* luck đẩy các rarity cao lên */
    if (k === 'rare') w *= 1 + luck * .5;
    if (k === 'epic') w *= 1 + luck * .9;
    if (k === 'legendary') w *= 1 + luck * 1.4;
    if (k === 'mythic') w *= 1 + luck * 1.8;
    total += w;
    return w;
  });

  let x = Math.random() * total;
  for (let i = 0; i < keys.length; i++) {
    x -= weights[i];
    if (x <= 0) return keys[i];
  }
  return keys[0];
}

function rarityRank(r) {
  return ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].indexOf(r);
}

/* =========================================================
   REROLL COST — leo thang trong cùng 1 lần mở shop
   ========================================================= */
export function rerollCost(times) {
  return 150 + (times || 0) * 120;
}

/* =========================================================
   GENERATE STOCK
   ========================================================= */
export function generateStock(game, state) {
  const pr = game.profile;
  const W = game.world;
  const p = W ? W.player : null;

  const tier = shopTier(W ? W.stage : pr.currentStage, W ? W.wave : pr.currentWave);
  const luck = (p && p.up && p.up.luck) || 0;

  const stock = [];
  const owned = (pr.inventory && pr.inventory.weapons) || [];
  const modules = (pr.inventory && pr.inventory.modules) || {};

  /* ---------- 2 vũ khí ---------- */
  const weaponPool = getShopWeapons(pr).filter((w) => !owned.includes(w.id));

  for (let i = 0; i < 2 && weaponPool.length > 0; i++) {
    const want = weightedRarity(tier, luck);
    const wantRank = rarityRank(want);

    /* chọn vũ khí gần rarity mong muốn nhất */
    let bestIdx = 0;
    let bestDiff = 99;
    for (let k = 0; k < weaponPool.length; k++) {
      const diff = Math.abs(rarityRank(weaponPool[k].rarity) - wantRank);
      if (diff < bestDiff) { bestDiff = diff; bestIdx = k; }
    }

    const w = weaponPool.splice(bestIdx, 1)[0];
    const r = RARITY[w.rarity] || RARITY.common;

    stock.push({
      kind: 'weapon',
      id: w.id,
      name: w.name,
      desc: w.desc,
      rarity: w.rarity,
      price: Math.round(w.price * (1 + (tier - 1) * .08)),
      dps: Math.round(weaponDps(w)),
      meta: r.stars
    });
  }

  /* ---------- 2 module ---------- */
  const modPool = MODULE_IDS.slice();
  for (let i = 0; i < 2 && modPool.length > 0; i++) {
    const id = modPool.splice(Math.floor(Math.random() * modPool.length), 1)[0];
    const m = MODULES[id];
    const count = modules[id] || 0;

    stock.push({
      kind: 'module',
      id,
      name: m.name,
      desc: m.desc,
      rarity: m.rarity,
      price: modulePrice(id, count),
      meta: 'ĐANG CÓ ' + count
    });
  }

  /* ---------- 1 consumable ---------- */
  {
    const pool = ACTIVE_CONSUMABLE_IDS.slice();
    if (pr.difficulty !== 'hardcore') pool.push('revive_token');
    const id = pick(pool);
    const c = CONSUMABLES[id];

    stock.push({
      kind: 'consumable',
      id,
      name: c.name,
      desc: c.desc,
      rarity: c.rarity,
      price: Math.round(c.price * (1 + (tier - 1) * .1)),
      meta: 'TÚI: ' + (((pr.inventory && pr.inventory.consumables) || {})[id] || 0)
    });
  }

  /* ---------- 1 ô "đặc biệt" theo tier ---------- */
  if (tier >= 2) {
    stock.push({
      kind: 'ammo',
      id: 'ammo',
      name: 'NẠP ĐẦY BĂNG ĐẠN',
      desc: 'Nạp đầy băng hiện tại ngay lập tức',
      rarity: 'uncommon',
      price: 220,
      meta: ''
    });
  } else {
    stock.push({
      kind: 'heal',
      id: 'heal',
      name: 'HỒI MÁU ĐẦY',
      desc: 'Hồi đầy HP ngay lập tức',
      rarity: 'common',
      price: 380,
      meta: ''
    });
  }

  /* ---------- luôn có 1 heal nếu ô trên không phải heal ---------- */
  if (!stock.some((s) => s.kind === 'heal')) {
    stock.push({
      kind: 'heal',
      id: 'heal',
      name: 'HỒI MÁU ĐẦY',
      desc: 'Hồi đầy HP ngay lập tức',
      rarity: 'common',
      price: 380,
      meta: ''
    });
  }

  return stock;
}

/* =========================================================
   SHARD SHOP — mua bằng Void Shards, buff vĩnh viễn
   ========================================================= */
export const SHARD_ITEMS = [
  {
    id: 'perm_hp',
    name: 'LÕI SINH MỆNH',
    desc: '+12 MÁU TỐI ĐA vĩnh viễn',
    price: 4,
    max: 12,
    icon: '❤'
  },
  {
    id: 'perm_dmg',
    name: 'LÕI CUỒNG NỘ',
    desc: '+6% SÁT THƯƠNG vĩnh viễn',
    price: 5,
    max: 15,
    icon: '⚔'
  },
  {
    id: 'perm_speed',
    name: 'LÕI GIA TỐC',
    desc: '+4% TỐC CHẠY vĩnh viễn',
    price: 3,
    max: 10,
    icon: '➤'
  },
  {
    id: 'perm_luck',
    name: 'LÕI MAY MẮN',
    desc: '+10% MAY MẮN vĩnh viễn',
    price: 3,
    max: 10,
    icon: '🍀'
  },
  {
    id: 'perm_crit',
    name: 'LÕI CHÍ MẠNG',
    desc: '+4% CHÍ MẠNG vĩnh viễn',
    price: 4,
    max: 10,
    icon: '✷'
  },
  {
    id: 'perm_od',
    name: 'LÕI QUÁ TẢI',
    desc: '+8% tốc nạp Overdrive vĩnh viễn',
    price: 6,
    max: 8,
    icon: '⚙'
  },
  {
    id: 'perm_status',
    name: 'LÕI DỊCH BỆNH',
    desc: '+12% sức mạnh trạng thái vĩnh viễn',
    price: 6,
    max: 8,
    icon: '☣'
  },
  {
    id: 'shard_module',
    name: 'MODULE HUYỀN THOẠI',
    desc: 'Nhận ngẫu nhiên 1 module LEGENDARY',
    price: 9,
    max: 99,
    icon: '◆'
  }
];

/** Số lần đã mua của 1 shard item. */
export function shardOwned(profile, id) {
  const m = (profile && profile.shardBought) || {};
  return m[id] || 0;
}

/** Danh sách shard item còn mua được. */
export function availableShardItems(profile) {
  return SHARD_ITEMS.filter((it) => shardOwned(profile, it.id) < it.max);
}

/** Áp shard item lên profile. Trả về { ok, msg }. */
export function applyShardItem(profile, id) {
  const it = SHARD_ITEMS.find((x) => x.id === id);
  if (!it) return { ok: false, msg: 'không tồn tại' };

  if (shardOwned(profile, id) >= it.max) {
    return { ok: false, msg: 'đã đạt giới hạn' };
  }

  if ((profile.shards || 0) < it.price) {
    return { ok: false, msg: 'không đủ shard' };
  }

  profile.shards -= it.price;
  profile.shardBought = profile.shardBought || {};
  profile.shardBought[id] = shardOwned(profile, id) + 1;

  const up = profile.upgrades;

  switch (id) {
    case 'perm_hp':     up.maxHpMul = (up.maxHpMul || 0) + .12; break;
    case 'perm_dmg':    up.damageMul = (up.damageMul || 0) + .06; break;
    case 'perm_speed':  up.speedMul = (up.speedMul || 0) + .04; break;
    case 'perm_luck':   up.luck = (up.luck || 0) + .10; break;
    case 'perm_crit':   up.critChance = (up.critChance || 0) + .04; break;
    case 'perm_od':     up.odGainMul = (up.odGainMul || 0) + .08; break;
    case 'perm_status': up.statusPowerMul = (up.statusPowerMul || 0) + .12; break;

    case 'shard_module': {
      const legend = MODULE_IDS.filter((m) => MODULES[m].rarity === 'legendary');
      const mid = pick(legend.length ? legend : MODULE_IDS);
      profile.inventory.modules = profile.inventory.modules || {};
      profile.inventory.modules[mid] = (profile.inventory.modules[mid] || 0) + 1;
      return { ok: true, msg: 'NHẬN: ' + MODULES[mid].name };
    }
  }

  return { ok: true, msg: 'ĐÃ MUA: ' + it.name };
}

/* =========================================================
   SELL — bán lại đồ trong túi
   ========================================================= */
export function sellPrice(kind, id) {
  if (kind === 'module') {
    const m = MODULES[id];
    return m ? Math.round(m.price * .40) : 0;
  }
  if (kind === 'consumable') {
    const c = CONSUMABLES[id];
    return c ? Math.round(c.price * .40) : 0;
  }
  if (kind === 'weapon') {
    const w = WEAPONS[id];
    return w ? Math.round(w.price * .35) : 0;
  }
  return 0;
}

export function listSellable(profile) {
  const out = [];
  const inv = profile.inventory || {};

  /* module chưa gắn */
  const equipped = profile.equippedModules || [];
  const modules = inv.modules || {};
  for (const id in modules) {
    const n = modules[id] || 0;
    const eq = equipped.filter((x) => x === id).length;
    const spare = n - eq;
    if (spare > 0) {
      out.push({
        kind: 'module',
        id,
        name: MODULES[id] ? MODULES[id].name : id,
        count: spare,
        price: sellPrice('module', id),
        rarity: MODULES[id] ? MODULES[id].rarity : 'common'
      });
    }
  }

  /* consumable */
  const cons = inv.consumables || {};
  for (const id in cons) {
    const n = cons[id] || 0;
    if (n <= 0) continue;
    if (id === 'medkit') continue;         // giữ lại medkit cơ bản
    if (id === 'revive_token') continue;   // không bán token hồi sinh
    out.push({
      kind: 'consumable',
      id,
      name: CONSUMABLES[id] ? CONSUMABLES[id].name : id,
      count: n,
      price: sellPrice('consumable', id),
      rarity: CONSUMABLES[id] ? CONSUMABLES[id].rarity : 'common'
    });
  }

  /* vũ khí không dùng */
  const weapons = inv.weapons || [];
  const current = profile.weapon;
  for (const id of weapons) {
    if (id === 'pistol' || id === 'blade') continue;
    if (id === current) continue;
    out.push({
      kind: 'weapon',
      id,
      name: WEAPONS[id] ? WEAPONS[id].name : id,
      count: 1,
      price: sellPrice('weapon', id),
      rarity: WEAPONS[id] ? WEAPONS[id].rarity : 'common'
    });
  }

  return out;
}

/* =========================================================
   COMPARE — so sánh vũ khí với đồ đang cầm
   ========================================================= */
export function compareWeapon(profile, id) {
  const cur = WEAPONS[profile.weapon];
  const next = WEAPONS[id];
  if (!cur || !next) return null;

  const a = weaponDps(cur);
  const b = weaponDps(next);
  return {
    from: Math.round(a),
    to: Math.round(b),
    delta: Math.round(((b - a) / Math.max(1, a)) * 100)
  };
}

export default {
  shopTier,
  rerollCost,
  generateStock,
  SHARD_ITEMS,
  shardOwned,
  availableShardItems,
  applyShardItem,
  sellPrice,
  listSellable,
  compareWeapon
};
