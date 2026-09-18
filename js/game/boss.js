/* =========================================================
   VNXX — GAME / BOSS
   Spawn + AI + 4 ability patterns (spread/ring/dash/summon).
   Nhận `game` và `W` làm tham số → không import Game.
   ========================================================= */

import { DIFFICULTIES } from '../core/constants.js';
import {
  BOSSES, BOSS_PATTERNS, BOSS_TIMING,
  getBoss, getBossPattern, getBossPhase, shouldEnrage
} from '../data/bosses.js';
import { getStage } from '../data/stages.js';
import {
  clamp, dist, angLerp, rnd, pick, TAU
} from '../core/utils.js';
import Settings from '../core/settings.js';
import Sound from '../systems/sound.js';
import { Fx } from '../systems/fx.js';
import { spawnEnemy } from './enemy.js';
import { damagePlayer } from './player.js';

/* =========================================================
   SPAWN BOSS
   ========================================================= */
export function spawnBoss(game, W, bossName) {
  const B = getBoss(bossName);
  if (!B) {
    console.warn('[Boss] unknown boss:', bossName);
    return null;
  }

  const d = DIFFICULTIES[game.profile.difficulty];
  const hpMul = (1 + (W.stage - 1) * .55) * d.hp;

  /* Spawn phía trên player, clamp trong map */
  const spawnX = W.player.x;
  const spawnY = clamp(W.player.y - 520, 120, W.h - 120);

  const b = {
    isBoss: true,
    name: B.name,

    /* Vị trí / vật lý */
    x: spawnX,
    y: spawnY,
    vx: 0, vy: 0,
    kx: 0, ky: 0,
    radius: B.radius,

    /* HP / shield */
    hp: B.hp * hpMul,
    maxHp: B.hp * hpMul,
    shield: 0,
    maxShield: 0,

    /* Stats */
    speed: B.speed,
    damage: 26 * d.dmg,
    color: B.color,
    ai: 'boss',

    /* Phase state */
    phase: 1,
    enraged: false,
    patterns: B.phases,
    enragePatterns: B.enrage,

    /* Ability cycle */
    abilityTimer: BOSS_TIMING.abilityBaseCd,
    ability: null,
    abilityCd: 0,

    /* Attack */
    attackTimer: 0,
    attackCd: 1.4,

    /* Rewards */
    xp: B.xp,
    credits: B.credits,

    /* Visual / state */
    angle: 0,
    hitFlash: 0,
    frozen: 0,
    slow: 0,
    spawnAnim: BOSS_TIMING.spawnAnim,
    telegraph: 0,
    telegraphType: null,

    /* Effects (không dùng, để default) */
    regen: 0,
    dmgReduce: 0,
    lifesteal: 0,
    teleportCd: 0,

    /* Knockback resistance */
    knockRes: 1,

    /* Dash state */
    dashTimer: 0,
    dashing: 0,
    dashDir: { x: 0, y: 0 },

    /* Misc */
    summonCount: 0,
    alive: true,
    elite: false,
    type: 'boss',
    modName: null
  };

  W.enemies.push(b);
  W.boss = b;

  Sound.sfx('boss');
  if (typeof window.addToast === 'function') {
    window.addToast('⚠ BOSS: ' + B.name);
  }
  return b;
}

/* =========================================================
   UPDATE BOSS (mỗi frame)
   ========================================================= */
export function updateBoss(game, W, b, dt) {
  const p = W.player;
  if (!p) return;

  const dx = p.x - b.x;
  const dy = p.y - b.y;
  const d = Math.hypot(dx, dy) || .0001;
  const ux = dx / d;
  const uy = dy / d;

  /* Luôn nhìn về player (chậm) */
  b.angle = angLerp(b.angle, Math.atan2(dy, dx), clamp(dt * 3, 0, 1));

  /* --- Spawn animation --- */
  if (b.spawnAnim > 0) {
    b.spawnAnim -= dt;
    b.vx = 0;
    b.vy = 0;
    return;
  }

  /* --- Phase check --- */
  updatePhase(game, W, b);

  /* --- Enrage check --- */
  updateEnrage(game, W, b);

  /* --- Telegraph (đang báo trước khi đổi phase) --- */
  if (b.telegraph > 0) {
    b.telegraph -= dt;
    return;
  }

  /* --- Movement --- */
  updateBossMovement(W, b, ux, uy, d, dt);

  /* --- Ability cycle --- */
  b.abilityTimer -= dt;
  if (b.abilityTimer <= 0) {
    const patterns = b.enraged ? b.enragePatterns : b.patterns;
    const key = pick(patterns);
    bossAbility(game, W, b, key, ux, uy);

    const baseCd = b.enraged
      ? BOSS_TIMING.abilityEnragedCd
      : BOSS_TIMING.abilityBaseCd;
    b.abilityTimer = baseCd + rnd(0, BOSS_TIMING.abilityJitter);
  }

  /* --- Contact damage --- */
  if (p.alive && d < b.radius + p.radius + 6) {
    damagePlayer(game, W, b.damage * .7, b);
  }
}

/* =========================================================
   PHASE / ENRAGE CHECKS
   ========================================================= */
function updatePhase(game, W, b) {
  const newPhase = getBossPhase(b.hp, b.maxHp);
  if (newPhase === b.phase) return;

  b.phase = newPhase;
  b.telegraph = BOSS_TIMING.telegraphDur;
  b.telegraphType = 'PHASE ' + newPhase;

  if (typeof window.addToast === 'function') {
    window.addToast('⚠ BOSS PHASE ' + newPhase);
  }
  Sound.sfx('warning');
  Fx.ring(W.particles, b.x, b.y, '#ff3b52', 260, .7);
  if (Settings.get('shakeOn')) W.camera.shake = 12;
}

function updateEnrage(game, W, b) {
  if (b.enraged) return;
  if (!shouldEnrage(b.hp, b.maxHp)) return;

  b.enraged = true;
  b.speed *= 1.3;

  if (typeof window.addToast === 'function') {
    window.addToast('⚠ ENRAGED!');
  }
  Sound.sfx('boss');
  Fx.ring(W.particles, b.x, b.y, '#ff3b52', 340, .9);
}

/* =========================================================
   MOVEMENT (orbit quanh player, giữ khoảng cách)
   ========================================================= */
function updateBossMovement(W, b, ux, uy, d, dt) {
  const pref = 210;

  /* Đang dash: bay thẳng, không accel */
  if (b.dashing > 0) {
    b.dashing -= dt;
    const dashSpd = getBossPattern('dash')?.dashSpeed || 680;
    b.x += b.dashDir.x * dashSpd * dt;
    b.y += b.dashDir.y * dashSpd * dt;

    if (Math.random() < .7) {
      Fx.spawn(
        W.particles,
        b.x, b.y,
        rnd(-60, 60), rnd(-60, 60),
        .4, 6, b.color
      );
    }
    return;
  }

  /* Chọn hướng di chuyển */
  let ax = 0, ay = 0;

  if (d > pref * 1.2) { ax = ux; ay = uy; }
  else if (d < pref * .7) { ax = -ux; ay = -uy; }
  else {
    /* Orbit quanh player */
    const pa = Math.atan2(uy, ux) + Math.PI / 2;
    const side = Math.sin(W.time * .5) > 0 ? 1 : -1;
    ax = Math.cos(pa) * side * .6;
    ay = Math.sin(pa) * side * .6;
  }

  b.vx += ax * b.speed * 5 * dt;
  b.vy += ay * b.speed * 5 * dt;

  const sp = Math.hypot(b.vx, b.vy);
  if (sp > b.speed) {
    b.vx = b.vx / sp * b.speed;
    b.vy = b.vy / sp * b.speed;
  }

  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.vx *= 1 - 3 * dt;
  b.vy *= 1 - 3 * dt;
}

/* =========================================================
   BOSS ABILITY (dispatch theo pattern)
   ========================================================= */
export function bossAbility(game, W, b, key, ux, uy) {
  switch (key) {
    case 'spread': patternSpread(W, b); break;
    case 'ring':   patternRing(W, b);   break;
    case 'dash':   patternDash(W, b, ux, uy); break;
    case 'summon': patternSummon(game, W, b); break;
  }
}

/* ---------- SPREAD: bắn hình quạt ---------- */
function patternSpread(W, b) {
  const P = getBossPattern('spread');
  const n = b.enraged ? P.bulletCount.enraged : P.bulletCount.normal;
  const spd = P.bulletSpeed * (W.lowGravity ? .6 : 1);
  const arc = P.spreadArc;

  for (let i = 0; i < n; i++) {
    const a = b.angle + (i / (n - 1) - .5) * arc;
    W.projectiles.push({
      x: b.x + Math.cos(a) * b.radius,
      y: b.y + Math.sin(a) * b.radius,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      r: P.bulletRadius,
      damage: b.damage * P.damageMul,
      owner: 'enemy',
      life: P.projectileLife,
      pierce: 0, splash: 0, knockback: 0,
      color: P.color,
      hitSet: new Set()
    });
  }

  Sound.sfx(P.sfx);
  Fx.ring(W.particles, b.x, b.y, P.color, b.radius + 30, .3);
}

/* ---------- RING: bắn toả 360° ---------- */
function patternRing(W, b) {
  const P = getBossPattern('ring');
  const n = b.enraged ? P.bulletCount.enraged : P.bulletCount.normal;
  const spd = P.bulletSpeed * (W.lowGravity ? .6 : 1);

  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    W.projectiles.push({
      x: b.x + Math.cos(a) * b.radius,
      y: b.y + Math.sin(a) * b.radius,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      r: P.bulletRadius,
      damage: b.damage * P.damageMul,
      owner: 'enemy',
      life: P.projectileLife,
      pierce: 0, splash: 0, knockback: 0,
      color: P.color,
      hitSet: new Set()
    });
  }

  Sound.sfx(P.sfx);
  Fx.ring(W.particles, b.x, b.y, P.color, 200, .5);
  if (Settings.get('shakeOn')) W.camera.shake = 8;
}

/* ---------- DASH: lao tới player ---------- */
function patternDash(W, b, ux, uy) {
  const P = getBossPattern('dash');
  b.dashing = P.dashDuration;
  b.dashDir = { x: ux, y: uy };
  /* Ghi đè abilityTimer để boss không spam 2 ability liên tiếp */
  b.abilityTimer = P.cooldownAfter;

  Sound.sfx(P.sfx);
  Fx.ring(W.particles, b.x, b.y, P.color, 150, .4);
}

/* ---------- SUMMON: triệu hồi quái ---------- */
function patternSummon(game, W, b) {
  const P = getBossPattern('summon');
  const n = b.enraged ? P.count.enraged : P.count.normal;
  const pool = getStage(W.stage).pool;

  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const ex = b.x + Math.cos(a) * P.radius;
    const ey = b.y + Math.sin(a) * P.radius;
    const type = pick(pool);

    spawnEnemy(game, W, type, ex, ey, false);
    Fx.ring(W.particles, ex, ey, P.color, 70, .4);
  }

  if (typeof window.addToast === 'function') {
    window.addToast('⚠ BOSS TRIỆU HỒI QUÁI');
  }
  Sound.sfx(P.sfx);
}