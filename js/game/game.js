/* =========================================================
   VNXX — GAME / GAME
   State machine + main loop + lifecycle orchestrator.
   Logic gameplay tách sang: world/player/enemy/boss/
   projectile/waves/loot/progress (file 26–33).
   ========================================================= */

/* ---------- CORE ---------- */
import {
  ST, SCREEN_MAP, CFG, DIFFICULTIES
} from '../core/constants.js';
import Input from '../core/input.js';
import Settings from '../core/settings.js';
import { clamp } from '../core/utils.js';

/* ---------- DATA ---------- */
import { UPGRADES } from '../data/upgrades.js';
import { WEAPONS } from '../data/weapons.js';
import { CONSUMABLES } from '../data/consumables.js';
import { MODULES } from '../data/modules.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import {
  STAGES, getStage, isBossWave, isLastStage, nextStage
} from '../data/stages.js';

/* ---------- SYSTEMS ---------- */
import Sound from '../systems/sound.js';
import Save from '../systems/save.js';
import { Fx, FloatText } from '../systems/fx.js';

/* ---------- GAME MODULES ---------- */
import { buildWorld, updateCamera } from './world.js';
import {
  updatePlayer,
  doDash as dashImpl,
  useConsumable as useConsumableImpl,
  updateBeams
} from './player.js';
import {
  updateEnemies,
  killEnemy as killEnemyImpl,
  damageEnemy as damageEnemyImpl
} from './enemy.js';
import { spawnBoss, updateBoss } from './boss.js';
import { updateProjectiles } from './projectile.js';
import {
  startWave, updateWave, completeWave
} from './waves.js';
import {
  updateLoot, updateChests, spawnChest, openChest
} from './loot.js';
import {
  addXp as addXpImpl,
  queueLevelUp,
  showLevelUp,
  checkAchievements as checkAchievementsImpl,
  syncProfileFromWorld as syncProfileImpl,
  moduleMods,
  xpForLevel,
  onBossDefeated as onBossDefeatedImpl,
  showStageClear as showStageClearImpl,
  nextStage as nextStageImpl
} from './progress.js';

/* ---------- UI ---------- */
import { showScreen, hideAllScreens } from '../ui/screens.js';
import { addToast, updateHUD as updateHUDImpl, showBossBar, hideBossBar } from '../ui/hud.js';
import { renderInventory } from '../ui/inventory-ui.js';
import * as shopUI from '../ui/shop-ui.js';

/* =========================================================
   GAME OBJECT
   ========================================================= */
const Game = {
  /* ---------- Trạng thái ---------- */
  state: ST.BOOT,
  profile: null,
  world: null,
  seed: 1,
  RNG: null,
  debug: false,
  godMode: false,
  paused: false,
  running: false,
  fps: 60,
  _fpsAcc: 0,
  _fpsCount: 0,
  playTimer: 0,
  pendingLevelUps: 0,
  afterShop: null,
  watchMode: false,
  multiplayer: false,

  /* Ghi nhớ state trước đó */
  _prevState: null,
  _settingsFrom: null,
  _settingsReturn: null,
  _eventWave: 0,
  _saveTimer: 0,
  _lastEventId: null,
  _selDiff: 'normal',
  _last: 0,

  /* =========================================================
     INIT
     ========================================================= */
  init() {
    Input.setKeyHandler((k, e) => this._onKeyDown(k, e));
    this.bindUI();

    const meta = this.getMeta();
    if (!meta.seenIntro) {
      this.setState(ST.INTRO);
      showScreen(ST.INTRO);
      this.playIntro();
    } else {
      this.setState(ST.MAIN_MENU);
      showScreen(ST.MAIN_MENU);
    }

    requestAnimationFrame((t) => this.loop(t));
  },

  /* =========================================================
     STATE MACHINE
     ========================================================= */
  setState(s) {
    this.state = s;

    const inGame = [
      ST.PLAYING, ST.BOSS, ST.PAUSED, ST.SHOP, ST.INVENTORY,
      ST.LEVEL_UP, ST.WATCH_MODE, ST.GAME_OVER, ST.HARDCORE_DEAD,
      ST.STAGE_CLEAR, ST.EVENT
    ].includes(s);

    const hud = document.getElementById('hud');
    if (hud) hud.classList.toggle('on', inGame);

    if ([ST.MAIN_MENU, ST.PROFILE_CREATION, ST.LOAD_MENU,
         ST.SETTINGS, ST.ACHIEVEMENTS, ST.LAN].includes(s)) {
      Sound.startMusic('menu');
    }

    if (s === ST.PLAYING || s === ST.BOSS) Sound.resume();
  },

  isInGame() {
    return [ST.PLAYING, ST.BOSS, ST.PAUSED, ST.WATCH_MODE].includes(this.state);
  },

  /* =========================================================
     MAIN LOOP
     ========================================================= */
  loop(ts) {
    requestAnimationFrame((t) => this.loop(t));

    const dt = Math.min(.05, (ts - this._last || 16) / 1000);
    this._last = ts;

    this._fpsAcc += dt;
    this._fpsCount++;
    if (this._fpsAcc >= .5) {
      this.fps = this._fpsCount / this._fpsAcc;
      this._fpsAcc = 0;
      this._fpsCount = 0;
    }

    const Net = window.VNXXNet;

    /* -------- LAN GUEST PATH -------- */
    if (Net && Net.isGuest()) {
      Net.guestTick(dt);
      if (this.world) {
        Fx.update(this.world.particles || [], dt * .35);
        FloatText.update(this.world.texts || [], dt * .6);
      }
    }
    /* -------- INTRO -------- */
    else if (this.state === ST.INTRO) {
      /* noop */
    }
    /* -------- Có world -------- */
    else if (this.world) {
      const active = [ST.PLAYING, ST.BOSS, ST.WATCH_MODE].includes(this.state);

      if (active && !this.paused) {
        this.update(dt);
      } else if ([ST.PAUSED, ST.SHOP, ST.INVENTORY, ST.LEVEL_UP, ST.EVENT]
                 .includes(this.state)) {
        Fx.update(this.world.particles, dt * .35);
      }
    }

    const Canvas2D = window.VNXX?.Canvas2D;
    if (Canvas2D) Canvas2D.render();

    if (this.debug) this.updateDebugPanel();
  },

  /* =========================================================
     UPDATE
     ========================================================= */
  update(dt) {
    const W = this.world;
    if (!W) return;

    W.time += dt;
    this.playTimer += dt;
    if (this.profile) this.profile.statistics.playTime += dt;

    updatePlayer(this, W, dt);
    updateEnemies(this, W, dt);
    updateProjectiles(this, W, dt);
    updateLoot(this, W, dt);
    updateChests(W, dt);
    updateBeams(W, dt);           // ← THÊM DÒNG NÀY
    updateWave(this, W, dt);

    Fx.update(W.particles, dt);
    FloatText.update(W.texts, dt);
    updateCamera(W, dt);

    this.updateHUD();
    this.maybeRandomEvent();

    const Net = window.VNXXNet;
    if (Net && Net.isHost()) Net.hostTick(dt);

    /* Auto-save mỗi 45s */
    this._saveTimer += dt;
    if (this._saveTimer > 45) {
      this._saveTimer = 0;
      this.syncProfileFromWorld();
      Save.auto(this.profile);
    }

    /* Check death */
    if (W.player.hp <= 0 && W.player.alive && this.state !== ST.WATCH_MODE) {
      this.onPlayerDeath();
    }

    /* Boss bar */
    if (W.boss) {
      const el = document.getElementById('bossFill');
      if (el) el.style.width = clamp(W.boss.hp / W.boss.maxHp, 0, 1) * 100 + '%';
    }
  },

  /* =========================================================
     KEY HANDLING
     ========================================================= */
  _onKeyDown(k, e) {
    switch (this.state) {
      case ST.PLAYING:
      case ST.BOSS:
        if (k === 'Escape')   this.pause();
        else if (k === 'Tab') this.openInventory();
        else if (k === 'q')   this.cycleWeapon();
        else if (k === 'e')   this.doDash();
        else if (k === 'r')   this.useConsumable('medkit');
        else if (k === 'F3')  this.toggleDebug();
        break;

      case ST.PAUSED:
        if (k === 'Escape') this.resume();
        break;

      case ST.WATCH_MODE:
        if (k === 'Escape') this.toMainMenu();
        break;

      case ST.INVENTORY:
        if (k === 'Tab' || k === 'Escape') this.closeInventory();
        break;

      case ST.INTRO:
        this.skipIntro();
        break;

      default:
        if (k === 'F3') this.toggleDebug();
    }

    const tut = document.getElementById('tutorial');
    if (tut && tut.classList.contains('on') &&
        (k === ' ' || k === 'Enter' || k === 'Escape')) {
      this.closeTutorial();
    }
  },

  /* =========================================================
     UI BIND
     ========================================================= */
  bindUI() {
    /* Menu chính */
    document.querySelectorAll('#screen-menu [data-act]').forEach((b) => {
      b.addEventListener('click', () => {
        Sound.init(); Sound.resume(); Sound.sfx('button');
        const a = b.dataset.act;
        if (a === 'new') {
          this.setState(ST.PROFILE_CREATION);
          showScreen(ST.PROFILE_CREATION);
          this.refreshProfileForm();
        } else if (a === 'load') {
          this.openLoadMenu();
        } else if (a === 'settings') {
          this.openSettings('menu');
        } else if (a === 'donate') {
          this.openDonate();
        } else if (a === 'ach') {
          this.openAchievements();
        } else if (a === 'quit') {
          if (confirm('Thoát game?')) { window.close(); this.toMainMenu(); }
        }
      });
    });

    /* Back về menu */
    document.querySelectorAll('[data-act="back-menu"]').forEach((b) => {
      b.addEventListener('click', () => { Sound.sfx('button'); this.toMainMenu(); });
    });

    /* Pause menu */
    document.querySelectorAll('#screen-pause [data-act]').forEach((b) => {
      b.addEventListener('click', () => {
        Sound.sfx('button');
        const a = b.dataset.act;
        if (a === 'resume') this.resume();
        else if (a === 'pause-settings') this.openSettings('pause');
        else if (a === 'pause-save') { Save.auto(this.profile); addToast('ĐÃ LƯU'); }
        else if (a === 'quit-menu') {
          if (confirm('Thoát về Main Menu? Tiến trình hiện tại sẽ được lưu.')) {
            Save.auto(this.profile);
            this.toMainMenu();
          }
        }
      });
    });

    /* Tutorial */
    const tutClose = document.getElementById('tutClose');
    if (tutClose) tutClose.addEventListener('click', () => this.closeTutorial());

    /* HUD settings */
    const hs = document.getElementById('hudSettingsBtn');
    if (hs) hs.addEventListener('click', () => this.openSettings('hud'));

    /* Game over */
    const goRevive = document.getElementById('goRevive');
    if (goRevive) goRevive.addEventListener('click', () => this.revive());

    const goRetry = document.getElementById('goRetry');
    if (goRetry) goRetry.addEventListener('click', () => {
      if (!this.profile) return;
      this.profile.hp = this.profile.maxHp;
      this.profile.currentWave = 1;
      this.profile.statistics.deaths++;
      Save.auto(this.profile);
      this.startRun(this.profile, false);
    });

    const goMenu = document.getElementById('goMenu');
    if (goMenu) goMenu.addEventListener('click', () => this.toMainMenu());

    /* Hardcore dead */
    const hcWatch = document.getElementById('hcWatch');
    if (hcWatch) hcWatch.addEventListener('click', () => {
      hideAllScreens();
      this.enterWatchMode();
    });
    const hcMenu = document.getElementById('hcMenu');
    if (hcMenu) hcMenu.addEventListener('click', () => this.toMainMenu());

    /* Stage clear */
    const scCont = document.getElementById('scContinue');
    if (scCont) scCont.addEventListener('click', () => this.nextStage());

    /* Event modal */
    const eventYes = document.getElementById('eventYes');
    if (eventYes) eventYes.addEventListener('click', () => this.resolveEvent(true));
    const eventNo = document.getElementById('eventNo');
    if (eventNo) eventNo.addEventListener('click', () => this.resolveEvent(false));
  },

  /* =========================================================
     INTRO CINEMATIC
     ========================================================= */
  playIntro() {
    const el = document.getElementById('introContent');
    if (!el) return;
    el.innerHTML = '';
    const lines = ['SYSTEM INITIALIZING...', 'CONNECTING...', 'SIGNAL DETECTED'];
    let i = 0;

    const show = () => {
      if (i < lines.length) {
        const d = document.createElement('div');
        d.className = 'intro-line';
        d.textContent = lines[i];
        el.appendChild(d);
        i++;
        setTimeout(show, 700);
      } else {
        const l = document.createElement('div');
        l.className = 'intro-logo';
        l.textContent = 'VNXX';
        el.appendChild(l);
        setTimeout(() => {
          if (this.state === ST.INTRO) this.skipIntro();
        }, 1500);
      }
    };
    setTimeout(show, 300);
  },

  skipIntro() {
    if (this.state !== ST.INTRO) return;
    this.setMeta({ seenIntro: true });
    this.setState(ST.MAIN_MENU);
    showScreen(ST.MAIN_MENU);
  },

  /* =========================================================
     META
     ========================================================= */
  getMeta() {
    try { return JSON.parse(localStorage.getItem(CFG.META_KEY)) || {}; }
    catch (e) { return {}; }
  },
  setMeta(o) {
    try {
      localStorage.setItem(CFG.META_KEY,
        JSON.stringify(Object.assign(this.getMeta(), o)));
    } catch (e) { /* ignore */ }
  },

  /* =========================================================
     PROFILE CREATION
     ========================================================= */
  refreshProfileForm() {
    const el = document.getElementById('profileName');
    if (el) el.value = '';
    const hint = document.getElementById('profileHint');
    if (hint) hint.textContent = '';
    this.buildDiffGrid();
    setTimeout(() => el && el.focus(), 80);
  },

  buildDiffGrid() {
    const g = document.getElementById('diffGrid');
    if (!g) return;
    g.innerHTML = '';
    Object.values(DIFFICULTIES).forEach((d) => {
      const el = document.createElement('div');
      el.className = 'diff-opt' + (d.id === 'hardcore' ? ' hc' : '');
      el.dataset.diff = d.id;
      el.innerHTML =
        '<div class="dn">' + (d.id === 'hardcore' ? '☠ ' : '') + d.name + '</div>' +
        '<div class="dd">' + d.desc + '</div>';
      el.addEventListener('click', () => {
        this._selDiff = d.id;
        g.querySelectorAll('.diff-opt').forEach((x) => x.classList.remove('sel'));
        el.classList.add('sel');
        Sound.sfx('button');
      });
      g.appendChild(el);
    });
    this._selDiff = 'normal';
    const norm = g.querySelector('[data-diff="normal"]');
    if (norm) norm.classList.add('sel');
  },

  createProfile() {
    const nameInput = document.getElementById('profileName');
    const hint = document.getElementById('profileHint');
    if (!nameInput) return;
    const raw = nameInput.value.trim();

    if (raw.length < 3) {
      if (hint) hint.textContent = 'TÊN PHẢI CÓ ÍT NHẤT 3 KÝ TỰ.';
      Sound.sfx('warning'); return;
    }
    if (raw.length > 16) {
      if (hint) hint.textContent = 'TÊN KHÔNG ĐƯỢC VƯỢT QUÁ 16 KÝ TỰ.';
      Sound.sfx('warning'); return;
    }

    const slot = Save.freeSlot();
    if (slot < 0) {
      if (hint) hint.textContent = 'ĐÃ ĐẦY SLOT LƯU. HÃY XÓA BỚT TRONG MENU LOAD.';
      Sound.sfx('warning'); return;
    }

    const profile = Save.createBlank(raw, this._selDiff, slot);
    Save.write(profile);
    this.profile = profile;
    this.startRun(profile, true);
  },

  /* =========================================================
     LOAD MENU
     ========================================================= */
  openLoadMenu() {
    this.setState(ST.LOAD_MENU);
    showScreen(ST.LOAD_MENU);
    this.renderLoadList();
  },

  renderLoadList() {
    const list = document.getElementById('saveList');
    if (!list) return;
    const saves = Save.list();
    list.innerHTML = '';
    if (saves.length === 0) {
      list.innerHTML = '<div class="empty-note">CHƯA CÓ DỮ LIỆU SAVE</div>';
      return;
    }
    saves.forEach((s) => {
      const card = document.createElement('div');
      card.className = 'save-card';
      const tags = (s.hardcore ? '<span class="tag hc">☠ HARDCORE</span>' : '') +
                   (s.dead ? '<span class="tag dead">DEAD</span>' : '');
      card.innerHTML =
        '<div class="sc-name">' + s.playerName + tags + '</div>' +
        '<div class="sc-row"><span>ĐỘ KHÓ</span><b>' + DIFFICULTIES[s.difficulty].name + '</b></div>' +
        '<div class="sc-row"><span>TIẾN TRÌNH</span><b>STAGE ' +
          String(s.currentStage).padStart(2, '0') + ' — WAVE ' +
          String(s.currentWave).padStart(2, '0') + '</b></div>' +
        '<div class="sc-row"><span>LEVEL</span><b>' + s.level + '</b></div>' +
        '<div class="sc-row"><span>PLAYTIME</span><b>' + this._fmtTime(s.statistics.playTime) + '</b></div>' +
        '<div class="sc-row"><span>LAST SAVE</span><b>' + this._fmtDate(s.timestamp) + '</b></div>' +
        '<div class="sc-actions"></div>';

      const actions = card.querySelector('.sc-actions');
      const loadBtn = document.createElement('button');
      loadBtn.className = 'btn small primary';
      loadBtn.textContent = s.dead ? 'DEAD' : 'LOAD';
      loadBtn.disabled = !!s.dead;
      loadBtn.addEventListener('click', () => {
        Sound.sfx('button');
        if (s.dead) { alert('Save này đã kết thúc vĩnh viễn (HARDCORE).'); return; }
        this.profile = s;
        this.startRun(s, false);
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'btn small danger';
      delBtn.textContent = 'DELETE';
      delBtn.addEventListener('click', () => {
        Sound.sfx('button');
        if (confirm('XÓA SAVE CỦA "' + s.playerName + '"?\nHành động này không thể hoàn tác.')) {
          Save.remove(s.slot);
          this.renderLoadList();
        }
      });

      actions.appendChild(loadBtn);
      actions.appendChild(delBtn);
      list.appendChild(card);
    });
  },

  _fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const p = (n) => String(n).padStart(2, '0');
    return (h > 0 ? p(h) + ':' : '') + p(m) + ':' + p(s);
  },
  _fmtDate(ts) {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
  },

  /* =========================================================
     START RUN
     ========================================================= */
  startRun(profile, isNew) {
    this.profile = profile;
    this.seed = profile.seed || Math.floor(Math.random() * 900000) + 100000;
    profile.seed = this.seed;
    this.godMode = false;
    this.playTimer = 0;
    this.pendingLevelUps = 0;
    this._eventWave = 0;
    
    /* Reset world trước khi tạo mới */
    this.world = null;

    this.setState(ST.LOADING);
    showScreen(ST.LOADING);

    const stage = getStage(profile.currentStage);
    const loadTxt = document.getElementById('loadTxt');
    const loadSub = document.getElementById('loadSub');
    if (loadTxt) loadTxt.textContent = 'LOADING STAGE ' + String(stage.id).padStart(2, '0');
    if (loadSub) {
      loadSub.textContent = stage.lore + '\n' +
        (profile.hardcore ? '☠ HARDCORE — CHẾT LÀ HẾT.'
                          : 'ĐỘ KHÓ: ' + DIFFICULTIES[profile.difficulty].name);
    }

    setTimeout(() => {
      this.buildWorld(profile, isNew);
      /* Kiểm tra nếu đang ở wave boss (wave > số wave thường của stage) */
      const stage = getStage(profile.currentStage);
      const isBossNow = profile.currentWave > stage.waves;
      this.setState(isBossNow ? ST.BOSS : ST.PLAYING);
      hideAllScreens();
      Sound.startMusic(stage.music || 'game');
      if (Settings.get('tutorial') && isNew) {
        setTimeout(() => this.showTutorial(), 400);
      }
    }, 700);
  },

  /* =========================================================
     BUILD WORLD — delegate
     ========================================================= */
  buildWorld(profile, isNew) {
    this.world = buildWorld(this, profile, isNew);
  },

  /* =========================================================
     PAUSE / RESUME
     ========================================================= */
  pause() {
    if (this.state !== ST.PLAYING && this.state !== ST.BOSS) return;
    this.paused = true;
    this._prevState = this.state;
    this.setState(ST.PAUSED);
    showScreen(ST.PAUSED);
    this.updatePauseStats();
    Sound.sfx('button');
  },

  resume() {
    if (this.state !== ST.PAUSED) return;
    this.setState(this._prevState || ST.PLAYING);
    hideAllScreens();
    this.paused = false;
    Sound.sfx('button');
    if (this.pendingLevelUps > 0) queueLevelUp(this);
  },

  updatePauseStats() {
    const W = this.world;
    const el = document.getElementById('pauseStats');
    if (!W || !el) return;
    el.innerHTML =
      this.profile.playerName + ' · LV ' + W.player.level + ' · WAVE ' + W.wave + '<br>' +
      'KILLS: ' + this.profile.statistics.kills + ' · 💰 ' + W.player.credits;
  },

  /* =========================================================
     TO MAIN MENU
     ========================================================= */
  toMainMenu() {
    this.running = false;
    this.paused = false;
    this.world = null;
    this.multiplayer = false;
    this.setState(ST.MAIN_MENU);
    showScreen(ST.MAIN_MENU);
    Sound.startMusic('menu');
    const hud = document.getElementById('hud');
    if (hud) hud.classList.remove('on');
    hideBossBar();
  },

  /* =========================================================
     INVENTORY
     ========================================================= */
  openInventory() {
    if (this.state !== ST.PLAYING && this.state !== ST.BOSS) return;
    this.paused = true;
    this._prevState = this.state;
    this.setState(ST.INVENTORY);
    try {
      renderInventory();
    } catch (err) {
      console.error('[openInventory] renderInventory lỗi:', err);
    }
    showScreen(ST.INVENTORY);
  },

  closeInventory() {
    if (this.state !== ST.INVENTORY) return;
    this.setState(this._prevState || ST.PLAYING);
    hideAllScreens();
    this.paused = false;
    if (this.pendingLevelUps > 0) queueLevelUp(this);
  },

  /* =========================================================
     SHOP
     ========================================================= */
  openShop(onClose) {
    this.paused = true;
    this._prevState = this.state;
    this.afterShop = onClose || null;

    try {
      shopUI.openShop(this, onClose);
    } catch (err) {
      console.error('[openShop] lỗi:', err);
      this.setState(ST.SHOP);
      showScreen(ST.SHOP);
    }
  },

  closeShop() {
    Sound.sfx('button');
    this.setState(this._prevState || ST.PLAYING);
    hideAllScreens();
    this.paused = false;
    const cb = this.afterShop;
    this.afterShop = null;
    if (cb) cb();
    /* Re-check level up nếu có pending */
    if (this.pendingLevelUps > 0) queueLevelUp(this);
  },

  /* =========================================================
     SETTINGS
     ========================================================= */
  openSettings(from) {
    this._settingsFrom = from;
    this._settingsReturn =
      (this.state === ST.PAUSED || this.state === ST.PLAYING) ? ST.PAUSED :
      (this.state === ST.MAIN_MENU ? ST.MAIN_MENU : ST.MAIN_MENU);

    if (this.state === ST.PLAYING || this.state === ST.BOSS) this.paused = true;
    this.setState(ST.SETTINGS);
    showScreen(ST.SETTINGS);

    if (window.VNXX?.syncSettingsUI) window.VNXX.syncSettingsUI();

    const backBtn = document.querySelector('#screen-settings [data-act="back-settings"]');
    if (backBtn) {
      backBtn.onclick = () => {
        Sound.sfx('button');
        if (from === 'pause' || from === 'hud') {
          this.setState(ST.PAUSED);
          showScreen(ST.PAUSED);
          this.updatePauseStats();
        } else if (from === 'game') {
          this.resume();
        } else {
          this.toMainMenu();
        }
      };
    }
  },

  /* =========================================================
     ACHIEVEMENTS
     ========================================================= */
  openAchievements() {
    this.setState(ST.ACHIEVEMENTS);
    showScreen(ST.ACHIEVEMENTS);
    const unlocked = (this.profile && this.profile.achievements) || [];
    document.querySelectorAll('#achList .shop-row').forEach((row) => {
      const id = row.dataset.ach;
      const got = unlocked.includes(id);
      const price = row.querySelector('.sprice');
      if (price) {
        price.innerHTML = got
          ? '<span style="color:#39ff9e">✔ ĐÃ MỞ</span>'
          : '<span style="color:#5d7d92">🔒 CHƯA</span>';
      }
      row.style.opacity = got ? '1' : '.6';
    });
  },
 /* =========================================================
    DONATE
    ========================================================= */
  openDonate() {
    this.setState(ST.MAIN_MENU);
    showScreen('screen-donate');
  },

  /* =========================================================
     PLAYER ACTIONS
     ========================================================= */
  cycleWeapon() {
    if (!this.world) return;
    const owned = this.profile.inventory.weapons;
    if (owned.length < 2) return;
    const i = owned.indexOf(this.world.player.weaponId);
    const next = owned[(i + 1) % owned.length];
    this.world.player.weaponId = next;
    this.profile.weapon = next;
    addToast('VŨ KHÍ: ' + WEAPONS[next].name);
    Sound.sfx('button');
  },

  doDash() {
    if (this.world) dashImpl(this, this.world);
  },

  useConsumable(id) {
    if (this.world) return useConsumableImpl(this, this.world, id);
    return false;
  },
/* Recalc player stats khi module thay đổi (equip/unequip/mua) */
  recalcPlayerStats() {
    const W = this.world;
    if (!W || !W.player) return;

    const p = W.player;
    const mods = moduleMods(this.profile);
    const up = this.profile.upgrades;

    p.up.damageMul      = up.damageMul      + mods.damageMul;
    p.up.speedMul       = up.speedMul       + mods.speedMul;
    p.up.critChance     = up.critChance     + mods.critChance;
    p.up.armor          = clamp(up.armor    + mods.armor, 0, .75);
    p.up.lifesteal      = up.lifesteal      + mods.lifesteal;
    p.up.luck           = up.luck           + mods.luck;
    p.up.dodge          = clamp(up.dodge    + mods.dodge, 0, .6);
    p.speed             = CFG.PLAYER.baseSpeed * (1 + p.up.speedMul);

    p.upBase.damageMul  = mods.damageMul;
    p.upBase.speedMul   = mods.speedMul;
    p.upBase.critChance = mods.critChance;
    p.upBase.armor      = mods.armor;
    p.upBase.lifesteal  = mods.lifesteal;
    p.upBase.luck       = mods.luck;
    p.upBase.dodge      = mods.dodge;
  },
  /* =========================================================
     DEATH / REVIVE
     ========================================================= */
  onPlayerDeath() {
    const W = this.world;
    W.player.alive = false;
    Fx.burst(W.particles, W.player.x, W.player.y, 50, '#ff3b52', 420, 1.1, 5);
    Fx.ring(W.particles, W.player.x, W.player.y, '#ff3b52', 220, .9);
    this.playerDied();
  },

  playerDied() {
    const W = this.world;
    if (!W) return;
    const pr = this.profile;
    pr.statistics.deaths++;
    pr.dead = pr.hardcore;
    this.syncProfileFromWorld();

    if (pr.hardcore) {
      pr.dead = true;
      Save.write(pr);
      this.setState(ST.HARDCORE_DEAD);
      Sound.sfx('death');
      Sound.stopMusic();
      const el = document.getElementById('hcStats');
      if (el) {
        el.innerHTML =
          this._statLine('TÊN', pr.playerName) +
          this._statLine('STAGE', String(W.stage).padStart(2, '0')) +
          this._statLine('WAVE', String(W.wave).padStart(2, '0')) +
          this._statLine('KILLS', pr.statistics.kills) +
          this._statLine('LEVEL', W.player.level) +
          this._statLine('THỜI GIAN SỐNG', this._fmtTime(this.playTimer));
      }
      showScreen(ST.HARDCORE_DEAD);
      return;
    }

    this.setState(ST.GAME_OVER);
    Sound.sfx('death');
    Sound.stopMusic();

    const el = document.getElementById('goStats');
    if (el) {
      el.innerHTML =
        this._statLine('PLAYER', pr.playerName) +
        this._statLine('STAGE', String(W.stage).padStart(2, '0')) +
        this._statLine('WAVE', String(W.wave).padStart(2, '0')) +
        this._statLine('LEVEL', W.player.level) +
        this._statLine('KILLS', pr.statistics.kills) +
        this._statLine('CREDITS', W.player.credits) +
        this._statLine('TIME', this._fmtTime(this.playTimer));
    }

    const tokens = pr.inventory.consumables.revive_token || 0;
    const btn = document.getElementById('goRevive');
    if (btn) {
      btn.disabled = tokens <= 0;
      btn.textContent = tokens > 0
        ? 'REVIVE (' + tokens + ' TOKEN)'
        : 'KHÔNG CÓ REVIVE TOKEN';
    }
    showScreen(ST.GAME_OVER);
  },

  revive() {
    const pr = this.profile;
    const inv = pr.inventory.consumables;
    if (!inv.revive_token || inv.revive_token <= 0) return;

    inv.revive_token--;
    const W = this.world;
    const p = W.player;
    p.hp = p.maxHp * .55;
    p.alive = true;
    p.invuln = 2.5;

    W.enemies.forEach((e) => {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < 220) {
        const a = Math.atan2(e.y - p.y, e.x - p.x);
        e.kx += Math.cos(a) * 600;
        e.ky += Math.sin(a) * 600;
      }
    });

    Fx.ring(W.particles, p.x, p.y, '#39ff9e', 200, .8);
    Sound.sfx('levelup');
    this.setState(this._prevState || ST.PLAYING);
    hideAllScreens();
    this.paused = false;
    addToast('HỒI SINH!');
    this.updateHUD();
    Save.auto(this.profile);
  },

  enterWatchMode() {
    if (!this.world) return;
    this.watchMode = true;
    this.paused = false;
    this.setState(ST.WATCH_MODE);
    hideAllScreens();
    addToast('CHẾ ĐỘ THEO DÕI — ESC ĐỂ THOÁT');
  },

  /* =========================================================
     EVENT POPUP
     ========================================================= */
  maybeRandomEvent() {
    const W = this.world;
    if (!W || W.wave < 3) return;
    if (this._eventWave === W.wave) return;
    if (this.state !== ST.PLAYING) return;
    if (Math.random() > 0.22) return;

    this._eventWave = W.wave;
    this.paused = true;
    this._prevState = this.state;
    this.setState(ST.EVENT);

    const texts = [
      'Một tín hiệu lạ đang phát ra từ khu vực gần đây...',
      'Có thứ gì đó đang di chuyển trong bóng tối...',
      'Một khoang chứa bí ẩn đang mở ra...',
      'Tín hiệu không xác định. Có thể là kho báu. Có thể là bẫy.'
    ];
    const el = document.getElementById('eventDesc');
    if (el) el.textContent = texts[Math.floor(Math.random() * texts.length)];
    showScreen(ST.EVENT);
    Sound.sfx('event');
  },

  resolveEvent(investigate) {
    const W = this.world;
    this.setState(this._prevState || ST.PLAYING);
    hideAllScreens();
    this.paused = false;

    if (!investigate || !W) return;

    const roll = Math.random();
    const p = W.player;

    if (roll < .32) {
      const cr = Math.round(200 * W.stage * (1 + W.wave * .1));
      p.credits += cr;
      this.profile.statistics.creditsEarned += cr;
      addToast('ĐIỀU TRA: +' + cr + ' CREDITS');
      Sound.sfx('chest');
    } else if (roll < .52) {
      /* Spawn 2 elite ngẫu nhiên từ pool stage */
      import('./enemy.js').then(({ spawnEnemy }) => {
        const pool = getStage(W.stage).pool;
        for (let i = 0; i < 2; i++) {
          const type = pool[Math.floor(Math.random() * pool.length)];
          spawnEnemy(this, W, type,
            p.x + (Math.random() - .5) * 400,
            p.y + (Math.random() - .5) * 400, true);
        }
      });
      addToast('⚠ PHỤC KÍCH! ELITE XUẤT HIỆN');
      Sound.sfx('warning');
    } else if (roll < .70) {
      spawnChest(W,
        p.x + (Math.random() - .5) * 240,
        p.y + (Math.random() - .5) * 240,
        Math.random() < .3 ? 'rare' : 'common');
      addToast('PHÁT HIỆN RƯƠNG!');
      Sound.sfx('chest');
    } else if (roll < .84) {
      const dmg = Math.round(p.maxHp * .18);
      p.hp = Math.max(1, p.hp - dmg);
      addToast('⚠ BẪY! -' + dmg + ' HP');
      Sound.sfx('playerHit');
      W.camera.shake = 10;
    } else {
      p.shards += 1;
      addToast('◆ +1 VOID SHARD');
      Sound.sfx('chest');
    }

    this.updateHUD();
    this.syncProfileFromWorld();
    Save.auto(this.profile);
  },

  /* =========================================================
     TUTORIAL
     ========================================================= */
  showTutorial() {
    const el = document.getElementById('tutorial');
    if (el) el.classList.add('on');
    this.paused = true;
  },
  closeTutorial() {
    const el = document.getElementById('tutorial');
    if (el) el.classList.remove('on');
    Settings.set('tutorial', false);
    this.paused = false;
  },

  /* =========================================================
     DEBUG
     ========================================================= */
  toggleDebug() {
    this.debug = !this.debug;
    const el = document.getElementById('debugPanel');
    if (el) el.classList.toggle('on', this.debug);
  },

  updateDebugPanel() {
    const W = this.world;
    const el = document.getElementById('debugPanel');
    if (!el) return;
    el.textContent =
      'VNXX DEBUG (F3)\n' +
      'FPS: ' + this.fps.toFixed(1) + '\n' +
      'STATE: ' + this.state + '\n' +
      (window.VNXXNet ? 'NET: ' + window.VNXXNet.mode + '\n' : '') +
      'ENTITIES: ' + (W ? (W.enemies.length + W.projectiles.length + W.loot.length + W.particles.length + W.chests.length) : 0) + '\n' +
      'ENEMIES: ' + (W ? W.enemies.length : 0) + '\n' +
      'PROJECTILES: ' + (W ? W.projectiles.length : 0) + '\n' +
      'PARTICLES: ' + (W ? W.particles.length : 0) + '\n' +
      (W ? 'PLAYER: ' + W.player.x.toFixed(0) + ',' + W.player.y.toFixed(0) +
           '\nWAVE: ' + W.wave + ' / STAGE ' + W.stage : '') + '\n' +
      'MEM~: ' + (performance.memory
        ? Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB'
        : 'n/a') + '\n' +
      '\nCOMMANDS: VNXX.cmd.god() | givecash | givexp | spawn | killall | nextwave';
  },

  debugInfo() {
    const p = this.profile;
    const w = this.world;
    return [
      '=== VNXX DEBUG INFO ===',
      'Browser: ' + navigator.userAgent,
      'Resolution: ' + window.innerWidth + 'x' + window.innerHeight +
        ' (dpr ' + window.devicePixelRatio + ')',
      'FPS: ' + this.fps.toFixed(1),
      'State: ' + this.state,
      'Player: ' + (p ? p.playerName : '-'),
      'Difficulty: ' + (p ? p.difficulty : '-'),
      'Stage: ' + (p ? p.currentStage : '-') + '  Wave: ' + (p ? p.currentWave : '-'),
      'Level: ' + (p ? p.level : '-'),
      'Seed: ' + (p ? p.seed : '-'),
      'Entities: ' + (w ? (w.enemies.length + w.projectiles.length + w.particles.length) : 0),
      'Build: v1.0.001'
    ].join('\n');
  },

  /* =========================================================
     HUD / PROFILE SYNC
     ========================================================= */
  updateHUD() {
    updateHUDImpl(this, this.world);
  },

  syncProfileFromWorld() {
    syncProfileImpl(this);
  },

  checkAchievements() {
    checkAchievementsImpl(this);
  },

  /* =========================================================
     STAT LINE HELPER
     ========================================================= */
  _statLine(k, v) {
    return '<div class="stat-line"><span>' + k + '</span><span>' + v + '</span></div>';
  }
};

/* =========================================================
   CROSS-MODULE HOOKS
   ========================================================= */

Game.onBossDefeated = function () {
  onBossDefeatedImpl(this);
};

Game.showStageClear = function () {
  showStageClearImpl(this);
};

Game.nextStage = function () {
  nextStageImpl(this);
};

Game.levelUp = function () {
  showLevelUp(this, this.world);
};

Game.addXp = function (amount) {
  addXpImpl(this, this.world, amount);
};

Game.queueLevelUp = function () {
  queueLevelUp(this);
};

Game.damageEnemy = function (e, dmg, crit, source, knockback) {
  damageEnemyImpl(this, this.world, e, dmg, crit, source, knockback);
};

Game.killEnemy = function (e) {
  killEnemyImpl(this, this.world, e);
};

Game.updateBoss = function (b, dt) {
  updateBoss(this, this.world, b, dt);
};

Game.spawnBoss = function (name) {
  spawnBoss(this, this.world, name);
};

Game.completeWave = function () {
  completeWave(this, this.world);
};

Game.startWave = function (n) {
  startWave(this, this.world, n);
};

Game.openChest = function (c) {
  openChest(this, this.world, c);
};

Game.moduleMods = function (profile) {
  return moduleMods(profile);
};

Game.xpForLevel = function (lv) {
  return xpForLevel(lv);
};

Game.showBossBar = function (name) {
  showBossBar(name);
};

Game.hideBossBar = function () {
  hideBossBar();
};

/* =========================================================
   EXPORT
   ========================================================= */
export default Game;