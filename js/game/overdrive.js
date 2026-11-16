/* =========================================================
   VNXX — GAME / OVERDRIVE
   Thanh năng lượng tối thượng. Nạp từ sát thương, hạ gục,
   và né hoàn hảo bằng dash. Đầy → nhấn F để bung 7 giây.
   ========================================================= */

import { CFG } from '../core/constants.js';
import { clamp } from '../core/utils.js';
import { Fx } from '../systems/fx.js';
import Settings from '../core/settings.js';
import Sound from '../systems/sound.js';

/* =========================================================
   KHỞI TẠO
   ========================================================= */
export function createOverdrive() {
  return {
    charge: 0,
    max: CFG.OVERDRIVE.max,
    active: 0,
    activeMax: CFG.OVERDRIVE.duration,
    ready: false,
    justActivated: 0
  };
}

/* =========================================================
   NẠP
   ========================================================= */
export function addCharge(W, p, amount) {
  const od = W.overdrive;
  if (!od || od.active > 0) return;

  const gainMul = 1 + ((p && p.up && p.up.odGainMul) || 0);
  od.charge = clamp(od.charge + amount * gainMul, 0, od.max);

  if (!od.ready && od.charge >= od.max) {
    od.ready = true;
    Sound.sfx('levelup');
    if (typeof window.addToast === 'function') {
      window.addToast('⚡ OVERDRIVE SẴN SÀNG — NHẤN [F]');
    }
  }
}

export function chargeFromDamage(W, p, dmg) {
  addCharge(W, p, dmg * CFG.OVERDRIVE.dmgGain);
}

export function chargeFromKill(W, p) {
  addCharge(W, p, CFG.OVERDRIVE.killGain);
}

export function chargeFromPerfectDash(W, p) {
  addCharge(W, p, CFG.OVERDRIVE.perfectDash);
}

/* =========================================================
   KÍCH HOẠT
   ========================================================= */
export function activateOverdrive(game, W) {
  const od = W.overdrive;
  if (!od || !od.ready || od.active > 0) return false;

  const p = W.player;
  const extra = (p.up && p.up.odDurAdd) || 0;

  od.active = CFG.OVERDRIVE.duration + extra;
  od.activeMax = od.active;
  od.charge = 0;
  od.ready = false;
  od.justActivated = .8;

  Sound.sfx('levelup');
  Sound.sfx('explosion');
  Fx.ring(W.particles, p.x, p.y, '#ffc44d', 320, .9);
  Fx.ring(W.particles, p.x, p.y, '#ffffff', 200, .6);
  Fx.burst(W.particles, p.x, p.y, 40, '#ffc44d', 520, .9, 6);

  if (Settings.get('shakeOn')) W.camera.shake = 16;

  if (typeof window.addToast === 'function') {
    window.addToast('🔥 OVERDRIVE — ' + Math.round(od.active) + 's');
  }

  /* Hồi máu nhẹ khi bung */
  if (!p.noHeal) {
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * .10);
  }

  return true;
}

/* =========================================================
   UPDATE
   ========================================================= */
export function updateOverdrive(W, dt) {
  const od = W.overdrive;
  if (!od) return;

  if (od.justActivated > 0) od.justActivated = Math.max(0, od.justActivated - dt);

  if (od.active > 0) {
    od.active -= dt;

    /* VFX liên tục */
    const p = W.player;
    if (p && p.alive && Math.random() < .7) {
      const a = Math.random() * Math.PI * 2;
      const r = 26 + Math.random() * 14;
      Fx.spawn(
        W.particles,
        p.x + Math.cos(a) * r,
        p.y + Math.sin(a) * r,
        Math.cos(a) * 40, Math.sin(a) * 40,
        .4, 3, Math.random() < .5 ? '#ffc44d' : '#fff3c4'
      );
    }

    if (od.active <= 0) {
      od.active = 0;
      if (typeof window.addToast === 'function') window.addToast('OVERDRIVE KẾT THÚC');
    }
  }
}

/* =========================================================
   TRUY VẤN
   ========================================================= */
export function isOverdrive(W) {
  return !!(W && W.overdrive && W.overdrive.active > 0);
}

export function overdriveRatio(W) {
  if (!W || !W.overdrive) return 0;
  const od = W.overdrive;
  if (od.active > 0) {
    const total = CFG.OVERDRIVE.duration + 5;
    return clamp(od.active / total, 0, 1);
  }
  return clamp(od.charge / od.max, 0, 1);
}

export default {
  createOverdrive,
  addCharge,
  chargeFromDamage,
  chargeFromKill,
  chargeFromPerfectDash,
  activateOverdrive,
  updateOverdrive,
  isOverdrive,
  overdriveRatio
};
