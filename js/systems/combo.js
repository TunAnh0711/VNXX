/* =========================================================
   VNXX — SYSTEMS / COMBO
   Chuỗi hạ gục liên tiếp → nhân sát thương & tài nguyên.
   Bị đánh → mất một nửa chuỗi. Hết thời gian → reset.
   ========================================================= */

import { CFG } from '../core/constants.js';
import { clamp } from '../core/utils.js';
import { FloatText } from './fx.js';

/* =========================================================
   KHỞI TẠO
   ========================================================= */
export function createCombo() {
  return {
    count: 0,
    timer: 0,
    max: 0,
    mult: 1,
    creditMult: 1,
    xpMult: 1,
    tier: 0,          // 0..4 — dùng cho hiệu ứng
    pop: 0            // animation khi tăng
  };
}

/* =========================================================
   CỬA SỔ THỜI GIAN (có thể mở rộng bằng upgrade)
   ========================================================= */
function windowFor(p) {
  const extra = (p && p.up && p.up.comboWindowMul) || 0;
  return CFG.COMBO.window * (1 + extra);
}

/* =========================================================
   HẠ GỤC
   ========================================================= */
export function comboOnKill(W, p, n = 1) {
  const c = W.combo;
  if (!c) return;

  c.count = Math.min(CFG.COMBO.maxStacks, c.count + n);
  c.timer = windowFor(p);
  c.max = Math.max(c.max, c.count);
  c.pop = 1;
  recalc(c, p);
}

/* =========================================================
   NHẬN SÁT THƯƠNG
   ========================================================= */
export function comboOnHurt(W, p) {
  const c = W.combo;
  if (!c || c.count <= 0) return;

  const before = c.count;
  c.count = Math.floor(c.count * (1 - CFG.COMBO.breakOnHit));
  recalc(c, p);

  if (before >= 10 && W.texts) {
    FloatText.add(W.texts, p.x, p.y - 56, 'COMBO BREAK', '#ff3b52', 15);
  }
}

/* =========================================================
   UPDATE
   ========================================================= */
export function updateCombo(W, p, dt) {
  const c = W.combo;
  if (!c) return;

  if (c.pop > 0) c.pop = Math.max(0, c.pop - dt * 4);

  if (c.count <= 0) return;

  c.timer -= dt;
  if (c.timer <= 0) {
    c.count = 0;
    c.timer = 0;
    recalc(c, p);
  }
}

/* =========================================================
   TÍNH LẠI HỆ SỐ
   ========================================================= */
function recalc(c, p) {
  const extraPerStack = (p && p.up && p.up.comboDmgMul) || 0;
  const per = CFG.COMBO.perStack + extraPerStack;

  c.mult = 1 + c.count * per;
  c.creditMult = 1 + c.count * CFG.COMBO.creditPer;
  c.xpMult = 1 + c.count * CFG.COMBO.xpPer;

  if (c.count >= 80)      c.tier = 4;
  else if (c.count >= 50) c.tier = 3;
  else if (c.count >= 25) c.tier = 2;
  else if (c.count >= 10) c.tier = 1;
  else                    c.tier = 0;
}

/* =========================================================
   TRUY VẤN
   ========================================================= */
export function comboDmgMul(W) {
  return W && W.combo ? W.combo.mult : 1;
}

export function comboCreditMul(W) {
  return W && W.combo ? W.combo.creditMult : 1;
}

export function comboXpMul(W) {
  return W && W.combo ? W.combo.xpMult : 1;
}

export function comboRatio(W) {
  if (!W || !W.combo) return 0;
  return clamp(W.combo.timer / CFG.COMBO.window, 0, 1);
}

export default {
  createCombo,
  comboOnKill,
  comboOnHurt,
  updateCombo,
  comboDmgMul,
  comboCreditMul,
  comboXpMul,
  comboRatio
};
