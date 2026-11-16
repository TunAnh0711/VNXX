/* =========================================================
   VNXX — GAME / PROGRESS
   XP / Level up / Achievements / Sync profile / Stage clear.
   Nhận `game` làm tham số → không import Game.
   ========================================================= */

import { CFG, ST, DIFFICULTIES } from '../core/constants.js';
import { clamp, shuffle, rnd, esc } from '../core/utils.js';
import { UPGRADES, pickUpgrades } from '../data/upgrades.js';
import { checkNewAchievements } from '../data/achievements.js';
import { WEAPONS } from '../data/weapons.js';
import { moduleMods as calcModuleMods } from '../data/modules.js';
import {
  getStage, isLastStage, nextStage as nextStageData
} from '../data/stages.js';
import Sound from '../systems/sound.js';
import Save from '../systems/save.js';
import { Fx } from '../systems/fx.js';
import { showScreen, hideAllScreens } from '../ui/screens.js';
import { addToast } from '../ui/hud.js';

/* =========================================================
   XP CURVE
   ========================================================= */
export function xpForLevel(lv) {
  return Math.floor(CFG.XP_BASE * Math.pow(CFG.XP_GROWTH, lv - 1));
}

/* =========================================================
   MODULE MODS
   ========================================================= */
export function moduleMods(profile) {
  return calcModuleMods((profile && profile.equippedModules) || []);
}

/* =========================================================
   ADD XP + LEVEL UP LOOP
   ========================================================= */
export function addXp(game, W, amount) {
  if (!W || !W.player) return;

  const p = W.player;
  const diffMul = DIFFICULTIES[game.profile.difficulty].xp;
  const comboMul = W.combo ? W.combo.xpMult : 1;

  p.xp += amount * diffMul * (1 + p.up.luck * .3) * comboMul;

  let leveled = false;

  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.level++;
    p.xpNext = xpForLevel(p.level);
    game.pendingLevelUps++;
    leveled = true;
  }

  if (leveled) {
    game.profile.statistics.highestLevel = Math.max(
      game.profile.statistics.highestLevel,
      p.level
    );
    checkAchievements(game);
    queueLevelUp(game);
  }
}

/* =========================================================
   QUEUE LEVEL-UP SCREEN
   ========================================================= */
export function queueLevelUp(game) {
  if (game.pendingLevelUps <= 0) return;
  if (game.state === ST.LEVEL_UP) return;

  const blocked = [
    ST.SHOP, ST.INVENTORY, ST.PAUSED, ST.EVENT,
    ST.GAME_OVER, ST.HARDCORE_DEAD, ST.STAGE_CLEAR
  ];
  if (blocked.includes(game.state)) return;

  setTimeout(() => {
    if (!game.world) return;
    if (game.state === ST.LEVEL_UP) return;
    if (blocked.includes(game.state)) return;
    showLevelUp(game, game.world);
  }, 260);
}

/* =========================================================
   SHOW LEVEL-UP SCREEN
   ========================================================= */
export function showLevelUp(game, W) {
  if (game.pendingLevelUps <= 0) return;
  _lvChoiceLocked = false;

  /* Không có world/player → không thể hiển thị, ép resume để không bị đơ */
  if (!W || !W.player) { safeResume(game); return; }

  game.paused = true;
  if (game.state !== ST.LEVEL_UP) game._prevState = game.state;
  game.setState(ST.LEVEL_UP);

  const el = document.getElementById('levelupCards');
  if (!el) {
    console.warn('[progress] #levelupCards không tồn tại');
    safeResume(game);
    return;
  }

  let choices = [];
  try {
    choices = pickUpgrades(3, [], W.player.up ? (W.player.up.luck || 0) : 0);
  } catch (err) {
    console.warn('[progress] pickUpgrades thất bại:', err);
  }

  el.innerHTML = '';

  /* Không có lựa chọn nào → cho phép tiếp tục luôn, không kẹt màn hình */
  if (choices.length === 0) {
    safeResume(game);
    return;
  }

  const levelEl = document.getElementById('levelupLevel');
  if (levelEl) levelEl.textContent = 'LV ' + W.player.level;
  const pendingEl = document.getElementById('levelupPending');
  if (pendingEl) {
    pendingEl.textContent = game.pendingLevelUps + ' NÂNG CẤP ĐANG CHỜ';
  }

  const cards = [];
  const rarityNames = { common: 'THƯỜNG', rare: 'HIẾM', epic: 'SỬ THI' };
  choices.forEach((u, index) => {
    const rarity = ['rare', 'epic'].includes(u.rarity) ? u.rarity : 'common';
    const name = String(u.name || 'NÂNG CẤP');
    const desc = String(u.desc || '');
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'card upgrade-card ' + rarity;
    c.dataset.uid = u.id || '';
    c.setAttribute?.('aria-label', 'Chọn ' + name + '. ' + desc);
    c.innerHTML =
      '<span class="card-key">' + (index + 1) + '</span>' +
      '<span class="card-rarity">' + (rarityNames[rarity] || rarityNames.common) + '</span>' +
      '<div class="ci">' + esc(String(u.icon || '◆')) + '</div>' +
      '<div class="cn">' + esc(name) + '</div>' +
      '<div class="cd">' + esc(desc) + '</div>' +
      '<div class="card-choose"><span>CHỌN NÂNG CẤP</span><b>↵</b></div>';

    c.addEventListener('click', () => chooseUpgrade(game, W, u));
    el.appendChild(c);
    cards.push(c);
  });

  showScreen(ST.LEVEL_UP);
  try { Sound.sfx('levelup'); } catch (e) { /* noop */ }
  try { Fx.ring(W.particles, W.player.x, W.player.y, '#28e0ff', 140, .6); } catch (e) { /* noop */ }

  bindLevelUpKeys(game, W, cards);
}

/* Chọn 1 upgrade — chống double-click và luôn đảm bảo thoát dù có lỗi */
function chooseUpgrade(game, W, u) {
  if (_lvChoiceLocked || game.state !== ST.LEVEL_UP || !W || !W.player) return;
  _lvChoiceLocked = true;
  try {
    if (u && typeof u.apply === 'function') u.apply(W.player);

    if (!game.profile.pickedUpgradeIds) game.profile.pickedUpgradeIds = [];
    if (u && u.id) game.profile.pickedUpgradeIds.push(u.id);

    game.pendingLevelUps = Math.max(0, (game.pendingLevelUps || 1) - 1);

    try { Sound.sfx('levelup'); } catch (e) { /* noop */ }
    syncProfileFromWorld(game);
    Save.auto(game.profile);
  } catch (err) {
    console.warn('[progress] áp upgrade thất bại (vẫn tiếp tục):', err);
    /* Giảm số lượt để không bao giờ kẹt */
    game.pendingLevelUps = Math.max(0, (game.pendingLevelUps || 1) - 1);
  }

  if (game.pendingLevelUps > 0) {
    showLevelUp(game, W);
  } else {
    safeResume(game);
  }

  try { game.updateHUD(); } catch (e) { /* noop */ }
}

/* Khôi phục trạng thái chơi — hàm duy nhất đảm bảo không bị đơ */
function safeResume(game) {
  _lvChoiceLocked = false;
  unbindLevelUpKeys();
  try { game.setState(game._prevState || ST.PLAYING); } catch (e) { /* noop */ }
  try { hideAllScreens(); } catch (e) { /* noop */ }
  game.paused = false;
  try { game.updateHUD(); } catch (e) { /* noop */ }
}

/* =========================================================
   ĐIỀU KHIỂN BÀN PHÍM / CHUỘT / TOUCH
   1/2/3 chọn trực tiếp · mũi tên di chuyển · Enter xác nhận ·
   Esc tạm đóng. Button thật nên click/tap/Tab đều hoạt động.
   ========================================================= */
let _lvKeyHandler = null;
let _lvChoiceLocked = false;
let _lvActiveIndex = 0;

function setActiveCard(cards, index) {
  if (!cards.length) return;
  _lvActiveIndex = (index + cards.length) % cards.length;
  cards.forEach((c, i) => c.classList.toggle('selected', i === _lvActiveIndex));
  try { cards[_lvActiveIndex].focus({ preventScroll: true }); } catch (e) { /* noop */ }
}

function bindLevelUpKeys(game, W, cards) {
  unbindLevelUpKeys();
  setActiveCard(cards, 0);

  _lvKeyHandler = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      safeResume(game);
      return;
    }
    if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      const dir = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
      setActiveCard(cards, _lvActiveIndex + dir);
      return;
    }
    if (e.key === 'Enter') {
      if (cards[_lvActiveIndex]) {
        e.preventDefault();
        cards[_lvActiveIndex].click();
      }
      return;
    }
    if (['1', '2', '3'].includes(e.key)) {
      const i = parseInt(e.key, 10) - 1;
      if (cards[i]) {
        e.preventDefault();
        setActiveCard(cards, i);
        cards[i].click();
      }
    }
  };

  document.addEventListener('keydown', _lvKeyHandler);
}

function unbindLevelUpKeys() {
  if (_lvKeyHandler) {
    document.removeEventListener('keydown', _lvKeyHandler);
    _lvKeyHandler = null;
  }
}

/* =========================================================
   CHECK ACHIEVEMENTS
   ========================================================= */
export function checkAchievements(game) {
  const pr = game.profile;
  if (!pr) return;

  const stats = pr.statistics;
  const unlocked = pr.achievements || [];

  const newly = checkNewAchievements(stats, unlocked);
  if (newly.length === 0) return;

  for (const a of newly) {
    pr.achievements.push(a.id);
    addToast('🏆 THÀNH TÍCH: ' + a.name);
    Sound.sfx('achievement');
  }

  Save.write(pr);
}

/* =========================================================
   SYNC PROFILE FROM WORLD
   Ghi runtime state (HP, credits, wave...) từ world → profile.
   Bao gồm cả 12 stat mới từ upgrade system.
   ========================================================= */
export function syncProfileFromWorld(game) {
  const W = game.world;
  if (!W || !W.player) return;

  const p = W.player;
  const pr = game.profile;

  /* --- Runtime stats --- */
  pr.hp = Math.max(0, Math.round(p.hp));
  pr.maxHp = p.maxHp;
  pr.level = p.level;
  pr.xp = p.xp;
  pr.money = p.credits;
  pr.shards = p.shards;
  pr.weapon = p.weaponId;
  pr.currentStage = W.stage;
  pr.currentWave = W.wave;

  /* --- Shield / heal state --- */
  pr.shield = Math.round(p.shield || 0);
  pr.shieldMax = Math.round(p.shieldMax || 0);
  pr.noHeal = !!p.noHeal;
  pr.healMul = p.healMul != null ? p.healMul : 1;
  pr.shieldRegenEnabled = !!p.shieldRegenEnabled;

  /* --- Magazine --- */
  pr.baseMagazine = p.baseMagazine || 0;
  pr.magAmmo = p.magAmmo || 0;

  /* --- Statistics --- */
  pr.statistics.highestLevel = Math.max(pr.statistics.highestLevel, p.level);
  pr.statistics.highestWave = Math.max(pr.statistics.highestWave, W.wave);

  /* --- Upgrade deltas (base từ module đã trừ đi) --- */
  const up = pr.upgrades;
  const base = p.upBase || {};

  /* 10 stats cũ */
  up.damageMul      = p.up.damageMul      - (base.damageMul      || 0);
  up.speedMul       = p.up.speedMul       - (base.speedMul       || 0);
  up.critChance     = p.up.critChance     - (base.critChance     || 0);
  up.critMul        = p.up.critMul        - (base.critMul        || 0);
  up.armor          = p.up.armor          - (base.armor          || 0);
  up.lifesteal      = p.up.lifesteal      - (base.lifesteal      || 0);
  up.attackSpeedMul = p.up.attackSpeedMul - (base.attackSpeedMul || 0);
  up.luck           = p.up.luck           - (base.luck           || 0);
  up.rangeMul       = p.up.rangeMul       - (base.rangeMul       || 0);
  up.dodge          = p.up.dodge          - (base.dodge          || 0);

  /* 12 stats mới */
  up.reloadSpeedMul   = p.up.reloadSpeedMul   - (base.reloadSpeedMul   || 0);
  up.magazineMul      = p.up.magazineMul      - (base.magazineMul      || 0);
  up.shieldMaxMul     = p.up.shieldMaxMul     - (base.shieldMaxMul     || 0);
  up.pierceAdd        = p.up.pierceAdd        - (base.pierceAdd        || 0);
  up.splashMul        = p.up.splashMul        - (base.splashMul        || 0);
  up.spreadMul        = p.up.spreadMul        - (base.spreadMul        || 0);
  up.projSpeedMul     = p.up.projSpeedMul     - (base.projSpeedMul     || 0);
  up.armorPen         = p.up.armorPen         - (base.armorPen         || 0);
  up.elementDamageMul = p.up.elementDamageMul - (base.elementDamageMul || 0);
  up.dashCdMul        = p.up.dashCdMul        - (base.dashCdMul        || 0);
  up.dashDistanceMul  = p.up.dashDistanceMul  - (base.dashDistanceMul  || 0);
  up.regen            = p.up.regen            - (base.regen            || 0);

  /* 11 stats combat v2 */
  up.statusPowerMul   = p.up.statusPowerMul   - (base.statusPowerMul   || 0);
  up.statusDurMul     = p.up.statusDurMul     - (base.statusDurMul     || 0);
  up.poiseMul         = p.up.poiseMul         - (base.poiseMul         || 0);
  up.executeMul       = p.up.executeMul       - (base.executeMul       || 0);
  up.comboDmgMul      = p.up.comboDmgMul      - (base.comboDmgMul      || 0);
  up.comboWindowMul   = p.up.comboWindowMul   - (base.comboWindowMul   || 0);
  up.odGainMul        = p.up.odGainMul        - (base.odGainMul        || 0);
  up.odDurAdd         = p.up.odDurAdd         - (base.odDurAdd         || 0);
  up.chainAdd         = p.up.chainAdd         - (base.chainAdd         || 0);
  up.breakDmgMul      = p.up.breakDmgMul      - (base.breakDmgMul      || 0);
  up.killHeal         = p.up.killHeal         - (base.killHeal         || 0);

  /* extraStatus là mảng — lưu nguyên */
  up.extraStatus = Array.isArray(p.up.extraStatus) ? p.up.extraStatus.slice() : [];

  up.maxHpMul = (p.maxHp / CFG.PLAYER.baseHp) - 1;

  pr.timestamp = Date.now();
}

/* =========================================================
   ON BOSS DEFEATED
   ========================================================= */
export function onBossDefeated(game) {
  const pr = game.profile;
  if (!pr) return;

  pr.statistics.bossesKilled++;

  if (pr.difficulty === 'hardcore') {
    pr.statistics.hardcoreStages++;
  }

  checkAchievements(game);
  showStageClear(game);
}

/* =========================================================
   SHOW STAGE CLEAR
   ========================================================= */
export function showStageClear(game) {
  const W = game.world;
  if (!W) return;

  const pr = game.profile;
  const p = W.player;
  const stage = getStage(W.stage);

  game.setState(ST.STAGE_CLEAR);

  const bonusCr = 1500 * W.stage;
  const bonusShards = 2 + W.stage;

  p.credits += bonusCr;
  p.shards += bonusShards;
  pr.statistics.creditsEarned += bonusCr;

  const statsEl = document.getElementById('scStats');
  if (statsEl) {
    statsEl.innerHTML =
      statLine('STAGE', String(W.stage).padStart(2, '0') + ' — ' + stage.name) +
      statLine('WAVE', String(stage.waves) + ' CLEARED') +
      statLine('BOSS', '☠ ' + stage.boss + ' DEFEATED') +
      statLine('LEVEL', p.level) +
      statLine('KILLS', pr.statistics.kills) +
      statLine('PLAYTIME', fmtTime(pr.statistics.playTime));
  }

  let rewardHtml =
    '<div class="reward-line">+' + fmtNum(bonusCr) + ' CREDITS</div>' +
    '<div class="reward-line">+' + bonusShards + ' VOID SHARDS</div>';

  const unlocks = [];

  if (W.stage === 1 && !pr.unlockedWeapons.includes('shotgun')) {
    unlocks.push('shotgun');
  }
  if (W.stage === 2 && !pr.unlockedWeapons.includes('smg')) {
    unlocks.push('smg');
  }
  if (W.stage === 3 && !pr.unlockedWeapons.includes('rifle')) {
    unlocks.push('rifle');
  }
  if (pr.statistics.bossesKilled >= 3 &&
      !pr.unlockedWeapons.includes('railgun')) {
    unlocks.push('railgun');
  }
  if (W.stage >= 3 && !pr.unlockedWeapons.includes('voidw')) {
    unlocks.push('voidw');
  }

  unlocks.forEach((id) => {
    if (!pr.unlockedWeapons.includes(id)) {
      pr.unlockedWeapons.push(id);
      if (!pr.inventory.weapons.includes(id)) {
        pr.inventory.weapons.push(id);
      }
      rewardHtml +=
        '<div class="reward-line" style="color:#39ff9e">' +
        'VŨ KHÍ MỚI: ' + WEAPONS[id].name + '</div>';
    }
  });

  pr.statistics.weaponsUnlocked = pr.unlockedWeapons.length;

  const rewEl = document.getElementById('scRewards');
  if (rewEl) rewEl.innerHTML = rewardHtml;

  syncProfileFromWorld(game);
  Save.write(pr);

  Sound.startMusic('menu');

  showScreen(ST.STAGE_CLEAR);
}

/* =========================================================
   NEXT STAGE
   ========================================================= */
export function nextStage(game) {
  Sound.sfx('button');

  const pr = game.profile;
  if (!pr) return;

  if (isLastStage(pr.currentStage)) {
    alert(
      'BẠN ĐÃ HOÀN THÀNH TOÀN BỘ NỘI DUNG HIỆN CÓ CỦA VNXX.\n' +
      'HÃY THỬ ĐỘ KHÓ CAO HƠN HOẶC HARDCORE!'
    );
    game.toMainMenu();
    return;
  }

  /* BƯỚC 1: SYNC TRƯỚC */
  syncProfileFromWorld(game);

  if (game.world && game.world.player) {
    pr.money = game.world.player.credits;
    pr.shards = game.world.player.shards;
  }

  /* BƯỚC 2: TĂNG STAGE */
  const next = nextStageData(pr.currentStage);
  if (!next) {
    game.toMainMenu();
    return;
  }

  pr.currentStage = next.id;
  pr.currentWave = 1;
  pr.hp = pr.maxHp;

  game.pendingLevelUps = 0;

  /* BƯỚC 3: LƯU + CHUYỂN */
  Save.write(pr);
  game.world = null;
  game.startRun(pr, false);
}

/* =========================================================
   HELPERS
   ========================================================= */
function statLine(k, v) {
  return '<div class="stat-line"><span>' + k + '</span><span>' + v + '</span></div>';
}

function fmtNum(n) {
  return Math.floor(n).toLocaleString('en-US');
}

function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const p = (n) => String(n).padStart(2, '0');
  return (h > 0 ? p(h) + ':' : '') + p(m) + ':' + p(s);
}