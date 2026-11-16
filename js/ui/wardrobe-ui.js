/* =========================================================
   HALF NIFE — UI / WARDROBE
   Màn hình tủ đồ: xem trước nhân vật + chọn trang phục.
   Preview dùng CHÍNH renderer của game → thấy đúng như trong trận.
   ========================================================= */

import { listSkins, getSkin, SKIN_RARITY } from '../data/skins.js';
import Wardrobe from '../systems/wardrobe.js';
import Save from '../systems/save.js';
import Sound from '../systems/sound.js';
import { addToast } from './hud.js';
import { drawPlayer } from '../render/draw-entities.js';

let _selected = null;
let _raf = 0;
let _bound = false;

function G() {
  return window.VNXX?.Game || null;
}

function profile() {
  const g = G();
  return g && g.profile ? g.profile : null;
}

/* =========================================================
   INIT
   ========================================================= */
export function initWardrobeUI() {
  if (_bound) return;
  _bound = true;

  const menuBtn = document.getElementById('menuWardrobeBtn');
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      Sound.init();
      Sound.resume();
      Sound.sfx('button');
      openWardrobe();
    });
  }

  const backBtn = document.querySelector('#screen-wardrobe [data-act="back-menu"]');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      Sound.sfx('button');
      closeWardrobe();
    });
  }

  const equipBtn = document.getElementById('wardrobeEquip');
  if (equipBtn) {
    equipBtn.addEventListener('click', () => {
      const p = profile();
      if (!p) {
        addToast('⚠ CẦN TẠO PROFILE TRƯỚC');
        return;
      }
      if (!_selected) return;
      const skin = getSkin(_selected);
      const ok = Wardrobe.set(p, _selected);
      if (ok) {
        Sound.sfx('levelup');
        Save.write(p);
        addToast('✓ ĐÃ TRANG BỊ ' + skin.name);
        refresh();
      } else {
        Sound.sfx('error');
        addToast('🔒 CHƯA MỞ KHOÁ — ' + skin.unlock.value);
      }
    });
  }
}

/* =========================================================
   OPEN / CLOSE
   ========================================================= */
export function openWardrobe() {
  const p = profile();
  if (p) Wardrobe.load(p);

  _selected = Wardrobe.id;

  const screen = document.getElementById('screen-wardrobe');
  if (screen) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    screen.classList.add('active');
  }

  refresh();
  startPreview();
}

export function closeWardrobe() {
  stopPreview();
  const g = G();
  if (g && g.setState) {
    g.setState('MAIN_MENU');
  }
  const menu = document.getElementById('screen-menu');
  if (menu) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    menu.classList.add('active');
  }
}

/* =========================================================
   RENDER LIST + DETAIL
   ========================================================= */
function refresh() {
  const p = profile();
  const skins = listSkins(p);
  const listEl = document.getElementById('wardrobeList');
  const countEl = document.getElementById('wardrobeCount');
  if (!listEl) return;

  const unlockedCount = skins.filter((s) => s.unlocked).length;
  if (countEl) countEl.textContent = unlockedCount + '/' + skins.length + ' ĐÃ MỞ';

  listEl.innerHTML = '';
  for (const s of skins) {
    const card = document.createElement('div');
    card.className = 'skin-card' + (s.unlocked ? '' : ' locked') +
      (s.id === Wardrobe.id ? ' active' : '') +
      (s.id === _selected ? ' selected' : '');
    card.dataset.id = s.id;

    const rarity = SKIN_RARITY[s.rarity] || SKIN_RARITY.common;

    card.innerHTML =
      '<div class="skin-swatch" style="background:' +
        'linear-gradient(135deg,' + s.suit + ' 0%,' + s.suit2 + ' 100%)' + '">' +
        '<div class="mini-glow" style="box-shadow:inset 0 0 24px ' + s.glow + '55"></div>' +
        '<div class="mini-body" style="background:' + s.suit + ';border:2px solid ' + s.trim + ';box-shadow:0 0 12px ' + s.glow + '99"></div>' +
        '<div class="mini-visor" style="background:' + s.visor + '"></div>' +
      '</div>' +
      '<div class="skin-label">' + s.name + '</div>' +
      '<span class="skin-badge" style="color:' + rarity.color + '">' + rarity.label + '</span>' +
      (s.unlocked ? '' : '<div class="skin-lock">🔒</div>');

    card.addEventListener('click', () => {
      _selected = s.id;
      Sound.sfx('click');
      refresh();
    });

    listEl.appendChild(card);
  }

  updateDetail();
}

function updateDetail() {
  const p = profile();
  const s = getSkin(_selected);
  const unlocked = listSkins(p).find((x) => x.id === s.id);

  const nameEl = document.getElementById('wardrobeName');
  const rarityEl = document.getElementById('wardrobeRarity');
  const descEl = document.getElementById('wardrobeDesc');
  const unlockEl = document.getElementById('wardrobeUnlock');
  const fillEl = document.getElementById('wardrobeProgressFill');
  const equipEl = document.getElementById('wardrobeEquip');

  if (nameEl) nameEl.textContent = s.name;

  const rarity = SKIN_RARITY[s.rarity] || SKIN_RARITY.common;
  if (rarityEl) {
    rarityEl.textContent = rarity.label;
    rarityEl.style.color = rarity.color;
  }

  if (descEl) descEl.textContent = s.desc;

  if (unlockEl) {
    unlockEl.textContent = unlocked && unlocked.unlocked
      ? '✓ ĐÃ MỞ KHOÁ'
      : '🔒 ' + (unlocked ? unlocked.unlockLabel : '');
    unlockEl.style.color = unlocked && unlocked.unlocked ? 'var(--green)' : 'var(--amber)';
  }

  if (fillEl) {
    fillEl.style.width = Math.round((unlocked ? unlocked.progress : 0) * 100) + '%';
  }

  if (equipEl) {
    const isActive = Wardrobe.id === s.id;
    const canUse = unlocked && unlocked.unlocked;
    equipEl.textContent = isActive ? 'ĐANG MẶC' : canUse ? 'TRANG BỊ' : 'CHƯA MỞ KHOÁ';
    equipEl.classList.toggle('equipped', isActive);
    equipEl.classList.toggle('locked', !canUse && !isActive);
    equipEl.disabled = isActive;
  }
}

/* =========================================================
   PREVIEW — vẽ nhân vật bằng renderer thật
   ========================================================= */
function startPreview() {
  stopPreview();
  const canvas = document.getElementById('wardrobeCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = 240, cssH = 260;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const start = performance.now();

  const loop = () => {
    const t = (performance.now() - start) * 0.001;

    ctx.clearRect(0, 0, cssW, cssH);

    /* Sàn lưới phát sáng */
    ctx.save();
    ctx.globalAlpha = .16;
    ctx.strokeStyle = getSkin(_selected).glow;
    ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const y = 190 + i * 9;
      ctx.beginPath();
      ctx.moveTo(20, y);
      ctx.lineTo(cssW - 20, y);
      ctx.stroke();
    }
    ctx.restore();

    /* Nhân vật — góc ngắm quét nhẹ qua lại */
    const angle = Math.sin(t * 0.9) * 0.55 - 0.15;
    const ghost = {
      x: cssW * 0.5,
      y: cssH * 0.55,
      vx: 90,
      vy: 0,
      angle,
      radius: 34,
      alive: true,
      hitFlash: 0,
      invuln: 0,
      attackAnim: (t % 2.2) < 0.16 ? (0.16 - (t % 2.2)) : 0,
      moveAnim: t * 2.2,
      weaponId: 'blade',
      up: { rangeMul: -0.35 },
      buffs: {}
    };

    drawPlayer(ctx, ghost, getSkin(_selected));

    _raf = requestAnimationFrame(loop);
  };

  _raf = requestAnimationFrame(loop);
}

function stopPreview() {
  if (_raf) cancelAnimationFrame(_raf);
  _raf = 0;
}

export function refreshWardrobe() {
  if (document.getElementById('screen-wardrobe')?.classList.contains('active')) {
    refresh();
  }
}
