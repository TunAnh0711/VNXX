/* =========================================================
   VNXX — DATA / STAGES
   5 stage với đầy đủ theme, pool quái, boss, lore.
   Chỉnh balance / thêm stage → chỉ sửa file này.
   ========================================================= */

export const STAGES = [
  /* ===================== STAGE 1 ===================== */
  {
    id: 1,
    name: 'ABANDONED FACILITY',
    waves: 10,
    boss: 'SENTINEL PRIME',
    floor: '#080e15',
    grid: '#0f1e2b',
    wall: '#1a3145',
    accent: '#28e0ff',
    pool: ['drone', 'runner', 'swarm', 'shooter', 'slow_thrower'],
    music: 'game',
    lore: 'CƠ SỞ BỎ HOANG. HỆ THỐNG VẪN CÒN THỨC.'
  },

  /* ===================== STAGE 2 ===================== */
  {
    id: 2,
    name: 'INDUSTRIAL ZONE',
    waves: 10,
    boss: 'FORGE TITAN',
    floor: '#0d0a06',
    grid: '#241a0c',
    wall: '#3d2b12',
    accent: '#ffa53a',
    pool: ['drone', 'tank', 'shooter', 'exploder', 'runner', 'fire_spitter', 'kamikaze'],
    music: 'game',
    lore: 'KHU CÔNG NGHIỆP. LÒ PHẢN ỨNG CHƯA TẮT.'
  },

  /* ===================== STAGE 3 ===================== */
  {
    id: 3,
    name: 'NEON CITY',
    waves: 10,
    boss: 'GLITCH WRAITH',
    floor: '#0a0614',
    grid: '#1d1035',
    wall: '#331a5c',
    accent: '#ff2fd0',
    pool: ['runner', 'assassin', 'shooter', 'swarm', 'shield', 'ice_spitter', 'poison_bomber'],
    music: 'game',
    lore: 'THÀNH PHỐ NEON. TÍN HIỆU GIẢ ĐANG LAN TRUYỀN.'
  },

  /* ===================== STAGE 4 ===================== */
  {
    id: 4,
    name: 'DEAD SECTOR',
    waves: 10,
    boss: 'REAPER UNIT',
    floor: '#0b0b0b',
    grid: '#1c1c1c',
    wall: '#2e2e2e',
    accent: '#ff3b52',
    pool: ['tank', 'assassin', 'exploder', 'shield', 'shooter', 'shadow_assassin', 'fire_spitter', 'poison_bomber'],
    music: 'game',
    lore: 'KHU VỰC CHẾT. KHÔNG CÓ SỰ SỐNG. CHỈ CÓ THỨ ĐANG CHỜ.'
  },

  /* ===================== STAGE 5 ===================== */
  {
    id: 5,
    name: 'VOID CORE',
    waves: 10,
    boss: 'VOID REAPER',
    floor: '#06040e',
    grid: '#150a2e',
    wall: '#2a1150',
    accent: '#a06bff',
    pool: ['drone', 'runner', 'tank', 'shooter', 'swarm', 'assassin', 'shield', 'exploder', 'slow_thrower', 'fire_spitter', 'ice_spitter', 'poison_bomber', 'shadow_assassin', 'kamikaze'],
    music: 'boss',
    lore: 'LÕI HƯ KHÔNG. ĐIỂM KẾT THÚC CỦA MỌI THỨ.'
  }
];

/* =========================================================
   CONSTANTS
   ========================================================= */
export const STAGE_COUNT = STAGES.length;
export const LAST_STAGE_ID = STAGES[STAGES.length - 1].id;

/* =========================================================
   HELPERS
   ========================================================= */

/** Lấy stage theo id (1-based) hoặc clamp về stage cuối nếu vượt. */
export function getStage(id) {
  if (!id || id < 1) return STAGES[0];
  return STAGES[Math.min(id - 1, STAGES.length - 1)];
}

/** Lấy stage theo index 0-based. */
export function getStageByIndex(idx) {
  return STAGES[Math.max(0, Math.min(idx, STAGES.length - 1))];
}

/** Kiểm tra stage id có hợp lệ (trong khoảng 1..count). */
export function isValidStage(id) {
  return Number.isInteger(id) && id >= 1 && id <= STAGES.length;
}

/** Có phải stage cuối cùng (để hiển thị "kết thúc game"). */
export function isLastStage(id) {
  return id >= STAGES.length;
}

/** Wave có phải wave boss không. */
export function isBossWave(stageId, wave) {
  const stage = getStage(stageId);
  return wave > stage.waves;
}

/** Stage kế tiếp (null nếu đã cuối). */
export function nextStage(id) {
  if (isLastStage(id)) return null;
  return getStage(id + 1);
}

/** Nhạc nên phát cho stage (fallback 'game'). */
export function stageMusic(id) {
  return getStage(id).music || 'game';
}