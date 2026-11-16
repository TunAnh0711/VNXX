/* =========================================================
   VNXX — DATA / STAGES
   5 stage: theme, layout map, pool quái, boss, hazard, lore.

   Field mới:
   - layout     : kiểu sinh map ('open' | 'rooms' | 'pillars' | 'maze' | 'arena')
   - hazards    : danh sách loại bẫy môi trường có thể xuất hiện
   - hazardRate : số lượng hazard
   - barrels    : số thùng nổ
   - crates     : số thùng tiếp tế
   - obstacleScale : độ dày đặc vật cản
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
    pool: ['drone', 'runner', 'swarm', 'shooter', 'flyer', 'turret'],
    music: 'abandoned',
    layout: 'rooms',
    hazards: ['tesla'],
    hazardRate: 3,
    barrels: 5,
    crates: 4,
    obstacleScale: 1.0,
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
    pool: ['drone', 'tank', 'shooter', 'exploder', 'runner', 'charger', 'turret', 'brute'],
    music: 'industrial',
    layout: 'pillars',
    hazards: ['lava', 'steam'],
    hazardRate: 5,
    barrels: 8,
    crates: 4,
    obstacleScale: 1.25,
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
    pool: ['runner', 'assassin', 'shooter', 'swarm', 'shield', 'sniper_unit', 'summoner', 'flyer'],
    music: 'neon',
    layout: 'maze',
    hazards: ['shockgrid', 'holo'],
    hazardRate: 5,
    barrels: 5,
    crates: 5,
    obstacleScale: 1.15,
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
    pool: ['tank', 'assassin', 'exploder', 'shield', 'shooter', 'burrower', 'brute', 'leech', 'splitter'],
    music: 'dead',
    layout: 'arena',
    hazards: ['voidrift', 'lava'],
    hazardRate: 6,
    barrels: 6,
    crates: 3,
    obstacleScale: 0.85,
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
    pool: ['drone', 'runner', 'tank', 'shooter', 'swarm', 'assassin', 'shield', 'exploder',
           'charger', 'sniper_unit', 'summoner', 'splitter', 'flyer', 'burrower', 'brute', 'leech', 'turret'],
    music: 'void',
    layout: 'open',
    hazards: ['voidrift', 'shockgrid', 'lava'],
    hazardRate: 7,
    barrels: 7,
    crates: 4,
    obstacleScale: 1.0,
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

export function getStage(id) {
  if (!id || id < 1) return STAGES[0];
  return STAGES[Math.min(id - 1, STAGES.length - 1)];
}

export function getStageByIndex(idx) {
  return STAGES[Math.max(0, Math.min(idx, STAGES.length - 1))];
}

export function isValidStage(id) {
  return Number.isInteger(id) && id >= 1 && id <= STAGES.length;
}

export function isLastStage(id) {
  return id >= STAGES.length;
}

export function isBossWave(stageId, wave) {
  const stage = getStage(stageId);
  return wave > stage.waves;
}

export function nextStage(id) {
  if (isLastStage(id)) return null;
  return getStage(id + 1);
}

export function stageMusic(id) {
  return getStage(id).music || 'game';
}
