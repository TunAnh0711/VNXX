/* =========================================================
   HALF NIFE — DATA / SKINS (TRANG PHỤC)
   Mỗi skin là một bảng màu + phụ kiện cho nhân vật.
   Renderer đọc các field ở đây để vẽ thân / giáp / mũ / áo choàng.

   Field:
   - suit / suit2   : màu giáp chính + màu tối (gradient thân)
   - trim           : viền phát sáng
   - visor          : màu kính mũ
   - glow           : màu hào quang quanh nhân vật
   - cape           : màu áo choàng (null = không có)
   - accent         : màu điểm nhấn (khớp súng / lưỡi)
   - trail          : màu vệt di chuyển
   - fx             : kiểu hiệu ứng riêng ('none'|'ember'|'cryo'|'static'|'void'|'gold')
   - unlock         : điều kiện mở khoá
   ========================================================= */

export const SKIN_RARITY = {
  common:    { label: 'CƠ BẢN',    color: '#8fa6b8' },
  uncommon:  { label: 'HIẾM',      color: '#39ff9e' },
  rare:      { label: 'QUÝ',       color: '#28e0ff' },
  epic:      { label: 'SỬ THI',    color: '#c07bff' },
  legendary: { label: 'HUYỀN THOẠI', color: '#ffc44d' },
  mythic:    { label: 'THẦN THOẠI',  color: '#ff5ad0' }
};

export const SKINS = {
  /* ---------- MẶC ĐỊNH ---------- */
  cadet: {
    id: 'cadet',
    name: 'CADET',
    desc: 'Bộ giáp huấn luyện tiêu chuẩn. Bền, nhẹ, không bao giờ lỗi mốt.',
    rarity: 'common',
    suit: '#12506b', suit2: '#06222f',
    trim: '#28e0ff', visor: '#9ff2ff',
    glow: '#28e0ff', cape: null, accent: '#28e0ff',
    trail: '#28e0ff', fx: 'none',
    unlock: { type: 'free' }
  },

  /* ---------- MỞ BẰNG HẠ GỤC ---------- */
  ember: {
    id: 'ember',
    name: 'EMBER',
    desc: 'Tro tàn của lò phản ứng cũ. Càng cháy càng nóng.',
    rarity: 'uncommon',
    suit: '#6b2410', suit2: '#2a0a05',
    trim: '#ff7a2f', visor: '#ffd08a',
    glow: '#ff7a2f', cape: '#a8340f', accent: '#ff7a2f',
    trail: '#ff9a4d', fx: 'ember',
    unlock: { type: 'kills', value: 150 }
  },

  toxin: {
    id: 'toxin',
    name: 'TOXIN',
    desc: 'Đồ bảo hộ nhiễm xạ. Ai chạm vào cũng phải trả giá.',
    rarity: 'uncommon',
    suit: '#1d5c2a', suit2: '#08220f',
    trim: '#88ff3d', visor: '#d6ff8a',
    glow: '#88ff3d', cape: null, accent: '#88ff3d',
    trail: '#a8ff5c', fx: 'none',
    unlock: { type: 'kills', value: 500 }
  },

  cryo: {
    id: 'cryo',
    name: 'CRYO',
    desc: 'Giáp làm mát bằng nitơ lỏng. Sương giá bám theo từng bước chân.',
    rarity: 'uncommon',
    suit: '#1c4a63', suit2: '#08202c',
    trim: '#a8e9ff', visor: '#eaffff',
    glow: '#a8e9ff', cape: '#2b7a9e', accent: '#a8e9ff',
    trail: '#cdf3ff', fx: 'cryo',
    unlock: { type: 'credits', value: 4000 }
  },

  /* ---------- MỞ BẰNG TIẾN TRÌNH ---------- */
  ranger: {
    id: 'ranger',
    name: 'RANGER',
    desc: 'Đồ tác chiến dã ngoại. Không hào nhoáng, chỉ hiệu quả.',
    rarity: 'rare',
    suit: '#4a4420', suit2: '#1d1a08',
    trim: '#ffc44d', visor: '#ffe9a8',
    glow: '#ffc44d', cape: '#6b6229', accent: '#ffc44d',
    trail: '#ffe08a', fx: 'none',
    unlock: { type: 'level', value: 8 }
  },

  neon: {
    id: 'neon',
    name: 'NEON RUNNER',
    desc: 'Đồ của dân chạy đêm trong thành phố. Sáng đến mức khó bỏ lỡ.',
    rarity: 'rare',
    suit: '#3a1050', suit2: '#150520',
    trim: '#ff5ad0', visor: '#7df9ff',
    glow: '#ff5ad0', cape: '#6a1a8c', accent: '#7df9ff',
    trail: '#ff8ae0', fx: 'static',
    unlock: { type: 'stage', value: 2 }
  },

  phantom: {
    id: 'phantom',
    name: 'PHANTOM',
    desc: 'Lớp phủ dẫn quang. Kẻ địch thường bắn vào chỗ bạn vừa đứng.',
    rarity: 'rare',
    suit: '#2a2f3a', suit2: '#0d1015',
    trim: '#c9d6e2', visor: '#ffffff',
    glow: '#c9d6e2', cape: '#454d5c', accent: '#c9d6e2',
    trail: '#e6eef7', fx: 'none',
    unlock: { type: 'kills', value: 2000 }
  },

  critical: {
    id: 'critical',
    name: 'CRITICAL MASS',
    desc: 'Giáp lấy từ buồng phản ứng. Đứng gần nghe được tiếng lò rền.',
    rarity: 'epic',
    suit: '#5c5a12', suit2: '#232208',
    trim: '#f2ff3d', visor: '#ffffc2',
    glow: '#f2ff3d', cape: '#8a8718', accent: '#f2ff3d',
    trail: '#f6ff7a', fx: 'static',
    unlock: { type: 'stage', value: 3 }
  },

  meltdown: {
    id: 'meltdown',
    name: 'MELTDOWN',
    desc: 'Bộ giáp đã đi qua một vụ nổ hạt nhân và sống sót. Kỳ lạ.',
    rarity: 'epic',
    suit: '#7a2b05', suit2: '#2e0f02',
    trim: '#ffb02e', visor: '#fff0b8',
    glow: '#ff8a1f', cape: '#b8460a', accent: '#ffb02e',
    trail: '#ffc061', fx: 'ember',
    unlock: { type: 'bosses', value: 3 }
  },

  gold: {
    id: 'gold',
    name: 'GOLDEN ROD',
    desc: 'Thanh nhiên liệu mạ vàng. Hoàn toàn vô dụng về mặt kỹ thuật.',
    rarity: 'legendary',
    suit: '#6b5210', suit2: '#2b2004',
    trim: '#ffd75e', visor: '#fff6c9',
    glow: '#ffd75e', cape: '#9c7a15', accent: '#ffd75e',
    trail: '#ffe89a', fx: 'gold',
    unlock: { type: 'credits', value: 25000 }
  },

  voidsuit: {
    id: 'voidsuit',
    name: 'VOID TOUCH',
    desc: 'Chạm vào hư không rồi quay về. Không còn hoàn toàn ở đây nữa.',
    rarity: 'legendary',
    suit: '#3a1a66', suit2: '#12062a',
    trim: '#a06bff', visor: '#e2d0ff',
    glow: '#a06bff', cape: '#522399', accent: '#a06bff',
    trail: '#c9a8ff', fx: 'void',
    unlock: { type: 'stage', value: 5 }
  },

  halfnife: {
    id: 'halfnife',
    name: 'HALF NIFE',
    desc: 'Bộ đồ của người đã cắt đôi lò phản ứng bằng một nhát dao.',
    rarity: 'mythic',
    suit: '#0f3b3f', suit2: '#041618',
    trim: '#39ffd0', visor: '#ffffff',
    glow: '#39ffd0', cape: '#0d6b62', accent: '#39ffd0',
    trail: '#7dfff0', fx: 'void',
    unlock: { type: 'bosses', value: 5 }
  }
};

/* =========================================================
   HELPERS
   ========================================================= */

export const SKIN_IDS = Object.keys(SKINS);
export const DEFAULT_SKIN = 'cadet';

export function getSkin(id) {
  return SKINS[id] || SKINS[DEFAULT_SKIN];
}

/** Mô tả ngắn điều kiện mở khoá — dùng cho UI. */
export function unlockText(unlock) {
  if (!unlock || unlock.type === 'free') return 'MỞ SẴN';
  const n = unlock.value;
  switch (unlock.type) {
    case 'kills':   return 'HẠ ' + n + ' QUÁI';
    case 'bosses':  return 'HẠ ' + n + ' BOSS';
    case 'stage':   return 'TỚI MÀN ' + n;
    case 'level':   return 'ĐẠT LEVEL ' + n;
    case 'credits': return 'KIẾM ' + n.toLocaleString('vi-VN') + ' CR';
    case 'shards':  return 'CÓ ' + n + ' MẢNH';
    default:        return '???';
  }
}

/** Kiểm tra đã mở khoá chưa dựa trên profile. */
export function isSkinUnlocked(id, profile) {
  const s = SKINS[id];
  if (!s) return false;
  const u = s.unlock || { type: 'free' };
  if (u.type === 'free') return true;
  if (!profile) return false;

  const st = profile.statistics || {};
  switch (u.type) {
    case 'kills':   return (st.kills || 0) >= u.value;
    case 'bosses':  return (st.bossesKilled || 0) >= u.value;
    case 'stage':   return (profile.currentStage || 1) >= u.value;
    case 'level':   return (profile.level || 1) >= u.value;
    case 'credits': return (st.creditsEarned || 0) >= u.value;
    case 'shards':  return (profile.shards || 0) >= u.value;
    default:        return false;
  }
}

/** Tiến độ mở khoá 0..1 — cho thanh progress trong UI. */
export function skinProgress(id, profile) {
  const s = SKINS[id];
  if (!s) return 0;
  const u = s.unlock || { type: 'free' };
  if (u.type === 'free') return 1;
  if (!profile) return 0;
  const st = profile.statistics || {};
  let cur = 0;
  switch (u.type) {
    case 'kills':   cur = st.kills || 0; break;
    case 'bosses':  cur = st.bossesKilled || 0; break;
    case 'stage':   cur = profile.currentStage || 1; break;
    case 'level':   cur = profile.level || 1; break;
    case 'credits': cur = st.creditsEarned || 0; break;
    case 'shards':  cur = profile.shards || 0; break;
    default:        cur = 0;
  }
  if (u.value <= 0) return 1;
  return Math.max(0, Math.min(1, cur / u.value));
}

/** Danh sách skin kèm trạng thái mở khoá — dùng cho wardrobe UI. */
export function listSkins(profile) {
  return SKIN_IDS.map((id) => {
    const s = SKINS[id];
    return Object.assign({}, s, {
      unlocked: isSkinUnlocked(id, profile),
      progress: skinProgress(id, profile),
      unlockLabel: unlockText(s.unlock)
    });
  });
}
