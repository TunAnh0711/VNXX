/* =========================================================
   VNXX — UI / SCREENS
   Quản lý hiển thị/ẩn các screen overlay (.screen).
   Pure DOM, không import Game.
   ========================================================= */

import { SCREEN_MAP } from '../core/constants.js';

/* =========================================================
   SHOW SCREEN BY STATE KEY
   - key: string state ('MAIN_MENU', 'SETTINGS', ...) hoặc screenId
   - Nếu key có trong SCREEN_MAP → map sang id
   - Nếu key là screenId hợp lệ → dùng trực tiếp
   - Nếu key falsy → ẩn hết
   ========================================================= */
export function showScreen(key) {
  /* Ẩn tất cả screen trước */
  document.querySelectorAll('.screen').forEach((s) => {
    s.classList.remove('active');
  });

  if (!key) return;

  /* Resolve screen id từ state key hoặc screen id */
  const screenId = SCREEN_MAP[key] || key;
  const el = document.getElementById(screenId);

  if (el) el.classList.add('active');
}

/* =========================================================
   HIDE ALL SCREENS
   ========================================================= */
export function hideAllScreens() {
  document.querySelectorAll('.screen').forEach((s) => {
    s.classList.remove('active');
  });
}

/* =========================================================
   HELPERS
   ========================================================= */

/** Kiểm tra 1 screen có đang active không. */
export function isScreenActive(key) {
  const screenId = SCREEN_MAP[key] || key;
  const el = document.getElementById(screenId);
  return !!(el && el.classList.contains('active'));
}

/** Lấy screen id hiện đang active (null nếu không có). */
export function getActiveScreen() {
  const el = document.querySelector('.screen.active');
  return el ? el.id : null;
}

/** Đảm bảo chỉ 1 screen hiển thị — gọi cùng `showScreen`. */
export function setScreen(key) {
  showScreen(key);
}

export default { showScreen, hideAllScreens, isScreenActive, getActiveScreen };