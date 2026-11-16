/* =========================================================
   VNXX — GAME / HAZARDS + PROPS
   Bẫy môi trường (lava, steam, shockgrid, voidrift) và
   vật thể phá hủy (thùng nổ, thùng tiếp tế).
   ========================================================= */

import { clamp, dist, rnd, TAU } from '../core/utils.js';
import { applyStatus } from '../systems/status.js';
import { damagePlayer } from './player.js';
import { damageEnemy } from './enemy.js';
import { dropLoot } from './loot.js';
import { Fx, FloatText } from '../systems/fx.js';
import Sound from '../systems/sound.js';
import Settings from '../core/settings.js';

/* =========================================================
   UPDATE HAZARDS
   ========================================================= */
export function updateHazards(game, W, dt) {
  const hz = W.hazards;
  if (!hz || hz.length === 0) return;

  const p = W.player;
  if (!p || !p.alive) return;

  for (let i = 0; i < hz.length; i++) {
    const h = hz[i];

    /* --- Chu kỳ bật/tắt --- */
    if (h.cycle) {
      h.phase += dt;
      const period = h.cycle.on + h.cycle.off;
      const t = h.phase % period;
      h.active = t < h.cycle.on;
      h.warn = !h.active && t > period - .7;
    } else {
      h.active = true;
    }

    if (!h.active) continue;

    const d = Math.hypot(p.x - h.x, p.y - h.y);

    /* --- Void rift: hút player --- */
    if (h.type === 'voidrift') {
      const R = h.r * 3.2;
      if (d < R && d > 4) {
        const pull = (1 - d / R) * 240;
        const a = Math.atan2(h.y - p.y, h.x - p.x);
        p.vx += Math.cos(a) * pull * dt;
        p.vy += Math.sin(a) * pull * dt;
      }
    }

    if (d > h.r + p.radius) continue;

    /* --- Damage theo nhịp 0.5s --- */
    h.tick += dt;
    if (h.tick < .5) continue;
    h.tick = 0;

    const dmg = h.dps * .5;

    if (h.type === 'shockgrid') {
      applyStatus(p, 'shock', 2.0, 1);
      FloatText.add(W.texts, p.x, p.y - 40, 'SHOCK!', '#ffe14d', 14);
    } else if (h.type === 'voidrift') {
      applyStatus(p, 'weaken', 2.5, 1);
    } else if (h.type === 'lava') {
      applyStatus(p, 'burn', 1.6, 3);
    }

    damagePlayer(game, W, dmg, null);

    Fx.burst(W.particles, p.x, p.y, 5, hazardColor(h.type), 160, .35, 3);
  }
}

function hazardColor(type) {
  switch (type) {
    case 'lava':      return '#ff5a1f';
    case 'steam':     return '#d9e8f2';
    case 'shockgrid': return '#ffe14d';
    case 'voidrift':  return '#a06bff';
    default:          return '#ff5a6e';
  }
}

/* =========================================================
   UPDATE PROPS
   ========================================================= */
export function updateProps(game, W, dt) {
  const props = W.props;
  if (!props || props.length === 0) return;

  for (let i = props.length - 1; i >= 0; i--) {
    const o = props[i];
    if (o.hitFlash > 0) o.hitFlash -= dt;
    if (o.dead) { props.splice(i, 1); continue; }
  }
}

/* =========================================================
   DAMAGE PROP — gọi từ projectile
   Trả về true nếu đạn bị chặn
   ========================================================= */
export function damageProp(game, W, o, dmg) {
  if (!o || o.dead) return false;

  o.hp -= dmg;
  o.hitFlash = .12;
  o.wobble += .6;

  if (o.hp <= 0) {
    destroyProp(game, W, o);
    return true;
  }
  return false;
}

/* =========================================================
   PHÁ HỦY PROP
   ========================================================= */
export function destroyProp(game, W, o) {
  if (o.dead) return;
  o.dead = true;

  if (o.kind === 'barrel') {
    explodeBarrel(game, W, o);
  } else {
    /* Thùng tiếp tế → rơi loot */
    Sound.sfx('chest');
    Fx.burst(W.particles, o.x, o.y, 14, '#ffc44d', 220, .5, 4);

    const cr = Math.round(rnd(30, 90) * (1 + W.stage * .35));
    dropLoot(W, o.x, o.y, 'credit', cr);
    dropLoot(W, o.x + 12, o.y, 'xp', Math.round(8 + W.stage * 4));
    if (Math.random() < .22) dropLoot(W, o.x - 12, o.y, 'hp', 15);

    FloatText.add(W.texts, o.x, o.y - 22, '+' + cr + ' CR', '#ffc44d', 13);
  }
}

/* =========================================================
   NỔ THÙNG
   ========================================================= */
function explodeBarrel(game, W, o) {
  const R = 168;

  Sound.sfx('explosion');
  Fx.burst(W.particles, o.x, o.y, 30, '#ff7a2f', 460, .7, 6);
  Fx.ring(W.particles, o.x, o.y, '#ffc44d', R, .5);
  if (Settings.get('shakeOn')) W.camera.shake = Math.min(14, 10);

  /* Damage enemy */
  for (let i = W.enemies.length - 1; i >= 0; i--) {
    const e = W.enemies[i];
    if (!e.alive) continue;
    const d = dist(e, o);
    if (d < R + e.radius) {
      const falloff = 1 - clamp(d / (R + e.radius), 0, 1) * .55;
      damageEnemy(game, W, e, 120 * falloff, false, null, 260, {
        elementDamageMul: 0,
        armorPen: .4
      });
      applyStatus(e, 'burn', 3.2, 6);
    }
  }

  /* Damage player (nhẹ hơn) */
  const p = W.player;
  if (p.alive && dist(p, o) < R + p.radius) {
    damagePlayer(game, W, 22, null);
  }

  /* Chain nổ thùng khác */
  for (let i = 0; i < W.props.length; i++) {
    const other = W.props[i];
    if (other === o || other.dead || other.kind !== 'barrel') continue;
    if (dist(other, o) < R * .8) {
      other.hp = 0;
      setTimeout(() => {
        if (W.props.indexOf(other) >= 0) destroyProp(game, W, other);
      }, 70 + Math.random() * 120);
    }
  }
}

/* =========================================================
   QUERY
   ========================================================= */
export function propAt(W, x, y, r = 0) {
  const props = W.props;
  if (!props) return null;
  for (let i = 0; i < props.length; i++) {
    const o = props[i];
    if (o.dead) continue;
    if (Math.hypot(x - o.x, y - o.y) < o.r + r) return o;
  }
  return null;
}

export function hazardAt(W, x, y) {
  const hz = W.hazards;
  if (!hz) return null;
  for (let i = 0; i < hz.length; i++) {
    const h = hz[i];
    if (!h.active) continue;
    if (Math.hypot(x - h.x, y - h.y) < h.r) return h;
  }
  return null;
}

export default {
  updateHazards,
  updateProps,
  damageProp,
  destroyProp,
  propAt,
  hazardAt
};
