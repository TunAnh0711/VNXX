/* =========================================================
   VNXX — GAME / PROJECTILE
   Update đạn bay, va chạm tường/enemy/player, splash damage.
   Nhận `game` và `W` làm tham số → không import Game.
   ========================================================= */

import { dist, dist2, removeAt, rnd } from '../core/utils.js';
import Settings from '../core/settings.js';
import Sound from '../systems/sound.js';
import { Fx } from '../systems/fx.js';

import { damageEnemy } from './enemy.js';
import { damagePlayer } from './player.js';

/* =========================================================
   UPDATE PROJECTILES (mỗi frame)
   ========================================================= */
export function updateProjectiles(game, W, dt) {
  const p = W.player;
  const projs = W.projectiles;

  for (let i = projs.length - 1; i >= 0; i--) {
    const pr = projs[i];

    /* --- Lifetime --- */
    pr.life -= dt;
    if (pr.life <= 0) {
      removeAt(projs, i);
      continue;
    }

    /* --- Lưu vị trí cũ để vẽ trail --- */
    pr.px = pr.x;
    pr.py = pr.y;

    /* --- Di chuyển --- */
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;

    /* --- Out of bounds --- */
    if (pr.x < -80 || pr.x > W.w + 80 ||
        pr.y < -80 || pr.y > W.h + 80) {
      removeAt(projs, i);
      continue;
    }

    /* --- Va chạm tường --- */
    if (hitsObstacle(W, pr)) {
      if (pr.splash > 0) explodeProjectile(game, W, pr);
      Fx.burst(W.particles, pr.x, pr.y, 4, pr.color, 120, .25, 3);
      removeAt(projs, i);
      continue;
    }

    /* --- Trail FX cho railgun/sniper --- */
    if (pr.trail && Settings.get('fxOn') && Math.random() < .7) {
      Fx.spawn(
        W.particles, pr.x, pr.y,
        rnd(-20, 20), rnd(-20, 20),
        .22, 3, pr.color
      );
    }

    /* --- Va chạm entity --- */
    if (pr.owner === 'player') {
      if (handlePlayerProjectile(game, W, pr, i)) continue;
    } else {
      if (handleEnemyProjectile(game, W, pr, i)) continue;
    }
  }
}

/* =========================================================
   CHECK WALL COLLISION
   ========================================================= */
function hitsObstacle(W, pr) {
  for (let k = 0; k < W.obstacles.length; k++) {
    const o = W.obstacles[k];
    if (pr.x > o.x && pr.x < o.x + o.w &&
        pr.y > o.y && pr.y < o.y + o.h) {
      return true;
    }
  }
  return false;
}

/* =========================================================
   PLAYER PROJECTILE HIT
   Trả về true nếu đạn bị tiêu huỷ (cần continue vòng ngoài).
   ========================================================= */
function handlePlayerProjectile(game, W, pr, i) {
  const projs = W.projectiles;
  const enemies = W.enemies;

  for (let j = enemies.length - 1; j >= 0; j--) {
    const e = enemies[j];
    if (!e.alive) continue;
    if (pr.hitSet.has(e)) continue;

    const rr = pr.r + e.radius;
    if (dist2(pr, e) >= rr * rr) continue;

    /* Đạn có splash → nổ ngay, không pierce */
    pr.hitSet.add(e);
    if (pr.splash > 0) {
      explodeProjectile(game, W, pr);
      removeAt(projs, i);
      return true;
    }

    damageEnemy(game, W, e, pr.damage, pr.crit, W.player, pr.knockback);

    if (pr.pierce > 0) {
      pr.pierce--;
      /* Tiếp tục bay xuyên qua */
    } else {
      removeAt(projs, i);
      return true;
    }
  }
  return false;
}

/* =========================================================
   ENEMY PROJECTILE HIT
   ========================================================= */
function handleEnemyProjectile(game, W, pr, i) {
  const p = W.player;
  if (!p.alive) return false;

  const rr = pr.r + p.radius;
  if (dist2(pr, p) >= rr * rr) return false;

  /* Xử lý các loại đạn đặc biệt */
  if (pr.specialType) {
    applySpecialEffect(game, W, pr);
  } else {
    damagePlayer(game, W, pr.damage, null);
  }

  if (pr.splash > 0) {
    /* Splash của đạn quái chỉ gây damage player, không damage quái */
    explodeProjectile(game, W, pr, /* friendlyFire */ false);
  }

  removeAt(W.projectiles, i);
  return true;
}

/* =========================================================
   APPLY SPECIAL EFFECT (slow, fire, ice, poison)
   ========================================================= */
function applySpecialEffect(game, W, pr) {
  const p = W.player;
  
  /* Slow effect */
  if (pr.slowDuration && pr.slowFactor) {
    p.buffs.slow = Math.max(p.buffs.slow || 0, pr.slowDuration);
    p.slowFactor = Math.min(p.slowFactor || 1, pr.slowFactor);
    FloatText.add(W.texts, p.x, p.y - 40, 'SLOWED!', '#aaddff', 15);
  }
  
  /* Fire DOT */
  if (pr.dotDamage && pr.dotDuration) {
    p.buffs.burn = Math.max(p.buffs.burn || 0, pr.dotDuration);
    p.burnDamage = Math.max(p.burnDamage || 0, pr.dotDamage);
    FloatText.add(W.texts, p.x, p.y - 40, 'BURNING!', '#ffaa00', 15);
  }
  
  /* Ice slow */
  if (pr.slowDuration && pr.type === 'ice') {
    p.buffs.frozen = Math.max(p.buffs.frozen || 0, pr.slowDuration * 0.3);
    FloatText.add(W.texts, p.x, p.y - 40, 'FROZEN!', '#00ffff', 15);
  }
  
  /* Poison DOT */
  if (pr.poisonDamage && pr.poisonDuration) {
    p.buffs.poisoned = Math.max(p.buffs.poisoned || 0, pr.poisonDuration);
    p.poisonDamage = Math.max(p.poisonDamage || 0, pr.poisonDamage);
    FloatText.add(W.texts, p.x, p.y - 40, 'POISONED!', '#88ff00', 15);
    
    /* Tạo vùng độc nếu là poison bomber */
    if (pr.splash > 0) {
      W.areaEffects = W.areaEffects || [];
      W.areaEffects.push({
        x: pr.x,
        y: pr.y,
        radius: pr.splash,
        type: 'poison',
        damage: pr.poisonDamage,
        duration: pr.poisonDuration * 2,
        maxDuration: pr.poisonDuration * 2,
        color: '#88ff00'
      });
    }
  }
  
  /* Gây damage cơ bản */
  if (pr.damage > 0) {
    damagePlayer(game, W, pr.damage, null);
  }
}

/* =========================================================
   EXPLODE PROJECTILE (splash damage)
   - friendlyFire: đạn của player → damage quái
   - !friendlyFire: đạn của quái → damage player
   Tự suy ra từ pr.owner nếu không truyền.
   ========================================================= */
export function explodeProjectile(game, W, pr, friendlyFire) {
  const R = pr.splash;

  /* VFX + SFX */
  Fx.burst(W.particles, pr.x, pr.y, 18, pr.color, 340, .55, 4);
  Fx.ring(W.particles, pr.x, pr.y, pr.color, R, .4);
  Sound.sfx('explosion');
  if (Settings.get('shakeOn')) {
    W.camera.shake = Math.min(11, 6);
  }

  /* Xác định phe */
  const isPlayerShot = friendlyFire === undefined
    ? pr.owner === 'player'
    : friendlyFire;

  if (isPlayerShot) {
    /* Damage toàn bộ quái trong bán kính (kể cả đã xuyên qua) */
    const enemies = W.enemies;
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (!e.alive) continue;
      if (dist(e, pr) < R + e.radius) {
        /* 75% damage cho splash (giảm so với direct hit) */
        damageEnemy(
          game, W, e,
          pr.damage * .75,
          false,
          W.player,
          pr.knockback
        );
      }
    }
  } else {
    /* Damage player nếu trong bán kính */
    const p = W.player;
    if (p.alive && dist(p, pr) < R + p.radius) {
      damagePlayer(game, W, pr.damage * .8, null);
    }
  }
}