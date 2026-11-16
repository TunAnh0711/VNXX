/* =========================================================
   VNXX — GAME / BOSS SUMMON
   Hệ thống triệu hồi quái cho BossV2.

   Tính năng:
   - 5 formation: circle / line / arc / random / behind
   - Tint màu minion theo boss (đổi theo phase)
   - Difficulty scaling: elite chance, HP, count
   - Auto cleanup khi boss chết
   - Tracking minion qua W.bossMinions[]

   Cách dùng trong boss-attacks.js:
     import { summonWithFormation } from './boss-summon.js';
     summonWithFormation(boss, game, W, cfg);

   cfg = {
     types: ['drone', 'shield'],       // pool quái
     count: { 2: 3, 3: 4 },            // count theo phase (fallback 1)
     spawnRadius: 140,                 // bán kính spawn
     eliteChance: 0.15,                // xác suất elite
     formation: 'circle',              // circle|line|arc|random|behind
     tintByPhase: true,                // minion đổi màu theo phase
     hpMul: 0.6,                       // scale HP minion (0.6 = 60%)
     xpMul: 0.5,                       // scale XP (0.5 = 50%)
     creditsMul: 0.5,
     lifetime: 25                      // tự hủy sau 25s (0 = vô hạn)
   };
   ========================================================= */

import { TAU, clamp, rnd, pick } from '../core/utils.js';
import { spawnEnemy } from './enemy.js';
import Sound from '../systems/sound.js';

/* =========================================================
   CONSTANTS
   ========================================================= */
export const FORMATION = {
  CIRCLE:  'circle',    // đều quanh boss
  LINE:    'line',      // hàng ngang
  ARC:     'arc',       // cung trước mặt player
  RANDOM:  'random',    // ngẫu nhiên
  BEHIND:  'behind'     // sau lưng player
};

/** Bảng màu minion theo phase — nếu tintByPhase = true. */
const PHASE_TINT = {
  1: null,              // phase 1: giữ màu gốc boss
  2: { sat: 1.15, lum: 0.95 },
  3: { sat: 1.35, lum: 0.85 }
};

/* =========================================================
   MAIN ENTRY
   ========================================================= */

/**
 * Triệu hồi quái với formation + tint + scaling.
 *
 * @param {BossV2} boss
 * @param {Game}   game
 * @param {World}  W
 * @param {object} cfg  — config từ boss.current.def.summon
 * @returns {Array}      danh sách enemies đã spawn
 */
export function summonWithFormation(boss, game, W, cfg) {
  if (!boss || !W || !cfg) return [];
  if (!W.player) return [];

  /* ---- Parse config ---- */
  const phase = boss.phase || 1;
  const count = _getCount(cfg, phase, boss.diff);
  const pool  = cfg.types || ['drone'];
  const formation = cfg.formation || FORMATION.CIRCLE;
  const spawnR = cfg.spawnRadius || 140;
  const eliteChance = (cfg.eliteChance || 0) * (boss.diff.hpMul || 1);

  /* ---- Track array ---- */
  if (!W.bossMinions) W.bossMinions = [];

  /* ---- Tính vị trí theo formation ---- */
  const positions = _buildFormation(formation, boss, W, count, spawnR);

  /* ---- Spawn từng con ---- */
  const spawned = [];

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const type = pick(pool);
    const isElite = Math.random() < eliteChance;

    /* Tránh kẹt obstacle */
    const { x, y } = _clampToMap(pos.x, pos.y, W, 60);

    let e = null;
    try {
      e = spawnEnemy(game, W, type, x, y, isElite);
    } catch (err) {
      console.warn('[boss-summon] spawn fail:', type, err);
      continue;
    }

    if (!e) continue;

    /* ---- Apply minion metadata ---- */
    e.isMinion = true;
    e.minionOwner = boss.name;
    e.minionSpawnTime = W.time;
    e.lifetime = cfg.lifetime || 0;

    /* ---- Scale stats ---- */
    const hpMul = cfg.hpMul != null ? cfg.hpMul : 0.6;
    const xpMul = cfg.xpMul != null ? cfg.xpMul : 0.5;
    const crMul = cfg.creditsMul != null ? cfg.creditsMul : 0.5;

    e.hp = Math.round(e.hp * hpMul);
    e.maxHp = e.hp;
    e.xp = Math.round(e.xp * xpMul);
    e.credits = Math.round(e.credits * crMul);

    /* ---- Tint màu theo boss ---- */
    _applyTint(e, boss, cfg.tintByPhase !== false);

    /* ---- VFX spawn ---- */
    _spawnVFX(W, x, y, e.color);

    spawned.push(e);
    W.bossMinions.push(e);
  }

  /* ---- SFX + toast ---- */
  Sound.sfx('boss');

  if (typeof window.addToast === 'function' && spawned.length > 0) {
    window.addToast(
      '⚠ ' + boss.name + ' TRIỆU HỒI ' + spawned.length + ' QUÁI'
    );
  }

  return spawned;
}

/* =========================================================
   FORMATION BUILDERS
   ========================================================= */

function _buildFormation(kind, boss, W, count, radius) {
  const p = W.player;
  const out = [];

  switch (kind) {
    /* --- Đều quanh boss --- */
    case FORMATION.CIRCLE: {
      const offsetA = Math.random() * TAU;
      for (let i = 0; i < count; i++) {
        const a = offsetA + (i / count) * TAU;
        out.push({
          x: boss.x + Math.cos(a) * radius,
          y: boss.y + Math.sin(a) * radius
        });
      }
      break;
    }

    /* --- Hàng ngang trước mặt boss --- */
    case FORMATION.LINE: {
      const ang = boss.angle;
      const perpX = -Math.sin(ang);
      const perpY = Math.cos(ang);
      const spacing = 60;
      const startOffset = -(count - 1) / 2 * spacing;

      for (let i = 0; i < count; i++) {
        const off = startOffset + i * spacing;
        out.push({
          x: boss.x + Math.cos(ang) * radius * 0.7 + perpX * off,
          y: boss.y + Math.sin(ang) * radius * 0.7 + perpY * off
        });
      }
      break;
    }

    /* --- Cung trước mặt player --- */
    case FORMATION.ARC: {
      const toPlayerA = Math.atan2(p.y - boss.y, p.x - boss.x);
      const arcSpan = Math.PI * 0.7;
      const startA = toPlayerA - arcSpan / 2;

      for (let i = 0; i < count; i++) {
        const t = count > 1 ? i / (count - 1) : 0.5;
        const a = startA + t * arcSpan;
        out.push({
          x: boss.x + Math.cos(a) * radius,
          y: boss.y + Math.sin(a) * radius
        });
      }
      break;
    }

    /* --- Sau lưng player --- */
    case FORMATION.BEHIND: {
      const toPlayerA = Math.atan2(p.y - boss.y, p.x - boss.x);
      const backA = toPlayerA + Math.PI;
      const spread = 0.8;

      for (let i = 0; i < count; i++) {
        const t = count > 1 ? i / (count - 1) : 0.5;
        const a = backA + (t - 0.5) * spread;
        const r = radius * (0.8 + Math.random() * 0.4);
        out.push({
          x: p.x + Math.cos(a) * r,
          y: p.y + Math.sin(a) * r
        });
      }
      break;
    }

    /* --- Ngẫu nhiên --- */
    case FORMATION.RANDOM:
    default: {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * TAU;
        const r = radius * (0.7 + Math.random() * 0.6);
        out.push({
          x: boss.x + Math.cos(a) * r,
          y: boss.y + Math.sin(a) * r
        });
      }
      break;
    }
  }

  return out;
}

/* =========================================================
   TINT MINION
   ========================================================= */

function _applyTint(e, boss, byPhase) {
  const baseColor = boss.color || '#ff3b52';

  /* Nếu boss có BOSS_PALETTES (draw-entities.js), phase 2-3 làm sáng/tối hơn */
  let color = baseColor;

  if (byPhase && boss.phase >= 2) {
    color = _adjustColor(baseColor, PHASE_TINT[boss.phase]);
  }

  /* Nếu enemy đã có màu riêng (spawnEnemy gán), ghi đè bằng tint */
  e.color = color;
  e.visualTint = color;
  e.visualTintGlow = boss.color;
}

/**
 * Điều chỉnh độ sáng/tối của màu hex.
 * adj = { sat: 1.15, lum: 0.95 }
 */
function _adjustColor(hex, adj) {
  if (!adj || !hex) return hex;

  /* Parse hex */
  const clean = String(hex).replace('#', '');
  if (clean.length !== 6) return hex;

  let r = parseInt(clean.substr(0, 2), 16);
  let g = parseInt(clean.substr(2, 2), 16);
  let b = parseInt(clean.substr(4, 2), 16);

  /* Điều chỉnh luminosity */
  if (adj.lum != null) {
    r = clamp(Math.round(r * adj.lum), 0, 255);
    g = clamp(Math.round(g * adj.lum), 0, 255);
    b = clamp(Math.round(b * adj.lum), 0, 255);
  }

  /* Điều chỉnh saturation (đẩy lệch khỏi trung bình xám) */
  if (adj.sat != null) {
    const gray = (r + g + b) / 3;
    r = clamp(Math.round(gray + (r - gray) * adj.sat), 0, 255);
    g = clamp(Math.round(gray + (g - gray) * adj.sat), 0, 255);
    b = clamp(Math.round(gray + (b - gray) * adj.sat), 0, 255);
  }

  /* Trả về hex */
  const toHex = (n) => n.toString(16).padStart(2, '0');
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

/* =========================================================
   VFX
   ========================================================= */

function _spawnVFX(W, x, y, color) {
  if (!W.particles) return;

  /* Vòng nở ra */
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    W.particles.push({
      x, y,
      vx: Math.cos(a) * 220,
      vy: Math.sin(a) * 220,
      life: 0.5,
      maxLife: 0.5,
      size: 5,
      color: color || '#ff3b52',
      type: 'dot'
    });
  }
}

/* =========================================================
   CLAMP / MAP BOUNDS
   ========================================================= */

function _clampToMap(x, y, W, margin = 60) {
  return {
    x: clamp(x, margin, W.w - margin),
    y: clamp(y, margin, W.h - margin)
  };
}

/* =========================================================
   COUNT RESOLVER
   ========================================================= */

function _getCount(cfg, phase, diff) {
  const countTable = cfg.count || {};
  let base = countTable[phase]
    || countTable[1]
    || 2;

  /* Difficulty scaling: hard/hardcore +1 */
  if (diff && diff.extraPatternTier >= 2) base += 1;
  if (diff && diff.extraPatternTier >= 3) base += 1;

  return Math.max(1, Math.round(base));
}

/* =========================================================
   CLEANUP — gọi khi boss chết
   ========================================================= */

/**
 * Xoá toàn bộ minion của boss khỏi W.enemies.
 * Nên gọi từ killEnemy() khi boss chết.
 *
 * Trả về số minion đã xoá.
 */
export function cleanupBossMinions(W) {
  if (!W || !W.enemies) return 0;

  let removed = 0;

  for (let i = W.enemies.length - 1; i >= 0; i--) {
    const e = W.enemies[i];
    if (e && e.isMinion) {
      /* VFX tan biến */
      if (W.particles) {
        for (let k = 0; k < 6; k++) {
          W.particles.push({
            x: e.x,
            y: e.y,
            vx: (Math.random() - 0.5) * 200,
            vy: (Math.random() - 0.5) * 200,
            life: 0.4,
            maxLife: 0.4,
            size: 4,
            color: e.color || '#ff3b52',
            type: 'dot'
          });
        }
      }
      W.enemies.splice(i, 1);
      removed++;
    }
  }

  if (W.bossMinions) W.bossMinions.length = 0;

  if (removed > 0 && typeof window.addToast === 'function') {
    window.addToast('💨 Minion biến mất (' + removed + ')');
  }

  return removed;
}

/* =========================================================
   UPDATE LIFETIME — gọi mỗi frame
   Minion tự hủy sau `lifetime` giây.
   ========================================================= */

/**
 * Cập nhật lifetime của minion.
 * Gọi trong game loop (hoặc từ BossV2.tick).
 */
export function updateMinions(W, dt) {
  if (!W || !W.enemies) return;

  for (let i = W.enemies.length - 1; i >= 0; i--) {
    const e = W.enemies[i];
    if (!e || !e.isMinion) continue;
    if (!e.lifetime || e.lifetime <= 0) continue;

    e.lifetime -= dt;

    /* Sắp hết → nhấp nháy cảnh báo */
    if (e.lifetime < 2 && Math.floor(e.lifetime * 10) % 2 === 0) {
      e.hitFlash = 0.05;
    }

    if (e.lifetime <= 0) {
      /* VFX tan biến */
      if (W.particles) {
        for (let k = 0; k < 4; k++) {
          W.particles.push({
            x: e.x,
            y: e.y,
            vx: (Math.random() - 0.5) * 150,
            vy: (Math.random() - 0.5) * 150,
            life: 0.35,
            maxLife: 0.35,
            size: 3.5,
            color: e.color || '#ff3b52',
            type: 'dot'
          });
        }
      }
      W.enemies.splice(i, 1);
    }
  }
}

/* =========================================================
   COUNT MINIONS — debug / balance
   ========================================================= */
export function countBossMinions(W) {
  if (!W || !W.enemies) return 0;
  let n = 0;
  for (const e of W.enemies) {
    if (e && e.isMinion) n++;
  }
  return n;
}