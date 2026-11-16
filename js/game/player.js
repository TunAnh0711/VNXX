/* =========================================================
   VNXX — GAME / PLAYER
   Movement, dash, aim, attack, buffs, status, damage.

   Hệ thống mới:
   - Status effect trên player (burn/poison/bleed DOT, chill/freeze slow)
   - Perfect Dash → nạp Overdrive
   - Overdrive ảnh hưởng tốc bắn / sát thương / đạn
   - Combo: nhận sát thương → mất chuỗi
   ========================================================= */

import { CFG } from '../core/constants.js';
import Input from '../core/input.js';
import Settings from '../core/settings.js';
import { clamp, angLerp, dist, rnd, TAU } from '../core/utils.js';
import { WEAPONS, hasMagazine } from '../data/weapons.js';
import { CONSUMABLES, consume } from '../data/consumables.js';
import Sound from '../systems/sound.js';
import { Fx, FloatText } from '../systems/fx.js';
import { collideWithObstacles } from './world.js';
import * as Status from '../systems/status.js';
import { comboOnHurt } from '../systems/combo.js';
import { isOverdrive, chargeFromPerfectDash } from './overdrive.js';

/* =========================================================
   UPDATE PLAYER
   ========================================================= */
export function updatePlayer(game, W, dt) {
  const p = W.player;
  if (!p.alive) return;

  updatePlayerStatus(game, W, p, dt);
  updateBuffs(p, dt);
  updateMovement(W, p, dt);
  updateAim(game, W, p, dt);
  updateTimers(p, dt);
  updateReload(game, W, p, dt);
  handleInput(game, W, p, dt);
  updateChargeVisual(W, p, dt);
  updateChestPrompt(W, p);
}

/* =========================================================
   STATUS TRÊN PLAYER
   ========================================================= */
function updatePlayerStatus(game, W, p, dt) {
  const total = Status.tickStatus(p, dt, (dmg) => {
    if (game.godMode) return;
    p.hp -= dmg;
    if (Math.random() < .3) {
      FloatText.add(W.texts, p.x + rnd(-12, 12), p.y - 30,
        '-' + Math.round(dmg), '#ff7a2f', 11);
    }
    if (p.hp <= 0) {
      p.hp = 0;
      game.onPlayerDeath();
    }
  });

  /* hiệu ứng thị giác */
  if (p.statusTint && Math.random() < .25) {
    Fx.spawn(W.particles, p.x + rnd(-14, 14), p.y + rnd(-14, 14),
      0, -24, .4, 2.5, p.statusTint);
  }
}

/* =========================================================
   RELOAD
   ========================================================= */
function updateReload(game, W, p, dt) {
  if (!p.reloading) return;

  p.reloadTimer -= dt;

  if (p.reloadTimer <= 0) {
    p.reloading = false;
    p.reloadTimer = 0;
    p.magAmmo = p.magMax;

    Sound.sfx('pickup');

    if (W && W.particles) {
      Fx.burst(W.particles, p.x, p.y, 4, '#9ff2ff', 90, .3, 3);
    }
  }
}

export function startReload(game, W, p) {
  if (p.reloading) return false;

  const w = WEAPONS[p.weaponId];
  if (!w) return false;
  if (!hasMagazine(p.weaponId)) return false;
  if (p.magAmmo >= p.magMax) return false;

  p.reloading = true;

  const speedMul = Math.max(0.3, 1 + (p.up.reloadSpeedMul || 0));
  p.reloadTimer = (w.reloadTime || 1.5) / speedMul;
  p.reloadDuration = p.reloadTimer;

  Sound.sfx('button');

  if (typeof window.addToast === 'function') {
    window.addToast('ĐANG NẠP ĐẠN...');
  }

  return true;
}

/* =========================================================
   BUFFS + REGEN + SHIELD
   ========================================================= */
function updateBuffs(p, dt) {
  const b = p.buffs;
  if (b.dmg > 0)     b.dmg     = Math.max(0, b.dmg - dt);
  if (b.shield > 0)  b.shield  = Math.max(0, b.shield - dt);
  if (b.berserk > 0) b.berserk = Math.max(0, b.berserk - dt);

  if (b.shield > 0) p.shield = Math.max(p.shield, 60 * (b.shield / 25));

  /* ---- Natural regen ---- */
  if (p.up.regen > 0 && p.hp < p.maxHp && !p.noHeal) {
    const heal = p.up.regen * p.maxHp * dt;
    p.hp = Math.min(p.maxHp, p.hp + heal * (p.healMul || 1));
  }

  /* ---- Shield auto regen ---- */
  if (p.shieldRegenEnabled && p.shieldMax > 0) {
    p.shieldRegenTimer -= dt;
    if (p.shieldRegenTimer <= 0 && p.shield < p.shieldMax) {
      p.shield = Math.min(p.shieldMax, p.shield + p.shieldMax * 0.15 * dt);
    }
  }
}

/* =========================================================
   MOVEMENT
   ========================================================= */
function updateMovement(W, p, dt) {
  const mv = Input.moveVector();
  const berserk = p.buffs.berserk > 0 ? 1.3 : 1;
  const odMul = isOverdrive(W) ? CFG.OVERDRIVE.speedMul : 1;
  const statusMul = Status.moveMul(p);

  const targetSpeed = p.speed * berserk * odMul * statusMul;

  /* Đang charge railgun → giảm tốc 50% */
  const chargeSlow = p.charging ? 0.5 : 1;

  if (p.dashTime > 0) {
    p.dashTime -= dt;
    p.x += p.dashDir.x * CFG.PLAYER.dashSpeed * dt;
    p.y += p.dashDir.y * CFG.PLAYER.dashSpeed * dt;

    if (Math.random() < .6) {
      Fx.spawn(W.particles, p.x, p.y, rnd(-40, 40), rnd(-40, 40), .32, 4, '#28e0ff');
    }
  } else {
    p.vx += mv.x * CFG.PLAYER.accel * berserk * chargeSlow * dt;
    p.vy += mv.y * CFG.PLAYER.accel * berserk * chargeSlow * dt;

    const fr = CFG.PLAYER.friction * (mv.x === 0 && mv.y === 0 ? 1.6 : 1);
    p.vx -= p.vx * fr * dt;
    p.vy -= p.vy * fr * dt;

    const sp = Math.hypot(p.vx, p.vy);
    const maxSp = targetSpeed * chargeSlow;
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
  const Canvas2D = window.VNXX && window.VNXX.Canvas2D;
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
   INPUT
   ========================================================= */
function handleInput(game, W, p, dt) {
  const w = WEAPONS[p.weaponId];
  if (!w) return;

  /* ===== 1. TƯƠNG TÁC ===== */
  const wantInteract =
    Input.isDown(' ') ||
    (Input.mobile && Input.mobile.interact);

  if (wantInteract) {
    if (Input.mobile && Input.mobile.interact) {
      Input.mobile.interact = false;
    }

    const chest = getNearbyChest(W, p);
    if (chest && !chest.open) {
      game.openChest(chest);
    }
    return;
  }

  /* ===== 2. RELOADING ===== */
  if (p.reloading) return;

  /* ===== 3. TẤN CÔNG ===== */
  const holding =
    Input.mouse.down ||
    (Input.mobile && Input.mobile.attack);

  if (!holding) {
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

  /* ===== CHARGE WEAPON ===== */
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

  /* ===== VŨ KHÍ THƯỜNG ===== */
  const freeAmmo = isOverdrive(W) && CFG.OVERDRIVE.freeAmmo;

  if (!freeAmmo && hasMagazine(p.weaponId) && p.magAmmo <= 0) {
    startReload(game, W, p);
    return;
  }

  const fired = playerAttack(game, W, p);

  if (fired && hasMagazine(p.weaponId) && !freeAmmo) {
    p.magAmmo--;

    if (p.magAmmo <= 0) {
      startReload(game, W, p);
    }
  }
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

  let dmgBase = w.damage * w.chargeDamageMul * (1 + p.up.damageMul);
  dmgBase *= (1 + (p.up.elementDamageMul || 0));
  if (W.combo) dmgBase *= W.combo.mult;
  if (isOverdrive(W)) dmgBase *= CFG.OVERDRIVE.dmgMul;

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

  for (let i = 0; i < 24; i++) {
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
   CHEST PROMPT
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
   NEAREST CHEST
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
  if (p.cooldown > 0) return false;

  const w = WEAPONS[p.weaponId];
  if (!w) return false;

  if (w.charge > 0) return false;
  if (p.reloading) return false;

  const berserk = p.buffs.berserk > 0 ? .55 : 1;
  const odRate = isOverdrive(W) ? CFG.OVERDRIVE.fireRateMul : 1;

  const cd = 1 / (w.fireRate * (1 + p.up.attackSpeedMul) * berserk * odRate);

  p.cooldown = cd;
  p.attackAnim = .16;

  let dmgBase = w.damage * (1 + p.up.damageMul) *
    (p.buffs.dmg > 0 ? 1.6 : 1);

  /* combo + overdrive */
  if (W.combo) dmgBase *= W.combo.mult;
  if (isOverdrive(W)) dmgBase *= CFG.OVERDRIVE.dmgMul;

  const range = w.range * (1 + p.up.rangeMul);
  const critC = w.critChance + (p.up.critChance || 0);
  const critM = w.critMul + (p.up.critMul || 0);

  if (w.type === 'melee') {
    meleeAttack(game, W, p, w, dmgBase, range, critC, critM);
  } else {
    rangedAttack(game, W, p, w, dmgBase, critC, critM);
  }

  return true;
}

/* ---------- MELEE ---------- */
function meleeAttack(game, W, p, w, dmgBase, range, critC, critM) {
  Sound.sfx('attack');

  const half = w.spread;
  let hitAny = false;

  for (let i = 0; i < W.enemies.length; i++) {
    const e = W.enemies[i];
    if (!e.alive) continue;

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
  const snd = (id === 'shotgun' || id === 'flak') ? 'shotgun'
    : (id === 'sniper' || id === 'railgun' || id === 'cryo') ? 'sniper'
    : id === 'tesla' ? 'laser'
    : id === 'hunter' ? 'hunter'
    : 'shoot';
  Sound.sfx(snd);

  /* Điểm nhấn riêng cho từng loại đạn đặc biệt */
  if (id === 'ricochet') Sound.sfx('ricochet');
  else if (id === 'cryo') Sound.sfx('freeze');
  else if (id === 'tesla') Sound.sfx('chain');

  const count = w.projectileCount || 1;

  const projSpeedMul  = Math.max(0.3, 1 + (p.up.projSpeedMul  || 0));
  const spreadMul     = Math.max(0.3, 1 + (p.up.spreadMul     || 0));
  const splashMul     = Math.max(0,   1 + (p.up.splashMul     || 0));
  const pierceAdd     = Math.round(p.up.pierceAdd || 0);
  const armorPen      = p.up.armorPen         || 0;
  const elementDamageMul = p.up.elementDamageMul || 0;

  const spd = (w.projectileSpeed || 700) *
    (1 + p.up.rangeMul * .4) *
    projSpeedMul *
    (W.lowGravity ? .6 : 1);

  const effectiveSpread = (w.spread || 0) * spreadMul;
  const effectivePierce = (w.penetration || 0) + pierceAdd;
  const effectiveSplash = (w.splash || 0) * splashMul;

  const chainCount = (w.chain ? w.chain.count : 0) + (p.up.chainAdd || 0);

  for (let i = 0; i < count; i++) {
    const spreadA = (count > 1
      ? (i / (count - 1) - .5) * 2 * effectiveSpread
      : 0)
      + (Math.random() - .5) * effectiveSpread * .5;

    const a = p.angle + spreadA;
    const crit = Math.random() < critC;
    const dmg = dmgBase * (crit ? critM : 1);

    W.projectiles.push({
      x: p.x + Math.cos(a) * 22,
      y: p.y + Math.sin(a) * 22,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      r: projRadius(id),
      damage: dmg,
      owner: 'player',
      life: (w.range || 400) / spd + .15,
      pierce: effectivePierce,
      splash: effectiveSplash,
      crit,
      knockback: w.knockback || 0,
      armorPen,
      elementDamageMul,
      color: crit
        ? '#ffc44d'
        : (w.rarity === 'mythic' ? '#ff5ad0' : projColor(id)),
      hitSet: new Set(),
      trail: id === 'sniper' || id === 'railgun' || id === 'needler' || id === 'hunter' || id === 'cryo' || id === 'ricochet',
      weaponId: id,
      size: effectiveSplash > 0 ? 1.4 : 1,

      /* lan sét */
      chain: chainCount > 0
        ? { count: chainCount, range: w.chain ? w.chain.range : 220, falloff: w.chain ? w.chain.falloff : .7 }
        : null,

      /* nảy tường */
      bounce: w.bounce || 0,

      /* bám mục tiêu */
      homing: w.homing
        ? { turnRate: w.homing.turnRate, speed: w.homing.speed }
        : null
    });
  }

  p.vx -= Math.cos(p.angle) * (w.knockback || 0) * .35;
  p.vy -= Math.sin(p.angle) * (w.knockback || 0) * .35;

  if (Settings.get('shakeOn')) {
    const shake = id === 'sniper' ? 7 : (id === 'rocket' || id === 'grenade') ? 6 : 2.4;
    W.camera.shake = Math.min(9, shake);
  }

  Fx.burst(
    W.particles,
    p.x + Math.cos(p.angle) * 24,
    p.y + Math.sin(p.angle) * 24,
    3, '#9ff2ff', 160, .18, 3
  );
}

function projRadius(id) {
  if (id === 'rocket' || id === 'grenade') return 7;
  if (id === 'plasma' || id === 'arcgun') return 8;
  if (id === 'flamer') return 9;
  if (id === 'voidw') return 6;
  if (id === 'cryo') return 6;
  if (id === 'flak') return 5;
  if (id === 'hunter') return 6;
  if (id === 'tesla') return 5;
  if (id === 'ricochet') return 4;
  return 4;
}

function projColor(id) {
  switch (id) {
    case 'flamer':   return '#ff7a2f';
    case 'arcgun':   return '#ffe14d';
    case 'needler':  return '#ff3b52';
    case 'grenade':  return '#a0ff2b';
    case 'cryo':     return '#a8e9ff';
    case 'flak':     return '#ffb02e';
    case 'hunter':   return '#ff8ae0';
    case 'tesla':    return '#7df9ff';
    case 'ricochet': return '#9dff6b';
    default:         return '#28e0ff';
  }
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

  /* ---- Combo break ---- */
  comboOnHurt(W, p);

  if (p.shieldRegenEnabled) {
    p.shieldRegenTimer = p.shieldRegenDelay || 3;
  }

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
   PERFECT DASH CHECK
   ========================================================= */
function perfectDodgeCheck(W, p) {
  const R = 130;

  for (let i = 0; i < W.projectiles.length; i++) {
    const pr = W.projectiles[i];
    if (pr.owner !== 'enemy') continue;

    const dx = p.x - pr.x;
    const dy = p.y - pr.y;
    const d = Math.hypot(dx, dy);
    if (d > R || d < 1) continue;

    const spd = Math.hypot(pr.vx, pr.vy) || 1;
    const dot = (pr.vx * dx + pr.vy * dy) / (spd * d);
    if (dot > .88) return true;
  }
  return false;
}

/* =========================================================
   DASH
   ========================================================= */
export function doDash(game, W) {
  const p = W.player;
  if (p.dashCd > 0) return;

  const perfect = perfectDodgeCheck(W, p);

  const mv = Input.moveVector();
  let dx = mv.x;
  let dy = mv.y;

  if (dx === 0 && dy === 0) {
    dx = Math.cos(p.angle);
    dy = Math.sin(p.angle);
  }

  const l = Math.hypot(dx, dy) || 1;
  p.dashDir = { x: dx / l, y: dy / l };

  const cdMul    = Math.max(0.3, 1 - (p.up.dashCdMul       || 0));
  const distMul  = Math.max(1,   1 + (p.up.dashDistanceMul || 0));

  p.dashTime = CFG.PLAYER.dashTime * distMul;
  p.dashCd   = CFG.PLAYER.dashCd   * cdMul;
  p.invuln   = Math.max(p.invuln, p.dashTime + .15);

  if (p.charging) {
    p.charging = false;
    p.chargeTime = 0;
    p._chargeReady = false;
  }

  Sound.sfx('dash');
  Fx.ring(W.particles, p.x, p.y, '#28e0ff', 60, .3);

  /* ---- Perfect dash → nạp Overdrive ---- */
  if (perfect) {
    chargeFromPerfectDash(W, p);
    Fx.ring(W.particles, p.x, p.y, '#ffc44d', 90, .4);
    FloatText.add(W.texts, p.x, p.y - 40, 'PERFECT!', '#ffc44d', 16);
    Sound.sfx('crit');
  }
}

/* =========================================================
   USE CONSUMABLE
   ========================================================= */
export function useConsumable(game, W, id) {
  const inventory = game.profile.inventory.consumables;
  const result = consume(id, inventory, W.player, { world: W });

  if (!result.ok) {
    if (result.reason === 'empty') {
      const name = (CONSUMABLES[id] && CONSUMABLES[id].name) || id;
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
