/* =========================================================
   VNXX — UI / INVENTORY
   Inventory screen: vũ khí, module, consumable.
   - Click weapon → trang bị
   - Click module → toggle equip (max 4)
   - Click consumable → dùng
   Pure UI, không import Game — dùng window.VNXX.
   ========================================================= */

import { RARITY } from '../core/constants.js';
import { WEAPONS } from '../data/weapons.js';
import {
  MODULES, MAX_EQUIPPED_MODULES,
  toggleModule as toggleModuleHelper,
  canEquipMore
} from '../data/modules.js';
import {
  CONSUMABLES, countConsumables
} from '../data/consumables.js';
import Sound from '../systems/sound.js';
import { addToast } from './hud.js';

/* =========================================================
   INIT INVENTORY UI
   Bind nút đóng (TAB đã bind ở game.js)
   ========================================================= */
export function initInventoryUI() {
  const closeBtn = document.getElementById('invClose');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const game = getGame();
      if (game && game.closeInventory) game.closeInventory();
    });
  }
}

/* =========================================================
   RENDER INVENTORY
   Được gọi từ game.openInventory() qua window.VNXX.renderInventory
   ========================================================= */
export function renderInventory() {
  const game = getGame();
  if (!game || !game.profile) return;

  const pr = game.profile;

  renderWeapons(game, pr);
  renderModules(game, pr);
  renderConsumables(game, pr);
  renderCount(pr);
}

/* =========================================================
   WEAPONS
   ========================================================= */
function renderWeapons(game, pr) {
  const el = document.getElementById('invWeapons');
  if (!el) return;

  el.innerHTML = '';

  if (!pr.inventory.weapons || pr.inventory.weapons.length === 0) {
    el.innerHTML = '<div class="inv-slot" style="opacity:.4">' +
                   '<div class="isd">CHƯA CÓ VŨ KHÍ</div></div>';
    return;
  }

  pr.inventory.weapons.forEach((id) => {
    const w = WEAPONS[id];
    if (!w) return;

    const r = RARITY[w.rarity] || RARITY.common;
    const equipped = pr.weapon === id;

    const d = document.createElement('div');
    d.className = 'inv-slot' + (equipped ? ' eq' : '');
    d.innerHTML =
      '<div class="isn" style="color:' + r.color + '">' +
        esc(w.name) +
      '</div>' +
      '<div class="isd">' +
        r.stars + ' ' + r.name + '<br>' +
        'DMG ' + w.damage + ' · RATE ' + w.fireRate + '<br>' +
        esc(w.desc) +
      '</div>';

    d.addEventListener('click', () => {
      equipWeapon(game, id);
    });

    el.appendChild(d);
  });
}

/* =========================================================
   EQUIP WEAPON
   ========================================================= */
function equipWeapon(game, id) {
  const pr = game.profile;
  pr.weapon = id;

  if (game.world) {
    game.world.player.weaponId = id;
  }

  Sound.sfx('button');
  addToast('TRANG BỊ: ' + WEAPONS[id].name);

  renderInventory();
}

/* =========================================================
   MODULES
   ========================================================= */
function renderModules(game, pr) {
  const el = document.getElementById('invModules');
  if (!el) return;

  el.innerHTML = '';

  const mods = pr.inventory.modules || {};
  const ids = Object.keys(mods);

  if (ids.length === 0) {
    el.innerHTML = '<div class="inv-slot" style="opacity:.4">' +
                   '<div class="isd">CHƯA CÓ MODULE</div></div>';
    return;
  }

  const equipped = pr.equippedModules || [];

  ids.forEach((id) => {
    const m = MODULES[id];
    if (!m) return;

    const r = RARITY[m.rarity] || RARITY.common;
    const lv = mods[id];
    const isEquipped = equipped.includes(id);

    const d = document.createElement('div');
    d.className = 'inv-slot' + (isEquipped ? ' eq' : '');
    d.innerHTML =
      '<div class="islv">x' + lv + '</div>' +
      '<div class="isn" style="color:' + r.color + '">' +
        esc(m.name) +
      '</div>' +
      '<div class="isd">' +
        r.stars + ' · ' + esc(m.desc) + '<br>' +
        (isEquipped ? '[ĐANG TRANG BỊ]' : '[CLICK ĐỂ TRANG BỊ]') +
      '</div>';

    d.addEventListener('click', () => {
      toggleModuleEquip(game, id);
    });

    el.appendChild(d);
  });
}

/* =========================================================
   TOGGLE MODULE EQUIP
   Dùng helper từ data/modules.js — trả về { ok, action, list }
   ========================================================= */
function toggleModuleEquip(game, id) {
  const pr = game.profile;
  const current = pr.equippedModules || [];

  const result = toggleModuleHelper(current, id);

  if (!result.ok) {
    if (result.action === 'full') {
      addToast('TỐI ĐA ' + MAX_EQUIPPED_MODULES + ' MODULE');
      Sound.sfx('warning');
    }
    return;
  }

  /* Gán lại mảng mới (immutable pattern) */
  pr.equippedModules = result.list;

  /* Recalc player stats */
  if (game.recalcPlayerStats) game.recalcPlayerStats();

  Sound.sfx('button');

  const msg = result.action === 'add'
    ? 'TRANG BỊ: ' + MODULES[id].name
    : 'THÁO: ' + MODULES[id].name;
  addToast(msg);

  renderInventory();

  if (window.VNXX?.Save) window.VNXX.Save.auto(pr);
}

/* =========================================================
   CONSUMABLES
   ========================================================= */
function renderConsumables(game, pr) {
  const el = document.getElementById('invConsumables');
  if (!el) return;

  el.innerHTML = '';

  const cons = pr.inventory.consumables || {};
  const ids = Object.keys(cons);

  if (ids.length === 0) {
    el.innerHTML = '<div class="inv-slot" style="opacity:.4">' +
                   '<div class="isd">TRỐNG</div></div>';
    return;
  }

  ids.forEach((id) => {
    const c = CONSUMABLES[id];
    if (!c || cons[id] <= 0) return;

    const r = RARITY[c.rarity] || RARITY.common;
    const isPassive = !!c.passive;

    const d = document.createElement('div');
    d.className = 'inv-slot';
    d.innerHTML =
      '<div class="islv">x' + cons[id] + '</div>' +
      '<div class="isn" style="color:' + r.color + '">' +
        esc(c.name) +
      '</div>' +
      '<div class="isd">' +
        esc(c.desc) + '<br>' +
        (isPassive ? '[TỰ ĐỘNG]' : '[CLICK ĐỂ DÙNG]') +
      '</div>';

    if (!isPassive) {
      d.addEventListener('click', () => {
        useConsumable(game, id);
      });
    } else {
      d.style.cursor = 'default';
      d.style.opacity = '.75';
    }

    el.appendChild(d);
  });
}

/* =========================================================
   USE CONSUMABLE
   ========================================================= */
function useConsumable(game, id) {
  if (!game.world) return;

  const before = game.profile.inventory.consumables[id];

  /* Gọi qua player.js hook */
  const used = game.useConsumable ? game.useConsumable(id) : false;

  if (used) {
    const after = game.profile.inventory.consumables[id];
    if (after !== before) {
      renderInventory();
    }
  }
}

/* =========================================================
   COUNT SUMMARY (góc phải tiêu đề INVENTORY)
   ========================================================= */
function renderCount(pr) {
  const el = document.getElementById('invCount');
  if (!el) return;

  const weapons = pr.inventory.weapons.length;
  const modules = Object.keys(pr.inventory.modules || {}).length;
  const consumables = countConsumables(pr.inventory.consumables || {});

  const total = weapons + modules + consumables;
  const capacity = pr.inventory.capacity || 12;

  el.textContent = '— ' + total + ' / ' + capacity;
}

/* =========================================================
   HELPERS
   ========================================================= */
function getGame() {
  return window.VNXX?.Game || null;
}

function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* =========================================================
   EXPORT DEFAULT
   ========================================================= */
export default { initInventoryUI, renderInventory };