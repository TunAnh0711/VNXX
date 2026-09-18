/* =========================================================
   VNXX — SYSTEMS / NET
   LAN multiplayer: WebSocket sync host ↔ guest.
   Không import Game/Canvas2D trực tiếp → dùng bind() để tránh
   circular dependency. UI wiring nằm ở ui/lan-ui.js.
   ========================================================= */

import { CFG } from '../core/constants.js';
import { WEAPONS } from '../data/weapons.js';
import { clamp, TAU, lerp, angLerp } from '../core/utils.js';
import Input from '../core/input.js';
import Settings from '../core/settings.js';
import Sound from './sound.js';

/* =========================================================
   NET MODULE
   ========================================================= */
const Net = {
  /* ---------- Runtime state ---------- */
  ws: null,
  mode: null,            // 'host' | 'guest'
  roomCode: null,
  myId: null,
  connected: false,

  /* Remote players (host side) */
  remotePlayers: new Map(),   // id -> player object
  remoteInputs:  new Map(),   // id -> input object

  /* Tick clocks */
  sendAcc: 0,
  SEND_HZ: 20,

  inputAcc: 0,
  INPUT_HZ: 30,

  /* ---------- External bindings (set from main.js) ---------- */
  _getGame: null,
  _hideAllScreens: null,
  _addToast: null,

  bind({ getGame, hideAllScreens, addToast }) {
    this._getGame = getGame;
    this._hideAllScreens = hideAllScreens;
    this._addToast = addToast;
  },

  /* ---------- Lazy accessors ---------- */
  _game() { return this._getGame ? this._getGame() : null; },
  _world() {
    const g = this._game();
    return g ? g.world : null;
  },
  _hide() { if (this._hideAllScreens) this._hideAllScreens(); },
  _toast(msg) {
    if (this._addToast) this._addToast(msg);
    else console.log('[Net]', msg);
  },

  /* ---------- Mode helpers ---------- */
  isHost()  { return this.mode === 'host'; },
  isGuest() { return this.mode === 'guest'; },

  /* =========================================================
     OPEN / CLOSE (gọi từ ui/lan-ui.js)
     ========================================================= */
  open() {
    this._hide();
    const el = document.getElementById('screen-lan');
    if (el) el.classList.add('active');

    const main = document.getElementById('lanMain');
    const room = document.getElementById('lanRoom');
    if (main) main.classList.remove('hidden');
    if (room) room.classList.add('hidden');

    const hint = document.getElementById('lanHint');
    if (hint) hint.textContent = '';

    const g = this._game();
    if (g && g.setState && window.VNXX?.ST) g.setState(window.VNXX.ST.LAN);
  },

  close() {
    this.disconnect();
    const g = this._game();
    if (g && g.toMainMenu) g.toMainMenu();
  },

  /* =========================================================
     WEBSOCKET TRANSPORT
     ========================================================= */
  send(obj) {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(obj));
    }
  },

  connect(cb) {
    if (this.ws && this.ws.readyState === 1) return cb();

    const url = `ws://${location.hostname}:${location.port || 3000}`;
    try {
      this.ws = new WebSocket(url);
    } catch (err) {
      this._toast('KHÔNG KẾT NỐI ĐƯỢC SERVER');
      return;
    }

    this.ws.onopen = () => {
      this.connected = true;
      cb();
    };

    this.ws.onmessage = (ev) => {
      try {
        this.onMessage(JSON.parse(ev.data));
      } catch (err) {
        console.warn('[Net] bad message', err);
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      const g = this._game();
      const inGame = g && g.state && g.state !== window.VNXX?.ST?.MAIN_MENU;
      if (this.mode && inGame) {
        this._toast('MẤT KẾT NỐI');
        this.disconnect();
        if (g && g.toMainMenu) g.toMainMenu();
      }
    };

    this.ws.onerror = () => this._toast('LỖI KẾT NỐI SERVER');
  },

  /* =========================================================
     OUTBOUND ACTIONS
     ========================================================= */
  hostRoom() {
    this.connect(() => this.send({ type: 'host' }));
  },

  joinRoom(code) {
    if (!code || code.length !== 4) {
      this._toast('MÃ PHẢI CÓ 4 KÝ TỰ');
      return;
    }
    this.connect(() => this.send({ type: 'join', code: code.toUpperCase() }));
  },

  /* =========================================================
     MESSAGE DISPATCH
     ========================================================= */
  onMessage(m) {
    switch (m.type) {
      case 'hosted':
        this.mode = 'host';
        this.roomCode = m.code;
        this.myId = m.playerId;
        this.showRoom(m.code);
        break;

      case 'joined':
        this.mode = 'guest';
        this.myId = m.playerId;
        this._toast('ĐÃ VÀO PHÒNG. ĐANG CHỜ HOST...');
        this.send({ type: 'to_host', data: { type: 'request_init' } });
        break;

      case 'guest_join':
        this.onGuestJoin(m.playerId);
        break;

      case 'guest_leave':
        this.remotePlayers.delete(m.playerId);
        this.remoteInputs.delete(m.playerId);
        this.refreshPlayerList();
        break;

      case 'host_left':
        this._toast('HOST ĐÃ THOÁT');
        this.disconnect();
        const g = this._game();
        if (g && g.toMainMenu) g.toMainMenu();
        break;

      case 'input':
        this.remoteInputs.set(m.fromId, m.input);
        break;

      case 'init':
        this.applyInit(m.data);
        break;

      case 'state':
        this.applyState(m.data);
        break;

      case 'error':
        this._toast(m.message || 'LỖI KHÔNG XÁC ĐỊNH');
        break;

      default:
        // ignore unknown
        break;
    }
  },

  /* =========================================================
     HOST: guest lifecycle
     ========================================================= */
  onGuestJoin(id) {
    const W = this._world();
    const px = W ? W.player.x + (Math.random() - .5) * 140 : 400;
    const py = W ? W.player.y + (Math.random() - .5) * 140 : 400;

    this.remotePlayers.set(id, {
      id,
      x: px, y: py, vx: 0, vy: 0, angle: 0,
      hp: 100, maxHp: 100, shield: 0,
      credits: 0, shards: 0,
      level: 1, xp: 0, xpNext: 20,
      weaponId: 'pistol',
      buffs: { dmg: 0, shield: 0, berserk: 0 },
      name: 'GUEST-' + id.slice(0, 4).toUpperCase(),
      radius: CFG.PLAYER.radius,
      alive: true,
      invuln: 1.5, hitFlash: 0, attackAnim: 0, moveAnim: 0,
      cooldown: 0, dashCd: 0, dashTime: 0, dashDir: { x: 0, y: 0 },
      up: {
        dodge: 0, lifesteal: 0, armor: 0,
        damageMul: 0, critChance: 0, critMul: 0,
        attackSpeedMul: 0, luck: 0, rangeMul: 0, speedMul: 0
      }
    });

    this.refreshPlayerList();

    if (W) {
      this.send({
        type: 'to_guest', to: id,
        data: {
          type: 'init',
          data: {
            stage: W.stage,
            wave: W.wave,
            w: W.w,
            h: W.h,
            obstacles: W.obstacles,
            stageDef: W.stageDef
          }
        }
      });
    }

    this._toast('NGƯỜI CHƠI MỚI VÀO');
  },

  /* =========================================================
     HOST: snapshot
     ========================================================= */
  buildSnapshot() {
    const W = this._world();
    if (!W) return null;
    const g = this._game();
    const profile = g ? g.profile : null;

    const players = [{
      id: this.myId,
      x: W.player.x, y: W.player.y, angle: W.player.angle,
      hp: W.player.hp, maxHp: W.player.maxHp, shield: W.player.shield,
      credits: W.player.credits, shards: W.player.shards,
      level: W.player.level, xp: W.player.xp, xpNext: W.player.xpNext,
      weaponId: W.player.weaponId, buffs: W.player.buffs,
      alive: W.player.alive, hitFlash: W.player.hitFlash,
      attackAnim: W.player.attackAnim, moveAnim: W.player.moveAnim,
      invuln: W.player.invuln,
      radius: W.player.radius,
      name: profile ? profile.playerName : 'HOST'
    }];

    for (const [id, p] of this.remotePlayers) {
      players.push({
        id,
        x: p.x, y: p.y, angle: p.angle,
        hp: p.hp, maxHp: p.maxHp, shield: p.shield,
        credits: p.credits, shards: p.shards,
        level: p.level, xp: p.xp, xpNext: p.xpNext,
        weaponId: p.weaponId, buffs: p.buffs,
        alive: p.alive, hitFlash: p.hitFlash,
        attackAnim: p.attackAnim, moveAnim: p.moveAnim,
        invuln: p.invuln,
        radius: p.radius,
        name: p.name
      });
    }

    return {
      t: W.time, wave: W.wave, stage: W.stage,
      waveDef: W.waveDef,
      darkness: W.darkness, lowGravity: W.lowGravity,
      players,
      enemies: W.enemies.map((e) => ({
        x: e.x, y: e.y, angle: e.angle,
        hp: e.hp, maxHp: e.maxHp, radius: e.radius,
        color: e.color, elite: e.elite, isBoss: e.isBoss,
        name: e.name, modName: e.modName,
        shield: e.shield, maxShield: e.maxShield,
        frozen: e.frozen, hitFlash: e.hitFlash,
        telegraph: e.telegraph, telegraphType: e.telegraphType,
        spawnAnim: e.spawnAnim, alive: e.alive
      })),
      projectiles: W.projectiles.map((p) => ({
        x: p.x, y: p.y, px: p.px, py: p.py,
        r: p.r, color: p.color, trail: p.trail, owner: p.owner
      })),
      loot: W.loot.map((l) => ({
        x: l.x, y: l.y, color: l.color, type: l.type
      })),
      chests: W.chests.map((c) => ({
        x: c.x, y: c.y, r: c.r, rarity: c.rarity,
        open: c.open, anim: c.anim, life: c.life
      })),
      texts: W.texts.map((t) => ({
        x: t.x, y: t.y, text: t.text,
        color: t.color, size: t.size,
        life: t.life, maxLife: t.maxLife
      })),
      boss: W.boss ? {
        name: W.boss.name,
        hp: W.boss.hp,
        maxHp: W.boss.maxHp
      } : null
    };
  },

  /* =========================================================
     HOST: per-frame tick
     ========================================================= */
  hostTick(dt) {
    if (!this.isHost()) return;

    /* Apply input từ mọi guest */
    for (const [id, rp] of this.remotePlayers) {
      const inp = this.remoteInputs.get(id);
      if (inp) this.applyGuestInput(rp, inp, dt);
    }

    /* Broadcast snapshot theo tần số SEND_HZ */
    this.sendAcc += dt;
    if (this.sendAcc >= 1 / this.SEND_HZ) {
      this.sendAcc = 0;
      const snap = this.buildSnapshot();
      if (snap) {
        this.send({ type: 'to_guests', data: { type: 'state', data: snap } });
      }
    }
  },

  applyGuestInput(rp, inp, dt) {
    const W = this._world();
    if (!W) return;

    if (rp.hitFlash > 0) rp.hitFlash -= dt;
    if (rp.invuln > 0)   rp.invuln   -= dt;
    if (rp.cooldown > 0) rp.cooldown -= dt;
    if (rp.attackAnim > 0) rp.attackAnim -= dt;

    const mv = inp.mv || { x: 0, y: 0 };
    rp.vx += mv.x * CFG.PLAYER.accel * dt;
    rp.vy += mv.y * CFG.PLAYER.accel * dt;
    rp.vx -= rp.vx * CFG.PLAYER.friction * dt;
    rp.vy -= rp.vy * CFG.PLAYER.friction * dt;

    const sp = Math.hypot(rp.vx, rp.vy);
    if (sp > CFG.PLAYER.baseSpeed) {
      rp.vx = rp.vx / sp * CFG.PLAYER.baseSpeed;
      rp.vy = rp.vy / sp * CFG.PLAYER.baseSpeed;
    }

    rp.x += rp.vx * dt;
    rp.y += rp.vy * dt;
    rp.x = clamp(rp.x, rp.radius, W.w - rp.radius);
    rp.y = clamp(rp.y, rp.radius, W.h - rp.radius);
    rp.moveAnim = (rp.moveAnim || 0) + Math.hypot(rp.vx, rp.vy) * dt * .05;

    if (inp.angle !== undefined) rp.angle = inp.angle;
    if (inp.attack) this.hostGuestAttack(rp);
  },

  hostGuestAttack(rp) {
    const W = this._world();
    const g = this._game();
    if (!W || !g || rp.cooldown > 0) return;

    const w = WEAPONS[rp.weaponId] || WEAPONS.pistol;
    rp.cooldown = 1 / w.fireRate;
    rp.attackAnim = .16;

    if (w.type === 'ranged') {
      const spd = w.projectileSpeed;
      for (let i = 0; i < w.projectileCount; i++) {
        const sa = w.projectileCount > 1
          ? (i / (w.projectileCount - 1) - .5) * 2 * w.spread
          : 0;
        const a = rp.angle + sa;
        W.projectiles.push({
          x: rp.x + Math.cos(a) * 22,
          y: rp.y + Math.sin(a) * 22,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          r: 4,
          damage: w.damage,
          owner: 'player',
          life: w.range / spd + .15,
          pierce: w.penetration,
          splash: w.splash,
          crit: false,
          knockback: w.knockback,
          color: '#39ff9e',
          hitSet: new Set(),
          weaponId: w.id
        });
      }
      Sound.sfx('shoot');
    } else {
      for (const e of W.enemies) {
        const d = Math.hypot(e.x - rp.x, e.y - rp.y);
        if (d > w.range + e.radius) continue;
        const a = Math.atan2(e.y - rp.y, e.x - rp.x);
        let diff = Math.abs(((a - rp.angle + Math.PI) % TAU) - Math.PI);
        if (diff <= w.spread) {
          g.damageEnemy(e, w.damage, false, rp, w.knockback);
        }
      }
      Sound.sfx('attack');
    }
  },

  /* =========================================================
     GUEST: receive init
     ========================================================= */
  applyInit(data) {
    const g = this._game();
    if (!g) return;

    g.world = {
      stage: data.stage,
      wave: data.wave,
      w: data.w,
      h: data.h,
      obstacles: data.obstacles || [],
      stageDef: data.stageDef,
      enemies: [], projectiles: [], loot: [], particles: [], texts: [], chests: [],
      player: {
        x: data.w / 2, y: data.h / 2, vx: 0, vy: 0,
        radius: CFG.PLAYER.radius,
        angle: 0, hp: 100, maxHp: 100, shield: 0,
        credits: 0, shards: 0, level: 1, xp: 0, xpNext: 20,
        weaponId: 'pistol',
        buffs: { dmg: 0, shield: 0, berserk: 0 },
        alive: true, hitFlash: 0, attackAnim: 0, moveAnim: 0, invuln: 1,
        kills: 0,
        up: {
          damageMul: 0, speedMul: 0, critChance: 0, critMul: 0,
          armor: 0, lifesteal: 0, attackSpeedMul: 0,
          luck: 0, rangeMul: 0, dodge: 0
        }
      },
      remotePlayerData: null,
      camera: { x: data.w / 2, y: data.h / 2, shake: 0 },
      time: 0, darkness: 0, lowGravity: false,
      waveDef: null, boss: null
    };

    g.multiplayer = true;
    g._prevState = window.VNXX?.ST?.PLAYING;
    if (g.setState && window.VNXX?.ST) g.setState(window.VNXX.ST.PLAYING);

    this._hide();
    this._toast('ĐÃ KẾT NỐI. BẮT ĐẦU!');
  },

  /* =========================================================
     GUEST: receive state
     ========================================================= */
  applyState(s) {
    const W = this._world();
    if (!W) return;

    W.time = s.t;
    W.wave = s.wave;
    W.stage = s.stage;
    W.waveDef = s.waveDef;
    W.darkness = s.darkness || 0;
    W.lowGravity = !!s.lowGravity;
    W.boss = s.boss;

    /* Interp enemies theo vị trí cũ */
    W.enemies = s.enemies.map((se, i) => {
      const old = W.enemies[i];
      const e = { ...se };
      if (old && old.x !== undefined) {
        e.x = lerp(old.x, se.x, .45);
        e.y = lerp(old.y, se.y, .45);
        e.angle = angLerp(old.angle || 0, se.angle || 0, .45);
      }
      return e;
    });

    W.projectiles = s.projectiles.map((p) => ({ ...p }));
    W.loot = s.loot;
    W.chests = s.chests;
    W.texts = s.texts.map((t) => ({ ...t, vy: -58 }));

    /* Cập nhật player của mình */
    const me = s.players.find((p) => p.id === this.myId);
    if (me) {
      W.player.x = lerp(W.player.x, me.x, .40);
      W.player.y = lerp(W.player.y, me.y, .40);
      W.player.angle = angLerp(W.player.angle, me.angle, .45);
      W.player.hp = me.hp;
      W.player.maxHp = me.maxHp;
      W.player.shield = me.shield || 0;
      W.player.credits = me.credits;
      W.player.shards = me.shards;
      W.player.level = me.level;
      W.player.xp = me.xp;
      W.player.xpNext = me.xpNext;
      W.player.weaponId = me.weaponId;
      W.player.buffs = me.buffs || W.player.buffs;
      W.player.alive = me.alive;
      W.player.hitFlash = me.hitFlash || 0;
      W.player.attackAnim = me.attackAnim || 0;
      W.player.moveAnim = me.moveAnim || 0;
    }

    /* Player đối diện (để render) */
    const other = s.players.find((p) => p.id !== this.myId);
    W.remotePlayerData = other || null;

    W.camera.x = W.player.x;
    W.camera.y = W.player.y;
    W.camera.shake = 0;

    /* HUD */
    const g = this._game();
    if (g && g.updateHUD) g.updateHUD();

    /* Boss bar */
    if (W.boss) {
      const bn = document.getElementById('bossName');
      const bb = document.getElementById('bossBar');
      const bf = document.getElementById('bossFill');
      if (bn) bn.textContent = W.boss.name;
      if (bb) bb.classList.add('on');
      if (bf) {
        bf.style.width = clamp(W.boss.hp / W.boss.maxHp, 0, 1) * 100 + '%';
      }
    } else {
      const bb = document.getElementById('bossBar');
      if (bb) bb.classList.remove('on');
    }
  },

  /* =========================================================
     GUEST: send input
     ========================================================= */
  guestTick(dt) {
    if (!this.isGuest() || !this._world()) return;

    this.inputAcc += dt;
    if (this.inputAcc < 1 / this.INPUT_HZ) return;
    this.inputAcc = 0;

    const W = this._world();
    const camX = W.camera.x - window.innerWidth / 2;
    const camY = W.camera.y - window.innerHeight / 2;
    const wx = Input.mouse.x + camX;
    const wy = Input.mouse.y + camY;
    const angle = Math.atan2(wy - W.player.y, wx - W.player.x);

    this.send({
      type: 'to_host',
      data: {
        type: 'input',
        input: {
          mv: Input.moveVector(),
          angle,
          attack: Input.isDown(' ')
        }
      }
    });
  },

  /* =========================================================
     HOST: show room after 'hosted'
     ========================================================= */
  showRoom(code) {
    /* Hiển thị panel mã phòng */
    const main = document.getElementById('lanMain');
    const room = document.getElementById('lanRoom');
    if (main) main.classList.add('hidden');
    if (room) room.classList.remove('hidden');

    const codeEl = document.getElementById('lanRoomCode');
    if (codeEl) codeEl.textContent = code;

    this.refreshPlayerList();

    /* Đảm bảo có profile để start run */
    const g = this._game();
    if (!g) return;

    if (!g.profile) {
      const Save = window.VNXX?.Save;
      if (!Save) {
        this._toast('KHÔNG CÓ SAVE MODULE');
        return;
      }
      const slot = Save.freeSlot();
      if (slot < 0) {
        this._toast('HẾT SLOT LƯU');
        return;
      }
      g.profile = Save.createBlank('HOST', 'normal', slot);
      Save.write(g.profile);
    }

    if (g.startRun) g.startRun(g.profile, true);
    g.multiplayer = true;
  },

  /* =========================================================
     HOST: refresh player list panel
     ========================================================= */
  refreshPlayerList() {
    const el = document.getElementById('lanPlayers');
    if (!el) return;

    let html = '<div class="stat-line"><span>HOST (BẠN)</span>' +
               '<span style="color:#39ff9e">●</span></div>';

    for (const [, p] of this.remotePlayers) {
      const name = p.name || p.id;
      html += '<div class="stat-line"><span>' + name + '</span>' +
              '<span style="color:#28e0ff">●</span></div>';
    }

    el.innerHTML = html;
  },

  /* =========================================================
     DISCONNECT / CLEANUP
     ========================================================= */
  disconnect() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) { /* ignore */ }
    }
    this.ws = null;
    this.mode = null;
    this.connected = false;
    this.roomCode = null;
    this.myId = null;
    this.remotePlayers.clear();
    this.remoteInputs.clear();
  }
};

export default Net;