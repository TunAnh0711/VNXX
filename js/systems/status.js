/* =========================================================
   VNXX — SYSTEMS / STATUS
   Hệ thống trạng thái (status effect) dùng chung cho enemy + player.
   Không import module gameplay nào → tránh circular dependency.
   Caller truyền callback damage vào tick().
   ========================================================= */

import { clamp } from '../core/utils.js';

/* =========================================================
   ĐỊNH NGHĨA TRẠNG THÁI
   - dot      : gây sát thương theo thời gian
   - slow     : hệ số giảm tốc độ di chuyển (0..1)
   - stop     : đứng yên hoàn toàn
   - amp      : tăng sát thương nhận vào (0..1)
   - chain    : đánh lan sang mục tiêu gần
   - stack    : cộng dồn tối đa maxStacks
   ========================================================= */
export const STATUS_DEFS = {
  burn: {
    id: 'burn',
    name: 'BURN',
    color: '#ff7a2f',
    dot: true,
    maxStacks: 5,
    baseDur: 3.2
  },
  poison: {
    id: 'poison',
    name: 'POISON',
    color: '#88ff00',
    dot: true,
    maxStacks: 5,
    baseDur: 4.5
  },
  bleed: {
    id: 'bleed',
    name: 'BLEED',
    color: '#ff3b52',
    dot: true,
    maxStacks: 8,
    baseDur: 2.8,
    onMove: true          // chảy máu mạnh hơn khi mục tiêu di chuyển
  },
  chill: {
    id: 'chill',
    name: 'CHILL',
    color: '#7fd8ff',
    slow: .38,
    maxStacks: 3,
    baseDur: 3.0
  },
  freeze: {
    id: 'freeze',
    name: 'FROZEN',
    color: '#c9f4ff',
    stop: true,
    maxStacks: 1,
    baseDur: 1.4
  },
  shock: {
    id: 'shock',
    name: 'SHOCK',
    color: '#ffe14d',
    amp: .12,
    chain: true,
    maxStacks: 3,
    baseDur: 3.4
  },
  weaken: {
    id: 'weaken',
    name: 'WEAK',
    color: '#b06bff',
    amp: .18,
    maxStacks: 4,
    baseDur: 4.0
  },
  corrode: {
    id: 'corrode',
    name: 'CORRODE',
    color: '#a0ff2b',
    amp: .10,
    maxStacks: 5,
    baseDur: 5.0
  }
};

export const STATUS_IDS = Object.keys(STATUS_DEFS);

/* =========================================================
   KHỞI TẠO
   ========================================================= */
export function ensureStatus(ent) {
  if (!ent.st) ent.st = Object.create(null);
  return ent.st;
}

export function clearStatus(ent) {
  ent.st = Object.create(null);
  ent.statusTint = null;
}

/* =========================================================
   ÁP DỤNG
   apply(ent, id, dur, power)
   - dur   : thời gian (giây), mặc định theo def
   - power : cường độ (dps gốc / hệ số)
   Trả về true nếu có thay đổi.
   ========================================================= */
export function applyStatus(ent, id, dur, power, src) {
  const def = STATUS_DEFS[id];
  if (!def || !ent) return false;
  if (ent.statusImmune && ent.statusImmune[id]) return false;

  const st = ensureStatus(ent);
  const cur = st[id];

  const d = dur != null ? dur : def.baseDur;
  const pw = power != null ? power : 1;

  if (cur) {
    cur.dur = Math.max(cur.dur, d);
    cur.stacks = Math.min(def.maxStacks, cur.stacks + 1);
    cur.power = Math.max(cur.power, pw);
    cur.src = src || cur.src;
  } else {
    st[id] = {
      id,
      dur: d,
      maxDur: d,
      stacks: 1,
      power: pw,
      src: src || null,
      tickAcc: 0
    };
  }

  /* freeze đồng bộ với flag cũ để tương thích code hiện tại */
  if (id === 'freeze') {
    ent.frozen = Math.max(ent.frozen || 0, st[id].dur);
  }

  ent.statusTint = def.color;
  return true;
}

/* =========================================================
   HỆ SỐ DI CHUYỂN
   ========================================================= */
export function moveMul(ent) {
  const st = ent.st;
  if (!st) return 1;

  if (st.freeze && st.freeze.dur > 0) return 0;

  let mul = 1;
  if (st.chill) {
    const def = STATUS_DEFS.chill;
    mul -= def.slow * Math.min(1, st.chill.stacks / def.maxStacks + .45);
  }
  return clamp(mul, 0, 1);
}

/* =========================================================
   HỆ SỐ TĂNG SÁT THƯƠNG NHẬN VÀO
   ========================================================= */
export function damageAmp(ent) {
  const st = ent.st;
  if (!st) return 1;

  let amp = 0;
  for (const id in st) {
    const def = STATUS_DEFS[id];
    if (!def || !def.amp) continue;
    const s = st[id];
    amp += def.amp * (1 + (s.stacks - 1) * .35);
  }

  if (ent.broken > 0) amp += .60;      // armor break
  return 1 + amp;
}

/* =========================================================
   ĐANG CÓ STATUS NÀO
   ========================================================= */
export function hasStatus(ent, id) {
  return !!(ent.st && ent.st[id] && ent.st[id].dur > 0);
}

export function statusList(ent) {
  const out = [];
  const st = ent.st;
  if (!st) return out;
  for (const id in st) {
    if (st[id].dur > 0) out.push(st[id]);
  }
  out.sort((a, b) => b.dur - a.dur);
  return out;
}

/* =========================================================
   TICK — gọi mỗi frame
   onDamage(dmg, src) : callback gây sát thương DOT
   Trả về tổng damage đã gây ra frame này.
   ========================================================= */
export function tickStatus(ent, dt, onDamage) {
  const st = ent.st;
  if (!st) return 0;

  let total = 0;
  let tint = null;

  for (const id in st) {
    const s = st[id];
    const def = STATUS_DEFS[id];
    if (!def) { delete st[id]; continue; }

    s.dur -= dt;

    /* --- DOT --- */
    if (def.dot && onDamage) {
      let dps = s.power * (1 + (s.stacks - 1) * .55);

      /* bleed nặng hơn khi mục tiêu đang chạy */
      if (def.onMove) {
        const sp = Math.hypot(ent.vx || 0, ent.vy || 0);
        dps *= 1 + Math.min(1, sp / 260) * .8;
      }

      s.tickAcc += dt;
      /* gom damage thành từng nhịp 0.4s cho đỡ spam số */
      if (s.tickAcc >= .4) {
        const dmg = dps * s.tickAcc;
        s.tickAcc = 0;
        total += dmg;
        onDamage(dmg, s.src);
      }
    }

    if (s.dur <= 0) delete st[id];
    else tint = def.color;
  }

  ent.statusTint = tint;

  /* freeze flag đồng bộ ngược */
  if (!st.freeze) ent.frozen = 0;

  return total;
}

/* =========================================================
   XOÁ MỘT STATUS
   ========================================================= */
export function removeStatus(ent, id) {
  if (ent.st && ent.st[id]) {
    delete ent.st[id];
    if (id === 'freeze') ent.frozen = 0;
  }
}

/* =========================================================
   TIỆN ÍCH: status từ weapon
   ========================================================= */
export function applyWeaponStatus(ent, w, src, mul = 1) {
  if (!w || !w.status) return;
  const s = w.status;
  if (s.chance != null && Math.random() > s.chance) return;
  applyStatus(ent, s.id, (s.dur || 3) * mul, (s.power || 1) * mul, src);
}

/* =========================================================
   BẢNG MÀU CHO RENDER
   ========================================================= */
export function statusColor(id) {
  return STATUS_DEFS[id] ? STATUS_DEFS[id].color : '#ffffff';
}

export default {
  STATUS_DEFS,
  STATUS_IDS,
  ensureStatus,
  clearStatus,
  applyStatus,
  moveMul,
  damageAmp,
  hasStatus,
  statusList,
  tickStatus,
  removeStatus,
  applyWeaponStatus,
  statusColor
};
