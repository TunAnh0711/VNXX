/* =========================================================
   VNXX — DATA / WAVE EVENTS
   Sự kiện đặc biệt có thể xuất hiện ngẫu nhiên mỗi wave.
   Chỉnh balance → chỉ sửa file này.
   ========================================================= */

export const WAVE_EVENTS = {
  /* ===================== MÁU ===================== */
  BLOOD: {
    id: 'BLOOD',
    name: 'BLOOD WAVE',
    desc: 'Quái spawn cực nhanh',
    color: '#ff3b52',
    spawnMul: .45,      // nhân vào spawnInterval (nhỏ = spawn nhanh)
    countMul: 1.35      // nhân vào budget
  },

  /* ===================== ĐÔNG ===================== */
  SWARM: {
    id: 'SWARM',
    name: 'SWARM',
    desc: 'Rất nhiều quái yếu',
    color: '#ffe14d',
    spawnMul: .55,
    countMul: 1.7,
    forceType: 'swarm'  // ép pool = ['swarm']
  },

  /* ===================== ELITE ===================== */
  ELITE_HUNT: {
    id: 'ELITE_HUNT',
    name: 'ELITE HUNT',
    desc: 'Chỉ có Elite',
    color: '#a06bff',
    eliteOnly: true,    // không spawn thường, chỉ spawn elite
    countMul: .45,
    spawnMul: 1.5
  },

  /* ===================== MÔI TRƯỜNG ===================== */
  DARKNESS: {
    id: 'DARKNESS',
    name: 'DARKNESS',
    desc: 'Tầm nhìn giảm mạnh',
    color: '#5aa9ff',
    darkness: true      // render/draw-fx.js đọc flag này để vẽ vignette đen
  },

  LOW_GRAVITY: {
    id: 'LOW_GRAVITY',
    name: 'LOW GRAVITY',
    desc: 'Đạn bay chậm hơn 40%',
    color: '#39ff9e',
    lowGravity: true    // projectile speed * 0.6
  },

  /* ===================== KINH TẾ ===================== */
  SUPPLY: {
    id: 'SUPPLY',
    name: 'SUPPLY WAVE',
    desc: 'Ít quái, nhiều loot',
    color: '#ffc44d',
    countMul: .4,
    lootMul: 2.5        // nhân reward credits cuối wave
  }
};

/* =========================================================
   CONSTANTS
   ========================================================= */
export const WAVE_EVENT_IDS = Object.keys(WAVE_EVENTS);
export const WAVE_EVENT_COUNT = WAVE_EVENT_IDS.length;

/* =========================================================
   SPAWN RULES
   ========================================================= */
export const WAVE_EVENT_RULES = {
  /** Wave tối thiểu để event có thể xuất hiện. */
  minWave: 3,

  /** Xác suất roll được event khi vào wave mới (0..1). */
  chance: .34
};

/* =========================================================
   HELPERS
   ========================================================= */

/** Map id -> event object. */
export const WAVE_EVENT_BY_ID = { ...WAVE_EVENTS };

/** Lấy event theo id hoặc null. */
export function getWaveEvent(id) {
  return WAVE_EVENT_BY_ID[id] || null;
}

/** Random 1 event id, có thể loại trừ danh sách id (tránh trùng 2 wave liền). */
export function randomWaveEventId(exclude = []) {
  const pool = WAVE_EVENT_IDS.filter((id) => !exclude.includes(id));
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Quyết định có roll event cho wave này không.
 *  - wave: số wave hiện tại (1-based)
 *  - lastEventId: event của wave trước (để tránh trùng)
 *  Trả về event object hoặc null.
 */
export function rollWaveEvent(wave, lastEventId = null) {
  if (wave < WAVE_EVENT_RULES.minWave) return null;
  if (Math.random() >= WAVE_EVENT_RULES.chance) return null;

  const id = randomWaveEventId(lastEventId ? [lastEventId] : []);
  return id ? WAVE_EVENTS[id] : null;
}

/** Áp event vào tham số wave (budget + spawnInterval).
 *  Trả về object mới, không mutate input.
 *  - budget: tổng "cost" quái cần spawn
 *  - spawnInterval: giây giữa 2 lần spawn
 *  - event: WAVE_EVENTS[id] hoặc null
 */
export function applyWaveEvent({ budget, spawnInterval, event }) {
  const out = { budget, spawnInterval, lootMul: 1 };

  if (!event) return out;

  if (event.countMul) out.budget = Math.round(budget * event.countMul);
  if (event.spawnMul) out.spawnInterval = spawnInterval * event.spawnMul;
  if (event.lootMul)  out.lootMul = event.lootMul;

  // Guard: không để spawnInterval xuống quá thấp gây lag
  out.spawnInterval = Math.max(.05, out.spawnInterval);

  return out;
}

/** Lấy danh sách event id kèm theo màu (dùng cho debug/help). */
export function listWaveEvents() {
  return WAVE_EVENT_IDS.map((id) => ({
    id,
    name: WAVE_EVENTS[id].name,
    desc: WAVE_EVENTS[id].desc,
    color: WAVE_EVENTS[id].color
  }));
}