/* =========================================================
   VNXX — GAME / PLAYER
   Update player: movement, dash, aim, attack, buffs, damage.
   SPACE = tương tác (mở rương) — KHÔNG tấn công
   ========================================================= */

import { CFG } from '../core/constants.js';
import Input from '../core/input.js';
import Settings from '../core/settings.js';
import { clamp, angLerp, dist, rnd, TAU } from '../core/utils.js';
import { WEAPONS } from '../data/weapons.js';
import { CONSUMABLES, consume } from '../data/consumables.js';
import Sound from '../systems/sound.js';
import { Fx, FloatText } from '../systems/fx.js';
import { collideWithObstacles } from './world.js';

/* =========================================================
   UPDATE PLAYER (mỗi frame)
   ========================================================= */
export function updatePlayer(game, W, dt) {
  const p = W.player;
  if (!p.alive) return;

  updateBuffs(p, dt);
  updateMovement(W, p, dt);
  updateAim(game, W, p, dt);
  updateTimers(p, dt);
  handleInput(game, W, p, dt);
  updateChargeVisual(W, p, dt);
  updateChestPrompt(W, p);
}

/* =========================================================
   BUFFS
   ========================================================= */
function updateBuffs(p, dt) {
  const b = p.buffs;
  if (b.dmg > 0)     b.dmg     = Math.max(0, b.dmg - dt);
  if (b.shield > 0)  b.shield  = Math.max(0, b.shield - dt);
  if (b.berserk > 0) b.berserk = Math.max(0, b.berserk - dt);
  
  /* Xử lý các debuff đặc biệt */
  if (b.slow > 0) {
    b.slow -= dt;
    if (b.slow <= 0) {
      b.slow = 0;
      p.slowFactor = 1;
    }
  }
  
  if (b.burn > 0) {
    b.burn -= dt;
    /* Gây damage burn mỗi giây */
    if (p.burnDamage && p.burnDamage > 0) {
      p.hp -= p.burnDamage * dt;
      if (p.hp <= 0) p.alive = false;
    }
    if (b.burn <= 0) {
      b.burn = 0;
      p.burnDamage = 0;
    }
  }
  
  if (b.poisoned > 0) {
    b.poisoned -= dt;
    /* Gây damage poison mỗi giây */
    if (p.poisonDamage && p.poisonDamage > 0) {
      p.hp -= p.poisonDamage * dt;
      if (p.hp <= 0) p.alive = false;
    }
    if (b.poisoned <= 0) {
      b.poisoned = 0;
      p.poisonDamage = 0;
    }
  }
  
  if (b.frozen > 0) {
    b.frozen -= dt;
    if (b.frozen <= 0) {
      b.frozen = 0;
    }
  }

  if (b.shield > 0) p.shield = Math.max(0, 60 * (b.shield / 25));
  else p.shield = 0;
}

/* =========================================================
   MOVEMENT
   ========================================================= */
function updateMovement(W, p, dt) {
  const mv = Input.moveVector();
  const berserk = p.buffs.berserk > 0 ? 1.3 : 1;
  const targetSpeed = p.speed * berserk;

  /* Đang charge railgun → giảm tốc 50% */
  const chargeSlow = p.charging ? 0.5 : 1;
  
  /* Slow debuff */
  const slowFactor = p.slowFactor && p.buffs.slow > 0 ? p.slowFactor : 1;
  
  const finalSpeed = targetSpeed * chargeSlow * slowFactor;

  if (p.dashTime > 0) {
    p.dashTime -= dt;
    p.x += p.dashDir.x * CFG.PLAYER.dashSpeed * dt;
    p.y += p.dashDir.y * CFG.PLAYER.dashSpeed * dt;

    if (Math.random() < .6) {
      Fx.spawn(W.particles, p.x, p.y,
        rnd(-40, 40), rnd(-40, 40), .32, 4, '#28e0ff');
    }
  } else {
    p.vx += mv.x * CFG.PLAYER.accel * berserk * finalSpeed / targetSpeed * dt;
    p.vy += mv.y * CFG.PLAYER.accel * berserk * finalSpeed / targetSpeed * dt;

    const fr = CFG.PLAYER.friction * (mv.x === 0 && mv.y === 0 ? 1.6 : 1);
    p.vx -= p.vx * fr * dt;
    p.vy -= p.vy * fr * dt;

    const sp = Math.hypot(p.vx, p.vy);
    const maxSp = finalSpeed;
    if (sp > maxSp) {
      p.vx = p.vx / sp * maxSp;
      p.vy = p.vy / sp * maxSp;
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }

  p.moveAnim += Math.hypot(p.vx, p.vy) * dt * .05;

  collideWithObstacles(W, p);
  p.x = clamp(p.x, p.radius, W.w - p.radius);
  p.y = clamp(p.y, p.radius, W.h - p.radius);
}

/* =========================================================
   AIM
   ========================================================= */
function updateAim(game, W, p, dt) {
  const Canvas2D = window.VNXX?.Canvas2D;
  if (!Canvas2D || typeof Canvas2D.screenToWorld !== 'function') return;

  const world = Canvas2D.screenToWorld(Input.mouse.x, Input.mouse.y);
  Input.mouse.wx = world.x;
  Input.mouse.wy = world.y;

  const aimA = Math.atan2(world.y - p.y, world.x - p.x);
  p.angle = angLerp(p.angle, aimA, clamp(dt * 18, 0, 1));
}

/* =========================================================
   TIMERS
   ========================================================= */
function updateTimers(p, dt) {
  if (p.cooldown > 0)   p.cooldown   -= dt;
  if (p.dashCd > 0)     p.dashCd     -= dt;
  if (p.invuln > 0)     p.invuln     -= dt;
  if (p.hitFlash > 0)   p.hitFlash   -= dt;
  if (p.attackAnim > 0) p.attackAnim -= dt;
}

/* =========================================================
   INPUT ACTIONS
   - Chuột trái (giữ)        → tấn công liên tục
   - Nút 🔥 mobile (giữ)     → tấn công
   - SPACE                    → CHỈ tương tác (mở rương)
   - Nút ✋ mobile (tap)     → CHỈ tương tác (mở rương)
   - Railgun (w.charge > 0)  → giữ chuột để charge, nhả để bắn
   ========================================================= */
function handleInput(game, W, p, dt) {
  const w = WEAPONS[p.weaponId];
  if (!w) return;

  /* ===== TƯƠNG TÁC (SPACE hoặc nút ✋ mobile) ===== */
  const wantInteract =
    Input.isDown(' ') ||
    (Input.mobile && Input.mobile.interact);

  if (wantInteract) {
    /* Consume tap của mobile (1 lần) */
    if (Input.mobile && Input.mobile.interact) {
      Input.mobile.interact = false;
    }

    const chest = getNearbyChest(W, p);
    if (chest && !chest.open) {
      game.openChest(chest);
    }
    /* Không có rương gần → không làm gì (không attack) */
    return;
  }

  /* ===== TẤN CÔNG (chuột trái hoặc nút 🔥 mobile) ===== */
  const holding =
    Input.mouse.down ||
    (Input.mobile && Input.mobile.attack);

  if (!holding) {
    /* Không giữ nút tấn công → nếu đang charge railgun thì nhả ra */
    if (p.charging) {
      if (p.chargeTime >= w.charge) {
        fireRailgun(game, W, p, w);
      } else {
        if (typeof window.addToast === 'function' && p.chargeTime > 0.15) {
          window.addToast('⚡ CHƯA ĐẦY NĂNG LƯỢNG');
        }
      }
      p.charging = false;
      p.chargeTime = 0;
      p._chargeReady = false;
    }
    return;
  }

  /* ============ VŨ KHÍ CHARGE (railgun) ============ */
  if (w.charge > 0) {
    if (!p.charging) {
      p.charging = true;
      p.chargeTime = 0;
      p._chargeReady = false;
      Sound.sfx('dash');
    }
    p.chargeTime += dt;
    if (p.chargeTime > w.charge) p.chargeTime = w.charge;
    return;
  }

  /* ============ VŨ KHÍ THƯỜNG ============ */
  playerAttack(game, W, p);
}

/* =========================================================
   CHARGE VISUAL
   ========================================================= */
function updateChargeVisual(W, p, dt) {
  if (!p.charging) return;

  const w = WEAPONS[p.weaponId];
  if (!w || !w.charge) return;

  const progress = Math.min(1, p.chargeTime / w.charge);

  if (Math.random() < 0.8) {
    const a = Math.random() * Math.PI * 2;
    const r = 120 + Math.random() * 80;
    const px = p.x + Math.cos(a) * r;
    const py = p.y + Math.sin(a) * r;

    const spd = 500 + progress * 400;
    Fx.spawn(
      W.particles,
      px, py,
      -Math.cos(a) * spd,
      -Math.sin(a) * spd,
      0.5, 2 + progress * 2,
      progress >= 1 ? '#ffc44d' : '#28e0ff'
    );
  }

  if (progress >= 1 && !p._chargeReady) {
    p._chargeReady = true;
    Sound.sfx('levelup');
    Fx.ring(W.particles, p.x, p.y, '#ffc44d', 100, 0.5);
    if (typeof window.addToast === 'function') {
      window.addToast('⚡ RAILGUN READY — NHẢ CHUỘT ĐỂ BẮN');
    }
  }
  if (progress < 1) p._chargeReady = false;

  if (progress >= 1 && Math.random() < 0.3) {
    Fx.spawn(
      W.particles,
      p.x + (Math.random() - 0.5) * 30,
      p.y + (Math.random() - 0.5) * 30,
      0, 0, 0.4, 5, '#ffc44d'
    );
  }
}

/* =========================================================
   FIRE RAILGUN
   ========================================================= */
function fireRailgun(game, W, p, w) {
  const dirX = Math.cos(p.angle);
  const dirY = Math.sin(p.angle);

  const range = w.range * (1 + p.up.rangeMul);
  const halfWidth = w.beamWidth || 12;

  const dmgBase = w.damage * w.chargeDamageMul * (1 + p.up.damageMul);
  const critC = w.critChance + (p.up.critChance || 0);
  const critM = w.critMul + (p.up.critMul || 0);

  let hitCount = 0;

  for (let i = 0; i < W.enemies.length; i++) {
    const e = W.enemies[i];
    if (!e.alive) continue;

    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const proj = dx * dirX + dy * dirY;

    if (proj < 0 || proj > range) continue;

    const perpX = dx - dirX * proj;
    const perpY = dy - dirY * proj;
    const perpDist = Math.hypot(perpX, perpY);

    if (perpDist < halfWidth + e.radius) {
      const crit = Math.random() < critC;
      const dmg = dmgBase * (crit ? critM : 1);
      game.damageEnemy(e, dmg, crit, p, w.knockback);
      hitCount++;
    }
  }

  const recoil = w.recoil || 1200;
  p.vx -= dirX * recoil;
  p.vy -= dirY * recoil;

  const smokeCount = 24;
  for (let i = 0; i < smokeCount; i++) {
    const a = p.angle + Math.PI + (Math.random() - 0.5) * 1.2;
    const spd = 120 + Math.random() * 300;

    Fx.spawn(
      W.particles,
      p.x + (Math.random() - 0.5) * 20,
      p.y + (Math.random() - 0.5) * 20,
      Math.cos(a) * spd,
      Math.sin(a) * spd,
      0.5 + Math.random() * 0.4,
      3 + Math.random() * 5,
      '#9aa8b8'
    );
  }

  for (let i = 0; i < 8; i++) {
    const a = p.angle + (Math.random() - 0.5) * 0.6;
    const spd = 200 + Math.random() * 200;
    Fx.spawn(
      W.particles,
      p.x + dirX * 26, p.y + dirY * 26,
      Math.cos(a) * spd, Math.sin(a) * spd,
      0.25, 3 + Math.random() * 3,
      '#ffc44d'
    );
  }

  const endX = p.x + dirX * range;
  const endY = p.y + dirY * range;

  W.beams.push({
    x1: p.x, y1: p.y,
    x2: endX, y2: endY,
    width: halfWidth,
    color: '#28e0ff',
    coreColor: '#eafcff',
    life: w.beamDuration || .35,
    maxLife: w.beamDuration || .35
  });

  Fx.ring(W.particles, p.x + dirX * 24, p.y + dirY * 24, '#28e0ff', 60, .3);
  Fx.ring(W.particles, endX, endY, '#28e0ff', 100, .4);

  p.attackAnim = .35;
  p.invuln = Math.max(p.invuln, .25);
  W.camera.shake = 18;
  Sound.sfx('sniper');
  Sound.sfx('explosion');

  if (typeof window.addToast === 'function' && hitCount > 0) {
    window.addToast('⚡ RAILGUN XUYÊN ' + hitCount + ' MỤC TIÊU');
  }
}

/* =========================================================
   UPDATE BEAMS
   ========================================================= */
export function updateBeams(W, dt) {
  if (!W.beams) return;
  for (let i = W.beams.length - 1; i >= 0; i--) {
    const b = W.beams[i];
    b.life -= dt;
    if (b.life <= 0) {
      W.beams.splice(i, 1);
    }
  }
}

/* =========================================================
   CHEST PROMPT UI
   ========================================================= */
function updateChestPrompt(W, p) {
  const prompt = document.getElementById('interactPrompt');
  if (!prompt) return;

  if (p.charging) {
    prompt.classList.remove('on');
    return;
  }

  const chest = getNearbyChest(W, p);
  if (chest && !chest.open) {
    prompt.classList.add('on');
    prompt.textContent = '[ SPACE ] MỞ RƯƠNG — ' + chest.rarity.toUpperCase();
  } else {
    prompt.classList.remove('on');
  }
}

/* =========================================================
   FIND NEAREST CHEST
   ========================================================= */
export function getNearbyChest(W, p) {
  let best = null;
  let bd = CFG.PLAYER.interactRange;
  for (let i = 0; i < W.chests.length; i++) {
    const c = W.chests[i];
    if (c.open) continue;
    const d = dist(c, p);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

/* =========================================================
   ATTACK
   ========================================================= */
export function playerAttack(game, W, p) {
  if (p.cooldown > 0) return;

  const w = WEAPONS[p.weaponId];
  if (!w) return;

  if (w.charge > 0) return;

  const berserk = p.buffs.berserk > 0 ? .55 : 1;
  const cd = 1 / (w.fireRate * (1 + p.up.attackSpeedMul) * berserk);

  p.cooldown = cd;
  p.attackAnim = .16;

  const dmgBase = w.damage * (1 + p.up.damageMul) *
    (p.buffs.dmg > 0 ? 1.6 : 1);
  const range = w.range * (1 + p.up.rangeMul);
  const critC = w.critChance + (p.up.critChance || 0);
  const critM = w.critMul + (p.up.critMul || 0);

  if (w.type === 'melee') {
    meleeAttack(game, W, p, w, dmgBase, range, critC, critM);
  } else {
    rangedAttack(game, W, p, w, dmgBase, critC, critM);
  }
}

/* ---------- MELEE ---------- */
function meleeAttack(game, W, p, w, dmgBase, range, critC, critM) {
  Sound.sfx('attack');

  const half = w.spread;
  let hitAny = false;

  for (let i = 0; i < W.enemies.length; i++) {
    const e = W.enemies[i];
    const d = dist(e, p);
    if (d > range + e.radius) continue;

    const a = Math.atan2(e.y - p.y, e.x - p.x);
    let diff = Math.abs(((a - p.angle + Math.PI) % TAU) - Math.PI);
    if (diff <= half) {
      const crit = Math.random() < critC;
      const dmg = dmgBase * (crit ? critM : 1);
      game.damageEnemy(e, dmg, crit, p, w.knockback);
      hitAny = true;
    }
  }

  Fx.ring(
    W.particles,
    p.x + Math.cos(p.angle) * 40,
    p.y + Math.sin(p.angle) * 40,
    '#28e0ff',
    range * .8,
    .22
  );

  if (hitAny && Settings.get('shakeOn')) {
    W.camera.shake = Math.min(10, 4);
  }

  p.vx -= Math.cos(p.angle) * 40;
  p.vy -= Math.sin(p.angle) * 40;
}

/* ---------- RANGED ---------- */
function rangedAttack(game, W, p, w, dmgBase, critC, critM) {
  const id = w.id;
  const snd = id === 'shotgun' ? 'shotgun' : (id === 'sniper' ? 'sniper' : 'shoot');
  Sound.sfx(snd);

  const count = w.projectileCount;
  const spd = w.projectileSpeed *
    (1 + p.up.rangeMul * .4) *
    (W.lowGravity ? .6 : 1);

  for (let i = 0; i < count; i++) {
    const spreadA = (count > 1
      ? (i / (count - 1) - .5) * 2 * w.spread
      : 0)
      + (Math.random() - .5) * w.spread * .5;

    const a = p.angle + spreadA;
    const crit = Math.random() < critC;
    const dmg = dmgBase * (crit ? critM : 1);

    W.projectiles.push({
      x: p.x + Math.cos(a) * 22,
      y: p.y + Math.sin(a) * 22,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      r: id === 'rocket' ? 7 : (id === 'plasma' ? 9 : 4),
      damage: dmg,
      owner: 'player',
      life: w.range / spd + .15,
      pierce: w.penetration,
      splash: w.splash,
      crit,
      knockback: w.knockback,
      color: crit
        ? '#ffc44d'
        : (w.rarity === 'mythic' ? '#ff5ad0' : '#28e0ff'),
      hitSet: new Set(),
      trail: id === 'sniper',
      weaponId: id,
      size: w.splash > 0 ? 1.4 : 1
    });
  }

  p.vx -= Math.cos(p.angle) * w.knockback * .35;
  p.vy -= Math.sin(p.angle) * w.knockback * .35;

  if (Settings.get('shakeOn')) {
    const shake = id === 'sniper' ? 7 : (id === 'rocket' ? 6 : 2.4);
    W.camera.shake = Math.min(9, shake);
  }

  Fx.burst(
    W.particles,
    p.x + Math.cos(p.angle) * 24,
    p.y + Math.sin(p.angle) * 24,
    3, '#9ff2ff', 160, .18, 3
  );
}

/* =========================================================
   DAMAGE PLAYER
   ========================================================= */
export function damagePlayer(game, W, dmg, source) {
  const p = W.player;
  if (!p.alive || p.invuln > 0 || game.godMode) return;

  if (Math.random() < p.up.dodge) {
    FloatText.add(W.texts, p.x, p.y - 30, 'DODGE', '#39ff9e', 14);
    return;
  }

  let final = dmg * (1 - p.up.armor);

  if (p.shield > 0) {
    const ab = Math.min(p.shield, final);
    p.shield -= ab;
    final -= ab;
  }

  final = Math.max(1, final);
  p.hp -= final;
  p.invuln = CFG.PLAYER.iframeHit;
  p.hitFlash = .22;

  if (p.charging) {
    p.charging = false;
    p.chargeTime = 0;
    p._chargeReady = false;
  }

  if (Settings.get('shakeOn')) {
    W.camera.shake = Math.min(10, 4 + final * .12);
  }

  FloatText.add(W.texts, p.x, p.y - 34, '-' + Math.round(final), '#ff5a6e', 15);
  Fx.burst(W.particles, p.x, p.y, 7, '#ff3b52', 200, .35, 3.5);
  Sound.sfx('playerHit');

  if (p.hp <= 0) {
    p.hp = 0;
    game.onPlayerDeath();
  }
}

/* =========================================================
   DASH
   ========================================================= */
export function doDash(game, W) {
  const p = W.player;
  if (p.dashCd > 0) return;

  const mv = Input.moveVector();
  let dx = mv.x;
  let dy = mv.y;

  if (dx === 0 && dy === 0) {
    dx = Math.cos(p.angle);
    dy = Math.sin(p.angle);
  }

  const l = Math.hypot(dx, dy) || 1;
  p.dashDir = { x: dx / l, y: dy / l };
  p.dashTime = CFG.PLAYER.dashTime;
  p.dashCd = CFG.PLAYER.dashCd;
  p.invuln = Math.max(p.invuln, CFG.PLAYER.dashTime + .15);

  if (p.charging) {
    p.charging = false;
    p.chargeTime = 0;
    p._chargeReady = false;
  }

  Sound.sfx('dash');
  Fx.ring(W.particles, p.x, p.y, '#28e0ff', 60, .3);
}

/* =========================================================
   USE CONSUMABLE
   ========================================================= */
export function useConsumable(game, W, id) {
  const inventory = game.profile.inventory.consumables;
  const result = consume(id, inventory, W.player, { world: W });

  if (!result.ok) {
    if (result.reason === 'empty') {
      const name = CONSUMABLES[id]?.name || id;
      if (typeof window.addToast === 'function') {
        window.addToast('KHÔNG CÒN ' + name);
      }
    }
    return false;
  }

  const c = CONSUMABLES[id];
  if (typeof window.addToast === 'function') {
    window.addToast('DÙNG: ' + c.name);
  }
  Sound.sfx('pickup');
  game.updateHUD();
  return true;
}