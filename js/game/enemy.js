/* =========================================================
   VNXX — GAME / ENEMY
   Spawn + AI (chase / ranged / assassin / exploder / shield)
   + damage + death + drop loot.
   Nhận `game` và `W` làm tham số → không import Game.
   ========================================================= */

import { CFG, DIFFICULTIES } from '../core/constants.js';
import {
  ENEMIES, ELITE_MODS,
  applyEliteMods, eliteModNames
} from '../data/enemies.js';
import { getStage } from '../data/stages.js';
import {
  clamp, dist, dist2, angLerp,
  rnd, rndInt, pick, removeAt, TAU
} from '../core/utils.js';
import Settings from '../core/settings.js';
import Sound from '../systems/sound.js';
import { Fx, FloatText } from '../systems/fx.js';

import {
  collideWithObstacles,
  pointInObstacle
} from './world.js';
import { damagePlayer } from './player.js';
import { dropLoot, spawnChest } from './loot.js';

/* =========================================================
   SPAWN FROM QUEUE (dùng tag 'ELITE_xxx' hoặc 'xxx')
   ========================================================= */
export function spawnFromQueue(game, W, tag) {
  if (W.enemies.length >= CFG.MAX_ENEMIES) return null;

  let elite = false;
  let type = tag;

  if (typeof tag === 'string' && tag.startsWith('ELITE_')) {
    elite = true;
    type = tag.slice(6);
  }

  const p = W.player;
  let x = 0, y = 0, tries = 0;

  do {
    const a = Math.random() * TAU;
    const r = rnd(620, 900);
    x = clamp(p.x + Math.cos(a) * r, 50, W.w - 50);
    y = clamp(p.y + Math.sin(a) * r, 50, W.h - 50);
    tries++;
  } while (pointInObstacle(W, x, y, 24) && tries < 12);

  return spawnEnemy(game, W, type, x, y, elite);
}

/* =========================================================
   SPAWN ENEMY (base + scale wave/stage/difficulty + elite)
   ========================================================= */
export function spawnEnemy(game, W, typeKey, x, y, elite = false) {
  const base = ENEMIES[typeKey];
  if (!base) return null;

  const d = DIFFICULTIES[game.profile.difficulty];
  const stageMul = 1 + (W.stage - 1) * .42;
  const waveMul = 1 + (W.wave - 1) * .115;
  const hpMul = stageMul * waveMul * d.hp * (elite ? 2.8 : 1);
  const dmgMul = stageMul * .75 * d.dmg * (elite ? 1.6 : 1);

  const e = {
    type: typeKey,
    elite: !!elite,
    x, y, vx: 0, vy: 0, kx: 0, ky: 0,
    radius: base.radius * (elite ? 1.25 : 1),

    /* HP / shield */
    hp: base.hp * hpMul,
    maxHp: base.hp * hpMul,
    shield: (base.shield || 0) * hpMul,
    maxShield: (base.shield || 0) * hpMul,

    /* Stats */
    speed: base.speed * d.speed * (elite ? 1.08 : 1),
    damage: base.damage * dmgMul,
    color: base.color,
    ai: base.ai,

    /* Attack */
    attackRange: base.attackRange,
    attackCd: base.attackCd,
    attackTimer: rnd(0, .5),
    preferred: base.preferred || 0,
    projectileSpeed: base.projectileSpeed || 300,

    /* Resist / rewards */
    knockRes: base.knockRes || 0,
    xp: base.xp * (elite ? 3.2 : 1),
    credits: base.credits * (elite ? 3.5 : 1),

    /* State */
    angle: Math.random() * TAU,
    hitFlash: 0,
    frozen: 0,
    slow: 0,

    /* Elite effects (mặc định 0) */
    regen: 0,
    dmgReduce: 0,
    lifesteal: 0,
    teleportCd: 0,

    /* Dash (assassin) */
    dashTimer: rnd(.5, 2),
    dashing: 0,
    dashDir: { x: 0, y: 0 },

    /* Exploder */
    fuse: -1,

    /* Wander */
    state: 'chase',
    wanderT: 0,
    wanderA: 0,

    /* Metadata */
    modName: null,
    alive: true,
    dodgeTimer: rnd(1, 3)
  };

  /* Shield enemy có shieldRegen */
  if (base.shieldRegen) e.shieldRegen = base.shieldRegen;
  if (base.dashCd) e.dashCd = base.dashCd;
  if (base.dashSpeed) e.dashSpeed = base.dashSpeed;
  if (base.blastRadius) e.blastRadius = base.blastRadius;

  /* Elite modifiers */
  if (elite) {
    const n = Math.random() < .25 ? 2 : 1;
    const used = applyEliteMods(e, n);
    e.modName = eliteModNames(used);
    e.hp *= 1.6;
    e.maxHp = e.hp;
    e.xp *= 2;
    e.credits *= 2;
  }

  W.enemies.push(e);
  return e;
}

/* =========================================================
   UPDATE ENEMIES (chạy mỗi frame)
   ========================================================= */
export function updateEnemies(game, W, dt) {
  const p = W.player;

  for (let i = W.enemies.length - 1; i >= 0; i--) {
    const e = W.enemies[i];
    if (!e.alive) { removeAt(W.enemies, i); continue; }

    /* Timers */
    if (e.hitFlash > 0) e.hitFlash -= dt;

    /* Frozen: bỏ qua AI, chỉ trôi theo quán tính */
    if (e.frozen > 0) {
      e.frozen -= dt;
      applyEnemyPhysics(e, dt, .15);
      continue;
    }

    /* Regen */
    if (e.regen > 0 && e.hp < e.maxHp) {
      e.hp = Math.min(e.maxHp, e.hp + e.regen * dt);
    }

    /* Shield regen */
    if (e.shieldRegen && e.shield < e.maxShield) {
      e.shield = Math.min(e.maxShield, e.shield + e.shieldRegen * dt);
    }

    /* Knockback physics */
    e.x += e.kx * dt;
    e.y += e.ky * dt;
    e.kx *= 1 - 8 * dt;
    e.ky *= 1 - 8 * dt;

    /* AI dispatch */
    if (e.isBoss) {
      game.updateBoss(e, dt);
    } else {
      updateEnemyAI(game, W, e, dt);
    }

    /* Separation (đẩy nhau ra) */
    separateFromOthers(W, e, i);

    /* Obstacle + boundary */
    collideWithObstacles(W, e);
    e.x = clamp(e.x, e.radius, W.w - e.radius);
    e.y = clamp(e.y, e.radius, W.h - e.radius);

    /* Contact damage với player */
    if (p.alive) {
      const d = dist(e, p);
      if (d < e.radius + p.radius) {
        if (e.ai === 'exploder' && e.fuse < 0) {
          e.fuse = .55;
        } else if (e.fuse < 0) {
          damagePlayer(game, W, e.damage, e);
        }
      }
    }
  }
}

/* =========================================================
   SEPARATION (tránh chồng chất)
   ========================================================= */
function separateFromOthers(W, e, myIdx) {
  for (let j = myIdx - 1; j >= 0; j--) {
    const o = W.enemies[j];
    const dx = e.x - o.x;
    const dy = e.y - o.y;
    const rr = e.radius + o.radius;
    const d2 = dx * dx + dy * dy;

    if (d2 < rr * rr && d2 > .0001) {
      const d = Math.sqrt(d2);
      const push = (rr - d) / d * .5;
      const w1 = e.isBoss ? 0 : 1;
      const w2 = o.isBoss ? 0 : 1;
      e.x += dx * push * w1;
      e.y += dy * push * w1;
      o.x -= dx * push * w2;
      o.y -= dy * push * w2;
    }
  }
}

/* =========================================================
   PHYSICS khi frozen (trôi + friction cao)
   ========================================================= */
function applyEnemyPhysics(e, dt, frictionMul) {
  e.x += (e.vx || 0) * dt;
  e.y += (e.vy || 0) * dt;
  e.vx *= 1 - 6 * dt * (frictionMul || 1);
  e.vy *= 1 - 6 * dt * (frictionMul || 1);
}

/* =========================================================
   ENEMY AI DISPATCH
   ========================================================= */
function updateEnemyAI(game, W, e, dt) {
  const p = W.player;
  if (!p.alive) return;

  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.hypot(dx, dy) || .0001;
  const ux = dx / d;
  const uy = dy / d;

  e.angle = angLerp(e.angle, Math.atan2(dy, dx), clamp(dt * 7, 0, 1));

  /* Dodge check (mỗi 0.25–0.6s) */
  e.dodgeTimer -= dt;
  if (e.dodgeTimer <= 0) {
    e.dodgeTimer = rnd(.25, .6);
    dodgeProjectiles(W, e);
  }

  let ax = 0, ay = 0;
  const speed = e.speed;

  switch (e.ai) {
    case 'chase': {
      ax = ux; ay = uy;
      if (d < e.attackRange + e.radius) { ax *= .15; ay *= .15; }
      contactAttack(game, W, e, d, dt);
      break;
    }

    case 'ranged': {
      const pref = e.preferred || 260;
      if (d > pref * 1.15) { ax = ux; ay = uy; }
      else if (d < pref * .7) { ax = -ux; ay = -uy; }
      else {
        const pa = Math.atan2(dy, dx) + Math.PI / 2;
        const side = Math.sin(W.time * .6 + e.x * .01) > 0 ? 1 : -1;
        ax = Math.cos(pa) * side * .7;
        ay = Math.sin(pa) * side * .7;
      }

      e.attackTimer -= dt;
      if (e.attackTimer <= 0 && d < e.attackRange) {
        e.attackTimer = e.attackCd;
        enemyShoot(W, e);
      }
      break;
    }

    case 'assassin': {
      e.dashTimer -= dt;
      if (e.dashing > 0) {
        e.dashing -= dt;
        e.x += e.dashDir.x * (e.dashSpeed || 640) * dt;
        e.y += e.dashDir.y * (e.dashSpeed || 640) * dt;
        if (Math.random() < .5) {
          Fx.spawn(W.particles, e.x, e.y, 0, 0, .25, 4, e.color);
        }
      } else {
        if (d < 380 && e.dashTimer <= 0) {
          e.dashTimer = e.dashCd || 2.6;
          e.dashing = .22;
          e.dashDir = { x: ux, y: uy };
          Sound.sfx('dash');
        }
        ax = ux; ay = uy;
        if (d < e.attackRange + e.radius) { ax *= .2; ay *= .2; }
        contactAttack(game, W, e, d, dt);
      }
      break;
    }

    /* --- SHADOW ASSASSIN (Sát thủ lướt nhanh) --- */
    case 'shadow_assassin': {
      e.dashTimer -= dt;
      const dashRange = e.dashRange || 380;
      
      if (e.dashing > 0) {
        e.dashing -= dt;
        e.x += e.dashDir.x * (e.dashSpeed || 720) * dt;
        e.y += e.dashDir.y * (e.dashSpeed || 720) * dt;
        if (Math.random() < .7) {
          Fx.spawn(W.particles, e.x, e.y, 0, 0, .25, 4, '#aa00ff');
        }
        
        /* Gây damage khi đang lướt và chạm player */
        if (d < e.radius + W.player.radius) {
          damagePlayer(game, W, e.damage, e);
        }
      } else {
        /* Bắt đầu lướt khi trong tầm */
        if (d < dashRange && e.dashTimer <= 0) {
          e.dashTimer = e.dashCd || 2.0;
          e.dashing = .18;
          e.dashDir = { x: ux, y: uy };
          Sound.sfx('dash');
        }
        ax = ux; ay = uy;
        if (d < e.attackRange + e.radius) { ax *= .15; ay *= .15; }
        contactAttack(game, W, e, d, dt);
      }
      break;
    }

    /* --- KAMIKAZE (Quái cảm tử) --- */
    case 'kamikaze': {
      if (e.fuse >= 0) {
        /* Đang trong quá trình nổ */
        e.fuse -= dt;
        ax = 0; ay = 0;
        e.radius += dt * 12;
        if (e.fuse <= 0) { 
          explodeEnemy(game, W, e); 
          return; 
        }
      } else {
        /* Đuổi theo player để nổ */
        ax = ux; ay = uy;
        if (d < e.attackRange + e.radius) {
          e.fuse = e.fuse || 0.8;
          Sound.sfx('alarm');
        }
      }
      break;
    }

    /* --- SLOW THROWER (Ném thuốc làm chậm) --- */
    case 'slow_thrower': {
      const pref = e.preferred || 220;
      if (d > pref * 1.1) { 
        ax = ux; ay = uy; 
      } else if (d < pref * .6) { 
        ax = -ux; ay = -uy; 
      } else {
        const pa = Math.atan2(dy, dx) + Math.PI / 2;
        const side = Math.sin(W.time * .5 + e.x * .01) > 0 ? 1 : -1;
        ax = Math.cos(pa) * side * .6;
        ay = Math.sin(pa) * side * .6;
      }

      e.attackTimer -= dt;
      if (e.attackTimer <= 0 && d < e.attackRange) {
        e.attackTimer = e.attackCd;
        enemyShootSpecial(W, e, 'slow');
      }
      break;
    }

    /* --- FIRE SPITTER (Phun lửa) --- */
    case 'fire_spitter': {
      const pref = e.preferred || 150;
      if (d > pref * 1.2) { 
        ax = ux; ay = uy; 
      } else if (d < pref * .5) { 
        ax = -ux; ay = -uy; 
      } else {
        ax = ux * .3; ay = uy * .3;
      }

      e.attackTimer -= dt;
      if (e.attackTimer <= 0 && d < e.attackRange) {
        e.attackTimer = e.attackCd;
        enemyShootSpecial(W, e, 'fire');
      }
      break;
    }

    /* --- ICE SPITTER (Phun băng) --- */
    case 'ice_spitter': {
      const pref = e.preferred || 200;
      if (d > pref * 1.15) { 
        ax = ux; ay = uy; 
      } else if (d < pref * .6) { 
        ax = -ux; ay = -uy; 
      } else {
        const pa = Math.atan2(dy, dx) + Math.PI / 2;
        const side = Math.sin(W.time * .55 + e.x * .01) > 0 ? 1 : -1;
        ax = Math.cos(pa) * side * .5;
        ay = Math.sin(pa) * side * .5;
      }

      e.attackTimer -= dt;
      if (e.attackTimer <= 0 && d < e.attackRange) {
        e.attackTimer = e.attackCd;
        enemyShootSpecial(W, e, 'ice');
      }
      break;
    }

    /* --- POISON BOMBER (Ném độc tạo vùng) --- */
    case 'poison_bomber': {
      const pref = e.preferred || 250;
      if (d > pref * 1.1) { 
        ax = ux; ay = uy; 
      } else if (d < pref * .7) { 
        ax = -ux; ay = -uy; 
      } else {
        const pa = Math.atan2(dy, dx) + Math.PI / 2;
        const side = Math.sin(W.time * .45 + e.x * .01) > 0 ? 1 : -1;
        ax = Math.cos(pa) * side * .5;
        ay = Math.sin(pa) * side * .5;
      }

      e.attackTimer -= dt;
      if (e.attackTimer <= 0 && d < e.attackRange) {
        e.attackTimer = e.attackCd;
        enemyShootSpecial(W, e, 'poison');
      }
      break;
    }

    case 'exploder': {
      if (e.fuse >= 0) {
        e.fuse -= dt;
        ax = 0; ay = 0;
        e.radius += dt * 8;
        if (e.fuse <= 0) { explodeEnemy(game, W, e); return; }
      } else {
        ax = ux; ay = uy;
        if (d < e.attackRange + e.radius) e.fuse = .5;
      }
      break;
    }

    case 'shield':
    default: {
      ax = ux; ay = uy;
      contactAttack(game, W, e, d, dt);
      break;
    }
  }

  /* Apply accel → velocity → position */
  e.vx += ax * speed * 6 * dt;
  e.vy += ay * speed * 6 * dt;

  const sp = Math.hypot(e.vx, e.vy);
  if (sp > speed) {
    e.vx = e.vx / sp * speed;
    e.vy = e.vy / sp * speed;
  }

  e.x += e.vx * dt;
  e.y += e.vy * dt;
  e.vx *= 1 - 3.5 * dt;
  e.vy *= 1 - 3.5 * dt;
}

/* ---------- Contact attack (dùng cho chase/assassin/shield) ---------- */
function contactAttack(game, W, e, d, dt) {
  if (e.ai === 'ranged') return;
  e.attackTimer -= dt;
  if (d < e.attackRange + e.radius && e.attackTimer <= 0) {
    e.attackTimer = e.attackCd;
    damagePlayer(game, W, e.damage, e);
  }
}

/* =========================================================
   DODGE PROJECTILES (AI né đạn đang bay tới)
   ========================================================= */
function dodgeProjectiles(W, e) {
  let threat = null;

  for (let i = 0; i < W.projectiles.length; i++) {
    const pr = W.projectiles[i];
    if (pr.owner !== 'player') continue;

    const pdx = e.x - pr.x;
    const pdy = e.y - pr.y;
    const pd = Math.hypot(pdx, pdy);
    if (pd > 170 || pd < 1) continue;

    const spd = Math.hypot(pr.vx, pr.vy) || 1;
    const dot = (pr.vx * pdx + pr.vy * pdy) / (spd * pd);
    if (dot > .9) { threat = { x: pr.vx, y: pr.vy }; break; }
  }

  if (threat) {
    const pa = Math.atan2(threat.y, threat.x) + Math.PI / 2;
    const side = Math.random() < .5 ? 1 : -1;
    e.vx += Math.cos(pa) * side * e.speed * 2.2;
    e.vy += Math.sin(pa) * side * e.speed * 2.2;
  }
}

/* =========================================================
   ENEMY SHOOT (ranged AI)
   ========================================================= */
export function enemyShoot(W, e) {
  const p = W.player;
  const a = Math.atan2(p.y - e.y, p.x - e.x) + rnd(-.06, .06);
  const spd = (e.projectileSpeed || 300) * (W.lowGravity ? .6 : 1);

  W.projectiles.push({
    x: e.x + Math.cos(a) * e.radius,
    y: e.y + Math.sin(a) * e.radius,
    vx: Math.cos(a) * spd,
    vy: Math.sin(a) * spd,
    r: 5,
    damage: e.damage,
    owner: 'enemy',
    life: 2.4,
    pierce: 0,
    splash: 0,
    color: '#ff8a5a',
    knockback: 0,
    hitSet: new Set()
  });

  Sound.sfx('shoot');
}

/* =========================================================
   ENEMY SHOOT SPECIAL (các loại đạn đặc biệt: slow, fire, ice, poison)
   ========================================================= */
export function enemyShootSpecial(W, e, type) {
  const p = W.player;
  const a = Math.atan2(p.y - e.y, p.x - e.x) + rnd(-.08, .08);
  const spd = (e.projectileSpeed || 280) * (W.lowGravity ? .6 : 1);
  
  let color = '#ffffff';
  let radius = 6;
  
  switch (type) {
    case 'slow':
      color = '#aaddff';
      radius = 7;
      break;
    case 'fire':
      color = '#ffaa00';
      radius = 6;
      break;
    case 'ice':
      color = '#00ffff';
      radius = 6;
      break;
    case 'poison':
      color = '#88ff00';
      radius = 8;
      break;
  }

  W.projectiles.push({
    x: e.x + Math.cos(a) * e.radius,
    y: e.y + Math.sin(a) * e.radius,
    vx: Math.cos(a) * spd,
    vy: Math.sin(a) * spd,
    r: radius,
    damage: e.damage || 0,
    owner: 'enemy',
    specialType: type,
    life: 3.0,
    pierce: 0,
    splash: type === 'poison' ? (e.poisonRadius || 70) : 0,
    color: color,
    knockback: 0,
    hitSet: new Set(),
    
    /* Hiệu ứng đặc biệt */
    slowDuration: type === 'slow' ? 2.5 : (type === 'ice' ? 2.0 : 0),
    slowFactor: type === 'slow' ? 0.5 : (type === 'ice' ? 0.45 : 0),
    dotDamage: type === 'fire' ? (e.dotDamage || 3) : 0,
    dotDuration: type === 'fire' ? (e.dotDuration || 2.0) : 0,
    poisonDamage: type === 'poison' ? (e.poisonDamage || 2) : 0,
    poisonDuration: type === 'poison' ? (e.poisonDuration || 4.0) : 0
  });

  Sound.sfx(type === 'poison' ? 'poison' : (type === 'fire' ? 'flame' : 'shoot'));
}

/* =========================================================
   EXPLODE (exploder tự nổ)
   ========================================================= */
export function explodeEnemy(game, W, e) {
  const R = e.blastRadius || 110;

  Fx.burst(W.particles, e.x, e.y, 22, '#ff7a2f', 380, .6, 5);
  Fx.ring(W.particles, e.x, e.y, '#ff7a2f', R, .45);
  Sound.sfx('explosion');

  if (Settings.get('shakeOn')) W.camera.shake = Math.min(12, 8);

  const p = W.player;
  if (p.alive && dist(e, p) < R + p.radius) {
    damagePlayer(game, W, e.damage, e);
  }

  /* Damage lẫn nhau giữa quái */
  for (let i = 0; i < W.enemies.length; i++) {
    const o = W.enemies[i];
    if (o === e) continue;
    if (dist(o, e) < R + o.radius) {
      damageEnemy(game, W, o, e.damage * .6, false, e, 140);
    }
  }

  e.alive = false;
  const idx = W.enemies.indexOf(e);
  if (idx >= 0) removeAt(W.enemies, idx);
  game.profile.statistics.kills++;
}

/* =========================================================
   DAMAGE ENEMY (dodge, shield, resist, lifesteal, feedback)
   ========================================================= */
export function damageEnemy(game, W, e, dmg, crit, source, knockback) {
  if (!e.alive) return;

  let final = dmg;
  if (e.dmgReduce) final *= (1 - e.dmgReduce);

  /* Shield hấp thụ trước */
  if (e.shield > 0) {
    const absorbed = Math.min(e.shield, final);
    e.shield -= absorbed;
    final -= absorbed;
  }

  e.hp -= final;
  e.hitFlash = .14;

  /* Knockback (trừ boss) */
  if (knockback && !e.isBoss && source) {
    const a = Math.atan2(e.y - source.y, e.x - source.x);
    const k = knockback * (1 - (e.knockRes || 0));
    e.kx += Math.cos(a) * k;
    e.ky += Math.sin(a) * k;
  }

  /* Lifesteal từ player */
  if (source && source.up && source.up.lifesteal > 0) {
    const heal = final * source.up.lifesteal;
    source.hp = Math.min(source.maxHp, source.hp + heal);
  }

  /* Floating text */
  FloatText.add(
    W.texts,
    e.x + rnd(-10, 10),
    e.y - e.radius - 6,
    (crit ? 'CRIT ' : '') + Math.round(final),
    crit ? '#ffc44d' : '#ffffff',
    crit ? 17 : 13
  );

  /* Particles */
  Fx.burst(
    W.particles, e.x, e.y,
    crit ? 9 : 5,
    e.color || '#ff5a6e',
    crit ? 260 : 170,
    .32,
    crit ? 4 : 3
  );

  Sound.sfx(crit ? 'crit' : 'hit');

  if (e.hp <= 0) killEnemy(game, W, e);
}

/* =========================================================
   KILL ENEMY (drop loot, particles, boss handling)
   ========================================================= */
export function killEnemy(game, W, e) {
  if (!e.alive) return;

  e.alive = false;
  const p = W.player;

  game.profile.statistics.kills++;
  p.kills++;

  /* VFX */
  Fx.burst(
    W.particles, e.x, e.y,
    e.isBoss ? 60 : 16,
    e.color,
    e.isBoss ? 500 : 280,
    e.isBoss ? 1.2 : .55,
    e.isBoss ? 6 : 3
  );
  Fx.ring(
    W.particles, e.x, e.y,
    e.color,
    e.isBoss ? 260 : 60,
    e.isBoss ? .8 : .35
  );

  Sound.sfx('enemyDeath');
  if (Settings.get('shakeOn')) {
    W.camera.shake = Math.min(14, e.isBoss ? 14 : 3.5);
  }

  /* Drops */
  const luck = 1 + (p.up.luck || 0);
  const creditVal = Math.round(e.credits * luck);
  dropLoot(W, e.x, e.y, 'credit', creditVal);
  dropLoot(W, e.x, e.y, 'xp', Math.round(e.xp * luck));

  if (Math.random() < .10 * luck) {
    dropLoot(W, e.x, e.y, 'hp', Math.round(p.maxHp * .10));
  }
  if (Math.random() < .045 * luck) {
    dropLoot(W, e.x, e.y, 'shard', 1);
  }

  /* Elite rơi chest */
  if (e.elite && Math.random() < .5) {
    spawnChest(
      W,
      e.x, e.y,
      Math.random() < .4 ? 'rare' : 'common'
    );
  }

  /* Remove khỏi mảng */
  const idx = W.enemies.indexOf(e);
  if (idx >= 0) removeAt(W.enemies, idx);

  /* Boss death */
  if (e.isBoss) {
    W.boss = null;
    game.hideBossBar && game.hideBossBar();
    if (typeof window.addToast === 'function') {
      window.addToast('☠ BOSS DEFEATED');
    }
    dropLoot(W, e.x, e.y, 'shard', 3);

    setTimeout(() => {
      if (game.onBossDefeated) game.onBossDefeated();
    }, 900);
  }

  game.checkAchievements && game.checkAchievements();
}