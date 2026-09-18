/* =========================================================
   VNXX — UI / SHOP
   Shop screen: render stock, buy item, refresh, close.
   Pure UI, không import Game — dùng window.VNXX.
   ========================================================= */

import { RARITY } from '../core/constants.js';
import { WEAPONS, getShopWeapons } from '../data/weapons.js';
import { MODULES, modulePrice } from '../data/modules.js';
import { CONSUMABLES, ACTIVE_CONSUMABLE_IDS } from '../data/consumables.js';
import { fmtNum, pick } from '../core/utils.js';
import Sound from '../systems/sound.js';
import { addToast } from './hud.js';

/* =========================================================
   MODULE STATE
   ========================================================= */
let _stock = null;           // mảng item hiện tại
let _afterClose = null;      // callback sau khi đóng shop

/* =========================================================
   INIT SHOP UI (bind buttons)
   Gọi 1 lần bởi main.js
   ========================================================= */
export function initShopUI() {
  const closeBtn = document.getElementById('shopClose');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => closeShop());
  }

  const refreshBtn = document.getElementById('shopRefresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => refreshShop());
  }
}

/* =========================================================
   OPEN SHOP
   - game.openShop(onClose) sẽ gọi hàm này qua window hook
   - Sinh stock mới mỗi lần mở
   ========================================================= */
export function openShop(game, onClose) {
  if (!game || !game.world) return;

  _afterClose = onClose || null;
  _stock = generateStock(game);

  renderShop(game);
  Sound.startMusic('menu');   // nhạc nhẹ khi vào shop

  /* Set state + show screen */
  game._prevState = game.state;
  game.paused = true;
  game.setState(game._state?.SHOP || 'SHOP');
  if (window.VNXX?.showScreen) window.VNXX.showScreen('SHOP');
}

/* =========================================================
   CLOSE SHOP
   ========================================================= */
export function closeShop() {
  Sound.sfx('button');

  const game = getGame();
  if (!game) return;

  /* Xoá callback local — game.closeShop sẽ tự gọi game.afterShop */
  _afterClose = null;

  /* Để game.js xử lý state + callback đồng bộ */
  if (game.closeShop) {
    game.closeShop();
  } else {
    game.setState(game._prevState || 'PLAYING');
    game.paused = false;
    if (window.VNXX?.hideAllScreens) window.VNXX.hideAllScreens();
  }

  /* Resume nhạc game */
  if (game.world) {
    Sound.startMusic(game.world.stage === 5 ? 'boss' : 'game');
  }
}

/* =========================================================
   REFRESH STOCK (tốn 150 credits)
   ========================================================= */
export function refreshShop() {
  const game = getGame();
  if (!game || !game.world) return;

  if (game.world.player.credits < 150) {
    addToast('KHÔNG ĐỦ CREDITS');
    Sound.sfx('warning');
    return;
  }

  game.world.player.credits -= 150;
  _stock = generateStock(game);
  renderShop(game);
  Sound.sfx('shop');
}

/* =========================================================
   GENERATE STOCK
   Roll ngẫu nhiên:
   - 2 vũ khí chưa sở hữu (theo unlock rules)
   - 2 module
   - 2 consumable
   - 1 heal (cố định)
   ========================================================= */
function generateStock(game) {
  const pr = game.profile;
  const stock = [];

  /* ---------- Vũ khí ---------- */
  const weaponPool = getShopWeapons(pr);
  const wCount = Math.min(2, weaponPool.length);
  for (let i = 0; i < wCount; i++) {
    const w = weaponPool.splice(
      Math.floor(Math.random() * weaponPool.length), 1
    )[0];
    stock.push({
      kind: 'weapon',
      id: w.id,
      name: w.name,
      desc: w.desc,
      rarity: w.rarity,
      price: w.price
    });
  }

  /* ---------- Module ---------- */
  const modKeys = Object.keys(MODULES);
  for (let i = 0; i < 2; i++) {
    const id = pick(modKeys);
    const m = MODULES[id];
    const owned = (pr.inventory.modules || {})[id] || 0;
    stock.push({
      kind: 'module',
      id,
      name: m.name,
      desc: m.desc,
      rarity: m.rarity,
      price: modulePrice(id, owned)
    });
  }

  /* ---------- Consumable ---------- */
  const consPool = ACTIVE_CONSUMABLE_IDS.slice();
  /* Revive token chỉ có ở non-hardcore */
  if (pr.difficulty !== 'hardcore') {
    consPool.push('revive_token');
  }

  for (let i = 0; i < 2; i++) {
    const id = pick(consPool);
    const c = CONSUMABLES[id];
    stock.push({
      kind: 'consumable',
      id,
      name: c.name,
      desc: c.desc,
      rarity: c.rarity,
      price: c.price
    });
  }

  /* ---------- Heal (luôn có) ---------- */
  stock.push({
    kind: 'heal',
    id: 'heal',
    name: 'HỒI MÁU ĐẦY',
    desc: 'Hồi đầy HP ngay lập tức',
    rarity: 'common',
    price: 400
  });

  return stock;
}

/* =========================================================
   RENDER SHOP
   ========================================================= */
function renderShop(game) {
  const W = game.world;
  const p = W.player;

  /* Credits / Shards */
  const crEl = document.getElementById('shopCredits');
  const shEl = document.getElementById('shopShards');
  if (crEl) crEl.textContent = fmtNum(p.credits);
  if (shEl) shEl.textContent = p.shards;

  const container = document.getElementById('shopItems');
  if (!container) return;
  container.innerHTML = '';

  if (!_stock || _stock.length === 0) {
    container.innerHTML = '<div class="empty-note">SHOP ĐÃ HẾT HÀNG</div>';
    return;
  }

  _stock.forEach((it, idx) => {
    const r = RARITY[it.rarity] || RARITY.common;
    const affordable = p.credits >= it.price;

    const row = document.createElement('div');
    row.className = 'shop-row';
    row.innerHTML =
      '<div>' +
        '<div class="sname" style="color:' + r.color + '">' +
          esc(it.name) +
        '</div>' +
        '<div class="sdesc">' + r.stars + ' ' + esc(it.desc) + '</div>' +
      '</div>' +
      '<div class="sprice" style="' + (affordable ? '' : 'opacity:.4') + '">' +
        fmtNum(it.price) + ' CR' +
      '</div>';

    if (affordable) {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => buyItem(game, idx));
    } else {
      row.style.opacity = '.6';
    }

    container.appendChild(row);
  });
}

/* =========================================================
   BUY ITEM
   ========================================================= */
export function buyItem(game, idx) {
  if (!_stock || !_stock[idx]) return;

  const it = _stock[idx];
  const p = game.world.player;

  if (p.credits < it.price) {
    addToast('KHÔNG ĐỦ CREDITS');
    Sound.sfx('warning');
    return;
  }

  p.credits -= it.price;

  const pr = game.profile;

  /* ---------- Áp dụng theo loại ---------- */
  switch (it.kind) {
    case 'weapon': {
      pr.inventory.weapons.push(it.id);
      if (!pr.unlockedWeapons.includes(it.id)) {
        pr.unlockedWeapons.push(it.id);
      }
      pr.statistics.weaponsUnlocked = pr.unlockedWeapons.length;
      pr.weapon = it.id;
      p.weaponId = it.id;
      addToast('MUA: ' + it.name);
      break;
    }

    case 'module': {
      pr.inventory.modules = pr.inventory.modules || {};
      pr.inventory.modules[it.id] = (pr.inventory.modules[it.id] || 0) + 1;
      addToast('MUA MODULE: ' + it.name);
      break;
    }

    case 'consumable': {
      pr.inventory.consumables = pr.inventory.consumables || {};
      pr.inventory.consumables[it.id] =
        (pr.inventory.consumables[it.id] || 0) + 1;
      addToast('MUA: ' + it.name);
      break;
    }

    case 'heal': {
      p.hp = p.maxHp;
      addToast('HỒI MÁU ĐẦY');
      break;
    }
  }

  Sound.sfx('shop');

  /* Recalc player stats (module có thể thay đổi) */
  if (game.recalcPlayerStats) game.recalcPlayerStats();

  /* Xoá item khỏi stock */
  _stock.splice(idx, 1);

  /* Re-render + HUD */
  renderShop(game);
  if (game.updateHUD) game.updateHUD();

  /* Sync + autosave */
  if (game.syncProfileFromWorld) game.syncProfileFromWorld();
  if (window.VNXX?.Save) window.VNXX.Save.auto(game.profile);
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
export default { initShopUI, openShop, closeShop, refreshShop, buyItem };