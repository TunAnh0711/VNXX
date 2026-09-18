/* =========================================================
   VNXX — GAME / LOOT
   Quản lý loot drop, nhặt loot, rương (chest).
   Nhận `game` và `W` làm tham số → không import Game.
   ========================================================= */

import { CFG } from '../core/constants.js';
import {
  clamp, lerp, dist, rnd, rndInt, pick, removeAt, TAU
} from '../core/utils.js';
import { CONSUMABLES } from '../data/consumables.js';
import { MODULES } from '../data/modules.js';
import Sound from '../systems/sound.js';
import { Fx, FloatText } from '../systems/fx.js';

/* =========================================================
   DROP LOOT
   Rơi 1 mảnh loot tại (x, y) với vận tốc ngẫu nhiên.
   ========================================================= */
export function dropLoot(W, x, y, type, value) {
  const a = Math.random() * TAU;
  const s = rnd(40, 140);

  W.loot.push({
    x, y,
    vx: Math.cos(a) * s,
    vy: Math.sin(a) * s,
    type,           // 'credit' | 'xp' | 'hp' | 'shard'
    value,
    life: 26,
    r: 8,
    color: lootColor(type)
  });
}

function lootColor(type) {
  switch (type) {
    case 'credit': return '#ffc44d';
    case 'xp':     return '#28e0ff';
    case 'hp':     return '#39ff9e';
    case 'shard':  return '#a06bff';
    default:       return '#ffffff';
  }
}

/* =========================================================
   UPDATE LOOT (mỗi frame)
   - Trôi + friction
   - Hút về player khi trong tầm pickup
   - Nhặt khi chạm
   ========================================================= */
export function updateLoot(game, W, dt) {
  const p = W.player;

  for (let i = W.loot.length - 1; i >= 0; i--) {
    const l = W.loot[i];

    /* Lifetime */
    l.life -= dt;
    if (l.life <= 0) {
      removeAt(W.loot, i);
      continue;
    }

    /* Trôi + friction */
    l.x += l.vx * dt;
    l.y += l.vy * dt;
    l.vx *= 1 - 4 * dt;
    l.vy *= 1 - 4 * dt;

    if (!p.alive) continue;

    /* Hút về player khi trong tầm */
    const d = dist(l, p);
    if (d < CFG.PLAYER.pickupRange) {
      const a = Math.atan2(p.y - l.y, p.x - l.x);
      const pull = lerp(720, 180, d / CFG.PLAYER.pickupRange);
      l.x += Math.cos(a) * pull * dt;
      l.y += Math.sin(a) * pull * dt;
    }

    /* Nhặt */
    if (d < 24) {
      collectLoot(game, W, l);
      removeAt(W.loot, i);
    }
  }
}

/* =========================================================
   COLLECT LOOT
   Áp dụng hiệu ứng của loot lên player.
   ========================================================= */
export function collectLoot(game, W, l) {
  const p = W.player;

  switch (l.type) {
    case 'credit':
      p.credits += l.value;
      game.profile.statistics.creditsEarned += l.value;
      FloatText.add(
        W.texts,
        p.x + rnd(-16, 16),
        p.y - 28,
        '+' + l.value,
        '#ffc44d',
        12,
        -40
      );
      break;

    case 'xp':
      game.addXp(l.value);
      FloatText.add(
        W.texts,
        p.x + rnd(-16, 16),
        p.y - 28,
        '+' + l.value + ' XP',
        '#28e0ff',
        12,
        -40
      );
      break;

    case 'hp':
      p.hp = Math.min(p.maxHp, p.hp + l.value);
      FloatText.add(
        W.texts,
        p.x,
        p.y - 28,
        '+' + l.value + ' HP',
        '#39ff9e',
        13,
        -40
      );
      break;

    case 'shard':
      p.shards += l.value;
      FloatText.add(
        W.texts,
        p.x,
        p.y - 28,
        '+' + l.value + ' SHARD',
        '#a06bff',
        14,
        -40
      );
      break;
  }

  Fx.burst(W.particles, l.x, l.y, 3, l.color, 110, .25, 2.5);
  Sound.sfx('pickup');
}

/* =========================================================
   SPAWN CHEST
   Thêm rương vào world tại (x, y) với rarity chỉ định.
   ========================================================= */
export function spawnChest(W, x, y, rarity = 'common') {
  W.chests.push({
    x, y,
    rarity,
    r: 22,
    open: false,
    anim: 0,
    life: 0
  });
}

/* =========================================================
   UPDATE CHESTS (mỗi frame)
   - Giảm anim (animation mở rương)
   - Xoá rương sau 3s kể từ khi mở
   ========================================================= */
export function updateChests(W, dt) {
  for (let i = W.chests.length - 1; i >= 0; i--) {
    const c = W.chests[i];

    if (c.anim > 0) c.anim = Math.max(0, c.anim - dt);

    if (c.open) {
      c.life += dt;
      if (c.life > 3) removeAt(W.chests, i);
    }
  }
}

/* =========================================================
   OPEN CHEST
   Roll rewards theo tier (common/rare/legendary).
   - Credit tỉ lệ với stage
   - Shard nếu tier 3
   - Consumable ngẫu nhiên
   - Module nếu tier >= 2
   ========================================================= */
export function openChest(game, W, c) {
  if (c.open) return;
  c.open = true;
  c.anim = 1;

  const pr = game.profile;
  const p = W.player;

  const tier = { common: 1, rare: 2, legendary: 3 }[c.rarity] || 1;

  /* VFX + SFX */
  Sound.sfx('chest');
  Fx.burst(W.particles, c.x, c.y, 20, '#ffc44d', 240, .7, 4);
  Fx.ring(W.particles, c.x, c.y, '#ffc44d', 90, .5);

  /* ---------- Credits ---------- */
  const cr = rndInt(60, 140) * tier * W.stage;
  p.credits += cr;
  pr.statistics.creditsEarned += cr;
  FloatText.add(W.texts, c.x, c.y - 20, '+' + cr + ' CR', '#ffc44d', 15);

  /* ---------- Shard (chỉ tier 3, tỉ lệ 40%) ---------- */
  const roll = Math.random();
  if (tier >= 3 && roll < .4) {
    p.shards += 1;
    FloatText.add(W.texts, c.x, c.y - 44, '+1 VOID SHARD', '#a06bff', 15);
  }

  /* ---------- Consumable (30%) ---------- */
  if (roll < .30) {
    const activeIds = Object.keys(CONSUMABLES).filter(
      (k) => !CONSUMABLES[k].passive
    );
    const cid = pick(activeIds);
    pr.inventory.consumables[cid] = (pr.inventory.consumables[cid] || 0) + 1;
    FloatText.add(
      W.texts,
      c.x,
      c.y - 64,
      '+' + CONSUMABLES[cid].name,
      '#39ff9e',
      14
    );
  }

  /* ---------- Module (tier >= 2, tỉ lệ 30% khi roll > .7) ---------- */
  if (tier >= 2 && roll > .7) {
    const mid = pick(Object.keys(MODULES));
    pr.inventory.modules = pr.inventory.modules || {};
    pr.inventory.modules[mid] = (pr.inventory.modules[mid] || 0) + 1;
    FloatText.add(
      W.texts,
      c.x,
      c.y - 84,
      '+' + MODULES[mid].name,
      '#a06bff',
      14
    );
  }

  game.updateHUD();
  if (window.VNXX?.Save) window.VNXX.Save.auto(pr);
}