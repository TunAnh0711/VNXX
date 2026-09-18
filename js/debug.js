/* =========================================================
   VNXX — DEBUG
   Console commands: VNXX.cmd.*
   Cài đặt qua installDebugCommands() gọi từ main.js.
   ========================================================= */

import { ST } from './core/constants.js';
import { STAGES, getStage } from './data/stages.js';
import { ENEMIES } from './data/enemies.js';
import { WEAPONS } from './data/weapons.js';
import { UPGRADES } from './data/upgrades.js';
import { MODULES } from './data/modules.js';
import { CONSUMABLES } from './data/consumables.js';

/* =========================================================
   INSTALL DEBUG COMMANDS
   Gọi 1 lần bởi main.js sau khi Game.init()
   ========================================================= */
export function installDebugCommands() {
  window.VNXX = window.VNXX || {};

  const cmd = {
    /* =========================================================
       CHEAT — PLAYER
       ========================================================= */
    god() {
      const g = getGame();
      if (!g) return;
      g.godMode = !g.godMode;
      log('GOD MODE: ' + (g.godMode ? 'ON' : 'OFF'));
      return g.godMode;
    },

    givecash(n = 100000) {
      const g = getGame();
      if (!g || !g.world) return;
      g.world.player.credits += n;
      g.updateHUD();
      log('+' + n + ' CREDITS (total: ' + g.world.player.credits + ')');
    },

    giveshards(n = 100) {
      const g = getGame();
      if (!g || !g.world) return;
      g.world.player.shards += n;
      g.updateHUD();
      log('+' + n + ' SHARDS (total: ' + g.world.player.shards + ')');
    },

    givexp(n = 5000) {
      const g = getGame();
      if (!g || !g.world) return;
      g.addXp(n);
      log('+' + n + ' XP');
    },

    heal() {
      const g = getGame();
      if (!g || !g.world) return;
      g.world.player.hp = g.world.player.maxHp;
      g.updateHUD();
      log('HP đầy: ' + g.world.player.hp);
    },

    levelup(n = 1) {
      const g = getGame();
      if (!g || !g.world) return;
      const p = g.world.player;
      for (let i = 0; i < n; i++) {
        p.xp += p.xpNext;
      }
      // addXp(0) sẽ trigger level-up check
      g.addXp(0);
      log('+' + n + ' level');
    },

    /* =========================================================
       CHEAT — SPAWN / KILL
       ========================================================= */
    spawn(type = 'drone', n = 5, elite = false) {
      const g = getGame();
      if (!g || !g.world) return;

      const W = g.world;
      const p = W.player;

      if (!ENEMIES[type]) {
        log('Enemy type không tồn tại: ' + type);
        log('Types: ' + Object.keys(ENEMIES).join(', '));
        return;
      }

      let count = 0;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 200 + Math.random() * 200;
        const x = p.x + Math.cos(a) * r;
        const y = p.y + Math.sin(a) * r;

        // Dynamic import để tránh circular
        import('./game/enemy.js').then(({ spawnEnemy }) => {
          spawnEnemy(g, W, type, x, y, elite);
        });
        count++;
      }
      log('Spawn ' + count + 'x ' + type + (elite ? ' (ELITE)' : ''));
    },

    spawnboss(name = null) {
      const g = getGame();
      if (!g || !g.world) return;

      const W = g.world;
      const stage = getStage(W.stage);
      const bossName = name || stage.boss;

      import('./game/boss.js').then(({ spawnBoss }) => {
        spawnBoss(g, W, bossName);
        log('Spawn boss: ' + bossName);
      });
    },

    killall() {
      const g = getGame();
      if (!g || !g.world) return;

      const W = g.world;
      let count = 0;
      // Copy array vì killEnemy sẽ mutate
      const enemies = W.enemies.slice();
      enemies.forEach((e) => {
        if (!e.isBoss) {
          g.killEnemy(e);
          count++;
        }
      });
      log('Killed ' + count + ' enemies (boss bị bỏ qua)');
    },

    /* =========================================================
       CHEAT — WAVE / STAGE
       ========================================================= */
    nextwave() {
      const g = getGame();
      if (!g || !g.world) return;

      const W = g.world;
      W.enemies.length = 0;
      W.spawnQueue.length = 0;
      log('Cleared enemies + spawn queue → wave ' + W.wave + ' auto-complete');
    },

    skipwave() {
      const g = getGame();
      if (!g || !g.world) return;

      const W = g.world;
      g.startWave(W.wave + 1);
      log('Skip to wave ' + (W.wave));
    },

    setwave(n) {
      const g = getGame();
      if (!g || !g.world) return;
      if (!Number.isInteger(n) || n < 1) {
        log('Wave phải là số nguyên dương');
        return;
      }
      g.startWave(n);
      log('Set wave: ' + n);
    },

    setstage(n) {
      const g = getGame();
      if (!g || !g.profile) return;
      if (!Number.isInteger(n) || n < 1 || n > STAGES.length) {
        log('Stage phải từ 1 đến ' + STAGES.length);
        return;
      }
      g.profile.currentStage = n;
      g.profile.currentWave = 1;
      log('Set stage: ' + n + ' → restart run');
      g.startRun(g.profile, false);
    },

    /* =========================================================
       CHEAT — ITEMS
       ========================================================= */
    giveweapon(id) {
      const g = getGame();
      if (!g || !g.profile) return;

      if (!WEAPONS[id]) {
        log('Weapon không tồn tại: ' + id);
        log('IDs: ' + Object.keys(WEAPONS).join(', '));
        return;
      }

      const pr = g.profile;
      if (!pr.inventory.weapons.includes(id)) {
        pr.inventory.weapons.push(id);
      }
      if (!pr.unlockedWeapons.includes(id)) {
        pr.unlockedWeapons.push(id);
      }
      pr.statistics.weaponsUnlocked = pr.unlockedWeapons.length;
      pr.weapon = id;

      if (g.world) g.world.player.weaponId = id;

      log('Give weapon: ' + WEAPONS[id].name);
    },

    giveitem(id, n = 1) {
      const g = getGame();
      if (!g || !g.profile) return;

      if (!CONSUMABLES[id]) {
        log('Consumable không tồn tại: ' + id);
        log('IDs: ' + Object.keys(CONSUMABLES).join(', '));
        return;
      }

      const pr = g.profile;
      pr.inventory.consumables = pr.inventory.consumables || {};
      pr.inventory.consumables[id] =
        (pr.inventory.consumables[id] || 0) + n;

      log('+' + n + 'x ' + CONSUMABLES[id].name);
    },

    givemodule(id, n = 1) {
      const g = getGame();
      if (!g || !g.profile) return;

      if (!MODULES[id]) {
        log('Module không tồn tại: ' + id);
        log('IDs: ' + Object.keys(MODULES).join(', '));
        return;
      }

      const pr = g.profile;
      pr.inventory.modules = pr.inventory.modules || {};
      pr.inventory.modules[id] = (pr.inventory.modules[id] || 0) + n;

      log('+' + n + 'x ' + MODULES[id].name);
    },

    applyupgrade(id) {
      const g = getGame();
      if (!g || !g.world) return;

      const u = UPGRADES.find((x) => x.id === id);
      if (!u) {
        log('Upgrade không tồn tại: ' + id);
        log('IDs: ' + UPGRADES.map((x) => x.id).join(', '));
        return;
      }

      u.apply(g.world.player);
      g.updateHUD();
      log('Applied upgrade: ' + u.name);
    },

    /* =========================================================
       INFO
       ========================================================= */
    state() {
      const g = getGame();
      if (!g) return null;
      log('State: ' + g.state);
      return g.state;
    },

    info() {
      const g = getGame();
      if (!g || !g.world) {
        log('Không có world active');
        return;
      }

      const W = g.world;
      const p = W.player;
      const info = {
        state: g.state,
        stage: W.stage,
        wave: W.wave,
        level: p.level,
        hp: Math.round(p.hp) + '/' + p.maxHp,
        credits: p.credits,
        shards: p.shards,
        weapon: p.weaponId,
        enemies: W.enemies.length,
        projectiles: W.projectiles.length,
        particles: W.particles.length,
        loot: W.loot.length,
        chests: W.chests.length
      };
      console.table(info);
      return info;
    },

    help() {
      const list = [
        'god()                       - Bật/tắt god mode',
        'givecash(n=100000)          - Cộng credits',
        'giveshards(n=100)           - Cộng void shards',
        'givexp(n=5000)              - Cộng XP',
        'levelup(n=1)                - Lên level',
        'heal()                      - Hồi đầy máu',
        'spawn(type="drone",n=5)     - Spawn quái',
        'spawnboss(name?)            - Spawn boss hiện tại',
        'killall()                   - Kill toàn bộ quái thường',
        'nextwave()                  - Clear quái + queue',
        'skipwave()                  - Nhảy wave',
        'setwave(n)                  - Đặt wave',
        'setstage(n)                 - Đặt stage (1-5)',
        'giveweapon(id)              - Nhận vũ khí',
        'giveitem(id,n=1)            - Nhận consumable',
        'givemodule(id,n=1)          - Nhận module',
        'applyupgrade(id)            - Áp upgrade',
        'state()                     - Xem state',
        'info()                      - Xem thông tin world',
        'save()                      - Force save',
        'fps()                       - Xem FPS',
        'help()                      - Xem danh sách lệnh'
      ];
      console.log('%c=== VNXX DEBUG COMMANDS ===', 'color:#28e0ff;font-weight:bold');
      list.forEach((l) => console.log('  VNXX.cmd.' + l));
      return list;
    },

    /* =========================================================
       SAVE / FPS
       ========================================================= */
    save() {
      const g = getGame();
      if (!g || !g.profile) return;

      g.syncProfileFromWorld();
      if (window.VNXX?.Save) {
        window.VNXX.Save.auto(g.profile);
        log('Saved: ' + g.profile.playerName);
      }
    },

    fps() {
      const g = getGame();
      if (!g) return null;
      log('FPS: ' + g.fps.toFixed(1));
      return g.fps;
    },

    /* =========================================================
       UI HACKS
       ========================================================= */
    screen(key) {
      if (window.VNXX?.showScreen) {
        window.VNXX.showScreen(key);
        log('Show screen: ' + key);
      }
    },

    screenOff() {
      if (window.VNXX?.hideAllScreens) {
        window.VNXX.hideAllScreens();
        log('All screens hidden');
      }
    },

    /* =========================================================
       TOAST TEST
       ========================================================= */
    toast(msg = 'Test toast') {
      if (typeof window.addToast === 'function') {
        window.addToast(msg);
      } else {
        log(msg);
      }
    }
  };

  window.VNXX.cmd = cmd;

  /* Log sẵn hint lần đầu */
  console.log(
    '%c[VNXX] Debug commands installed. Gõ VNXX.cmd.help() để xem danh sách.',
    'color:#39ff9e'
  );

  return cmd;
}

/* =========================================================
   HELPERS
   ========================================================= */
function getGame() {
  return window.VNXX?.Game || null;
}

function log(msg) {
  console.log('%c[VNXX.cmd]', 'color:#ffc44d;font-weight:bold', msg);
}

/* =========================================================
   EXPORT DEFAULT
   ========================================================= */
export default { installDebugCommands };