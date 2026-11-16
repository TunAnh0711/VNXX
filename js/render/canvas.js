/* =========================================================
   VNXX — RENDER / CANVAS
   Canvas2D core: init, resize, transform, render dispatcher.
   Delegate vẽ cho draw-world / draw-entities / draw-fx.
   ========================================================= */

import Settings from '../core/settings.js';
import { rnd } from '../core/utils.js';

import { drawBackground, drawObstacles } from './draw-world.js';
import {
  drawPlayer, drawEnemy, drawProjectile,
  drawLoot, drawChest, drawRemotePlayer
} from './draw-entities.js';
import {
  drawVignette, drawScanlines, drawDarkness,
  drawCrosshair, drawBeams, drawChargeIndicator
} from './draw-fx.js';

import { drawHazards, drawProps, drawCombatOverlay } from './draw-combat.js';

import {
  drawFloorDepth, drawEntityShadow,
  LightField, collectLights, drawEdgeFringe, depthOn
} from './render3d.js';

import { Fx, FloatText } from '../systems/fx.js';

/* =========================================================
   CANVAS 2D MODULE
   ========================================================= */
const Canvas2D = {
  canvas: null,
  ctx: null,

  /* Viewport size (CSS pixels) */
  W: 0,
  H: 0,

  /* Device pixel ratio (clamped 1..2) */
  dpr: 1,

  /* Bloom buffers (tạo lazy) */
  _bloomA: null,
  _bloomActx: null,

  /* =========================================================
     INIT
     ========================================================= */
  init() {
    this.canvas = document.getElementById('game');
    if (!this.canvas) {
      console.warn('[Canvas2D] #game canvas not found');
      return;
    }
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.resize();
  },

  /* =========================================================
     RESIZE
     ========================================================= */
  resize() {
    if (!this.canvas) this.init();
    if (!this.canvas) return;

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth;
    this.H = window.innerHeight;

    this.canvas.width  = Math.floor(this.W * this.dpr);
    this.canvas.height = Math.floor(this.H * this.dpr);
    this.canvas.style.width  = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
  },

  /* =========================================================
     SCREEN → WORLD (dùng cho aim)
     ========================================================= */
  screenToWorld(sx, sy) {
    const W = window.VNXX?.Game?.world;
    if (!W) return { x: sx, y: sy };
    return {
      x: sx - this.W / 2 + W.camera.x,
      y: sy - this.H / 2 + W.camera.y
    };
  },

  /* =========================================================
     RENDER (main dispatcher)
     ========================================================= */
  render() {
    const ctx = this.ctx;
    const W = window.VNXX?.Game?.world;

    /* Reset transform + clear */
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#04060a';
    ctx.fillRect(0, 0, this.W, this.H);

    if (!W) return;

    /* ---------- Camera shake ---------- */
    let shx = 0, shy = 0;
    if (W.camera.shake > 0 && Settings.get('shakeOn')) {
      shx = rnd(-W.camera.shake, W.camera.shake);
      shy = rnd(-W.camera.shake, W.camera.shake);
    }

    const camX = W.camera.x - this.W / 2 + shx;
    const camY = W.camera.y - this.H / 2 + shy;

    /* ---------- World space ---------- */
    ctx.save();
    ctx.translate(-camX, -camY);

    /* 1. Nền + grid + viền map */
    drawBackground(ctx, W, camX, camY, this.W, this.H);

    /* 1b. Floor depth — noise texture + spotlight quanh player (2.5D) */
    drawFloorDepth(ctx, W, camX, camY, this.W, this.H);

    /* 2. Obstacles */
    drawObstacles(ctx, W, camX, camY, this.W, this.H);

    /* 2b. Hazards (dưới prop để prop nổi lên trên) */
    const tSec = (W.time || 0);
    drawHazards(ctx, W, camX, camY, this.W, this.H, tSec);

    /* 2c. Props phá hủy */
    drawProps(ctx, W, tSec);

    /* 2d. Cast shadows — mọi entity "nổi" khỏi sàn theo hướng sáng */
    this._drawEntityShadows(ctx, W);

    /* 3. Chests */
    for (let i = 0; i < W.chests.length; i++) {
      drawChest(ctx, W.chests[i]);
    }

    /* 4. Loot */
    for (let i = 0; i < W.loot.length; i++) {
      drawLoot(ctx, W.loot[i]);
    }

    /* 5. Particles */
    Fx.draw(ctx, W.particles);

    /* 6. Projectiles */
    for (let i = 0; i < W.projectiles.length; i++) {
      drawProjectile(ctx, W.projectiles[i]);
    }

    /* 6b. Railgun beams */
    drawBeams(ctx, W);
    /* 7. Remote players (LAN) */
    this._drawRemotePlayers(ctx, W);

    /* 8. Enemies (bao gồm boss) */
    for (let i = 0; i < W.enemies.length; i++) {
      drawEnemy(ctx, W.enemies[i]);
    }

    /* 8b. Status aura + telegraph */
    drawCombatOverlay(ctx, W, tSec);

    /* 9. Local player */
    drawPlayer(ctx, W.player);

    /* 9b. Charge indicator (vòng tiến trình railgun) */
    drawChargeIndicator(ctx, W);

    /* 10. Floating text */
    FloatText.draw(ctx, W.texts);

    ctx.restore();

    /* ---------- Post FX: light field 2.5D (đạn/nổ/overdrive/boss) ---------- */
    this._lightField(ctx, W, camX, camY);

    /* ---------- Post FX: bloom ---------- */
    this._bloom(ctx, W);

    /* ---------- Screen space ---------- */
    drawVignette(ctx, W, this.W, this.H);
    drawScanlines(ctx, this.W, this.H);

    /* Overdrive — viền amber "lens" nhẹ */
    if (W.overdrive && W.overdrive.active) {
      drawEdgeFringe(ctx, this.W, this.H, 'rgba(255,196,77,.55)', .10);
    }

    if (W.darkness > 0) {
      drawDarkness(ctx, W, camX, camY, this.W, this.H);
    }

    /* ---------- Game feel overlays ---------- */
    this._lowHpPulse(ctx, W);
    this._flashOverlay(ctx);
    this._dashStreaks(ctx, W);

    /* ---------- Crosshair (vẽ CUỐI CÙNG, trên mọi thứ) ---------- */
    const Game = window.VNXX?.Game;
    const Input = window.VNXX?.Input;
    if (Game && Input &&
        (Game.state === 'PLAYING' || Game.state === 'BOSS') &&
        W.player.alive) {
      const hpPct = W.player.hp / W.player.maxHp;
      const color = hpPct < 0.28
        ? '#ff3b52'
        : (W.player.buffs.dmg > 0 ? '#ffc44d' : '#28e0ff');

      /* Pulse khi đang bắn (attackAnim 0.16s → về 0) */
      const pulse = Math.max(0, W.player.attackAnim / 0.16);

      drawCrosshair(
        ctx,
        Input.mouse.x,
        Input.mouse.y,
        W.player.weaponId,
        { color, pulse }
      );
    }
},
  /* =========================================================
     SHADOW PASS — entity cast shadow (2.5D)
     Vẽ 1 lượt trên sàn trước khi vẽ entity để bóng không đè lên nhau.
   ========================================================= */
  _drawEntityShadows(ctx, W) {
    if (!depthOn()) return;

    /* Chests */
    for (let i = 0; i < W.chests.length; i++) {
      const c = W.chests[i];
      if (c.open) continue;
      drawEntityShadow(ctx, c, { radius: 17, alpha: .34 });
    }

    /* Loot */
    for (let i = 0; i < W.loot.length; i++) {
      drawEntityShadow(ctx, W.loot[i], { radius: 7, alpha: .30 });
    }

    /* Enemies */
    for (let i = 0; i < W.enemies.length; i++) {
      const e = W.enemies[i];
      if (e.alive === false || e.dead) continue;
      drawEntityShadow(ctx, e, { alpha: .36 });
    }

    /* Player — dash thì bóng xa hơn (đang "bay") */
    if (W.player && W.player.alive) {
      const lift = W.player.dashTime > 0 ? .55 : 0;
      drawEntityShadow(ctx, W.player, { alpha: .44, lift });
    }
  },

  /* =========================================================
     LIGHT FIELD — additive lightmap half-res
   ========================================================= */
  _lightField(ctx, W, camX, camY) {
    if (!depthOn() || !Settings.get('fxOn')) return;

    const lights = collectLights(W, camX, camY, this.W, this.H);
    if (!lights.length) return;

    LightField.begin(this.W, this.H, camX, camY);
    for (let i = 0; i < lights.length; i++) {
      const l = lights[i];
      LightField.add(l.x, l.y, l.radius, l.color, l.intensity);
    }

    /* Máy yếu: giảm cường độ để bù chi phí fill */
    const strength = Settings.isLowPerf() ? .5 : .9;
    LightField.flush(ctx, this.W, this.H, strength);
  },

  /* =========================================================
     POST FX — BLOOM
     Downsample khung hình 1/4 → blur → cộng sáng trở lại.
     Rẻ hơn nhiều so với blur toàn độ phân giải.
   ========================================================= */
  _bloom(ctx, W) {
    if (!Settings.get('fxOn')) return;
    if (Settings.isLowPerf && Settings.isLowPerf()) return;
    if (!this.canvas) return;

    const c = this.canvas;
    const bw = Math.max(1, Math.floor(c.width / 4));
    const bh = Math.max(1, Math.floor(c.height / 4));

    if (!this._bloomA) {
      this._bloomA = document.createElement('canvas');
      this._bloomActx = this._bloomA.getContext('2d');
    }
    const bc = this._bloomA;
    const bctx = this._bloomActx;
    if (!bctx) return;
    if (bc.width !== bw || bc.height !== bh) {
      bc.width = bw;
      bc.height = bh;
    }

    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.clearRect(0, 0, bw, bh);
    bctx.filter = 'blur(3px)';
    bctx.drawImage(c, 0, 0, bw, bh);
    bctx.filter = 'none';

    /* Cường độ bloom tăng theo mức căng của trận */
    const Game = window.VNXX?.Game;
    const danger = (Game && Game._danger) || 0;
    const od = W && W.overdrive && W.overdrive.active ? .12 : 0;
    const intensity = .20 + danger * .22 + od;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = intensity;
    ctx.drawImage(bc, 0, 0, c.width, c.height);
    ctx.restore();
  },

  /* =========================================================
     POST FX — MÁU THẤP: viền đỏ đập theo nhịp tim
   ========================================================= */
  _lowHpPulse(ctx, W) {
    if (!W || !W.player || !W.player.alive) return;
    const p = W.player;
    const ratio = p.hp / Math.max(1, p.maxHp);
    if (ratio > .3) return;

    const t = (typeof performance !== 'undefined' ? performance.now() : 0) * .001;
    const beat = Math.pow(Math.max(0, Math.sin(t * 5.2)), 3);
    const strength = (1 - ratio / .3) * (.28 + beat * .40);

    ctx.save();
    const g = ctx.createRadialGradient(
      this.W / 2, this.H / 2, Math.min(this.W, this.H) * .28,
      this.W / 2, this.H / 2, Math.max(this.W, this.H) * .72
    );
    g.addColorStop(0, 'rgba(255,20,45,0)');
    g.addColorStop(1, 'rgba(255,20,45,' + strength.toFixed(3) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.restore();
  },

  /* =========================================================
     POST FX — FLASH (trắng khi chí mạng / đỏ khi trúng đòn)
   ========================================================= */
  _flashOverlay(ctx) {
    const Game = window.VNXX?.Game;
    if (!Game || !Game._flash || Game._flash <= 0) return;

    const a = Math.min(.55, Game._flash);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a;
    ctx.fillStyle = Game._flashColor || '#ffffff';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.restore();
  },

  /* =========================================================
     POST FX — VỆT TỐC ĐỘ KHI DASH
   ========================================================= */
  _dashStreaks(ctx, W) {
    if (!W || !W.player) return;
    const p = W.player;
    if (!(p.dashTime > 0)) return;
    if (!Settings.get('fxOn')) return;

    const cx = this.W / 2;
    const cy = this.H / 2;
    const k = Math.min(1, p.dashTime / .22);
    const n = 16;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(160,240,255,' + (.30 * k).toFixed(3) + ')';
    ctx.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + p.angle;
      const r0 = Math.min(this.W, this.H) * (.30 + (i % 3) * .05);
      const r1 = r0 + 90 + (i % 4) * 34;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.restore();
  },

  /* =========================================================
     REMOTE PLAYERS (LAN)
   ========================================================= */
  _drawRemotePlayers(ctx, W) {
    const Net = window.VNXXNet;
    if (!Net) return;

    /* Guest: chỉ có 1 remote player là host */
    if (Net.isGuest()) {
      const rp = W.remotePlayerData;
      if (rp && rp.id !== Net.myId) {
        drawRemotePlayer(ctx, rp);
      }
      return;
    }

    /* Host: vẽ tất cả guest */
    if (Net.isHost()) {
      for (const [, rp] of Net.remotePlayers) {
        drawRemotePlayer(ctx, rp);
      }
    }
  }
};

export default Canvas2D;