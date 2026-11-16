/* =========================================================
   VNXX — RENDER / DRAW-COMBAT
   Vẽ hazard môi trường, prop phá hủy, aura trạng thái trên quái,
   và telegraph của AI mới.
   ========================================================= */

import { TAU } from '../core/utils.js';
import { STATUS_DEFS } from '../systems/status.js';

/* =========================================================
   HAZARDS
   ========================================================= */
export function drawHazards(ctx, W, camX, camY, vw, vh, t) {
  const hz = W.hazards;
  if (!hz || hz.length === 0) return;

  for (let i = 0; i < hz.length; i++) {
    const h = hz[i];

    if (h.x + h.r < camX - 60 || h.x - h.r > camX + vw + 60 ||
        h.y + h.r < camY - 60 || h.y - h.r > camY + vh + 60) continue;

    switch (h.type) {
      case 'lava':      drawLava(ctx, h, t); break;
      case 'steam':     drawSteam(ctx, h, t); break;
      case 'shockgrid': drawShockgrid(ctx, h, t); break;
      case 'voidrift':  drawVoidrift(ctx, h, t); break;
      default:          drawLava(ctx, h, t); break;
    }
  }
}

function drawLava(ctx, h, t) {
  const pulse = .82 + Math.sin(t * 2.2 + h.phase) * .18;

  const g = ctx.createRadialGradient(h.x, h.y, h.r * .1, h.x, h.y, h.r);
  g.addColorStop(0, 'rgba(255,220,120,0.85)');
  g.addColorStop(.35, 'rgba(255,110,30,0.70)');
  g.addColorStop(1, 'rgba(120,20,0,0.10)');

  ctx.save();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(h.x, h.y, h.r * pulse, 0, TAU);
  ctx.fill();

  /* vân nứt */
  ctx.globalAlpha = .35;
  ctx.strokeStyle = '#ffcf6a';
  ctx.lineWidth = 1.5;
  for (let k = 0; k < 3; k++) {
    const a = t * .4 + k * 2.1;
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r * (.4 + k * .18), a, a + 1.4);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSteam(ctx, h, t) {
  const on = h.active;
  const warn = h.warn;

  ctx.save();

  if (warn) {
    ctx.globalAlpha = .25 + Math.sin(t * 22) * .2;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r, 0, TAU);
    ctx.stroke();
  }

  if (on) {
    const g = ctx.createRadialGradient(h.x, h.y, 4, h.x, h.y, h.r);
    g.addColorStop(0, 'rgba(235,245,255,0.55)');
    g.addColorStop(1, 'rgba(180,200,220,0.02)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r * (.95 + Math.sin(t * 6) * .05), 0, TAU);
    ctx.fill();
  }

  ctx.restore();
}

function drawShockgrid(ctx, h, t) {
  ctx.save();

  const on = h.active;

  ctx.globalAlpha = on ? .22 : .10;
  ctx.fillStyle = '#ffe14d';
  ctx.beginPath();
  ctx.arc(h.x, h.y, h.r, 0, TAU);
  ctx.fill();

  ctx.globalAlpha = on ? .85 : .28;
  ctx.strokeStyle = '#ffe14d';
  ctx.lineWidth = on ? 2.4 : 1.4;
  ctx.beginPath();
  ctx.arc(h.x, h.y, h.r, 0, TAU);
  ctx.stroke();

  if (on) {
    ctx.globalAlpha = .8;
    ctx.lineWidth = 1.6;
    for (let k = 0; k < 5; k++) {
      const a = t * 3 + k * (TAU / 5);
      const r1 = h.r * .25;
      const r2 = h.r * .92;
      ctx.beginPath();
      ctx.moveTo(h.x + Math.cos(a) * r1, h.y + Math.sin(a) * r1);
      ctx.lineTo(h.x + Math.cos(a + .3) * r2, h.y + Math.sin(a + .3) * r2);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawVoidrift(ctx, h, t) {
  ctx.save();

  const g = ctx.createRadialGradient(h.x, h.y, 2, h.x, h.y, h.r);
  g.addColorStop(0, 'rgba(10,0,25,0.95)');
  g.addColorStop(.55, 'rgba(110,60,200,0.55)');
  g.addColorStop(1, 'rgba(160,107,255,0.02)');

  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(h.x, h.y, h.r, 0, TAU);
  ctx.fill();

  ctx.globalAlpha = .7;
  ctx.strokeStyle = '#c9a7ff';
  ctx.lineWidth = 1.4;
  for (let k = 0; k < 4; k++) {
    const a = -t * 1.4 + k * (TAU / 4);
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r * (.5 + k * .12), a, a + 1.1);
    ctx.stroke();
  }

  ctx.restore();
}

/* =========================================================
   PROPS
   ========================================================= */
export function drawProps(ctx, W, t) {
  const props = W.props;
  if (!props || props.length === 0) return;

  for (let i = 0; i < props.length; i++) {
    const o = props[i];
    if (o.dead) continue;

    const wob = Math.sin(t * 6 + o.wobble) * (o.hitFlash > 0 ? 3 : .6);

    ctx.save();
    ctx.translate(o.x + wob, o.y);

    /* bóng */
    ctx.globalAlpha = .3;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, o.r * .8, o.r * .9, o.r * .35, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (o.kind === 'barrel') {
      ctx.fillStyle = o.hitFlash > 0 ? '#ffffff' : '#8a1f12';
      ctx.beginPath();
      ctx.ellipse(0, 0, o.r, o.r * 1.15, 0, 0, TAU);
      ctx.fill();

      ctx.strokeStyle = '#ffc44d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, -o.r * .25, o.r * .82, o.r * .22, 0, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, o.r * .35, o.r * .82, o.r * .22, 0, 0, TAU);
      ctx.stroke();

      /* dấu hiệu nguy hiểm */
      ctx.fillStyle = '#ffc44d';
      ctx.globalAlpha = .85;
      ctx.beginPath();
      ctx.moveTo(0, -o.r * .55);
      ctx.lineTo(o.r * .30, o.r * .1);
      ctx.lineTo(-o.r * .30, o.r * .1);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = o.hitFlash > 0 ? '#ffffff' : '#6b5424';
      ctx.fillRect(-o.r, -o.r, o.r * 2, o.r * 2);

      ctx.strokeStyle = '#ffc44d';
      ctx.lineWidth = 2;
      ctx.strokeRect(-o.r, -o.r, o.r * 2, o.r * 2);

      ctx.beginPath();
      ctx.moveTo(-o.r * .5, 0);
      ctx.lineTo(o.r * .5, 0);
      ctx.moveTo(0, -o.r * .5);
      ctx.lineTo(0, o.r * .5);
      ctx.stroke();
    }

    /* thanh máu nhỏ khi bị đánh */
    if (o.hp < o.maxHp) {
      const w = o.r * 2;
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(-w / 2, -o.r - 12, w, 4);
      ctx.fillStyle = '#ff7a2f';
      ctx.fillRect(-w / 2, -o.r - 12, w * (o.hp / o.maxHp), 4);
    }

    ctx.restore();
  }
}

/* =========================================================
   STATUS AURA + TELEGRAPH
   ========================================================= */
export function drawCombatOverlay(ctx, W, t) {
  const list = W.enemies;
  if (!list) return;

  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e.alive) continue;

    /* --- Telegraph --- */
    if (e.tele) drawTelegraph(ctx, e, t);

    /* --- Status ring --- */
    const st = e.st;
    if (st) {
      let idx = 0;
      for (const id in st) {
        const def = STATUS_DEFS[id];
        if (!def) continue;

        const r = e.radius + 6 + idx * 4;
        ctx.save();
        ctx.globalAlpha = .55;
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, r, t * 2 + idx, t * 2 + idx + 4.2);
        ctx.stroke();
        ctx.restore();

        idx++;
        if (idx > 3) break;
      }
    }

    /* --- Break ring --- */
    if (e.broken > 0) {
      ctx.save();
      ctx.globalAlpha = .75 + Math.sin(t * 18) * .2;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius + 12, t * 3, t * 3 + TAU);
      ctx.stroke();
      ctx.restore();
    }

    /* --- Poise bar (chỉ khi đã bị đánh) --- */
    if (e.poiseMax > 0 && e.poise < e.poiseMax && e.broken <= 0) {
      const w = e.radius * 2.2;
      const y = e.y - e.radius - 18;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(e.x - w / 2, y, w, 3.5);
      ctx.fillStyle = '#9fe8ff';
      ctx.fillRect(e.x - w / 2, y, w * (e.poise / e.poiseMax), 3.5);
      ctx.restore();
    }

    /* --- Underground marker --- */
    if (e.underground) {
      ctx.save();
      ctx.globalAlpha = .5;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * 1.6, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawTelegraph(ctx, e, t) {
  const tg = e.tele;
  const prog = Math.max(0, Math.min(1, tg.prog || 0));

  ctx.save();

  if (tg.type === 'line') {
    const a = tg.angle || e.angle;
    const len = tg.len || 600;
    const halfW = 15;

    ctx.translate(e.x, e.y);
    ctx.rotate(a);

    /* Vùng cảnh báo — gradient để đầu xa mờ hẳn, không thành dải đỏ đặc */
    const grad = ctx.createLinearGradient(0, 0, len, 0);
    grad.addColorStop(0, 'rgba(255,59,82,' + (.10 + prog * .20).toFixed(3) + ')');
    grad.addColorStop(.55, 'rgba(255,59,82,' + (.05 + prog * .11).toFixed(3) + ')');
    grad.addColorStop(1, 'rgba(255,59,82,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, -halfW, len, halfW * 2);

    /* Viền mảnh đánh dấu 2 mép */
    ctx.globalAlpha = .35 + prog * .25;
    ctx.strokeStyle = '#ff3b52';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -halfW); ctx.lineTo(len, -halfW);
    ctx.moveTo(0, halfW);  ctx.lineTo(len, halfW);
    ctx.stroke();

    /* Thanh tiến trình báo đòn */
    ctx.globalAlpha = .85;
    ctx.strokeStyle = '#ff7a8a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len * prog, 0);
    ctx.stroke();

    /* Điểm nhấp nháy ở đầu tia */
    ctx.globalAlpha = .5 + Math.sin(t * 20) * .25;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(len * prog, 0, 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    return;
  }

  if (tg.type === 'circle') {
    const r = tg.r || 120;

    ctx.globalAlpha = .09 + prog * .15;
    ctx.fillStyle = '#ff3b52';
    ctx.beginPath();
    ctx.arc(e.x, e.y, r, 0, TAU);
    ctx.fill();

    ctx.globalAlpha = .55 + prog * .25;
    ctx.strokeStyle = '#ff3b52';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r, 0, TAU);
    ctx.stroke();

    ctx.globalAlpha = .55;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * prog, 0, TAU);
    ctx.stroke();

    ctx.restore();
    return;
  }

  ctx.restore();
}

export default { drawHazards, drawProps, drawCombatOverlay };
