/* =========================================================
   VNXX — UI / HUD
   Cập nhật HUD (HP/XP/Shield/Credits/Wave/BossBar),
   toast notifications, interact prompt.
   Pure DOM, không import Game.
   ========================================================= */

import { STAGES } from '../data/stages.js';
import { clamp, fmtNum } from '../core/utils.js';

/* =========================================================
   UPDATE HUD (mỗi frame)
   - HP bar + text
   - XP bar + level text
   - Shield bar (ẩn khi shield = 0)
   - Credits / Shards
   - Wave + objective text
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
}

/* =========================================================
   TOAST NOTIFICATIONS
   Thêm 1 dòng thông báo ở top-center, tự xóa sau 1.9s.
   Tối đa 5 toast cùng lúc.
   ========================================================= */
export function addToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;

  const d = document.createElement('div');
  d.className = 'toast-item';
  d.textContent = msg;
  el.appendChild(d);

  /* Fade out → remove sau 1.9s */
  setTimeout(() => {
    d.style.transition = 'opacity .4s';
    d.style.opacity = '0';
    setTimeout(() => d.remove(), 420);
  }, 1900);

  /* Giới hạn 5 toast */
  while (el.children.length > 5) {
    el.removeChild(el.firstChild);
  }
}

/* =========================================================
   INTERACT PROMPT (bottom-center)
   Hiện khi player đứng gần rương chưa mở.
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
   BOSS BAR (top-center)
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
   SAVE INDICATOR (góc phải)
   Hiện "✓ SAVED" trong 1.4s khi autosave thành công.
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
   EXPORT DEFAULT — cho tiện import
   ========================================================= */
export default {
  updateHUD,
  addToast,
  showInteractPrompt,
  hideInteractPrompt,
  showBossBar,
  hideBossBar,
  updateBossBar,
  showSaveIndicator
};