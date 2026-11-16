/* =========================================================
VNXX — RENDER / DRAW-ENTITIES
Player + remote + enemy variants + 5 BOSS unique
+ projectile + loot + chest.
Pure functions, không phụ thuộc Game.
========================================================= */
import { CFG } from '../core/constants.js';
import { TAU, polyPath, starPath, energyRing } from '../core/utils.js';
import { WEAPONS } from '../data/weapons.js';
import { getSkin } from '../data/skins.js';
import Wardrobe from '../systems/wardrobe.js';

/* =========================================================
HEX PATH
========================================================= */
function hexPath(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = rot + i * Math.PI / 3;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/* =========================================================
DETERMINISTIC HELPERS
========================================================= */
function hashString(value) {
  const s = String(value ?? 'enemy');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seeded(value, salt = 0) {
  let x = (hashString(value) + salt * 2654435761) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 2246822507);
  x ^= x >>> 13;
  x = Math.imul(x, 3266489909);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967295;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

function entityKey(e) {
  return String(
    e.visualId ??
    e.enemyType ??
    e.type ??
    e.kind ??
    e.variant ??
    e.id ??
    e.name ??
    'enemy'
  );
}

/* =========================================================
DRAW HELPERS
========================================================= */
function drawEye(ctx, x, y, rx, ry, angle, color, pupil = '#080b12') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowBlur = Math.max(5, rx * 1.5);
  ctx.shadowColor = color;
  ctx.fillStyle = '#f7fbff';
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = pupil;
  ctx.beginPath();
  ctx.ellipse(rx * .28, 0, Math.max(1, rx * .34), Math.max(1, ry * .62), 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(rx * .36, -ry * .22, Math.max(1, rx * .12), 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawCrystal(ctx, x, y, r, angle, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowBlur = 12;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * .52, -r * .25);
  ctx.lineTo(r * .35, r);
  ctx.lineTo(-r * .42, r * .58);
  ctx.lineTo(-r * .58, -r * .3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.globalAlpha = .55;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -r * .72);
  ctx.lineTo(0, r * .65);
  ctx.moveTo(-r * .42, -r * .25);
  ctx.lineTo(r * .32, r * .08);
  ctx.stroke();
  ctx.restore();
}

function drawRingedCore(ctx, x, y, r, color, t, rings = 2) {
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < rings; i++) {
    ctx.globalAlpha = .28 - i * .05;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 + i;
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.ellipse(
      0, 0,
      r * (1.3 + i * .22),
      r * (.55 + i * .13),
      t * (i % 2 ? -1 : 1),
      0, TAU
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.shadowBlur = 18;
  ctx.shadowColor = color;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-r * .25, -r * .25, r * .28, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/* =========================================================
ARCHETYPES & STYLING
========================================================= */
const ENEMY_ARCHETYPES = {
  drone:    { palette: ['#39d9ff', '#1479a8', '#071d2b'], shape: 'drone',    accent: '#bff7ff' },
  runner:   { palette: ['#ffea00', '#a89800', '#2b2700'], shape: 'runner',   accent: '#fff8a6' },
  swarm:    { palette: ['#a56cff', '#55238e', '#160b2a'], shape: 'swarm',    accent: '#eadcff' },
  shooter:  { palette: ['#ffffff', '#6e7a85', '#13181c'], shape: 'shooter',  accent: '#a6e1ff' },
  assassin: { palette: ['#54ffb0', '#08734a', '#031b12'], shape: 'assassin', accent: '#c8ffe5' },
  exploder: { palette: ['#ff4040', '#8a1111', '#2e0202'], shape: 'exploder', accent: '#ffb3b3' },
  tank:     { palette: ['#ff9d3d', '#7a3d13', '#1d0e06'], shape: 'tank',     accent: '#ffe0a6' },
  shield:   { palette: ['#2e8fff', '#0a438c', '#021226'], shape: 'shield',   accent: '#9ed3ff' },
  spitter:  { palette: ['#ff6a00', '#853200', '#1f0b00'], shape: 'spitter',  accent: '#ffcda6' },
  bomber:   { palette: ['#a0ff2b', '#48850a', '#122601'], shape: 'bomber',   accent: '#dcffb3' }
};

function inferEnemyArchetype(keyStr) {
  if (keyStr.includes('BOSS')) return 'boss';
  if (keyStr.includes('RUNNER')) return 'runner';
  if (keyStr.includes('SWARM')) return 'swarm';
  if (keyStr.includes('SHOOTER')) return 'shooter';
  if (keyStr.includes('ASSASSIN')) return 'assassin';
  if (keyStr.includes('EXPLODER') || keyStr.includes('KAMIKAZE')) return 'exploder';
  if (keyStr.includes('TANK')) return 'tank';
  if (keyStr.includes('SHIELD')) return 'shield';
  if (keyStr.includes('FIRE_SPITTER') || keyStr.includes('ICE_SPITTER')) return 'spitter';
  if (keyStr.includes('POISON_BOMBER') || keyStr.includes('SLOW_THROWER')) return 'bomber';
  return 'drone';
}

function getEnemyStyle(e) {
  const key = entityKey(e).toUpperCase();
  const archetypeName = e.visualArchetype
    ? String(e.visualArchetype).toLowerCase()
    : inferEnemyArchetype(key);
  const base = ENEMY_ARCHETYPES[archetypeName] || ENEMY_ARCHETYPES.drone;

  const style = JSON.parse(JSON.stringify(base));
  style.archetype = archetypeName;
  style.key = key;

  /* Boss summon — override palette theo boss */
  if (e.visualTint) {
    style.palette = [e.visualTint, '#1a0a10', '#050202'];
    style.accent = '#ffffff';
  }

  if (key.includes('ICE_SPITTER')) {
    style.palette = ['#00f2ff', '#00758c', '#001a21'];
    style.accent = '#b3fbff';
  } else if (key.includes('SLOW_THROWER')) {
    style.palette = ['#b82bff', '#550882', '#160024'];
    style.accent = '#eab5ff';
  } else if (key.includes('KAMIKAZE')) {
    style.palette = ['#ff003c', '#91001d', '#2b0008'];
    style.accent = '#ffb3c1';
  } else if (key.includes('POISON_BOMBER')) {
    style.palette = ['#a0ff2b', '#48850a', '#122601'];
    style.accent = '#dcffb3';
  } else if (key.includes('FIRE_SPITTER')) {
    style.palette = ['#ff6a00', '#853200', '#1f0b00'];
    style.accent = '#ffcda6';
  }

  style.rotBias = seeded(key, 2) * TAU;
  style.variant = Math.floor(seeded(key, 3) * 4);
  style.eyeScale = .85 + seeded(key, 4) * .3;
  style.detail = seeded(key, 5);
  return style;
}

/* =========================================================
ENEMY SILHOUETTES (thường)
========================================================= */
function drawRunnerEnemy(ctx, e, s, t) {
  const r = e.radius;
  const [main, dark] = s.palette;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);
  ctx.shadowBlur = 18;
  ctx.shadowColor = main;
  ctx.fillStyle = dark;
  ctx.strokeStyle = main;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(r * 1.5, 0);
  ctx.lineTo(-r * 0.8, -r * 0.9);
  ctx.lineTo(-r * 0.4, 0);
  ctx.lineTo(-r * 0.8, r * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  drawRingedCore(ctx, -r * 0.3, 0, r * 0.25, s.accent, t * 5, 1);
  drawEye(ctx, r * 0.3, 0, r * 0.15, r * 0.08, 0, s.accent);
  ctx.restore();
}

function drawShooterEnemy(ctx, e, s, t) {
  const r = e.radius;
  const [main, dark, deep] = s.palette;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);
  ctx.shadowBlur = 15;
  ctx.shadowColor = main;
  ctx.fillStyle = deep;
  ctx.strokeStyle = main;
  ctx.lineWidth = 2;
  ctx.fillRect(0, -r * 0.25, r * 1.8, r * 0.5);
  ctx.strokeRect(0, -r * 0.25, r * 1.8, r * 0.5);
  polyPath(ctx, 0, 0, r * 0.95, 6, Math.PI / 6);
  ctx.fillStyle = dark;
  ctx.fill();
  ctx.stroke();
  drawEye(ctx, r * 0.2, 0, r * 0.25, r * 0.15, 0, s.accent);
  ctx.restore();
}

function drawExploderEnemy(ctx, e, s, t) {
  const r = e.radius;
  const [main, dark] = s.palette;
  ctx.save();
  ctx.translate(e.x, e.y);
  const pulse = Math.sin(t * 12) * 0.25;
  ctx.rotate(t * 2);
  ctx.shadowBlur = 35;
  ctx.shadowColor = main;
  starPath(ctx, 0, 0, r * (1.1 + pulse), r * 0.6, 8, 0);
  ctx.fillStyle = dark;
  ctx.strokeStyle = main;
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  drawRingedCore(ctx, 0, 0, r * (0.45 + pulse), s.accent, -t * 8, 3);
  ctx.restore();
}

function drawShieldEnemy(ctx, e, s, t) {
  const r = e.radius;
  const [main, dark] = s.palette;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);
  ctx.shadowBlur = 15;
  ctx.shadowColor = main;
  ctx.fillStyle = dark;
  ctx.strokeStyle = main;
  ctx.lineWidth = 2;
  ctx.fillRect(-r * 0.9, -r * 0.8, r * 1.2, r * 1.6);
  ctx.strokeRect(-r * 0.9, -r * 0.8, r * 1.2, r * 1.6);
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.4, -Math.PI * 0.4, Math.PI * 0.4);
  ctx.strokeStyle = s.accent;
  ctx.lineWidth = 4 + Math.sin(t * 6) * 1.5;
  ctx.shadowBlur = 25;
  ctx.shadowColor = s.accent;
  ctx.stroke();
  drawRingedCore(ctx, -r * 0.3, 0, r * 0.3, s.accent, t, 1);
  ctx.restore();
}

function drawSpitterEnemy(ctx, e, s, t) {
  const r = e.radius;
  const [main, dark, deep] = s.palette;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);
  ctx.shadowBlur = 20;
  ctx.shadowColor = main;
  ctx.fillStyle = dark;
  ctx.strokeStyle = main;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-r * 0.2, 0, r * 0.8, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = deep;
  ctx.beginPath();
  ctx.moveTo(r * 0.2, -r * 0.6);
  ctx.lineTo(r * 1.3, -r * 0.35);
  ctx.lineTo(r * 1.3, r * 0.35);
  ctx.lineTo(r * 0.2, r * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  drawRingedCore(ctx, -r * 0.3, 0, r * 0.4, s.accent, t * 1.5, 2);
  ctx.restore();
}

function drawBomberEnemy(ctx, e, s, t) {
  const r = e.radius;
  const [main, dark, deep] = s.palette;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);
  ctx.shadowBlur = 25;
  ctx.shadowColor = main;
  ctx.fillStyle = deep;
  ctx.strokeStyle = main;
  ctx.lineWidth = 2.5;
  polyPath(ctx, -r * 0.2, 0, r * 1.1, 8, Math.PI / 8);
  ctx.fill();
  ctx.stroke();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = s.accent;
  ctx.beginPath();
  ctx.arc(-r * 0.2, 0, r * 0.65 + Math.sin(t * 3) * r * 0.1, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(r * 0.7, -r * 0.4);
  ctx.lineTo(r * 1.4, 0);
  ctx.lineTo(r * 0.7, r * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  drawEye(ctx, r * 0.85, 0, r * 0.15, r * 0.1, 0, s.accent);
  ctx.restore();
}

function drawDroneEnemy(ctx, e, s, t) {
  const r = e.radius;
  const [main, dark, deep] = s.palette;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle + Math.sin(t * 2 + s.detail * 5) * .03);
  ctx.shadowBlur = 22;
  ctx.shadowColor = main;
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate(i * Math.PI / 2);
    ctx.fillStyle = dark;
    ctx.strokeStyle = main;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(r * .35, -r * .25);
    ctx.lineTo(r * 1.35, -r * .12);
    ctx.lineTo(r * 1.08, r * .24);
    ctx.lineTo(r * .35, r * .32);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  const g = ctx.createRadialGradient(-r * .3, -r * .3, 1, 0, 0, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(.08, s.accent);
  g.addColorStop(.35, main);
  g.addColorStop(1, deep);
  ctx.fillStyle = g;
  ctx.strokeStyle = main;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r * .82, 0, TAU);
  ctx.fill();
  ctx.stroke();
  drawRingedCore(ctx, 0, 0, r * .25, s.accent, t * 2, 2);
  ctx.restore();
}

function drawTankEnemy(ctx, e, s, t) {
  const r = e.radius;
  const [main, dark, deep] = s.palette;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(t * .18 + s.rotBias);
  ctx.shadowBlur = 20;
  ctx.shadowColor = main;
  polyPath(ctx, 0, 0, r * 1.12, 8, Math.PI / 8);
  ctx.fillStyle = dark;
  ctx.strokeStyle = main;
  ctx.lineWidth = 2.5;
  ctx.fill();
  ctx.stroke();
  const g = ctx.createRadialGradient(-r * .35, -r * .35, 2, 0, 0, r);
  g.addColorStop(0, s.accent);
  g.addColorStop(.18, main);
  g.addColorStop(.65, dark);
  g.addColorStop(1, deep);
  ctx.fillStyle = g;
  polyPath(ctx, 0, 0, r * .75, 8, Math.PI / 8);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.rotate(-e.angle - t * .18 - s.rotBias);
  ctx.fillStyle = deep;
  ctx.strokeStyle = s.accent;
  ctx.lineWidth = 2;
  ctx.fillRect(r * .2, -r * .14, r * 1.05, r * .28);
  ctx.strokeRect(r * .2, -r * .14, r * 1.05, r * .28);
  ctx.restore();
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8;
    ctx.fillStyle = s.accent;
    ctx.globalAlpha = .8;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * .92, Math.sin(a) * r * .92, r * .055, 0, TAU);
    ctx.fill();
  }
  drawRingedCore(ctx, 0, 0, r * .19, s.accent, t, 1);
  ctx.restore();
}

function drawSwarmEnemy(ctx, e, s, t) {
  const r = e.radius;
  const [main, dark, deep] = s.palette;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.shadowBlur = 15;
  ctx.shadowColor = main;
  for (let i = 0; i < 6; i++) {
    const a = t * .8 + i * TAU / 6 + s.rotBias;
    const rr = r * (.82 + .15 * Math.sin(t * 3 + i));
    ctx.save();
    ctx.rotate(a);
    ctx.fillStyle = i % 2 ? dark : main;
    ctx.strokeStyle = s.accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(r * .18, 0);
    ctx.lineTo(rr, -r * .13);
    ctx.lineTo(rr * .78, r * .13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = deep;
  ctx.strokeStyle = main;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r * .52, 0, TAU);
  ctx.fill();
  ctx.stroke();
  drawEye(ctx, 0, 0, r * .24, r * .16, e.angle, s.accent);
  ctx.restore();
}

function drawAssassinEnemy(ctx, e, s, t) {
  const r = e.radius;
  const [main, dark, deep] = s.palette;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);
  ctx.shadowBlur = 24;
  ctx.shadowColor = main;
  ctx.fillStyle = dark;
  ctx.strokeStyle = main;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(r * 1.4, 0);
  ctx.lineTo(r * .15, -r * .62);
  ctx.lineTo(-r * .85, -r * .48);
  ctx.lineTo(-r * .42, 0);
  ctx.lineTo(-r * .85, r * .48);
  ctx.lineTo(r * .15, r * .62);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = deep;
  ctx.beginPath();
  ctx.moveTo(r * .85, 0);
  ctx.lineTo(-r * .35, -r * .36);
  ctx.lineTo(-r * .52, 0);
  ctx.lineTo(-r * .35, r * .36);
  ctx.closePath();
  ctx.fill();
  drawEye(ctx, r * .02, -r * .2, r * .17, r * .08, 0, s.accent);
  drawEye(ctx, r * .02, r * .2, r * .17, r * .08, 0, s.accent);
  ctx.strokeStyle = s.accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(r * .2, -r * .7);
  ctx.lineTo(r * 1.2, -r * 1.0);
  ctx.stroke();
  ctx.restore();
}

/* =========================================================
BOSS PALETTES — màu riêng cho từng boss
========================================================= */
const BOSS_PALETTES = {
  'SENTINEL PRIME': { main: '#ff5a6e', dark: '#8a1020', deep: '#2a050a', glow: '#ff8899' },
  'FORGE TITAN':    { main: '#ffa53a', dark: '#8a5410', deep: '#2a1804', glow: '#ffd08a' },
  'GLITCH WRAITH':  { main: '#ff2fd0', dark: '#8a1070', deep: '#2a0520', glow: '#ff8ae8' },
  'REAPER UNIT':    { main: '#ff3b52', dark: '#8a1020', deep: '#2a0508', glow: '#ff8899' },
  'VOID REAPER':    { main: '#a06bff', dark: '#4a1e8a', deep: '#150630', glow: '#c9a8ff' }
};

/* =========================================================
BOSS 1 — SENTINEL PRIME
4 chân nhện + mắt tròn khổng lồ nhìn player + 3 tia cảm biến
========================================================= */
function drawSentinelPrime(ctx, e, pal, t) {
  const r = e.radius;
  const main = pal.main, dark = pal.dark, deep = pal.deep;
  ctx.save();
  ctx.translate(e.x, e.y);

  /* --- 4 chân nhện --- */
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    ctx.save();
    ctx.rotate(a);
    const legLen = r * 1.7;
    const legW = r * 0.22;
    ctx.fillStyle = deep;
    ctx.strokeStyle = main;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(r * 0.6, -legW);
    ctx.lineTo(legLen * 0.7, -legW * 1.4);
    ctx.lineTo(legLen, -legW * 0.4);
    ctx.lineTo(legLen * 0.9, legW * 0.2);
    ctx.lineTo(legLen * 0.55, legW * 0.5);
    ctx.lineTo(r * 0.6, legW * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    /* Khớp gối phát sáng */
    ctx.fillStyle = main;
    ctx.shadowBlur = 10;
    ctx.shadowColor = main;
    ctx.beginPath();
    ctx.arc(legLen * 0.75, -legW * 0.6, legW * 0.55, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /* --- Body bát giác --- */
  ctx.save();
  ctx.rotate(t * 0.15);
  polyPath(ctx, 0, 0, r, 8, Math.PI / 8);
  const bodyGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r);
  bodyGrad.addColorStop(0, pal.glow);
  bodyGrad.addColorStop(0.15, main);
  bodyGrad.addColorStop(0.6, dark);
  bodyGrad.addColorStop(1, deep);
  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = main;
  ctx.lineWidth = 3;
  ctx.shadowBlur = 30;
  ctx.shadowColor = main;
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  /* --- Mắt tròn khổng lồ giữa --- */
  const eyeGlow = 0.75 + Math.sin(t * 5) * 0.25;
  ctx.save();
  ctx.fillStyle = deep;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.55, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = main;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  /* Tròng trắng */
  ctx.fillStyle = '#f7fbff';
  ctx.shadowBlur = 20;
  ctx.shadowColor = pal.glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.42, 0, TAU);
  ctx.fill();
  /* Tròng đỏ phát sáng */
  ctx.fillStyle = `rgba(255, 60, 90, ${eyeGlow})`;
  ctx.shadowBlur = 25;
  ctx.shadowColor = main;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.3, 0, TAU);
  ctx.fill();
  /* Con ngươi nhìn player */
  ctx.fillStyle = '#2a050a';
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(
    Math.cos(e.angle) * r * 0.12,
    Math.sin(e.angle) * r * 0.12,
    r * 0.12, 0, TAU
  );
  ctx.fill();
  /* Highlight */
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(
    Math.cos(e.angle) * r * 0.12 - r * 0.06,
    Math.sin(e.angle) * r * 0.12 - r * 0.06,
    r * 0.04, 0, TAU
  );
  ctx.fill();
  ctx.restore();

  /* --- 3 tia cảm biến trên đỉnh --- */
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i - 1) * 0.4;
    ctx.save();
    ctx.rotate(a);
    ctx.fillStyle = main;
    ctx.shadowBlur = 12;
    ctx.shadowColor = main;
    ctx.beginPath();
    ctx.arc(0, -r * 1.15, r * 0.09, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/* =========================================================
BOSS 2 — FORGE TITAN
Thân trụ nặng + 2 tay búa lửa + 3 khe lò + khói
========================================================= */
function drawForgeTitan(ctx, e, pal, t) {
  const r = e.radius;
  const main = pal.main, dark = pal.dark, deep = pal.deep;
  ctx.save();
  ctx.translate(e.x, e.y);

  /* --- 2 tay búa --- */
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.fillStyle = dark;
    ctx.strokeStyle = main;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(side * r * 0.5, -r * 0.2);
    ctx.lineTo(side * r * 1.1, r * 0.1);
    ctx.lineTo(side * r * 1.15, r * 0.6);
    ctx.lineTo(side * r * 0.7, r * 0.65);
    ctx.lineTo(side * r * 0.45, r * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    /* Đầu búa */
    const hammerY = r * 0.7 + Math.sin(t * 3 + side) * r * 0.1;
    ctx.fillStyle = deep;
    ctx.strokeStyle = main;
    ctx.lineWidth = 3;
    ctx.fillRect(
      side * r * 0.55 - r * 0.35,
      hammerY - r * 0.25,
      r * 0.7, r * 0.5
    );
    ctx.strokeRect(
      side * r * 0.55 - r * 0.35,
      hammerY - r * 0.25,
      r * 0.7, r * 0.5
    );
    /* Lửa đầu búa */
    ctx.fillStyle = `rgba(255, 165, 58, ${0.5 + Math.sin(t * 8 + side) * 0.3})`;
    ctx.shadowBlur = 20;
    ctx.shadowColor = main;
    ctx.beginPath();
    ctx.arc(side * r * 0.55, hammerY, r * 0.18, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /* --- Thân trụ nặng --- */
  const bodyGrad = ctx.createLinearGradient(-r, -r, r, r);
  bodyGrad.addColorStop(0, deep);
  bodyGrad.addColorStop(0.4, dark);
  bodyGrad.addColorStop(0.6, main);
  bodyGrad.addColorStop(1, deep);
  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = main;
  ctx.lineWidth = 3;
  ctx.shadowBlur = 25;
  ctx.shadowColor = main;
  ctx.beginPath();
  ctx.moveTo(-r * 0.85, -r * 0.9);
  ctx.lineTo(r * 0.85, -r * 0.9);
  ctx.lineTo(r * 1.0, -r * 0.4);
  ctx.lineTo(r * 0.9, r * 0.9);
  ctx.lineTo(-r * 0.9, r * 0.9);
  ctx.lineTo(-r * 1.0, -r * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  /* --- Khe lửa --- */
  const fireIntensity = 0.6 + Math.sin(t * 4) * 0.35;
  for (let i = 0; i < 3; i++) {
    const slotY = r * 0.1 + i * r * 0.22;
    ctx.fillStyle = `rgba(255, 140, 20, ${fireIntensity})`;
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ff8c14';
    ctx.fillRect(-r * 0.6, slotY - r * 0.04, r * 1.2, r * 0.08);
  }
  ctx.shadowBlur = 0;

  /* --- Mắt đơn trên đỉnh --- */
  ctx.save();
  ctx.fillStyle = '#0a0502';
  ctx.beginPath();
  ctx.arc(0, -r * 0.7, r * 0.18, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = main;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = `rgba(255, 165, 58, ${0.8 + Math.sin(t * 6) * 0.2})`;
  ctx.shadowBlur = 15;
  ctx.shadowColor = main;
  ctx.beginPath();
  ctx.arc(0, -r * 0.7, r * 0.1, 0, TAU);
  ctx.fill();
  ctx.restore();

  /* --- Khói --- */
  for (let i = 0; i < 3; i++) {
    const smokeT = (t * 0.5 + i * 0.33) % 1;
    const smokeY = -r * 1.1 - smokeT * r * 0.8;
    const smokeX = Math.sin(t * 2 + i * 2) * r * 0.3;
    ctx.fillStyle = `rgba(100, 100, 100, ${(1 - smokeT) * 0.4})`;
    ctx.beginPath();
    ctx.arc(smokeX, smokeY, r * (0.15 + smokeT * 0.15), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/* =========================================================
BOSS 3 — GLITCH WRAITH
Bóng ma glitch 3 layer + mảnh vỡ văng + mắt hồng ellipse
========================================================= */
function drawGlitchWraith(ctx, e, pal, t) {
  const r = e.radius;
  const main = pal.main, dark = pal.dark, deep = pal.deep;
  ctx.save();
  ctx.translate(e.x, e.y);
  const glitchOffset = Math.sin(t * 20) * 2 + (Math.random() - 0.5) * 3;

  /* Layer đỏ */
  ctx.globalAlpha = 0.35;
  ctx.save();
  ctx.translate(-glitchOffset, 0);
  drawWraithBody(ctx, r, '#ff0044', null, null);
  ctx.restore();

  /* Layer cyan */
  ctx.globalAlpha = 0.35;
  ctx.save();
  ctx.translate(glitchOffset, 0);
  drawWraithBody(ctx, r, '#00eeff', null, null);
  ctx.restore();

  /* Layer chính */
  ctx.globalAlpha = 1;
  drawWraithBody(ctx, r, main, dark, deep);

  /* Mảnh vỡ glitch */
  for (let i = 0; i < 5; i++) {
    const seed = i * 13.7;
    const ang = t * 0.5 + seed;
    const dist = r * (1.4 + Math.sin(t * 3 + i) * 0.3);
    const x = Math.cos(ang) * dist;
    const y = Math.sin(ang) * dist;
    const size = r * (0.08 + Math.sin(t * 5 + i) * 0.03);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 2 + i);
    ctx.fillStyle = main;
    ctx.shadowBlur = 15;
    ctx.shadowColor = main;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(-size, -size * 0.5, size * 2, size);
    ctx.restore();
  }

  /* Mắt ellipse nghiêng */
  ctx.save();
  ctx.fillStyle = '#0a0512';
  ctx.shadowBlur = 30;
  ctx.shadowColor = main;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.4, r * 0.22, 0, 0, TAU);
  ctx.fill();
  const eyeGlow = 0.7 + Math.sin(t * 8) * 0.3;
  ctx.fillStyle = `rgba(255, 47, 208, ${eyeGlow})`;
  ctx.shadowBlur = 35;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.32, r * 0.15, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2a0520';
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.ellipse(
    Math.cos(e.angle) * r * 0.08,
    Math.sin(e.angle) * r * 0.08,
    r * 0.06, r * 0.12, 0, 0, TAU
  );
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawWraithBody(ctx, r, color, dark, deep) {
  ctx.save();
  const grad = ctx.createRadialGradient(0, -r * 0.2, r * 0.1, 0, 0, r * 1.2);
  grad.addColorStop(0, color);
  grad.addColorStop(0.5, dark || color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 20;
  ctx.shadowColor = color;
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.1);
  ctx.quadraticCurveTo(r * 0.9, -r * 0.6, r * 0.85, r * 0.6);
  ctx.quadraticCurveTo(r * 0.4, r * 1.1, 0, r * 1.0);
  ctx.quadraticCurveTo(-r * 0.4, r * 1.1, -r * 0.85, r * 0.6);
  ctx.quadraticCurveTo(-r * 0.9, -r * 0.6, 0, -r * 1.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  /* Vết nứt glitch */
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, -r * 0.5);
  ctx.lineTo(-r * 0.15, 0);
  ctx.lineTo(-r * 0.35, r * 0.4);
  ctx.moveTo(r * 0.25, -r * 0.3);
  ctx.lineTo(r * 0.4, r * 0.2);
  ctx.lineTo(r * 0.2, r * 0.6);
  ctx.stroke();
  ctx.restore();
}

/* =========================================================
BOSS 4 — REAPER UNIT
Áo choàng + lưỡi hái cong lớn + mũ trùm + 2 mắt đỏ
========================================================= */
function drawReaperUnit(ctx, e, pal, t) {
  const r = e.radius;
  const main = pal.main, dark = pal.dark, deep = pal.deep;
  ctx.save();
  ctx.translate(e.x, e.y);

  /* --- Halo đỏ --- */
  ctx.save();
  ctx.globalAlpha = 0.4 + Math.sin(t * 2) * 0.15;
  ctx.strokeStyle = main;
  ctx.shadowBlur = 30;
  ctx.shadowColor = main;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, -r * 0.3, r * 1.4, 0, TAU);
  ctx.stroke();
  ctx.restore();

  /* --- Lưỡi hái --- */
  ctx.save();
  ctx.rotate(Math.sin(t * 1.5) * 0.08);
  /* Cán */
  ctx.strokeStyle = dark;
  ctx.lineWidth = r * 0.14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(r * 0.3, r * 1.4);
  ctx.lineTo(r * 0.7, -r * 1.2);
  ctx.stroke();
  /* Lưỡi cong */
  ctx.fillStyle = main;
  ctx.strokeStyle = main;
  ctx.shadowBlur = 25;
  ctx.shadowColor = main;
  ctx.beginPath();
  ctx.moveTo(r * 0.7, -r * 1.2);
  ctx.quadraticCurveTo(r * 2.0, -r * 1.6, r * 2.2, -r * 0.2);
  ctx.quadraticCurveTo(r * 1.6, -r * 0.8, r * 0.7, -r * 1.0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = pal.glow;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.8;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();

  /* --- Áo choàng --- */
  const robeGrad = ctx.createLinearGradient(0, -r * 1.1, 0, r);
  robeGrad.addColorStop(0, dark);
  robeGrad.addColorStop(0.6, deep);
  robeGrad.addColorStop(1, '#000');
  ctx.fillStyle = robeGrad;
  ctx.strokeStyle = main;
  ctx.lineWidth = 2.5;
  ctx.shadowBlur = 25;
  ctx.shadowColor = main;
  ctx.beginPath();
  ctx.moveTo(-r * 0.9, r * 0.9);
  ctx.quadraticCurveTo(-r * 0.85, -r * 0.2, -r * 0.55, -r * 0.85);
  ctx.lineTo(0, -r * 1.05);
  ctx.lineTo(r * 0.55, -r * 0.85);
  ctx.quadraticCurveTo(r * 0.85, -r * 0.2, r * 0.9, r * 0.9);
  ctx.quadraticCurveTo(r * 0.4, r * 1.1, 0, r * 1.0);
  ctx.quadraticCurveTo(-r * 0.4, r * 1.1, -r * 0.9, r * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  /* --- Mũ trùm --- */
  ctx.fillStyle = deep;
  ctx.beginPath();
  ctx.moveTo(-r * 0.6, -r * 0.6);
  ctx.lineTo(0, -r * 1.15);
  ctx.lineTo(r * 0.6, -r * 0.6);
  ctx.lineTo(r * 0.5, -r * 0.2);
  ctx.lineTo(-r * 0.5, -r * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  /* --- 2 mắt đỏ --- */
  const eyeGlow = 0.85 + Math.sin(t * 6) * 0.15;
  for (const side of [-1, 1]) {
    ctx.fillStyle = `rgba(255, 59, 82, ${eyeGlow})`;
    ctx.shadowBlur = 20;
    ctx.shadowColor = main;
    ctx.beginPath();
    ctx.ellipse(
      side * r * 0.22, -r * 0.55,
      r * 0.1, r * 0.06,
      side * 0.15, 0, TAU
    );
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  /* --- Vết nứt áo --- */
  ctx.strokeStyle = main;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, -r * 0.1);
  ctx.lineTo(-r * 0.15, r * 0.3);
  ctx.lineTo(-r * 0.4, r * 0.7);
  ctx.moveTo(r * 0.35, 0);
  ctx.lineTo(r * 0.2, r * 0.4);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* =========================================================
BOSS 5 — VOID REAPER
6 xúc tu + 5 mắt vòng tròn + mắt trung tâm + vòng năng lượng
========================================================= */
function drawVoidReaper(ctx, e, pal, t) {
  const r = e.radius;
  const main = pal.main, dark = pal.dark, deep = pal.deep;
  ctx.save();
  ctx.translate(e.x, e.y);

  /* --- 6 xúc tu --- */
  for (let i = 0; i < 6; i++) {
    const ang = t * 0.4 + i * TAU / 6;
    const wave = Math.sin(t * 3 + i) * 0.2;
    ctx.save();
    ctx.rotate(ang + wave);
    ctx.globalAlpha = 0.7;
    const grad = ctx.createLinearGradient(0, 0, 0, r * 1.8);
    grad.addColorStop(0, main);
    grad.addColorStop(1, 'rgba(160, 107, 255, 0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = r * 0.15;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 15;
    ctx.shadowColor = main;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.7);
    ctx.quadraticCurveTo(
      Math.sin(t * 2 + i) * r * 0.4,
      r * 1.2,
      0, r * 1.8
    );
    ctx.stroke();
    ctx.fillStyle = pal.glow;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(0, r * 1.8, r * 0.08, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  /* --- Core --- */
  const coreGrad = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 1.1);
  coreGrad.addColorStop(0, '#ffffff');
  coreGrad.addColorStop(0.15, pal.glow);
  coreGrad.addColorStop(0.5, main);
  coreGrad.addColorStop(0.85, dark);
  coreGrad.addColorStop(1, deep);
  ctx.fillStyle = coreGrad;
  ctx.shadowBlur = 35;
  ctx.shadowColor = main;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.9, 0, TAU);
  ctx.fill();

  /* --- Tinh thể quanh core --- */
  for (let i = 0; i < 5; i++) {
    const ang = -t * 0.6 + i * TAU / 5;
    const dist = r * 0.95;
    drawCrystal(
      ctx,
      Math.cos(ang) * dist,
      Math.sin(ang) * dist,
      r * 0.16,
      ang,
      pal.glow
    );
  }

  /* --- 5 mắt vòng tròn --- */
  for (let i = 0; i < 5; i++) {
    const ang = i * TAU / 5 - Math.PI / 2;
    const dist = r * 0.5;
    const eyeGlow = 0.75 + Math.sin(t * 4 + i) * 0.25;
    ctx.save();
    ctx.fillStyle = '#0a0512';
    ctx.beginPath();
    ctx.arc(Math.cos(ang) * dist, Math.sin(ang) * dist, r * 0.1, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(160, 107, 255, ${eyeGlow})`;
    ctx.shadowBlur = 12;
    ctx.shadowColor = main;
    ctx.beginPath();
    ctx.arc(Math.cos(ang) * dist, Math.sin(ang) * dist, r * 0.06, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /* --- Mắt trung tâm --- */
  const mainEyeGlow = 0.8 + Math.sin(t * 5) * 0.2;
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = `rgba(255, 255, 255, ${mainEyeGlow})`;
  ctx.shadowBlur = 25;
  ctx.shadowColor = '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.12, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(
    Math.cos(e.angle) * r * 0.05,
    Math.sin(e.angle) * r * 0.05,
    r * 0.06, 0, TAU
  );
  ctx.fill();
  ctx.restore();

  /* --- Vòng năng lượng --- */
  ctx.globalAlpha = 0.45;
  energyRing(ctx, 0, 0, r * 1.35, t * 1.2, main, 10);
  energyRing(ctx, 0, 0, r * 1.5, -t * 0.8, pal.glow, 8);
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* =========================================================
BOSS DISPATCH
========================================================= */
function drawBossSilhouette(ctx, e, pal, t) {
  const name = String(e.name || '').toUpperCase();
  if (name.includes('SENTINEL'))  return drawSentinelPrime(ctx, e, pal, t);
  if (name.includes('FORGE'))     return drawForgeTitan(ctx, e, pal, t);
  if (name.includes('GLITCH'))    return drawGlitchWraith(ctx, e, pal, t);
  if (name.includes('REAPER UNIT') || name.includes('REAPERUNIT'))
    return drawReaperUnit(ctx, e, pal, t);
  if (name.includes('VOID'))      return drawVoidReaper(ctx, e, pal, t);
  return drawSentinelPrime(ctx, e, pal, t);
}

function drawEnemySilhouette(ctx, e, s, t) {
  /* Boss → dispatch riêng theo tên */
  if (e.isBoss) {
    const pal = BOSS_PALETTES[e.name] || BOSS_PALETTES['SENTINEL PRIME'];
    return drawBossSilhouette(ctx, e, pal, t);
  }
  switch (s.shape) {
    case 'runner':   return drawRunnerEnemy(ctx, e, s, t);
    case 'shooter':  return drawShooterEnemy(ctx, e, s, t);
    case 'exploder': return drawExploderEnemy(ctx, e, s, t);
    case 'shield':   return drawShieldEnemy(ctx, e, s, t);
    case 'spitter':  return drawSpitterEnemy(ctx, e, s, t);
    case 'bomber':   return drawBomberEnemy(ctx, e, s, t);
    case 'tank':     return drawTankEnemy(ctx, e, s, t);
    case 'swarm':    return drawSwarmEnemy(ctx, e, s, t);
    case 'assassin': return drawAssassinEnemy(ctx, e, s, t);
    case 'drone':
    default:         return drawDroneEnemy(ctx, e, s, t);
  }
}

/* =========================================================
TELEGRAPH — 7 kiểu báo đòn + phase text
Mỗi kiểu vẽ khác nhau để player phân biệt được sắp bị gì.

Field đọc từ boss:
- e.telegraph         số giây còn lại
- e.telegraphType     'radial' | 'line' | 'circle' | 'cone' | 'arena' | 'cross' | 'point'
- e.state             'telegraph' | 'phaseShift' | 'attack' | ...
- e.color             màu boss
- e.current.def       attack definition (đọc duration, telegraph gốc)
- e.diff              difficulty config (đọc telegraphMul)
- e.angle             hướng boss
========================================================= */

/** Tính progress 0..1 của telegraph. */
function _tgProgress(e) {
  if (!e.current || !e.current.def) return 1;
  const max = e.current.def.telegraph * ((e.diff && e.diff.telegraphMul) || 1);
  if (max <= 0) return 1;
  const prog = 1 - e.telegraph / max;
  return Math.max(0, Math.min(1, prog));
}

/** Vẽ vạch progress bar quanh boss. */
function _tgProgressRing(ctx, e, prog, color) {
  const r = e.radius + 22;
  ctx.save();

  /* Vòng nền */
  ctx.globalAlpha = 0.15;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(e.x, e.y, r, 0, TAU);
  ctx.stroke();

  /* Vòng tiến trình */
  ctx.globalAlpha = 0.9;
  ctx.shadowBlur = 12;
  ctx.shadowColor = color;
  ctx.strokeStyle = prog >= 0.9 ? '#ffffff' : color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(
    e.x, e.y, r,
    -Math.PI / 2,
    -Math.PI / 2 + prog * TAU
  );
  ctx.stroke();

  ctx.restore();
}

/* ---------------------------------------------------------
   RADIAL — quạt rộng ~90° về phía player
   --------------------------------------------------------- */
function drawTgRadial(ctx, e, prog, tSec) {
  const color = e.color || '#ff3b52';
  const range = 500;
  const halfArc = 0.75;

  ctx.save();

  /* Fill mờ */
  const grad = ctx.createRadialGradient(e.x, e.y, 20, e.x, e.y, range);
  grad.addColorStop(0, 'rgba(255, 60, 90, 0)');
  grad.addColorStop(1, `rgba(255, 60, 90, ${0.08 + prog * 0.25})`);
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(e.x, e.y);
  ctx.arc(e.x, e.y, range * prog, e.angle - halfArc, e.angle + halfArc);
  ctx.closePath();
  ctx.fill();

  /* Viền */
  ctx.globalAlpha = 0.6 + prog * 0.4;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowBlur = 15;
  ctx.shadowColor = color;
  ctx.beginPath();
  ctx.moveTo(e.x, e.y);
  ctx.lineTo(
    e.x + Math.cos(e.angle - halfArc) * range * prog,
    e.y + Math.sin(e.angle - halfArc) * range * prog
  );
  ctx.moveTo(e.x, e.y);
  ctx.lineTo(
    e.x + Math.cos(e.angle + halfArc) * range * prog,
    e.y + Math.sin(e.angle + halfArc) * range * prog
  );
  ctx.stroke();

  /* Vòng cung đầu */
  ctx.beginPath();
  ctx.arc(e.x, e.y, range * prog, e.angle - halfArc, e.angle + halfArc);
  ctx.stroke();

  /* Progress ring */
  _tgProgressRing(ctx, e, prog, color);

  ctx.restore();
}

/* ---------------------------------------------------------
   LINE — đường thẳng dài về phía player
   --------------------------------------------------------- */
function drawTgLine(ctx, e, prog, tSec) {
  const color = e.color || '#ff3b52';
  const range = 900;
  const width = 40;

  ctx.save();

  /* Rect mờ dọc theo hướng aim */
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);

  /* Fill */
  const grad = ctx.createLinearGradient(0, 0, range * prog, 0);
  grad.addColorStop(0, 'rgba(255, 60, 90, 0)');
  grad.addColorStop(1, `rgba(255, 60, 90, ${0.12 + prog * 0.3})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, -width / 2, range * prog, width);

  /* Viền trên/dưới */
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowBlur = 15;
  ctx.shadowColor = color;
  ctx.beginPath();
  ctx.moveTo(0, -width / 2);
  ctx.lineTo(range * prog, -width / 2);
  ctx.moveTo(0, width / 2);
  ctx.lineTo(range * prog, width / 2);
  ctx.stroke();

  /* Mũi tên đầu đường */
  if (prog > 0.4) {
    ctx.globalAlpha = prog;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(range * prog + 15, 0);
    ctx.lineTo(range * prog - 5, -width / 2 + 3);
    ctx.lineTo(range * prog - 5, width / 2 - 3);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();

  /* Progress ring */
  _tgProgressRing(ctx, e, prog, color);

  ctx.restore();
}

/* ---------------------------------------------------------
   CIRCLE — vòng tròn AoE quanh boss
   --------------------------------------------------------- */
function drawTgCircle(ctx, e, prog, tSec) {
  const color = e.color || '#ff3b52';
  const maxR = 280;

  ctx.save();

  /* Fill gradient từ ngoài vào */
  const grad = ctx.createRadialGradient(e.x, e.y, 10, e.x, e.y, maxR);
  grad.addColorStop(0, `rgba(255, 60, 90, ${0.15 + prog * 0.25})`);
  grad.addColorStop(0.7, 'rgba(255, 60, 90, 0.08)');
  grad.addColorStop(1, 'rgba(255, 60, 90, 0)');
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.arc(e.x, e.y, maxR, 0, TAU);
  ctx.fill();

  /* Vòng bo viền */
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.shadowBlur = 20;
  ctx.shadowColor = color;
  ctx.beginPath();
  ctx.arc(e.x, e.y, maxR, 0, TAU);
  ctx.stroke();

  /* Vòng co vào theo progress */
  ctx.globalAlpha = 0.5 + prog * 0.5;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(e.x, e.y, maxR * (1 - prog), 0, TAU);
  ctx.stroke();

  /* Vòng trong cùng sáng */
  ctx.globalAlpha = prog;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.radius * 0.4 + prog * 20, 0, TAU);
  ctx.fill();

  /* Progress ring */
  _tgProgressRing(ctx, e, prog, color);

  ctx.restore();
}

/* ---------------------------------------------------------
   CONE — nón hẹp ~30°
   --------------------------------------------------------- */
function drawTgCone(ctx, e, prog, tSec) {
  const color = e.color || '#ff3b52';
  const range = 600;
  const halfArc = Math.PI / 12;   // 15° mỗi bên

  ctx.save();

  /* Fill */
  const grad = ctx.createRadialGradient(e.x, e.y, 20, e.x, e.y, range);
  grad.addColorStop(0, 'rgba(255, 60, 90, 0)');
  grad.addColorStop(1, `rgba(255, 60, 90, ${0.15 + prog * 0.35})`);
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(e.x, e.y);
  ctx.arc(e.x, e.y, range * prog, e.angle - halfArc, e.angle + halfArc);
  ctx.closePath();
  ctx.fill();

  /* Viền */
  ctx.globalAlpha = 0.8 + prog * 0.2;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.shadowBlur = 18;
  ctx.shadowColor = color;
  ctx.beginPath();
  ctx.moveTo(e.x, e.y);
  ctx.lineTo(
    e.x + Math.cos(e.angle - halfArc) * range * prog,
    e.y + Math.sin(e.angle - halfArc) * range * prog
  );
  ctx.moveTo(e.x, e.y);
  ctx.lineTo(
    e.x + Math.cos(e.angle + halfArc) * range * prog,
    e.y + Math.sin(e.angle + halfArc) * range * prog
  );
  ctx.stroke();

  /* Vòng cung đầu */
  ctx.beginPath();
  ctx.arc(e.x, e.y, range * prog, e.angle - halfArc, e.angle + halfArc);
  ctx.stroke();

  /* Progress ring */
  _tgProgressRing(ctx, e, prog, color);

  ctx.restore();
}

/* ---------------------------------------------------------
   ARENA — cảnh báo toàn sàn, bao quanh boss
   --------------------------------------------------------- */
function drawTgArena(ctx, e, prog, tSec) {
  const color = e.color || '#ff3b52';
  const R = 340;

  ctx.save();

  /* Vòng lớn mờ */
  ctx.globalAlpha = 0.12 + prog * 0.15;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(e.x, e.y, R, 0, TAU);
  ctx.fill();

  /* Viền pulse */
  const pulse = 0.7 + Math.sin(tSec * 8) * 0.3;
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.shadowBlur = 30;
  ctx.shadowColor = color;
  ctx.beginPath();
  ctx.arc(e.x, e.y, R, 0, TAU);
  ctx.stroke();

  /* Vòng nội tại chạy ra */
  for (let i = 0; i < 3; i++) {
    const rr = R * (0.3 + ((tSec * 0.6 + i / 3) % 1) * 0.7);
    ctx.globalAlpha = (1 - (rr / R)) * 0.5;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(e.x, e.y, rr, 0, TAU);
    ctx.stroke();
  }

  /* Text cảnh báo */
  ctx.globalAlpha = 0.85 + Math.sin(tSec * 10) * 0.15;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.shadowBlur = 15;
  ctx.shadowColor = color;
  ctx.fillText('⚠ KHÓA ARENA ⚠', e.x, e.y - R - 20);

  /* Progress arc lớn */
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(
    e.x, e.y, R - 8,
    -Math.PI / 2,
    -Math.PI / 2 + prog * TAU
  );
  ctx.stroke();

  ctx.restore();
}

/* ---------------------------------------------------------
   CROSS — chữ thập 4 tia xoay
   --------------------------------------------------------- */
function drawTgCross(ctx, e, prog, tSec) {
  const color = e.color || '#ff3b52';
  const range = 700;
  const width = 36;
  const rot = tSec * 0.5;

  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(rot);

  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate(i * Math.PI / 2);

    /* Fill */
    const grad = ctx.createLinearGradient(0, 0, range * prog, 0);
    grad.addColorStop(0, `rgba(255, 60, 90, ${0.25 + prog * 0.3})`);
    grad.addColorStop(1, 'rgba(255, 60, 90, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(e.radius, -width / 2, range * prog, width);

    /* Viền */
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 15;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.moveTo(e.radius, -width / 2);
    ctx.lineTo(range * prog, -width / 2);
    ctx.moveTo(e.radius, width / 2);
    ctx.lineTo(range * prog, width / 2);
    ctx.stroke();

    ctx.restore();
  }

  ctx.restore();

  /* Progress ring */
  _tgProgressRing(ctx, e, prog, color);
}

/* ---------------------------------------------------------
   POINT — điểm sáng nhỏ (dash/blink)
   --------------------------------------------------------- */
function drawTgPoint(ctx, e, prog, tSec) {
  const color = e.color || '#ff3b52';
  const r = 30 + prog * 40;

  ctx.save();

  /* Ring sáng */
  ctx.globalAlpha = 0.6 + prog * 0.4;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.shadowBlur = 20;
  ctx.shadowColor = color;
  ctx.beginPath();
  ctx.arc(e.x, e.y, r, 0, TAU);
  ctx.stroke();

  /* Sóng lan */
  const waveR = 20 + ((tSec * 100) % 80);
  ctx.globalAlpha = Math.max(0, 1 - waveR / 100);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(e.x, e.y, waveR, 0, TAU);
  ctx.stroke();

  /* Tâm sáng */
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(e.x, e.y, 6 + prog * 4, 0, TAU);
  ctx.fill();

  ctx.restore();
}

/* ---------------------------------------------------------
   PHASE TEXT — hiển thị khi phaseShift
   --------------------------------------------------------- */
function drawPhaseText(ctx, e, tSec) {
  const color = e.color || '#ff3b52';

  ctx.save();

  /* Vòng lan toả */
  const rr = e.radius + 30 + Math.sin(tSec * 6) * 10;
  ctx.globalAlpha = 0.5 + Math.sin(tSec * 6) * 0.3;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.shadowBlur = 25;
  ctx.shadowColor = color;
  ctx.beginPath();
  ctx.arc(e.x, e.y, rr, 0, TAU);
  ctx.stroke();

  /* Text lớn */
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.shadowBlur = 20;
  ctx.shadowColor = color;
  ctx.fillText(
    e.telegraphType || 'PHASE',
    e.x,
    e.y - e.radius - 50
  );

  ctx.restore();
}

/* ---------------------------------------------------------
   MAIN DISPATCH
   --------------------------------------------------------- */
function drawTelegraph(ctx, e, tSec) {
  /* Phase shift text */
  if (e.state === 'phaseShift' && e.telegraphType) {
    drawPhaseText(ctx, e, tSec);
    return;
  }

  /* Regular telegraph */
  if (!e.telegraph || e.telegraph <= 0) return;
  if (!e.telegraphType) return;

  const prog = _tgProgress(e);
  const color = e.color || '#ff3b52';

  switch (e.telegraphType) {
    case 'radial': drawTgRadial(ctx, e, prog, tSec); break;
    case 'line':   drawTgLine(ctx, e, prog, tSec);   break;
    case 'circle': drawTgCircle(ctx, e, prog, tSec); break;
    case 'cone':   drawTgCone(ctx, e, prog, tSec);   break;
    case 'arena':  drawTgArena(ctx, e, prog, tSec);  break;
    case 'cross':  drawTgCross(ctx, e, prog, tSec);  break;
    case 'point':  drawTgPoint(ctx, e, prog, tSec);  break;
    default:
      /* Fallback — vẽ vòng tròn */
      drawTgCircle(ctx, e, prog, tSec);
      break;
  }
}

/* =========================================================
HP BAR cho boss
========================================================= */
function drawBossHealthBar(ctx, e) {
  const r = e.radius;
  const barW = Math.max(150, r * 4.8);
  const barH = 9;
  const bx = e.x - barW / 2;
  const by = e.y - r - 30;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.88)';
  ctx.strokeStyle = 'rgba(255,255,255,.2)';
  ctx.lineWidth = 1;
  ctx.fillRect(bx - 3, by - 3, barW + 6, barH + 6);
  ctx.strokeRect(bx - 3, by - 3, barW + 6, barH + 6);
  const hpPct = clamp01(e.hp / Math.max(1, e.maxHp));
  const grad = ctx.createLinearGradient(bx, by, bx + barW, by);
  grad.addColorStop(0, '#ff244f');
  grad.addColorStop(.5, '#ff5b3d');
  grad.addColorStop(1, '#ffc44d');
  ctx.shadowBlur = 12;
  ctx.shadowColor = '#ff3d66';
  ctx.fillStyle = grad;
  ctx.fillRect(bx, by, barW * hpPct, barH);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(0,0,0,.75)';
  for (let i = 1; i < 4; i++) {
    const x = bx + barW * (i / 4);
    ctx.beginPath();
    ctx.moveTo(x, by);
    ctx.lineTo(x, by + barH);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.shadowBlur = 8;
  ctx.shadowColor = '#000';
  ctx.fillText(e.name || e.displayName || 'BOSS', e.x, by - 7);
  ctx.restore();
}

/* =========================================================
ELITE BADGE
========================================================= */
function drawEliteBadge(ctx, e, s) {
  ctx.save();
  const y = e.y - e.radius - 20;
  ctx.font = 'bold 10px Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffc44d';
  ctx.shadowBlur = 8;
  ctx.shadowColor = '#000';
  const label = e.modName
    ? `★ ${e.modName}`
    : `★ ${String(s.archetype || '').toUpperCase()}`;
  ctx.fillText(label, e.x, y);
  ctx.restore();
}

/* =========================================================
ENEMY / BOSS RENDERER
========================================================= */
export function drawEnemy(ctx, e) {
  if (!e) return;
  const tSec = performance.now() * .001;
  const flash = e.hitFlash > 0;
  const frozen = e.frozen > 0;
  const style = getEnemyStyle(e);

  /* Boss override palette từ BOSS_PALETTES */
  if (e.isBoss) {
    const bp = BOSS_PALETTES[e.name] || BOSS_PALETTES['SENTINEL PRIME'];
    style.palette = [bp.main, bp.dark, bp.deep];
    style.accent = bp.glow;
  }

  ctx.save();
  ctx.globalAlpha = frozen ? .62 : 1;

  /* 1. Shadow */
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.beginPath();
  ctx.ellipse(
    e.x,
    e.y + e.radius * .48,
    e.radius * 1.18,
    e.radius * .48,
    0, 0, TAU
  );
  ctx.fill();

  /* 1b. Telegraph — vẽ TRÊN SÀN, DƯỚI BOSS */
  if (e.isBoss) {
    drawTelegraph(ctx, e, tSec);
  }

  /* 2. Aura cho boss/elite */
  const [main] = style.palette;
  if (e.isBoss || e.elite) {
    ctx.save();
    const auraRadius = e.radius + (e.isBoss ? 28 : 12);
    const pulse = .25 + Math.sin(tSec * (e.isBoss ? 3 : 5)) * .10;
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = flash ? '#ffffff' : main;
    ctx.shadowBlur = e.isBoss ? 35 : 18;
    ctx.shadowColor = flash ? '#ffffff' : main;
    ctx.lineWidth = e.isBoss ? 3 : 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, auraRadius + Math.sin(tSec * 2) * 2, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  /* 3. Silhouette */
  ctx.save();
  if (flash) {
    ctx.shadowBlur = 35;
    ctx.shadowColor = '#ffffff';
  }
  drawEnemySilhouette(ctx, e, style, tSec);
  if (flash) {
    ctx.globalAlpha = .45;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius * 1.05, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  /* 4. Direction indicator (không áp dụng cho boss) */
  if (!e.isBoss) {
    ctx.save();
    ctx.globalAlpha = frozen ? .25 : .55;
    ctx.strokeStyle = style.accent;
    ctx.lineWidth = 1.5;
    const d0 = e.radius * 1.0;
    const d1 = e.radius * 1.34;
    ctx.beginPath();
    ctx.moveTo(e.x + Math.cos(e.angle) * d0, e.y + Math.sin(e.angle) * d0);
    ctx.lineTo(e.x + Math.cos(e.angle) * d1, e.y + Math.sin(e.angle) * d1);
    ctx.stroke();
    ctx.restore();
  }

  /* 5. Elite badge */
  if (e.elite) {
    drawEliteBadge(ctx, e, style);
    ctx.save();
    ctx.globalAlpha = .4 + Math.sin(tSec * 7) * .15;
    ctx.strokeStyle = '#ffc44d';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ffc44d';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = tSec * 2 + i * TAU / 6;
      const r0 = e.radius + 7;
      const r1 = e.radius + 13;
      ctx.beginPath();
      ctx.moveTo(e.x + Math.cos(a) * r0, e.y + Math.sin(a) * r0);
      ctx.lineTo(e.x + Math.cos(a) * r1, e.y + Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* 6. Boss aura vòng cung */
  if (e.isBoss) {
    ctx.save();
    ctx.globalAlpha = .45 + Math.sin(tSec * 4) * .18;
    ctx.strokeStyle = '#ff3d66';
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#ff3d66';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = tSec * .8 + i * Math.PI / 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius + 17 + i * 4, a, a + .65);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* 7. HP / shield */
  if (e.isBoss) {
    drawBossHealthBar(ctx, e);
  } else if (e.hp < e.maxHp || e.elite) {
    const barW = e.radius * 2.5;
    const barH = 5;
    const bx = e.x - barW / 2;
    const by = e.y - e.radius - 13;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.82)';
    ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
    const hpPct = clamp01(e.hp / Math.max(1, e.maxHp));
    const hpColor = e.elite ? '#ffc44d' : '#ff3b52';
    ctx.fillStyle = hpColor;
    ctx.shadowBlur = 7;
    ctx.shadowColor = hpColor;
    ctx.fillRect(bx, by, barW * hpPct, barH);
    if (e.shield > 0) {
      const maxShield = Math.max(1, e.maxShield || e.shield);
      const shPct = clamp01(e.shield / maxShield);
      ctx.fillStyle = '#5aa9ff';
      ctx.shadowColor = '#5aa9ff';
      ctx.fillRect(bx, by - 5, barW * shPct, 2.5);
    }
    ctx.restore();
  }

  /* 9. Frozen overlay */
  if (frozen) {
    ctx.save();
    ctx.globalAlpha = .5;
    ctx.strokeStyle = '#b9edff';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#8be8ff';
    ctx.lineWidth = 2;
    starPath(ctx, e.x, e.y, e.radius * 1.35, e.radius * .72, 6, -tSec * 1.8);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6 + tSec;
      drawCrystal(
        ctx,
        e.x + Math.cos(a) * e.radius * 1.12,
        e.y + Math.sin(a) * e.radius * 1.12,
        e.radius * .10,
        a,
        '#b9edff'
      );
    }
    ctx.restore();
  }
  ctx.restore();
}

/* =========================================================
REMOTE PLAYER (LAN)
========================================================= */
export function drawRemotePlayer(ctx, p) {
  if (!p || p.alive === false) return;
  const radius = p.radius || CFG.PLAYER.radius;

  /* Dựng pseudo-player đủ field để dùng chung renderer với nhân vật chính */
  const ghost = {
    x: p.x,
    y: p.y,
    vx: p.vx || 0,
    vy: p.vy || 0,
    angle: p.angle || 0,
    radius,
    alive: true,
    hitFlash: p.hitFlash || 0,
    invuln: 0,
    attackAnim: p.attackAnim || 0,
    moveAnim: p.moveAnim || 0,
    weaponId: p.weaponId || 'pistol',
    up: p.up || { rangeMul: 0 },
    buffs: p.buffs || {}
  };

  const skin = getSkin(p.skin || 'cadet');
  drawPlayer(ctx, ghost, skin);

  /* Nhãn tên + thanh máu nhỏ */
  const name = p.name || ('P-' + String(p.id || '').slice(0, 4));
  const top = p.y - radius - 30;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 11px Consolas, monospace';

  const label = String(name).toUpperCase();
  const tw = Math.max(52, ctx.measureText(label).width + 16);
  ctx.fillStyle = 'rgba(6,10,16,.72)';
  ctx.strokeStyle = 'rgba(57,255,158,.55)';
  ctx.lineWidth = 1;
  rrPath(ctx, p.x - tw / 2, top, tw, 15, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#39ff9e';
  ctx.fillText(label, p.x, top + 11);

  /* Thanh máu đồng đội */
  if (typeof p.hp === 'number' && typeof p.maxHp === 'number' && p.maxHp > 0) {
    const ratio = Math.max(0, Math.min(1, p.hp / p.maxHp));
    const bw = 44;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    rrPath(ctx, p.x - bw / 2, top + 18, bw, 4, 2);
    ctx.fill();
    ctx.fillStyle = ratio > .5 ? '#39ff9e' : ratio > .25 ? '#ffc44d' : '#ff3b52';
    rrPath(ctx, p.x - bw / 2, top + 18, bw * ratio, 4, 2);
    ctx.fill();
  }

  ctx.restore();
}

/* =========================================================
PLAYER (local) — nhân vật top-down: giáp, áo choàng, chân bước
========================================================= */
/** Rounded-rect path (không phụ thuộc ctx.roundRect của trình duyệt cũ). */
function rrPath(ctx, x, y, w, h, r) {
  const rad = Math.min(r, Math.abs(w) * .5, Math.abs(h) * .5);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.arcTo(x + w, y, x + w, y + rad, rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
  ctx.lineTo(x + rad, y + h);
  ctx.arcTo(x, y + h, x, y + h - rad, rad);
  ctx.lineTo(x, y + rad);
  ctx.arcTo(x, y, x + rad, y, rad);
  ctx.closePath();
}

/** Vẽ cây súng / lưỡi dao trên tay nhân vật (hệ toạ độ đã xoay theo góc ngắm). */
function drawHeldWeapon(ctx, p, skin, w, R) {
  const melee = w && w.type === 'melee';
  const hx = R * .52;
  const hy = R * .58;

  ctx.save();
  ctx.translate(hx, hy);

  if (melee) {
    /* Lưỡi dao năng lượng */
    const len = R * 1.5;
    ctx.shadowBlur = 16;
    ctx.shadowColor = skin.accent;
    ctx.strokeStyle = skin.accent;
    ctx.lineWidth = R * .17;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(R * .1, 0);
    ctx.lineTo(R * .1 + len, 0);
    ctx.stroke();

    ctx.globalAlpha = .9;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = R * .06;
    ctx.beginPath();
    ctx.moveTo(R * .14, 0);
    ctx.lineTo(R * .1 + len * .96, 0);
    ctx.stroke();
    ctx.globalAlpha = 1;

    /* Chuôi */
    ctx.shadowBlur = 0;
    ctx.fillStyle = skin.suit2;
    rrPath(ctx, -R * .1, -R * .12, R * .3, R * .24, R * .08);
    ctx.fill();
    ctx.strokeStyle = skin.trim;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else {
    /* Thân súng */
    const len = R * 1.05;
    ctx.shadowBlur = 10;
    ctx.shadowColor = skin.accent;
    ctx.fillStyle = skin.suit2;
    rrPath(ctx, -R * .08, -R * .14, len, R * .28, R * .07);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = skin.trim;
    ctx.lineWidth = 1.1;
    ctx.stroke();

    /* Nòng + điểm sáng */
    ctx.fillStyle = skin.accent;
    rrPath(ctx, len - R * .28, -R * .07, R * .3, R * .14, R * .05);
    ctx.fill();

    /* Băng đạn */
    ctx.fillStyle = skin.suit;
    rrPath(ctx, R * .1, R * .1, R * .26, R * .18, R * .05);
    ctx.fill();
  }

  /* Chớp nòng khi vừa bắn */
  if (p.attackAnim > 0) {
    const k = Math.min(1, p.attackAnim / .16);
    ctx.globalAlpha = k * .95;
    ctx.shadowBlur = 22;
    ctx.shadowColor = skin.accent;
    ctx.fillStyle = '#ffffff';
    const mx = melee ? R * 1.55 : R * 1.05;
    ctx.beginPath();
    ctx.moveTo(mx, 0);
    ctx.lineTo(mx + R * .55 * k, -R * .3 * k);
    ctx.lineTo(mx + R * .75 * k, 0);
    ctx.lineTo(mx + R * .55 * k, R * .3 * k);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

/**
 * Vẽ nhân vật.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} p        — player (hoặc remote player)
 * @param {object} [skinOverride] — dùng cho remote player có skin riêng
 */
export function drawPlayer(ctx, p, skinOverride) {
  const skin = skinOverride || Wardrobe.skin;

  if (!p.alive) {
    ctx.save();
    ctx.globalAlpha = .45;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle || 0);
    ctx.fillStyle = '#2a0d13';
    rrPath(ctx, -p.radius * .6, -p.radius * .8, p.radius * 1.2, p.radius * 1.6, p.radius * .3);
    ctx.fill();
    ctx.strokeStyle = '#5a1a26';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
    return;
  }

  const R = p.radius || 14;
  const now = (typeof performance !== 'undefined' ? performance.now() : 0) * .001;
  const speed = Math.hypot(p.vx || 0, p.vy || 0);
  const moving = speed > 16;
  const phase = (p.moveAnim || 0) * 2.1;
  const bob = moving ? Math.sin(phase * 2) * R * .06 : Math.sin(now * 2.4) * R * .035;

  const flash = p.hitFlash > 0;
  const inv = p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0;
  ctx.globalAlpha = inv ? .5 : 1;

  const w = WEAPONS[p.weaponId];
  const melee = !!(w && w.type === 'melee');

  /* ---------- 1. Nón ngắm ----------
     Chỉ vẽ cho vũ khí cận chiến (tầm bắn đã có crosshair lo).
     Súng xa mà vẽ nón sẽ che kín màn hình. */
  if (melee) {
    const coneRange = (w.range || 90) * (1 + p.up.rangeMul);
    const half = (w.spread || .4) + .18;

    ctx.save();
    const g = ctx.createRadialGradient(p.x, p.y, 8, p.x, p.y, coneRange);
    g.addColorStop(0, hexA(skin.glow, .16));
    g.addColorStop(.45, hexA(skin.glow, .07));
    g.addColorStop(1, hexA(skin.glow, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.arc(p.x, p.y, coneRange, p.angle - half, p.angle + half);
    ctx.closePath();
    ctx.fill();

    /* Viền mảnh, đứt nét để không rối mắt */
    ctx.strokeStyle = hexA(skin.glow, .30);
    ctx.lineWidth = 1;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, coneRange, p.angle - half, p.angle + half);
    ctx.stroke();
    ctx.restore();
  }

  /* ---------- 2. Bóng đổ ---------- */
  ctx.fillStyle = 'rgba(0,0,0,.48)';
  ctx.beginPath();
  ctx.ellipse(p.x + 2, p.y + R * .55, R * 1.05, R * .5, 0, 0, TAU);
  ctx.fill();

  /* ---------- 3. Hào quang theo skin ---------- */
  if (skin.glow) {
    const pulse = .5 + Math.sin(now * 2.6) * .22;
    ctx.save();
    ctx.globalAlpha = (inv ? .12 : .22) * pulse;
    const og = ctx.createRadialGradient(p.x, p.y, R * .4, p.x, p.y, R * 3.1);
    og.addColorStop(0, hexA(skin.glow, .55));
    og.addColorStop(1, hexA(skin.glow, 0));
    ctx.fillStyle = og;
    ctx.beginPath();
    ctx.arc(p.x, p.y, R * 3.1, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /* ---------- 4. Thân nhân vật (xoay theo góc ngắm) ---------- */
  ctx.save();
  ctx.translate(p.x, p.y + bob);
  ctx.rotate(p.angle);

  /* 4a. Áo choàng — bay ngược hướng di chuyển */
  if (skin.cape) {
    const capeLen = R * (1.1 + Math.min(1, speed / 340) * .7);
    const wave = Math.sin(now * 6.2 + phase * .5) * R * .2;
    const flap = moving ? Math.sin(phase) * R * .1 : 0;
    ctx.save();
    ctx.globalAlpha = (inv ? .3 : .82);
    ctx.beginPath();
    ctx.moveTo(-R * .30, -R * .78);
    ctx.quadraticCurveTo(-R * .55 - capeLen * .45, -R * .95 + wave, -R * .45 - capeLen, wave * 1.5 + flap);
    ctx.quadraticCurveTo(-R * .55 - capeLen * .45, R * .95 + wave, -R * .30, R * .78);
    ctx.quadraticCurveTo(-R * .55, R * .1, -R * .30, -R * .78);
    ctx.closePath();
    const cg = ctx.createLinearGradient(0, 0, -capeLen, 0);
    cg.addColorStop(0, skin.cape);
    cg.addColorStop(1, hexA(skin.cape, .15));
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.strokeStyle = hexA(skin.trim, .45);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  /* 4b. Chân — bước theo quỹ đạo */
  const legSwing = moving ? Math.sin(phase) * R * .40 : 0;
  const legSwing2 = moving ? Math.sin(phase + Math.PI) * R * .40 : 0;
  ctx.fillStyle = skin.suit2;
  rrPath(ctx, -R * .78 + legSwing, -R * .62, R * .70, R * .34, R * .16);
  ctx.fill();
  rrPath(ctx, -R * .78 + legSwing2, R * .28, R * .70, R * .34, R * .16);
  ctx.fill();
  /* Đế giày phát sáng */
  ctx.fillStyle = hexA(skin.trim, .75);
  rrPath(ctx, -R * .22 + legSwing, -R * .58, R * .14, R * .26, R * .06);
  ctx.fill();
  rrPath(ctx, -R * .22 + legSwing2, R * .32, R * .14, R * .26, R * .06);
  ctx.fill();

  /* 4c. Ba lô năng lượng */
  ctx.fillStyle = skin.suit2;
  rrPath(ctx, -R * .95, -R * .40, R * .34, R * .80, R * .12);
  ctx.fill();
  ctx.strokeStyle = hexA(skin.trim, .55);
  ctx.lineWidth = 1;
  ctx.stroke();

  /* 4d. Thân giáp */
  const bodyGrad = ctx.createLinearGradient(0, -R, 0, R);
  if (flash) {
    bodyGrad.addColorStop(0, '#ff8a95');
    bodyGrad.addColorStop(1, '#8a1020');
  } else {
    bodyGrad.addColorStop(0, skin.suit);
    bodyGrad.addColorStop(1, skin.suit2);
  }
  ctx.save();
  ctx.shadowBlur = flash ? 24 : 14;
  ctx.shadowColor = flash ? '#ff3b52' : hexA(skin.glow, .8);
  rrPath(ctx, -R * .66, -R * .74, R * 1.24, R * 1.48, R * .36);
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.restore();

  /* Viền giáp */
  ctx.strokeStyle = flash ? '#ff3b52' : skin.trim;
  ctx.lineWidth = R * .10;
  rrPath(ctx, -R * .66, -R * .74, R * 1.24, R * 1.48, R * .36);
  ctx.stroke();

  /* Đường giáp giữa ngực */
  ctx.strokeStyle = hexA(skin.trim, .55);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-R * .18, -R * .60);
  ctx.lineTo(-R * .18, R * .60);
  ctx.stroke();

  /* Đèn lõi trên ngực */
  const corePulse = .55 + Math.sin(now * 5) * .3;
  ctx.save();
  ctx.globalAlpha = corePulse;
  ctx.shadowBlur = 14;
  ctx.shadowColor = skin.accent;
  ctx.fillStyle = skin.accent;
  ctx.beginPath();
  ctx.arc(R * .12, 0, R * .16, 0, TAU);
  ctx.fill();
  ctx.restore();

  /* 4e. Giáp vai */
  for (const sy of [-1, 1]) {
    ctx.save();
    ctx.fillStyle = skin.suit;
    ctx.strokeStyle = hexA(skin.trim, .9);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(-R * .12, sy * R * .78, R * .30, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = hexA(skin.accent, .8);
    ctx.beginPath();
    ctx.arc(-R * .12, sy * R * .78, R * .11, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /* 4f. Đầu + kính */
  const headX = R * .34;
  const headGrad = ctx.createRadialGradient(headX - R * .15, -R * .15, R * .05, headX, 0, R * .62);
  headGrad.addColorStop(0, flash ? '#ffd0d6' : lighten(skin.suit, .35));
  headGrad.addColorStop(1, flash ? '#a01a28' : skin.suit2);
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.arc(headX, 0, R * .56, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = hexA(skin.trim, .95);
  ctx.lineWidth = 1.4;
  ctx.stroke();

  /* Kính — cung phía trước */
  ctx.save();
  ctx.globalAlpha = inv ? .5 : .95;
  ctx.strokeStyle = skin.visor;
  ctx.lineWidth = R * .26;
  ctx.lineCap = 'round';
  ctx.shadowBlur = 12;
  ctx.shadowColor = skin.visor;
  ctx.beginPath();
  ctx.arc(headX, 0, R * .44, -1.02, 1.02);
  ctx.stroke();
  ctx.restore();

  /* 4g. Vũ khí trên tay */
  drawHeldWeapon(ctx, p, skin, w, R);

  ctx.restore();

  /* ---------- 5. Vệt di chuyển ---------- */
  if (moving && skin.trail) {
    ctx.save();
    ctx.globalAlpha = .28;
    ctx.strokeStyle = skin.trail;
    ctx.lineWidth = R * .5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x - (p.vx / (speed || 1)) * R * .6, p.y - (p.vy / (speed || 1)) * R * .6);
    ctx.lineTo(p.x - (p.vx / (speed || 1)) * R * 1.9, p.y - (p.vy / (speed || 1)) * R * 1.9);
    ctx.stroke();
    ctx.restore();
  }

  /* ---------- 6. Cung chém khi vung ---------- */
  if (p.attackAnim > 0) {
    const t = p.attackAnim / .16;
    ctx.save();
    ctx.globalAlpha = t * .55;
    ctx.strokeStyle = skin.visor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, R + 16 * (1 - t) + 8, p.angle - .8, p.angle + .8);
    ctx.stroke();
    ctx.restore();
  }

  /* ---------- 7. Trạng thái buff ---------- */
  if (p.buffs && p.buffs.dmg > 0) {
    ctx.save();
    ctx.globalAlpha = .35 + Math.sin(now * 8) * .15;
    ctx.strokeStyle = '#ff3b52';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, R + 9, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  if (p.buffs && p.buffs.berserk > 0) {
    ctx.save();
    ctx.globalAlpha = .45;
    ctx.strokeStyle = '#ffc44d';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, R + 14, now * 3, now * 3 + TAU);
    ctx.stroke();
    ctx.restore();
  }

  ctx.globalAlpha = 1;
}

/** hex (#rrggbb) + alpha → rgba(). Chấp nhận cả #rgb. */
function hexA(hex, a) {
  if (!hex) return 'rgba(255,255,255,' + a + ')';
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

/** Làm sáng màu hex theo tỉ lệ 0..1. */
function lighten(hex, k) {
  if (!hex) return '#ffffff';
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  const r = Math.min(255, ((n >> 16) & 255) + 255 * k);
  const g = Math.min(255, ((n >> 8) & 255) + 255 * k);
  const b = Math.min(255, (n & 255) + 255 * k);
  return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
}

/* =========================================================
PROJECTILE
========================================================= */
export function drawProjectile(ctx, pr) {
  ctx.save();
  ctx.shadowBlur = 14;
  ctx.shadowColor = pr.color;
  ctx.fillStyle = pr.color;

  if (pr.trail && pr.px !== undefined) {
    ctx.strokeStyle = pr.color;
    ctx.lineWidth = pr.r * .9;
    ctx.globalAlpha = .55;
    ctx.beginPath();
    ctx.moveTo(pr.px, pr.py);
    ctx.lineTo(pr.x, pr.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.beginPath();
  ctx.arc(pr.x, pr.y, pr.r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.beginPath();
  ctx.arc(pr.x, pr.y, pr.r * .45, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/* =========================================================
LOOT
========================================================= */
export function drawLoot(ctx, l) {
  const t = performance.now() * .004;
  const bob = Math.sin(t + l.x * .01) * 3;
  ctx.save();
  ctx.shadowBlur = 12;
  ctx.shadowColor = l.color;
  ctx.fillStyle = l.color;
  ctx.beginPath();
  switch (l.type) {
    case 'credit':
      ctx.arc(l.x, l.y + bob, 5.5, 0, TAU);
      ctx.fill();
      break;
    case 'xp':
      hexPath(ctx, l.x, l.y + bob, 6, t * .5);
      ctx.fill();
      break;
    case 'hp':
      ctx.fillRect(l.x - 5, l.y - 2 + bob, 10, 4);
      ctx.fillRect(l.x - 2, l.y - 5 + bob, 4, 10);
      break;
    case 'shard':
    default:
      ctx.moveTo(l.x, l.y - 7 + bob);
      ctx.lineTo(l.x + 6, l.y + bob);
      ctx.lineTo(l.x, l.y + 7 + bob);
      ctx.lineTo(l.x - 6, l.y + bob);
      ctx.closePath();
      ctx.fill();
      break;
  }
  ctx.restore();
}

/* =========================================================
CHEST
========================================================= */
export function drawChest(ctx, c) {
  const t = performance.now() * .003;
  ctx.save();
  if (c.open) {
    ctx.globalAlpha = Math.max(0, 1 - c.life / 3);
  } else {
    ctx.shadowBlur = 14 + Math.sin(t) * 5;
    ctx.shadowColor =
      c.rarity === 'legendary' ? '#ffc44d'
        : (c.rarity === 'rare' ? '#5aa9ff' : '#9fb4c4');
  }
  const col =
    c.rarity === 'legendary' ? '#ffc44d'
      : (c.rarity === 'rare' ? '#5aa9ff' : '#7d94a5');

  ctx.fillStyle = 'rgba(0,0,0,.5)';
  ctx.fillRect(c.x - 16, c.y - 6, 32, 22);
  ctx.fillStyle = '#101a24';
  ctx.fillRect(c.x - 16, c.y - 10, 32, 20);
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.strokeRect(c.x - 16, c.y - 10, 32, 20);
  ctx.fillStyle = col;
  ctx.fillRect(c.x - 16, c.y - 3, 32, 3);

  if (!c.open) {
    ctx.globalAlpha = .5 + .5 * Math.sin(t * 2);
    ctx.fillStyle = col;
    ctx.font = 'bold 12px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('★', c.x, c.y - 18);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}