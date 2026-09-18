/* =========================================================
   VNXX — MAIN (Entry Point)
   Bootstrap toàn bộ game: import modules, init, hook global.
   ========================================================= */

/* ---------- CORE ---------- */
import { ST } from './core/constants.js';
import Input from './core/input.js';
import Settings from './core/settings.js';

/* ---------- SYSTEMS ---------- */
import Sound from './systems/sound.js';
import Save from './systems/save.js';
import { Fx, FloatText } from './systems/fx.js';
import Net from './systems/net.js';

/* ---------- GAME ---------- */
import Game from './game/game.js';

/* ---------- RENDER ---------- */
import Canvas2D from './render/canvas.js';

/* ---------- DATA ---------- */
import { WEAPONS } from './data/weapons.js';

/* ---------- UI ---------- */
import { addToast } from './ui/hud.js';
import { showScreen, hideAllScreens } from './ui/screens.js';
import { initMenus, syncSettingsUI } from './ui/menus.js';
import { initShopUI } from './ui/shop-ui.js';
import * as shopUI from './ui/shop-ui.js';
import { initInventoryUI, renderInventory } from './ui/inventory-ui.js';
import { initLanUI } from './ui/lan-ui.js';
import * as lanUI from './ui/lan-ui.js';
import { initMobileUI } from './ui/mobile-ui.js';
import * as mobileUI from './ui/mobile-ui.js';

/* ---------- DEBUG ---------- */
import { installDebugCommands } from './debug.js';

/* =========================================================
   BOOTSTRAP
   ========================================================= */
function boot() {
  /* 1. Load settings trước */
  Settings.load();

  /* 2. Input (bàn phím + chuột + joystick) */
  Input.init();

  /* 3. Canvas */
  Canvas2D.init();
  window.addEventListener('resize', () => Canvas2D.resize());

  /* 4. Audio */
  Sound.init();

  /* 5. UI screens — thứ tự quan trọng: menus trước để bind switch */
  initMenus();
  initShopUI();
  initInventoryUI();
  initLanUI();
  initMobileUI();

  /* 6. Net bindings */
  Net.bind({
    getGame: () => Game,
    hideAllScreens,
    addToast
  });

  /* 7. Game init */
  Game.init();

  /* 8. Debug commands */
  installDebugCommands();

  /* 9. Expose globals */
  window.VNXX = Object.assign(window.VNXX || {}, {
    /* Core */
    Game, Save, Settings, Sound, Net, Canvas2D, Input, ST,
    Fx, FloatText, WEAPONS,

    /* UI hooks */
    showScreen, hideAllScreens,
    renderInventory, syncSettingsUI,
    addToast,

    /* Namespaces */
    shop: shopUI,
    lan: lanUI,
    mobile: mobileUI,

    /* Meta */
    version: '1.0.0',
    build: '001'
  });

  /* 10. Global shortcuts cho submodules */
  window.addToast = addToast;
  window.VNXXNet = Net;

  /* 11. Apply mobile mode ngay sau khi boot
        (nếu user đã bật từ lần chơi trước) */
  if (mobileUI && typeof mobileUI.applyMobileMode === 'function') {
    try {
      mobileUI.applyMobileMode();
    } catch (err) {
      console.warn('[VNXX] applyMobileMode failed:', err);
    }
  }

  /* 12. Console banner */
  console.log(
    '%cVNXX v1.0.0 — BUILD 001',
    'color:#28e0ff;font-weight:bold;font-size:14px;text-shadow:0 0 8px #28e0ff'
  );
  console.log(
    '%cGõ VNXX.cmd.help() để xem lệnh debug.',
    'color:#5d7d92'
  );
}

/* =========================================================
   GLOBAL HANDLERS
   ========================================================= */

/* Chặn context menu chuột phải khi đang chơi */
window.addEventListener('contextmenu', (e) => {
  if (Game.state === ST.PLAYING || Game.state === ST.BOSS) {
    e.preventDefault();
  }
});

/* Auto-save khi rời trang */
window.addEventListener('beforeunload', () => {
  if (Game.world && Game.profile && !Game.profile.dead) {
    try {
      Game.syncProfileFromWorld();
      Save.auto(Game.profile);
    } catch (err) {
      console.warn('[VNXX] beforeunload save failed', err);
    }
  }
});

/* Audio unlock theo gesture đầu tiên (Chrome autoplay policy) */
function unlockAudioOnce() {
  Sound.init();
  Sound.resume();
  window.removeEventListener('pointerdown', unlockAudioOnce);
  window.removeEventListener('keydown', unlockAudioOnce);
  window.removeEventListener('touchstart', unlockAudioOnce);
}
window.addEventListener('pointerdown', unlockAudioOnce, { once: true });
window.addEventListener('keydown',     unlockAudioOnce, { once: true });
window.addEventListener('touchstart',  unlockAudioOnce, { once: true });

/* Bắt lỗi runtime để không trắng màn hình im lặng */
window.addEventListener('error', (e) => {
  console.error('[VNXX] Runtime error:', e.error || e.message);
  try { addToast('⚠ LỖI: ' + (e.message || 'unknown')); } catch (_) {}
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[VNXX] Unhandled promise:', e.reason);
});

/* Chặn scroll/zoom trên mobile khi chơi */
document.addEventListener('touchmove', (e) => {
  if (Game.state === ST.PLAYING || Game.state === ST.BOSS) {
    /* Chỉ chặn nếu touch trên canvas (không chặn joystick) */
    if (e.target && e.target.id === 'game') {
      e.preventDefault();
    }
  }
}, { passive: false });

/* Chặn double-tap zoom trên iOS */
let _lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - _lastTouchEnd <= 300) {
    e.preventDefault();
  }
  _lastTouchEnd = now;
}, { passive: false });

/* =========================================================
   GO
   ========================================================= */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}