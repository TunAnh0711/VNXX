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

    /* 2. Obstacles */
    drawObstacles(ctx, W, camX, camY, this.W, this.H);

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
    /* 9. Local player */
    drawPlayer(ctx, W.player);

    /* 9b. Charge indicator (vòng tiến trình railgun) */
    drawChargeIndicator(ctx, W);

    /* 10. Floating text */
    FloatText.draw(ctx, W.texts);

    ctx.restore();

    /* ---------- Screen space ---------- */
    /* ---------- Screen space ---------- */
    drawVignette(ctx, W, this.W, this.H);
    drawScanlines(ctx, this.W, this.H);

    if (W.darkness > 0) {
      drawDarkness(ctx, W, camX, camY, this.W, this.H);
    }

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