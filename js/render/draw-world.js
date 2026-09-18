/* =========================================================
   VNXX — RENDER / DRAW-WORLD
   Vẽ nền map (floor + grid + viền) + obstacles (tường,
   container, pillar, machine).
   Pure functions, không phụ thuộc Game.
   ========================================================= */

/* =========================================================
   DRAW BACKGROUND — floor + grid + viền stage
   Chỉ vẽ vùng trong viewport (camX..camX+W).
   ========================================================= */
export function drawBackground(ctx, W, camX, camY, viewW, viewH) {
  const stage = W.stageDef;

  /* ---------- Floor ---------- */
  ctx.fillStyle = stage.floor;
  ctx.fillRect(0, 0, W.w, W.h);

  /* ---------- Grid (chỉ vẽ phần trong viewport) ---------- */
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

  /* ---------- Viền map (accent border) ---------- */
  ctx.strokeStyle = stage.accent;
  ctx.globalAlpha = .5;
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, W.w, W.h);
  ctx.globalAlpha = 1;
}

/* =========================================================
   DRAW OBSTACLES — tường, container, pillar, machine
   Cull: bỏ qua obstacle ngoài viewport.
   ========================================================= */
export function drawObstacles(ctx, W, camX, camY, viewW, viewH) {
  const stage = W.stageDef;

  for (let i = 0; i < W.obstacles.length; i++) {
    const o = W.obstacles[i];

    /* Viewport cull */
    if (o.x > camX + viewW + 40) continue;
    if (o.x + o.w < camX - 40) continue;
    if (o.y > camY + viewH + 40) continue;
    if (o.y + o.h < camY - 40) continue;

    /* Shadow (đổ bóng nhẹ) */
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(o.x + 4, o.y + 5, o.w, o.h);

    /* Body */
    ctx.fillStyle = stage.wall;
    ctx.fillRect(o.x, o.y, o.w, o.h);

    /* Accent stroke */
    ctx.strokeStyle = stage.accent;
    ctx.globalAlpha = .28;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(o.x + .5, o.y + .5, o.w - 1, o.h - 1);

    /* Đường chéo trang trí */
    ctx.globalAlpha = .16;
    ctx.beginPath();
    ctx.moveTo(o.x, o.y);
    ctx.lineTo(o.x + o.w, o.y + o.h);
    ctx.moveTo(o.x + o.w, o.y);
    ctx.lineTo(o.x, o.y + o.h);
    ctx.stroke();

    ctx.globalAlpha = 1;
  }
}