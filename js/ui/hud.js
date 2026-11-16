/* =========================================================
   VNXX — UI / HUD
   Cập nhật HUD (HP/XP/Shield/Credits/Wave/BossBar/Ammo),
   toast notifications, interact prompt.
   Pure DOM, không import Game.
   ========================================================= */

import { STAGES } from '../data/stages.js';
import { CFG } from '../core/constants.js';
import { clamp, fmtNum } from '../core/utils.js';
import { WEAPONS, hasMagazine } from '../data/weapons.js';

/* =========================================================
   UPDATE HUD (mỗi frame)
   ========================================================= */
export function updateHUD(game, W) {
  if (!W || !W.player) return;

  const p = W.player;

  /* ---------- HP ---------- */
  const hpPct = clamp(p.hp / p.maxHp, 0, 1) * 100;
  const hpFill = document.getElementById('hpFill');
  const hpText = document.getElementById('hpText');
  const hpBar = document.getElementById('hpBar');

  if (hpFill) hpFill.style.width = hpPct + '%';
  if (hpText) hpText.textContent = Math.ceil(p.hp) + ' / ' + p.maxHp;
  if (hpBar) hpBar.classList.toggle('low', hpPct < 28);

  /* ---------- XP ---------- */
  const xpPct = clamp(p.xp / p.xpNext, 0, 1) * 100;
  const xpFill = document.getElementById('xpFill');
  const xpText = document.getElementById('xpText');

  if (xpFill) xpFill.style.width = xpPct + '%';
  if (xpText) {
    xpText.textContent =
      'LV ' + p.level + '  ·  ' +
      Math.floor(p.xp) + '/' + p.xpNext;
  }

  /* ---------- Credits / Shards ---------- */
  const crEl = document.getElementById('creditText');
  const shEl = document.getElementById('shardText');

  if (crEl) crEl.textContent = fmtNum(p.credits);
  if (shEl) shEl.textContent = p.shards;

  /* ---------- Wave / objective ---------- */
  const waveEl = document.getElementById('waveText');
  const objEl = document.getElementById('objectiveText');

  const stage = STAGES[W.stage - 1];
  if (stage) {
    const bossWave = W.wave > stage.waves;
    if (waveEl) {
      waveEl.textContent = bossWave
        ? ('STAGE ' + String(W.stage).padStart(2, '0') + ' — BOSS')
        : ('WAVE ' + String(W.wave).padStart(2, '0') +
           ' / ' + stage.waves +
           '  ·  STAGE ' + String(W.stage).padStart(2, '0'));
    }
    if (objEl && W.waveDef) {
      objEl.textContent = W.waveDef.objectiveText || '';
    }
  }

  /* ---------- Enemy Counter ---------- */
  const ecEl = document.getElementById('enemyCounter');
  const ecNum = document.getElementById('enemyCountNum');
  if (ecEl && ecNum) {
    const alive = (W.enemies || []).filter((e) => e && e.alive && !e.isBoss).length;
    ecNum.textContent = alive;
    ecEl.classList.toggle('on', alive > 0 && game && game.state === 'PLAYING');
  }

  /* ---------- Shield bar ---------- */
  const sb = document.getElementById('shieldBar');
  const sf = document.getElementById('shieldFill');
  const st = document.getElementById('shieldText');

  if (sb) {
    if (p.shield > 0) {
      sb.classList.remove('hidden');
      if (sf) {
        sf.style.width = clamp(p.shield / 60, 0, 1) * 100 + '%';
      }
      if (st) st.textContent = 'SHIELD ' + Math.ceil(p.shield);
    } else {
      sb.classList.add('hidden');
    }
  }

  /* ---------- AMMO ---------- */
  updateAmmoDisplay(p);

  /* ---------- Combo / Overdrive ---------- */
  updateComboUI(W);
  updateOverdriveUI(W);
}

/* =========================================================
   COMBO UI
   ========================================================= */
function updateComboUI(W) {
  const wrap = document.getElementById('comboWrap');
  if (!wrap) return;

  const c = W.combo;
  if (!c || c.count <= 0) {
    wrap.classList.add('hidden');
    return;
  }

  wrap.classList.remove('hidden');
  wrap.dataset.tier = String(c.tier);

  const cnt = document.getElementById('comboCount');
  if (cnt) cnt.textContent = c.count;

  const fill = document.getElementById('comboFill');
  if (fill) {
    const win = CFG.COMBO.window *
      (1 + ((W.player && W.player.up && W.player.up.comboWindowMul) || 0));
    const ratio = Math.max(0, Math.min(1, c.timer / (win || 1)));
    fill.style.width = ratio * 100 + '%';
  }

  const mult = document.getElementById('comboMult');
  if (mult) {
    const bonus = Math.round((c.mult - 1) * 100);
    mult.textContent = '+' + bonus + '%';
  }

  if (c.pop > 0) {
    wrap.style.transform = 'scale(' + (1 + c.pop * .12) + ')';
  } else {
    wrap.style.transform = 'scale(1)';
  }
}

/* =========================================================
   OVERDRIVE UI
   ========================================================= */
function updateOverdriveUI(W) {
  const wrap = document.getElementById('odWrap');
  if (!wrap) return;

  const od = W.overdrive;
  if (!od) { wrap.classList.add('hidden'); return; }

  wrap.classList.remove('hidden');

  const fill = document.getElementById('odFill');
  const activeEl = document.getElementById('odActive');

  const isActive = od.active > 0;

  if (fill) {
    const durMax = od.activeMax || CFG.OVERDRIVE.duration;
    const ratio = isActive
      ? Math.min(1, od.active / durMax)
      : Math.min(1, od.charge / od.max);
    fill.style.width = ratio * 100 + '%';
  }

  wrap.classList.toggle('ready', !!od.ready && !isActive);
  wrap.classList.toggle('active', isActive);

  if (activeEl) {
    activeEl.classList.toggle('hidden', !isActive);
    if (isActive) activeEl.textContent = Math.ceil(od.active) + 's';
  }
}

/* =========================================================
   AMMO DISPLAY — hiển thị số đạn + thanh reload
   ========================================================= */
export function updateAmmoDisplay(p) {
  const display = document.getElementById('ammoDisplay');
  if (!display) return;

  const w = WEAPONS[p.weaponId];
  if (!w) {
    display.classList.add('hidden');
    return;
  }

  /* Ẩn với melee và weapon không có magazine (railgun) */
  if (!hasMagazine(p.weaponId)) {
    display.classList.add('hidden');
    return;
  }

  display.classList.remove('hidden');

  const curEl = document.getElementById('ammoCur');
  const maxEl = document.getElementById('ammoMax');
  const reloadBar = document.getElementById('reloadBar');
  const reloadFill = document.getElementById('reloadFill');

  if (curEl) curEl.textContent = p.magAmmo;
  if (maxEl) maxEl.textContent = p.magMax;

  /* Đổi màu đỏ khi hết đạn */
  display.classList.toggle('empty', p.magAmmo <= 0);

  /* Reload bar */
  if (p.reloading && reloadBar && reloadFill) {
    reloadBar.classList.remove('hidden');
    const prog = 1 - (p.reloadTimer / p.reloadDuration);
    reloadFill.style.width = Math.max(0, Math.min(100, prog * 100)) + '%';
  } else if (reloadBar) {
    reloadBar.classList.add('hidden');
    if (reloadFill) reloadFill.style.width = '0%';
  }
}

/* =========================================================
   TOAST NOTIFICATIONS
   ========================================================= */
export function addToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;

  const d = document.createElement('div');
  d.className = 'toast-item';
  d.textContent = msg;
  el.appendChild(d);

  setTimeout(() => {
    d.style.transition = 'opacity .4s';
    d.style.opacity = '0';
    setTimeout(() => d.remove(), 420);
  }, 1900);

  while (el.children.length > 5) {
    el.removeChild(el.firstChild);
  }
}

/* =========================================================
   INTERACT PROMPT
   ========================================================= */
export function showInteractPrompt(text) {
  const el = document.getElementById('interactPrompt');
  if (!el) return;
  el.textContent = text;
  el.classList.add('on');
}

export function hideInteractPrompt() {
  const el = document.getElementById('interactPrompt');
  if (!el) return;
  el.classList.remove('on');
}

/* =========================================================
   BOSS BAR
   ========================================================= */
export function showBossBar(name) {
  const nameEl = document.getElementById('bossName');
  const barEl = document.getElementById('bossBar');
  if (nameEl) nameEl.textContent = name;
  if (barEl) barEl.classList.add('on');
}

export function hideBossBar() {
  const el = document.getElementById('bossBar');
  if (el) el.classList.remove('on');
}

export function updateBossBar(hp, maxHp) {
  const fill = document.getElementById('bossFill');
  if (fill) {
    fill.style.width = clamp(hp / maxHp, 0, 1) * 100 + '%';
  }
}

/* =========================================================
   SAVE INDICATOR
   ========================================================= */
let _saveTimer = null;

export function showSaveIndicator() {
  const el = document.getElementById('saveIndicator');
  if (!el) return;
  el.classList.add('on');
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => el.classList.remove('on'), 1400);
}

/* =========================================================
   EXPORT DEFAULT
   ========================================================= */
export default {
  updateHUD,
  updateAmmoDisplay,
  addToast,
  showInteractPrompt,
  hideInteractPrompt,
  showBossBar,
  hideBossBar,
  updateBossBar,
  showSaveIndicator
};