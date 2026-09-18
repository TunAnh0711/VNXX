/* =========================================================
   VNXX — RENDER / DRAW-ENTITIES
   Vẽ player, enemy, boss, projectile, loot, chest,
   remote player (LAN).
   Pure functions, không phụ thuộc Game.
   ========================================================= */

import { CFG } from '../core/constants.js';
import { TAU } from '../core/utils.js';
import { WEAPONS } from '../data/weapons.js';

/* =========================================================
   HEX PATH helper (dùng chung cho player/enemy/loot xp)
   ========================================================= */
function hexPath(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = rot + i * Math.PI / 3;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/* =========================================================
   REMOTE PLAYER (LAN khác — màu xanh lá)
   ========================================================= */
export function drawRemotePlayer(ctx, p) {
  if (!p || p.alive === false) return;

  const radius = p.radius || CFG.PLAYER.radius;

  /* ---------- Body ---------- */
  ctx.save();
  ctx.shadowBlur = 18;
  ctx.shadowColor = '#39ff9e';
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle || 0);

  hexPath(ctx, 0, 0, radius, 0);

  const bg = ctx.createLinearGradient(-radius, -radius, radius, radius);
  bg.addColorStop(0, '#0f6340');
  bg.addColorStop(1, '#062a1a');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = '#39ff9e';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  /* Core */
  ctx.fillStyle = 'rgba(180,255,220,.8)';
  ctx.beginPath();
  ctx.arc(0, 0, radius * .4, 0, TAU);
  ctx.fill();

  ctx.restore();

  /* ---------- Name tag ---------- */
  const name = p.name || ('P-' + String(p.id).slice(0, 4));
  ctx.textAlign = 'center';
  ctx.font = 'bold 11px Consolas, monospace';

  ctx.fillStyle = 'rgba(0,0,0,.6)';
  ctx.fillRect(p.x - 40, p.y - radius - 24, 80, 14);

  ctx.fillStyle = '#39ff9e';
  ctx.fillText(name, p.x, p.y - radius - 13);
  ctx.textAlign = 'left';
}

/* =========================================================
   PLAYER (local)
   ========================================================= */
export function drawPlayer(ctx, p) {
  /* ---------- Đã chết ---------- */
  if (!p.alive) {
    ctx.globalAlpha = .4;
    hexPath(ctx, p.x, p.y, p.radius, 0);
    ctx.fillStyle = '#331018';
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }

  const flash = p.hitFlash > 0;
  const inv = p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0;
  ctx.globalAlpha = inv ? .45 : 1;

  /* ---------- Aim cone ---------- */
  const w = WEAPONS[p.weaponId];
  const coneRange = (w ? w.range * (1 + p.up.rangeMul) : 90) *
    (w && w.type === 'melee' ? 1 : .42);
  const half = (w ? w.spread : .4) + .18;

  const g = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, coneRange);
  g.addColorStop(0, 'rgba(40,224,255,.20)');
  g.addColorStop(1, 'rgba(40,224,255,0)');
  ctx.fillStyle = g;

  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.arc(p.x, p.y, coneRange, p.angle - half, p.angle + half);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,224,255,.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  /* ---------- Shadow ---------- */
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 6, p.radius * 1.05, p.radius * .55, 0, 0, TAU);
  ctx.fill();

  /* ---------- Body ---------- */
  const rot = p.moveAnim * .5;

  ctx.save();
  ctx.shadowBlur = 22;
  ctx.shadowColor = flash ? '#ff3b52' : '#28e0ff';
  hexPath(ctx, p.x, p.y, p.radius, rot);

  const bg = ctx.createLinearGradient(
    p.x - p.radius, p.y - p.radius,
    p.x + p.radius, p.y + p.radius
  );
  bg.addColorStop(0, flash ? '#ff6b7a' : '#0f4a63');
  bg.addColorStop(1, flash ? '#8a1020' : '#062230');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = flash ? '#ff3b52' : '#28e0ff';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();

  /* ---------- Core pulse ---------- */
  const pulse = .6 + Math.sin(performance.now() * .005) * .25;

  ctx.save();
  ctx.shadowBlur = 18;
  ctx.shadowColor = '#9ff2ff';
  ctx.fillStyle = 'rgba(180,250,255,' + pulse + ')';
  hexPath(ctx, p.x, p.y, p.radius * .42, rot + .5);
  ctx.fill();
  ctx.restore();

  /* ---------- Aiming arrow ---------- */
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#9ff2ff';
  ctx.beginPath();
  ctx.moveTo(p.radius + 10, 0);
  ctx.lineTo(p.radius - 2, -6);
  ctx.lineTo(p.radius - 2, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  /* ---------- Attack swing arc ---------- */
  if (p.attackAnim > 0) {
    const t = p.attackAnim / .16;
    ctx.save();
    ctx.globalAlpha = t * .6;
    ctx.strokeStyle = '#9ff2ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(
      p.x, p.y,
      p.radius + 16 * (1 - t) + 8,
      p.angle - .8,
      p.angle + .8
    );
    ctx.stroke();
    ctx.restore();
  }

  /* ---------- Buff ring: dmg boost ---------- */
  if (p.buffs && p.buffs.dmg > 0) {
    ctx.save();
    ctx.globalAlpha = .35 + Math.sin(performance.now() * .008) * .15;
    ctx.strokeStyle = '#ff3b52';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 9, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  /* ---------- Buff ring: berserk ---------- */
  if (p.buffs && p.buffs.berserk > 0) {
    ctx.save();
    ctx.globalAlpha = .4;
    ctx.strokeStyle = '#ffc44d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 14, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  ctx.globalAlpha = 1;
}

/* =========================================================
   ENEMY (bao gồm boss)
   ========================================================= */
export function drawEnemy(ctx, e) {
  const flash = e.hitFlash > 0;
  ctx.globalAlpha = e.frozen > 0 ? .6 : 1;

  /* ---------- Shadow ---------- */
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.beginPath();
  ctx.ellipse(e.x, e.y + 5, e.radius * .95, e.radius * .5, 0, 0, TAU);
  ctx.fill();

  /* ---------- Rotation ---------- */
  const t = performance.now();
  const rot = e.isBoss
    ? t * .0006
    : (e.elite ? t * .001 : t * .0004 + e.x * .001);

  /* ---------- Body ---------- */
  ctx.save();
  if (e.elite || e.isBoss) {
    ctx.shadowBlur = e.isBoss ? 30 : 16;
    ctx.shadowColor = flash ? '#ffffff' : e.color;
  }

  hexPath(ctx, e.x, e.y, e.radius, rot);

  const g = ctx.createLinearGradient(
    e.x - e.radius, e.y - e.radius,
    e.x + e.radius, e.y + e.radius
  );
  g.addColorStop(0, flash ? '#ffffff' : 'rgba(20,14,20,.95)');
  g.addColorStop(1, flash ? '#ffdddd' : e.color + '55');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = flash ? '#ffffff' : e.color;
  ctx.lineWidth = e.isBoss ? 4 : (e.elite ? 2.6 : 1.8);
  ctx.stroke();
  ctx.restore();

  /* ---------- Core ---------- */
  ctx.fillStyle = e.color;
  ctx.globalAlpha = .85;
  hexPath(ctx, e.x, e.y, e.radius * .35, -rot);
  ctx.fill();

  /* ---------- Facing line ---------- */
  ctx.globalAlpha = e.frozen > 0 ? .6 : 1;
  ctx.strokeStyle = e.color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = .7;
  ctx.beginPath();
  ctx.moveTo(e.x, e.y);
  ctx.lineTo(
    e.x + Math.cos(e.angle) * (e.radius + 9),
    e.y + Math.sin(e.angle) * (e.radius + 9)
  );
  ctx.stroke();
  ctx.globalAlpha = 1;

  /* ---------- HP bar (chỉ hiện khi bị damage hoặc elite) ---------- */
  if (!e.isBoss && (e.hp < e.maxHp || e.elite)) {
    const w = e.radius * 2.2;
    const bx = e.x - w / 2;
    const by = e.y - e.radius - 11;

    ctx.fillStyle = 'rgba(0,0,0,.7)';
    ctx.fillRect(bx, by, w, 4);

    ctx.fillStyle = e.elite ? '#ffc44d' : '#ff3b52';
    const hpPct = Math.max(0, Math.min(1, e.hp / e.maxHp));
    ctx.fillRect(bx, by, w * hpPct, 4);

    /* Shield overlay */
    if (e.shield > 0) {
      ctx.fillStyle = '#5aa9ff';
      const shPct = Math.max(0, Math.min(1, e.shield / e.maxShield));
      ctx.fillRect(bx, by - 5, w * shPct, 2.5);
    }
  }

  /* ---------- Elite mod name ---------- */
  if (e.elite && e.modName) {
    ctx.fillStyle = '#ffc44d';
    ctx.font = 'bold 9px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('★ ' + e.modName, e.x, e.y - e.radius - 16);
    ctx.textAlign = 'left';
  }

  /* ---------- Boss telegraph ring ---------- */
  if (e.isBoss && e.telegraph > 0) {
    ctx.save();
    ctx.globalAlpha = .35 + .25 * Math.sin(performance.now() * .02);
    ctx.strokeStyle = '#ff3b52';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius + 30, 0, TAU);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#ff3b52';
    ctx.font = 'bold 13px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(e.telegraphType || '', e.x, e.y - e.radius - 24);
    ctx.textAlign = 'left';
  }

  ctx.globalAlpha = 1;
}

/* =========================================================
   PROJECTILE
   ========================================================= */
export function drawProjectile(ctx, pr) {
  ctx.save();
  ctx.shadowBlur = 14;
  ctx.shadowColor = pr.color;
  ctx.fillStyle = pr.color;

  /* ---------- Trail ---------- */
  if (pr.trail && pr.px !== undefined) {
    ctx.strokeStyle = pr.color;
    ctx.lineWidth = pr.r * .9;
    ctx.globalAlpha = .55;
    ctx.beginPath();
    ctx.moveTo(pr.px, pr.py);
    ctx.lineTo(pr.x, pr.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /* ---------- Body ---------- */
  ctx.beginPath();
  ctx.arc(pr.x, pr.y, pr.r, 0, TAU);
  ctx.fill();

  /* ---------- Highlight ---------- */
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.beginPath();
  ctx.arc(pr.x, pr.y, pr.r * .45, 0, TAU);
  ctx.fill();

  ctx.restore();
}

/* =========================================================
   LOOT (credit / xp / hp / shard)
   ========================================================= */
export function drawLoot(ctx, l) {
  const t = performance.now() * .004;
  const bob = Math.sin(t + l.x * .01) * 3;

  ctx.save();
  ctx.shadowBlur = 12;
  ctx.shadowColor = l.color;
  ctx.fillStyle = l.color;

  ctx.beginPath();

  switch (l.type) {
    case 'credit':
      ctx.arc(l.x, l.y + bob, 5.5, 0, TAU);
      ctx.fill();
      break;

    case 'xp':
      hexPath(ctx, l.x, l.y + bob, 6, t * .5);
      ctx.fill();
      break;

    case 'hp':
      ctx.fillRect(l.x - 5, l.y - 2 + bob, 10, 4);
      ctx.fillRect(l.x - 2, l.y - 5 + bob, 4, 10);
      break;

    case 'shard':
    default:
      ctx.moveTo(l.x, l.y - 7 + bob);
      ctx.lineTo(l.x + 6, l.y + bob);
      ctx.lineTo(l.x, l.y + 7 + bob);
      ctx.lineTo(l.x - 6, l.y + bob);
      ctx.closePath();
      ctx.fill();
      break;
  }

  ctx.restore();
}

/* =========================================================
   CHEST (common / rare / legendary)
   ========================================================= */
export function drawChest(ctx, c) {
  const t = performance.now() * .003;

  ctx.save();

  if (c.open) {
    ctx.globalAlpha = Math.max(0, 1 - c.life / 3);
  } else {
    /* Glow nhấp nháy theo rarity */
    ctx.shadowBlur = 14 + Math.sin(t) * 5;
    ctx.shadowColor =
      c.rarity === 'legendary' ? '#ffc44d'
      : (c.rarity === 'rare' ? '#5aa9ff' : '#9fb4c4');
  }

  const col =
    c.rarity === 'legendary' ? '#ffc44d'
    : (c.rarity === 'rare' ? '#5aa9ff' : '#7d94a5');

  /* Shadow */
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  ctx.fillRect(c.x - 16, c.y - 6, 32, 22);

  /* Body */
  ctx.fillStyle = '#101a24';
  ctx.fillRect(c.x - 16, c.y - 10, 32, 20);

  /* Border */
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.strokeRect(c.x - 16, c.y - 10, 32, 20);

  /* Lock strip */
  ctx.fillStyle = col;
  ctx.fillRect(c.x - 16, c.y - 3, 32, 3);

  /* Star indicator (chưa mở) */
  if (!c.open) {
    ctx.globalAlpha = .5 + .5 * Math.sin(t * 2);
    ctx.fillStyle = col;
    ctx.font = 'bold 12px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('★', c.x, c.y - 18);
    ctx.textAlign = 'left';
  }

  ctx.restore();
}