/* =========================================================
   VNXX — RENDER / DRAW-FX
   Hiệu ứng màn hình (screen-space):
   - Vignette đỏ khi HP thấp
   - Scanlines CRT
   - Darkness overlay (wave event)
   Pure functions, không phụ thuộc Game.
   ========================================================= */

import Settings from '../core/settings.js';

/* =========================================================
   VIGNETTE — viền đỏ khi máu thấp
   Chỉ vẽ khi HP < 35%. Alpha tăng dần khi HP giảm.
   ========================================================= */
export function drawVignette(ctx, W, viewW, viewH) {
  if (!Settings.get('fxOn')) return;

  const p = W.player;
  const hpPct = p.hp / p.maxHp;
  if (hpPct > .35) return;

  const cx = viewW / 2;
  const cy = viewH / 2;
  const innerR = viewH * .22;
  const outerR = viewH * .75;

  const g = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
  g.addColorStop(0, 'rgba(255,0,30,0)');
  g.addColorStop(1, 'rgba(255,0,30,' + (0.30 * (1 - hpPct)) + ')');

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, viewW, viewH);
}

/* =========================================================
   SCANLINES — hiệu ứng màn hình CRT
   Vẽ 1 đường ngang mỗi 4px, alpha .035.
   ========================================================= */
export function drawScanlines(ctx, viewW, viewH) {
  if (!Settings.get('fxOn')) return;

  ctx.globalAlpha = .035;
  ctx.fillStyle = '#28e0ff';

  for (let y = 0; y < viewH; y += 4) {
    ctx.fillRect(0, y, viewW, 1);
  }

  ctx.globalAlpha = 1;
}

/* =========================================================
   DARKNESS — overlay đen khi wave event DARKNESS active
   Vẽ radial gradient quanh player (view-space):
   - Trong bán kính 60px: trong suốt
   - Ngoài bán kính 420px: đen alpha .78
   ========================================================= */
export function drawDarkness(ctx, W, camX, camY, viewW, viewH) {
  const p = W.player;

  /* Chuyển world → screen */
  const sx = p.x - camX;
  const sy = p.y - camY;

  const g = ctx.createRadialGradient(sx, sy, 60, sx, sy, 420);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,.78)');

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, viewW, viewH);
}
/* =========================================================
   CROSSHAIR — vẽ trên canvas, mỗi vũ khí 1 kiểu
   ========================================================= */
export function drawCrosshair(ctx, x, y, weaponId, opts = {}) {
  const color = opts.color || '#28e0ff';
  const pulse = opts.pulse || 0;   // 0..1 — khi bắn

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle   = color;
  ctx.lineWidth   = 1.5;
  ctx.shadowBlur  = 10;
  ctx.shadowColor = color;

  switch (weaponId) {
    case 'blade':    drawMelee(ctx, x, y, color); break;
    case 'shotgun':  drawSpread(ctx, x, y, color, pulse); break;
    case 'smg':      drawRapid(ctx, x, y, color); break;
    case 'rifle':    drawCross(ctx, x, y, color); break;
    case 'sniper':   drawScope(ctx, x, y, color); break;
    case 'plasma':   drawOrb(ctx, x, y, color, pulse); break;
    case 'rocket':   drawBracket(ctx, x, y, color); break;
    case 'railgun':  drawLine(ctx, x, y, color); break;
    case 'voidw':    drawArcane(ctx, x, y, color); break;
    case 'pistol':
    default:         drawBasic(ctx, x, y, color); break;
  }

  ctx.restore();
}

/* ---------- PISTOL: vòng + 4 tia ngắn ---------- */
function drawBasic(ctx, x, y, c) {
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x, y - 14); ctx.lineTo(x, y - 6);
  ctx.moveTo(x, y + 6);  ctx.lineTo(x, y + 14);
  ctx.moveTo(x - 14, y); ctx.lineTo(x - 6, y);
  ctx.moveTo(x + 6, y);  ctx.lineTo(x + 14, y);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, 1.8, 0, Math.PI * 2);
  ctx.fill();
}

/* ---------- SHOTGUN: 4 vòng lồng thể hiện spread ---------- */
function drawSpread(ctx, x, y, c, pulse) {
  const baseR = 10 + pulse * 4;

  ctx.beginPath();
  ctx.arc(x, y, baseR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = .55;
  ctx.beginPath();
  ctx.arc(x, y, baseR + 5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = .3;
  ctx.beginPath();
  ctx.arc(x, y, baseR + 10, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(x, y, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

/* ---------- SMG: chấm + 6 tia nhỏ ---------- */
function drawRapid(ctx, x, y, c) {
  ctx.beginPath();
  ctx.arc(x, y, 2, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8);
    ctx.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12);
    ctx.stroke();
  }
}

/* ---------- RIFLE: chữ thập mảnh, dài ---------- */
function drawCross(ctx, x, y, c) {
  const gap = 4;
  const len = 13;

  ctx.beginPath();
  ctx.moveTo(x, y - gap); ctx.lineTo(x, y - gap - len);
  ctx.moveTo(x, y + gap); ctx.lineTo(x, y + gap + len);
  ctx.moveTo(x - gap, y); ctx.lineTo(x - gap - len, y);
  ctx.moveTo(x + gap, y); ctx.lineTo(x + gap + len, y);
  ctx.stroke();

  /* 4 chấm ở đầu tia */
  [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dx, dy]) => {
    ctx.beginPath();
    ctx.arc(x + dx * (gap + len), y + dy * (gap + len), 1.4, 0, Math.PI * 2);
    ctx.fill();
  });
}

/* ---------- SNIPER: scope lớn + vạch chia ---------- */
function drawScope(ctx, x, y, c) {
  /* Vòng ngoài */
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.stroke();

  /* Vòng trong */
  ctx.globalAlpha = .5;
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  /* Chữ thập */
  ctx.beginPath();
  ctx.moveTo(x, y - 22); ctx.lineTo(x, y - 6);
  ctx.moveTo(x, y + 6);  ctx.lineTo(x, y + 22);
  ctx.moveTo(x - 22, y); ctx.lineTo(x - 6, y);
  ctx.moveTo(x + 6, y);  ctx.lineTo(x + 22, y);
  ctx.stroke();

  /* Vạch chia độ */
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue;
    const off = i * 5;
    ctx.beginPath();
    ctx.moveTo(x + off, y - 3); ctx.lineTo(x + off, y + 3);
    ctx.moveTo(x - 3, y + off); ctx.lineTo(x + 3, y + off);
    ctx.stroke();
  }

  /* Tâm */
  ctx.beginPath();
  ctx.arc(x, y, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

/* ---------- PLASMA: vòng ngoài + tâm phát sáng ---------- */
function drawOrb(ctx, x, y, c, pulse) {
  const r = 12 + pulse * 3;

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();

  /* Tâm phát sáng */
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();

  /* 4 tia ngắn */
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(x, y - r - 4); ctx.lineTo(x, y - r - 8);
  ctx.moveTo(x, y + r + 4); ctx.lineTo(x, y + r + 8);
  ctx.moveTo(x - r - 4, y); ctx.lineTo(x - r - 8, y);
  ctx.moveTo(x + r + 4, y); ctx.lineTo(x + r + 8, y);
  ctx.stroke();
}

/* ---------- ROCKET: 4 dấu ngoặc vuông ---------- */
function drawBracket(ctx, x, y, c) {
  const s = 14;
  const len = 6;

  /* 4 góc */
  const corners = [
    [-1, -1], [1, -1], [-1, 1], [1, 1]
  ];

  corners.forEach(([dx, dy]) => {
    const cx = x + dx * s;
    const cy = y + dy * s;
    ctx.beginPath();
    ctx.moveTo(cx, cy - dy * len);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx - dx * len, cy);
    ctx.stroke();
  });

  /* Tâm */
  ctx.beginPath();
  ctx.arc(x, y, 2, 0, Math.PI * 2);
  ctx.fill();
}

/* ---------- RAILGUN: 2 đường thẳng dài ---------- */
function drawLine(ctx, x, y, c) {
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(x, y - 26); ctx.lineTo(x, y - 8);
  ctx.moveTo(x, y + 8);  ctx.lineTo(x, y + 26);
  ctx.stroke();

  ctx.lineWidth = 1;
  ctx.globalAlpha = .6;
  ctx.beginPath();
  ctx.moveTo(x - 26, y); ctx.lineTo(x - 8, y);
  ctx.moveTo(x + 8, y);  ctx.lineTo(x + 26, y);
  ctx.stroke();
  ctx.globalAlpha = 1;

  /* Chấm giữa */
  ctx.beginPath();
  ctx.arc(x, y, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

/* ---------- VOID: 2 vòng + tia ma thuật ---------- */
function drawArcane(ctx, x, y, c) {
  const t = performance.now() * 0.003;

  /* Vòng ngoài */
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.stroke();

  /* Vòng trong xoay */
  ctx.globalAlpha = .6;
  ctx.beginPath();
  ctx.arc(x, y, 9, t, t + Math.PI * 1.5);
  ctx.stroke();
  ctx.globalAlpha = 1;

  /* 4 tia ma thuật */
  for (let i = 0; i < 4; i++) {
    const a = t + (i / 4) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 15, y + Math.sin(a) * 15);
    ctx.lineTo(x + Math.cos(a) * 20, y + Math.sin(a) * 20);
    ctx.stroke();
  }

  /* Tâm */
  ctx.beginPath();
  ctx.arc(x, y, 2, 0, Math.PI * 2);
  ctx.fill();
}

/* ---------- MELEE: cung ngắm nhẹ (không crosshair thật) ---------- */
function drawMelee(ctx, x, y, c) {
  ctx.globalAlpha = .4;
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
/* =========================================================
   DRAW BEAMS — vẽ tia laser (railgun)
   ========================================================= */
export function drawBeams(ctx, W) {
  if (!W.beams || W.beams.length === 0) return;

  ctx.save();
  ctx.lineCap = 'round';

  for (let i = 0; i < W.beams.length; i++) {
    const b = W.beams[i];
    const t = b.life / b.maxLife;      // 1 → 0
    const alpha = Math.max(0, t);
    const width = b.width * (0.3 + t * 0.7);

    /* ----- Lớp ngoài: glow rộng ----- */
    ctx.globalAlpha = alpha * 0.4;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = width * 2.4;
    ctx.shadowBlur = 30;
    ctx.shadowColor = b.color;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();

    /* ----- Lớp giữa: beam chính ----- */
    ctx.globalAlpha = alpha * 0.85;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = width;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();

    /* ----- Lớp trong: lõi trắng sáng ----- */
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = b.coreColor || '#ffffff';
    ctx.lineWidth = width * 0.35;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();
  }

  ctx.restore();
}

/* =========================================================
   CHARGE INDICATOR — vòng tiến trình quanh player
   Vẽ SAU player nhưng TRƯỚC HUD. Gọi từ canvas.js.
   ========================================================= */
export function drawChargeIndicator(ctx, W) {
  const p = W.player;
  if (!p || !p.charging) return;

  const w = (window.VNXX?.WEAPONS?.[p.weaponId]) || null;
  if (!w || !w.charge) return;

  const progress = Math.min(1, p.chargeTime / w.charge);
  const isReady = progress >= 1;

  const radius = p.radius + 18;
  const color = isReady ? '#ffc44d' : '#28e0ff';

  ctx.save();

  /* Vòng nền mờ */
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.stroke();

  /* Vòng tiến trình (chạy từ trên, thuận chiều kim đồng hồ) */
  ctx.globalAlpha = 0.95;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.shadowBlur = 12;
  ctx.shadowColor = color;
  ctx.beginPath();
  ctx.arc(
    p.x, p.y, radius,
    -Math.PI / 2,
    -Math.PI / 2 + progress * Math.PI * 2
  );
  ctx.stroke();

  /* Khi đầy — pulse vòng ngoài */
  if (isReady) {
    const t = performance.now() * 0.006;
    const pulseR = radius + 6 + Math.sin(t) * 3;
    ctx.globalAlpha = 0.5 + Math.sin(t) * 0.3;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, pulseR, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}