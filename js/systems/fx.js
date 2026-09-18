/* =========================================================
   VNXX — SYSTEMS / FX
   Particle effects + floating text.
   Không import Game/Sound → đọc Settings để biết có render không.
   ========================================================= */

import Settings from '../core/settings.js';
import { TAU, rnd, clamp, removeAt } from '../core/utils.js';

/* =========================================================
   FX — PARTICLES
   ========================================================= */
export const Fx = {
  /* =========================================================
     SPAWN
     ========================================================= */
  spawn(list, x, y, vx, vy, life, size, color, type = 'dot') {
    if (!Settings.get('fxOn')) return;
    if (list.length >= 340) return;  // MAX_PARTICLES

    list.push({
      x, y, vx, vy,
      life,
      maxLife: life,
      size,
      color,
      type
    });
  },

  burst(list, x, y, n, color, speed = 200, life = .5, size = 3) {
    if (!Settings.get('fxOn')) return;

    const count = Settings.get('perf') === 'low' ? Math.ceil(n * .5) : n;

    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const s = rnd(speed * .3, speed);
      this.spawn(
        list,
        x, y,
        Math.cos(a) * s, Math.sin(a) * s,
        rnd(life * .6, life * 1.2),
        rnd(size * .6, size * 1.4),
        color
      );
    }
  },

  ring(list, x, y, color, radius = 80, life = .35) {
    if (!Settings.get('fxOn')) return;

    list.push({
      x, y, vx: 0, vy: 0,
      life,
      maxLife: life,
      size: radius,
      color,
      type: 'ring'
    });
  },

  /* =========================================================
     UPDATE
     ========================================================= */
  update(list, dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) { removeAt(list, i); continue; }

      if (p.type !== 'ring') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 1 - 3.2 * dt;
        p.vy *= 1 - 3.2 * dt;
      }
    }
  },

  /* =========================================================
     DRAW
     ========================================================= */
  draw(ctx, list) {
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const t = p.life / p.maxLife;
      ctx.globalAlpha = clamp(t, 0, 1);

      if (p.type === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 * t + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - t) + 6, 0, TAU);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * t, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
};

/* =========================================================
   FLOATING TEXT
   ========================================================= */
export const FloatText = {
  /* =========================================================
     ADD
     ========================================================= */
  add(list, x, y, text, color, size = 14, vy = -58) {
    list.push({
      x, y, text, color, size, vy,
      life: .9,
      maxLife: .9
    });
  },

  /* =========================================================
     UPDATE
     ========================================================= */
  update(list, dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const t = list[i];
      t.life -= dt;
      if (t.life <= 0) { removeAt(list, i); continue; }

      t.y += t.vy * dt;
      t.vy *= 1 - 2.2 * dt;
    }
  },

  /* =========================================================
     DRAW
     ========================================================= */
  draw(ctx, list) {
    ctx.textAlign = 'center';

    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      const a = clamp(t.life / t.maxLife, 0, 1);

      ctx.globalAlpha = a;
      ctx.font = 'bold ' + t.size + 'px Consolas, monospace';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,.85)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }

    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }
};

/* =========================================================
   DEFAULT EXPORT (dùng khi muốn gộp 2 trong 1)
   ========================================================= */
export default { Fx, FloatText };