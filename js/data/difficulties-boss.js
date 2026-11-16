/* =========================================================
   VNXX — DATA / DIFFICULTIES BOSS
   Độ khó RIÊNG cho boss (khác với DIFFICULTIES trong core/constants).

   Core DIFFICULTIES quy định: hp, dmg, speed, spawnInterval...
   cho quái và world.

   File này quy định hệ số combat của BOSS:
   - Nhịp đánh (cdMul)
   - Thời gian báo đòn (telegraphMul)
   - Cửa sổ punish (recoverMul)
   - Đạn (speed, count)
   - Chiêu mở khoá (extraPatternTier)

   ⚠️ Bảng Excel nguồn dữ liệu:
   | Boss           | DỄ           | TB          | KHÓ         | HC          |
   |----------------|--------------|-------------|-------------|-------------|
   | SENTINEL       | 3.8s / 0.96s | 2.4s / 0.6s | 1.7s / .48s | 1.2s / .39s |
   | FORGE TITAN    | 5.1s / 1.44s | 3.2s / 0.9s | 2.3s / .72s | 1.6s / .59s |
   | GLITCH WRAITH  | 2.9s / 0.72s | 1.8s / .45s | 1.3s / .36s | 0.9s / .30s |
   | REAPER UNIT    | 3.2s / 0.96s | 2.0s / 0.6s | 1.4s / .48s | 1.0s / .39s |
   | VOID REAPER    | 4.2s / 1.28s | 2.6s / 0.8s | 1.9s / .64s | 1.3s / .52s |

   VD: SENTINEL DỄ = 3.8s giữa 2 đòn / 0.96s báo đòn.
       → base.attackInterval = 2.4s × cdMul 1.6 = 3.84s ✅
       → base.telegraphRadialBurst 0.6s × telegraphMul 1.6 = 0.96s ✅
   ========================================================= */

/* =========================================================
   MAIN TABLE
   ========================================================= */
export const BOSS_DIFFICULTIES = {

  /* ===================== DỄ ===================== */
  easy: {
    label: 'DỄ',

    /* Nhịp combat */
    cdMul: 1.6,              // khoảng cách giữa 2 đòn (cao = đánh chậm)
    telegraphMul: 1.6,       // thời gian báo hiệu (cao = dễ né)
    recoverMul: 1.4,         // thời gian hở sườn (cao = dễ punish)

    /* HP & damage */
    hpMul: 0.7,              // HP boss (nhân vào base.hp)
    dmgMul: 0.75,            // damage contact + projectile

    /* Đạn */
    bulletSpeedMul: 0.85,    // đạn bay chậm hơn
    bulletCountAdd: -4,      // giảm số đạn mỗi vòng

    /* Triệu hồi */
    minionIntervalMul: 1.6,  // summon chậm hơn

    /* Nâng cao */
    doubleCastChance: 0,     // không bao giờ đánh 2 chiêu liên tiếp
    extraPatternTier: 0      // chỉ dùng chiêu tier 0
  },

  /* ===================== TRUNG BÌNH ===================== */
  normal: {
    label: 'TRUNG BÌNH',

    cdMul: 1.0,
    telegraphMul: 1.0,
    recoverMul: 1.0,

    hpMul: 1.0,
    dmgMul: 1.0,

    bulletSpeedMul: 1.0,
    bulletCountAdd: 0,

    minionIntervalMul: 1.0,

    doubleCastChance: 0,
    extraPatternTier: 1
  },

  /* ===================== KHÓ ===================== */
  hard: {
    label: 'KHÓ',

    cdMul: 0.72,
    telegraphMul: 0.8,
    recoverMul: 0.75,

    hpMul: 1.45,
    dmgMul: 1.4,

    bulletSpeedMul: 1.15,
    bulletCountAdd: 4,

    minionIntervalMul: 0.75,

    doubleCastChance: 0.15,  // 15% cơ hội đánh 2 chiêu liên tiếp
    extraPatternTier: 2
  },

  /* ===================== HARDCORE ===================== */
  hardcore: {
    label: 'HARDCORE',

    cdMul: 0.5,
    telegraphMul: 0.65,
    recoverMul: 0.55,

    hpMul: 2.0,
    dmgMul: 1.75,

    bulletSpeedMul: 1.3,
    bulletCountAdd: 8,

    minionIntervalMul: 0.55,

    doubleCastChance: 0.3,   // 30% cơ hội đánh 2 chiêu liên tiếp
    extraPatternTier: 3
  }
};

/* =========================================================
   SAFE DEFAULTS
   ========================================================= */
export const BOSS_DIFFICULTY_FALLBACK = 'normal';

/* =========================================================
   HELPERS
   ========================================================= */

/**
 * Lấy bảng độ khó boss theo key.
 * Fallback về 'normal' nếu key không tồn tại.
 */
export function getBossDifficulty(key) {
  return BOSS_DIFFICULTIES[key] || BOSS_DIFFICULTIES[BOSS_DIFFICULTY_FALLBACK];
}

/**
 * Lấy label tiếng Việt của độ khó.
 */
export function getBossDifficultyLabel(key) {
  const d = getBossDifficulty(key);
  return d.label;
}

/**
 * So sánh độ khó — dùng cho UI hoặc achievement.
 * Trả về: 'easy' | 'normal' | 'hard' | 'hardcore' | null.
 */
export function getBossDifficultyTier(key) {
  return BOSS_DIFFICULTIES[key] ? key : null;
}

/**
 * Danh sách tất cả key độ khó.
 */
export const BOSS_DIFFICULTY_KEYS = Object.keys(BOSS_DIFFICULTIES);

/**
 * Debug — in ra bảng balance khi cần kiểm tra.
 */
export function listBossDifficulties() {
  return BOSS_DIFFICULTY_KEYS.map((key) => {
    const d = BOSS_DIFFICULTIES[key];
    return {
      key,
      label: d.label,
      cd: d.cdMul,
      tele: d.telegraphMul,
      rec: d.recoverMul,
      hp: d.hpMul,
      dmg: d.dmgMul
    };
  });
}