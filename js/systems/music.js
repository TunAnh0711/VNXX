/* =========================================================
   VNXX — SYSTEMS / MUSIC (v3)
   Nhạc nền sinh bằng CÔNG THỨC TOÁN, không dùng file mp3.

   Ý tưởng: mỗi bài là một "lò phản ứng" — nhịp, cao độ, âm sắc
   và mật độ nốt đều được điều khiển bởi các hàm số:

     f(x) = 12e^(-8·mod(x, 1/2)) - 12     → đường bao phân rã
     w(x) = 24(1 - e^(-mod(x·0.4, 1)/0.5)) → ramp / saw mềm
     P(h) = P0 + ρgh                        → áp suất → cao độ
     N(t) = N0·2^(-t/T)                     → chu kỳ bán rã
     Φ(t) = sin²(πft)                       → thông lượng neutron
     R(f) = 1 / (1 + Q²(f-f0)²/f0²)         → cộng hưởng
     k(t) = 1/(1-k)                          → độ tới hạn

   Mười bài:
     neutron_flux · half_life · turbine · press_value · geiger
     rod_drop · warning · meltdown · criticality · resonance

   Mỗi bài có 2 "deck" để crossfade. Nhạc boss tự leo thang:
     warning → criticality → meltdown (theo % máu boss).
   ========================================================= */

/* =========================================================
   THƯ VIỆN CÔNG THỨC
   Tất cả trả về giá trị đã chuẩn hoá để dùng trực tiếp.
   ========================================================= */
export const F = {
  /* f(x) = 12e^(-8·mod(x,1/2)) - 12
     Chuẩn hoá về 0..1: 1 - e^(-8m). m = pha trong mỗi 1/2 chu kỳ. */
  decay(x, k = 8, period = .5) {
    const m = ((x % period) + period) % period;
    return 1 - Math.exp(-k * m);
  },

  /* w(x) = 24(1 - e^(-mod(x·0.4,1)/0.5)), chia 24 để về 0..1 */
  ramp(x) {
    const m = (((x * .4) % 1) + 1) % 1;
    return (24 * (1 - Math.exp(-m / .5))) / 24;
  },

  /* P(h) = P0 + ρgh — áp suất thuỷ tĩnh */
  pressure(h, p0 = 1, rho = 1, g = 9.81) {
    return p0 + rho * g * h;
  },

  /* N(t) = N0·2^(-t/T) — chu kỳ bán rã */
  halfLife(t, T = 2, n0 = 1) {
    return n0 * Math.pow(.5, t / T);
  },

  /* Φ(t) = sin²(πft) — thông lượng neutron */
  flux(t, f = .5) {
    const s = Math.sin(Math.PI * f * t);
    return s * s;
  },

  /* R(f) = 1/(1 + Q²(f-f0)²/f0²) — đỉnh cộng hưởng */
  resonance(f, f0, q = 6) {
    const d = (f - f0) / f0;
    return 1 / (1 + q * q * d * d);
  },

  /* k(t) = 1/(1-k) — hệ số nhân tới hạn (k → 1 thì bùng nổ) */
  criticality(k) {
    return Math.min(9, 1 / Math.max(.02, 1 - k));
  },

  /* Số sự kiện Poisson trong 1 bước — dùng cho geiger */
  poisson(lambda, rnd = Math.random) {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= rnd();
    } while (p > L);
    return k - 1;
  },

  /* Nội suy tuyến tính */
  lerp(a, b, t) { return a + (b - a) * t; },

  /* Kẹp */
  clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
};

/* =========================================================
   THANG ÂM
   ========================================================= */
const SCALE = {
  minor:     [0, 2, 3, 5, 7, 8, 10],
  dorian:    [0, 2, 3, 5, 7, 9, 10],
  phrygian:  [0, 1, 3, 5, 7, 8, 10],
  locrian:   [0, 1, 3, 5, 6, 8, 10],
  harmMinor: [0, 2, 3, 5, 7, 8, 11],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};

/* Bậc thang → nửa cung (tự động cộng quãng tám khi vượt) */
function deg(scale, i) {
  const n = scale.length;
  const o = Math.floor(i / n);
  const idx = ((i % n) + n) % n;
  return scale[idx] + o * 12;
}

function hz(root, semis) {
  return root * Math.pow(2, semis / 12);
}

/* =========================================================
   BẢNG BÀI NHẠC
   pat = 16 bước / ô nhịp. null = nghỉ. Số = bậc trong thang.
   ========================================================= */
export const TRACKS = {

  /* ---------------------------------------------------------
     1. NEUTRON FLUX — nhịp chính khi chơi
     Mật độ nốt do Φ(t)=sin² điều khiển, càng về cuối chu kỳ
     càng dày → cảm giác "thông lượng tăng".
     --------------------------------------------------------- */
  neutron_flux: {
    name: 'NEUTRON FLUX',
    bpm: 132,
    root: 55,                  // A1
    scale: SCALE.minor,
    pad: { chords: [[0, 3, 7], [0, 3, 7], [-2, 1, 5], [-4, 0, 3]], voice: 'pad', gain: .05, len: 1.02 },
    bass: {
      pat: [0, null, 0, null, 3, null, 0, null, 5, null, 3, null, 0, null, -2, null],
      voice: 'bass', gain: .20, len: .8
    },
    arp: {
      pat: [0, 7, 12, 7, 15, 12, 7, 12, 19, 12, 15, 7, 12, 19, 15, 12],
      voice: 'pluck', gain: .085, len: .55, oct: 12, every: 1
    },
    drums: {
      kick:  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
      hat:   [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1]
    },
    extra(eng, t, dur, step, i, bar, danger) {
      const tt = step * dur;
      const flux = F.flux(tt, .35);
      if (flux > .78 && i % 2 === 0) {
        eng.pluck(t + dur * .5, hz(55, 24 + deg(SCALE.minor, (step * 3) % 7)), dur * .35, .045, { type: 'square' });
      }
    }
  },

  /* ---------------------------------------------------------
     2. HALF_LIFE — menu / vùng chết
     Biên độ lead nhân N(t)=2^(-t/T): mỗi ô nhịp nhỏ dần đúng
     như chu kỳ bán rã, rồi được "nạp lại" ở ô thứ 4.
     --------------------------------------------------------- */
  half_life: {
    name: 'HALF-LIFE',
    bpm: 68,
    root: 55,
    scale: SCALE.phrygian,
    pad: {
      chords: [[0, 3, 7], [-2, 1, 5], [-4, 0, 3], [-5, -1, 2]],
      voice: 'pad', gain: .075, len: 1.04
    },
    bass: {
      pat: [0, null, null, null, null, null, null, null, -5, null, null, null, null, null, null, null],
      voice: 'sub', gain: .22, len: 1.4
    },
    lead: {
      pat: [12, null, null, 15, null, null, 10, null, null, null, 12, null, null, 8, null, null],
      voice: 'bell', gain: .10, len: 1.6
    },
    drums: {
      kick:  [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      snare: [],
      hat:   []
    },
    extra(eng, t, dur, step, i, bar) {
      /* chu kỳ bán rã: cứ 4 ô nhịp thì biên độ còn 1/2 */
      if (i === 0) {
        const amp = F.halfLife(bar % 4, 2, 1);
        eng.pluck(t, hz(55, 24 + deg(SCALE.phrygian, (bar * 2) % 7)), dur * 6, .06 * amp, { type: 'triangle' });
      }
    }
  },

  /* ---------------------------------------------------------
     3. TURBINE — khu công nghiệp
     Bộ lọc quét theo w(x)=24(1-e^(-mod(x·0.4,1)/0.5)) → tiếng
     tuabin quay đều rồi mở dần.
     --------------------------------------------------------- */
  turbine: {
    name: 'TURBINE',
    bpm: 118,
    root: 55,
    scale: SCALE.dorian,
    pad: { chords: [[0, 3, 7], [0, 3, 7]], voice: 'pad', gain: .035, len: 1.05 },
    bass: {
      pat: [0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 5, 5, 3, 0],
      voice: 'bass', gain: .19, len: .55
    },
    arp: {
      pat: [0, null, 7, null, 12, null, 7, null, 0, null, 7, null, 15, null, 12, null],
      voice: 'pluck', gain: .07, len: .5, oct: 12
    },
    drums: {
      kick:  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat:   [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1]
    },
    extra(eng, t, dur, step, i, bar) {
      const tt = step * dur;
      /* clank kim loại mỗi 4 ô nhịp */
      if (i === 8 && bar % 4 === 0) {
        eng.metal(t, hz(55, 24), .5, .07);
      }
      /* hơi nước xả — nhiễu quét */
      if (i === 0 && bar % 8 === 7) {
        eng.sweep(t, dur * 8, 600, 3200, .05);
      }
      /* cutoff tuabin theo w(x) */
      eng.setTurbine(t, F.ramp(tt));
    }
  },

  /* ---------------------------------------------------------
     4. PRESS_VALUE — áp suất tăng dần
     Cao độ = P(h) = P0 + ρgh với h chạy 0→1 trong 8 ô nhịp,
     sau đó xả về gốc. Nghe như đồng hồ áp suất bò lên.
     --------------------------------------------------------- */
  press_value: {
    name: 'PRESS VALUE',
    bpm: 128,
    root: 58,
    scale: SCALE.minor,
    pad: { chords: [[0, 3, 7], [0, 3, 7]], voice: 'pad', gain: .045, len: 1.03 },
    bass: {
      pat: [0, null, 0, 0, null, 0, null, 0, 0, null, 0, 0, null, 0, null, 0],
      voice: 'bass', gain: .19, len: .7
    },
    arp: {
      pat: [0, 7, 12, 15, 19, 15, 12, 7, 0, 7, 12, 15, 19, 15, 12, 7],
      voice: 'pluck', gain: .075, len: .45, oct: 12
    },
    drums: {
      kick:  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat:   [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1]
    },
    extra(eng, t, dur, step, i, bar) {
      /* P(h) = P0 + ρgh, h = vị trí trong chu kỳ 8 ô nhịp */
      const h = (bar % 8) / 8;
      const p = F.pressure(h, 1, 1, 9.81);          // 1 → 10.81
      const semis = Math.round((p - 1) * 1.9);       // 0 → ~19 nửa cung
      if (i % 4 === 0) {
        eng.pluck(t, hz(58, 12 + semis + deg(SCALE.minor, i / 4)), dur * 2.2, .05, { type: 'triangle' });
      }
      /* xả áp cuối chu kỳ */
      if (i === 0 && bar % 8 === 7) {
        eng.sweep(t, dur * 6, 3000, 400, .07);
      }
    }
  },

  /* ---------------------------------------------------------
     5. GEIGER — cơ sở bỏ hoang
     Tiếng tách rời rạc theo phân bố Poisson, chồng lên drone
     thấp. Càng nguy hiểm (danger cao) tần suất càng dày.
     --------------------------------------------------------- */
  geiger: {
    name: 'GEIGER',
    bpm: 92,
    root: 49,
    scale: SCALE.locrian,
    pad: { chords: [[0, 6, 7], [0, 6, 7]], voice: 'pad', gain: .06, len: 1.06 },
    bass: {
      pat: [0, null, null, null, null, null, null, null, null, null, -1, null, null, null, null, null],
      voice: 'sub', gain: .18, len: 1.6
    },
    drums: { kick: [], snare: [], hat: [] },
    extra(eng, t, dur, step, i, bar, danger) {
      /* λ tăng theo nguy hiểm → nhiều tách hơn */
      const lambda = .55 + danger * 1.6;
      const n = F.poisson(lambda);
      for (let k = 0; k < n && k < 4; k++) {
        const off = Math.random() * dur;
        eng.click(t + off, .055 + Math.random() * .05, 2400 + Math.random() * 2600);
      }
      /* thỉnh thoảng một tiếng kim loại rỉ */
      if (i === 0 && bar % 4 === 2) {
        eng.metal(t, hz(49, 19 + (bar % 3) * 2), 1.4, .05);
      }
    }
  },

  /* ---------------------------------------------------------
     6. RESONANCE — lõi hư không
     Chuông FM chọn hài theo R(f)=1/(1+Q²(f-f0)²/f0²):
     hài càng gần tần số cộng hưởng thì càng to.
     --------------------------------------------------------- */
  resonance: {
    name: 'RESONANCE',
    bpm: 84,
    root: 41,
    scale: SCALE.harmMinor,
    pad: { chords: [[0, 3, 7], [0, 4, 7], [0, 3, 6], [0, 3, 7]], voice: 'pad', gain: .08, len: 1.05 },
    bass: {
      pat: [0, null, null, null, null, null, null, null, 0, null, null, null, -2, null, null, null],
      voice: 'sub', gain: .2, len: 1.5
    },
    lead: {
      pat: [12, null, 19, null, null, 24, null, null, 17, null, null, 22, null, null, null, null],
      voice: 'bell', gain: .09, len: 2.2
    },
    drums: {
      kick:  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      snare: [],
      hat:   []
    },
    extra(eng, t, dur, step, i, bar) {
      if (i === 0) {
        /* chọn hài cộng hưởng: n ∈ 1..8, trọng số R(n, n0, Q) */
        let best = 1;
        let bw = -1;
        for (let n = 1; n <= 8; n++) {
          const w = F.resonance(n, 3.5, 2.2) * (0.6 + Math.random() * .8);
          if (w > bw) { bw = w; best = n; }
        }
        eng.bell(t + dur * 2, hz(41, best * 12), 2.6, .05 + bw * .05, 2.01);
      }
      /* sub drop mỗi 4 ô nhịp */
      if (i === 8 && bar % 4 === 3) {
        eng.sub(t, hz(41, -12), dur * 4, .16, 28);
      }
    }
  },

  /* ---------------------------------------------------------
     7. WARNING — boss phase 1
     Còi báo động 2 nốt + bass 8th dồn dập.
     --------------------------------------------------------- */
  warning: {
    name: 'WARNING',
    bpm: 140,
    root: 49,
    scale: SCALE.phrygian,
    pad: { chords: [[0, 1, 7], [0, 1, 7]], voice: 'pad', gain: .045, len: 1.03 },
    bass: {
      pat: [0, 0, 0, 0, 0, 0, -1, -1, 0, 0, 0, 0, 3, 3, 1, 0],
      voice: 'bass', gain: .21, len: .6
    },
    arp: {
      pat: [12, null, 12, null, 15, null, 12, null, 13, null, 12, null, 8, null, 7, null],
      voice: 'pluck', gain: .06, len: .4, oct: 12
    },
    drums: {
      kick:  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat:   [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1]
    },
    extra(eng, t, dur, step, i, bar) {
      /* còi 2 nốt mỗi 2 ô nhịp */
      if (bar % 2 === 0 && i >= 8) {
        const hi = i % 2 === 0;
        eng.siren(t, hi ? 622 : 466, dur * .9, .055);
      }
      if (i === 0 && bar % 4 === 0) {
        eng.sweep(t, dur * 4, 400, 2600, .045);
      }
    }
  },

  /* ---------------------------------------------------------
     8. CRITICALITY — boss phase 2
     k tăng dần trong 8 ô nhịp; 1/(1-k) làm mật độ + lực đánh
     tăng theo cấp số nhân rồi "xả" về đầu chu kỳ.
     --------------------------------------------------------- */
  criticality: {
    name: 'CRITICALITY',
    bpm: 150,
    root: 46,
    scale: SCALE.chromatic,
    pad: { chords: [[0, 1, 6], [0, 1, 6]], voice: 'pad', gain: .04, len: 1.02 },
    bass: {
      pat: [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7],
      voice: 'bass', gain: .20, len: .45
    },
    arp: {
      pat: [12, 13, 12, 15, 12, 13, 18, 13, 12, 13, 12, 15, 19, 15, 12, 13],
      voice: 'pluck', gain: .065, len: .3, oct: 12
    },
    drums: {
      kick:  [1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
      hat:   [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    },
    extra(eng, t, dur, step, i, bar, danger) {
      /* k = 0.25 → 0.83 trong 8 ô nhịp */
      const k = .25 + (bar % 8) / 12;
      const c = F.criticality(k);
      /* càng gần tới hạn càng nhiều nhấn phụ */
      if (c > 2.4 && i % 2 === 0) {
        eng.pluck(t, hz(46, 24 + deg(SCALE.chromatic, (step * 5) % 12)), dur * .3, .035 * (c / 4), { type: 'square' });
      }
      if (i === 0 && bar % 8 === 7) {
        eng.sweep(t, dur * 5, 500, 5200, .09);
      }
    }
  },

  /* ---------------------------------------------------------
     9. MELTDOWN — boss phase 3
     Bass méo, tritone, 16th kick. Càng đánh càng rối.
     --------------------------------------------------------- */
  meltdown: {
    name: 'MELTDOWN',
    bpm: 168,
    root: 43,
    scale: SCALE.locrian,
    pad: { chords: [[0, 6, 11], [0, 6, 10]], voice: 'pad', gain: .05, len: 1.02 },
    bass: {
      pat: [0, 0, 6, 0, 0, 0, 11, 0, 0, 0, 6, 0, 1, 0, 6, 0],
      voice: 'dist', gain: .22, len: .4
    },
    arp: {
      pat: [12, 18, 12, 17, 12, 18, 23, 18, 12, 18, 12, 17, 24, 18, 12, 18],
      voice: 'pluck', gain: .07, len: .25, oct: 12
    },
    drums: {
      kick:  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
      hat:   [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]
    },
    extra(eng, t, dur, step, i, bar) {
      /* stab tritone mỗi 2 ô nhịp */
      if (i === 0 && bar % 2 === 0) {
        eng.stab(t, hz(43, 12), hz(43, 18), dur * 1.2, .08);
      }
      if (i === 8) eng.sweep(t, dur * 4, 200, 4200, .06);
    }
  },

  /* ---------------------------------------------------------
     10. ROD_DROP — game over / boss xuất hiện
     Thanh điều khiển rơi: cụm nốt trượt xuống 2 quãng tám,
     sau đó im lặng gần như tuyệt đối.
     --------------------------------------------------------- */
  rod_drop: {
    name: 'ROD DROP',
    bpm: 60,
    root: 37,
    scale: SCALE.phrygian,
    pad: { chords: [[0, 1, 7], [0, 1, 7]], voice: 'pad', gain: .07, len: 1.08 },
    bass: {
      pat: [0, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      voice: 'sub', gain: .2, len: 2
    },
    drums: {
      kick:  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      snare: [],
      hat:   []
    },
    extra(eng, t, dur, step, i, bar) {
      /* rơi thanh điều khiển ở ô nhịp đầu */
      if (bar === 0 && i < 8) {
        const f = hz(37, 36 - i * 3);
        eng.pluck(t, f, dur * 3, .12 - i * .012, { type: 'sawtooth' });
      }
      if (i === 0 && bar % 2 === 1) {
        eng.metal(t, hz(37, 12), 2.4, .05);
      }
    }
  }
};

/* =========================================================
   ALIAS — tên cũ trong game → bài mới
   ========================================================= */
const ALIAS = {
  menu: 'half_life',
  game: 'neutron_flux',
  boss: 'warning',
  over: 'rod_drop',
  abandoned: 'geiger',
  industrial: 'turbine',
  neon: 'press_value',
  dead: 'half_life',
  void: 'resonance'
};

/* Chuỗi nhạc boss — tự leo thang theo % máu */
const BOSS_CHAIN = ['warning', 'criticality', 'meltdown'];

/* =========================================================
   ENGINE
   ========================================================= */
class MusicEngine {
  constructor() {
    this.ctx = null;
    this.out = null;
    this.ready = false;

    this.decks = [];
    this.activeIdx = -1;
    this.active = null;

    this.danger = 0;
    this.bossChain = false;
    this.bossStage = 0;
    this.currentName = null;

    this._curBus = null;
    this._noise = null;
    this._reverb = null;
    this._dry = null;
    this._wet = null;
  }

  /* ---------------------------------------------------------
     INIT
     --------------------------------------------------------- */
  init(ctx, out) {
    if (this.ready || !ctx) return;

    this.ctx = ctx;
    this.out = out;

    /* Bus khô + reverb tổng */
    this._dry = ctx.createGain();
    this._dry.gain.value = .82;
    this._dry.connect(out);

    this._reverb = this._buildReverb();
    if (this._reverb) {
      this._wet = ctx.createGain();
      this._wet.gain.value = .42;
      this._reverb.connect(this._wet);
      this._wet.connect(out);
    }

    /* Buffer nhiễu dùng lại cho click/hat/snare */
    this._noise = this._buildNoise(2);

    this.decks = [this._makeDeck(), this._makeDeck()];
    this.ready = true;
  }

  _buildNoise(seconds) {
    const ctx = this.ctx;
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _buildReverb() {
    const ctx = this.ctx;
    if (typeof ctx.createConvolver !== 'function') return null;

    try {
      const secs = 2.4;
      const len = Math.floor(ctx.sampleRate * secs);
      const buf = ctx.createBuffer(2, len, ctx.sampleRate);

      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          const t = i / len;
          /* nhiễu tắt dần → impulse response kiểu phòng lớn */
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.8);
        }
      }

      const conv = ctx.createConvolver();
      conv.buffer = buf;
      return conv;
    } catch (e) {
      return null;
    }
  }

  _makeDeck() {
    const ctx = this.ctx;
    const bus = ctx.createGain();
    bus.gain.value = .0001;

    /* Sidechain: kick đè pad xuống rồi bơm trở lại (pump kiểu house) */
    const duck = ctx.createGain();
    duck.gain.value = 1;

    /* lowpass riêng của deck — dùng cho tiếng tuabin "thở" */
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 20000;
    lp.Q.value = .4;

    bus.connect(duck);
    duck.connect(lp);
    lp.connect(this._dry);

    let send = null;
    if (this._reverb) {
      send = ctx.createGain();
      send.gain.value = .30;
      lp.connect(send);
      send.connect(this._reverb);
    }

    return {
      bus, duck, lp, send,
      timer: null,
      step: 0,
      nextTime: 0,
      track: null,
      name: null
    };
  }

  /* ---------------------------------------------------------
     PUBLIC — play / stop
     --------------------------------------------------------- */
  play(name) {
    if (!this.ready) return;

    const key = ALIAS[name] || name;
    const track = TRACKS[key];
    if (!track) return;

    if (this.active && this.active.name === key) return;

    this.bossChain = key === 'warning';
    this.bossStage = 0;

    this._switch(key);
  }

  playBoss() {
    this.bossChain = true;
    this.bossStage = 0;
    this._switch(BOSS_CHAIN[0]);
  }

  stop(fade = .5) {
    if (!this.ready) return;
    for (const d of this.decks) this._stopDeck(d, fade);
    this.active = null;
    this.activeIdx = -1;
    this.currentName = null;
    this.bossChain = false;
    this.bossStage = 0;
  }

  _switch(key) {
    const track = TRACKS[key];
    if (!track) return;

    const nextIdx = this.activeIdx === 0 ? 1 : 0;
    const next = this.decks[nextIdx];

    if (this.active && this.active !== next) {
      this._stopDeck(this.active, .55);
    }

    this._startDeck(next, track, key);
    this.active = next;
    this.activeIdx = nextIdx;
    this.currentName = key;
  }

  _startDeck(deck, track, key) {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    if (deck.timer) {
      clearInterval(deck.timer);
      deck.timer = null;
    }

    deck.track = track;
    deck.name = key;
    deck.step = 0;
    deck.nextTime = now + .06;

    try {
      deck.bus.gain.cancelScheduledValues(now);
      deck.bus.gain.setValueAtTime(.0001, now);
      deck.bus.gain.linearRampToValueAtTime(1, now + .55);
    } catch (e) { /* shim */ }

    deck.timer = setInterval(() => this._tick(deck), 60);
  }

  _stopDeck(deck, fade) {
    if (!deck || !deck.timer && !deck.track) return;

    const now = this.ctx.currentTime;
    try {
      deck.bus.gain.cancelScheduledValues(now);
      deck.bus.gain.setValueAtTime(deck.bus.gain.value || .0001, now);
      deck.bus.gain.linearRampToValueAtTime(.0001, now + fade);
    } catch (e) { /* shim */ }

    if (deck.timer) {
      clearInterval(deck.timer);
      deck.timer = null;
    }

    const d = deck;
    setTimeout(() => {
      d.track = null;
      d.step = 0;
    }, fade * 1000 + 120);
  }

  /* ---------------------------------------------------------
     DANGER — 0..1, điều khiển layer + chuyển bài boss
     --------------------------------------------------------- */
  setDanger(x) {
    this.danger = F.clamp(x, 0, 1);

    if (!this.bossChain || !this.ready) return;

    /* warning → criticality → meltdown */
    if (this.bossStage === 0 && this.danger > .34) {
      this.bossStage = 1;
      this._switch(BOSS_CHAIN[1]);
    } else if (this.bossStage === 1 && this.danger > .66) {
      this.bossStage = 2;
      this._switch(BOSS_CHAIN[2]);
    }
  }

  /* ---------------------------------------------------------
     SCHEDULER
     --------------------------------------------------------- */
  _tick(deck) {
    if (!this.ready || !deck.track || !this.ctx) return;

    const now = this.ctx.currentTime;
    const horizon = now + .25;

    let guard = 0;
    while (deck.nextTime < horizon && guard++ < 64) {
      const tr = deck.track;
      const stepDur = 60 / tr.bpm / 4;
      this._step(deck, deck.step, deck.nextTime, stepDur);
      deck.nextTime += stepDur;
      deck.step++;
    }
  }

  _vel() {
    return .82 + this.danger * .3;
  }

  /* ---------------------------------------------------------
     SIDECHAIN — hạ bus một nhịp rồi bơm lại để kick xuyên qua
     --------------------------------------------------------- */
  _sidechain(t) {
    const deck = this.active;
    if (!deck || !deck.duck) return;
    const g = deck.duck.gain;
    const depth = .55;
    try {
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(depth, t + .012);
      g.linearRampToValueAtTime(1, t + .16);
    } catch (e) { /* trình duyệt cũ bỏ qua */ }
  }

  _step(deck, step, t, dur) {
    const tr = deck.track;
    if (!tr) return;

    this._curBus = deck.bus;

    const i = step % 16;
    const bar = Math.floor(step / 16);
    const danger = this.danger;

    /* ---------- PAD (mỗi ô nhịp) ---------- */
    if (tr.pad && i === 0) {
      const chords = tr.pad.chords || [];
      const ch = chords[bar % Math.max(1, chords.length)] || chords[0];
      if (ch) {
        const len = dur * 16 * (tr.pad.len || 1);
        for (const d of ch) {
          this.pad(t, hz(tr.root, deg(tr.scale, d)), len, (tr.pad.gain || .05) * this._vel());
        }
      }
    }

    /* ---------- BASS ---------- */
    if (tr.bass) this._pat(deck, tr.bass, i, t, dur, 0);

    /* ---------- ARP ---------- */
    if (tr.arp && (i % (tr.arp.every || 1) === 0)) {
      this._pat(deck, tr.arp, i, t, dur, 0);
    }

    /* ---------- LEAD ---------- */
    if (tr.lead) this._pat(deck, tr.lead, i, t, dur, 0);

    /* ---------- TRỐNG ---------- */
    if (tr.drums) {
      const d = tr.drums;
      if (d.kick && d.kick[i % d.kick.length]) {
        this.kick(t, .30);
        this._sidechain(t);
      }
      if (d.snare && d.snare[i % d.snare.length]) this.snare(t, .16);
      if (d.hat && d.hat[i % d.hat.length]) {
        this.hat(t, .045 + (i % 2 ? 0 : .02));
      }
    }

    /* ---------- RIÊNG TỪNG BÀI ---------- */
    if (tr.extra) tr.extra(this, t, dur, step, i, bar, danger);
  }

  _pat(deck, cfg, i, t, dur, extraSemis) {
    const pat = cfg.pat;
    if (!pat || !pat.length) return;

    const v = pat[i % pat.length];
    if (v === null || v === undefined) return;

    const tr = deck.track;
    const semis = deg(tr.scale, v) + (cfg.oct || 0) + extraSemis;
    const f = hz(tr.root, semis);
    const g = (cfg.gain || .1) * this._vel();
    const len = dur * (cfg.len || 1);

    switch (cfg.voice) {
      case 'bass': this.bass(t, f, len, g); break;
      case 'sub': this.sub(t, f, len, g, 46); break;
      case 'dist': this.dist(t, f, len, g); break;
      case 'bell': this.bell(t, f, len, g, 2.01); break;
      case 'pad': this.pad(t, f, len, g); break;
      default: this.pluck(t, f, len, g, { type: 'sawtooth' });
    }
  }

  /* =========================================================
     VOICES
     ========================================================= */

  /* Pluck: saw/square → lowpass tắt dần, gain theo f(x) */
  pluck(t, freq, dur, gain, opts = {}) {
    const ctx = this.ctx;
    const bus = this._curBus || (this.active && this.active.bus) || (this.decks[0] && this.decks[0].bus);
    if (!bus) return;

    const o = ctx.createOscillator();
    o.type = opts.type || 'sawtooth';
    o.frequency.setValueAtTime(freq, t);

    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = opts.q || 1.2;
    f.frequency.setValueAtTime(opts.cutoff || 3400, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(140, (opts.cutoff || 3400) * .18), t + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + .006);
    /* f(x) = 12e^(-8x) - 12 → dạng phân rã chuẩn hoá */
    g.gain.exponentialRampToValueAtTime(Math.max(.0004, gain * .02), t + dur);

    o.connect(f);
    f.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + dur + .04);
  }

  /* Bass: sine + saw, lowpass thấp */
  bass(t, freq, dur, gain) {
    const ctx = this.ctx;
    const bus = this._curBus || (this.active && this.active.bus) || (this.decks[0] && this.decks[0].bus);
    if (!bus) return;

    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq, t);

    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(freq, t);

    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(520, t);
    f.frequency.exponentialRampToValueAtTime(240, t + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + .012);
    g.gain.exponentialRampToValueAtTime(.0005, t + dur);

    const g2 = ctx.createGain();
    g2.gain.value = .55;

    o.connect(f);
    o2.connect(g2);
    g2.connect(f);
    f.connect(g);
    g.connect(bus);

    o.start(t); o2.start(t);
    o.stop(t + dur + .04); o2.stop(t + dur + .04);
  }

  /* Sub: sine thuần, có thể trượt tần số */
  sub(t, freq, dur, gain, slideTo) {
    const ctx = this.ctx;
    const bus = this._curBus || (this.active && this.active.bus) || (this.decks[0] && this.decks[0].bus);
    if (!bus) return;

    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) {
      o.frequency.exponentialRampToValueAtTime(Math.max(18, slideTo), t + dur);
    }

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + .03);
    g.gain.exponentialRampToValueAtTime(.0004, t + dur);

    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + dur + .05);
  }

  /* Pad: 2 osc lệch detune + attack chậm */
  pad(t, freq, dur, gain) {
    const ctx = this.ctx;
    const bus = this._curBus || (this.active && this.active.bus) || (this.decks[0] && this.decks[0].bus);
    if (!bus) return;

    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 760;
    f.Q.value = .6;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + .5);
    g.gain.setValueAtTime(gain, t + Math.max(.55, dur - .7));
    g.gain.linearRampToValueAtTime(.0001, t + dur);

    for (const det of [-7, 7]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(freq, t);
      o.detune.value = det;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + .06);
    }

    f.connect(g);
    g.connect(bus);
  }

  /* Bell FM: carrier + modulator tắt dần */
  bell(t, freq, dur, gain, ratio = 2.01) {
    const ctx = this.ctx;
    const bus = this._curBus || (this.active && this.active.bus) || (this.decks[0] && this.decks[0].bus);
    if (!bus) return;

    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(freq, t);

    const mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.setValueAtTime(freq * ratio, t);

    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(freq * 1.6, t);
    modGain.gain.exponentialRampToValueAtTime(freq * .02, t + dur * .7);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + .008);
    g.gain.exponentialRampToValueAtTime(.0004, t + dur);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(g);
    g.connect(bus);

    mod.start(t); carrier.start(t);
    mod.stop(t + dur + .05); carrier.stop(t + dur + .05);
  }

  /* Dist: saw qua waveshaper (nếu có) */
  dist(t, freq, dur, gain) {
    const ctx = this.ctx;
    const bus = this._curBus || (this.active && this.active.bus) || (this.decks[0] && this.decks[0].bus);
    if (!bus) return;

    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq, t);

    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1400, t);
    f.frequency.exponentialRampToValueAtTime(300, t + dur);

    let node = o;
    if (typeof ctx.createWaveShaper === 'function') {
      try {
        const ws = ctx.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
          const x = (i / 255) * 2 - 1;
          curve[i] = Math.tanh(x * 3.2);
        }
        ws.curve = curve;
        o.connect(ws);
        node = ws;
      } catch (e) { /* fallback */ }
    }

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + .01);
    g.gain.exponentialRampToValueAtTime(.0005, t + dur);

    node.connect(f);
    f.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + dur + .04);
  }

  /* Stab 2 nốt chói */
  stab(t, f1, f2, dur, gain) {
    const ctx = this.ctx;
    const bus = this._curBus || (this.active && this.active.bus) || (this.decks[0] && this.decks[0].bus);
    if (!bus) return;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + .008);
    g.gain.exponentialRampToValueAtTime(.0004, t + dur);

    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1200;
    f.Q.value = .8;

    for (const fr of [f1, f2]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(fr, t);
      o.connect(f);
      o.start(t);
      o.stop(t + dur + .04);
    }

    f.connect(g);
    g.connect(bus);
  }

  /* Click geiger: nhiễu cực ngắn qua bandpass */
  click(t, gain, freq) {
    const ctx = this.ctx;
    const bus = this._curBus || (this.active && this.active.bus) || (this.decks[0] && this.decks[0].bus);
    if (!bus) return;
    if (!this._noise) return;

    const src = ctx.createBufferSource();
    src.buffer = this._noise;

    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq || 3000;
    f.Q.value = 4;

    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(.0002, t + .035);

    src.connect(f);
    f.connect(g);
    g.connect(bus);
    src.start(t, Math.random() * 1.5, .05);
  }

  /* Hat: nhiễu cao */
  hat(t, gain) {
    const ctx = this.ctx;
    const bus = this._curBus || (this.active && this.active.bus) || (this.decks[0] && this.decks[0].bus);
    if (!bus) return;
    if (!this._noise) return;

    const src = ctx.createBufferSource();
    src.buffer = this._noise;

    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;

    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(.0002, t + .05);

    src.connect(f);
    f.connect(g);
    g.connect(bus);
    src.start(t, Math.random(), .06);
  }

  /* Kick: sine trượt 120→45Hz */
  kick(t, gain) {
    const ctx = this.ctx;
    const bus = this._curBus || (this.active && this.active.bus) || (this.decks[0] && this.decks[0].bus);
    if (!bus) return;

    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(128, t);
    o.frequency.exponentialRampToValueAtTime(44, t + .11);

    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(.0004, t + .22);

    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + .24);
  }

  /* Snare: nhiễu + thân 190Hz */
  snare(t, gain) {
    const ctx = this.ctx;
    const bus = this._curBus || (this.active && this.active.bus) || (this.decks[0] && this.decks[0].bus);
    if (!bus) return;

    if (this._noise) {
      const src = ctx.createBufferSource();
      src.buffer = this._noise;

      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1900;
      f.Q.value = .9;

      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(.0003, t + .13);

      src.connect(f);
      f.connect(g);
      g.connect(bus);
      src.start(t, Math.random(), .14);
    }

    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(120, t + .08);

    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(gain * .5, t);
    g2.gain.exponentialRampToValueAtTime(.0003, t + .1);

    o.connect(g2);
    g2.connect(bus);
    o.start(t);
    o.stop(t + .12);
  }

  /* Metal: FM không hoà âm */
  metal(t, freq, dur, gain) {
    this.bell(t, freq, dur, gain, 1.41);
  }

  /* Siren: xung vuông ngắn (còi báo động) */
  siren(t, freq, dur, gain) {
    const ctx = this.ctx;
    const bus = this._curBus || (this.active && this.active.bus) || (this.decks[0] && this.decks[0].bus);
    if (!bus) return;

    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(freq, t);

    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1800;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + .02);
    g.gain.setValueAtTime(gain, t + dur * .7);
    g.gain.exponentialRampToValueAtTime(.0003, t + dur);

    o.connect(f);
    f.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + dur + .02);
  }

  /* Sweep: nhiễu qua bandpass quét */
  sweep(t, dur, from, to, gain) {
    const ctx = this.ctx;
    const bus = this._curBus || (this.active && this.active.bus) || (this.decks[0] && this.decks[0].bus);
    if (!bus) return;
    if (!this._noise) return;

    const src = ctx.createBufferSource();
    src.buffer = this._noise;

    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2.4;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, to), t + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + dur * .25);
    g.gain.exponentialRampToValueAtTime(.0003, t + dur);

    src.connect(f);
    f.connect(g);
    g.connect(bus);
    src.start(t, Math.random(), dur + .1);
  }

  /* Turbine: mở filter của deck theo w(x) */
  setTurbine(t, ratio) {
    const deck = this.active;
    if (!deck || !deck.lp) return;
    try {
      deck.lp.frequency.setTargetAtTime(900 + ratio * 5200, t, .18);
    } catch (e) { /* shim */ }
  }
}

/* =========================================================
   SINGLETON
   ========================================================= */
const Music = new MusicEngine();

export default Music;
