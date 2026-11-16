/* =========================================================
VNXX — GAME / BOSS ATTACKS
16 attack scripts + 8 telegraph scripts cho BossV2.
Mỗi attack script có chữ ký:
fn(boss, game, diff, t, W)
boss: BossV2 instance
game: Game object
diff: difficulty config (bulletSpeedMul, bulletCountAdd...)
t:    thời gian từ lúc bắt đầu attack (giây)
W:    world object
Mỗi script nên idempotent — có thể bị gọi nhiều frame.
Dùng boss.attackData để lưu state xuyên frame.
========================================================= */
import { TAU, clamp, angLerp } from '../core/utils.js';
import Sound from '../systems/sound.js';
import { spawnEnemy } from './enemy.js';
import { damagePlayer } from './player.js';
import {
  registerAttackScripts,
  registerTelegraphScripts
} from './boss-v2.js';
import { summonWithFormation } from './boss-summon.js';

/* =========================================================
HELPERS
========================================================= */
/** Push 1 projectile chuẩn vào W.projectiles. */
function shoot(W, opts) {
  W.projectiles.push({
    x: opts.x,
    y: opts.y,
    vx: opts.vx || 0,
    vy: opts.vy || 0,
    r: opts.r || 6,
    damage: opts.damage || 0,
    owner: opts.owner || 'enemy',
    life: opts.life || 3,
    pierce: opts.pierce || 0,
    splash: opts.splash || 0,
    knockback: opts.knockback || 0,
    color: opts.color || '#ff3b52',
    hitSet: new Set(),
    /* Custom flags */
    isShockwave: opts.isShockwave || false,
    homing: opts.homing || null,
    isBoomerang: opts.isBoomerang || false,
    boomerangReturnAt: opts.boomerangReturnAt || 0,
    isBlackHole: opts.isBlackHole || false,
    pullRadius: opts.pullRadius || 0,
    pullForce: opts.pullForce || 0,
    /* visual */
    trail: opts.trail || false,
    weaponId: opts.weaponId || 'boss'
  });
}

/** Bắn N viên quanh 1 điểm theo hình tròn. */
function shootRing(W, cx, cy, count, speed, opts = {}) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + (opts.angleOffset || 0);
    shoot(W, {
      x: cx,
      y: cy,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      r: opts.r || 7,
      damage: opts.damage || 15,
      life: opts.life || 3,
      color: opts.color || '#ff3b52',
      knockback: opts.knockback || 100
    });
  }
}

/** Bắn hình quạt về phía player. */
function shootFan(W, cx, cy, angle, count, arc, speed, opts = {}) {
  if (count === 1) {
    shoot(W, {
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: opts.r || 7,
      damage: opts.damage || 15,
      life: opts.life || 3,
      color: opts.color || '#ff3b52',
      knockback: opts.knockback || 100
    });
    return;
  }
  for (let i = 0; i < count; i++) {
    const a = angle + (i / (count - 1) - 0.5) * arc;
    shoot(W, {
      x: cx, y: cy,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      r: opts.r || 7,
      damage: opts.damage || 15,
      life: opts.life || 3,
      color: opts.color || '#ff3b52',
      knockback: opts.knockback || 100
    });
  }
}

/** Lấy góc boss → player. */
function angleToPlayer(boss, W) {
  if (!W || !W.player) return boss.angle;
  return Math.atan2(W.player.y - boss.y, W.player.x - boss.x);
}

/** Damage player nếu trong bán kính tính từ (cx, cy). */
function damageIfInRadius(game, W, cx, cy, radius, dmg, source) {
  const p = W.player;
  if (!p || !p.alive) return;
  const d = Math.hypot(p.x - cx, p.y - cy);
  if (d < radius + p.radius) {
    damagePlayer(game, W, dmg, source || null);
  }
}

/** Damage player nếu nằm trên đường thẳng từ (x1, y1)→(x2, y2) với độ rộng w. */
function damageIfOnLine(game, W, x1, y1, x2, y2, width, dmg, source) {
  const p = W.player;
  if (!p || !p.alive) return;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 0.0001;
  const ux = dx / len;
  const uy = dy / len;
  /* Chiếu player lên đường thẳng */
  const px = p.x - x1;
  const py = p.y - y1;
  const proj = px * ux + py * uy;
  if (proj < 0 || proj > len) return;
  const perpX = px - ux * proj;
  const perpY = py - uy * proj;
  const perpDist = Math.hypot(perpX, perpY);
  if (perpDist < width + p.radius) {
    damagePlayer(game, W, dmg, source || null);
  }
}

/* =========================================================
ATTACK SCRIPTS
========================================================= */
/* ---------------------------------------------------------
RADIAL BURST — xả đạn hình quạt 1 lần
--------------------------------------------------------- */
function radialBurst(boss, game, diff, t, W) {
  if (!boss.attackData.fired) {
    boss.attackData.fired = true;
    const angle = angleToPlayer(boss, W);
    const count = Math.max(8, 12 + diff.bulletCountAdd + (boss.phase - 1) * 3);
    const arc = 1.1;
    const speed = 340 * diff.bulletSpeedMul;
    shootFan(W, boss.x, boss.y, angle, count, arc, speed, {
      r: 7,
      damage: boss.damage * 0.65,
      life: 3,
      color: boss.color,
      knockback: 130
    });
    Sound.sfx('shotgun');
  }
}

/* ---------------------------------------------------------
LASER SWEEP — tia sấy quét 90° trong duration
Damage theo từng frame với i-frame chống spam
--------------------------------------------------------- */
function laserSweep(boss, game, diff, t, W) {
  const sweepRange = Math.PI / 2;          // 90°
  const baseAngle = boss.attackData.baseAngle
    || (boss.attackData.baseAngle = angleToPlayer(boss, W) - sweepRange / 2);
  const progress = Math.min(1, t / 1.4);
  const angle = baseAngle + progress * sweepRange;
  const range = 900;
  /* Damage player nếu trên đường */
  const x2 = boss.x + Math.cos(angle) * range;
  const y2 = boss.y + Math.sin(angle) * range;
  /* I-frame: chỉ damage 1 lần mỗi 0.35s */
  boss.attackData.laserDmgTimer = (boss.attackData.laserDmgTimer || 0) - 0.016;
  if (boss.attackData.laserDmgTimer <= 0) {
    boss.attackData.laserDmgTimer = 0.35;
    damageIfOnLine(game, W, boss.x, boss.y, x2, y2, 14, boss.damage * 0.55, boss);
  }
  /* Visual: tia vẽ qua W.beams (draw-fx tự dọn theo life) */
  if (!W.beams) W.beams = [];
  W.beams.push({
    x1: boss.x, y1: boss.y, x2, y2,
    width: 28,
    color: boss.color,
    coreColor: '#ffffff',
    life: 0.07,
    maxLife: 0.07
  });
  /* Spark particles ở đầu tia */
  if (Math.random() < 0.8 && W.particles) {
    W.particles.push({
      x: x2 + (Math.random() - 0.5) * 20,
      y: y2 + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 200,
      vy: (Math.random() - 0.5) * 200,
      life: 0.4, maxLife: 0.4,
      size: 4, color: boss.color, type: 'dot'
    });
  }
}

/* ---------------------------------------------------------
SUMMON MINIONS — triệu hồi quái có tint màu boss
Dùng formation system từ boss-summon.js
--------------------------------------------------------- */
function summonMinions(boss, game, diff, t, W) {
  if (boss.attackData.summoned) return;
  boss.attackData.summoned = true;

  const cfg = boss.current.def.summon;
  if (!cfg) return;

  summonWithFormation(boss, game, W, cfg);
}

/* ---------------------------------------------------------
LOCKDOWN — khoá arena 3s, xả đạn liên tục từ tâm
--------------------------------------------------------- */
function lockdown(boss, game, diff, t, W) {
  /* Slow player 50% */
  const p = W.player;
  if (p && p.alive) {
    p.buffs.slow = Math.max(p.buffs.slow || 0, 0.3);
    p.slowFactor = 0.5;
  }
  /* Xả đạn mỗi 0.15s */
  boss.attackData.tick = (boss.attackData.tick || 0) - 0.016;
  if (boss.attackData.tick <= 0) {
    boss.attackData.tick = 0.15;
    const angle = Math.random() * TAU;
    const speed = 260 * diff.bulletSpeedMul;
    shoot(W, {
      x: boss.x, y: boss.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 7,
      damage: boss.damage * 0.5,
      life: 4,
      color: boss.color,
      knockback: 80
    });
  }
  /* Vòng lửa quanh boss */
  if (W.particles && Math.random() < 0.5) {
    const a = Math.random() * TAU;
    const rr = boss.radius + 10;
    W.particles.push({
      x: boss.x + Math.cos(a) * rr,
      y: boss.y + Math.sin(a) * rr,
      vx: Math.cos(a) * 100,
      vy: Math.sin(a) * 100,
      life: 0.5, maxLife: 0.5,
      size: 5, color: boss.color, type: 'dot'
    });
  }
}

/* ---------------------------------------------------------
SEISMIC SLAM — đập đất, sóng lan 2 lần
--------------------------------------------------------- */
function seismicSlam(boss, game, diff, t, W) {
  if (boss.attackData.fired) return;
  boss.attackData.fired = true;
  Sound.sfx('explosion');
  if (typeof window !== 'undefined' && W.camera) {
    W.camera.shake = 14;
  }
  /* Vòng sóng knockback thuần visual + đẩy player */
  const count = Math.max(20, 24 + diff.bulletCountAdd);
  const speed = 200 * diff.bulletSpeedMul;
  shootRing(W, boss.x, boss.y, count, speed, {
    r: 10,
    damage: boss.damage * 0.4,
    life: 2,
    color: boss.color,
    knockback: 400
  });
  /* Vòng thứ 2 trễ 0.2s */
  boss.attackData.secondWave = 0.2;
}

/* ---------------------------------------------------------
MOLTEN SPRAY — phun dung nham liên tục 1.2s
--------------------------------------------------------- */
function moltenSpray(boss, game, diff, t, W) {
  boss.attackData.tick = (boss.attackData.tick || 0) - 0.016;
  if (boss.attackData.tick <= 0) {
    boss.attackData.tick = 0.05;
    const angle = angleToPlayer(boss, W) + (Math.random() - 0.5) * 0.5;
    const speed = 320 * diff.bulletSpeedMul;
    shoot(W, {
      x: boss.x, y: boss.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 8,
      damage: boss.damage * 0.35,
      life: 2.5,
      color: '#ff6a00',
      splash: 40,
      knockback: 60
    });
  }
}

/* ---------------------------------------------------------
DASH CHARGE — lao thẳng về player
--------------------------------------------------------- */
function dashCharge(boss, game, diff, t, W) {
  if (boss.attackData.charged) return;
  boss.attackData.charged = true;
  const angle = angleToPlayer(boss, W);
  boss.dashing = 0.35;
  boss.dashDir = { x: Math.cos(angle), y: Math.sin(angle) };
  boss.dashSpeed = 900;
  Sound.sfx('dash');
}

/* ---------------------------------------------------------
BLINK STRIKE — teleport tới sát player rồi chém
--------------------------------------------------------- */
function blinkStrike(boss, game, diff, t, W) {
  if (boss.attackData.blinked) return;
  boss.attackData.blinked = true;
  const p = W.player;
  if (!p) return;
  /* Teleport tới sau lưng player */
  const backAngle = p.angle + Math.PI;
  const dist = 60;
  boss.x = clamp(p.x + Math.cos(backAngle) * dist, 60, W.w - 60);
  boss.y = clamp(p.y + Math.sin(backAngle) * dist, 60, W.h - 60);
  Sound.sfx('dash');
  /* Damage nếu player trong bán kính */
  damageIfInRadius(game, W, boss.x, boss.y, boss.radius + 30, boss.damage * 1.4, boss);
  /* VFX vòng lan */
  if (W.particles) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      W.particles.push({
        x: boss.x, y: boss.y,
        vx: Math.cos(a) * 200, vy: Math.sin(a) * 200,
        life: 0.4, maxLife: 0.4,
        size: 5, color: boss.color, type: 'dot'
      });
    }
  }
}

/* ---------------------------------------------------------
SYSTEM CRASH — glitch toàn map, xả đạn random 2s
--------------------------------------------------------- */
function systemCrash(boss, game, diff, t, W) {
  /* Đặt hiệu ứng dark screen */
  W.darkness = 0.6;
  /* Xả 3 viên / 0.12s từ random vị trí quanh player */
  boss.attackData.tick = (boss.attackData.tick || 0) - 0.016;
  if (boss.attackData.tick <= 0) {
    boss.attackData.tick = 0.05;
    const p = W.player;
    if (!p) return;
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * TAU;
      const r = 400 + Math.random() * 200;
      const sx = p.x + Math.cos(a) * r;
      const sy = p.y + Math.sin(a) * r;
      /* Đạn bay về tâm player */
      const dirA = Math.atan2(p.y - sy, p.x - sx);
      const speed = 320 * diff.bulletSpeedMul;
      shoot(W, {
        x: sx, y: sy,
        vx: Math.cos(dirA) * speed,
        vy: Math.sin(dirA) * speed,
        r: 6,
        damage: boss.damage * 0.4,
        life: 3,
        color: boss.color,
        knockback: 60
      });
    }
  }
  /* Glitch particles */
  if (W.particles && Math.random() < 0.9) {
    const p = W.player;
    W.particles.push({
      x: p.x + (Math.random() - 0.5) * 800,
      y: p.y + (Math.random() - 0.5) * 800,
      vx: 0, vy: 0,
      life: 0.15, maxLife: 0.15,
      size: 30, color: boss.color, type: 'dot'
    });
  }
}

/* ---------------------------------------------------------
BOOMERANG — lưỡi hái bay xa rồi quay về
--------------------------------------------------------- */
function boomerang(boss, game, diff, t, W) {
  if (boss.attackData.thrown) return;
  boss.attackData.thrown = true;
  const angle = angleToPlayer(boss, W);
  const speed = 500 * diff.bulletSpeedMul;
  shoot(W, {
    x: boss.x, y: boss.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: 12,
    damage: boss.damage * 0.7,
    life: 3,
    pierce: 99,
    color: boss.color,
    knockback: 180,
    isBoomerang: true,
    boomerangReturnAt: 0.9,
    trail: true
  });
  Sound.sfx('sniper');
}

/* ---------------------------------------------------------
HOMING MISSILES — tên lửa đuổi player
--------------------------------------------------------- */
function homingMissiles(boss, game, diff, t, W) {
  if (boss.attackData.launched) return;
  boss.attackData.launched = true;
  const cfg = boss.current.def.projectile || {};
  const count = cfg.count ? (cfg.count[boss.phase] || cfg.count[1]) : 3;
  const speed = cfg.speed || 280;
  const turnRate = cfg.turnRate || 2.5;
  const dmg = cfg.damage || boss.damage * 0.6;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + Math.random() * 0.3;
    const speedInit = speed * 0.4;
    shoot(W, {
      x: boss.x + Math.cos(a) * boss.radius,
      y: boss.y + Math.sin(a) * boss.radius,
      vx: Math.cos(a) * speedInit,
      vy: Math.sin(a) * speedInit,
      r: 8,
      damage: dmg,
      life: 5,
      color: boss.color,
      knockback: 100,
      homing: { turnRate, speed },
      trail: true
    });
  }
  Sound.sfx('shoot');
}

/* ---------------------------------------------------------
EXECUTION — đánh dấu player, 1.2s sau nuke
--------------------------------------------------------- */
function execution(boss, game, diff, t, W) {
  const p = W.player;
  if (!p) return;
  /* Lưu vị trí player lúc bắt đầu */
  if (!boss.attackData.markX) {
    boss.attackData.markX = p.x;
    boss.attackData.markY = p.y;
    boss.attackData.markRadius = 120;
    Sound.sfx('warning');
  }
  /* Trong lúc telegraph: player di chuyển để thoát */
  /* Khi hết duration → nuke */
  if (t >= 1.15 && !boss.attackData.detonated) {
    boss.attackData.detonated = true;
    const mx = boss.attackData.markX;
    const my = boss.attackData.markY;
    const r = boss.attackData.markRadius;
    /* Nuke chữ thập — 4 tia dài */
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      for (let k = 0; k < 8; k++) {
        const dist = 40 + k * 30;
        shoot(W, {
          x: mx + Math.cos(a) * dist,
          y: my + Math.sin(a) * dist,
          vx: Math.cos(a) * 500,
          vy: Math.sin(a) * 500,
          r: 8,
          damage: boss.damage * 0.4,
          life: 1,
          color: '#ff3b52',
          knockback: 200
        });
      }
    }
    damageIfInRadius(game, W, mx, my, r, boss.damage * 1.8, boss);
    Sound.sfx('explosion');
    if (W.camera) W.camera.shake = 15;
  }
}

/* ---------------------------------------------------------
SINGULARITY — hố đen hút player, 1.8s sau nổ
--------------------------------------------------------- */
function singularity(boss, game, diff, t, W) {
  const p = W.player;
  if (!p) return;
  /* Đặt hố đen ở vị trí player lúc bắt đầu */
  if (!boss.attackData.holeX) {
    boss.attackData.holeX = p.x;
    boss.attackData.holeY = p.y;
    Sound.sfx('warning');
  }
  const hx = boss.attackData.holeX;
  const hy = boss.attackData.holeY;
  const pullRadius = 320;
  const pullForce = 280;
  /* Hút player nếu trong bán kính */
  const dx = hx - p.x;
  const dy = hy - p.y;
  const d = Math.hypot(dx, dy);
  if (d < pullRadius && d > 1) {
    const f = pullForce * (1 - d / pullRadius);
    p.vx += (dx / d) * f * 0.016;
    p.vy += (dy / d) * f * 0.016;
  }
  /* Spawn VFX hạt bị hút vào */
  if (W.particles && Math.random() < 0.9) {
    const a = Math.random() * TAU;
    const r = 200 + Math.random() * 100;
    W.particles.push({
      x: hx + Math.cos(a) * r,
      y: hy + Math.sin(a) * r,
      vx: -Math.cos(a) * 300,
      vy: -Math.sin(a) * 300,
      life: 0.7, maxLife: 0.7,
      size: 4, color: boss.color, type: 'dot'
    });
  }
  /* Nổ khi t >= 1.8s */
  if (t >= 1.8 && !boss.attackData.exploded) {
    boss.attackData.exploded = true;
    const count = 20 + diff.bulletCountAdd;
    shootRing(W, hx, hy, count, 220 * diff.bulletSpeedMul, {
      r: 8,
      damage: boss.damage * 0.6,
      life: 2,
      color: boss.color,
      knockback: 250
    });
    /* Damage AoE */
    damageIfInRadius(game, W, hx, hy, 140, boss.damage * 1.2, boss);
    Sound.sfx('explosion');
    if (W.camera) W.camera.shake = 12;
  }
}

/* ---------------------------------------------------------
VOID CROSS — 4 tia chữ thập xoay 2.5s
--------------------------------------------------------- */
function voidCross(boss, game, diff, t, W) {
  const rotSpeed = 0.5;   // rad/s
  const baseRot = t * rotSpeed;
  /* 4 tia: 0, 90, 180, 270 + xoay */
  for (let i = 0; i < 4; i++) {
    const a = baseRot + (i / 4) * TAU;
    /* Damage check theo từng frame */
    boss.attackData.dmgTimer = (boss.attackData.dmgTimer || 0) - 0.016;
    if (boss.attackData.dmgTimer <= 0) {
      boss.attackData.dmgTimer = 0.28;
      const x2 = boss.x + Math.cos(a) * 900;
      const y2 = boss.y + Math.sin(a) * 900;
      damageIfOnLine(game, W, boss.x, boss.y, x2, y2, 12, boss.damage * 0.5, boss);
    }
  }
  /* Visual: 4 tia vẽ qua W.beams (draw-fx tự dọn theo life) */
  if (!W.beams) W.beams = [];
  for (let i = 0; i < 4; i++) {
    const a = baseRot + (i / 4) * TAU;
    W.beams.push({
      x1: boss.x, y1: boss.y,
      x2: boss.x + Math.cos(a) * 900,
      y2: boss.y + Math.sin(a) * 900,
      width: 24,
      color: boss.color,
      coreColor: '#ffffff',
      life: 0.07,
      maxLife: 0.07
    });
  }
}

/* ---------------------------------------------------------
EVENT HORIZON — thu nhỏ map, xả đạn 4s
--------------------------------------------------------- */
function eventHorizon(boss, game, diff, t, W) {
  const p = W.player;
  if (!p) return;
  /* Pull player về tâm boss */
  const dx = boss.x - p.x;
  const dy = boss.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d > 40) {
    p.vx += (dx / d) * 180 * 0.016;
    p.vy += (dy / d) * 180 * 0.016;
  }
  /* Xả đạn vòng tròn mỗi 0.4s */
  boss.attackData.tick = (boss.attackData.tick || 0) - 0.016;
  if (boss.attackData.tick <= 0) {
    boss.attackData.tick = 0.20;
    const count = 16 + diff.bulletCountAdd;
    shootRing(W, boss.x, boss.y, count, 300 * diff.bulletSpeedMul, {
      r: 7,
      damage: boss.damage * 0.4,
      life: 2.5,
      color: boss.color,
      knockback: 100
    });
  }
  /* VFX: vòng năng lượng co lại */
  if (W.particles && Math.random() < 0.8) {
    const a = Math.random() * TAU;
    const r = 400 - t * 80;
    if (r > 0) {
      W.particles.push({
        x: boss.x + Math.cos(a) * r,
        y: boss.y + Math.sin(a) * r,
        vx: -Math.cos(a) * 150,
        vy: -Math.sin(a) * 150,
        life: 0.6, maxLife: 0.6,
        size: 5, color: boss.color, type: 'dot'
      });
    }
  }
}

/* ---------------------------------------------------------
VOID TENDRILS — 6 xúc tu hư không quét loang từ tâm boss
--------------------------------------------------------- */
function voidTendrils(boss, game, diff, t, W) {
  const ad = boss.attackData;
  const arms = 6;
  const baseRot = t * 0.55;
  const breathe = Math.sin(t * 2.4) * 0.22;
  if (!W.beams) W.beams = [];
  ad.tick = (ad.tick || 0) - 0.016;
  const strike = ad.tick <= 0;
  if (strike) ad.tick = 0.22;
  for (let i = 0; i < arms; i++) {
    const a = baseRot + (i / arms) * TAU + breathe;
    const len = 240 + Math.sin(t * 3.1 + i * 1.7) * 110;
    const x2 = boss.x + Math.cos(a) * len;
    const y2 = boss.y + Math.sin(a) * len;
    if (strike) {
      damageIfOnLine(game, W, boss.x, boss.y, x2, y2, 13, boss.damage * 0.42, boss);
    }
    W.beams.push({
      x1: boss.x, y1: boss.y, x2, y2,
      width: 16,
      color: boss.color,
      coreColor: '#e6d6ff',
      life: 0.07,
      maxLife: 0.07
    });
  }
  if (Math.random() < 0.12) Sound.sfx('laser');
}

/* ---------------------------------------------------------
GRAVITY WELL — nhiều hố đen nhỏ hút rồi nổ đồng loạt
--------------------------------------------------------- */
function gravityWell(boss, game, diff, t, W) {
  const p = W.player;
  if (!p) return;
  const ad = boss.attackData;
  if (!ad.wells) {
    ad.wells = [];
    ad.wellsFired = false;
    const n = 3 + Math.min(2, diff.bulletCountAdd | 0);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + Math.random() * 0.6;
      const r = 140 + Math.random() * 140;
      ad.wells.push({
        x: p.x + Math.cos(a) * r,
        y: p.y + Math.sin(a) * r
      });
    }
    Sound.sfx('warning');
  }
  for (let i = 0; i < ad.wells.length; i++) {
    const w = ad.wells[i];
    const dx = w.x - p.x;
    const dy = w.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 210 && d > 1) {
      const f = 240 * (1 - d / 210);
      p.vx += (dx / d) * f * 0.016;
      p.vy += (dy / d) * f * 0.016;
    }
    if (W.particles && Math.random() < 0.55) {
      const a = Math.random() * TAU;
      const rr = 110 + Math.random() * 70;
      W.particles.push({
        x: w.x + Math.cos(a) * rr,
        y: w.y + Math.sin(a) * rr,
        vx: -Math.cos(a) * 280,
        vy: -Math.sin(a) * 280,
        life: 0.5, maxLife: 0.5,
        size: 4, color: boss.color, type: 'dot'
      });
    }
  }
  if (t >= 1.3 && !ad.wellsFired) {
    ad.wellsFired = true;
    for (let i = 0; i < ad.wells.length; i++) {
      const w = ad.wells[i];
      shootRing(W, w.x, w.y, 12 + diff.bulletCountAdd, 210 * diff.bulletSpeedMul, {
        r: 7,
        damage: boss.damage * 0.45,
        life: 2,
        color: boss.color,
        knockback: 170
      });
      damageIfInRadius(game, W, w.x, w.y, 78, boss.damage * 0.9, boss);
    }
    Sound.sfx('shockwave');
    if (W.camera) W.camera.shake = 10;
  }
}

/* ---------------------------------------------------------
VOID MINEFIELD — rải mìn hư không, nổ dây chuyền
--------------------------------------------------------- */
function voidMinefield(boss, game, diff, t, W) {
  const ad = boss.attackData;
  if (!ad.mines) {
    ad.mines = [];
    const p = W.player;
    const n = 6 + Math.min(4, diff.bulletCountAdd | 0);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const r = 90 + Math.random() * 250;
      ad.mines.push({
        x: (p ? p.x : boss.x) + Math.cos(a) * r,
        y: (p ? p.y : boss.y) + Math.sin(a) * r,
        t: 0.45 + i * 0.17,
        radius: 72,
        done: false
      });
    }
    Sound.sfx('skill');
  }
  for (let i = 0; i < ad.mines.length; i++) {
    const m = ad.mines[i];
    if (m.done) continue;
    m.t -= 0.016;
    if (W.particles && Math.random() < 0.3) {
      const a = Math.random() * TAU;
      W.particles.push({
        x: m.x + Math.cos(a) * 26,
        y: m.y + Math.sin(a) * 26,
        vx: -Math.cos(a) * 40,
        vy: -Math.sin(a) * 40,
        life: 0.45, maxLife: 0.45,
        size: 4, color: '#c9a8ff', type: 'dot'
      });
    }
    if (m.t <= 0) {
      m.done = true;
      shootRing(W, m.x, m.y, 8, 190 * diff.bulletSpeedMul, {
        r: 6,
        damage: boss.damage * 0.35,
        life: 1.6,
        color: '#c9a8ff',
        knockback: 130
      });
      damageIfInRadius(game, W, m.x, m.y, m.radius, boss.damage * 0.7, boss);
      Sound.sfx('explosion');
    }
  }
}

/* ---------------------------------------------------------
SOUL SIPHON — luồng beam bám player, quét chậm, sát thương theo nhịp
--------------------------------------------------------- */
function soulSiphon(boss, game, diff, t, W) {
  const p = W.player;
  if (!p) return;
  const ad = boss.attackData;
  if (ad.beamA === undefined || ad.beamA === null) {
    ad.beamA = angleToPlayer(boss, W);
  }
  const want = angleToPlayer(boss, W);
  /* Bám càng lâu càng nhanh — player phải di chuyển liên tục */
  const track = clamp(0.05 + t * 0.02, 0, 0.42);
  ad.beamA = angLerp(ad.beamA, want, track);
  const len = 920;
  const x2 = boss.x + Math.cos(ad.beamA) * len;
  const y2 = boss.y + Math.sin(ad.beamA) * len;
  ad.tick = (ad.tick || 0) - 0.016;
  if (ad.tick <= 0) {
    ad.tick = 0.15;
    damageIfOnLine(game, W, boss.x, boss.y, x2, y2, 15, boss.damage * 0.32, boss);
  }
  if (!W.beams) W.beams = [];
  W.beams.push({
    x1: boss.x, y1: boss.y, x2, y2,
    width: 20,
    color: boss.color,
    coreColor: '#ffffff',
    life: 0.07,
    maxLife: 0.07
  });
  if (Math.random() < 0.1) Sound.sfx('beam');
}

/* ---------------------------------------------------------
PLACE HAZARDS — đặt bẫy corruption quanh player
--------------------------------------------------------- */
function placeHazards(boss, game, diff, t, W) {
  /* Đặt hazard 1 lần ở đầu */
  if (!boss.attackData.hazardsPlaced) {
    boss.attackData.hazardsPlaced = true;
    const cfg = boss.current.def.hazard;
    if (!cfg) return;
    const count = cfg.count[boss.phase] || cfg.count[1] || 2;
    const radius = cfg.radius || 60;
    const lifetime = cfg.lifetime || 5;
    boss.attackData.hazards = [];
    const p = W.player;
    if (!p) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const r = 80 + Math.random() * 200;
      boss.attackData.hazards.push({
        x: p.x + Math.cos(a) * r,
        y: p.y + Math.sin(a) * r,
        radius,
        lifetime,
        maxLifetime: lifetime,
        damagePerSec: cfg.damagePerSec || 15
      });
    }
    Sound.sfx('warning');
  }
  /* Update hazards */
  const hazards = boss.attackData.hazards || [];
  const p = W.player;
  for (let i = hazards.length - 1; i >= 0; i--) {
    const h = hazards[i];
    h.lifetime -= 0.016;
    /* Damage player nếu đứng trong hazard */
    if (p && p.alive) {
      const d = Math.hypot(p.x - h.x, p.y - h.y);
      if (d < h.radius + p.radius) {
        boss.attackData.hazardDmgTick = (boss.attackData.hazardDmgTick || 0) - 0.016;
        if (boss.attackData.hazardDmgTick <= 0) {
          boss.attackData.hazardDmgTick = 0.5;
          damagePlayer(game, W, h.damagePerSec * 0.5, boss);
        }
      }
    }
    /* VFX */
    if (W.particles && Math.random() < 0.5) {
      const a = Math.random() * TAU;
      const r = Math.random() * h.radius;
      W.particles.push({
        x: h.x + Math.cos(a) * r,
        y: h.y + Math.sin(a) * r,
        vx: 0, vy: -30,
        life: 0.7, maxLife: 0.7,
        size: 5, color: boss.color, type: 'dot'
      });
    }
    if (h.lifetime <= 0) hazards.splice(i, 1);
  }
}

/* =========================================================
TELEGRAPH SCRIPTS
Chạy 1 lần khi boss bắt đầu telegraph.
Mục đích: đặt trước vị trí hazard, chốt góc laser,
đánh dấu target cho execution...
========================================================= */
function tgLaserSweep(boss, game, diff) {
  /* Chốt baseAngle — không cho đổi giữa chừng */
  boss.attackData.baseAngle = null;   // để script tự tính frame đầu
  Sound.sfx('warning');
}

function tgSingularity(boss, game, diff) {
  boss.attackData.holeX = null;       // reset để script đặt vị trí
  Sound.sfx('warning');
}

function tgExecution(boss, game, diff) {
  boss.attackData.markX = null;
}

function tgSummon(boss, game, diff) {
  boss.attackData.summoned = false;
}

function tgRadialBurst(boss, game, diff) {
  boss.attackData.fired = false;
}

function tgDashCharge(boss, game, diff) {
  boss.attackData.charged = false;
}

function tgPlaceHazards(boss, game, diff) {
  boss.attackData.hazardsPlaced = false;
}

function tgBoomerang(boss, game, diff) {
  boss.attackData.thrown = false;
}

function tgGravityWell(boss, game, diff) {
  boss.attackData.wells = null;
  boss.attackData.wellsFired = false;
  Sound.sfx('warning');
}

function tgVoidMinefield(boss, game, diff) {
  boss.attackData.mines = null;
  Sound.sfx('skill');
}

function tgSoulSiphon(boss, game, diff) {
  boss.attackData.beamA = null;
  boss.attackData.tick = 0;
  Sound.sfx('charge');
}

/* =========================================================
REGISTRATION
========================================================= */
registerAttackScripts({
  radialBurst,
  laserSweep,
  summonMinions,
  lockdown,
  seismicSlam,
  moltenSpray,
  dashCharge,
  blinkStrike,
  systemCrash,
  boomerang,
  homingMissiles,
  execution,
  singularity,
  voidCross,
  eventHorizon,
  voidTendrils,
  gravityWell,
  voidMinefield,
  soulSiphon,
  placeHazards
});

registerTelegraphScripts({
  radialBurst: tgRadialBurst,
  laserSweep: tgLaserSweep,
  singularity: tgSingularity,
  execution: tgExecution,
  summonMinions: tgSummon,
  dashCharge: tgDashCharge,
  placeHazards: tgPlaceHazards,
  boomerang: tgBoomerang,
  gravityWell: tgGravityWell,
  voidMinefield: tgVoidMinefield,
  soulSiphon: tgSoulSiphon
});

/* =========================================================
EXPORT — để debug
========================================================= */
export const ATTACK_SCRIPTS = {
  radialBurst, laserSweep, summonMinions, lockdown,
  seismicSlam, moltenSpray, dashCharge, blinkStrike,
  systemCrash, boomerang, homingMissiles, execution,
  singularity, voidCross, eventHorizon, placeHazards,
  voidTendrils, gravityWell, voidMinefield, soulSiphon
};