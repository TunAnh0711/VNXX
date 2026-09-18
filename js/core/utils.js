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