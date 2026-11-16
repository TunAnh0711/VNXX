/* =========================================================
   VNXX — GAME / MAPGEN
   Sinh map theo layout của stage: vật cản, hazard, prop phá hủy.
   Deterministic theo seed → chơi lại cùng seed ra cùng map.
   ========================================================= */

import { makeRNG } from '../core/utils.js';

const W_SAFE = 300;   // bán kính vùng an toàn quanh điểm spawn player

/* =========================================================
   ENTRY
   ========================================================= */
export function generateMap(seed, stage, w, h) {
  const rng = makeRNG((seed >>> 0) + stage.id * 7919);

  const cx = w / 2;
  const cy = h / 2;

  const obstacles = [];
  const hazards = [];
  const props = [];

  const layout = stage.layout || 'open';
  const scale = stage.obstacleScale || 1;

  switch (layout) {
    case 'rooms':   genRooms(rng, stage, w, h, cx, cy, scale, obstacles); break;
    case 'pillars': genPillars(rng, stage, w, h, cx, cy, scale, obstacles); break;
    case 'maze':    genMaze(rng, stage, w, h, cx, cy, scale, obstacles); break;
    case 'arena':   genArena(rng, stage, w, h, cx, cy, scale, obstacles); break;
    default:        genOpen(rng, stage, w, h, cx, cy, scale, obstacles); break;
  }

  /* Khoét vùng spawn: không để tường/vật cản phủ lên điểm xuất phát */
  carveSafeZone(obstacles, cx, cy, 240);

  /* Rải thêm đồ trang trí nhỏ */
  genClutter(rng, stage, w, h, cx, cy, obstacles);

  /* Hazards */
  genHazards(rng, stage, w, h, cx, cy, obstacles, hazards);

  /* Props phá hủy */
  genProps(rng, stage, w, h, cx, cy, obstacles, hazards, props);

  return { obstacles, hazards, props };
}

/* =========================================================
   HELPERS
   ========================================================= */

function inSafe(x, y, cx, cy, pad = 0) {
  return Math.hypot(x - cx, y - cy) < W_SAFE + pad;
}

/* =========================================================
   CARVE SAFE ZONE
   Cắt vật cản đè lên vùng spawn. Cắt theo trục dài hơn để
   tường dài tách thành 2 đoạn chừa cửa đúng chỗ player đứng.
   ========================================================= */
function carveSafeZone(out, cx, cy, r) {
  const sx = cx - r;
  const sy = cy - r;
  const ex = cx + r;
  const ey = cy + r;
  const MIN = 24;

  const res = [];

  for (let i = 0; i < out.length; i++) {
    const o = out[i];

    const hitX = o.x < ex && o.x + o.w > sx;
    const hitY = o.y < ey && o.y + o.h > sy;
    if (!hitX || !hitY) { res.push(o); continue; }

    if (o.w >= o.h) {
      const lw = sx - o.x;
      const rx = ex;
      const rw = (o.x + o.w) - rx;
      if (lw >= MIN) res.push(Object.assign({}, o, { w: lw }));
      if (rw >= MIN) res.push(Object.assign({}, o, { x: rx, w: rw }));
    } else {
      const th = sy - o.y;
      const by = ey;
      const bh = (o.y + o.h) - by;
      if (th >= MIN) res.push(Object.assign({}, o, { h: th }));
      if (bh >= MIN) res.push(Object.assign({}, o, { y: by, h: bh }));
    }
  }

  out.length = 0;
  for (let i = 0; i < res.length; i++) out.push(res[i]);
}

function overlapsObstacle(obstacles, x, y, w, h, pad = 18) {
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    if (x < o.x + o.w + pad && x + w > o.x - pad &&
        y < o.y + o.h + pad && y + h > o.y - pad) {
      return true;
    }
  }
  return false;
}

function overlapsCircle(obstacles, x, y, r, pad = 12) {
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    const nx = Math.max(o.x, Math.min(x, o.x + o.w));
    const ny = Math.max(o.y, Math.min(y, o.y + o.h));
    if (Math.hypot(x - nx, y - ny) < r + pad) return true;
  }
  return false;
}

function pushBox(obstacles, x, y, w, h, kind) {
  obstacles.push({
    x: Math.round(x),
    y: Math.round(y),
    w: Math.round(w),
    h: Math.round(h),
    kind,
    blockBullets: true
  });
}

/* =========================================================
   LAYOUT: OPEN — vài cụm vật cản rời rạc
   ========================================================= */
function genOpen(rng, stage, w, h, cx, cy, scale, out) {
  const count = Math.round((10 + stage.id * 2) * scale);

  for (let i = 0; i < count; i++) {
    const bw = rng() < .5 ? 70 + rng() * 110 : 40 + rng() * 50;
    const bh = rng() < .5 ? 70 + rng() * 110 : 40 + rng() * 50;
    const x = 70 + rng() * (w - 140 - bw);
    const y = 70 + rng() * (h - 140 - bh);

    if (inSafe(x + bw / 2, y + bh / 2, cx, cy, 60)) continue;
    if (overlapsObstacle(out, x, y, bw, bh, 46)) continue;

    pushBox(out, x, y, bw, bh, pickKind(rng, stage));
  }
}

/* =========================================================
   LAYOUT: PILLARS — lưới cột đều, có jitter
   ========================================================= */
function genPillars(rng, stage, w, h, cx, cy, scale, out) {
  const cols = 5;
  const rows = 4;
  const stepX = w / cols;
  const stepY = h / rows;

  for (let i = 1; i < cols; i++) {
    for (let j = 1; j < rows; j++) {
      const jx = (rng() - .5) * 60;
      const jy = (rng() - .5) * 60;
      const x = i * stepX - 34 + jx;
      const y = j * stepY - 34 + jy;
      const s = 62 + rng() * 34;

      if (inSafe(x + s / 2, y + s / 2, cx, cy, 40)) continue;
      if (overlapsObstacle(out, x, y, s, s, 30)) continue;

      pushBox(out, x, y, s, s, rng() < .5 ? 'pillar' : 'machine');
    }
  }

  /* Vài bức tường dài */
  const walls = Math.round(4 * scale);
  for (let i = 0; i < walls; i++) {
    const horiz = rng() < .5;
    const len = 220 + rng() * 320;
    const thick = 34 + rng() * 16;
    const x = 80 + rng() * (w - 160 - (horiz ? len : thick));
    const y = 80 + rng() * (h - 160 - (horiz ? thick : len));
    const bw = horiz ? len : thick;
    const bh = horiz ? thick : len;

    if (inSafe(x + bw / 2, y + bh / 2, cx, cy, 80)) continue;
    if (overlapsObstacle(out, x, y, bw, bh, 40)) continue;

    pushBox(out, x, y, bw, bh, rng() < .5 ? 'barrier' : 'conveyor');
  }
}

/* =========================================================
   LAYOUT: ROOMS — chia phòng bằng vách có cửa
   ========================================================= */
function genRooms(rng, stage, w, h, cx, cy, scale, out) {
  const cols = 3;
  const rows = 2;
  const cellW = w / cols;
  const cellH = h / rows;
  const thick = 26;

  for (let i = 1; i < cols; i++) {
    const x = i * cellW - thick / 2;
    /* vách dọc chia thành 2 đoạn chừa cửa giữa */
    const doorY = cellH * .35 + rng() * cellH * .3;
    pushBox(out, x, 40, thick, doorY - 40, 'broken_wall');
    pushBox(out, x, doorY + 150, thick, h - 80 - (doorY - 40) - 150, 'broken_wall');
  }

  for (let j = 1; j < rows; j++) {
    const y = j * cellH - thick / 2;
    const doorX = cellW * .35 + rng() * cellW * .3;
    pushBox(out, 40, y, doorX - 40, thick, 'broken_wall');
    pushBox(out, doorX + 170, y, w - 80 - (doorX - 40) - 170, thick, 'broken_wall');
  }

  /* Đồ đạc trong phòng */
  const items = Math.round(10 * scale);
  for (let i = 0; i < items; i++) {
    const bw = 50 + rng() * 80;
    const bh = 50 + rng() * 80;
    const x = 70 + rng() * (w - 140 - bw);
    const y = 70 + rng() * (h - 140 - bh);

    if (inSafe(x + bw / 2, y + bh / 2, cx, cy, 40)) continue;
    if (overlapsObstacle(out, x, y, bw, bh, 34)) continue;

    pushBox(out, x, y, bw, bh, pickKind(rng, stage));
  }
}

/* =========================================================
   LAYOUT: MAZE — hành lang gấp khúc
   ========================================================= */
function genMaze(rng, stage, w, h, cx, cy, scale, out) {
  const step = 420;
  const thick = 30;

  for (let x = 120; x < w - 120; x += step) {
    const len = 180 + rng() * (h * .45);
    const y0 = rng() * (h - len - 100) + 50;
    pushBox(out, x, y0, thick, len, 'holo_wall');
  }

  for (let y = 140; y < h - 120; y += step) {
    const len = 180 + rng() * (w * .40);
    const x0 = rng() * (w - len - 100) + 50;
    pushBox(out, x0, y, len, thick, 'holo_wall');
  }

  /* Xoá những khối đè lên vùng an toàn */
  for (let i = out.length - 1; i >= 0; i--) {
    const o = out[i];
    if (inSafe(o.x + o.w / 2, o.y + o.h / 2, cx, cy, 30)) out.splice(i, 1);
  }

  const items = Math.round(6 * scale);
  for (let i = 0; i < items; i++) {
    const bw = 54 + rng() * 60;
    const bh = 54 + rng() * 60;
    const x = 70 + rng() * (w - 140 - bw);
    const y = 70 + rng() * (h - 140 - bh);
    if (inSafe(x + bw / 2, y + bh / 2, cx, cy, 40)) continue;
    if (overlapsObstacle(out, x, y, bw, bh, 34)) continue;
    pushBox(out, x, y, bw, bh, 'neon_pillar');
  }
}

/* =========================================================
   LAYOUT: ARENA — vòng vật cản quanh sân giữa
   ========================================================= */
function genArena(rng, stage, w, h, cx, cy, scale, out) {
  const rx = w * .32;
  const ry = h * .32;
  const n = 14;

  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * .12;
    const px = cx + Math.cos(a) * rx;
    const py = cy + Math.sin(a) * ry;
    const s = 56 + rng() * 40;

    if (rng() < .22) continue;   // chừa lối vào
    pushBox(out, px - s / 2, py - s / 2, s, s, rng() < .5 ? 'void_crystal' : 'dark_pillar');
  }

  /* Góc map */
  const corners = [
    [80, 80], [w - 240, 80], [80, h - 240], [w - 240, h - 240]
  ];
  corners.forEach(([x, y]) => {
    const s = 120 + rng() * 60;
    if (!overlapsObstacle(out, x, y, s, s, 30)) {
      pushBox(out, x, y, s, s, 'rubble');
    }
  });

  const items = Math.round(8 * scale);
  for (let i = 0; i < items; i++) {
    const bw = 60 + rng() * 70;
    const bh = 60 + rng() * 70;
    const x = 70 + rng() * (w - 140 - bw);
    const y = 70 + rng() * (h - 140 - bh);
    if (inSafe(x + bw / 2, y + bh / 2, cx, cy, 40)) continue;
    if (overlapsObstacle(out, x, y, bw, bh, 34)) continue;
    pushBox(out, x, y, bw, bh, 'debris');
  }
}

/* =========================================================
   CLUTTER — đồ trang trí nhỏ, không chặn đạn
   ========================================================= */
function genClutter(rng, stage, w, h, cx, cy, out) {
  const n = 12;
  for (let i = 0; i < n; i++) {
    const s = 26 + rng() * 26;
    const x = 60 + rng() * (w - 120 - s);
    const y = 60 + rng() * (h - 120 - s);
    if (inSafe(x + s / 2, y + s / 2, cx, cy, 20)) continue;
    if (overlapsObstacle(out, x, y, s, s, 16)) continue;

    out.push({
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(s),
      h: Math.round(s),
      kind: rng() < .5 ? 'debris' : 'sign',
      blockBullets: false
    });
  }
}

/* =========================================================
   HAZARD
   ========================================================= */
function genHazards(rng, stage, w, h, cx, cy, obstacles, out) {
  const types = stage.hazards || [];
  if (types.length === 0) return;

  const n = stage.hazardRate || 4;

  for (let i = 0; i < n; i++) {
    const type = types[Math.floor(rng() * types.length)];
    let r = 62;
    if (type === 'lava') r = 78 + rng() * 54;
    if (type === 'voidrift') r = 70 + rng() * 30;
    if (type === 'steam') r = 48 + rng() * 24;
    if (type === 'shockgrid') r = 86 + rng() * 40;

    const x = 120 + rng() * (w - 240);
    const y = 120 + rng() * (h - 240);

    if (inSafe(x, y, cx, cy, 90)) continue;
    if (overlapsCircle(obstacles, x, y, r, 30)) continue;

    out.push({
      type,
      x, y, r,
      phase: rng() * Math.PI * 2,
      tick: 0,
      dps: hazardDps(type),
      active: type === 'lava' || type === 'voidrift',
      cycle: hazardCycle(type)
    });
  }
}

function hazardDps(type) {
  switch (type) {
    case 'lava':      return 16;
    case 'steam':     return 22;
    case 'shockgrid': return 26;
    case 'voidrift':  return 8;
    default:          return 12;
  }
}

function hazardCycle(type) {
  switch (type) {
    case 'steam':     return { on: 1.6, off: 2.4 };
    case 'shockgrid': return { on: 1.2, off: 2.0 };
    default:          return null;
  }
}

/* =========================================================
   PROPS — thùng nổ & thùng tiếp tế
   ========================================================= */
function genProps(rng, stage, w, h, cx, cy, obstacles, hazards, out) {
  const barrels = stage.barrels || 4;
  const crates = stage.crates || 3;

  const place = (kind, radius) => {
    for (let tries = 0; tries < 40; tries++) {
      const x = 100 + rng() * (w - 200);
      const y = 100 + rng() * (h - 200);

      if (inSafe(x, y, cx, cy, 50)) continue;
      if (overlapsCircle(obstacles, x, y, radius, 20)) continue;
      if (overlapsCircle(hazards.map((z) => ({ x: z.x - z.r, y: z.y - z.r, w: z.r * 2, h: z.r * 2 })), x, y, radius, 26)) continue;

      out.push({
        kind,
        x, y,
        r: radius,
        hp: kind === 'barrel' ? 30 : 40,
        maxHp: kind === 'barrel' ? 30 : 40,
        dead: false,
        hitFlash: 0,
        wobble: rng() * Math.PI * 2
      });
      return;
    }
  };

  for (let i = 0; i < barrels; i++) place('barrel', 17);
  for (let i = 0; i < crates; i++) place('crate', 19);
}

/* =========================================================
   KIND THEO STAGE
   ========================================================= */
function pickKind(rng, stage) {
  const table = {
    1: ['container', 'pillar', 'machine', 'crate', 'pipe', 'wire_tangle'],
    2: ['furnace', 'conveyor', 'machine', 'barrel', 'pipe', 'barrier'],
    3: ['neon_pillar', 'holo_wall', 'hologram', 'neon_wreck', 'sign', 'barrier'],
    4: ['wreck', 'rubble', 'broken_wall', 'debris', 'dark_pillar'],
    5: ['void_crystal', 'dark_pillar', 'core_fragment', 'energy_field', 'rubble']
  }[stage.id] || ['container', 'pillar'];

  return table[Math.floor(rng() * table.length)];
}
