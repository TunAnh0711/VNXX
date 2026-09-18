/* =========================================================
   VNXX — UI / MENUS
   Bind toàn bộ screen ngoài gameplay:
   - Main menu
   - Profile creation
   - Load menu
   - Settings (switches + sliders)
   - Achievements
   - Tutorial
   - Bug report → Google Form
   ========================================================= */

import { ST, DIFFICULTIES } from '../core/constants.js';
import Settings from '../core/settings.js';
import Sound from '../systems/sound.js';
import Save from '../systems/save.js';
import { addToast } from './hud.js';
import { showScreen, hideAllScreens } from './screens.js';

/* =========================================================
   INIT ALL MENU SCREENS
   Gọi 1 lần bởi main.js sau khi Game.init()
   ========================================================= */
export function initMenus() {
  bindMainMenu();
  bindProfileScreen();
  bindLoadScreen();
  bindSettingsScreen();
  bindAchievementsScreen();
  bindTutorial();
  bindBugReport();
  bindFullscreenToggle(); 
}

/* =========================================================
   GET GAME — đọc qua window để tránh circular
   ========================================================= */
function G() {
  return window.VNXX?.Game || null;
}

/* =========================================================
   MAIN MENU
   ========================================================= */
function bindMainMenu() {
  document.querySelectorAll('#screen-menu [data-act]').forEach((b) => {
    b.addEventListener('click', () => {
      Sound.init();
      Sound.resume();
      Sound.sfx('button');

      const a = b.dataset.act;
      const g = G();

      switch (a) {
        case 'new':
          if (g) {
            g.setState(ST.PROFILE_CREATION);
            showScreen(ST.PROFILE_CREATION);
            if (g.refreshProfileForm) g.refreshProfileForm();
          }
          break;

        case 'load':
          if (g && g.openLoadMenu) g.openLoadMenu();
          break;

        case 'settings':
          if (g && g.openSettings) g.openSettings('menu');
          break;

        case 'donate':
          if (g && g.openDonate) g.openDonate();
          break;

        case 'ach':
          if (g && g.openAchievements) g.openAchievements();
          break;

        case 'quit':
          if (confirm('Thoát game?')) {
            window.close();
            if (g && g.toMainMenu) g.toMainMenu();
          }
          break;
      }
    });
  });
}

/* =========================================================
   PROFILE CREATION
   ========================================================= */
function bindProfileScreen() {
  const nameInput = document.getElementById('profileName');
  const createBtn = document.getElementById('createProfileBtn');

  if (nameInput) {
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const g = G();
        if (g && g.createProfile) g.createProfile();
      }
    });
  }

  if (createBtn) {
    createBtn.addEventListener('click', () => {
      Sound.sfx('button');
      const g = G();
      if (g && g.createProfile) g.createProfile();
    });
  }
}

/* =========================================================
   LOAD SCREEN — auto refresh khi screen active
   ========================================================= */
function bindLoadScreen() {
  const screen = document.getElementById('screen-load');
  if (!screen) return;

  const obs = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.attributeName === 'class' && screen.classList.contains('active')) {
        const g = G();
        if (g && g.renderLoadList) g.renderLoadList();
      }
    }
  });
  obs.observe(screen, { attributes: true, attributeFilter: ['class'] });
}

/* =========================================================
   SETTINGS SCREEN
   - 5 switches: sfx, music, fx, shake, mobile
   - 3 sliders: master, music, sfx
   - perf button (cycle auto→high→low)
   - tutorial re-show button
   - wipe data (double-confirm)
   - report bug → mở Google Form
   ========================================================= */
function bindSettingsScreen() {
  /* ---------- Switches ---------- */
  bindSwitch('swSfx', 'sfxOn', () => { /* no-op */ });

  bindSwitch('swMusic', 'musicOn', (on) => {
    if (!on) {
      Sound.stopMusic();
    } else {
      const g = G();
      const inGame = g && (g.state === ST.PLAYING || g.state === ST.BOSS);
      Sound.startMusic(inGame ? 'game' : 'menu');
    }
  });

  bindSwitch('swFx', 'fxOn', () => { /* no-op */ });
  bindSwitch('swShake', 'shakeOn', () => { /* no-op */ });

  /* Mobile mode — toggle joystick + action buttons */
  bindSwitch('swMobile', 'mobileMode', () => {
    if (window.VNXX?.mobile?.applyMobileMode) {
      window.VNXX.mobile.applyMobileMode();
    }
  });

  /* ---------- Sliders ---------- */
  bindSlider('volMaster', 'masterVol', (v) => Sound.setMaster(v));
  bindSlider('volMusic', 'musicVol', (v) => Sound.setMusicVol(v));
  bindSlider('volSfx', 'sfxVol', (v) => Sound.setSfxVol(v));

  /* ---------- Performance button ---------- */
  const perfBtn = document.getElementById('perfBtn');
  if (perfBtn) {
    perfBtn.addEventListener('click', () => {
      Sound.sfx('button');
      const order = ['auto', 'high', 'low'];
      const i = order.indexOf(Settings.get('perf'));
      Settings.set('perf', order[(i + 1) % order.length]);
      syncSettingsUI();
    });
  }

  /* ---------- Re-enable tutorial ---------- */
  const reTutBtn = document.getElementById('reTutBtn');
  if (reTutBtn) {
    reTutBtn.addEventListener('click', () => {
      Sound.sfx('button');
      Settings.set('tutorial', true);
      syncSettingsUI();
      addToast('HƯỚNG DẪN SẼ HIỆN Ở RUN TIẾP THEO');
    });
  }

  /* ---------- Wipe data (double-confirm) ---------- */
  const wipeBtn = document.getElementById('wipeBtn');
  if (wipeBtn) {
    wipeBtn.addEventListener('click', () => {
      Sound.sfx('button');
      if (!confirm('XÓA TOÀN BỘ DỮ LIỆU?\nBước 1/2 — Hành động này không thể hoàn tác.')) return;
      if (!confirm('BƯỚC 2/2 — XÁC NHẬN XÓA VĨNH VIỄN TẤT CẢ SAVE VÀ CÀI ĐẶT?')) return;

      Save.wipeAll();
      Settings.load();
      syncSettingsUI();
      alert('ĐÃ XÓA TOÀN BỘ DỮ LIỆU.');

      const g = G();
      if (g && g.toMainMenu) g.toMainMenu();
    });
  }

  /* ---------- Report bug → Google Form (tab mới) ---------- */
  const reportBtn = document.getElementById('reportBtn');
  if (reportBtn) {
    reportBtn.addEventListener('click', () => {
      Sound.sfx('button');
      window.open(
        'https://forms.gle/vjSNnCHDPSz8zQHK8',
        '_blank',
        'noopener,noreferrer'
      );
    });
  }
}

/* =========================================================
   SWITCH HELPER
   ========================================================= */
function bindSwitch(id, key, onToggle) {
  const el = document.getElementById(id);
  if (!el) return;

  el.addEventListener('click', () => {
    const on = Settings.toggle(key);
    Sound.sfx('button');
    if (onToggle) onToggle(on);
    syncSettingsUI();
  });
}

/* =========================================================
   SLIDER HELPER
   ========================================================= */
function bindSlider(id, key, onChange) {
  const el = document.getElementById(id);
  if (!el) return;

  el.addEventListener('input', (e) => {
    const v = +e.target.value;
    Settings.set(key, v);
    if (onChange) onChange(v);
  });
}

/* =========================================================
   SYNC SETTINGS UI (đọc Settings → render DOM)
   Export qua Game hook
   ========================================================= */
export function syncSettingsUI() {
  const d = Settings.data;

  toggleClass('swSfx',    d.sfxOn);
  toggleClass('swMusic',  d.musicOn);
  toggleClass('swFx',     d.fxOn);
  toggleClass('swShake',  d.shakeOn);
  toggleClass('swMobile', d.mobileMode);

  const perfBtn = document.getElementById('perfBtn');
  if (perfBtn) perfBtn.textContent = d.perf.toUpperCase();

  setVal('volMaster', d.masterVol);
  setVal('volMusic',  d.musicVol);
  setVal('volSfx',    d.sfxVol);
}

function toggleClass(id, on) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('on', !!on);
}

function setVal(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = v;
}

/* =========================================================
   ACHIEVEMENTS SCREEN
   ========================================================= */
function bindAchievementsScreen() {
  const screen = document.getElementById('screen-achievements');
  if (!screen) return;

  /* Lần đầu build list */
  buildAchList();

  /* Re-render khi screen active */
  const obs = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.attributeName === 'class' && screen.classList.contains('active')) {
        renderAchList();
      }
    }
  });
  obs.observe(screen, { attributes: true, attributeFilter: ['class'] });
}

/* Build DOM 1 lần — duyệt ACHIEVEMENTS constant */
function buildAchList() {
  const el = document.getElementById('achList');
  if (!el) return;

  el.innerHTML = '';

  /* Lazy import để tránh circular */
  import('../data/achievements.js').then(({ ACHIEVEMENTS }) => {
    ACHIEVEMENTS.forEach((a) => {
      const d = document.createElement('div');
      d.className = 'shop-row';
      d.dataset.ach = a.id;
      d.innerHTML =
        '<div>' +
          '<div class="sname">' + (a.icon || '') + ' ' + esc(a.name) + '</div>' +
          '<div class="sdesc">' + esc(a.desc) + '</div>' +
        '</div>' +
        '<div class="sprice" data-stat="1">—</div>';
      el.appendChild(d);
    });
  }).catch((err) => {
    console.warn('[menus] load achievements failed:', err);
  });
}

/* Render trạng thái locked/unlocked */
function renderAchList() {
  const g = G();
  if (!g) return;

  const unlocked = (g.profile && g.profile.achievements) || [];

  document.querySelectorAll('#achList .shop-row').forEach((row) => {
    const id = row.dataset.ach;
    const got = unlocked.includes(id);
    const price = row.querySelector('.sprice');

    if (price) {
      price.innerHTML = got
        ? '<span style="color:#39ff9e">✔ ĐÃ MỞ</span>'
        : '<span style="color:#5d7d92">🔒 CHƯA</span>';
    }
    row.style.opacity = got ? '1' : '.6';
  });
}

/* =========================================================
   TUTORIAL
   ========================================================= */
function bindTutorial() {
  const tutClose = document.getElementById('tutClose');
  if (tutClose) {
    tutClose.addEventListener('click', () => {
      Sound.sfx('button');
      const g = G();
      if (g && g.closeTutorial) g.closeTutorial();
    });
  }
}

/* =========================================================
   BUG REPORT — chỉ còn nút copy debug (report bug đã đổi
   sang mở Google Form, xem bindSettingsScreen ở trên)
   ========================================================= */
function bindBugReport() {
  const copyBtn = document.getElementById('copyDebugBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const t = document.getElementById('bugDebug');
      if (!t) return;

      t.select();
      try {
        navigator.clipboard.writeText(t.value)
          .then(() => setCopyHint('ĐÃ COPY DEBUG INFO VÀO CLIPBOARD.'))
          .catch(() => {
            document.execCommand('copy');
            setCopyHint('ĐÃ COPY (fallback).');
          });
      } catch (err) {
        document.execCommand('copy');
        setCopyHint('ĐÃ COPY (fallback).');
      }
      Sound.sfx('pickup');
    });
  }

  const closeBtn = document.getElementById('closeBugBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      Sound.sfx('button');
      const g = G();
      if (!g) return;

      /* Quay lại settings nếu có, ngược lại về menu */
      if (g._settingsReturn !== undefined) {
        g.setState(g._settingsReturn);
        showScreen(g._settingsReturn);
      } else {
        g.setState(ST.MAIN_MENU);
        showScreen(ST.MAIN_MENU);
      }
    });
  }
}

function setCopyHint(msg) {
  const el = document.getElementById('copyHint');
  if (el) el.textContent = msg;
}

/* =========================================================
   ESCAPE HTML (inline helper)
   ========================================================= */
function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
/* =========================================================
   FULLSCREEN TOGGLE
   Nút ở góc trên phải menu → bật/tắt toàn màn hình.
   ========================================================= */
function bindFullscreenToggle() {
  const btn = document.getElementById('fsToggle');
  const icon = document.getElementById('fsIcon');
  if (!btn) return;

  /* Cập nhật icon theo trạng thái hiện tại */
  function updateIcon() {
    const isFs = !!document.fullscreenElement ||
                 !!document.webkitFullscreenElement ||
                 !!document.msFullscreenElement;
    btn.classList.toggle('active', isFs);
    if (icon) icon.textContent = isFs ? '⛶' : '⛶';
    /* Có thể dùng 2 icon khác nhau:
       isFs ? '⤡' : '⛶'  — nếu muốn icon khác khi đã fullscreen */
    btn.title = isFs ? 'Thoát toàn màn hình' : 'Toàn màn hình';
  }

  btn.addEventListener('click', () => {
    Sound.sfx('button');
    Sound.init();
    Sound.resume();

    const isFs = !!document.fullscreenElement ||
                 !!document.webkitFullscreenElement ||
                 !!document.msFullscreenElement;

    if (!isFs) {
      /* BẬT fullscreen */
      const el = document.documentElement;
      const req = el.requestFullscreen ||
                  el.webkitRequestFullscreen ||
                  el.msRequestFullscreen;
      if (req) {
        req.call(el).catch((err) => {
          console.warn('[Fullscreen] request failed:', err);
          /* iOS Safari không hỗ trợ fullscreen cho div — chỉ video */
        });
      }
    } else {
      /* TẮT fullscreen */
      const exit = document.exitFullscreen ||
                   document.webkitExitFullscreen ||
                   document.msExitFullscreen;
      if (exit) {
        exit.call(document).catch((err) => {
          console.warn('[Fullscreen] exit failed:', err);
        });
      }
    }
  });

  /* Lắng nghe thay đổi fullscreen (kể cả user nhấn F11/ESC) */
  document.addEventListener('fullscreenchange', updateIcon);
  document.addEventListener('webkitfullscreenchange', updateIcon);
  document.addEventListener('msfullscreenchange', updateIcon);

  /* Initial state */
  updateIcon();
}

/* =========================================================
   EXPORT DEFAULT
   ========================================================= */
export default { initMenus, syncSettingsUI };