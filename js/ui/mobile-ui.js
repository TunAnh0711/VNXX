/* =========================================================
   VNXX — UI / MOBILE
   Virtual joystick + action buttons cho mobile.
   Tự động ẩn khi vào screen UI (pause, inventory, shop...).
   ========================================================= */

import Input from '../core/input.js';
import Settings from '../core/settings.js';
import Sound from '../systems/sound.js';

let _initialized = false;

/* DOM refs */
let _controls, _joyZone, _joyBase, _joyKnob;
let _btnAttack, _btnInteract, _btnDash, _btnInv;

/* Joystick state */
let _joyTouchId = null;
let _joyCenterX = 0;
let _joyCenterY = 0;
let _joyMaxRadius = 45;

/* =========================================================
   INIT
   ========================================================= */
export function initMobileUI() {
  if (_initialized) return;
  _initialized = true;

  _controls   = document.getElementById('mobileControls');
  _joyZone    = document.getElementById('joystickZone');
  _joyBase    = document.getElementById('joystickBase');
  _joyKnob    = document.getElementById('joystickKnob');
  _btnAttack  = document.getElementById('mobAttack');
  _btnInteract= document.getElementById('mobInteract');
  _btnDash    = document.getElementById('mobDash');
  _btnInv     = document.getElementById('mobInv');

  if (!_controls) {
    console.warn('[mobile-ui] #mobileControls không tồn tại');
    return;
  }

  bindJoystick();
  bindButtons();
  bindGameStateWatcher();

  applyMobileMode();
}

/* =========================================================
   APPLY MODE
   ========================================================= */
export function applyMobileMode() {
  if (!_controls) return;
  const on = !!Settings.get('mobileMode');
  _controls.classList.toggle('hidden', !on);
  document.body.classList.toggle('mobile-mode', on);

  /* Cập nhật bán kính joystick theo kích thước base thực tế */
  if (on && _joyBase) {
    const w = _joyBase.offsetWidth || 100;
    _joyMaxRadius = w * 0.42;
  }
}

/* =========================================================
   AUTO-HIDE KHI VÀO UI SCREEN
   Theo dõi class .active trên các .screen UI quan trọng.
   ========================================================= */
function bindGameStateWatcher() {
  /* Danh sách screen cần ẩn joystick */
  const UI_SCREENS = [
    'screen-pause', 'screen-inventory', 'screen-shop',
    'screen-levelup', 'screen-settings', 'screen-menu',
    'screen-profile', 'screen-load', 'screen-event',
    'screen-achievements', 'screen-donate', 'screen-lan',
    'screen-gameover', 'screen-hardcore', 'screen-stageclear',
    'screen-bug'
  ];

  const check = () => {
    let uiOpen = false;
    for (const id of UI_SCREENS) {
      const el = document.getElementById(id);
      if (el && el.classList.contains('active')) {
        uiOpen = true;
        break;
      }
    }
    document.body.classList.toggle('ui-open', uiOpen);
    /* Reset joystick khi ẩn */
    if (uiOpen) resetJoystick();
  };

  /* MutationObserver cho tất cả UI screens */
  const obs = new MutationObserver(check);
  for (const id of UI_SCREENS) {
    const el = document.getElementById(id);
    if (el) obs.observe(el, { attributes: true, attributeFilter: ['class'] });
  }

  /* Initial check */
  check();
}

/* =========================================================
   JOYSTICK
   ========================================================= */
function bindJoystick() {
  if (!_joyZone) return;

  /* START */
  _joyZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (_joyTouchId !== null) return;

    const t = e.changedTouches[0];
    _joyTouchId = t.identifier;

    /* Cập nhật bán kính theo kích thước base thực tế */
    if (_joyBase) {
      const w = _joyBase.offsetWidth || 100;
      _joyMaxRadius = w * 0.42;
    }

    /* Dời base đến vị trí chạm */
    const rect = _joyZone.getBoundingClientRect();
    const cx = t.clientX;
    const cy = t.clientY;

    _joyBase.style.left = (cx - rect.left) + 'px';
    _joyBase.style.top  = (cy - rect.top)  + 'px';

    _joyCenterX = cx;
    _joyCenterY = cy;

    updateJoystick(cx, cy);

    Sound.init();
    Sound.resume();
  }, { passive: false });

  /* MOVE */
  window.addEventListener('touchmove', (e) => {
    if (_joyTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === _joyTouchId) {
        updateJoystick(t.clientX, t.clientY);
        e.preventDefault();
        break;
      }
    }
  }, { passive: false });

  /* END */
  window.addEventListener('touchend', (e) => {
    if (_joyTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === _joyTouchId) {
        resetJoystick();
        break;
      }
    }
  });

  window.addEventListener('touchcancel', () => resetJoystick());
}

function updateJoystick(px, py) {
  let dx = px - _joyCenterX;
  let dy = py - _joyCenterY;
  const dist = Math.hypot(dx, dy);

  if (dist > _joyMaxRadius) {
    dx = dx / dist * _joyMaxRadius;
    dy = dy / dist * _joyMaxRadius;
  }

  if (_joyKnob) {
    _joyKnob.style.transform =
      `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;
  }

  const nx = dx / _joyMaxRadius;
  const ny = dy / _joyMaxRadius;

  /* Dead zone */
  const mag = Math.hypot(nx, ny);
  if (mag < 0.15) {
    Input.joystick.active = false;
    Input.joystick.dx = 0;
    Input.joystick.dy = 0;
  } else {
    Input.joystick.active = true;
    Input.joystick.dx = nx;
    Input.joystick.dy = ny;
  }
}

function resetJoystick() {
  _joyTouchId = null;
  Input.joystick.active = false;
  Input.joystick.dx = 0;
  Input.joystick.dy = 0;
  Input.mobile.attack = false;

  if (_joyKnob) _joyKnob.style.transform = 'translate(-50%, -50%)';
  if (_joyBase) {
    _joyBase.style.left = '50%';
    _joyBase.style.top  = '50%';
  }
}

/* =========================================================
   BUTTONS
   ========================================================= */
function bindButtons() {
  /* ATTACK — hold để bắn liên tục */
  bindHoldButton(_btnAttack, (on) => { Input.mobile.attack = on; });

  /* INTERACT — tap */
  bindTapButton(_btnInteract, () => { Input.mobile.interact = true; });

  /* DASH — tap */
  bindTapButton(_btnDash, () => {
    const g = window.VNXX?.Game;
    if (g && g.doDash) g.doDash();
  });

  /* INVENTORY — tap toggle */
  bindTapButton(_btnInv, () => {
    const g = window.VNXX?.Game;
    if (!g) return;
    if (g.state === 'INVENTORY') g.closeInventory();
    else if (g.state === 'PLAYING' || g.state === 'BOSS') g.openInventory();
  });
}

function bindHoldButton(el, onState) {
  if (!el) return;

  const start = (e) => {
    e.preventDefault();
    onState(true);
    el.classList.add('pressed');
    Sound.init();
    Sound.resume();
  };
  const end = (e) => {
    e.preventDefault();
    onState(false);
    el.classList.remove('pressed');
  };

  el.addEventListener('touchstart', start, { passive: false });
  el.addEventListener('touchend',   end,   { passive: false });
  el.addEventListener('touchcancel',end,   { passive: false });
}

function bindTapButton(el, action) {
  if (!el) return;

  el.addEventListener('touchstart', (e) => {
    e.preventDefault();
    el.classList.add('pressed');
    Sound.init();
    Sound.resume();
    Sound.sfx('button');
    action();
  }, { passive: false });

  el.addEventListener('touchend', (e) => {
    e.preventDefault();
    el.classList.remove('pressed');
  }, { passive: false });

  el.addEventListener('touchcancel', () => {
    el.classList.remove('pressed');
  });
}

/* =========================================================
   EXPORT
   ========================================================= */
export default { initMobileUI, applyMobileMode };