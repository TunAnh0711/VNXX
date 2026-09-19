/* =========================================================
   VNXX — GAME / WAVES
   Quản lý wave: bắt đầu, spawn queue, objective, complete.
   Nhận `game` và `W` làm tham số → không import Game.
   ========================================================= */

import { CFG, DIFFICULTIES } from '../core/constants.js';
import { clamp, rnd, pick, shuffle } from '../core/utils.js';
import {
  getStage, isBossWave
} from '../data/stages.js';
import {
  rollWaveEvent, applyWaveEvent
} from '../data/wave-events.js';
import Settings from '../core/settings.js';
import Sound from '../systems/sound.js';
import { FloatText } from '../systems/fx.js';

import { spawnFromQueue, spawnEnemy } from './enemy.js';
import { spawnBoss } from './boss.js';
import { spawnChest } from './loot.js';

/* =========================================================
   START WAVE
   ========================================================= */
export function startWave(game, W, n) {
  W.wave = n;
  W.waveActive = true;
  W.waveComplete = false;
  W.enemies.length = 0;
  W.projectiles.length = 0;
  W.loot.length = 0;
  W.spawnQueue = [];
  W.spawnTimer = 0;
  W.pendingWaveTimer = 0;
  W.boss = null;
  game.hideBossBar && game.hideBossBar();

  game.profile.currentWave = n;

  const stage = getStage(W.stage);
  const bossWave = isBossWave(W.stage, n);

  /* ============ BOSS WAVE ============ */
  if (bossWave) {
    game.setState(game._state?.BOSS || 'BOSS');
    spawnBoss(game, W, stage.boss);
    game.showBossBar && game.showBossBar(stage.boss);
    Sound.startMusic('boss');
    W.waveDef = {
      boss: true,
      objective: 'DEFEAT_BOSS',
      objectiveText: 'ĐÁNH BẠI BOSS'
    };
    game.updateHUD();
    return;
  }

  /* ============ THƯỜNG WAVE ============ */
  game.setState(game._state?.PLAYING || 'PLAYING');

  const def = makeWaveDef(game, W, W.stage, n);
  W.waveDef = def;

  /* Environment modifiers */
  W.darkness = def.event && def.event.darkness ? 1 : 0;
  W.lowGravity = !!(def.event && def.event.lowGravity);

  const eventTextEl = document.getElementById('eventText');
  if (eventTextEl) {
    eventTextEl.textContent = def.event
      ? '⚠ ' + def.event.name + ' — ' + def.event.desc
      : '';
  }

  /* Build spawn queue từ pool + budget */
  const pool = def.event && def.event.forceType
    ? [def.event.forceType]
    : stage.pool;

  buildSpawnQueue(game, W, def, pool);

  /* Đếm elite ngẫu nhiên */
  const eliteCount = def.event && def.event.eliteOnly
    ? Math.max(2, Math.floor(W.spawnQueue.length * .35))
    : (Math.random() < def.eliteChance ? 1 : 0);

  for (let i = 0; i < eliteCount; i++) {
    W.spawnQueue.push('ELITE_' + pick(pool));
  }

  shuffle(W.spawnQueue);
  W.spawnTimer = .4;

  /* Timer cho objective SURVIVE */
  if (def.objective === 'SURVIVE') {
    W.waveTimer = def.surviveTime || 45;
  } else {
    W.waveTimer = 0;
  }

  /* Chest ngẫu nhiên (hoặc luôn có nếu SUPPLY) */
  if (Math.random() < .45 ||
      (def.event && def.event.id === 'SUPPLY')) {
    const isLegendary = Math.random() < .12;
    const isRare = Math.random() < .35;
    spawnChest(
      W,
      clamp(W.player.x + rnd(-320, 320), 80, W.w - 80),
      clamp(W.player.y + rnd(-320, 320), 80, W.h - 80),
      isLegendary ? 'legendary' : (isRare ? 'rare' : 'common')
    );
  }

  /* Toast thông báo */
  if (typeof window.addToast === 'function') {
    window.addToast(
      'WAVE ' + String(n).padStart(2, '0') + ' — ' + def.objectiveText
    );
  }

  game.updateHUD();
}

/* =========================================================
   BUILD SPAWN QUEUE
   Mỗi loại quái có "cost": swarm=1, chase=2, assassin=4, tank=5...
   Duyệt ngẫu nhiên cho tới khi hết budget.
   ========================================================= */
function buildSpawnQueue(game, W, def, pool) {
  let budget = def.budget;
  let guard = 0;

  while (budget > 0 && guard < 300) {
    guard++;
    const type = pick(pool);
    const cost = queueCost(type);

    if (cost > budget && W.spawnQueue.length > 0) break;

    W.spawnQueue.push(type);
    budget -= cost;
  }
}

/** Chi phí "budget" cho từng enemy type. */
function queueCost(type) {
  if (type === 'swarm')    return 1;
  if (type === 'tank')     return 5;
  if (type === 'assassin') return 4;
  if (type === 'exploder') return 3;
  if (type === 'shield')   return 3;
  if (type === 'shooter')  return 2;
  return 2;    // drone, runner
}

/* =========================================================
   MAKE WAVE DEF
   Tính budget, spawnInterval, elite chance, objective, event.
   ========================================================= */
export function makeWaveDef(game, W, stageIdx, wave) {
  const d = DIFFICULTIES[game.profile.difficulty];

  /* --- Budget --- */
  let budget = Math.round(
    (7 + wave * 3.4) * d.count * (1 + (stageIdx - 1) * .30)
  );

  /* --- Spawn interval --- */
  let spawnInterval = Math.max(
    .12,
    (0.85 - wave * 0.035) * d.spawnInterval
  );

  /* --- Elite chance --- */
  let eliteChance = (0.06 + wave * 0.012) * d.eliteChance;

  /* --- Objective --- */
  let objective = 'KILL_ALL';
  let objectiveText = 'TIÊU DIỆT TOÀN BỘ';
  let surviveTime = 0;

  const r = Math.random();
  if (r < .16 && wave > 2) {
    objective = 'SURVIVE';
    surviveTime = Math.round(35 + wave * 2.5);
    objectiveText = 'SỐNG SÓT ' + surviveTime + ' GIÂY';
  } else if (r < .28 && wave > 3) {
    objective = 'KILL_N';
    objectiveText = 'TIÊU DIỆT ' + Math.ceil(budget * 1.4) + ' KẺ ĐỊCH';
  }

  /* --- Wave event --- */
  const event = rollWaveEvent(wave, game._lastEventId || null);
  if (event) {
    game._lastEventId = event.id;
    const applied = applyWaveEvent({ budget, spawnInterval, event });
    budget = applied.budget;
    spawnInterval = applied.spawnInterval;
  }

  return {
    budget,
    spawnInterval,
    eliteChance,
    objective,
    objectiveText,
    surviveTime,
    event,
    lootMul: event && event.lootMul ? event.lootMul : 1,
    killTarget: objective === 'KILL_N' ? Math.ceil(budget * 1.4) : 0
  };
}

/* =========================================================
   UPDATE WAVE (mỗi frame)
   Xử lý spawn queue + check hoàn thành.
   ========================================================= */
export function updateWave(game, W, dt) {
  if (!W.waveActive) return;

  const def = W.waveDef;
  if (!def) return;

  /* ---------- Spawn từ queue ---------- */
  if (W.spawnQueue.length > 0) {
    W.spawnTimer -= dt;
    if (W.spawnTimer <= 0) {
      W.spawnTimer = def.spawnInterval;

      const tag = W.spawnQueue.pop();
      spawnFromQueue(game, W, tag);

      /* Swarm spawn theo cụm */
      if (tag === 'swarm' &&
          W.spawnQueue.length > 0 &&
          Math.random() < .6) {
        const extra = W.spawnQueue.pop();
        spawnFromQueue(game, W, extra);
      }
    }
  }

  /* ---------- Check complete ---------- */
  let done = false;

  if (def.objective === 'SURVIVE') {
    W.waveTimer -= dt;
    if (W.waveTimer <= 0) done = true;
  } else if (def.objective === 'KILL_N') {
    if (W.player.kills >= def.killTarget) done = true;
  } else {
    /* KILL_ALL */
    if (W.spawnQueue.length === 0 &&
        W.enemies.length === 0 &&
        !W.boss) {
      done = true;
    }
  }

  /* Fallback: nếu hết quái + queue rỗng thì luôn done (trừ boss) */
  if (!done &&
      W.spawnQueue.length === 0 &&
      W.enemies.length === 0 &&
      !W.boss) {
    done = true;
  }

  if (done) completeWaveWithStageTransition(game, W);
}

/* =========================================================
   COMPLETE WAVE
   Trao thưởng, sync profile, mở shop hoặc start wave tiếp.
   ========================================================= */
export function completeWave(game, W) {
  if (W.waveComplete) return;
  W.waveComplete = true;
  W.waveActive = false;

  const d = DIFFICULTIES[game.profile.difficulty];
  const stage = getStage(W.stage);
  const lootMul = (W.waveDef.lootMul || 1) * d.loot;

  /* ---------- Rewards ---------- */
  const reward = Math.round((110 + W.wave * 22) * W.stage * lootMul);
  const p = W.player;
  p.credits += reward;

  game.profile.statistics.creditsEarned += reward;
  game.profile.statistics.wavesCleared++;
  game.profile.statistics.highestWave = Math.max(
    game.profile.statistics.highestWave,
    W.wave
  );

  game.addXp(Math.round(28 + W.wave * 7));

  if (typeof window.addToast === 'function') {
    window.addToast('WAVE CLEARED  +' + reward.toLocaleString('en-US') + ' CR');
  }
  FloatText.add(W.texts, p.x, p.y - 50, 'WAVE CLEAR!', '#39ff9e', 20);
  Sound.sfx('levelup');

  /* ---------- Persist ---------- */
  game.syncProfileFromWorld();
  if (window.VNXX?.Save) window.VNXX.Save.auto(game.profile);
  game.checkAchievements();

  /* ---------- Next step ---------- */
  const isLastWave = W.wave >= stage.waves;

  if (isLastWave) {
    /* Chuyển sang boss wave */
    setTimeout(() => {
      if (!game.world) return;
      if (game.state === 'GAME_OVER' || game.state === 'HARDCORE_DEAD') return;
      startWave(game, W, W.wave + 1);
    }, 2600);
    return;
  }

  /* Cứ 3 wave mở shop */
  if (W.wave % 3 === 0) {
    setTimeout(() => {
      if (!game.world) return;
      if (game.state === 'GAME_OVER' || game.state === 'HARDCORE_DEAD') return;
      game.openShop(function () {
        startWave(game, W, W.wave + 1);
      });
    }, 1200);
  } else {
    setTimeout(() => {
      if (!game.world) return;
      if (game.state === 'GAME_OVER' || game.state === 'HARDCORE_DEAD') return;
      startWave(game, W, W.wave + 1);
    }, 2400);
  }
}

/* =========================================================
   COMPLETE WAVE - XỬ LÝ CHUYỂN STAGE SAU KHI ĐÁNH BOSS
   Sau khi đánh bại boss (wave > stage.waves), chuyển sang stage tiếp theo
   ========================================================= */
export function completeWaveWithStageTransition(game, W) {
  if (W.waveComplete) return;
  W.waveComplete = true;
  W.waveActive = false;

  const d = DIFFICULTIES[game.profile.difficulty];
  const stage = getStage(W.stage);
  const lootMul = (W.waveDef.lootMul || 1) * d.loot;

  /* ---------- Rewards ---------- */
  const reward = Math.round((110 + W.wave * 22) * W.stage * lootMul);
  const p = W.player;
  p.credits += reward;

  game.profile.statistics.creditsEarned += reward;
  game.profile.statistics.wavesCleared++;
  game.profile.statistics.highestWave = Math.max(
    game.profile.statistics.highestWave,
    W.wave
  );

  game.addXp(Math.round(28 + W.wave * 7));

  if (typeof window.addToast === 'function') {
    window.addToast('WAVE CLEARED  +' + reward.toLocaleString('en-US') + ' CR');
  }
  FloatText.add(W.texts, p.x, p.y - 50, 'WAVE CLEAR!', '#39ff9e', 20);
  Sound.sfx('levelup');

  /* ---------- Persist ---------- */
  game.syncProfileFromWorld();
  if (window.VNXX?.Save) window.VNXX.Save.auto(game.profile);
  game.checkAchievements();

  /* ---------- Kiểm tra có phải vừa đánh boss không ---------- */
  const isBossWaveNow = W.wave > stage.waves;
  
  if (isBossWaveNow) {
    /* Đã đánh bại boss → chuyển stage hoặc kết thúc game */
    setTimeout(() => {
      if (!game.world) return;
      if (game.state === 'GAME_OVER' || game.state === 'HARDCORE_DEAD') return;
      
      /* Gọi onBossDefeated để hiển thị màn hình stage clear */
      if (game.onBossDefeated) {
        game.onBossDefeated();
      }
    }, 1500);
    return;
  }

  /* Wave thường → tiếp tục wave sau */
  const isLastRegularWave = W.wave >= stage.waves;
  
  if (isLastRegularWave) {
    /* Đây là wave cuối trước boss → chuẩn bị boss wave */
    setTimeout(() => {
      if (!game.world) return;
      if (game.state === 'GAME_OVER' || game.state === 'HARDCORE_DEAD') return;
      startWave(game, W, W.wave + 1);
    }, 2600);
    return;
  }

  /* Cứ 3 wave mở shop */
  if (W.wave % 3 === 0) {
    setTimeout(() => {
      if (!game.world) return;
      if (game.state === 'GAME_OVER' || game.state === 'HARDCORE_DEAD') return;
      game.openShop(function () {
        startWave(game, W, W.wave + 1);
      });
    }, 1200);
  } else {
    setTimeout(() => {
      if (!game.world) return;
      if (game.state === 'GAME_OVER' || game.state === 'HARDCORE_DEAD') return;
      startWave(game, W, W.wave + 1);
    }, 2400);
  }
}

/* Export completeWave alias cho backward compatibility */
export function completeWave(game, W) {
  completeWaveWithStageTransition(game, W);
}