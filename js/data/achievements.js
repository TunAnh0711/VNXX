/* =========================================================
   VNXX — DATA / ACHIEVEMENTS
   Thành tích (unlock vĩnh viễn theo statistics của profile).
   Chỉnh balance → chỉ sửa file này.
   ========================================================= */

export const ACHIEVEMENTS = [
  /* ===================== KILLS ===================== */
  {
    id: 'first_blood',
    name: 'FIRST BLOOD',
    desc: 'Tiêu diệt 1 kẻ địch',
    icon: '🩸',
    test: (s) => (s.kills || 0) >= 1
  },
  {
    id: 'hunter',
    name: 'HUNTER',
    desc: 'Tiêu diệt 100 kẻ địch',
    icon: '🏹',
    test: (s) => (s.kills || 0) >= 100
  },
  {
    id: 'no_mercy',
    name: 'NO MERCY',
    desc: 'Tiêu diệt 1.000 kẻ địch',
    icon: '💀',
    test: (s) => (s.kills || 0) >= 1000
  },

  /* ===================== WAVES ===================== */
  {
    id: 'survivor',
    name: 'SURVIVOR',
    desc: 'Hoàn thành 10 wave',
    icon: '🛡',
    test: (s) => (s.wavesCleared || 0) >= 10
  },

  /* ===================== BOSSES ===================== */
  {
    id: 'boss_slayer',
    name: 'BOSS SLAYER',
    desc: 'Đánh bại boss đầu tiên',
    icon: '☠',
    test: (s) => (s.bossesKilled || 0) >= 1
  },
  {
    id: 'boss_hunter',
    name: 'BOSS HUNTER',
    desc: 'Đánh bại 3 boss',
    icon: '👑',
    test: (s) => (s.bossesKilled || 0) >= 3
  },

  /* ===================== KINH TẾ ===================== */
  {
    id: 'rich',
    name: 'RICH',
    desc: 'Kiếm tổng cộng 10.000 credits',
    icon: '💰',
    test: (s) => (s.creditsEarned || 0) >= 10000
  },

  /* ===================== LEVEL ===================== */
  {
    id: 'ascended',
    name: 'ASCENDED',
    desc: 'Đạt level 25',
    icon: '⭐',
    test: (s) => (s.highestLevel || 1) >= 25
  },

  /* ===================== COLLECTION ===================== */
  {
    id: 'collector',
    name: 'COLLECTOR',
    desc: 'Mở khóa 5 vũ khí',
    icon: '🎒',
    test: (s) => (s.weaponsUnlocked || 0) >= 5
  },

  /* ===================== HARDCORE ===================== */
  {
    id: 'hardcore',
    name: 'HARDCORE',
    desc: 'Hoàn thành 1 stage ở chế độ Hardcore',
    icon: '🔥',
    test: (s) => (s.hardcoreStages || 0) >= 1
  }
];

/* =========================================================
   CONSTANTS
   ========================================================= */
export const ACHIEVEMENT_IDS = ACHIEVEMENTS.map((a) => a.id);
export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.length;

/* =========================================================
   HELPERS
   ========================================================= */

/** Map id -> achievement. */
export const ACHIEVEMENT_BY_ID = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a])
);

/** Lấy achievement theo id hoặc null. */
export function getAchievement(id) {
  return ACHIEVEMENT_BY_ID[id] || null;
}

/** Kiểm tra 1 achievement đã pass chưa theo statistics. */
export function testAchievement(id, stats) {
  const a = ACHIEVEMENT_BY_ID[id];
  if (!a || typeof a.test !== 'function') return false;
  try {
    return !!a.test(stats || {});
  } catch (err) {
    console.warn('[Achievement] test failed:', id, err);
    return false;
  }
}

/** Trả về danh sách achievement MỚI mở khoá (chưa có trong unlockedIds).
 *  - stats: profile.statistics
 *  - unlockedIds: profile.achievements (mảng id đã mở)
 *  Trả về mảng achievement object.
 */
export function checkNewAchievements(stats, unlockedIds = []) {
  const out = [];
  for (const a of ACHIEVEMENTS) {
    if (unlockedIds.includes(a.id)) continue;
    if (testAchievement(a.id, stats)) out.push(a);
  }
  return out;
}

/** Đếm tiến độ 1 achievement dạng { current, target }.
 *  Nếu achievement không có `progress` → trả về null.
 *  (Đây là hook mở rộng, không bắt buộc dùng.)
 */
export function getProgress(id, stats) {
  const a = ACHIEVEMENT_BY_ID[id];
  if (!a || !a.progress) return null;
  const current = a.progress.stat ? (stats[a.progress.stat] || 0) : 0;
  return { current, target: a.progress.target || 1 };
}

/** Tỉ lệ hoàn thành tổng (0..1). */
export function completionRatio(unlockedIds = []) {
  if (ACHIEVEMENT_COUNT === 0) return 0;
  const valid = unlockedIds.filter((id) => ACHIEVEMENT_BY_ID[id]).length;
  return valid / ACHIEVEMENT_COUNT;
}