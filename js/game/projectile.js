/* =========================================================
   VNXX — GAME / PROJECTILE
   Đạn bay, va chạm tường / prop / enemy / player, splash, chain.

   Mới:
   - Va chạm prop phá hủy (thùng nổ, thùng tiếp tế)
   - Chain lightning cho ARC COIL
   - Splash nổ lan sang prop
   ========================================================= */

import { dist, dist2, removeAt, rnd } from '../core/utils.js';
import Settings from '../core/settings.js';
import Sound from '../systems/sound.js';
import { Fx, FloatText } from '../systems/fx.js';
import { damageEnemy } from './enemy.js';
import { damagePlayer } from './player.js';
import { damageProp } from './hazards.js';
import * as Status from '../systems/status.js';

/* =========================================================
   UPDATE PROJECTILES
   ========================================================= */
export function updateProjectiles(game, W, dt) {
  const projs = W.projectiles;

  for (let i = projs.length - 1; i >= 0; i--) {
    const pr = projs[i];

    pr.life -= dt;
    if (pr.life <= 0) {
      removeAt(projs, i);
      continue;
    }

    pr.px = pr.x;
    pr.py = pr.y;

    if (pr.homing) updateHoming(pr, W, dt);
    if (pr.isBoomerang) updateBoomerang(pr, W, dt);

    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;

    if (pr.x < -80 || pr.x > W.w + 80 ||
        pr.y < -80 || pr.y > W.h + 80) {
      removeAt(projs, i);
      continue;
    }

    /* --- Prop phá hủy --- */
    if (pr.owner === 'player' && W.props) {
      const prop = hitProp(W, pr);
      if (prop) {
        if (pr.splash > 0) explodeProjectile(game, W, pr);
        damageProp(game, W, prop, pr.damage);
        Fx.burst(W.particles, pr.x, pr.y, 4, '#ffc44d', 130, .25, 3);
        removeAt(projs, i);
        continue;
      }
    }

    /* --- Tường (có nảy nếu pr.bounce > 0) --- */
    if (hitsObstacle(W, pr)) {
      if (pr.bounce > 0 && tryBounce(W, pr, dt)) {
        continue;
      }
      if (pr.splash > 0) explodeProjectile(game, W, pr);
      Fx.burst(W.particles, pr.x, pr.y, 4, pr.color, 120, .25, 3);
      removeAt(projs, i);
      continue;
    }

    /* --- Trail --- */
    if (pr.trail && Settings.get('fxOn') && Math.random() < .7) {
      Fx.spawn(W.particles, pr.x, pr.y,
        rnd(-20, 20), rnd(-20, 20), .22, 3, pr.color);
    }

    /* --- Entity --- */
    if (pr.owner === 'player') {
      if (handlePlayerProjectile(game, W, pr, i)) continue;
    } else {
      if (handleEnemyProjectile(game, W, pr, i)) continue;
    }
  }
}

/* =========================================================
   BOUNCE — nảy tường cho đạn ricochet
   Trả về true nếu nảy được (đạn tiếp tục bay).
   ========================================================= */
function tryBounce(W, pr, dt) {
  const bx = pr.px;
  const by = pr.py;
  pr.bounce--;

  const ok = _bounceMove(W, pr, dt, bx, by);
  if (ok) {
    Fx.burst(W.particles, pr.x, pr.y, 2, pr.color, 90, .16, 2.2);
    if (pr.weaponId === 'ricochet') Sound.sfx('ricochet');
  }
  return ok;
}

function _bounceMove(W, pr, dt, bx, by) {

  /* Thử giữ nguyên hướng X, chỉ đảo Y (va tường ngang) */
  pr.x = bx + pr.vx * dt;
  pr.y = by;
  if (!hitsObstacle(W, pr)) return true;

  pr.vx = -pr.vx;
  pr.x = bx + pr.vx * dt;
  if (!hitsObstacle(W, pr)) return true;

  /* Thử giữ nguyên Y, đảo X (va tường dọc) */
  pr.x = bx;
  pr.y = by + pr.vy * dt;
  if (!hitsObstacle(W, pr)) return true;

  pr.vy = -pr.vy;
  pr.y = by + pr.vy * dt;
  if (!hitsObstacle(W, pr)) return true;

  /* Kẹt góc — trả về vị trí cũ, đạn sẽ chết */
  pr.x = bx;
  pr.y = by;
  return false;
}

/* =========================================================
   NEAREST ENEMY — cho đạn homing của player
   ========================================================= */
function nearestEnemy(W, x, y, maxDist) {
  const list = W.enemies;
  if (!list || list.length === 0) return null;
  let best = null;
  let bestD = maxDist * maxDist;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e || !e.alive) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

/* =========================================================
   WALL
   ========================================================= */
function hitsObstacle(W, pr) {
  for (let k = 0; k < W.obstacles.length; k++) {
    const o = W.obstacles[k];
    if (o.blockBullets === false) continue;
    if (pr.x > o.x && pr.x < o.x + o.w &&
        pr.y > o.y && pr.y < o.y + o.h) {
      return true;
    }
  }
  return false;
}

/* =========================================================
   PROP HIT
   ========================================================= */
function hitProp(W, pr) {
  const props = W.props;
  if (!props) return null;

  for (let i = 0; i < props.length; i++) {
    const o = props[i];
    if (o.dead) continue;
    const rr = pr.r + o.r;
    if (dist2(pr, o) < rr * rr) return o;
  }
  return null;
}

/* =========================================================
   SWEPT COLLISION
   Đạn nhanh (sniper/railgun) có thể nhảy qua quái trong 1 frame.
   Kiểm tra khoảng cách từ tâm mục tiêu tới đoạn đường đạn đã đi.
   ========================================================= */
function segHitsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;

  if (len2 < 1e-6) {
    const ddx = cx - x1;
    const ddy = cy - y1;
    return ddx * ddx + ddy * ddy <= r * r;
  }

  let t = ((cx - x1) * dx + (cy - y1) * dy) / len2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;

  const px = x1 + dx * t;
  const py = y1 + dy * t;
  const ddx = cx - px;
  const ddy = cy - py;
  return ddx * ddx + ddy * ddy <= r * r;
}

/* =========================================================
   PLAYER PROJECTILE HIT
   ========================================================= */
function handlePlayerProjectile(game, W, pr, i) {
  const projs = W.projectiles;
  const enemies = W.enemies;

  const opts = {
    armorPen: pr.armorPen || 0,
    elementDamageMul: pr.elementDamageMul || 0
  };

  const x1 = pr.px == null ? pr.x : pr.px;
  const y1 = pr.py == null ? pr.y : pr.py;

  for (let j = enemies.length - 1; j >= 0; j--) {
    const e = enemies[j];
    if (!e.alive) continue;
    if (pr.hitSet.has(e)) continue;

    const rr = pr.r + e.radius;
    if (!segHitsCircle(x1, y1, pr.x, pr.y, e.x, e.y, rr)) continue;

    pr.hitSet.add(e);

    if (pr.splash > 0) {
      explodeProjectile(game, W, pr);
      removeAt(projs, i);
      return true;
    }

    damageEnemy(game, W, e, pr.damage, pr.crit, W.player, pr.knockback, opts);

    /* --- Chain lightning --- */
    if (pr.chain && pr.chain.count > 0) {
      chainTo(game, W, pr, e, pr.chain, opts);
    }

    if (pr.pierce > 0) {
      pr.pierce--;
    } else {
      removeAt(projs, i);
      return true;
    }
  }
  return false;
}

/* =========================================================
   CHAIN LIGHTNING
   ========================================================= */
function chainTo(game, W, pr, from, cfg, opts) {
  let src = from;
  const hit = new Set([from]);
  let dmg = pr.damage * .55;

  for (let n = 0; n < cfg.count; n++) {
    let best = null;
    let bd = cfg.range;

    for (let k = 0; k < W.enemies.length; k++) {
      const e = W.enemies[k];
      if (!e.alive || hit.has(e)) continue;
      const d = dist(e, src);
      if (d < bd) { bd = d; best = e; }
    }

    if (!best) break;

    hit.add(best);

    /* Vẽ tia sét */
    W.beams.push({
      x1: src.x, y1: src.y,
      x2: best.x, y2: best.y,
      width: 5,
      color: '#ffe14d',
      coreColor: '#ffffff',
      life: .18,
      maxLife: .18
    });

    Fx.burst(W.particles, best.x, best.y, 6, '#ffe14d', 200, .3, 3);
    Sound.sfx('crit');

    damageEnemy(game, W, best, dmg, false, W.player, 60, opts);
    Status.applyStatus(best, 'shock', 3, 1, W.player);

    src = best;
    dmg *= cfg.falloff || .7;
  }
}

/* =========================================================
   ENEMY PROJECTILE HIT
   ========================================================= */
function handleEnemyProjectile(game, W, pr, i) {
  const p = W.player;
  if (!p.alive) return false;

  const rr = pr.r + p.radius;
  const x1 = pr.px == null ? pr.x : pr.px;
  const y1 = pr.py == null ? pr.y : pr.py;
  if (!segHitsCircle(x1, y1, pr.x, pr.y, p.x, p.y, rr)) return false;

  if (pr.specialType) {
    applySpecialEffect(game, W, pr);
  }

  if (pr.damage > 0) {
    damagePlayer(game, W, pr.damage, null);
  }

  if (pr.splash > 0) {
    explodeProjectile(game, W, pr, false);
  }

  removeAt(W.projectiles, i);
  return true;
}

/* =========================================================
   SPECIAL EFFECT — status lên player
   ========================================================= */
function applySpecialEffect(game, W, pr) {
  const p = W.player;

  if (pr.slowDuration && pr.slowFactor) {
    Status.applyStatus(p, 'chill', pr.slowDuration, 1, null);
    FloatText.add(W.texts, p.x, p.y - 40, 'SLOWED!', '#aaddff', 15);
  }

  if (pr.type === 'ice' && pr.slowDuration) {
    Status.applyStatus(p, 'freeze', pr.slowDuration * .3, 1, null);
    FloatText.add(W.texts, p.x, p.y - 40, 'FROZEN!', '#00ffff', 15);
  }

  if (pr.dotDamage && pr.dotDuration) {
    Status.applyStatus(p, 'burn', pr.dotDuration, pr.dotDamage, null);
    FloatText.add(W.texts, p.x, p.y - 40, 'BURNING!', '#ffaa00', 15);
  }

  if (pr.poisonDamage && pr.poisonDuration) {
    Status.applyStatus(p, 'poison', pr.poisonDuration, pr.poisonDamage, null);
    FloatText.add(W.texts, p.x, p.y - 40, 'POISONED!', '#88ff00', 15);
  }
}

/* =========================================================
   HOMING
   ========================================================= */
function updateHoming(pr, W, dt) {
  const h = pr.homing;

  /* Đạn của player → bám quái gần nhất; đạn quái → bám player */
  let tx, ty;
  if (pr.owner === 'player') {
    /* Khoá mục tiêu 1 lần rồi bám tới chết — nếu không đạn sẽ
       mất dấu ngay khi bay ra khỏi bán kính tìm kiếm. */
    let e = pr._ht;
    if (!e || !e.alive) {
      e = nearestEnemy(W, pr.x, pr.y, 760);
      pr._ht = e;
    }
    if (!e) return;
    tx = e.x;
    ty = e.y;
  } else {
    const p = W.player;
    if (!p || !p.alive) return;
    tx = p.x;
    ty = p.y;
  }

  const dx = tx - pr.x;
  const dy = ty - pr.y;
  const targetAngle = Math.atan2(dy, dx);

  const speed = Math.hypot(pr.vx, pr.vy);
  const currentAngle = Math.atan2(pr.vy, pr.vx);

  let diff = targetAngle - currentAngle;
  while (diff > Math.PI)  diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;

  const maxTurn = h.turnRate * dt;
  const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
  const newAngle = currentAngle + turn;

  const targetSpeed = h.speed || speed;
  const newSpeed = Math.min(targetSpeed, speed + 400 * dt);

  pr.vx = Math.cos(newAngle) * newSpeed;
  pr.vy = Math.sin(newAngle) * newSpeed;

  if (Math.random() < 0.5) {
    Fx.spawn(W.particles, pr.x, pr.y,
      (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40,
      0.3, 3, pr.color);
  }
}

/* =========================================================
   BOOMERANG
   ========================================================= */
function updateBoomerang(pr, W, dt) {
  pr.age = (pr.age || 0) + dt;

  if (!pr.returning && pr.age >= pr.boomerangReturnAt) {
    pr.returning = true;
  }

  if (pr.returning) {
    const boss = W.boss;
    if (!boss) return;

    const dx = boss.x - pr.x;
    const dy = boss.y - pr.y;
    const d = Math.hypot(dx, dy) || 0.001;

    const speed = 700;
    pr.vx = (dx / d) * speed;
    pr.vy = (dy / d) * speed;

    if (d < boss.radius + pr.r) {
      pr.life = 0;
    }
  }

  pr.spin = (pr.spin || 0) + dt * 20;
}

/* =========================================================
   EXPLODE
   ========================================================= */
export function explodeProjectile(game, W, pr, friendlyFire) {
  const R = pr.splash;

  Fx.burst(W.particles, pr.x, pr.y, 18, pr.color, 340, .55, 4);
  Fx.ring(W.particles, pr.x, pr.y, pr.color, R, .4);
  Sound.sfx('explosion');
  if (Settings.get('shakeOn')) {
    W.camera.shake = Math.min(11, 6);
  }

  const isPlayerShot = friendlyFire === undefined
    ? pr.owner === 'player'
    : friendlyFire;

  if (isPlayerShot) {
    const opts = {
      armorPen: pr.armorPen || 0,
      elementDamageMul: pr.elementDamageMul || 0
    };

    const enemies = W.enemies;
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (!e.alive) continue;
      if (dist(e, pr) < R + e.radius) {
        damageEnemy(game, W, e, pr.damage * .75, false, W.player, pr.knockback, opts);
      }
    }

    /* Nổ lan sang prop */
    if (W.props) {
      for (let k = 0; k < W.props.length; k++) {
        const o = W.props[k];
        if (o.dead) continue;
        if (Math.hypot(o.x - pr.x, o.y - pr.y) < R + o.r) {
          damageProp(game, W, o, pr.damage * .6);
        }
      }
    }
  } else {
    const p = W.player;
    if (p.alive && dist(p, pr) < R + p.radius) {
      damagePlayer(game, W, pr.damage * .8, null);
    }
  }
}
