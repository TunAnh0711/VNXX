/* =========================================================
   VNXX — CORE / UTILS
   Hàm tiện ích thuần (pure), không phụ thuộc module khác.
   ========================================================= */

/* ===================== MATH ===================== */
export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : (v > b ? b : v));

export const lerp = (a, b, t) => a + (b - a) * t;

/** Random float.
 *  rnd()        -> [0,1)
 *  rnd(a)       -> [0,a)
 *  rnd(a,b)     -> [a,b)
 */
export const rnd = (a = 1, b) =>
  b === undefined ? Math.random() * a : a + Math.random() * (b - a);

/** Random integer trong [a,b] (inclusive). */
export const rndInt = (a, b) =>
  Math.floor(a + Math.random() * (b - a + 1));

/** Pick ngẫu nhiên 1 phần tử mảng. */
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ===================== GEOMETRY ===================== */
export const dist2 = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Nội suy góc ngắn nhất (radian). */
export function angLerp(a, b, t) {
  let d = ((b - a + Math.PI) % TAU) - Math.PI;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}

/** Khoảng cách góc ngắn nhất giữa 2 hướng (radian, 0..PI). */
export function angDiff(a, b) {
  let d = ((b - a + Math.PI) % TAU) - Math.PI;
  if (d < -Math.PI) d += TAU;
  return Math.abs(d);
}

/* ===================== ARRAY ===================== */
/** Xoá phần tử tại vị trí i bằng cách swap-với-cuối rồi pop (O(1)). */
export function removeAt(arr, i) {
  arr[i] = arr[arr.length - 1];
  arr.pop();
}

/** Fisher–Yates shuffle in-place. */
export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ===================== RNG (seedable) ===================== */
/** Mulberry32 — RNG nhỏ, nhanh, dùng cho world generation theo seed. */
export function makeRNG(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ===================== STRING ===================== */
/** Escape HTML để chèn an toàn vào innerHTML. */
export function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

/* ===================== FORMAT ===================== */
/** 12345 -> "12,345" */
export function fmtNum(n) {
  return Math.floor(n).toLocaleString('en-US');
}

/** Giây -> "MM:SS" hoặc "HH:MM:SS" nếu >= 1 giờ. */
export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const p = (n) => String(n).padStart(2, '0');
  return (h > 0 ? p(h) + ':' : '') + p(m) + ':' + p(s);
}

/** Timestamp -> "DD/MM/YYYY" */
export function fmtDate(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
}

/* =========================================================
   PATH HELPERS — dùng cho draw-entities
   ========================================================= */

/**
 * Vẽ polygon đều N cạnh (đường vẽ chưa fill/stroke).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x        tâm X
 * @param {number} y        tâm Y
 * @param {number} r        bán kính
 * @param {number} sides    số cạnh
 * @param {number} rot      góc xoay (radian)
 */
export function polyPath(ctx, x, y, r, sides, rot) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * TAU;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/**
 * Vẽ hình sao gai — N cánh, đỉnh ngoài/trong xen kẽ.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x        tâm X
 * @param {number} y        tâm Y
 * @param {number} rOuter   bán kính đỉnh ngoài
 * @param {number} rInner   bán kính đỉnh trong
 * @param {number} points   số cánh
 * @param {number} rot      góc xoay (radian)
 */
export function starPath(ctx, x, y, rOuter, rInner, points, rot) {
  ctx.beginPath();
  const total = points * 2;
  for (let i = 0; i < total; i++) {
    const a = rot + (i / total) * TAU;
    const r = (i % 2 === 0) ? rOuter : rInner;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/**
 * Vẽ nhiều cung tròn đứt quãng tạo cảm giác năng lượng xoay.
 * LƯU Ý: hàm này tự gọi stroke() nên cần set màu/lineWidth bên ngoài
 * nếu muốn override. Tham số `color` set cứng strokeStyle.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x        tâm X
 * @param {number} y        tâm Y
 * @param {number} r        bán kính
 * @param {number} t        offset góc (radian)
 * @param {string} color    màu stroke
 * @param {number} segments số cung (mặc định 8)
 */
export function energyRing(ctx, x, y, r, t, color, segments = 8) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * TAU + t;
    const a1 = a0 + (TAU / segments) * 0.55;
    ctx.beginPath();
    ctx.arc(x, y, r, a0, a1);
    ctx.stroke();
  }
}