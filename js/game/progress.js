/* =========================================================
   VNXX — GAME / PROGRESS
   XP / Level up / Achievements / Sync profile / Stage clear.
   Nhận `game` làm tham số → không import Game.
   ========================================================= */

import { CFG, ST, DIFFICULTIES } from '../core/constants.js';
import { clamp, shuffle, rnd } from '../core/utils.js';
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
   MODULE MODS (wrapper qua data helper)
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

  /* Luck tăng XP nhận vào thêm 30% */
  p.xp += amount * diffMul * (1 + p.up.luck * .3);

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
   Delay 260ms để không đè lên animation level up.
   ========================================================= */
export function queueLevelUp(game) {
  if (game.pendingLevelUps <= 0) return;
  if (game.state === ST.LEVEL_UP) return;

  /* Không schedule khi đang ở state khác — sẽ retry sau khi thoát */
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
   Pick 3 upgrade random, render cards, bind click.
   ========================================================= */
export function showLevelUp(game, W) {
  if (game.pendingLevelUps <= 0) return;

  game.paused = true;
  if (game.state !== ST.LEVEL_UP) game._prevState = game.state;
  game.setState(ST.LEVEL_UP);

  const choices = pickUpgrades(3);
  const el = document.getElementById('levelupCards');
  if (!el) {
    console.warn('[progress] #levelupCards không tồn tại');
    return;
  }

  el.innerHTML = '';

  choices.forEach((u) => {
    const c = document.createElement('div');
    c.className = 'card';
    c.innerHTML =
      '<div class="ci">' + u.icon + '</div>' +
      '<div class="cn">' + u.name + '</div>' +
      '<div class="cd">' + u.desc + '</div>';

    c.addEventListener('click', () => {
      /* Áp dụng upgrade */
      u.apply(W.player);
      game.pendingLevelUps--;

      Sound.sfx('levelup');
      syncProfileFromWorld(game);
      Save.auto(game.profile);

      /* Còn pending → show tiếp, ngược lại đóng */
      if (game.pendingLevelUps > 0) {
        showLevelUp(game, W);
      } else {
        game.setState(game._prevState || ST.PLAYING);
        hideAllScreens();
        game.paused = false;
      }

      game.updateHUD();
    });

    el.appendChild(c);
  });

  showScreen(ST.LEVEL_UP);
  Sound.sfx('levelup');
  Fx.ring(W.particles, W.player.x, W.player.y, '#28e0ff', 140, .6);
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

  /* --- Statistics --- */
  pr.statistics.highestLevel = Math.max(pr.statistics.highestLevel, p.level);
  pr.statistics.highestWave = Math.max(pr.statistics.highestWave, W.wave);

  /* --- Upgrade deltas (base từ module đã trừ đi) --- */
  const up = pr.upgrades;
  const base = p.upBase || {};

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

  /* ---------- Rewards ---------- */
  const bonusCr = 1500 * W.stage;
  const bonusShards = 2 + W.stage;

  p.credits += bonusCr;
  p.shards += bonusShards;
  pr.statistics.creditsEarned += bonusCr;

  /* ---------- Stats panel ---------- */
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

  /* ---------- Reward HTML + weapon unlocks ---------- */
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

  /* ---------- Persist + music ---------- */
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

  /* ---------- Đã hết stage ---------- */
  if (isLastStage(pr.currentStage)) {
    alert(
      'BẠN ĐÃ HOÀN THÀNH TOÀN BỘ NỘI DUNG HIỆN CÓ CỦA VNXX.\n' +
      'HÃY THỬ ĐỘ KHÓ CAO HƠN HOẶC HARDCORE!'
    );
    game.toMainMenu();
    return;
  }

  /* ---------- Sang stage kế ---------- */
  const next = nextStageData(pr.currentStage);

  pr.currentStage = next.id;
  pr.currentWave = 1;
  pr.hp = pr.maxHp;

  if (game.world) {
    pr.money = game.world.player.credits;
    pr.shards = game.world.player.shards;
  }

  syncProfileFromWorld(game);
  Save.write(pr);

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