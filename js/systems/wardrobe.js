/* =========================================================
   HALF NIFE — SYSTEMS / WARDROBE
   Quản lý trang phục đang mặc. Tách khỏi profile để renderer
   đọc mỗi frame mà không cần biết tới save system.

   Luồng:
   - Game.buildWorld()  → Wardrobe.load(profile)
   - Wardrobe UI        → Wardrobe.set(profile, id)
   - Renderer           → Wardrobe.skin
   ========================================================= */

import { getSkin, isSkinUnlocked, DEFAULT_SKIN, SKINS } from '../data/skins.js';

const Wardrobe = {
  _id: DEFAULT_SKIN,
  _profile: null,
  _listeners: new Set(),

  /** Nạp trang phục từ profile (gọi mỗi lần vào game). */
  load(profile) {
    this._profile = profile || null;
    const want = profile && profile.skin;
    const id = (want && SKINS[want] && isSkinUnlocked(want, profile)) ? want : DEFAULT_SKIN;
    const changed = id !== this._id;
    this._id = id;
    if (profile) profile.skin = id;
    if (changed) this._emit();
    return this._id;
  },

  get id() { return this._id; },

  /** Object skin đầy đủ — renderer dùng trực tiếp. */
  get skin() { return getSkin(this._id); },

  /** Đổi trang phục. Trả về true nếu thành công. */
  set(profile, id) {
    const s = SKINS[id];
    if (!s) return false;
    if (!isSkinUnlocked(id, profile)) return false;
    if (this._id === id) return true;
    this._id = id;
    if (profile) profile.skin = id;
    this._emit();
    return true;
  },

  /** Lấy skin theo id mà không đổi trang phục đang mặc (preview). */
  preview(id) { return getSkin(id); },

  /** Đăng ký callback khi đổi trang phục. */
  onChange(fn) {
    if (typeof fn === 'function') this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  },

  _emit() {
    const s = this.skin;
    for (const fn of this._listeners) {
      try { fn(s); } catch (err) { console.warn('[Wardrobe] listener failed', err); }
    }
  }
};

export default Wardrobe;
