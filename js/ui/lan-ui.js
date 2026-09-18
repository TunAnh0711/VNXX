/* =========================================================
   VNXX — UI / LAN
   Bind nút menu "CHƠI LAN", host/join room, đóng phòng.
   Gọi Net qua window.VNXXNet — không import trực tiếp.
   ========================================================= */

import Sound from '../systems/sound.js';
import { addToast } from './hud.js';
import { ST } from '../core/constants.js';

/* =========================================================
   STATE
   ========================================================= */
let _initialized = false;

/* =========================================================
   INIT LAN UI
   Gọi 1 lần bởi main.js sau khi Game.init()
   ========================================================= */
export function initLanUI() {
  if (_initialized) return;
  _initialized = true;

  /* Bind nút CHƠI LAN (đã có sẵn trong index.html) */
  bindMenuButton();

  /* Nút back về menu */
  bindBackButton();

  /* Nút host room */
  bindHostButton();

  /* Nút join room */
  bindJoinButton();

  /* Nút close room */
  bindCloseRoomButton();

  /* Enter key trên input mã phòng */
  bindCodeInputEnter();
}

/* =========================================================
   BIND NÚT "CHƠI LAN" (đã có sẵn trong HTML)
   Nút này được khai báo trực tiếp trong index.html với id="menuLanBtn"
   Không cần inject động → tránh lỗi insertBefore.
   ========================================================= */
function bindMenuButton() {
  const btn = document.getElementById('menuLanBtn');
  if (!btn) {
    console.warn('[lan-ui] #menuLanBtn không tồn tại trong HTML');
    return;
  }

  btn.addEventListener('click', () => {
    Sound.sfx('button');
    openLanScreen();
  });
}

/* =========================================================
   BACK BUTTON — thoát khỏi screen LAN về menu
   ========================================================= */
function bindBackButton() {
  const btn = document.getElementById('lanBack');
  if (!btn) return;

  btn.addEventListener('click', () => {
    Sound.sfx('button');
    closeLanScreen();
  });
}

/* =========================================================
   HOST — tạo phòng mới
   ========================================================= */
function bindHostButton() {
  const btn = document.getElementById('lanHostBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    Sound.sfx('button');
    Sound.init();
    Sound.resume();

    const net = getNet();
    if (!net) {
      addToast('MODULE LAN CHƯA SẴN SÀNG');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'ĐANG KẾT NỐI...';

    net.connect(() => {
      net.send({ type: 'host' });
      /* Reset button sau 2s để user có thể thử lại nếu fail */
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = 'TẠO PHÒNG (HOST)';
      }, 2000);
    });
  });
}

/* =========================================================
   JOIN — nhập mã phòng
   ========================================================= */
function bindJoinButton() {
  const btn = document.getElementById('lanJoinBtn');
  const input = document.getElementById('lanCodeInput');
  if (!btn) return;

  btn.addEventListener('click', () => {
    if (!input) return;

    const code = input.value.trim().toUpperCase();

    if (code.length !== 4) {
      addToast('MÃ PHẢI CÓ 4 KÝ TỰ');
      Sound.sfx('warning');
      input.focus();
      return;
    }

    Sound.sfx('button');
    Sound.init();
    Sound.resume();

    const net = getNet();
    if (!net) {
      addToast('MODULE LAN CHƯA SẴN SÀNG');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'ĐANG VÀO PHÒNG...';

    net.connect(() => {
      net.send({ type: 'join', code });
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = 'VÀO PHÒNG';
      }, 2000);
    });
  });
}

/* =========================================================
   CLOSE ROOM — đóng phòng và quay lại menu
   ========================================================= */
function bindCloseRoomButton() {
  const btn = document.getElementById('lanCloseRoom');
  if (!btn) return;

  btn.addEventListener('click', () => {
    Sound.sfx('button');
    if (!confirm('ĐÓNG PHÒNG?')) return;

    const net = getNet();
    if (net) net.disconnect();

    closeLanScreen();
  });
}

/* =========================================================
   ENTER KEY trên input mã phòng → trigger join
   ========================================================= */
function bindCodeInputEnter() {
  const input = document.getElementById('lanCodeInput');
  if (!input) return;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const joinBtn = document.getElementById('lanJoinBtn');
      if (joinBtn) joinBtn.click();
    }
  });

  /* Auto uppercase khi gõ */
  input.addEventListener('input', () => {
    input.value = input.value.toUpperCase().slice(0, 4);
  });
}

/* =========================================================
   OPEN LAN SCREEN
   Hiện panel chính (host/join), ẩn room panel
   ========================================================= */
export function openLanScreen() {
  hideAllScreens();

  const screen = document.getElementById('screen-lan');
  if (screen) screen.classList.add('active');

  /* Reset về view chính */
  const main = document.getElementById('lanMain');
  const room = document.getElementById('lanRoom');
  if (main) main.classList.remove('hidden');
  if (room) room.classList.add('hidden');

  /* Clear input */
  const input = document.getElementById('lanCodeInput');
  if (input) input.value = '';

  const hint = document.getElementById('lanHint');
  if (hint) {
    hint.textContent = 'Cùng mạng LAN. Host tạo phòng → đưa mã cho bạn bè.';
  }

  /* Set state */
  const game = getGame();
  if (game) game.setState(ST.LAN);
}

/* =========================================================
   CLOSE LAN SCREEN
   Ngắt kết nối (nếu có) và quay về menu
   ========================================================= */
export function closeLanScreen() {
  const net = getNet();
  if (net) net.disconnect();

  const game = getGame();
  if (game && game.toMainMenu) game.toMainMenu();
}

/* =========================================================
   HELPERS
   ========================================================= */
function getNet() {
  return window.VNXXNet || null;
}

function getGame() {
  return window.VNXX?.Game || null;
}

function hideAllScreens() {
  document.querySelectorAll('.screen').forEach((s) => {
    s.classList.remove('active');
  });
}

/* =========================================================
   EXPORT DEFAULT
   ========================================================= */
export default { initLanUI, openLanScreen, closeLanScreen };