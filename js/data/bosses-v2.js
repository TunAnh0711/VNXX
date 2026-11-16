/* =========================================================
   VNXX — DATA / BOSSES V2
   Hệ thống boss mới: weighted random attacks + telegraph +
   state machine + phase shift.

   Cấu trúc file:
   - TELEGRAPH_MIN          — sàn thời gian báo đòn (fairness)
   - BOSS_PHASE_THRESHOLDS  — mốc % HP để chuyển phase
   - MOVE_AI                — enum cho moveAI
   - BOSSES_V2              — 5 boss với stats + attacks
   - Helpers                — getBossV2, getAttackPool, getPhase...

   Field của mỗi attack:
   - tier            0..3    độ khó mở khoá (0=DỄ, 3=HARDCORE)
   - minPhase        1..3    phase tối thiểu để dùng chiêu
   - telegraph       số giây báo trước khi bắn
   - duration        số giây chiêu kéo dài (0 = bắn tức thời)
   - recover         số giây boss đứng yên sau khi đánh (cửa sổ punish)
   - weight          trọng số random (số càng cao càng hay dùng)
   - run             tên hàm trong boss-attacks.js
   - telegraphType   loại hình vẽ báo hiệu (radial/line/circle/...)
   - oncePerPhase    true = chỉ dùng 1 lần trong mỗi phase
   - summon          (tùy chọn) cấu hình triệu hồi quái
   - sfx             (tùy chọn) tên SFX khi bắt đầu telegraph
   ========================================================= */

/* =========================================================
   CONSTANTS
   ========================================================= */

/** Sàn thời gian báo đòn — không bao giờ ngắn hơn 0.3s (fairness). */
export const TELEGRAPH_MIN = 0.3;

/** Mốc % HP để chuyển phase.
 *  Phase 1: hp > P2 (70%)
 *  Phase 2: P3 < hp <= P2 (35% - 70%)
 *  Phase 3: hp <= P3 (35%)
 */
export const BOSS_PHASE_THRESHOLDS = {
  P2: 0.70,
  P3: 0.35
};

/** Hệ số cooldown theo phase (nhân vào attackInterval). */
export const BOSS_PHASE_CD_MUL = {
  1: 1.0,
  2: 0.85,
  3: 0.7
};

/** Enum moveAI — boss di chuyển kiểu gì. */
export const MOVE_AI = {
  HOVER: 'hover',   // bay lơ lửng quanh player
  WALK:  'walk',    // đi bộ chậm
  BLINK: 'blink',   // teleport từng đợt
  ORBIT: 'orbit',   // quay vòng quanh player
  FLOAT: 'float'    // trôi nổi lên xuống
};

/* =========================================================
   MAIN DATA — 5 BOSS
   ========================================================= */

export const BOSSES_V2 = {

  /* =====================================================
     BOSS 1 — SENTINEL PRIME
     Robot canh gác, có laser sấy + drone hộ vệ + lockdown
     ===================================================== */
  'SENTINEL PRIME': {
    name: 'SENTINEL PRIME',

    /* --- Stats (giữ từ VNXX cũ) --- */
    hp: 3250,
    radius: 42,
    color: '#ff5a6e',
    speed: 58,
    xp: 280,
    credits: 900,

    /* --- Hệ thống mới --- */
    attackInterval: 2.4,
    moveAI: MOVE_AI.HOVER,
    preferredRange: 240,

    attacks: {
      /* Bắn hình quạt — chiêu cơ bản phase 1 */
      radialBurst: {
        tier: 0, minPhase: 1,
        telegraph: 0.6, duration: 0, recover: 1.2,
        weight: 3,
        run: 'radialBurst',
        telegraphType: 'radial',
        desc: 'Xả đạn hình quạt về phía player'
      },

      /* Tia sấy quét — chiêu kéo dài, cho player cơ hội né */
      laserSweep: {
        tier: 0, minPhase: 1,
        telegraph: 0.8, duration: 1.4, recover: 1.5,
        weight: 2,
        run: 'laserSweep',
        telegraphType: 'line',
        sfx: 'warning',
        desc: 'Tia laser quét ngang 90°'
      },

      /* Rải mìn từ tính quanh player */
      proximityMines: {
        tier: 0, minPhase: 1,
        telegraph: 0.7, duration: 2.2, recover: 1.1,
        weight: 2,
        run: 'voidMinefield',
        telegraphType: 'circle',
        sfx: 'skill',
        desc: 'Rải mìn nổ dây chuyền quanh player'
      },

      /* Ném đĩa nảy — ép player đổi hướng */
      discBounce: {
        tier: 0, minPhase: 1,
        telegraph: 0.45, duration: 1.6, recover: 1.0,
        weight: 2,
        run: 'boomerang',
        telegraphType: 'line',
        desc: 'Phóng đĩa xuyên mục tiêu rồi quay về'
      },

      /* Khoá mục tiêu — dồn player vào góc */
      targetLock: {
        tier: 0, minPhase: 2,
        telegraph: 0.7, duration: 1.2, recover: 1.3,
        weight: 2,
        run: 'execution',
        telegraphType: 'cone',
        sfx: 'warning',
        desc: 'Đánh dấu vị trí, 1.2s sau dội nuke'
      },

      /* Beam bám đuôi — buộc phải chạy liên tục */
      pulseBeam: {
        tier: 1, minPhase: 2,
        telegraph: 0.6, duration: 2.0, recover: 1.2,
        weight: 2,
        run: 'soulSiphon',
        telegraphType: 'line',
        sfx: 'charge',
        desc: 'Beam năng lượng bám theo player'
      },

      /* Triệu hồi drone hộ vệ — phase 2+ */
      shieldDrones: {
        tier: 1, minPhase: 2,
        telegraph: 0.6, duration: 0, recover: 1.0,
        weight: 1,
        run: 'summonMinions',
        telegraphType: 'circle',
        summon: {
          types: ['drone', 'shield'],
          count: { 2: 3, 3: 4 },
          spawnRadius: 140,
          eliteChance: 0.15
        },
        desc: 'Triệu hồi drone + shield hộ vệ'
      },

      /* Teleport sát lưng — phạt player đứng yên */
      phaseStep: {
        tier: 1, minPhase: 2,
        telegraph: 0.4, duration: 0, recover: 0.9,
        weight: 2,
        run: 'blinkStrike',
        telegraphType: 'point',
        desc: 'Dịch chuyển tới sát player và đánh'
      },

      /* Quá tải — xả đạn dày đặc phase 3 */
      overclockBarrage: {
        tier: 2, minPhase: 3,
        telegraph: 0.5, duration: 0, recover: 0.9,
        weight: 3,
        run: 'radialBurst',
        telegraphType: 'radial',
        desc: 'Quá tải: xả 3 loạt đạn liên tiếp'
      },

      /* ULTIMATE — Khoá arena, phase 3, dùng 1 lần/phase */
      lockdown: {
        tier: 3, minPhase: 3,
        telegraph: 1.0, duration: 3.0, recover: 2.0,
        weight: 1,
        run: 'lockdown',
        telegraphType: 'arena',
        oncePerPhase: true,
        sfx: 'boss',
        desc: 'Khoá arena 3s, xả đạn liên tục'
      }
    }
  },

  /* =====================================================
     BOSS 2 — FORGE TITAN
     Lò nung khổng lồ — địa chấn, phun dung nham, triệu hồi
     ===================================================== */
  'FORGE TITAN': {
    name: 'FORGE TITAN',

    hp: 5900,
    radius: 50,
    color: '#ffa53a',
    speed: 48,
    xp: 400,
    credits: 1300,

    attackInterval: 3.2,
    moveAI: MOVE_AI.WALK,
    preferredRange: 180,

    attacks: {
      /* Đập đất — sóng địa chấn */
      seismicSlam: {
        tier: 0, minPhase: 1,
        telegraph: 0.9, duration: 0.4, recover: 1.4,
        weight: 3,
        run: 'seismicSlam',
        telegraphType: 'circle',
        sfx: 'explosion',
        desc: 'Đập tay xuống đất, sóng lan ra'
      },

      /* Phun dung nham hình quạt */
      moltenSpray: {
        tier: 0, minPhase: 1,
        telegraph: 0.6, duration: 1.2, recover: 1.2,
        weight: 2,
        run: 'moltenSpray',
        telegraphType: 'radial',
        desc: 'Phun dung nham liên tục 1.2s'
      },

      /* Bắn tàn lửa hình quạt */
      emberSpray: {
        tier: 0, minPhase: 1,
        telegraph: 0.55, duration: 0, recover: 1.0,
        weight: 2,
        run: 'radialBurst',
        telegraphType: 'radial',
        desc: 'Bắn tàn lửa hình quạt'
      },

      /* Lao tới như cái đe — phase 2 */
      anvilCharge: {
        tier: 0, minPhase: 2,
        telegraph: 0.7, duration: 0.6, recover: 1.0,
        weight: 2,
        run: 'dashCharge',
        telegraphType: 'line',
        desc: 'Lao thẳng vào player'
      },

      /* Rải bom xỉ than — nổ theo dây chuyền */
      slagMines: {
        tier: 0, minPhase: 2,
        telegraph: 0.8, duration: 2.4, recover: 1.3,
        weight: 2,
        run: 'voidMinefield',
        telegraphType: 'circle',
        sfx: 'skill',
        desc: 'Rải bom xỉ nóng chảy quanh player'
      },

      /* Triệu hồi thợ lò — phase 2+ */
      forgeMinions: {
        tier: 0, minPhase: 2,
        telegraph: 0.5, duration: 0, recover: 1.0,
        weight: 1,
        run: 'summonMinions',
        telegraphType: 'circle',
        summon: {
          types: ['tank', 'exploder'],
          count: { 2: 2, 3: 3 },
          spawnRadius: 160,
          eliteChance: 0.2
        },
        desc: 'Triệu hồi tank + exploder'
      },

      /* Hố magma hút player */
      magmaWell: {
        tier: 1, minPhase: 2,
        telegraph: 0.8, duration: 2.2, recover: 1.3,
        weight: 2,
        run: 'gravityWell',
        telegraphType: 'circle',
        sfx: 'warning',
        desc: 'Tạo 3 hố magma hút player rồi nổ'
      },

      /* Xả than cháy hình quạt */
      cinderBarrage: {
        tier: 1, minPhase: 2,
        telegraph: 0.55, duration: 0, recover: 1.1,
        weight: 2,
        run: 'radialBurst',
        telegraphType: 'radial',
        desc: 'Xả than cháy hình quạt'
      },

      /* Lò nung phun tia — beam bám đuôi */
      furnaceBeam: {
        tier: 1, minPhase: 3,
        telegraph: 0.7, duration: 2.0, recover: 1.3,
        weight: 2,
        run: 'soulSiphon',
        telegraphType: 'line',
        sfx: 'charge',
        desc: 'Tia nhiệt bám theo player'
      },

      /* Nứt lò — khoá arena */
      furnaceLock: {
        tier: 2, minPhase: 3,
        telegraph: 0.9, duration: 2.5, recover: 1.6,
        weight: 1,
        run: 'lockdown',
        telegraphType: 'arena',
        sfx: 'warning',
        desc: 'Nứt lò: làm chậm + xả đạn liên tục'
      },

      /* ULTIMATE — Phun trào: 6 tia magma quét */
      eruption: {
        tier: 3, minPhase: 3,
        telegraph: 1.0, duration: 2.4, recover: 1.8,
        weight: 1,
        run: 'voidTendrils',
        telegraphType: 'radial',
        oncePerPhase: true,
        sfx: 'boss',
        desc: '6 tia magma phun trào quét toàn sân'
      }
    }
  },

  /* =====================================================
     BOSS 3 — GLITCH WRAITH
     Bóng ma glitch — nhanh, teleport, phase shift liên tục
     ===================================================== */
  'GLITCH WRAITH': {
    name: 'GLITCH WRAITH',

    hp: 5400,
    radius: 40,
    color: '#ff2fd0',
    speed: 92,
    xp: 520,
    credits: 1700,

    attackInterval: 1.8,
    moveAI: MOVE_AI.BLINK,
    preferredRange: 260,

    attacks: {
      /* Đâm dữ liệu — chiêu cơ bản */
      dataSpike: {
        tier: 0, minPhase: 1,
        telegraph: 0.45, duration: 0, recover: 0.9,
        weight: 3,
        run: 'radialBurst',
        telegraphType: 'radial',
        desc: 'Bắn loạt đạn dữ liệu'
      },

      /* Vùng ăn mòn — đặt bẫy quanh player */
      corruptionField: {
        tier: 0, minPhase: 1,
        telegraph: 0.8, duration: 0, recover: 1.0,
        weight: 2,
        run: 'placeHazards',
        telegraphType: 'circle',
        hazard: {
          count: { 1: 2, 2: 3, 3: 4 },
          radius: 60,
          lifetime: 5,
          damagePerSec: 15
        },
        desc: 'Đặt 3 vùng ăn mòn quanh player'
      },

      /* Nhảy frame — dash không thể đoán */
      frameSkip: {
        tier: 0, minPhase: 1,
        telegraph: 0.35, duration: 0, recover: 0.8,
        weight: 2,
        run: 'blinkStrike',
        telegraphType: 'point',
        desc: 'Teleport tới sát player và đánh'
      },

      /* Gói tin lỗi — mìn glitch nổ dây chuyền */
      packetBombs: {
        tier: 0, minPhase: 1,
        telegraph: 0.6, duration: 2.0, recover: 1.0,
        weight: 2,
        run: 'voidMinefield',
        telegraphType: 'circle',
        sfx: 'skill',
        desc: 'Rải gói tin lỗi phát nổ theo chuỗi'
      },

      /* Nhân bản tạm thời — phase 2+ */
      cloneCascade: {
        tier: 1, minPhase: 2,
        telegraph: 0.5, duration: 0, recover: 1.0,
        weight: 1,
        run: 'summonMinions',
        telegraphType: 'circle',
        summon: {
          types: ['assassin', 'runner'],
          count: { 2: 3, 3: 4 },
          spawnRadius: 120,
          eliteChance: 0.25
        },
        desc: 'Triệu hồi assassin + runner'
      },

      /* Beam nhiễu — bám theo player */
      echoBeam: {
        tier: 1, minPhase: 2,
        telegraph: 0.5, duration: 1.8, recover: 1.0,
        weight: 2,
        run: 'soulSiphon',
        telegraphType: 'line',
        sfx: 'charge',
        desc: 'Tia nhiễu bám theo player'
      },

      /* Lưỡi glitch bay vòng */
      phantomDisc: {
        tier: 1, minPhase: 2,
        telegraph: 0.4, duration: 1.5, recover: 0.9,
        weight: 2,
        run: 'boomerang',
        telegraphType: 'line',
        desc: 'Phóng lưỡi glitch xuyên rồi quay về'
      },

      /* Hố dữ liệu — hút player rồi nổ */
      packetWell: {
        tier: 1, minPhase: 2,
        telegraph: 0.7, duration: 2.0, recover: 1.1,
        weight: 2,
        run: 'gravityWell',
        telegraphType: 'circle',
        sfx: 'warning',
        desc: 'Tạo 3 hố dữ liệu hút player'
      },

      /* Xúc tu dữ liệu — 6 tia quét */
      dataTorrent: {
        tier: 2, minPhase: 3,
        telegraph: 0.7, duration: 2.0, recover: 1.2,
        weight: 2,
        run: 'voidTendrils',
        telegraphType: 'radial',
        desc: '6 tia dữ liệu quét loang'
      },

      /* ULTIMATE — Sập hệ thống */
      systemCrash: {
        tier: 3, minPhase: 3,
        telegraph: 0.6, duration: 2.0, recover: 1.0,
        weight: 1,
        run: 'systemCrash',
        telegraphType: 'arena',
        oncePerPhase: true,
        sfx: 'boss',
        desc: 'Glitch toàn map, xả đạn liên tục'
      }
    }
  },

  /* =====================================================
     BOSS 4 — REAPER UNIT
     Tử thần — dash chém, boomerang, tên lửa, hành quyết
     ===================================================== */
  'REAPER UNIT': {
    name: 'REAPER UNIT',

    hp: 7800,
    radius: 46,
    color: '#ff3b52',
    speed: 70,
    xp: 680,
    credits: 2200,

    attackInterval: 2.0,
    moveAI: MOVE_AI.ORBIT,
    preferredRange: 200,

    attacks: {
      /* Lao chém — cơ bản */
      scytheDash: {
        tier: 0, minPhase: 1,
        telegraph: 0.6, duration: 0.5, recover: 1.2,
        weight: 3,
        run: 'dashCharge',
        telegraphType: 'line',
        desc: 'Lao thẳng chém 1 nhát'
      },

      /* Boomerang lưỡi hái — bay vòng về */
      bladeBoomerang: {
        tier: 0, minPhase: 1,
        telegraph: 0.4, duration: 1.6, recover: 1.0,
        weight: 2,
        run: 'boomerang',
        telegraphType: 'line',
        desc: 'Phóng lưỡi hái bay đi rồi quay về'
      },

      /* Lưỡi hái oán linh — 6 tia quét */
      harvestTendrils: {
        tier: 0, minPhase: 2,
        telegraph: 0.6, duration: 2.0, recover: 1.2,
        weight: 2,
        run: 'voidTendrils',
        telegraphType: 'radial',
        desc: '6 lưỡi oán linh quét loang'
      },

      /* Xương nhọn — xả đạn hình quạt */
      boneSpikes: {
        tier: 0, minPhase: 1,
        telegraph: 0.5, duration: 0, recover: 0.9,
        weight: 2,
        run: 'radialBurst',
        telegraphType: 'radial',
        desc: 'Xả xương nhọn hình quạt'
      },

      /* Tên lửa tầm nhiệt — phase 2+ */
      homingMissiles: {
        tier: 0, minPhase: 2,
        telegraph: 0.5, duration: 0, recover: 1.1,
        weight: 2,
        run: 'homingMissiles',
        telegraphType: 'point',
        projectile: {
          count: { 2: 3, 3: 5 },
          speed: 280,
          turnRate: 2.5,
          damage: 22
        },
        desc: 'Bắn 3-5 tên lửa đuổi theo'
      },

      /* Beam hút sinh mệnh */
      soulSiphon: {
        tier: 1, minPhase: 2,
        telegraph: 0.5, duration: 1.8, recover: 1.1,
        weight: 2,
        run: 'soulSiphon',
        telegraphType: 'line',
        sfx: 'charge',
        desc: 'Tia hút sinh lực bám theo player'
      },

      /* Mộ phần — rải mìn quanh player */
      graveMines: {
        tier: 1, minPhase: 2,
        telegraph: 0.6, duration: 2.2, recover: 1.1,
        weight: 1,
        run: 'voidMinefield',
        telegraphType: 'circle',
        sfx: 'skill',
        desc: 'Rải mộ phần phát nổ dây chuyền'
      },

      /* ULTIMATE — Hành quyết */
      execution: {
        tier: 1, minPhase: 3,
        telegraph: 0.6, duration: 1.2, recover: 1.4,
        weight: 2,
        run: 'execution',
        telegraphType: 'cone',
        oncePerPhase: true,
        sfx: 'warning',
        desc: 'Đánh dấu player, 1.2s sau kết liễu'
      },

      /* Hố âm ty — hút player */
      soulWell: {
        tier: 2, minPhase: 2,
        telegraph: 0.7, duration: 2.0, recover: 1.2,
        weight: 2,
        run: 'gravityWell',
        telegraphType: 'circle',
        sfx: 'warning',
        desc: 'Tạo 3 hố âm ty hút player'
      },

      /* Tử ảnh — teleport sát lưng */
      deathStep: {
        tier: 2, minPhase: 3,
        telegraph: 0.35, duration: 0, recover: 0.9,
        weight: 2,
        run: 'blinkStrike',
        telegraphType: 'point',
        desc: 'Tử ảnh teleport sát player'
      },

      /* Lưỡi hái chữ thập xoay */
      scytheCross: {
        tier: 2, minPhase: 3,
        telegraph: 0.8, duration: 2.5, recover: 1.4,
        weight: 2,
        run: 'voidCross',
        telegraphType: 'cross',
        desc: '4 lưỡi hái chữ thập xoay'
      },

      /* Tân tinh — xả đạn dày đặc */
      deathNova: {
        tier: 3, minPhase: 3,
        telegraph: 0.5, duration: 0, recover: 1.0,
        weight: 2,
        run: 'radialBurst',
        telegraphType: 'radial',
        desc: 'Tân tinh: xả đạn toàn hướng'
      }
    }
  },

  /* =====================================================
     BOSS 5 — VOID REAPER
     Chúa tể hư không — hố đen, cross, event horizon
     ===================================================== */
  'VOID REAPER': {
    name: 'VOID REAPER',

    hp: 8600,
    radius: 52,
    color: '#a06bff',
    speed: 78,
    xp: 950,
    credits: 3200,

    attackInterval: 2.6,
    moveAI: MOVE_AI.FLOAT,
    preferredRange: 220,

    attacks: {
      /* Hố đen hút — chiêu đặc trưng */
      singularity: {
        tier: 0, minPhase: 1,
        telegraph: 1.0, duration: 2.2, recover: 1.2,
        weight: 2,
        run: 'singularity',
        telegraphType: 'circle',
        sfx: 'warning',
        desc: 'Tạo hố đen hút player 1.8s rồi nổ'
      },

      /* Dash gặt lúa */
      harvestDash: {
        tier: 0, minPhase: 1,
        telegraph: 0.6, duration: 0.5, recover: 1.2,
        weight: 2,
        run: 'dashCharge',
        telegraphType: 'line',
        desc: 'Lao nhanh qua player'
      },

      /* Xúc tu hư không — 6 tia quét */
      voidTendrils: {
        tier: 0, minPhase: 1,
        telegraph: 0.7, duration: 2.4, recover: 1.3,
        weight: 2,
        run: 'voidTendrils',
        telegraphType: 'radial',
        desc: '6 xúc tu hư không quét loang'
      },

      /* Tân tinh hư không — xả đạn toàn hướng */
      voidNova: {
        tier: 0, minPhase: 1,
        telegraph: 0.55, duration: 0, recover: 1.1,
        weight: 2,
        run: 'radialBurst',
        telegraphType: 'radial',
        desc: 'Xả đạn hư không toàn hướng'
      },

      /* Void cross — phase 2+ */
      voidCross: {
        tier: 0, minPhase: 2,
        telegraph: 0.8, duration: 2.5, recover: 1.4,
        weight: 2,
        run: 'voidCross',
        telegraphType: 'cross',
        desc: 'Bắn 4 tia chữ thập xoay'
      },

      /* Hố trọng lực — nhiều hố đen nhỏ */
      gravityWell: {
        tier: 1, minPhase: 2,
        telegraph: 0.8, duration: 2.2, recover: 1.3,
        weight: 2,
        run: 'gravityWell',
        telegraphType: 'circle',
        sfx: 'warning',
        desc: 'Tạo 3-5 hố trọng lực hút rồi nổ'
      },

      /* Bãi mìn hư không */
      voidMinefield: {
        tier: 1, minPhase: 2,
        telegraph: 0.7, duration: 2.4, recover: 1.2,
        weight: 1,
        run: 'voidMinefield',
        telegraphType: 'circle',
        sfx: 'skill',
        desc: 'Rải mìn hư không nổ dây chuyền'
      },

      /* Beam hút linh hồn */
      soulSiphon: {
        tier: 1, minPhase: 2,
        telegraph: 0.6, duration: 2.0, recover: 1.2,
        weight: 2,
        run: 'soulSiphon',
        telegraphType: 'line',
        sfx: 'charge',
        desc: 'Beam hư không bám theo player'
      },

      /* Rách không gian — teleport sát lưng */
      riftBlink: {
        tier: 1, minPhase: 2,
        telegraph: 0.35, duration: 0, recover: 0.9,
        weight: 2,
        run: 'blinkStrike',
        telegraphType: 'point',
        desc: 'Xé không gian, teleport tới sát player'
      },

      /* Triệu hồi lính hư không */
      voidSpawn: {
        tier: 2, minPhase: 2,
        telegraph: 0.5, duration: 0, recover: 1.1,
        weight: 1,
        run: 'summonMinions',
        telegraphType: 'circle',
        summon: {
          types: ['flyer', 'leech'],
          count: { 2: 3, 3: 4 },
          spawnRadius: 150,
          eliteChance: 0.3
        },
        desc: 'Triệu hồi flyer + leech hư không'
      },

      /* Sụp đổ sao — glitch toàn sân */
      collapsingStar: {
        tier: 2, minPhase: 3,
        telegraph: 0.7, duration: 2.0, recover: 1.2,
        weight: 2,
        run: 'systemCrash',
        telegraphType: 'arena',
        sfx: 'warning',
        desc: 'Sụp đổ: xả đạn từ khắp sân'
      },

      /* ULTIMATE — Chân trời sự kiện */
      eventHorizon: {
        tier: 3, minPhase: 3,
        telegraph: 1.0, duration: 4.0, recover: 2.0,
        weight: 1,
        run: 'eventHorizon',
        telegraphType: 'arena',
        oncePerPhase: true,
        sfx: 'boss',
        desc: 'Thu nhỏ map dần về tâm, xả đạn liên tục'
      }
    }
  }
};

/* =========================================================
   HELPERS
   ========================================================= */

/** Lấy boss theo tên hoặc null. */
export function getBossV2(name) {
  return BOSSES_V2[name] || null;
}

/** Lấy attack theo id, trả về null nếu không có. */
export function getBossAttack(bossName, attackId) {
  const boss = BOSSES_V2[bossName];
  if (!boss) return null;
  return boss.attacks[attackId] || null;
}

/** Tính phase (1..3) từ % HP còn lại. */
export function getBossPhase(hp, maxHp) {
  const r = hp / Math.max(1, maxHp);
  const T = BOSS_PHASE_THRESHOLDS;
  if (r <= T.P3) return 3;
  if (r <= T.P2) return 2;
  return 1;
}

/** Danh sách boss name (dùng cho debug). */
export const BOSS_V2_NAMES = Object.keys(BOSSES_V2);

/**
 * Lấy pool attack khả dụng của boss.
 * Lọc theo: tier mở khoá, phase hiện tại, oncePerPhase đã dùng.
 *
 * @param {object} boss           — boss object (có .attacks)
 * @param {number} phase          — phase hiện tại 1..3
 * @param {number} maxTier        — độ khó mở khoá tối đa (0..3)
 * @param {Set<string>} usedOnce  — tập "attackId:phase" đã dùng
 * @returns {Array<[id, attackDef]>}
 */
export function getAttackPool(boss, phase, maxTier, usedOnce) {
  const out = [];
  if (!boss || !boss.attacks) return out;

  for (const [id, atk] of Object.entries(boss.attacks)) {
    if (atk.tier > maxTier) continue;
    if (phase < (atk.minPhase || 1)) continue;
    if (atk.oncePerPhase && usedOnce && usedOnce.has(id + ':' + phase)) {
      continue;
    }
    out.push([id, atk]);
  }
  return out;
}

/**
 * Weighted random pick từ pool.
 * Trả về [id, attackDef] hoặc null nếu pool rỗng.
 */
export function pickWeightedAttack(pool) {
  if (!pool || pool.length === 0) return null;

  let total = 0;
  for (const [, atk] of pool) total += atk.weight;

  let r = Math.random() * total;
  for (const entry of pool) {
    r -= entry[1].weight;
    if (r <= 0) return entry;
  }
  return pool[0];
}