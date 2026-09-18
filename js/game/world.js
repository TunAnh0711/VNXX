/* =========================================================
   VNXX — GAME / WORLD
   Khởi tạo world: player, obstacles, camera.
   Không import Game (nhận `game` làm tham số).
   ========================================================= */

import { CFG } from '../core/constants.js';
import { clamp, lerp, rnd, makeRNG } from '../core/utils.js';
import { getStage } from '../data/stages.js';

/* =========================================================
   HELPER: PICK RANDOM ITEM FROM ARRAY
   ========================================================= */
function pick(array) {
  if (!array || array.length === 0) return null;
  return array[Math.floor(Math.random() * array.length)];
}

/* =========================================================
   BUILD WORLD
   ========================================================= */
export function buildWorld(game, profile, isNew) {
  const stage = getStage(profile.currentStage);

  /* ---------- Khung world ---------- */
  const W = {
    stage: stage.id,
    wave: profile.currentWave || 1,
    w: 2600,
    h: 1900,
    obstacles: [],

    enemies: [],
    projectiles: [],
    loot: [],
    particles: [],
    texts: [],
    chests: [],
    beams: [], 

    player: null,
    boss: null,

    camera: { x: 0, y: 0, shake: 0, shakeT: 0 },

    /* Wave state */
    spawnQueue: [],
    spawnTimer: 0,
    waveActive: false,
    waveTimer: 0,
    waveDef: null,
    waveComplete: false,
    pendingWaveTimer: 0,

    /* Modifiers */
    time: 0,
    darkness: 0,
    lowGravity: false,

    stageDef: stage
  };

  /* ---------- Sinh obstacles ---------- */
  W.obstacles = genObstacles(game.seed, stage, W.w, W.h);

  /* ---------- Player ---------- */
  W.player = createPlayer(game, profile, isNew);

  /* ---------- Gán vào game ---------- */
  game.world = W;

  /* ---------- Bắt đầu wave hiện tại ---------- */
  game.startWave(W.wave);

  return W;
}

/* =========================================================
   CREATE PLAYER (từ profile + module mods)
   ========================================================= */
function createPlayer(game, profile, isNew) {
  const up = profile.upgrades || {};
  const mods = game.moduleMods(profile);

  const maxHp = Math.round(CFG.PLAYER.baseHp * (1 + (up.maxHpMul || 0)));

  const p = {
    /* Vị trí / vận tốc */
    x: 0, y: 0,
    vx: 0, vy: 0,
    radius: CFG.PLAYER.radius,

    /* Hướng */
    angle: -Math.PI / 2,

    /* HP */
    hp: isNew ? maxHp : clamp(profile.hp || maxHp, 1, maxHp),
    maxHp,
    shield: 0,
    shieldMax: 0,

    /* Progression */
    level: profile.level || 1,
    xp: profile.xp || 0,
    credits: profile.money || 0,
    shards: profile.shards || 0,
    xpNext: game.xpForLevel(profile.level || 1),

    /* Movement */
    speed: CFG.PLAYER.baseSpeed * (1 + (up.speedMul || 0) + mods.speedMul),

    /* Upgrades (đã gộp base + delta) */
    up: {
      damageMul:      (up.damageMul      || 0) + mods.damageMul,
      speedMul:       (up.speedMul       || 0) + mods.speedMul,
      critChance:     (up.critChance     || 0) + mods.critChance,
      critMul:        (up.critMul        || 0),
      armor:          clamp((up.armor    || 0) + mods.armor, 0, .75),
      lifesteal:      (up.lifesteal      || 0) + mods.lifesteal,
      attackSpeedMul: (up.attackSpeedMul || 0),
      luck:           (up.luck           || 0) + mods.luck,
      rangeMul:       (up.rangeMul       || 0),
      dodge:          clamp((up.dodge    || 0) + mods.dodge, 0, .6)
    },

    /* Baseline (chỉ từ module) — dùng để syncProfileFromWorld() tính delta */
    upBase: {
      damageMul:      mods.damageMul,
      speedMul:       mods.speedMul,
      critChance:     mods.critChance,
      critMul:        0,
      armor:          mods.armor,
      lifesteal:      mods.lifesteal,
      attackSpeedMul: 0,
      luck:           mods.luck,
      rangeMul:       0,
      dodge:          mods.dodge
    },

    /* Weapon */
    weaponId: profile.weapon || 'pistol',

    /* Cooldowns / timers */
    cooldown: 0,
    dashCd: 0,
    dashTime: 0,
    dashDir: { x: 0, y: 0 },
    invuln: 1.2,
    hitFlash: 0,
    attackAnim: 0,
    moveAnim: 0,

    /* Buffs */
    buffs: { dmg: 0, shield: 0, berserk: 0 },

    /* Runtime */
    kills: 0,
    alive: true
  };

  /* Đặt giữa map */
  /* W chưa tồn tại ở đây → set sau khi có W */
  p.x = 1300;
  p.y = 950;

  /* Nếu load từ save, ghi đè hp lại */
  if (!isNew) profile.hp = p.hp;

  return p;
}

/* =========================================================
   GEN OBSTACLES (deterministic theo seed + stage id)
   Mỗi stage có theme obstacles khác nhau:
   - Stage 1: container, pillar, machine (abandoned facility)
   - Stage 2: crate, furnace, conveyor (industrial zone)
   - Stage 3: barrier, neon_pillar, holo_wall (neon city)
   - Stage 4: debris, wreck, rubble (dead sector)
   - Stage 5: void_crystal, dark_pillar, energy_field (void core)
   ========================================================= */
export function genObstacles(seed, stage, w, h) {
  const rng = makeRNG(seed + stage.id * 7919);
  const obs = [];
  
  /* Số lượng obstacles tăng theo stage */
  const count = 12 + stage.id * 4;
  
  /* Pool obstacles theo stage */
  let obstaclePool = ['container', 'pillar', 'machine'];
  if (stage.id === 2) obstaclePool = ['crate', 'furnace', 'conveyor', 'barrel'];
  else if (stage.id === 3) obstaclePool = ['barrier', 'neon_pillar', 'holo_wall', 'sign'];
  else if (stage.id === 4) obstaclePool = ['debris', 'wreck', 'rubble', 'broken_wall'];
  else if (stage.id === 5) obstaclePool = ['void_crystal', 'dark_pillar', 'energy_field', 'core_fragment'];
  
  /* Thêm cây/bụi cây cho stage 2, 3 (có địa hình tự nhiên) */
  const hasVegetation = stage.id === 2 || stage.id === 3;
  const vegetationCount = hasVegetation ? Math.floor(count * 0.3) : 0;
  
  for (let i = 0; i < count; i++) {
    const isVegetation = hasVegetation && i < vegetationCount;
    
    /* Kích thước obstacles */
    const bw = rng() < .5 ? rnd(70, 180) : rnd(40, 90);
    const bh = rng() < .5 ? rnd(70, 180) : rnd(40, 90);
    const x = 60 + rng() * (w - 120 - bw);
    const y = 60 + rng() * (h - 120 - bh);

    /* Chừa vùng an toàn giữa map để player spawn */
    if (Math.abs(x + bw / 2 - w / 2) < 280 &&
        Math.abs(y + bh / 2 - h / 2) < 280) {
      continue;
    }

    /* Vegetation nhỏ hơn và có thể xuyên qua một phần */
    if (isVegetation) {
      const vegType = rng() < 0.5 ? 'bush' : 'tree';
      const vegRadius = vegType === 'tree' ? rnd(25, 40) : rnd(20, 30);
      
      obs.push({
        x, y, w: bw, h: bh,
        kind: vegType,
        radius: vegRadius,
        isVegetation: true,
        blockMovement: vegType === 'tree',  /* Cây chặn di chuyển, bụi không */
        blockVision: true                    /* Cả hai đều chặn tầm nhìn */
      });
    } else {
      const kind = pick(obstaclePool);
      obs.push({
        x, y, w: bw, h: bh,
        kind: kind,
        isVegetation: false,
        blockMovement: true,
        blockVision: kind !== 'energy_field'
      });
    }
  }
  
  return obs;
}

/* =========================================================
   POINT-IN-OBSTACLE (dùng khi spawn enemy để tránh kẹt)
   ========================================================= */
export function pointInObstacle(W, x, y, r = 0) {
  for (let i = 0; i < W.obstacles.length; i++) {
    const o = W.obstacles[i];
    if (x > o.x - r && x < o.x + o.w + r &&
        y > o.y - r && y < o.y + o.h + r) {
      return true;
    }
  }
  return false;
}

/* =========================================================
   COLLIDE WITH OBSTACLES (đẩy entity ra khỏi vật cản)
   Dùng cho player + enemy.
   Vegetation có thể không chặn di chuyển (bush) nhưng vẫn chặn tầm nhìn.
   ========================================================= */
export function collideWithObstacles(W, ent) {
  const r = ent.radius;
  for (let i = 0; i < W.obstacles.length; i++) {
    const o = W.obstacles[i];
    
    /* Bỏ qua vegetation không chặn di chuyển */
    if (o.isVegetation && !o.blockMovement) continue;

    const cx = clamp(ent.x, o.x, o.x + o.w);
    const cy = clamp(ent.y, o.y, o.y + o.h);
    const dx = ent.x - cx;
    const dy = ent.y - cy;
    const d2 = dx * dx + dy * dy;

    if (d2 < r * r) {
      const d = Math.sqrt(d2) || .0001;
      const push = (r - d) / d;
      ent.x += dx * push;
      ent.y += dy * push;

      /* Giảm vận tốc khi va chạm */
      if (ent.vx !== undefined) { ent.vx *= .4; ent.vy *= .4; }
    }
  }
}

/* =========================================================
   UPDATE CAMERA
   ========================================================= */
export function updateCamera(W, dt) {
  const p = W.player;
  W.camera.x = lerp(W.camera.x, p.x, clamp(dt * 7, 0, 1));
  W.camera.y = lerp(W.camera.y, p.y, clamp(dt * 7, 0, 1));

  if (W.camera.shake > 0) {
    W.camera.shake = Math.max(0, W.camera.shake - dt * 26);
  }
}