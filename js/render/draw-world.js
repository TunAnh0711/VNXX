/* =========================================================
   VNXX — RENDER / DRAW-WORLD
   Vẽ nền map (floor + grid + viền) + obstacles (nhiều loại).
   Mỗi obstacle.kind có style riêng.
   Pure functions, không phụ thuộc Game.
   ========================================================= */

import { drawObstacleShadow, drawObstacleTopLight } from './render3d.js';

/* =========================================================
   DRAW BACKGROUND — floor + grid + viền stage
   ========================================================= */
export function drawBackground(ctx, W, camX, camY, viewW, viewH) {
  const stage = W.stageDef;

  /* ---------- Floor ---------- */
  ctx.fillStyle = stage.floor;
  ctx.fillRect(0, 0, W.w, W.h);

  /* ---------- Grid ---------- */
  const gridSize = 64;

  const x0 = Math.max(0, Math.floor(camX / gridSize) * gridSize);
  const y0 = Math.max(0, Math.floor(camY / gridSize) * gridSize);
  const x1 = Math.min(W.w, camX + viewW + gridSize);
  const y1 = Math.min(W.h, camY + viewH + gridSize);

  ctx.strokeStyle = stage.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let x = x0; x < x1; x += gridSize) {
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
  }
  for (let y = y0; y < y1; y += gridSize) {
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
  }
  ctx.stroke();

  /* ---------- Viền map ---------- */
  ctx.strokeStyle = stage.accent;
  ctx.globalAlpha = .5;
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, W.w, W.h);
  ctx.globalAlpha = 1;
}

/* =========================================================
   DRAW OBSTACLES — dispatch theo kind
   ========================================================= */
export function drawObstacles(ctx, W, camX, camY, viewW, viewH) {
  const stage = W.stageDef;

  for (let i = 0; i < W.obstacles.length; i++) {
    const o = W.obstacles[i];

    /* Viewport cull */
    if (o.x > camX + viewW + 60) continue;
    if (o.x + o.w < camX - 60) continue;
    if (o.y > camY + viewH + 60) continue;
    if (o.y + o.h < camY - 60) continue;

    /* Decor: vẽ mờ hơn, không có shadow */
    if (o.isDecor) {
      ctx.globalAlpha = 0.75;
    } else {
      drawObstacleShadow(ctx, o);
    }

    /* Dispatch theo kind */
    switch (o.kind) {
      /* ===== STAGE 1 — ABANDONED FACILITY ===== */
      case 'container':    drawContainer(ctx, o, stage); break;
      case 'pillar':       drawPillar(ctx, o, stage); break;
      case 'machine':      drawMachine(ctx, o, stage); break;

      /* ===== STAGE 2 — INDUSTRIAL ZONE ===== */
      case 'crate':        drawCrate(ctx, o, stage); break;
      case 'furnace':      drawFurnace(ctx, o, stage); break;
      case 'conveyor':     drawConveyor(ctx, o, stage); break;
      case 'barrel':       drawBarrel(ctx, o, stage); break;
      case 'pipe':         drawPipe(ctx, o, stage); break;
      case 'wire_tangle':  drawWireTangle(ctx, o, stage); break;

      /* ===== STAGE 3 — NEON CITY ===== */
      case 'barrier':      drawBarrier(ctx, o, stage); break;
      case 'neon_pillar':  drawNeonPillar(ctx, o, stage); break;
      case 'holo_wall':    drawHoloWall(ctx, o, stage); break;
      case 'sign':         drawSign(ctx, o, stage); break;
      case 'hologram':     drawHologram(ctx, o, stage); break;
      case 'neon_wreck':   drawNeonWreck(ctx, o, stage); break;

      /* ===== STAGE 4 — DEAD SECTOR ===== */
      case 'debris':       drawDebris(ctx, o, stage); break;
      case 'wreck':        drawWreck(ctx, o, stage); break;
      case 'rubble':       drawRubble(ctx, o, stage); break;
      case 'broken_wall':  drawBrokenWall(ctx, o, stage); break;

      /* ===== STAGE 5 — VOID CORE ===== */
      case 'void_crystal': drawVoidCrystal(ctx, o, stage); break;
      case 'dark_pillar':  drawDarkPillar(ctx, o, stage); break;
      case 'energy_field': drawEnergyField(ctx, o, stage); break;
      case 'core_fragment':drawCoreFragment(ctx, o, stage); break;

      /* Fallback */
      default:             drawGenericBox(ctx, o, stage); break;
    }

    /* 2.5D bevel — mặt trên bắt sáng, chân tối (sau body, trước khi reset alpha) */
    if (!o.isDecor) {
      drawObstacleTopLight(ctx, o, stage);
    }

    ctx.globalAlpha = 1;
  }
}

/* =========================================================
   HELPERS
   ========================================================= */
function stroke(ctx, o, color, alpha = .35, width = 1.4) {
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.strokeRect(o.x + .5, o.y + .5, o.w - 1, o.h - 1);
  ctx.globalAlpha = 1;
}

/* =========================================================
   STAGE 1 — ABANDONED FACILITY
   ========================================================= */

/* Container — thùng shipping gân sóng */
function drawContainer(ctx, o, stage) {
  /* Body */
  ctx.fillStyle = stage.wall;
  ctx.fillRect(o.x, o.y, o.w, o.h);

  /* Gân dọc */
  ctx.strokeStyle = '#000';
  ctx.globalAlpha = .35;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const step = 12;
  if (o.w > o.h) {
    for (let x = o.x + step; x < o.x + o.w; x += step) {
      ctx.moveTo(x, o.y + 4);
      ctx.lineTo(x, o.y + o.h - 4);
    }
  } else {
    for (let y = o.y + step; y < o.y + o.h; y += step) {
      ctx.moveTo(o.x + 4, y);
      ctx.lineTo(o.x + o.w - 4, y);
    }
  }
  ctx.stroke();

  /* Ban dọc ở hai đầu */
  ctx.globalAlpha = .6;
  ctx.fillStyle = stage.accent;
  ctx.fillRect(o.x + 2, o.y, 2, o.h);
  ctx.fillRect(o.x + o.w - 4, o.y, 2, o.h);

  stroke(ctx, o, stage.accent, .4, 1.5);
}

/* Pillar — cột bê tông */
function drawPillar(ctx, o, stage) {
  /* Body gradient */
  const grad = ctx.createLinearGradient(o.x, o.y, o.x + o.w, o.y);
  grad.addColorStop(0, '#000');
  grad.addColorStop(.5, stage.wall);
  grad.addColorStop(1, '#000');
  ctx.fillStyle = grad;
  ctx.fillRect(o.x, o.y, o.w, o.h);

  /* Vết nứt ngẫu nhiên */
  ctx.strokeStyle = stage.accent;
  ctx.globalAlpha = .25;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const cx = o.x + o.w * .3;
  const cy = o.y + o.h * .3;
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + 15, cy + 12);
  ctx.lineTo(cx + 8, cy + 30);
  ctx.moveTo(cx + o.w * .3, cy + o.h * .2);
  ctx.lineTo(cx + o.w * .4, cy + o.h * .4);
  ctx.stroke();
  ctx.globalAlpha = 1;

  stroke(ctx, o, stage.accent, .3, 1.4);
}

/* Machine — bảng điều khiển với đèn LED */
function drawMachine(ctx, o, stage) {
  /* Body */
  ctx.fillStyle = '#0a0f16';
  ctx.fillRect(o.x, o.y, o.w, o.h);

  /* Màn hình / bảng LED */
  ctx.fillStyle = stage.accent;
  ctx.globalAlpha = .18;
  ctx.fillRect(o.x + 6, o.y + 6, o.w - 12, o.h * .5);
  ctx.globalAlpha = 1;

  /* Đèn LED nhấp nháy */
  const t = performance.now() * .003;
  const ledCount = Math.min(6, Math.floor(o.w / 20));
  for (let i = 0; i < ledCount; i++) {
    const on = Math.sin(t + i * 1.7) > 0;
    ctx.fillStyle = on ? stage.accent : '#1a3a4a';
    ctx.fillRect(
      o.x + 8 + i * 14,
      o.y + o.h - 12,
      6, 6
    );
  }

  /* Khe tản nhiệt */
  ctx.strokeStyle = '#000';
  ctx.globalAlpha = .5;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = o.y + o.h * .62; y < o.y + o.h - 16; y += 3) {
    ctx.moveTo(o.x + 6, y);
    ctx.lineTo(o.x + o.w - 6, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  stroke(ctx, o, stage.accent, .5, 1.5);
}

/* =========================================================
   STAGE 2 — INDUSTRIAL ZONE
   ========================================================= */

/* Crate — thùng gỗ với X */
function drawCrate(ctx, o, stage) {
  /* Body gỗ */
  const grad = ctx.createLinearGradient(o.x, o.y, o.x, o.y + o.h);
  grad.addColorStop(0, '#5a3a1e');
  grad.addColorStop(1, '#2a1a0c');
  ctx.fillStyle = grad;
  ctx.fillRect(o.x, o.y, o.w, o.h);

  /* Viền ngoài dày */
  ctx.strokeStyle = '#1a0e05';
  ctx.lineWidth = 3;
  ctx.strokeRect(o.x + 1.5, o.y + 1.5, o.w - 3, o.h - 3);

  /* X chéo */
  ctx.strokeStyle = '#3a2410';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(o.x + 3, o.y + 3);
  ctx.lineTo(o.x + o.w - 3, o.y + o.h - 3);
  ctx.moveTo(o.x + o.w - 3, o.y + 3);
  ctx.lineTo(o.x + 3, o.y + o.h - 3);
  ctx.stroke();

  /* Nắp đóng đinh 4 góc */
  ctx.fillStyle = '#6a4a2a';
  [[o.x + 4, o.y + 4], [o.x + o.w - 8, o.y + 4],
   [o.x + 4, o.y + o.h - 8], [o.x + o.w - 8, o.y + o.h - 8]]
    .forEach(([x, y]) => ctx.fillRect(x, y, 4, 4));

  stroke(ctx, o, stage.accent, .25, 1);
}

/* Furnace — lò nung với khe sáng */
function drawFurnace(ctx, o, stage) {
  /* Body kim loại */
  const grad = ctx.createLinearGradient(o.x, o.y, o.x + o.w, o.y + o.h);
  grad.addColorStop(0, '#1a1a1a');
  grad.addColorStop(.5, '#3a2a15');
  grad.addColorStop(1, '#1a1a1a');
  ctx.fillStyle = grad;
  ctx.fillRect(o.x, o.y, o.w, o.h);

  /* Khe lửa phát sáng */
  const t = performance.now() * .004;
  const glow = .6 + Math.sin(t) * .2;
  ctx.shadowBlur = 15;
  ctx.shadowColor = '#ff6a1a';
  ctx.fillStyle = `rgba(255, 106, 26, ${glow})`;

  const slotCount = 3;
  for (let i = 0; i < slotCount; i++) {
    const sy = o.y + o.h * (.55 + i * .13);
    ctx.fillRect(o.x + 6, sy, o.w - 12, 3);
  }
  ctx.shadowBlur = 0;

  stroke(ctx, o, '#ffa53a', .45, 1.5);
}

/* Conveyor — băng tải với con lăn */
function drawConveyor(ctx, o, stage) {
  /* Body */
  ctx.fillStyle = '#1a1e24';
  ctx.fillRect(o.x, o.y, o.w, o.h);

  /* Belt chạy dọc */
  const isHorizontal = o.w > o.h;
  const beltThickness = isHorizontal ? o.h * .4 : o.w * .4;

  ctx.fillStyle = '#0a0e14';
  if (isHorizontal) {
    ctx.fillRect(o.x, o.y + (o.h - beltThickness) / 2, o.w, beltThickness);
  } else {
    ctx.fillRect(o.x + (o.w - beltThickness) / 2, o.y, beltThickness, o.h);
  }

  /* Con lăn */
  const rollStep = 20;
  const t = performance.now() * .05;
  ctx.fillStyle = stage.accent;
  ctx.globalAlpha = .55;

  if (isHorizontal) {
    const cy = o.y + o.h / 2;
    const offset = (t % rollStep);
    for (let x = o.x + offset; x < o.x + o.w; x += rollStep) {
      ctx.beginPath();
      ctx.arc(x, cy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    const cx = o.x + o.w / 2;
    const offset = (t % rollStep);
    for (let y = o.y + offset; y < o.y + o.h; y += rollStep) {
      ctx.beginPath();
      ctx.arc(cx, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  stroke(ctx, o, stage.accent, .35, 1.4);
}

/* Barrel — thùng phuy */
function drawBarrel(ctx, o, stage) {
  const r = Math.min(o.w, o.h) / 2;
  const cx = o.x + o.w / 2;
  const cy = o.y + o.h / 2;

  /* Body tròn */
  const grad = ctx.createRadialGradient(cx - r * .3, cy - r * .3, r * .1, cx, cy, r);
  grad.addColorStop(0, '#4a2a1a');
  grad.addColorStop(1, '#1a0a05');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  /* Vòng band */
  ctx.strokeStyle = '#0a0502';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r * .7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * .4, 0, Math.PI * 2);
  ctx.stroke();

  /* Nhãn cảnh báo */
  ctx.fillStyle = stage.accent;
  ctx.globalAlpha = .5;
  ctx.fillRect(cx - r * .35, cy - 2, r * .7, 4);
  ctx.globalAlpha = 1;

  stroke(ctx, o, stage.accent, .4, 1.4);
}

/* Pipe — ống dẫn (decor) */
function drawPipe(ctx, o, stage) {
  const isHoriz = o.w > o.h;
  const thickness = isHoriz ? o.h * .5 : o.w * .5;

  /* Body cylinder */
  const grad = isHoriz
    ? ctx.createLinearGradient(0, o.y, 0, o.y + o.h)
    : ctx.createLinearGradient(o.x, 0, o.x + o.w, 0);

  grad.addColorStop(0, '#1a2028');
  grad.addColorStop(.35, '#4a5a68');
  grad.addColorStop(.5, '#6a7a88');
  grad.addColorStop(.65, '#3a4a58');
  grad.addColorStop(1, '#0a1018');
  ctx.fillStyle = grad;

  if (isHoriz) {
    ctx.fillRect(o.x, o.y + (o.h - thickness) / 2, o.w, thickness);
  } else {
    ctx.fillRect(o.x + (o.w - thickness) / 2, o.y, thickness, o.h);
  }

  /* Đốt / khớp nối */
  ctx.strokeStyle = '#0a0e14';
  ctx.lineWidth = 2;
  const segStep = 40;
  ctx.beginPath();
  if (isHoriz) {
    for (let x = o.x + segStep; x < o.x + o.w; x += segStep) {
      ctx.moveTo(x, o.y + 2);
      ctx.lineTo(x, o.y + o.h - 2);
    }
  } else {
    for (let y = o.y + segStep; y < o.y + o.h; y += segStep) {
      ctx.moveTo(o.x + 2, y);
      ctx.lineTo(o.x + o.w - 2, y);
    }
  }
  ctx.stroke();
}

/* Wire tangle — đống dây rối (decor) */
function drawWireTangle(ctx, o, stage) {
  ctx.strokeStyle = stage.accent;
  ctx.globalAlpha = .6;
  ctx.lineWidth = 1.5;

  const cx = o.x + o.w / 2;
  const cy = o.y + o.h / 2;

  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    const seed = i * 17.3;
    for (let t = 0; t <= 1; t += .1) {
      const x = o.x + o.w * t;
      const y = cy + Math.sin(t * 8 + seed) * 8;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/* =========================================================
   STAGE 3 — NEON CITY
   ========================================================= */

/* Barrier — rào chắn hazard */
function drawBarrier(ctx, o, stage) {
  /* Body tối */
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(o.x, o.y, o.w, o.h);

  /* Sọc vàng đen chéo */
  const stripeW = 14;
  ctx.save();
  ctx.beginPath();
  ctx.rect(o.x, o.y, o.w, o.h);
  ctx.clip();

  for (let i = -o.h; i < o.w + o.h; i += stripeW * 2) {
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.moveTo(o.x + i, o.y);
    ctx.lineTo(o.x + i + stripeW, o.y);
    ctx.lineTo(o.x + i + stripeW - o.h, o.y + o.h);
    ctx.lineTo(o.x + i - o.h, o.y + o.h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  stroke(ctx, o, '#ffcc00', .6, 1.5);
}

/* Neon pillar — cột neon */
function drawNeonPillar(ctx, o, stage) {
  ctx.fillStyle = '#0a0512';
  ctx.fillRect(o.x, o.y, o.w, o.h);

  /* Dải neon dọc */
  ctx.shadowBlur = 18;
  ctx.shadowColor = stage.accent;
  ctx.fillStyle = stage.accent;

  const t = performance.now() * .005;
  const stripCount = Math.max(2, Math.floor(o.w / 20));
  const alpha = .7 + Math.sin(t) * .3;

  ctx.globalAlpha = alpha;
  for (let i = 0; i < stripCount; i++) {
    const sx = o.x + 6 + i * ((o.w - 12) / stripCount);
    ctx.fillRect(sx, o.y + 6, 3, o.h - 12);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  stroke(ctx, o, stage.accent, .8, 1.5);
}

/* Holo wall — tường hologram */
function drawHoloWall(ctx, o, stage) {
  const t = performance.now() * .003;

  /* Nền trong suốt */
  ctx.fillStyle = stage.accent;
  ctx.globalAlpha = .08 + Math.sin(t) * .04;
  ctx.fillRect(o.x, o.y, o.w, o.h);
  ctx.globalAlpha = 1;

  /* Scanlines */
  ctx.strokeStyle = stage.accent;
  ctx.globalAlpha = .35;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = o.y + 4; y < o.y + o.h; y += 6) {
    ctx.moveTo(o.x, y);
    ctx.lineTo(o.x + o.w, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  /* Viền phát sáng */
  ctx.shadowBlur = 15;
  ctx.shadowColor = stage.accent;
  ctx.strokeStyle = stage.accent;
  ctx.globalAlpha = .8 + Math.sin(t * 2) * .2;
  ctx.lineWidth = 2;
  ctx.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

/* Sign — bảng hiệu */
function drawSign(ctx, o, stage) {
  /* Body */
  ctx.fillStyle = '#0a0512';
  ctx.fillRect(o.x, o.y, o.w, o.h);

  /* Text giả lập */
  ctx.fillStyle = stage.accent;
  ctx.globalAlpha = .7;
  const lineCount = 3;
  for (let i = 0; i < lineCount; i++) {
    const w = o.w * (0.4 + Math.random() * 0.4);
    ctx.fillRect(o.x + 8, o.y + 8 + i * 12, w, 4);
  }
  ctx.globalAlpha = 1;

  /* Viền neon */
  ctx.shadowBlur = 12;
  ctx.shadowColor = stage.accent;
  stroke(ctx, o, stage.accent, .9, 2);
  ctx.shadowBlur = 0;
}

/* Hologram — hình chiếu 3D (decor) */
function drawHologram(ctx, o, stage) {
  const cx = o.x + o.w / 2;
  const cy = o.y + o.h / 2;
  const r = Math.min(o.w, o.h) * .35;
  const t = performance.now() * .002;

  /* Vòng ngoài xoay */
  ctx.strokeStyle = stage.accent;
  ctx.globalAlpha = .7;
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 12;
  ctx.shadowColor = stage.accent;

  ctx.beginPath();
  ctx.arc(cx, cy, r, t, t + Math.PI * 1.5);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, r * .6, -t, -t + Math.PI);
  ctx.stroke();

  /* Tâm phát sáng */
  ctx.globalAlpha = .5 + Math.sin(t * 5) * .3;
  ctx.fillStyle = stage.accent;
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

/* Neon wreck — rác công nghệ phát sáng (decor) */
function drawNeonWreck(ctx, o, stage) {
  const t = performance.now() * .004;

  /* Polygon ngẫu nhiên méo mó */
  ctx.fillStyle = '#0a0512';
  ctx.beginPath();
  const verts = 5;
  for (let i = 0; i < verts; i++) {
    const a = (i / verts) * Math.PI * 2;
    const r = Math.min(o.w, o.h) * (.35 + Math.sin(i * 3) * .12);
    const x = o.x + o.w / 2 + Math.cos(a) * r;
    const y = o.y + o.h / 2 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  /* Vết nứt phát sáng */
  ctx.strokeStyle = stage.accent;
  ctx.globalAlpha = .6 + Math.sin(t) * .3;
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 10;
  ctx.shadowColor = stage.accent;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

/* =========================================================
   STAGE 4 — DEAD SECTOR
   ========================================================= */

/* Debris — đống đổ nát */
function drawDebris(ctx, o, stage) {
  const rng = (seed) => {
    let s = seed;
    return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  };
  const rand = rng(o.x * 1000 + o.y);

  ctx.fillStyle = stage.wall;
  const blocks = 5;
  for (let i = 0; i < blocks; i++) {
    const bw = o.w * (.3 + rand() * .4);
    const bh = o.h * (.3 + rand() * .4);
    const x = o.x + rand() * (o.w - bw);
    const y = o.y + rand() * (o.h - bh);
    ctx.fillRect(x, y, bw, bh);
  }

  /* Vết nứt */
  ctx.strokeStyle = stage.accent;
  ctx.globalAlpha = .3;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const x = o.x + rand() * o.w;
    const y = o.y + rand() * o.h;
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - .5) * 30, y + (rand() - .5) * 30);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/* Wreck — xác xe hỏng */
function drawWreck(ctx, o, stage) {
  /* Body */
  ctx.fillStyle = stage.wall;
  ctx.fillRect(o.x, o.y, o.w, o.h);

  /* Kính nứt */
  ctx.fillStyle = '#0a0e12';
  ctx.fillRect(o.x + o.w * .15, o.y + o.h * .15, o.w * .7, o.h * .35);

  ctx.strokeStyle = stage.accent;
  ctx.globalAlpha = .5;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(o.x + o.w * .5, o.y + o.h * .15);
  ctx.lineTo(o.x + o.w * .35, o.y + o.h * .5);
  ctx.moveTo(o.x + o.w * .5, o.y + o.h * .15);
  ctx.lineTo(o.x + o.w * .7, o.y + o.h * .45);
  ctx.stroke();
  ctx.globalAlpha = 1;

  /* Bánh xe (chấm tròn 2 góc dưới) */
  ctx.fillStyle = '#0a0502';
  ctx.beginPath();
  ctx.arc(o.x + 10, o.y + o.h - 5, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(o.x + o.w - 10, o.y + o.h - 5, 5, 0, Math.PI * 2);
  ctx.fill();

  stroke(ctx, o, stage.accent, .3, 1.2);
}

/* Rubble — sỏi đá rải rác */
function drawRubble(ctx, o, stage) {
  const rng = (seed) => {
    let s = seed;
    return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  };
  const rand = rng(o.x * 777 + o.y * 13);

  ctx.fillStyle = stage.wall;
  const stones = 12;
  for (let i = 0; i < stones; i++) {
    const sr = 3 + rand() * 6;
    const x = o.x + rand() * o.w;
    const y = o.y + rand() * o.h;
    ctx.beginPath();
    ctx.arc(x, y, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  stroke(ctx, o, stage.accent, .2, 1);
}

/* Broken wall — tường vỡ */
function drawBrokenWall(ctx, o, stage) {
  /* Body với cạnh trên ziczac */
  ctx.fillStyle = stage.wall;
  ctx.beginPath();
  ctx.moveTo(o.x, o.y + o.h);

  const segs = 6;
  const rng = (seed) => {
    let s = seed;
    return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  };
  const rand = rng(o.x * 31 + o.y);

  for (let i = 0; i <= segs; i++) {
    const x = o.x + (o.w / segs) * i;
    const y = o.y + rand() * o.h * .35;
    ctx.lineTo(x, y);
  }

  ctx.lineTo(o.x + o.w, o.y + o.h);
  ctx.closePath();
  ctx.fill();

  /* Mặt trên sáng hơn → tường tách khỏi sàn */
  const g = ctx.createLinearGradient(0, o.y, 0, o.y + o.h);
  g.addColorStop(0, 'rgba(150,220,255,.10)');
  g.addColorStop(.3, 'rgba(120,180,220,.03)');
  g.addColorStop(1, 'rgba(0,0,0,.28)');
  ctx.fillStyle = g;
  ctx.fill();

  stroke(ctx, o, stage.accent, .45, 1.6);
}

/* =========================================================
   STAGE 5 — VOID CORE
   ========================================================= */

/* Void crystal — tinh thể hư không */
function drawVoidCrystal(ctx, o, stage) {
  const cx = o.x + o.w / 2;
  const cy = o.y + o.h / 2;
  const t = performance.now() * .002;

  /* Hình thoi */
  ctx.fillStyle = '#0a0512';
  ctx.beginPath();
  ctx.moveTo(cx, o.y + 4);
  ctx.lineTo(o.x + o.w - 4, cy);
  ctx.lineTo(cx, o.y + o.h - 4);
  ctx.lineTo(o.x + 4, cy);
  ctx.closePath();
  ctx.fill();

  /* Glow bên trong */
  ctx.shadowBlur = 20 + Math.sin(t * 3) * 8;
  ctx.shadowColor = stage.accent;
  ctx.strokeStyle = stage.accent;
  ctx.globalAlpha = .8 + Math.sin(t * 4) * .2;
  ctx.lineWidth = 2;
  ctx.stroke();

  /* Tia sáng ở tâm */
  ctx.fillStyle = stage.accent;
  ctx.globalAlpha = .5 + Math.sin(t * 5) * .3;
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

/* Dark pillar — cột obsidian */
function drawDarkPillar(ctx, o, stage) {
  /* Body đen với gradient tím nhẹ */
  const grad = ctx.createLinearGradient(o.x, 0, o.x + o.w, 0);
  grad.addColorStop(0, '#050205');
  grad.addColorStop(.5, '#1a0a2a');
  grad.addColorStop(1, '#050205');
  ctx.fillStyle = grad;
  ctx.fillRect(o.x, o.y, o.w, o.h);

  /* Vết nứt phát sáng */
  const t = performance.now() * .003;
  ctx.strokeStyle = stage.accent;
  ctx.globalAlpha = .4 + Math.sin(t) * .2;
  ctx.lineWidth = 1;
  ctx.shadowBlur = 10;
  ctx.shadowColor = stage.accent;

  const cx = o.x + o.w * .4;
  const cy = o.y + o.h * .3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + 8, cy + 15);
  ctx.lineTo(cx + 3, cy + 32);
  ctx.moveTo(cx + 15, cy + 10);
  ctx.lineTo(cx + 22, cy + 28);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  stroke(ctx, o, stage.accent, .5, 1.4);
}

/* Energy field — trường năng lượng (decor) */
function drawEnergyField(ctx, o, stage) {
  const t = performance.now() * .002;

  /* Chỉ vẽ viền phát sáng */
  ctx.shadowBlur = 20;
  ctx.shadowColor = stage.accent;
  ctx.strokeStyle = stage.accent;

  const alpha = .4 + Math.sin(t * 3) * .15;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 2;
  ctx.strokeRect(o.x, o.y, o.w, o.h);

  /* Hạt bay trong vùng */
  ctx.fillStyle = stage.accent;
  ctx.globalAlpha = .7;
  for (let i = 0; i < 5; i++) {
    const px = o.x + ((t * 20 + i * 43) % o.w);
    const py = o.y + (Math.sin(t * 2 + i) * .5 + .5) * o.h;
    ctx.beginPath();
    ctx.arc(px, py, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

/* Core fragment — mảnh lõi bay */
function drawCoreFragment(ctx, o, stage) {
  const cx = o.x + o.w / 2;
  const cy = o.y + o.h / 2;
  const t = performance.now() * .003;
  const bob = Math.sin(t * 2) * 3;

  /* Polygon xoay */
  ctx.save();
  ctx.translate(cx, cy + bob);
  ctx.rotate(t);

  ctx.shadowBlur = 18;
  ctx.shadowColor = stage.accent;
  ctx.fillStyle = stage.accent;
  ctx.globalAlpha = .8;

  const sides = 6;
  const r = Math.min(o.w, o.h) * .35;
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  /* Lõi trắng */
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, r * .35, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  ctx.shadowBlur = 0;
}

/* =========================================================
   FALLBACK — hình chữ nhật generic
   ========================================================= */
function drawGenericBox(ctx, o, stage) {
  ctx.fillStyle = stage.wall;
  ctx.fillRect(o.x, o.y, o.w, o.h);

  ctx.globalAlpha = .16;
  ctx.strokeStyle = stage.accent;
  ctx.beginPath();
  ctx.moveTo(o.x, o.y);
  ctx.lineTo(o.x + o.w, o.y + o.h);
  ctx.moveTo(o.x + o.w, o.y);
  ctx.lineTo(o.x, o.y + o.h);
  ctx.stroke();
  ctx.globalAlpha = 1;

  stroke(ctx, o, stage.accent, .28, 1.4);
}