/* =========================================================
   VNXX — DATA / UPGRADES
   Thẻ nâng cấp khi lên level.

   Rarity: common (có trade-off) · rare (buff thuần) · epic (build-defining)

   Stat mới dùng trong hệ thống:
   - statusPowerMul / statusDurMul  : tăng sức mạnh & thời gian trạng thái
   - poiseMul                       : sát thương "cân bằng" gây lên poise
   - executeMul                     : sát thương lên mục tiêu máu thấp
   - comboDmgMul                    : thêm % sát thương mỗi stack combo
   - odGainMul                      : tốc độ nạp overdrive
   - odDurAdd                       : cộng thêm giây overdrive
   - chainAdd                       : +1 mục tiêu lan của sét
   ========================================================= */

export const UPGRADES = [

  /* ==========================================================
     NHÓM 1 — BASIC (KHÔNG NHƯỢC ĐIỂM)
     ========================================================== */
  {
    id: 'hp',
    icon: '❤',
    name: '+22% MÁU TỐI ĐA',
    desc: 'Tăng máu tối đa và hồi đầy',
    rarity: 'common',
    apply: (p) => {
      p.maxHp = Math.round(p.maxHp * 1.22);
      p.hp = p.maxHp;
      p.up.maxHpMul += 0.22;
    }
  },
  {
    id: 'dmg',
    icon: '⚔',
    name: '+15% SÁT THƯƠNG',
    desc: 'Tất cả vũ khí mạnh hơn',
    rarity: 'common',
    apply: (p) => { p.up.damageMul += .15; }
  },
  {
    id: 'spd',
    icon: '➤',
    name: '+12% TỐC ĐỘ',
    desc: 'Di chuyển nhanh hơn',
    rarity: 'common',
    apply: (p) => {
      p.up.speedMul += .12;
      p.speed *= 1.12;
    }
  },
  {
    id: 'as',
    icon: '⚡',
    name: '+14% TỐC ĐỘ ĐÁNH',
    desc: 'Giảm cooldown tấn công',
    rarity: 'common',
    apply: (p) => { p.up.attackSpeedMul += .14; }
  },
  {
    id: 'crit',
    icon: '✷',
    name: '+8% CHÍ MẠNG',
    desc: 'Tăng tỉ lệ chí mạng',
    rarity: 'common',
    apply: (p) => { p.up.critChance += .08; }
  },
  {
    id: 'critd',
    icon: '✦',
    name: '+35% SÁT THƯƠNG CHÍ MẠNG',
    desc: 'Chí mạng gây nhiều sát thương hơn',
    rarity: 'common',
    apply: (p) => { p.up.critMul += .35; }
  },
  {
    id: 'armor',
    icon: '🛡',
    name: '+12% GIÁP',
    desc: 'Giảm sát thương nhận vào',
    rarity: 'common',
    apply: (p) => { p.up.armor = Math.min(0.82, p.up.armor + .12); }
  },
  {
    id: 'dodge',
    icon: '💨',
    name: '+7% NÉ TRÁNH',
    desc: 'Cơ hội bỏ qua hoàn toàn sát thương',
    rarity: 'common',
    apply: (p) => { p.up.dodge = Math.min(0.65, p.up.dodge + .07); }
  },
  {
    id: 'ls',
    icon: '🩸',
    name: '+3% HÚT MÁU',
    desc: 'Hồi máu theo sát thương gây ra',
    rarity: 'common',
    apply: (p) => { p.up.lifesteal += .03; }
  },
  {
    id: 'range',
    icon: '◎',
    name: '+15% TẦM BẮN',
    desc: 'Tăng tầm và tốc độ đạn',
    rarity: 'common',
    apply: (p) => { p.up.rangeMul += .15; }
  },
  {
    id: 'luck',
    icon: '🍀',
    name: '+15% MAY MẮN',
    desc: 'Nhiều loot và tỉ lệ hiếm hơn',
    rarity: 'common',
    apply: (p) => { p.up.luck += .15; }
  },
  {
    id: 'heal',
    icon: '✚',
    name: 'HỒI MÁU NGAY',
    desc: 'Hồi 60% máu tối đa',
    rarity: 'common',
    apply: (p) => {
      if (!p.noHeal) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * .6);
    }
  },

  /* ==========================================================
     NHÓM 2 — ĐẠN DƯỢC (TRADE-OFF)
     ========================================================== */
  {
    id: 'reload_fast',
    icon: '⟳',
    name: 'NẠP ĐẠN THẦN TỐC',
    desc: '+30% tốc nạp · -25% dung lượng băng',
    rarity: 'common',
    apply: (p) => {
      p.up.reloadSpeedMul += 0.30;
      p.up.magazineMul -= 0.25;
      _recalcMagazine(p);
    }
  },
  {
    id: 'magazine_big',
    icon: '📦',
    name: 'KHO ĐẠN DỰ BỊ',
    desc: '+50% dung lượng băng · -40% tốc nạp',
    rarity: 'common',
    apply: (p) => {
      p.up.reloadSpeedMul -= 0.40;
      p.up.magazineMul += 0.50;
      _recalcMagazine(p);
    }
  },
  {
    id: 'fire_rate',
    icon: '🔥',
    name: 'NÒNG SÚNG RÚT GỌN',
    desc: '+35% tốc bắn · -20% sát thương',
    rarity: 'common',
    apply: (p) => {
      p.up.attackSpeedMul += 0.35;
      p.up.damageMul = Math.max(0, p.up.damageMul - 0.20);
    }
  },

  /* ==========================================================
     NHÓM 3 — CHÍ MẠNG (TRADE-OFF)
     ========================================================== */
  {
    id: 'sniper_crit',
    icon: '🎯',
    name: 'XẠ THỦ BẮN TỈA',
    desc: '+20% chí mạng · -15% tốc bắn',
    rarity: 'common',
    apply: (p) => {
      p.up.critChance += 0.20;
      p.up.attackSpeedMul = Math.max(-0.5, p.up.attackSpeedMul - 0.15);
    }
  },
  {
    id: 'all_in_crit',
    icon: '🎲',
    name: 'XÚC XẮC TỬ THẦN',
    desc: '+40% chí mạng · -30% sát thương',
    rarity: 'common',
    apply: (p) => {
      p.up.critChance += 0.40;
      p.up.damageMul = Math.max(0, p.up.damageMul - 0.30);
    }
  },
  {
    id: 'glass_cannon',
    icon: '💥',
    name: 'DAO HAI LƯỠI',
    desc: '+35% sát thương · -25% máu tối đa',
    rarity: 'common',
    apply: (p) => {
      p.up.damageMul += 0.35;
      _reduceMaxHp(p, 0.25);
    }
  },

  /* ==========================================================
     NHÓM 4 — MÁU & PHÒNG THỦ (TRADE-OFF)
     ========================================================== */
  {
    id: 'heavy_armor',
    icon: '🛡',
    name: 'ÁP GIÁP NẶNG',
    desc: '+30% máu tối đa · -15% tốc chạy',
    rarity: 'common',
    apply: (p) => {
      p.maxHp = Math.round(p.maxHp * 1.30);
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.30);
      p.up.maxHpMul += 0.30;
      p.up.speedMul = Math.max(-0.7, p.up.speedMul - 0.15);
      p.speed *= 0.85;
    }
  },
  {
    id: 'wind_shoes',
    icon: '🌀',
    name: 'GIÀY GIÓ',
    desc: '+25% tốc chạy · +25% tốc bắn · -20% máu',
    rarity: 'common',
    apply: (p) => {
      p.up.speedMul += 0.25;
      p.speed *= 1.25;
      p.up.attackSpeedMul += 0.25;
      _reduceMaxHp(p, 0.20);
    }
  },
  {
    id: 'blood_ritual',
    icon: '🩸',
    name: 'HUYẾT TẾ',
    desc: '-30% máu · -50% hiệu quả hồi · +40% ST nguyên tố',
    rarity: 'common',
    apply: (p) => {
      _reduceMaxHp(p, 0.30);
      p.healMul = (p.healMul || 1) * 0.5;
      p.up.elementDamageMul = (p.up.elementDamageMul || 0) + 0.40;
    }
  },
  {
    id: 'phantom',
    icon: '👻',
    name: 'ẢNH SÁT',
    desc: '+30% né tránh · -20% máu tối đa',
    rarity: 'common',
    apply: (p) => {
      p.up.dodge = Math.min(0.85, p.up.dodge + 0.30);
      _reduceMaxHp(p, 0.20);
    }
  },
  {
    id: 'shield_energy',
    icon: '🔵',
    name: 'LỚP VỎ NĂNG LƯỢNG',
    desc: '+40 khiên · -20% máu · khiên tự hồi',
    rarity: 'common',
    apply: (p) => {
      p.up.shieldMaxMul = (p.up.shieldMaxMul || 0) + 0.40;
      p.shieldMax = Math.round((p.shieldMax || 0) + 40);
      p.shield = p.shieldMax;
      p.shieldRegenEnabled = true;
      _reduceMaxHp(p, 0.20);
    }
  },
  {
    id: 'shield_titanium',
    icon: '⚫',
    name: 'LỚP VỎ TITANIUM',
    desc: '+50 khiên · KHÔNG THỂ HỒI MÁU',
    rarity: 'common',
    apply: (p) => {
      p.up.shieldMaxMul = (p.up.shieldMaxMul || 0) + 0.50;
      p.shieldMax = Math.round((p.shieldMax || 0) + 50);
      p.shield = p.shieldMax;
      p.noHeal = true;
    }
  },

  /* ==========================================================
     NHÓM 5 — KỸ NĂNG & CƠ ĐỘNG
     ========================================================== */
  {
    id: 'brain_overclock',
    icon: '🧠',
    name: 'BỘ NÃO SIÊU VIỆT',
    desc: '-30% CD dash · -25% máu',
    rarity: 'common',
    apply: (p) => {
      p.up.dashCdMul = (p.up.dashCdMul || 0) + 0.30;
      _reduceMaxHp(p, 0.25);
    }
  },
  {
    id: 'jump_boost',
    icon: '🦘',
    name: 'GIÀY BẬT NHẢY',
    desc: '+40% khoảng cách dash · +25% phát tán đạn',
    rarity: 'common',
    apply: (p) => {
      p.up.dashDistanceMul = (p.up.dashDistanceMul || 0) + 0.40;
      p.up.spreadMul = (p.up.spreadMul || 0) + 0.25;
    }
  },

  /* ==========================================================
     NHÓM 6 — TẦM BẮN & DIỆN RỘNG
     ========================================================== */
  {
    id: 'range_shot',
    icon: '📡',
    name: 'ĐẠN DƯỢC PHÁT TÁN',
    desc: '+30% tầm · -15% sát thương',
    rarity: 'common',
    apply: (p) => {
      p.up.rangeMul += 0.30;
      p.up.damageMul = Math.max(0, p.up.damageMul - 0.15);
    }
  },
  {
    id: 'heavy_bullet',
    icon: '💣',
    name: 'ĐẦU ĐẠN NẶNG',
    desc: '+25% bán kính nổ · -20% tốc độ đạn',
    rarity: 'common',
    apply: (p) => {
      p.up.splashMul = (p.up.splashMul || 0) + 0.25;
      p.up.projSpeedMul = (p.up.projSpeedMul || 0) - 0.20;
    }
  },
  {
    id: 'optic_round',
    icon: '⚡',
    name: 'ĐẠN QUANG HỌC',
    desc: '+100% tốc độ đạn · -50% bán kính nổ',
    rarity: 'common',
    apply: (p) => {
      p.up.projSpeedMul = (p.up.projSpeedMul || 0) + 1.00;
      p.up.splashMul = (p.up.splashMul || 0) - 0.50;
    }
  },
  {
    id: 'ap_round',
    icon: '🎯',
    name: 'ĐẠN XUYÊN GIÁP',
    desc: '+1 xuyên · +30% xuyên giáp · -20% chí mạng',
    rarity: 'common',
    apply: (p) => {
      p.up.pierceAdd = (p.up.pierceAdd || 0) + 1;
      p.up.armorPen = (p.up.armorPen || 0) + 0.30;
      p.up.critChance = Math.max(0, p.up.critChance - 0.20);
    }
  },

  /* ==========================================================
     NHÓM 7 — ĐẶC BIỆT
     ========================================================== */
  {
    id: 'vampire',
    icon: '🧛',
    name: 'MA CÀ RỒNG',
    desc: '+5% hút máu · -10% tốc chạy',
    rarity: 'common',
    apply: (p) => {
      p.up.lifesteal += 0.05;
      p.up.speedMul = Math.max(-0.7, p.up.speedMul - 0.10);
      p.speed *= 0.90;
    }
  },

  /* ==========================================================
     NHÓM 8 — TRẠNG THÁI (BUILD ELEMENTAL)
     ========================================================== */
  {
    id: 'ember_round',
    icon: '🔥',
    name: 'ĐẠN LỬA',
    desc: 'Mọi đòn đánh có 30% gây THIÊU ĐỐT',
    rarity: 'common',
    apply: (p) => { p.up.extraStatus = p.up.extraStatus || []; p.up.extraStatus.push({ id: 'burn', dur: 3.2, power: 5, chance: .30 }); }
  },
  {
    id: 'cryo_round',
    icon: '❄',
    name: 'ĐẠN BĂNG',
    desc: 'Mọi đòn đánh có 30% gây LÀM CHẬM',
    rarity: 'common',
    apply: (p) => { p.up.extraStatus = p.up.extraStatus || []; p.up.extraStatus.push({ id: 'chill', dur: 3.0, power: 1, chance: .30 }); }
  },
  {
    id: 'toxin_round',
    icon: '☣',
    name: 'ĐẠN ĐỘC',
    desc: 'Mọi đòn đánh có 30% gây NHIỄM ĐỘC',
    rarity: 'common',
    apply: (p) => { p.up.extraStatus = p.up.extraStatus || []; p.up.extraStatus.push({ id: 'poison', dur: 4.2, power: 4, chance: .30 }); }
  },
  {
    id: 'static_round',
    icon: '⚡',
    name: 'ĐẠN TĨNH ĐIỆN',
    desc: 'Mọi đòn đánh có 25% gây TÊ LIỆT',
    rarity: 'common',
    apply: (p) => { p.up.extraStatus = p.up.extraStatus || []; p.up.extraStatus.push({ id: 'shock', dur: 3.4, power: 1, chance: .25 }); }
  },
  {
    id: 'catalyst',
    icon: '⚗',
    name: 'CHẤT XÚC TÁC',
    desc: '+50% sức mạnh trạng thái · -15% sát thương trực tiếp',
    rarity: 'common',
    apply: (p) => {
      p.up.statusPowerMul = (p.up.statusPowerMul || 0) + 0.50;
      p.up.damageMul = Math.max(0, p.up.damageMul - 0.15);
    }
  },

  /* ==========================================================
     NHÓM 9 — COMBO / OVERDRIVE / BREAK
     ========================================================== */
  {
    id: 'combo_master',
    icon: '🔗',
    name: 'BẬC THẦY CHUỖI',
    desc: '+60% thời gian giữ combo · +0.6% ST mỗi stack',
    rarity: 'common',
    apply: (p) => {
      p.up.comboWindowMul = (p.up.comboWindowMul || 0) + 0.60;
      p.up.comboDmgMul = (p.up.comboDmgMul || 0) + 0.006;
    }
  },
  {
    id: 'overclock_core',
    icon: '⚙',
    name: 'LÕI QUÁ TẢI',
    desc: '+40% tốc nạp Overdrive',
    rarity: 'common',
    apply: (p) => { p.up.odGainMul = (p.up.odGainMul || 0) + 0.40; }
  },
  {
    id: 'overdrive_ext',
    icon: '⏱',
    name: 'KÉO DÀI QUÁ TẢI',
    desc: '+2.5s thời gian Overdrive',
    rarity: 'rare',
    apply: (p) => { p.up.odDurAdd = (p.up.odDurAdd || 0) + 2.5; }
  },
  {
    id: 'breaker',
    icon: '🔨',
    name: 'PHÁ GIÁP',
    desc: '+60% sát thương lên thanh cân bằng (poise)',
    rarity: 'common',
    apply: (p) => { p.up.poiseMul = (p.up.poiseMul || 0) + 0.60; }
  },
  {
    id: 'executioner',
    icon: '☠',
    name: 'ĐAO PHỦ',
    desc: '+45% sát thương lên mục tiêu dưới 35% máu',
    rarity: 'rare',
    apply: (p) => { p.up.executeMul = (p.up.executeMul || 0) + 0.45; }
  },
  {
    id: 'vulture',
    icon: '🦅',
    name: 'KẺ ĂN XÁC',
    desc: 'Hồi 1.2% máu mỗi mạng hạ gục',
    rarity: 'common',
    apply: (p) => { p.up.killHeal = (p.up.killHeal || 0) + 0.012; }
  },
  {
    id: 'chain_add',
    icon: '🌩',
    name: 'DÂY SÉT',
    desc: '+1 mục tiêu lan của sét',
    rarity: 'rare',
    apply: (p) => { p.up.chainAdd = (p.up.chainAdd || 0) + 1; }
  },

  /* ==========================================================
     NHÓM 10 — RARE (PURE BUFF)
     ========================================================== */
  {
    id: 'rare_god_heart',
    icon: '💖',
    name: '⭐ TRÁI TIM CHIẾN THẦN',
    desc: '+20% máu tối đa · +15% sát thương',
    rarity: 'rare',
    apply: (p) => {
      p.maxHp = Math.round(p.maxHp * 1.20);
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.20);
      p.up.maxHpMul += 0.20;
      p.up.damageMul += 0.15;
    }
  },
  {
    id: 'rare_eye_of_god',
    icon: '👁',
    name: '⭐ MẮT THẦN',
    desc: '+15% chí mạng · +30% sát thương chí mạng',
    rarity: 'rare',
    apply: (p) => {
      p.up.critChance += 0.15;
      p.up.critMul += 0.30;
    }
  },
  {
    id: 'rare_dragon_skin',
    icon: '🐲',
    name: '⭐ LỚP DA RỒNG',
    desc: '+20% máu · +15% giáp · +10% hồi máu tự nhiên',
    rarity: 'rare',
    apply: (p) => {
      p.maxHp = Math.round(p.maxHp * 1.20);
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.20);
      p.up.maxHpMul += 0.20;
      p.up.armor = Math.min(0.82, p.up.armor + 0.15);
      p.up.regen = (p.up.regen || 0) + 0.10;
    }
  },
  {
    id: 'rare_ares_wrath',
    icon: '⚔',
    name: '⭐ CƠN THỊNH NỘ CỦA ARES',
    desc: '+15% tốc bắn · +15% sát thương · +10% tốc chạy',
    rarity: 'rare',
    apply: (p) => {
      p.up.attackSpeedMul += 0.15;
      p.up.damageMul += 0.15;
      p.up.speedMul += 0.10;
      p.speed *= 1.10;
    }
  },
  {
    id: 'rare_blood_sword',
    icon: '🗡',
    name: '⭐ HUYẾT KIẾM',
    desc: '+15% chí mạng · +20% xuyên giáp · +5% hút máu',
    rarity: 'rare',
    apply: (p) => {
      p.up.critChance += 0.15;
      p.up.armorPen = (p.up.armorPen || 0) + 0.20;
      p.up.lifesteal += 0.05;
    }
  },
  {
    id: 'rare_plague_heart',
    icon: '🦠',
    name: '⭐ TIM DỊCH BỆNH',
    desc: '+80% sức mạnh trạng thái · +40% thời gian trạng thái',
    rarity: 'rare',
    apply: (p) => {
      p.up.statusPowerMul = (p.up.statusPowerMul || 0) + 0.80;
      p.up.statusDurMul = (p.up.statusDurMul || 0) + 0.40;
    }
  },

  /* ==========================================================
     NHÓM 11 — EPIC (BUILD-DEFINING)
     ========================================================== */
  {
    id: 'epic_momentum_engine',
    icon: '🚀',
    name: '⭐ ĐỘNG CƠ ĐÀ QUÁN TÍNH',
    desc: '+1.2% ST mỗi stack combo · +80% thời gian combo',
    rarity: 'epic',
    apply: (p) => {
      p.up.comboDmgMul = (p.up.comboDmgMul || 0) + 0.012;
      p.up.comboWindowMul = (p.up.comboWindowMul || 0) + 0.80;
    }
  },
  {
    id: 'epic_perpetual',
    icon: '♾',
    name: '⭐ ĐỘNG CƠ VĨNH CỬU',
    desc: '+70% tốc nạp Overdrive · +3s thời gian',
    rarity: 'epic',
    apply: (p) => {
      p.up.odGainMul = (p.up.odGainMul || 0) + 0.70;
      p.up.odDurAdd = (p.up.odDurAdd || 0) + 3.0;
    }
  },
  {
    id: 'epic_shatter',
    icon: '💠',
    name: '⭐ PHÁ VỠ TUYỆT ĐỐI',
    desc: '+120% sát thương poise · +35% ST lên mục tiêu vỡ giáp',
    rarity: 'epic',
    apply: (p) => {
      p.up.poiseMul = (p.up.poiseMul || 0) + 1.20;
      p.up.breakDmgMul = (p.up.breakDmgMul || 0) + 0.35;
    }
  },
  {
    id: 'epic_apocalypse',
    icon: '☄',
    name: '⭐ THẢM HỌA KÉP',
    desc: '+45% sát thương · +30% bán kính nổ · -10% tốc chạy',
    rarity: 'epic',
    apply: (p) => {
      p.up.damageMul += 0.45;
      p.up.splashMul = (p.up.splashMul || 0) + 0.30;
      p.up.speedMul = Math.max(-0.7, p.up.speedMul - 0.10);
      p.speed *= 0.90;
    }
  }
];

/* =========================================================
   HELPERS NỘI BỘ
   ========================================================= */

function _reduceMaxHp(p, pct) {
  const reduce = Math.round(p.maxHp * pct);
  p.maxHp = Math.max(30, p.maxHp - reduce);
  p.hp = Math.min(p.hp, p.maxHp);
}

function _recalcMagazine(p) {
  if (!p.baseMagazine) return;
  const mul = Math.max(0.2, 1 + (p.up.magazineMul || 0));
  const newMax = Math.max(1, Math.round(p.baseMagazine * mul));
  const delta = newMax - p.magMax;
  p.magMax = newMax;
  p.magAmmo = Math.max(0, Math.min(newMax, p.magAmmo + Math.max(0, delta)));
}

/* =========================================================
   PUBLIC HELPERS
   ========================================================= */

export const UPGRADE_BY_ID = Object.fromEntries(
  UPGRADES.map((u) => [u.id, u])
);

/* Tỉ lệ rarity mỗi slot */
const RARITY_ROLL = [
  { r: 'epic',   p: .04 },
  { r: 'rare',   p: .18 },
  { r: 'common', p: .78 }
];

function rollRarity(luck = 0) {
  const ep = RARITY_ROLL[0].p * (1 + luck * .6);
  const ra = RARITY_ROLL[1].p * (1 + luck * .4);
  const x = Math.random();
  if (x < ep) return 'epic';
  if (x < ep + ra) return 'rare';
  return 'common';
}

/**
 * Pick N upgrade ngẫu nhiên không trùng.
 * `luck` đẩy tỉ lệ rare/epic lên.
 */
export function pickUpgrades(n = 3, exclude = [], luck = 0) {
  const pool = UPGRADES.filter((u) => !exclude.includes(u.id));
  if (pool.length === 0) return [];

  const byRarity = { common: [], rare: [], epic: [] };
  for (const u of pool) {
    const k = byRarity[u.rarity] ? u.rarity : 'common';
    byRarity[k].push(u);
  }

  for (const k in byRarity) shuffleInPlace(byRarity[k]);

  const out = [];
  const used = new Set();

  for (let i = 0; i < n; i++) {
    const want = rollRarity(luck);

    /* thử rarity mong muốn trước, fallback dần */
    const order = want === 'epic'
      ? ['epic', 'rare', 'common']
      : want === 'rare'
        ? ['rare', 'common', 'epic']
        : ['common', 'rare', 'epic'];

    let chosen = null;
    for (const r of order) {
      chosen = byRarity[r].find((u) => !used.has(u.id));
      if (chosen) break;
    }
    if (!chosen) break;

    out.push(chosen);
    used.add(chosen.id);
  }

  return out;
}

function shuffleInPlace(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/** Áp upgrade theo id lên player. */
export function applyUpgrade(id, player) {
  const u = UPGRADE_BY_ID[id];
  if (!u || typeof u.apply !== 'function') return false;
  u.apply(player);
  return true;
}
