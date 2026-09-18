/* =========================================================
   VNXX — CORE / INPUT
   Bàn phím + chuột. Không import Game/Sound → tránh vòng lặp.
   Game sẽ đăng ký callback qua Input.setKeyHandler(fn).
   ========================================================= */

/* ===================== MODULE STATE ===================== */
const Input = {
  keys:  Object.create(null),
  mouse: { x: 0, y: 0, wx: 0, wy: 0, down: false },

  /* Mobile */
  joystick: { active: false, dx: 0, dy: 0 },
  mobile:   { attack: false, interact: false },

  _keyHandler: null,                    // fn(key, event) do Game đặt
  _canvas: null,
  _unlocked: false,

  /* =========================================================
     INIT
     ========================================================= */
  init() {
    this._canvas = document.getElementById('game');
    if (!this._canvas) {
      console.warn('[Input] #game canvas not found — input disabled');
      return;
    }

    /* ---------- KEYBOARD ---------- */
    window.addEventListener('keydown', (e) => this._onKeyDown(e));
    window.addEventListener('keyup',   (e) => this._onKeyUp(e));
    window.addEventListener('blur',    ()  => { this.keys = Object.create(null); });

    /* ---------- MOUSE MOVE (chỉ trên canvas) ---------- */
    this._canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));

    /* ---------- MOUSE DOWN (window-level, filter UI) ---------- */
    window.addEventListener('mousedown', (e) => {
      /* Chỉ chuột TRÁI */
      if (e.button !== 0) return;

      /* Bỏ qua click vào UI (button, input, screen overlay...) */
      const t = e.target;
      if (t && t.closest) {
        const isUI = t.closest(
          '.screen, .btn, button, input, textarea, select, #tutorial, #hudSettingsBtn'
        );
        if (isUI) return;
      }

      this.mouse.down = true;
      this._emitAudioUnlock();
    });

    window.addEventListener('mouseup', (e) => {
      /* Chỉ chuột TRÁI — luôn reset khi nhả, kể cả nhả ngoài canvas */
      if (e.button !== 0) return;
      this.mouse.down = false;
    });

    /* Reset khi rời window (alt-tab, minimize...) */
    window.addEventListener('blur', () => {
      this.mouse.down = false;
    });

    /* ---------- BLOCK CONTEXT MENU ---------- */
    this._canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    /* ---------- TOUCH (cơ bản) ---------- */
    this._canvas.addEventListener('touchstart', (e) => {
      if (e.touches[0]) {
        this.mouse.down = true;
        const r = this._canvas.getBoundingClientRect();
        this.mouse.x = e.touches[0].clientX - r.left;
        this.mouse.y = e.touches[0].clientY - r.top;
      }
      this._emitAudioUnlock();
    }, { passive: true });

    this._canvas.addEventListener('touchmove', (e) => {
      if (e.touches[0]) {
        const r = this._canvas.getBoundingClientRect();
        this.mouse.x = e.touches[0].clientX - r.left;
        this.mouse.y = e.touches[0].clientY - r.top;
      }
    }, { passive: true });

    window.addEventListener('touchend', () => { this.mouse.down = false; });
  },

  /** Callback Game đăng ký để nhận sự kiện keydown (1 lần / phím). */
  setKeyHandler(fn) { this._keyHandler = fn; },

  /* =========================================================
     KEY HELPERS
     ========================================================= */
  _normalizeKey(e) {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  },

  _onKeyDown(e) {
    // Chặn scroll/space/tab làm trang nhảy
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
      e.preventDefault();
    }
    const k = this._normalizeKey(e);

    // Chống auto-repeat: chỉ fire handler lần đầu
    if (this.keys[k]) return;
    this.keys[k] = true;

    if (this._keyHandler) {
      try { this._keyHandler(k, e); }
      catch (err) { console.error('[Input] keyHandler error:', err); }
    }

    this._emitAudioUnlock();
  },

  _onKeyUp(e) {
    const k = this._normalizeKey(e);
    this.keys[k] = false;
  },

  /** Trả về true nếu bất kỳ phím nào trong danh sách đang được giữ. */
  isDown(...keys) {
    for (let i = 0; i < keys.length; i++) {
      if (this.keys[keys[i]]) return true;
    }
    return false;
  },

  /* =========================================================
     MOVEMENT VECTOR (đã chuẩn hoá)
     ========================================================= */
   moveVector() {
     /* Mobile joystick ưu tiên */
     if (this.joystick.active) {
       return { x: this.joystick.dx, y: this.joystick.dy };
     }

     /* Keyboard */
     let x = 0, y = 0;
     if (this.isDown('a', 'A', 'ArrowLeft'))  x -= 1;
     if (this.isDown('d', 'D', 'ArrowRight')) x += 1;
     if (this.isDown('w', 'W', 'ArrowUp'))    y -= 1;
     if (this.isDown('s', 'S', 'ArrowDown'))  y += 1;
     const l = Math.hypot(x, y);
     if (l > 0) { x /= l; y /= l; }
     return { x, y };
   },

  /* =========================================================
     MOUSE
     ========================================================= */
  _onMouseMove(e) {
    const r = this._canvas.getBoundingClientRect();
    this.mouse.x = e.clientX - r.left;
    this.mouse.y = e.clientY - r.top;
  },

  /** Gọi khi Game muốn reset vị trí chuột (đổi screen, resize…). */
  recenterMouse() {
    if (!this._canvas) return;
    const r = this._canvas.getBoundingClientRect();
    this.mouse.x = r.width / 2;
    this.mouse.y = r.height / 2;
  },

  /* =========================================================
     AUDIO UNLOCK (Chrome autoplay policy)
     ========================================================= */
  _emitAudioUnlock() {
    if (this._unlocked) return;
    this._unlocked = true;
    window.dispatchEvent(new CustomEvent('vnxx:user-gesture'));
  },

  /* =========================================================
     CLEANUP
     ========================================================= */
  reset() {
    this.keys = Object.create(null);
    this.mouse.down = false;
  }
};

export default Input;