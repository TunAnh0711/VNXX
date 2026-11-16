/* =========================================================
   VNXX — GAME / ENEMY
   Spawn + AI + damage + death + loot.

   Hệ thống mới:
   - Status effect (burn/poison/bleed/chill/freeze/shock/weaken)
   - Armor + Poise → BREAK (choáng, nhận thêm 60% ST)
   - Affix mở rộng (volatile/frostbound/venomous/thorns/berserker/swift)
   - AI mới: charger · sniper · summoner · brute · turret · burrow
   - onDeath: split / volatile
   ========================================================= */

import { CFG, DIFFICULTIES } from '../core/constants.js';
import {
  ENEMIES, ELITE_MODS,
  applyEliteMods, eliteModNames
} from '../data/enemies.js';
import { getStage } from '../data/stages.js';
import { WEAPONS } from '../data/weapons.js';
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
import { isBossV2 } from './boss-v2.js';
import * as Status from '../systems/status.js';
import { comboOnKill, comboDmgMul, comboCreditMul } from '../systems/combo.js';
import { chargeFromDamage, chargeFromKill, isOverdrive } from './overdrive.js';

/* =========================================================
   SPAWN FROM QUEUE
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
   SPAWN ENEMY
   ========================================================= */
export function spawnEnemy(game, W, typeKey, x, y, elite = false) {
  const base = ENEMIES[typeKey];
  if (!base) return null;

  const d = DIFFICULTIES[game.profile.difficulty];
  const stageMul = 1 + (W.stage - 1) * .46;
  const waveMul = 1 + (W.wave - 1) * .12;
  const hpMul = stageMul * waveMul * d.hp * (elite ? 2.8 : 1);
  const dmgMul = stageMul * .78 * d.dmg * (elite ? 1.6 : 1);

  const maxHp = base.hp * hpMul;

  /* Độ hung hãn: tăng theo stage + wave (1.0 → 1.7) */
  const aggr = clamp(
    1 + (W.stage - 1) * .05 + (W.wave - 1) * .012,
    1, 1.7
  );

  const e = {
    type: typeKey,
    elite: !!elite,
    x, y, vx: 0, vy: 0, kx: 0, ky: 0,
    radius: base.radius * (elite ? 1.25 : 1),

    hp: maxHp,
    maxHp,

    shield: (base.shield || 0) * hpMul,
    maxShield: (base.shield || 0) * hpMul,

    speed: base.speed * d.speed * (elite ? 1.08 : 1) * (.97 + aggr * .05),
    damage: base.damage * dmgMul,
    color: base.color,
    ai: base.ai,

    attackRange: base.attackRange,
    attackCd: base.attackCd / aggr,
    aggr,
    enraged: false,
    shotCount: 0,
    attackTimer: rnd(0, .5),
    preferred: base.preferred || 0,
    projectileSpeed: base.projectileSpeed || 300,

    knockRes: base.knockRes || 0,
    xp: base.xp * (elite ? 3.2 : 1),
    credits: base.credits * (elite ? 3.5 : 1),

    /* --- Mới --- */
    armor: base.armor || 0,
    poiseMax: (base.poise || 0) * stageMul * (elite ? 1.8 : 1),
    poise: 0,
    broken: 0,
    flying: !!base.flying,
    visualArchetype: base.visualArchetype || null,
    contactStatus: null,
    thorns: 0,
    lifesteal: base.lifesteal || 0,
    onDeath: base.onDeath || null,
    splitInto: base.splitInto || null,
    splitCount: base.splitCount || 0,
    deathBlast: 0,
    berserk: false,
    evasion: 0,
    summonType: base.summonType || null,
    summonCount: base.summonCount || 0,
    summoned: [],

    /* --- Runtime --- */
    angle: Math.random() * TAU,
    hitFlash: 0,
    frozen: 0,
    slow: 0,

    regen: 0,
    teleportCd: 0,
    dashTimer: rnd(.5, 2),
    dashing: 0,
    dashDir: { x: 0, y: 0 },

    fuse: -1,

    /* trạng thái AI riêng */
    phase: 'idle',
    phaseT: 0,
    tele: null,
    aimAngle: 0,
    burrowT: 0,
    underground: false,

    state: 'chase',
    modName: null,
    alive: true,
    dodgeTimer: rnd(1, 3)
  };

  e.poise = e.poiseMax;

  if (base.shieldRegen) e.shieldRegen = base.shieldRegen;
  if (base.dashCd) e.dashCd = base.dashCd;
  if (base.dashSpeed) e.dashSpeed = base.dashSpeed;
  if (base.blastRadius) e.blastRadius = base.blastRadius;

  /* Affix */
  if (elite) {
    const n = Math.random() < .28 ? 2 : 1;
    const used = applyEliteMods(e, n);
    e.modName = eliteModNames(used);
    e.hp *= 1.6;
    e.maxHp = e.hp;
    e.xp *= 2;
    e.credits *= 2;
    if (e.poiseMax > 0) e.poise = e.poiseMax;
  }

  /* Turret đứng yên — không cần tách khỏi đám đông */
  W.enemies.push(e);
  return e;
}

/* =========================================================
   UPDATE ENEMIES
   ========================================================= */
export function updateEnemies(game, W, dt) {
  const p = W.player;

  for (let i = W.enemies.length - 1; i >= 0; i--) {
    const e = W.enemies[i];
    if (!e.alive) { removeAt(W.enemies, i); continue; }

    if (e.hitFlash > 0) e.hitFlash -= dt;
    if (e.broken > 0) {
      e.broken -= dt;
      if (e.broken <= 0) {
        e.broken = 0;
        e.poise = e.poiseMax;
      }
    }

    /* --- Status tick --- */
    const dot = Status.tickStatus(e, dt, (dmg, src) => {
      damageEnemy(game, W, e, dmg, false, src, 0, { dot: true, noStatus: true, silent: true });
    });

    /* Hiệu ứng cháy/độc nhỏ */
    if (dot > 0 && Math.random() < .35 && e.statusTint) {
      Fx.spawn(W.particles, e.x + rnd(-8, 8), e.y + rnd(-8, 8),
        0, -30, .35, 2.5, e.statusTint);
    }

    if (!e.alive) continue;

    /* --- Regen --- */
    if (e.regen > 0 && e.hp < e.maxHp) {
      e.hp = Math.min(e.maxHp, e.hp + e.regen * dt);
    }
    if (e.shieldRegen && e.shield < e.maxShield) {
      e.shield = Math.min(e.maxShield, e.shield + e.shieldRegen * dt);
    }

    /* --- Knockback --- */
    e.x += e.kx * dt;
    e.y += e.ky * dt;
    e.kx *= 1 - 8 * dt;
    e.ky *= 1 - 8 * dt;

    /* --- Boss --- */
    if (e.isBoss) {
      if (isBossV2(e)) {
        e.tick(dt, W);
        collideWithObstacles(W, e);
        e.x = clamp(e.x, e.radius, W.w - e.radius);
        e.y = clamp(e.y, e.radius, W.h - e.radius);
        continue;
      }
      game.updateBoss(e, dt);
    } else {
      const mm = Status.moveMul(e) * (e.broken > 0 ? 0 : 1);

      if (mm <= .02) {
        /* Đóng băng / vỡ giáp → trôi theo quán tính */
        applyEnemyPhysics(e, dt, .2);
      } else {
        updateEnemyAI(game, W, e, dt, mm);
      }
    }

    if (e.flying) {
      /* Bay → bỏ qua vật cản */
    } else {
      collideWithObstacles(W, e);
    }

    separateFromOthers(W, e, i);

    /* --- Đẩy quái ra khỏi player (tránh chồng lên nhau → đạn xuyên qua) --- */
    if (p.alive && !e.underground) {
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const rr = e.radius + p.radius;
      const dd = dx * dx + dy * dy;
      if (dd < rr * rr) {
        const d = Math.sqrt(dd) || .001;
        const push = (rr - d) / d;
        e.x += dx * push;
        e.y += dy * push;
      }
    }

    e.x = clamp(e.x, e.radius, W.w - e.radius);
    e.y = clamp(e.y, e.radius, W.h - e.radius);

    /* --- Contact damage --- */
    if (p.alive && !e.underground) {
      const d = dist(e, p);
      if (d < e.radius + p.radius) {
        if (e.ai === 'exploder' && e.fuse < 0) {
          e.fuse = .55;
        } else if (e.fuse < 0 && e.attackTimer <= 0) {
          e.attackTimer = e.attackCd;
          hitPlayer(game, W, e, e.damage);
        }
      }
    }
  }
}

/* =========================================================
   PHYSICS khi bị choáng
   ========================================================= */
function applyEnemyPhysics(e, dt, frictionMul) {
  e.x += (e.vx || 0) * dt;
  e.y += (e.vy || 0) * dt;
  e.vx *= 1 - 6 * dt * (frictionMul || 1);
  e.vy *= 1 - 6 * dt * (frictionMul || 1);
}

/* =========================================================
   SEPARATION
   ========================================================= */
function separateFromOthers(W, e, myIdx) {
  if (e.ai === 'turret') return;

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
      const w2 = o.isBoss || o.ai === 'turret' ? 0 : 1;
      e.x += dx * push * w1;
      e.y += dy * push * w1;
      o.x -= dx * push * w2;
      o.y -= dy * push * w2;
    }
  }
}

/* =========================================================
   AI DISPATCH
   ========================================================= */
function updateEnemyAI(game, W, e, dt, mm) {
  const p = W.player;
  if (!p.alive) return;

  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.hypot(dx, dy) || .0001;
  const ux = dx / d;
  const uy = dy / d;

  e.angle = angLerp(e.angle, Math.atan2(dy, dx), clamp(dt * 7, 0, 1));

  /* Né đạn (mọi loại trừ turret) */
  if (e.ai !== 'turret') {
    e.dodgeTimer -= dt;
    if (e.dodgeTimer <= 0) {
      e.dodgeTimer = rnd(.3, .7);
      dodgeProjectiles(W, e);
    }
  }

  let ax = 0, ay = 0;
  const speed = e.speed * mm;

  switch (e.ai) {
    /* ---------------- CHASE ---------------- */
    case 'chase': {
      ax = ux; ay = uy;
      if (d < e.attackRange + e.radius) { ax *= .15; ay *= .15; }
      contactAttack(game, W, e, d, dt);
      break;
    }

    /* ---------------- RANGED ---------------- */
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

    /* ---------------- ASSASSIN ---------------- */
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

    /* ---------------- EXPLODER ---------------- */
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

    /* ---------------- CHARGER (mới) ---------------- */
    case 'charger': {
      e.phaseT -= dt;

      if (e.phase === 'idle') {
        ax = ux * .8; ay = uy * .8;
        contactAttack(game, W, e, d, dt);
        if (d < 520 && e.phaseT <= 0) {
          e.phase = 'wind';
          e.phaseT = .55;
          e.tele = { type: 'line', prog: 0, dur: .55, angle: Math.atan2(dy, dx), len: 620 };
        }
      } else if (e.phase === 'wind') {
        ax = 0; ay = 0;
        if (e.tele) {
          e.tele.prog = 1 - Math.max(0, e.phaseT) / .55;
          e.tele.angle = Math.atan2(dy, dx);
        }
        if (e.phaseT <= 0) {
          e.phase = 'dash';
          e.phaseT = .34;
          e.dashDir = { x: ux, y: uy };
          e.tele = null;
          Sound.sfx('dash');
        }
      } else if (e.phase === 'dash') {
        e.x += e.dashDir.x * (e.dashSpeed || 780) * dt;
        e.y += e.dashDir.y * (e.dashSpeed || 780) * dt;
        if (Math.random() < .6) {
          Fx.spawn(W.particles, e.x, e.y, rnd(-40, 40), rnd(-40, 40), .3, 4, e.color);
        }
        if (d < e.radius + p.radius + 10) {
          hitPlayer(game, W, e, e.damage * 1.15);
          e.phase = 'rest';
          e.phaseT = .5;
        }
        if (e.phaseT <= 0) {
          e.phase = 'rest';
          e.phaseT = .5;
        }
      } else {
        ax = 0; ay = 0;
        if (e.phaseT <= 0) {
          /* Dash nối tiếp — càng về sau càng hung */
          if (!e._chain && Math.random() < .28 + (e.aggr || 1) * .2) {
            e._chain = true;
            e.phase = 'wind';
            e.phaseT = .34;
            e.tele = { type: 'line', prog: 0, dur: .34, angle: Math.atan2(dy, dx), len: 620 };
            Sound.sfx('charge');
          } else {
            e._chain = false;
            e.phase = 'idle';
            e.phaseT = (e.dashCd || 2.4) / (e.aggr || 1);
          }
        }
      }
      break;
    }

    /* ---------------- SNIPER (mới) ---------------- */
    case 'sniper_unit': {
      e.phaseT -= dt;
      const pref = e.preferred || 520;

      if (e.phase === 'idle') {
        if (d > pref * 1.2) { ax = ux; ay = uy; }
        else if (d < pref * .75) { ax = -ux * .8; ay = -uy * .8; }

        if (e.phaseT <= 0 && d < e.attackRange) {
          e.phase = 'aim';
          e.phaseT = .9;
          e.tele = { type: 'line', prog: 0, dur: .9, angle: Math.atan2(dy, dx), len: e.attackRange };
        }
      } else if (e.phase === 'aim') {
        ax = 0; ay = 0;
        if (e.tele) {
          e.tele.prog = 1 - Math.max(0, e.phaseT) / .9;
          e.tele.angle = Math.atan2(dy, dx);
        }
        if (e.phaseT <= 0) {
          sniperShoot(W, e);
          e.tele = null;
          e.phase = 'idle';
          e.phaseT = e.attackCd;
        }
      } else {
        ax = ux; ay = uy;
        if (e.phaseT <= 0) e.phase = 'idle';
      }
      break;
    }

    /* ---------------- SUMMONER (mới) ---------------- */
    case 'summoner': {
      const pref = e.preferred || 400;

      if (d > pref * 1.1) { ax = ux; ay = uy; }
      else if (d < pref * .65) { ax = -ux; ay = -uy; }
      else {
        const pa = Math.atan2(dy, dx) + Math.PI / 2;
        const side = Math.sin(W.time * .5 + e.y * .01) > 0 ? 1 : -1;
        ax = Math.cos(pa) * side * .6;
        ay = Math.sin(pa) * side * .6;
      }

      e.attackTimer -= dt;
      if (e.attackTimer <= 0) {
        e.attackTimer = e.attackCd;
        if (d < e.attackRange) enemyShoot(W, e);

        const alive = countMinions(W, e);
        if (alive < 6) {
          summonMinions(game, W, e);
        }
      }
      break;
    }

    /* ---------------- BRUTE (mới) ---------------- */
    case 'brute': {
      e.phaseT -= dt;

      if (e.phase === 'idle') {
        ax = ux * .9; ay = uy * .9;
        contactAttack(game, W, e, d, dt);
        if (d < (e.blastRadius || 150) * .9 && e.phaseT <= 0) {
          e.phase = 'wind';
          e.phaseT = .75 / (e.aggr || 1);
          e.tele = { type: 'circle', prog: 0, dur: e.phaseT, r: e.blastRadius || 150 };
          Sound.sfx('charge');
        }
      } else if (e.phase === 'wind') {
        ax = 0; ay = 0;
        if (e.tele) e.tele.prog = 1 - Math.max(0, e.phaseT) / (e.tele.dur || .75);
        if (e.phaseT <= 0) {
          slamAttack(game, W, e);
          e.tele = null;
          e.phase = 'rest';
          e.phaseT = .6 / (e.aggr || 1);
        }
      } else {
        ax = 0; ay = 0;
        if (e.phaseT <= 0) { e.phase = 'idle'; e.phaseT = 1.2 / (e.aggr || 1); }
      }
      break;
    }

    /* ---------------- TURRET (mới) ---------------- */
    case 'turret': {
      ax = 0; ay = 0;
      e.attackTimer -= dt;
      if (e.attackTimer <= 0 && d < e.attackRange) {
        e.attackTimer = e.attackCd;
        turretShoot(W, e);
      }
      break;
    }

    /* ---------------- BURROW (mới) ---------------- */
    case 'burrow': {
      e.phaseT -= dt;

      if (e.phase === 'idle') {
        ax = ux; ay = uy;
        contactAttack(game, W, e, d, dt);
        if (e.phaseT <= 0) {
          e.phase = 'dive';
          e.phaseT = .45 / (e.aggr || 1);
          e.tele = { type: 'circle', prog: 0, dur: e.phaseT, r: e.radius * 2.2 };
          Sound.sfx('skill');
        }
      } else if (e.phase === 'dive') {
        ax = 0; ay = 0;
        if (e.tele) e.tele.prog = 1 - Math.max(0, e.phaseT) / (e.tele.dur || .45);
        if (e.phaseT <= 0) {
          e.underground = true;
          e.phase = 'move';
          e.phaseT = .9;
          e.tele = null;
          Fx.burst(W.particles, e.x, e.y, 10, e.color, 200, .5, 4);
        }
      } else if (e.phase === 'move') {
        /* di chuyển nhanh dưới đất về phía player */
        e.x += ux * e.speed * 2.4 * dt;
        e.y += uy * e.speed * 2.4 * dt;
        if (Math.random() < .5) {
          Fx.spawn(W.particles, e.x, e.y, rnd(-20, 20), rnd(-20, 20), .3, 3, e.color);
        }
        if (e.phaseT <= 0) {
          e.phase = 'emerge';
          e.phaseT = .3;
          e.underground = false;
          emergeAttack(game, W, e);
        }
      } else {
        ax = 0; ay = 0;
        if (e.phaseT <= 0) { e.phase = 'idle'; e.phaseT = 1.6 / (e.aggr || 1); }
      }
      break;
    }

    /* ---------------- DEFAULT ---------------- */
    case 'shield':
    default: {
      ax = ux; ay = uy;
      contactAttack(game, W, e, d, dt);
      break;
    }
  }

  /* Turret không di chuyển */
  if (e.ai === 'turret') {
    e.vx = 0; e.vy = 0;
    return;
  }

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

/* =========================================================
   CONTACT ATTACK
   ========================================================= */
function contactAttack(game, W, e, d, dt) {
  if (e.ai === 'ranged' || e.ai === 'summoner' || e.ai === 'sniper_unit') return;
  e.attackTimer -= dt;
  if (d < e.attackRange + e.radius && e.attackTimer <= 0) {
    e.attackTimer = e.attackCd;
    hitPlayer(game, W, e, e.damage);
  }
}

/* =========================================================
   HIT PLAYER — áp contactStatus + lifesteal + berserk
   ========================================================= */
function hitPlayer(game, W, e, baseDmg) {
  const p = W.player;
  if (!p.alive) return;

  let dmg = baseDmg;

  /* Berserker affix — càng đau càng mạnh */
  if (e.berserk) {
    const missing = 1 - clamp(e.hp / e.maxHp, 0, 1);
    dmg *= 1 + missing * 1.4;
  }

  damagePlayer(game, W, dmg, e);

  /* Hút máu */
  if (e.lifesteal > 0) {
    e.hp = Math.min(e.maxHp, e.hp + dmg * e.lifesteal);
    if (Math.random() < .5) {
      Fx.spawn(W.particles, e.x, e.y, 0, -40, .4, 3, '#ff3b52');
    }
  }

  /* Status lên player */
  if (e.contactStatus) {
    const cs = e.contactStatus;
    Status.applyStatus(p, cs.id, cs.dur, cs.power, e);
  }
}

/* =========================================================
   DODGE PROJECTILES
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
   ENEMY SHOOT
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

/* ---------- SNIPER SHOT: đạn nhanh, xuyên 1 ---------- */
function sniperShoot(W, e) {
  const p = W.player;
  const base = Math.atan2(p.y - e.y, p.x - e.x);
  const spd = (e.projectileSpeed || 1250) * (.94 + (e.aggr || 1) * .08);

  /* Loạt bắn: 2 viên, lên stage cao / lúc nổi điên thì 3 viên */
  const shots = (e.enraged || (e.aggr || 1) > 1.3) ? 3 : 2;

  for (let k = 0; k < shots; k++) {
    const a = base + (k - (shots - 1) / 2) * .06;

    W.projectiles.push({
      x: e.x + Math.cos(a) * e.radius,
      y: e.y + Math.sin(a) * e.radius,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      r: 4,
      damage: e.damage * (k === 1 ? 1 : .78),
      owner: 'enemy',
      life: 1.6,
      pierce: 1,
      splash: 0,
      color: '#ff3b52',
      knockback: 0,
      trail: true,
      hitSet: new Set()
    });
  }

  Fx.burst(W.particles, e.x, e.y, 8, '#ff3b52', 240, .3, 3);
  Sound.sfx('sniper');
}

/* ---------- TURRET: bắn 2 viên chùm ---------- */
function turretShoot(W, e) {
  const p = W.player;
  const base = Math.atan2(p.y - e.y, p.x - e.x);
  const spd = e.projectileSpeed || 520;

  /* Cứ 3 phát → quạt rộng 7 viên */
  e.shotCount = (e.shotCount || 0) + 1;
  const fan = e.shotCount % 3 === 0;
  const from = fan ? -3 : -1;
  const to = fan ? 3 : 1;
  const step = fan ? .11 : .09;

  if (fan) Sound.sfx('skill');

  for (let k = from; k <= to; k++) {
    const a = base + k * step;
    W.projectiles.push({
      x: e.x + Math.cos(a) * e.radius,
      y: e.y + Math.sin(a) * e.radius,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      r: 4,
      damage: e.damage * (fan ? .45 : .7),
      owner: 'enemy',
      life: 2.0,
      pierce: 0,
      splash: 0,
      color: fan ? '#ff5a6e' : '#ffc44d',
      knockback: 0,
      hitSet: new Set()
    });
  }
  Sound.sfx('shoot');
}

/* =========================================================
   SUMMON MINIONS
   ========================================================= */
function countMinions(W, e) {
  let n = 0;
  for (let i = 0; i < W.enemies.length; i++) {
    if (W.enemies[i].summonerRef === e) n++;
  }
  return n;
}

function summonMinions(game, W, e) {
  const type = e.summonType || 'swarm';
  const count = e.summonCount || 3;

  Fx.ring(W.particles, e.x, e.y, e.color, 120, .5);
  Sound.sfx('event');

  for (let i = 0; i < count; i++) {
    if (W.enemies.length >= CFG.MAX_ENEMIES) break;
    const a = (i / count) * TAU + rnd(-.3, .3);
    const r = e.radius + 40;
    const m = spawnEnemy(
      game, W, type,
      e.x + Math.cos(a) * r,
      e.y + Math.sin(a) * r,
      false
    );
    if (m) {
      m.summonerRef = e;
      m.xp *= .4;
      m.credits *= .4;
      Fx.burst(W.particles, m.x, m.y, 6, e.color, 160, .4, 3);
    }
  }

  FloatText.add(W.texts, e.x, e.y - e.radius - 10, 'SUMMON!', e.color, 14);
}

/* =========================================================
   BRUTE SLAM
   ========================================================= */
function slamAttack(game, W, e) {
  const R = e.blastRadius || 150;
  const p = W.player;

  Fx.burst(W.particles, e.x, e.y, 24, '#ff7a2f', 380, .6, 5);
  Fx.ring(W.particles, e.x, e.y, '#ffc44d', R, .45);
  Sound.sfx('explosion');
  if (Settings.get('shakeOn')) W.camera.shake = Math.min(13, 9);

  if (p.alive && dist(e, p) < R + p.radius) {
    damagePlayer(game, W, e.damage * 1.2, e);
  }

  for (let i = 0; i < W.enemies.length; i++) {
    const o = W.enemies[i];
    if (o === e || !o.alive) continue;
    if (dist(o, e) < R) {
      const a = Math.atan2(o.y - e.y, o.x - e.x);
      o.kx += Math.cos(a) * 220;
      o.ky += Math.sin(a) * 220;
    }
  }

  /* Vòng xung kích — buộc player phải né tiếp */
  const ring = 10 + Math.round((e.aggr || 1) * 4);
  const spd = 250 + (e.aggr || 1) * 40;
  for (let k = 0; k < ring; k++) {
    const a = (k / ring) * TAU;
    W.projectiles.push({
      x: e.x + Math.cos(a) * (R * .55),
      y: e.y + Math.sin(a) * (R * .55),
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      r: 5,
      damage: e.damage * .45,
      owner: 'enemy',
      life: .85,
      pierce: 0,
      splash: 0,
      color: '#ff9d3d',
      knockback: 0,
      hitSet: new Set()
    });
  }
  Sound.sfx('shockwave');
}

/* =========================================================
   BURROW EMERGE
   ========================================================= */
function emergeAttack(game, W, e) {
  const R = e.radius * 3;
  const p = W.player;

  Fx.burst(W.particles, e.x, e.y, 18, e.color, 300, .5, 4);
  Fx.ring(W.particles, e.x, e.y, e.color, R, .4);
  Sound.sfx('explosion');

  if (p.alive && dist(e, p) < R + p.radius) {
    damagePlayer(game, W, e.damage, e);
    Status.applyStatus(p, 'weaken', 3, 1, e);
  }
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
    Status.applyStatus(p, 'burn', 2.4, 4, e);
  }

  for (let i = 0; i < W.enemies.length; i++) {
    const o = W.enemies[i];
    if (o === e || !o.alive) continue;
    if (dist(o, e) < R + o.radius) {
      damageEnemy(game, W, o, e.damage * .6, false, e, 140);
    }
  }

  e.alive = false;
  const idx = W.enemies.indexOf(e);
  if (idx >= 0) removeAt(W.enemies, idx);
  game.profile.statistics.kills++;
  comboOnKill(W, W.player, 1);
}

/* =========================================================
   DAMAGE ENEMY
   ========================================================= */
export function damageEnemy(game, W, e, dmg, crit, source, knockback, opts) {
  if (!e.alive) return;

  const o = opts || {};
  const p = W.player;

  let final = dmg;

  /* ---------- Element damage ---------- */
  const elementMul = o.elementDamageMul ||
    (source && source.up && source.up.elementDamageMul) || 0;
  if (elementMul) final *= (1 + elementMul);

  /* ---------- Combo / Overdrive ---------- */
  if (!o.dot) {
    if (W.combo) final *= W.combo.mult;
    if (isOverdrive(W)) final *= CFG.OVERDRIVE.dmgMul;
  }

  /* ---------- Execute ---------- */
  const execMul = (source && source.up && source.up.executeMul) || 0;
  if (execMul > 0 && e.hp / e.maxHp < .35) final *= 1 + execMul;

  /* ---------- Break bonus ---------- */
  const breakMul = (source && source.up && source.up.breakDmgMul) || 0;
  if (e.broken > 0) final *= 1 + CFG.BREAK.dmgBonus + breakMul;

  /* ---------- Armor ---------- */
  const armorPen = o.armorPen ||
    (source && source.up && source.up.armorPen) || 0;

  let reduce = e.armor || 0;
  if (armorPen > 0) reduce = Math.max(0, reduce - armorPen);
  if (reduce > 0) final *= (1 - reduce);

  /* ---------- Shield ---------- */
  if (e.shield > 0) {
    const absorbed = Math.min(e.shield, final);
    e.shield -= absorbed;
    final -= absorbed;
  }

  /* ---------- Status damage amp ---------- */
  final *= Status.damageAmp(e);

  final = Math.max(1, final);

  e.hp -= final;
  e.hitFlash = .14;

  /* ---------- ENRAGE — dưới 30% máu thì nổi điên ---------- */
  if (!e.enraged && !e.isBoss && e.hp > 0 && e.hp < e.maxHp * .3) {
    e.enraged = true;
    e.speed *= 1.22;
    e.attackCd *= .72;
    e.damage *= 1.08;
    Sound.sfx('enrage');
    Fx.ring(W.particles, e.x, e.y, '#ff3b52', e.radius * 4.2, .5);
    FloatText.add(W.texts, e.x, e.y - e.radius - 26, 'ENRAGED', '#ff3b52', 14);
  }

  /* ---------- Poise / BREAK ---------- */
  if (e.poiseMax > 0 && e.broken <= 0 && !o.dot) {
    const poiseMul = (source && source.up && source.up.poiseMul) || 0;
    e.poise -= final * (1 + poiseMul) * (crit ? 1.5 : 1);

    if (e.poise <= 0) {
      e.poise = 0;
      e.broken = CFG.BREAK.duration;
      Sound.sfx('crit');
      Fx.ring(W.particles, e.x, e.y, '#ffffff', e.radius * 3.2, .6);
      Fx.burst(W.particles, e.x, e.y, 18, '#ffffff', 340, .6, 5);
      FloatText.add(W.texts, e.x, e.y - e.radius - 22, 'BREAK!', '#ffffff', 19);
      if (Settings.get('shakeOn')) W.camera.shake = Math.min(11, 7);
    }
  }

  /* ---------- Knockback ---------- */
  if (knockback && !e.isBoss && source) {
    const a = Math.atan2(e.y - source.y, e.x - source.x);
    const k = knockback * (1 - (e.knockRes || 0)) * (e.broken > 0 ? 1.6 : 1);
    e.kx += Math.cos(a) * k;
    e.ky += Math.sin(a) * k;
  }

  /* ---------- Lifesteal ---------- */
  if (source && source.up && source.up.lifesteal > 0 && !source.noHeal) {
    const healMul = source.healMul != null ? source.healMul : 1;
    const heal = final * source.up.lifesteal * healMul;
    source.hp = Math.min(source.maxHp, source.hp + heal);
  }

  /* ---------- Thorns ---------- */
  if (e.thorns > 0 && source === p && !o.dot) {
    damagePlayer(game, W, final * e.thorns, e);
  }

  /* ---------- Overdrive charge ---------- */
  if (!o.dot && source === p) {
    chargeFromDamage(W, p, final);
  }

  /* ---------- Status application ---------- */
  if (!o.noStatus && source === p) {
    const smul = isOverdrive(W) ? CFG.OVERDRIVE.statusMul : 1;
    const pw = (p.up && p.up.statusPowerMul) || 0;
    const dm = (p.up && p.up.statusDurMul) || 0;
    const total = (1 + pw) * smul;
    const durMul = (1 + dm) * (isOverdrive(W) ? 1.4 : 1);

    /* vũ khí */
    const w = WEAPONS[source.weaponId];
    if (w && w.status) {
      if (w.status.chance == null || Math.random() < w.status.chance) {
        Status.applyStatus(e, w.status.id,
          (w.status.dur || 3) * durMul,
          (w.status.power || 1) * total, source);
      }
    }

    /* upgrade element */
    const extra = source.up && source.up.extraStatus;
    if (extra) {
      for (let i = 0; i < extra.length; i++) {
        const s = extra[i];
        if (Math.random() < s.chance) {
          Status.applyStatus(e, s.id, (s.dur || 3) * durMul, (s.power || 1) * total, source);
        }
      }
    }
  }

  /* ---------- VFX ---------- */
  if (!o.silent) {
    FloatText.add(
      W.texts,
      e.x + rnd(-10, 10),
      e.y - e.radius - 6,
      (crit ? 'CRIT ' : '') + Math.round(final),
      crit ? '#ffc44d' : (e.broken > 0 ? '#ffffff' : '#ffffff'),
      crit ? 17 : 13
    );

    Fx.burst(
      W.particles, e.x, e.y,
      crit ? 9 : 5,
      e.statusTint || e.color || '#ff5a6e',
      crit ? 260 : 170,
      .32,
      crit ? 4 : 3
    );

    Sound.sfx(crit ? 'crit' : 'hit');
  }

  if (e.hp <= 0) killEnemy(game, W, e);
}

/* =========================================================
   KILL ENEMY
   ========================================================= */
export function killEnemy(game, W, e) {
  if (!e.alive) return;

  e.alive = false;
  const p = W.player;

  game.profile.statistics.kills++;
  p.kills++;

  /* ---------- Combo / Overdrive ---------- */
  comboOnKill(W, p, 1);
  chargeFromKill(W, p);

  /* ---------- Kill heal ---------- */
  if (p.up && p.up.killHeal > 0 && !p.noHeal) {
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * p.up.killHeal);
  }

  /* ---------- VFX ---------- */
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

  /* ---------- Drops ---------- */
  const luck = 1 + (p.up.luck || 0);
  const creditVal = Math.round(e.credits * luck * comboCreditMul(W));
  dropLoot(W, e.x, e.y, 'credit', creditVal);
  dropLoot(W, e.x, e.y, 'xp', Math.round(e.xp * luck));

  if (Math.random() < .10 * luck) {
    dropLoot(W, e.x, e.y, 'hp', Math.round(p.maxHp * .10));
  }
  if (Math.random() < .045 * luck) {
    dropLoot(W, e.x, e.y, 'shard', 1);
  }

  if (e.elite && Math.random() < .5) {
    spawnChest(W, e.x, e.y, Math.random() < .4 ? 'rare' : 'common');
  }

  /* ---------- onDeath behaviors ---------- */
  if (e.onDeath === 'split' && e.splitInto && !e._splitDone) {
    e._splitDone = true;
    const n = e.splitCount || 3;
    for (let i = 0; i < n; i++) {
      if (W.enemies.length >= CFG.MAX_ENEMIES) break;
      const a = (i / n) * TAU;
      const m = spawnEnemy(game, W, e.splitInto,
        e.x + Math.cos(a) * e.radius * 1.4,
        e.y + Math.sin(a) * e.radius * 1.4, false);
      if (m) {
        m.hp = m.maxHp * .8;
        Fx.burst(W.particles, m.x, m.y, 5, e.color, 160, .35, 3);
      }
    }
    FloatText.add(W.texts, e.x, e.y - 30, 'SPLIT!', e.color, 15);
  }

  if (e.onDeath === 'volatile' && e.deathBlast > 0) {
    const R = e.deathBlast;
    Fx.ring(W.particles, e.x, e.y, '#ff7a2f', R, .45);
    Fx.burst(W.particles, e.x, e.y, 20, '#ff7a2f', 340, .55, 5);
    Sound.sfx('explosion');

    if (p.alive && dist(e, p) < R + p.radius) {
      damagePlayer(game, W, e.damage * .8, e);
      Status.applyStatus(p, 'burn', 2.2, 4, e);
    }
    for (let i = 0; i < W.enemies.length; i++) {
      const o = W.enemies[i];
      if (o === e || !o.alive) continue;
      if (dist(o, e) < R) damageEnemy(game, W, o, e.damage * .5, false, e, 120);
    }
  }

  /* ---------- Remove ---------- */
  const idx = W.enemies.indexOf(e);
  if (idx >= 0) removeAt(W.enemies, idx);

  /* ---------- Boss ---------- */
  if (e.isBoss) {
    W.boss = null;
    game.hideBossBar && game.hideBossBar();
    if (typeof window.addToast === 'function') {
      window.addToast('☠ BOSS DEFEATED');
    }
    dropLoot(W, e.x, e.y, 'shard', 3);

    import('./boss-summon.js').then(({ cleanupBossMinions }) => {
      cleanupBossMinions(W);
    }).catch(() => {});

    setTimeout(() => {
      if (game.onBossDefeated) game.onBossDefeated();
    }, 900);
  }

  game.checkAchievements && game.checkAchievements();
}
