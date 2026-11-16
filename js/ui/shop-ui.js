/* =========================================================
   VNXX — UI / SHOP (v2)
   3 tab: CỬA HÀNG · HƯ KHÔNG · BÁN
   - Reroll leo thang giá
   - Khoá item để giữ qua reroll
   - Mua bằng credits hoặc void shards
   - Bán lại đồ trong túi
   ========================================================= */

import { RARITY, CFG } from '../core/constants.js';
import { WEAPONS } from '../data/weapons.js';
import { MODULES } from '../data/modules.js';
import { CONSUMABLES } from '../data/consumables.js';
import { fmtNum, esc } from '../core/utils.js';
import {
  generateStock, rerollCost, compareWeapon,
  SHARD_ITEMS, shardOwned, availableShardItems,
  applyShardItem, listSellable
} from '../data/shop.js';
import Sound from '../systems/sound.js';
import { addToast } from './hud.js';

/* =========================================================
   STATE
   ========================================================= */
let _stock = [];
let _locked = new Set();
let _rerolls = 0;
let _tab = 'credits';
let _afterClose = null;
let _game = null;
let _escHandler = null;

/* =========================================================
   INIT
   ========================================================= */
export function initShopUI() {
  const closeBtn = document.getElementById('shopClose');
  if (closeBtn) closeBtn.addEventListener('click', () => closeShop());

  const refreshBtn = document.getElementById('shopRefresh');
  if (refreshBtn) refreshBtn.addEventListener('click', () => refreshShop());

  document.querySelectorAll('.shop-tab').forEach((b) => {
    b.addEventListener('click', () => {
      _tab = b.dataset.tab;
      Sound.sfx('button');
      renderShop(getGame());
    });
  });
}

/* =========================================================
   OPEN
   ========================================================= */
export function openShop(game, onClose) {
  if (!game || !game.world) return;

  _game = game;
  _afterClose = onClose || null;
  _locked = new Set();
  _rerolls = 0;
  _tab = 'credits';
  _stock = generateStock(game, { locked: _locked });

  renderShop(game);
  Sound.startMusic('menu');

  game._prevState = game.state;
  game.paused = true;
  game.setState('SHOP');
  if (window.VNXX && window.VNXX.showScreen) window.VNXX.showScreen('SHOP');

  /* ESC fallback — tránh kẹt màn nếu nút đóng bị che (cùng lớp bug level-up) */
  _bindEsc();
}

/* =========================================================
   CLOSE
   ========================================================= */
export function closeShop() {
  _unbindEsc();
  Sound.sfx('button');

  const game = getGame();
  if (!game) return;

  _afterClose = null;

  if (game.closeShop) {
    game.closeShop();
  } else {
    game.setState(game._prevState || 'PLAYING');
    game.paused = false;
    if (window.VNXX && window.VNXX.hideAllScreens) window.VNXX.hideAllScreens();
  }

  if (game.world) {
    Sound.startMusic(game.world.stage === 5 ? 'boss' : 'game');
  }
}

/* ESC → đóng shop (dự phòng khi click bị chặn bởi overlay) */
function _bindEsc() {
  _unbindEsc();
  _escHandler = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeShop();
    }
  };
  document.addEventListener('keydown', _escHandler);
}
function _unbindEsc() {
  if (_escHandler) {
    document.removeEventListener('keydown', _escHandler);
    _escHandler = null;
  }
}

/* =========================================================
   REFRESH
   ========================================================= */
export function refreshShop() {
  const game = getGame();
  if (!game || !game.world) return;

  const cost = rerollCost(_rerolls);

  if (game.world.player.credits < cost) {
    addToast('KHÔNG ĐỦ CREDITS (' + cost + ')');
    Sound.sfx('warning');
    return;
  }

  game.world.player.credits -= cost;
  _rerolls++;

  const kept = _stock.filter((it) => _locked.has(it.id));
  const fresh = generateStock(game, { locked: _locked });

  /* gộp: giữ item khoá + item mới (không trùng id) */
  const merged = kept.slice();
  for (const it of fresh) {
    if (merged.length >= 7) break;
    if (merged.some((x) => x.id === it.id && x.kind === it.kind)) continue;
    merged.push(it);
  }

  _stock = merged;
  renderShop(game);
  Sound.sfx('shop');
  addToast('LÀM MỚI CỬA HÀNG');
}

/* =========================================================
   RENDER
   ========================================================= */
function renderShop(game) {
  const W = game.world;
  if (!W) return;
  const p = W.player;

  /* wallet */
  const crEl = document.getElementById('shopCredits');
  const shEl = document.getElementById('shopShards');
  if (crEl) crEl.textContent = fmtNum(p.credits);
  if (shEl) shEl.textContent = p.shards;

  /* tabs */
  document.querySelectorAll('.shop-tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === _tab);
  });

  const gridCr = document.getElementById('shopItems');
  const gridSh = document.getElementById('shopShardItems');
  const gridSell = document.getElementById('shopSellItems');

  if (gridCr) gridCr.classList.toggle('hidden', _tab !== 'credits');
  if (gridSh) gridSh.classList.toggle('hidden', _tab !== 'shards');
  if (gridSell) gridSell.classList.toggle('hidden', _tab !== 'sell');

  if (_tab === 'credits') renderCredits(game, gridCr);
  else if (_tab === 'shards') renderShards(game, gridSh);
  else renderSell(game, gridSell);

  /* refresh button */
  const refreshBtn = document.getElementById('shopRefresh');
  if (refreshBtn) {
    const cost = rerollCost(_rerolls);
    refreshBtn.textContent = 'LÀM MỚI (' + cost + ' CR)';
    refreshBtn.disabled = p.credits < cost;
    refreshBtn.style.opacity = p.credits < cost ? '.45' : '1';
    refreshBtn.style.display = _tab === 'credits' ? '' : 'none';
  }

  const hint = document.getElementById('shopHint');
  if (hint) {
    hint.textContent = _tab === 'credits'
      ? 'KHOÁ ITEM ĐỂ GIỮ QUA LẦN LÀM MỚI · REROLL CÀNG NHIỀU CÀNG ĐẮT'
      : _tab === 'shards'
        ? 'NÂNG CẤP VĨNH VIỄN — GIỮ QUA MỌI LẦN CHƠI'
        : 'BÁN ĐỒ KHÔNG DÙNG — NHẬN LẠI 35-40% GIÁ TRỊ';
  }
}

/* =========================================================
   TAB CREDITS
   ========================================================= */
function renderCredits(game, container) {
  if (!container) return;
  container.innerHTML = '';

  if (_stock.length === 0) {
    container.innerHTML = '<div class="empty-note">SHOP ĐÃ HẾT HÀNG</div>';
    return;
  }

  const p = game.world.player;

  _stock.forEach((it, idx) => {
    const r = RARITY[it.rarity] || RARITY.common;
    const affordable = p.credits >= it.price;
    const locked = _locked.has(it.id);

    const card = document.createElement('div');
    card.className = 'shop-card r-' + it.rarity + (locked ? ' locked' : '');
    card.style.setProperty('--rc', r.color);

    let compare = '';
    if (it.kind === 'weapon') {
      const cmp = compareWeapon(game.profile, it.id);
      if (cmp) {
        const sign = cmp.delta >= 0 ? '+' : '';
        const cls = cmp.delta >= 0 ? 'up' : 'down';
        compare = '<span class="cmp ' + cls + '">DPS ' + sign + cmp.delta + '%</span>';
      }
    }

    card.innerHTML =
      '<div class="sc-top">' +
        '<span class="sc-rar" style="color:' + r.color + '">' + r.stars + '</span>' +
        (it.meta ? '<span class="sc-meta">' + esc(it.meta) + '</span>' : '') +
      '</div>' +
      '<div class="sc-name" style="color:' + r.color + '">' + esc(it.name) + '</div>' +
      '<div class="sc-desc">' + esc(it.desc) + '</div>' +
      (compare ? '<div class="sc-cmp">' + compare + '</div>' : '') +
      '<div class="sc-foot">' +
        '<span class="sc-price' + (affordable ? '' : ' no') + '">' + fmtNum(it.price) + ' CR</span>' +
        '<button class="sc-lock' + (locked ? ' on' : '') + '" title="Khoá">' +
          (locked ? '🔒' : '🔓') +
        '</button>' +
      '</div>';

    /* click mua */
    card.addEventListener('click', (ev) => {
      if (ev.target.closest('.sc-lock')) return;
      buyItem(game, idx);
    });

    /* lock */
    const lockBtn = card.querySelector('.sc-lock');
    if (lockBtn) {
      lockBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (_locked.has(it.id)) _locked.delete(it.id);
        else _locked.add(it.id);
        Sound.sfx('button');
        renderShop(game);
      });
    }

    container.appendChild(card);
  });
}

/* =========================================================
   TAB SHARDS
   ========================================================= */
function renderShards(game, container) {
  if (!container) return;
  container.innerHTML = '';

  const pr = game.profile;
  const p = game.world.player;

  /* đồng bộ shard runtime → profile */
  pr.shards = p.shards;

  const list = SHARD_ITEMS;

  list.forEach((it) => {
    const owned = shardOwned(pr, it.id);
    const maxed = owned >= it.max;
    const afford = p.shards >= it.price;

    const card = document.createElement('div');
    card.className = 'shop-card shard' + (maxed ? ' maxed' : '');
    card.style.setProperty('--rc', '#a06bff');

    card.innerHTML =
      '<div class="sc-top">' +
        '<span class="sc-rar" style="color:#a06bff">' + it.icon + '</span>' +
        '<span class="sc-meta">' + owned + '/' + it.max + '</span>' +
      '</div>' +
      '<div class="sc-name" style="color:#c9a7ff">' + esc(it.name) + '</div>' +
      '<div class="sc-desc">' + esc(it.desc) + '</div>' +
      '<div class="sc-foot">' +
        '<span class="sc-price' + (afford && !maxed ? '' : ' no') + '">' +
          (maxed ? 'TỐI ĐA' : '◆ ' + it.price) +
        '</span>' +
      '</div>';

    if (!maxed) {
      card.addEventListener('click', () => buyShard(game, it.id));
    }

    container.appendChild(card);
  });
}

/* =========================================================
   TAB SELL
   ========================================================= */
function renderSell(game, container) {
  if (!container) return;
  container.innerHTML = '';

  const pr = game.profile;
  const items = listSellable(pr);

  if (items.length === 0) {
    container.innerHTML = '<div class="empty-note">KHÔNG CÓ GÌ ĐỂ BÁN</div>';
    return;
  }

  items.forEach((it) => {
    const r = RARITY[it.rarity] || RARITY.common;

    const card = document.createElement('div');
    card.className = 'shop-card sell r-' + it.rarity;
    card.style.setProperty('--rc', r.color);

    card.innerHTML =
      '<div class="sc-top">' +
        '<span class="sc-rar" style="color:' + r.color + '">' + r.stars + '</span>' +
        '<span class="sc-meta">x' + it.count + '</span>' +
      '</div>' +
      '<div class="sc-name" style="color:' + r.color + '">' + esc(it.name) + '</div>' +
      '<div class="sc-desc">BÁN 1 CÁI</div>' +
      '<div class="sc-foot">' +
        '<span class="sc-price sell-price">+' + fmtNum(it.price) + ' CR</span>' +
      '</div>';

    card.addEventListener('click', () => sellOne(game, it));
    container.appendChild(card);
  });
}

/* =========================================================
   BUY
   ========================================================= */
export function buyItem(game, idx) {
  const it = _stock[idx];
  if (!it) return;

  const p = game.world.player;
  const pr = game.profile;

  if (p.credits < it.price) {
    addToast('KHÔNG ĐỦ CREDITS');
    Sound.sfx('warning');
    return;
  }

  p.credits -= it.price;

  switch (it.kind) {
    case 'weapon': {
      const w = WEAPONS[it.id];
      if (!pr.inventory.weapons.includes(it.id)) {
        pr.inventory.weapons.push(it.id);
      }
      if (!pr.unlockedWeapons.includes(it.id)) {
        pr.unlockedWeapons.push(it.id);
      }
      pr.statistics.weaponsUnlocked = pr.unlockedWeapons.length;
      pr.weapon = it.id;
      p.weaponId = it.id;

      /* nạp băng mới */
      p.baseMagazine = w.magazine || 0;
      p.magMax = Math.max(1, Math.round(p.baseMagazine * Math.max(.2, 1 + (p.up.magazineMul || 0))));
      p.magAmmo = p.magMax;
      p.reloading = false;

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

    case 'ammo': {
      p.magAmmo = p.magMax;
      p.reloading = false;
      p.reloadTimer = 0;
      addToast('ĐÃ NẠP ĐẦY BĂNG');
      break;
    }

    case 'heal': {
      if (p.noHeal) {
        addToast('KHÔNG THỂ HỒI MÁU (TITANIUM)');
        p.credits += it.price;
        return;
      }
      p.hp = p.maxHp;
      addToast('HỒI MÁU ĐẦY');
      break;
    }
  }

  Sound.sfx('shop');

  if (game.recalcPlayerStats) game.recalcPlayerStats();

  _stock.splice(idx, 1);
  _locked.delete(it.id);

  renderShop(game);
  if (game.updateHUD) game.updateHUD();

  if (game.syncProfileFromWorld) game.syncProfileFromWorld();
  if (window.VNXX && window.VNXX.Save) window.VNXX.Save.auto(game.profile);
}

/* =========================================================
   BUY SHARD
   ========================================================= */
function buyShard(game, id) {
  const pr = game.profile;
  const p = game.world.player;

  pr.shards = p.shards;

  const res = applyShardItem(pr, id);

  if (!res.ok) {
    addToast(res.msg.toUpperCase());
    Sound.sfx('warning');
    return;
  }

  p.shards = pr.shards;

  if (game.recalcPlayerStats) game.recalcPlayerStats();

  /* Lõi sinh mệnh: tính lại maxHp từ base + tổng hệ số */
  if (id === 'perm_hp') {
    p.up.maxHpMul = pr.upgrades.maxHpMul || 0;
    const newMax = Math.round(CFG.PLAYER.baseHp * (1 + p.up.maxHpMul));
    const gain = newMax - p.maxHp;
    p.maxHp = newMax;
    if (gain > 0) p.hp = Math.min(p.maxHp, p.hp + gain);
  }

  addToast(res.msg);
  Sound.sfx('shop');

  renderShop(game);
  if (game.updateHUD) game.updateHUD();
  if (window.VNXX && window.VNXX.Save) window.VNXX.Save.auto(game.profile);
}

/* =========================================================
   SELL
   ========================================================= */
function sellOne(game, it) {
  const pr = game.profile;
  const p = game.world.player;

  let ok = false;

  if (it.kind === 'module') {
    const cur = (pr.inventory.modules && pr.inventory.modules[it.id]) || 0;
    if (cur > 0) {
      pr.inventory.modules[it.id] = cur - 1;
      if (pr.inventory.modules[it.id] <= 0) delete pr.inventory.modules[it.id];
      ok = true;
    }
  } else if (it.kind === 'consumable') {
    const cur = (pr.inventory.consumables && pr.inventory.consumables[it.id]) || 0;
    if (cur > 0) {
      pr.inventory.consumables[it.id] = cur - 1;
      ok = true;
    }
  } else if (it.kind === 'weapon') {
    const i = pr.inventory.weapons.indexOf(it.id);
    if (i >= 0) {
      pr.inventory.weapons.splice(i, 1);
      if (pr.weapon === it.id) {
        pr.weapon = 'pistol';
        p.weaponId = 'pistol';
      }
      ok = true;
    }
  }

  if (!ok) return;

  p.credits += it.price;

  Sound.sfx('shop');
  addToast('BÁN: ' + it.name + ' +' + it.price + ' CR');

  if (game.recalcPlayerStats) game.recalcPlayerStats();

  renderShop(game);
  if (game.updateHUD) game.updateHUD();
  if (game.syncProfileFromWorld) game.syncProfileFromWorld();
  if (window.VNXX && window.VNXX.Save) window.VNXX.Save.auto(game.profile);
}

/* =========================================================
   HELPERS
   ========================================================= */
function getGame() {
  return _game || (window.VNXX && window.VNXX.Game) || null;
}

export default { initShopUI, openShop, closeShop, refreshShop, buyItem };
