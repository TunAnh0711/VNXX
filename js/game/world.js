/* =========================================================
   VNXX — GAME / WORLD
   Khởi tạo world: player, map (obstacles/hazards/props), camera,
   combo + overdrive state.
   ========================================================= */

import { CFG } from '../core/constants.js';
import { clamp, lerp, rnd, makeRNG } from '../core/utils.js';
import { getStage } from '../data/stages.js';
import { getWeapon } from '../data/weapons.js';
import { generateMap } from './mapgen.js';
import { createCombo } from '../systems/combo.js';
import { createOverdrive } from './overdrive.js';

/* =========================================================
   BUILD WORLD
   ========================================================= */
export function buildWorld(game, profile, isNew) {
  const stage = getStage(profile.currentStage);

  const W = {
    stage: stage.id,
    wave: profile.currentWave || 1,
    w: 2800,
    h: 2000,

    obstacles: [],
    hazards: [],
    props: [],

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

    /* Meta combat state */
    combo: createCombo(),
    overdrive: createOverdrive(),

    /* Modifiers */
    time: 0,
    darkness: 0,
    lowGravity: false,

    stageDef: stage
  };

  /* ---------- Map ---------- */
  const map = generateMap(game.seed, stage, W.w, W.h);
  W.obstacles = map.obstacles;
  W.hazards = map.hazards;
  W.props = map.props;

  /* ---------- Player ---------- */
  W.player = createPlayer(game, profile, isNew);

  /* ---------- Gán ---------- */
  game.world = W;

  /* ---------- Wave ---------- */
  game.startWave(W.wave);

  return W;
}

/* =========================================================
   CREATE PLAYER
   ========================================================= */
function createPlayer(game, profile, isNew) {
  const up = profile.upgrades || {};
  const mods = game.moduleMods(profile);

  const maxHp = Math.round(CFG.PLAYER.baseHp * (1 + (up.maxHpMul || 0)));

  const p = {
    x: 0, y: 0,
    vx: 0, vy: 0,
    radius: CFG.PLAYER.radius,

    angle: -Math.PI / 2,

    hp: isNew ? maxHp : clamp(profile.hp || maxHp, 1, maxHp),
    maxHp,
    shield: 0,
    shieldMax: 0,

    level: profile.level || 1,
    xp: profile.xp || 0,
    credits: profile.money || 0,
    shards: profile.shards || 0,
    xpNext: game.xpForLevel(profile.level || 1),

    speed: CFG.PLAYER.baseSpeed * (1 + (up.speedMul || 0) + mods.speedMul),

    up: {
      /* core */
      damageMul:      (up.damageMul      || 0) + mods.damageMul,
      speedMul:       (up.speedMul       || 0) + mods.speedMul,
      critChance:     (up.critChance     || 0) + mods.critChance,
      critMul:        (up.critMul        || 0),
      armor:          clamp((up.armor    || 0) + mods.armor, 0, .85),
      lifesteal:      (up.lifesteal      || 0) + mods.lifesteal,
      attackSpeedMul: (up.attackSpeedMul || 0),
      luck:           (up.luck           || 0) + mods.luck,
      rangeMul:       (up.rangeMul       || 0),
      dodge:          clamp((up.dodge    || 0) + mods.dodge, 0, .85),

      /* magazine */
      maxHpMul:        (up.maxHpMul        || 0),
      reloadSpeedMul:  (up.reloadSpeedMul  || 0),
      magazineMul:     (up.magazineMul     || 0),
      shieldMaxMul:    (up.shieldMaxMul    || 0),
      pierceAdd:       (up.pierceAdd       || 0),
      splashMul:       (up.splashMul       || 0),
      spreadMul:       (up.spreadMul       || 0),
      projSpeedMul:    (up.projSpeedMul    || 0),
      armorPen:        clamp((up.armorPen  || 0), 0, .9),
      elementDamageMul:(up.elementDamageMul|| 0),
      dashCdMul:       (up.dashCdMul       || 0),
      dashDistanceMul: (up.dashDistanceMul || 0),
      regen:           (up.regen           || 0),

      /* combat v2 */
      statusPowerMul:  (up.statusPowerMul  || 0),
      statusDurMul:    (up.statusDurMul    || 0),
      poiseMul:        (up.poiseMul        || 0),
      executeMul:      (up.executeMul      || 0),
      comboDmgMul:     (up.comboDmgMul     || 0),
      comboWindowMul:  (up.comboWindowMul  || 0),
      odGainMul:       (up.odGainMul       || 0),
      odDurAdd:        (up.odDurAdd        || 0),
      chainAdd:        (up.chainAdd        || 0),
      breakDmgMul:     (up.breakDmgMul     || 0),
      killHeal:        (up.killHeal        || 0),
      extraStatus:     Array.isArray(up.extraStatus) ? up.extraStatus.slice() : []
    },

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
      dodge:          mods.dodge,

      maxHpMul:        0,
      reloadSpeedMul:  0,
      magazineMul:     0,
      shieldMaxMul:    0,
      pierceAdd:       0,
      splashMul:       0,
      spreadMul:       0,
      projSpeedMul:    0,
      armorPen:        0,
      elementDamageMul:0,
      dashCdMul:       0,
      dashDistanceMul: 0,
      regen:           0,

      statusPowerMul:  0,
      statusDurMul:    0,
      poiseMul:        0,
      executeMul:      0,
      comboDmgMul:     0,
      comboWindowMul:  0,
      odGainMul:       0,
      odDurAdd:        0,
      chainAdd:        0,
      breakDmgMul:     0,
      killHeal:        0,
      extraStatus:     []
    },

    weaponId: profile.weapon || 'pistol',

    magAmmo: 0,
    magMax: 0,
    baseMagazine: 0,
    reloading: false,
    reloadTimer: 0,
    reloadDuration: 0,

    healMul: 1,
    noHeal: false,
    shieldRegenEnabled: false,
    shieldRegenTimer: 0,
    shieldRegenDelay: 3,

    cooldown: 0,
    dashCd: 0,
    dashTime: 0,
    dashDir: { x: 0, y: 0 },
    invuln: 1.2,
    hitFlash: 0,
    attackAnim: 0,
    moveAnim: 0,

    buffs: { dmg: 0, shield: 0, berserk: 0 },

    st: Object.create(null),
    statusTint: null,

    kills: 0,
    alive: true
  };

  p.x = 1400;
  p.y = 1000;

  if (!isNew) profile.hp = p.hp;

  /* Magazine */
  const _w = getWeapon(p.weaponId);
  p.baseMagazine = _w.magazine || 0;
  p.magMax = applyMagazineMul(p.baseMagazine, p.up.magazineMul);
  p.magAmmo = p.magMax;
  p.reloadDuration = _w.reloadTime || 0;

  /* Restore flags */
  if (!isNew) {
    if (profile.shield != null) p.shield = Math.min(profile.shield, p.shieldMax);
    if (profile.shieldMax) p.shieldMax = profile.shieldMax;
    if (profile.noHeal != null) p.noHeal = profile.noHeal;
    if (profile.healMul != null) p.healMul = profile.healMul;
    if (profile.shieldRegenEnabled != null) {
      p.shieldRegenEnabled = profile.shieldRegenEnabled;
    }
  }

  if (p.shieldMax > 0 && p.shield === 0) p.shield = p.shieldMax;

  return p;
}

/* =========================================================
   HELPER
   ========================================================= */
export function applyMagazineMul(base, mul) {
  if (!base || base <= 0) return 0;
  const factor = Math.max(0.2, 1 + (mul || 0));
  return Math.max(1, Math.round(base * factor));
}

/* =========================================================
   LEGACY: genObstacles (giữ để tương thích nếu nơi khác gọi)
   ========================================================= */
export function genObstacles(seed, stage, w, h) {
  const map = generateMap(seed, stage, w, h);
  return map.obstacles;
}

/* =========================================================
   POINT-IN-OBSTACLE
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
   COLLIDE
   ========================================================= */
export function collideWithObstacles(W, ent) {
  const r = ent.radius;
  for (let i = 0; i < W.obstacles.length; i++) {
    const o = W.obstacles[i];

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

      if (ent.vx !== undefined) { ent.vx *= .4; ent.vy *= .4; }
    }
  }
}

/* =========================================================
   CAMERA
   ========================================================= */
export function updateCamera(W, dt) {
  const p = W.player;
  W.camera.x = lerp(W.camera.x, p.x, clamp(dt * 7, 0, 1));
  W.camera.y = lerp(W.camera.y, p.y, clamp(dt * 7, 0, 1));

  if (W.camera.shake > 0) {
    W.camera.shake = Math.max(0, W.camera.shake - dt * 26);
  }
}
