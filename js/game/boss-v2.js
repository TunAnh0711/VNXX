/* =========================================================
VNXX — GAME / BOSS V2
State machine cho boss mới:
idle → telegraph → attack → recover → phaseShift
Weighted random attack pick
Telegraph có sàn công bằng (TELEGRAPH_MIN)
Phase shift khi HP vượt mốc
Double-cast cho Hardcore
5 kiểu moveAI: hover / walk / blink / orbit / float
⚠️ Attack scripts đăng ký từ boss-attacks.js (Bước 3)
qua registerAttackScripts(map).
========================================================= */
import {
  getBossV2,
  getBossPhase,
  getAttackPool,
  pickWeightedAttack,
  MOVE_AI,
  TELEGRAPH_MIN,
  BOSS_PHASE_CD_MUL
} from '../data/bosses-v2.js';
import { getBossDifficulty } from '../data/difficulties-boss.js';
import { clamp, TAU, angLerp } from '../core/utils.js';
import Sound from '../systems/sound.js';
import { damagePlayer } from './player.js';

/* =========================================================
ATTACK SCRIPT REGISTRY
Populated bởi Bước 3 (boss-attacks.js).
Key = tên `run` trong data/bosses-v2.js
Value = function(boss, game, diff, t, W)
========================================================= */
const ATTACK_SCRIPTS = {};
const TELEGRAPH_SCRIPTS = {};

export function registerAttackScripts(map) {
  Object.assign(ATTACK_SCRIPTS, map);
}

export function registerTelegraphScripts(map) {
  Object.assign(TELEGRAPH_SCRIPTS, map);
}

/** Kiểm tra object có phải BossV2 không. */
export function isBossV2(b) {
  return b instanceof BossV2;
}

/* =========================================================
BOSS V2 CLASS
========================================================= */
export class BossV2 {
  /* =====================================================
  CONSTRUCTOR
  ====================================================== */
  constructor(bossName, difficultyKey, game, W) {
    const base = getBossV2(bossName);
    if (!base) throw new Error('[BossV2] Unknown boss: ' + bossName);
    const diff = getBossDifficulty(difficultyKey);
    const p = W.player;

    /* ---------- VNXX visual compat ---------- */
    this.isBoss = true;
    this.name = base.name;
    this.radius = base.radius;
    this.color = base.color;

    /* Vị trí */
    this.x = p.x;
    this.y = clamp(p.y - 520, 120, W.h - 120);
    this.vx = 0;
    this.vy = 0;
    this.kx = 0;
    this.ky = 0;
    this.angle = 0;

    /* Visual state */
    this.hitFlash = 0;
    this.frozen = 0;
    this.slow = 0;
    this.telegraph = 0;
    this.telegraphType = null;
    this.spawnAnim = 1.2;

    /* ---------- HP ---------- */
    this.maxHp = Math.round(base.hp * diff.hpMul);
    this.hp = this.maxHp;
    this.shield = 0;
    this.maxShield = 0;

    /* ---------- Combat ---------- */
    this.damage = 26 * diff.dmgMul;
    this.speed = base.speed;
    this.baseDamage = this.damage;   // mốc gốc — phase shift nhân từ đây
    this.baseSpeed = this.speed;
    this.knockRes = 1;

    /* ---------- V2 system ---------- */
    this.base = base;
    this.diff = diff;
    this.diffKey = difficultyKey;
    this.game = game;
    this.W = W;
    this.phase = 1;
    this.state = 'idle';
    this.fightT = 0;
    this.chainChance = 0;
    this.timer = this._randInterval();
    this.current = null;    // { id, def }
    this.atkT = 0;
    this.usedOnce = new Set();
    this.willDouble = false;
    this.enraged = false;
    this.moveAnim = 0;

    /* Dash state (attack scripts điều khiển) */
    this.dashing = 0;
    this.dashDir = { x: 0, y: 0 };
    this.dashSpeed = 0;

    /* ---------- Entity extras ---------- */
    this.modName = null;
    this.elite = false;
    this.type = 'boss';
    this.alive = true;
    this.regen = 0;
    this.dmgReduce = 0;
    this.lifesteal = 0;
    this.teleportCd = 0;

    /* Attack-specific scratch state */
    this.attackData = {};
  }

  /* =====================================================
  TIMING HELPERS
  ====================================================== */
  _phaseCdMul() {
    return BOSS_PHASE_CD_MUL[this.phase] || 1;
  }

  /** Hệ số "cuồng" — trận càng lâu, phase càng cao thì càng nhanh. */
  _rage() {
    const phaseRage = this.phase === 3 ? .80 : (this.phase === 2 ? .90 : 1);
    const timeRage = Math.max(.70, 1 - (this.fightT || 0) * .0016);
    return phaseRage * timeRage;
  }

  _randInterval() {
    const base = this.base.attackInterval * this.diff.cdMul * this._phaseCdMul();
    return base * (0.85 + Math.random() * 0.3) * this._rage();
  }

  _telegraphOf(atk) {
    /* Không bao giờ ngắn hơn sàn công bằng, nhưng phase sau thì gấp hơn */
    const r = Math.max(.82, this._rage());
    return Math.max(TELEGRAPH_MIN, atk.telegraph * this.diff.telegraphMul * r);
  }

  _recoverOf(atk) {
    return atk.recover * this.diff.recoverMul * Math.max(.72, this._rage());
  }

  /* =====================================================
  PHASE
  ====================================================== */
  _checkPhase() {
    const newPhase = getBossPhase(this.hp, this.maxHp);
    if (newPhase === this.phase) return;
    if (this.state === 'phaseShift') return;

    const oldPhase = this.phase;
    this.phase = newPhase;

    if (newPhase > oldPhase) {
      /* Vào phaseShift — dừng đánh 1s + xả shockwave */
      this.state = 'phaseShift';
      this.timer = .8;
      this.telegraphType = 'PHASE ' + newPhase;
      this._spawnShockwave(12 + newPhase * 6, 120 * this.diff.bulletSpeedMul);

      /* Phase sau đánh đau hơn (baseDamage giữ mốc gốc, không nhân dồn) */
      this.damage = this.baseDamage * (1 + (newPhase - 1) * .18);
      this.speed = this.baseSpeed * (1 + (newPhase - 1) * .12);
      Sound.sfx('enrage');

      /* Cancel attack hiện tại */
      this.current = null;
      this.atkT = 0;

      if (typeof window.addToast === 'function') {
        window.addToast('⚠ BOSS PHASE ' + newPhase);
      }
      Sound.sfx('warning');
    }
  }

  /* =====================================================
  MAIN TICK — gọi mỗi frame
  ====================================================== */
  tick(dt, W) {
    /* Spawn animation — đứng yên chờ hiện ra */
    if (this.spawnAnim > 0) {
      this.spawnAnim -= dt;
      return;
    }

    /* Decay các timer visual */
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.frozen > 0) this.frozen -= dt;
    if (this.slow > 0) this.slow -= dt;

    /* Knockback physics */
    this.x += this.kx * dt;
    this.y += this.ky * dt;
    this.kx *= 1 - 8 * dt;
    this.ky *= 1 - 8 * dt;

    /* Dash movement (attack scripts set dashing) */
    if (this.dashing > 0) {
      this.dashing -= dt;
      this.x += this.dashDir.x * this.dashSpeed * dt;
      this.y += this.dashDir.y * this.dashSpeed * dt;

      /* Trail effect */
      if (Math.random() < 0.5 && W && W.particles) {
        W.particles.push({
          x: this.x + (Math.random() - 0.5) * 20,
          y: this.y + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * 40,
          vy: (Math.random() - 0.5) * 40,
          life: 0.4,
          maxLife: 0.4,
          size: 5,
          color: this.color,
          type: 'dot'
        });
      }
    }

    /* Đồng hồ trận — dùng cho hệ số cuồng */
    this.fightT += dt;

    /* Timer */
    this.timer -= dt;

    /* State machine */
    switch (this.state) {
      case 'idle':        this._tickIdle(dt, W); break;
      case 'telegraph':   this._tickTelegraph(dt, W); break;
      case 'attack':      this._tickAttack(dt, W); break;
      case 'recover':     this._tickRecover(dt, W); break;
      case 'phaseShift':  this._tickPhaseShift(dt, W); break;
    }

    /* Update telegraph field cho draw-entities đọc */
    if (this.state === 'telegraph') {
      this.telegraph = this.timer;
    } else if (this.state !== 'phaseShift') {
      this.telegraph = 0;
    }

    /* Face player */
    this._facePlayer(W, dt);

    /* Kiểm tra phase (phòng khi hp thay đổi từ ngoài) */
    this._checkPhase();

    /* Contact damage */
    if (W && W.player && W.player.alive) {
      const p = W.player;
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d < this.radius + p.radius + 6) {
        damagePlayer(this.game, W, this.damage * 0.7, this);
      }
    }

    /* Clamp trong map */
    if (W) {
      this.x = clamp(this.x, this.radius, W.w - this.radius);
      this.y = clamp(this.y, this.radius, W.h - this.radius);
    }
  }

  /* =====================================================
  STATE HANDLERS
  ====================================================== */
  _tickIdle(dt, W) {
    this._moveAI(dt, W, 1.0);
    if (this.timer <= 0) this._startTelegraph();
  }

  _tickTelegraph(dt, W) {
    this._moveAI(dt, W, 0.3);
    if (this.timer <= 0) this._startAttack();
  }

  _tickAttack(dt, W) {
    this.atkT += dt;

    /* Chạy attack script */
    if (this.current) {
      const script = ATTACK_SCRIPTS[this.current.def.run];
      if (typeof script === 'function') {
        try {
          script(this, this.game, this.diff, this.atkT, W);
        } catch (err) {
          console.error('[BossV2] attack script error:', this.current.id, err);
        }
      } else {
        console.warn('[BossV2] missing attack script:', this.current.def.run);
      }
    }

    /* Kết thúc attack khi đủ duration */
    const dur = this.current ? this.current.def.duration : 0;
    if (this.atkT >= dur) {
      this.state = 'recover';
      this.willDouble = Math.random() < this.diff.doubleCastChance;
      this.timer = this.current ? this._recoverOf(this.current.def) : 0.5;
    }
  }

  _tickRecover(dt, W) {
    this._moveAI(dt, W, 0.4);
    if (this.timer <= 0) {
      /* Áp lực: phase càng cao càng hay đánh nối chiêu */
      const chain = this.diff.doubleCastChance + .10 + this.phase * .07;
      if (this.willDouble || Math.random() < chain) {
        this.state = 'idle';
        this.timer = 0.18;
      } else {
        this.state = 'idle';
        this.timer = this._randInterval();
      }
      this.willDouble = false;
    }
  }

  _tickPhaseShift(dt, W) {
    if (this.timer <= 0) {
      this.state = 'idle';
      this.timer = 0.5;
      this.telegraphType = null;
      this.telegraph = 0;
    }
  }

  /* =====================================================
  START TELEGRAPH / ATTACK
  ====================================================== */
  _startTelegraph() {
    /* Lấy pool attack khả dụng */
    const pool = getAttackPool(
      this.base,
      this.phase,
      this.diff.extraPatternTier,
      this.usedOnce
    );

    /* Weighted random pick */
    const pick = pickWeightedAttack(pool);
    if (!pick) {
      /* Không có chiêu khả dụng (hiếm) → chờ rồi thử lại */
      this.timer = 1.0;
      return;
    }

    this.current = { id: pick[0], def: pick[1] };
    this.state = 'telegraph';
    this.timer = this._telegraphOf(this.current.def);
    this.telegraphType = this.current.def.telegraphType || 'radial';

    /* SFX */
    if (this.current.def.sfx) {
      Sound.sfx(this.current.def.sfx);
    }

    /* Telegraph hook — attack script có thể pre-place hazard */
    const tScript = TELEGRAPH_SCRIPTS[this.current.def.run];
    if (typeof tScript === 'function') {
      try {
        tScript(this, this.game, this.diff);
      } catch (err) {
        console.error('[BossV2] telegraph hook error:', err);
      }
    }
  }

  _startAttack() {
    this.state = 'attack';
    this.atkT = 0;

    /* Đánh dấu oncePerPhase đã dùng */
    if (this.current && this.current.def.oncePerPhase) {
      this.usedOnce.add(this.current.id + ':' + this.phase);
    }

    /* Reset per-attack scratch state */
    this.attackData = {};
  }

  /* =====================================================
  MOVEMENT AI
  ====================================================== */
  _facePlayer(W, dt) {
    if (!W || !W.player) return;
    const p = W.player;
    const target = Math.atan2(p.y - this.y, p.x - this.x);
    this.angle = angLerp(this.angle, target, Math.min(1, dt * 3));
  }

  _moveAI(dt, W, speedMul) {
    if (!W || !W.player) return;
    const p = W.player;

    const dx = p.x - this.x;
    const dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 0.0001;
    const ux = dx / d;
    const uy = dy / d;

    const slowMul = this.slow > 0 ? 0.5 : 1;
    const speed = this.base.speed * speedMul * slowMul;
    const preferred = this.base.preferredRange || 220;

    let ax = 0, ay = 0;

    switch (this.base.moveAI) {
      case MOVE_AI.HOVER:
      case MOVE_AI.FLOAT: {
        if (d > preferred * 1.2)      { ax = ux;  ay = uy;  }
        else if (d < preferred * 0.7) { ax = -ux; ay = -uy; }
        else {
          /* Orbit nhẹ quanh vị trí hiện tại */
          const pa = Math.atan2(uy, ux) + Math.PI / 2;
          const side = Math.sin(W.time * 0.5) > 0 ? 1 : -1;
          ax = Math.cos(pa) * side * 0.5;
          ay = Math.sin(pa) * side * 0.5;
        }
        break;
      }
      case MOVE_AI.WALK: {
        if (d > preferred) { ax = ux; ay = uy; }
        break;
      }
      case MOVE_AI.ORBIT: {
        const pa = Math.atan2(dy, dx) + Math.PI / 2;
        const side = Math.sin(W.time * 0.6 + this.x * 0.01) > 0 ? 1 : -1;
        ax = Math.cos(pa) * side;
        ay = Math.sin(pa) * side;
        if (d > preferred * 1.3) {
          ax = ax * 0.5 + ux * 0.5;
          ay = ay * 0.5 + uy * 0.5;
        } else if (d < preferred * 0.7) {
          ax = ax * 0.5 - ux * 0.5;
          ay = ay * 0.5 - uy * 0.5;
        }
        break;
      }
      case MOVE_AI.BLINK: {
        this.attackData.blinkCd = (this.attackData.blinkCd || 0) - dt;
        if (this.attackData.blinkCd <= 0 && d > 300) {
          this.attackData.blinkCd = 3.5;
          const nx = p.x + (Math.random() - 0.5) * 400;
          const ny = p.y + (Math.random() - 0.5) * 400;
          this.x = clamp(nx, 60, W.w - 60);
          this.y = clamp(ny, 60, W.h - 60);
          Sound.sfx('dash');
        }
        /* Vẫn di chuyển chậm về phía player */
        ax = ux * 0.3;
        ay = uy * 0.3;
        break;
      }
    }

    /* Accel → velocity → position */
    this.vx += ax * speed * 5 * dt;
    this.vy += ay * speed * 5 * dt;

    /* Clamp tốc độ */
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > speed) {
      this.vx = this.vx / sp * speed;
      this.vy = this.vy / sp * speed;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    /* Friction */
    this.vx *= 1 - 3 * dt;
    this.vy *= 1 - 3 * dt;
  }

  /* =====================================================
  HELPERS — attack scripts có thể gọi
  ====================================================== */
  /** Xả vòng đạn tròn — dùng cho phase shift shockwave. */
  _spawnShockwave(count, speed) {
    const W = this.W;
    if (!W) return;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      W.projectiles.push({
        x: this.x,
        y: this.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        r: 6,
        damage: 0,
        owner: 'enemy',
        life: 2,
        pierce: 0,
        splash: 0,
        knockback: 300,
        color: this.color,
        hitSet: new Set(),
        isShockwave: true
      });
    }
  }

  /* =====================================================
  DEBUG
  ====================================================== */
  getDebugInfo() {
    return {
      name: this.name,
      hp: Math.round(this.hp) + '/' + this.maxHp,
      phase: this.phase,
      state: this.state,
      timer: this.timer.toFixed(2),
      current: this.current ? this.current.id : null,
      usedOnce: Array.from(this.usedOnce)
    };
  }
}

/* =========================================================
FACTORY
========================================================= */
export function createBossV2(bossName, difficultyKey, game, W) {
  return new BossV2(bossName, difficultyKey, game, W);
}