/* =========================================================
   HALF NIFE — RENDER / 2.5D DEPTH LAYER
   Nâng cấp đồ họa "3D" trên nền Canvas2D:
   - Soft directional shadows (1 hướng sáng toàn cục)
   - Contact AO dưới chân vật thể (trick shadowBlur)
   - Pseudo-3D bevel: mặt trên sáng, chân tối cho obstacles
   - Dynamic light field: đạn / nổ / overdrive / boss (half-res, additive)
   - Floor depth: spotlight quanh player + noise texture sàn
   - Entity cast shadow dùng chung

   Tất cả hàm đều guard theo Settings.gfx3d + perf để máy yếu vẫn chạy.
   ========================================================= */

import Settings from '../core/settings.js';
import { TAU } from '../core/utils.js';

/* =========================================================
   GLOBAL LIGHT — nguồn sáng từ trên-trái, bóng đổ xuống dưới-phải
   ========================================================= */
export const LIGHT = {
  /* Hướng TỚI nguồn sáng (chuẩn hoá) */
  x: -0.55,
  y: -0.83,
  /* Hệ số bóng theo chiều cao giả định */
  cast: 1
};

/** Bật/tắt toàn bộ lớp 2.5D (theo setting + perf) */
export function depthOn() {
  if (Settings.get('gfx3d') === false) return false;
  return true;
}

/** Bản đầy đủ (bevel + noise) chỉ khi không ở chế độ máy yếu */
export function depthHigh() {
  return depthOn() && !Settings.isLowPerf();
}

/* =========================================================
   SOFT SHADOW — ellipse gradient mờ (không viền cứng)
   ========================================================= */
export function drawSoftShadow(ctx, x, y, rx, ry, alpha = .45) {
  if (!depthOn()) return;
  const a = Math.max(0, Math.min(1, alpha));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(Math.max(.5, rx), Math.max(.5, ry));
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, 'rgba(0,0,0,' + a.toFixed(3) + ')');
  g.addColorStop(.55, 'rgba(0,0,0,' + (a * .62).toFixed(3) + ')');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/* =========================================================
   OBSTACLE SHADOW + AO
   Vẽ 2 lớp:
   1. Bóng đổ có hướng (offset theo hướng sáng, blur theo kích thước)
   2. AO tiếp xúc (blur đều, sát chân) — tạo cảm giác vật nặng đè sàn
   Gọi TRƯỚC khi vẽ body obstacle.
   ========================================================= */
export function drawObstacleShadow(ctx, o) {
  if (!depthOn()) {
    /* Fallback cũ: shadow cứng */
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(o.x + 4, o.y + 5, o.w, o.h);
    return;
  }

  const size = Math.min(o.w, o.h);
  const blur = 9 + Math.min(26, size * .11);
  const dx = 5 + Math.min(15, size * .07) * LIGHT.cast;
  const dy = 7 + Math.min(19, size * .09) * LIGHT.cast;

  /* 1. Cast shadow có hướng */
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.52)';
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = dx;
  ctx.shadowOffsetY = dy;
  ctx.fillStyle = '#000';
  ctx.fillRect(o.x, o.y, o.w, o.h);
  ctx.restore();

  /* 2. Contact AO — blur đều quanh chân */
  if (depthHigh()) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.48)';
    ctx.shadowBlur = 11;
    ctx.fillStyle = '#000';
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.restore();
  }
}

/* =========================================================
   OBSTACLE TOP LIGHT (BEVEL)
   Gradient overlay: cạnh trên bắt sáng, chân tối dần + viền sáng 1px.
   Gọi SAU khi vẽ body obstacle.
   ========================================================= */
export function drawObstacleTopLight(ctx, o, stage) {
  if (!depthHigh()) return;
  if (o.w < 10 || o.h < 10) return;

  ctx.save();

  /* Sáng trên → tối dưới: giả mặt phẳng nghiêng hứng sáng */
  const g = ctx.createLinearGradient(0, o.y, 0, o.y + o.h);
  g.addColorStop(0, 'rgba(255,255,255,.20)');
  g.addColorStop(.16, 'rgba(255,255,255,.055)');
  g.addColorStop(.55, 'rgba(0,0,0,0)');
  g.addColorStop(.82, 'rgba(0,0,0,.14)');
  g.addColorStop(1, 'rgba(0,0,0,.34)');

  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = g;
  ctx.fillRect(o.x, o.y, o.w, o.h);

  /* Viền sáng cạnh trên — cạnh bắt sáng của khối */
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(255,255,255,.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(o.x + 1, o.y + .5);
  ctx.lineTo(o.x + o.w - 1, o.y + .5);
  ctx.stroke();

  /* Cạnh tối đáy — chân khối */
  ctx.strokeStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath();
  ctx.moveTo(o.x + 1, o.y + o.h - .5);
  ctx.lineTo(o.x + o.w - 1, o.y + o.h - .5);
  ctx.stroke();

  /* Inner bevel — mặt trên vát nhẹ vào trong */
  if (o.w > 26 && o.h > 26) {
    ctx.strokeStyle = 'rgba(255,255,255,.085)';
    ctx.strokeRect(o.x + 3.5, o.y + 3.5, o.w - 7, o.h - 7);
  }

  ctx.restore();
}

/* =========================================================
   ENTITY CAST SHADOW
   Ellipse mềm dưới entity, offset theo hướng sáng + "độ cao" radius.
   Gọi TRƯỚC khi vẽ entity (và trước contact ellipse có sẵn của entity).
   ========================================================= */
export function drawEntityShadow(ctx, e, opt = {}) {
  if (!depthOn() || !e) return;
  const r = opt.radius || e.radius || 12;
  const lift = opt.lift || 0;            /* 0..1 — càng cao bóng càng xa */
  const alpha = opt.alpha != null ? opt.alpha : .38;

  const ox = (3 + r * .16) * (1 + lift * .9);
  const oy = (4 + r * .2) * (1 + lift * .9);

  drawSoftShadow(
    ctx,
    e.x + ox,
    e.y + r * .42 + oy,
    r * (1.18 + lift * .35),
    r * (.46 + lift * .12),
    alpha
  );
}

/* =========================================================
   FLOOR DEPTH
   - Spotlight nhẹ quanh player (tâm sáng, rìa tối) → cảm giác chiều sâu
   - Noise texture sàn (tạo 1 lần, tile 128px) → phá cảm giác phẳng
   Gọi SAU drawBackground, trong world space.
   ========================================================= */
let _noise = null;

function noisePattern(ctx) {
  if (_noise !== null) return _noise;
  try {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const nctx = c.getContext('2d');
    const img = nctx.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = Math.random() < .5 ? 10 : 0;
    }
    nctx.putImageData(img, 0, 0);
    _noise = ctx.createPattern(c, 'repeat');
  } catch (e) {
    _noise = false;
  }
  return _noise;
}

export function drawFloorDepth(ctx, W, camX, camY, viewW, viewH) {
  if (!depthOn()) return;
  const p = W.player;
  if (!p) return;

  /* Noise texture (chỉ máy khoẻ) */
  if (depthHigh()) {
    const pat = noisePattern(ctx);
    if (pat) {
      ctx.save();
      ctx.globalAlpha = .5;
      ctx.fillStyle = pat;
      ctx.fillRect(camX, camY, viewW, viewH);
      ctx.restore();
    }
  }

  /* Spotlight quanh player — tối dần ra rìa viewport */
  const cx = p.x;
  const cy = p.y;
  const g = ctx.createRadialGradient(
    cx, cy, Math.min(viewW, viewH) * .22,
    cx, cy, Math.max(viewW, viewH) * .72
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(.62, 'rgba(0,0,0,.10)');
  g.addColorStop(1, 'rgba(0,0,0,.30)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(camX, camY, viewW, viewH);
  ctx.restore();
}

/* =========================================================
   LIGHT FIELD — half-res additive lightmap
   ========================================================= */
export const LightField = {
  canvas: null,
  ctx: null,
  _w: 0,
  _h: 0,
  _camX: 0,
  _camY: 0,
  _s: .5,
  _count: 0,

  begin(viewW, viewH, camX, camY) {
    const s = .5;
    const w = Math.max(1, Math.floor(viewW * s));
    const h = Math.max(1, Math.floor(viewH * s));

    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');
    }
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }

    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';

    this._w = w;
    this._h = h;
    this._camX = camX;
    this._camY = camY;
    this._s = s;
    this._count = 0;
    return this;
  },

  add(x, y, radius, color, intensity = 1) {
    const ctx = this.ctx;
    if (!ctx || !color) return;
    if (this._count >= 32) return;          /* cap cứng chống spam */

    const s = this._s;
    const sx = (x - this._camX) * s;
    const sy = (y - this._camY) * s;
    const sr = Math.max(3, radius * s);

    /* Cull ngoài viewport */
    if (sx < -sr || sy < -sr || sx > this._w + sr || sy > this._h + sr) return;

    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    g.addColorStop(0, color);
    g.addColorStop(.28, color);
    g.addColorStop(.62, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.globalAlpha = Math.max(.05, Math.min(1, intensity)) * .62;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, TAU);
    ctx.fill();
    this._count++;
  },

  flush(ctx, viewW, viewH, strength = .9) {
    if (!this.canvas || this._count === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.max(0, Math.min(1, strength));
    ctx.drawImage(this.canvas, 0, 0, viewW, viewH);
    ctx.restore();
  }
};

/* =========================================================
   COLLECT LIGHTS — gom nguồn sáng từ world mỗi frame
   Ưu tiên: nổ > đạn > boss > overdrive > player > loot > chest
   ========================================================= */
export function collectLights(W, camX, camY, viewW, viewH) {
  const out = [];
  if (!W) return out;

  const margin = 120;
  const inView = (x, y) =>
    x > camX - margin && x < camX + viewW + margin &&
    y > camY - margin && y < camY + viewH + margin;

  const push = (x, y, radius, color, intensity) => {
    if (!color || !inView(x, y)) return;
    out.push({ x, y, radius, color, intensity });
  };

  /* Player — đèn sinh tồn */
  const p = W.player;
  if (p && p.alive) {
    const hpPct = p.hp / Math.max(1, p.maxHp);
    push(p.x, p.y, 205, hpPct < .3 ? '#ff5566' : '#8ceaff', .30);

    /* Muzzle flash — đèn nhỏ ở đầu nòng khi đang bắn */
    if (p.attackAnim > 0) {
      const a = p.angle || 0;
      const rr = (p.radius || 14) * 1.5;
      push(
        p.x + Math.cos(a) * rr,
        p.y + Math.sin(a) * rr,
        105,
        '#d8f4ff',
        .85
      );
    }
  }

  /* Overdrive — quầng amber lớn */
  if (W.overdrive && W.overdrive.active && p) {
    push(p.x, p.y, 300, '#ffc44d', .8);
  }

  /* Nổ (ring particle) — sáng nhất */
  if (W.particles) {
    for (let i = 0; i < W.particles.length; i++) {
      const pt = W.particles[i];
      if (pt.type !== 'ring') continue;
      const k = pt.life / Math.max(.001, pt.maxLife);
      push(pt.x, pt.y, pt.size * 1.5, pt.color, .55 + k * .35);
    }
  }

  /* Đạn — nguồn sáng chính khi combat */
  if (W.projectiles) {
    for (let i = 0; i < W.projectiles.length; i++) {
      const pr = W.projectiles[i];
      push(pr.x, pr.y, Math.max(34, (pr.r || 4) * 15), pr.color, .58);
    }
  }

  /* Boss aura */
  if (W.enemies) {
    for (let i = 0; i < W.enemies.length; i++) {
      const e = W.enemies[i];
      if (!e.isBoss) continue;
      push(e.x, e.y, e.radius * 3.2, '#ff3b52', .34);
    }
  }

  /* Loot quý */
  if (W.loot) {
    for (let i = 0; i < W.loot.length; i++) {
      const l = W.loot[i];
      if (l.type === 'shard' || l.type === 'hp') {
        push(l.x, l.y, 44, l.color, .3);
      }
    }
  }

  /* Chest chưa mở */
  if (W.chests) {
    for (let i = 0; i < W.chests.length; i++) {
      const c = W.chests[i];
      if (c.open) continue;
      push(c.x, c.y, 82,
        c.rarity === 'legendary' ? '#ffc44d' : (c.rarity === 'rare' ? '#5aa9ff' : '#9fb4c4'),
        .3);
    }
  }

  /* Giới hạn 28 nguồn mạnh nhất */
  if (out.length > 28) {
    out.sort((a, b) => b.intensity - a.intensity);
    out.length = 28;
  }
  return out;
}

/* =========================================================
   EDGE FRINGE — viền màu nhẹ khi overdrive / trúng đòn nặng
   Rẻ hơn chromatic aberration toàn khung, vẫn tạo cảm giác "lens"
   ========================================================= */
export function drawEdgeFringe(ctx, viewW, viewH, color, strength) {
  if (!depthOn() || strength <= 0) return;
  const a = Math.min(.5, strength);
  const g = ctx.createRadialGradient(
    viewW / 2, viewH / 2, Math.min(viewW, viewH) * .38,
    viewW / 2, viewH / 2, Math.max(viewW, viewH) * .62
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, color);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = a;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.restore();
}
