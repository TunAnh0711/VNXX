/* =========================================================
   HALF NIFE — MENU FX SYSTEM
   Particle overlay, button ripple, glitch transitions,
   cinematic UI feel. Runs only when menu screens are active.
   ========================================================= */

let _running = false;
let _canvas = null;
let _ctx = null;
let _particles = [];
let _ripples = [];
let _w = 0;
let _h = 0;
let _rAF = 0;

/* ---------------------------------------------------------
   INIT
   --------------------------------------------------------- */
export function initMenuFX() {
  _canvas = document.getElementById('menuParticleCanvas');
  if (!_canvas) return;

  _resize();
  window.addEventListener('resize', _resize);

  /* Chỉ chạy khi menu screen active để tiết kiệm pin/GPU */
  const observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.target.id === 'screen-menu' || m.target.id === 'screen-lan') {
        _checkActive();
      }
    }
  });
  const menu = document.getElementById('screen-menu');
  const lan = document.getElementById('screen-lan');
  if (menu) observer.observe(menu, { attributes: true, attributeFilter: ['class'] });
  if (lan) observer.observe(lan, { attributes: true, attributeFilter: ['class'] });

  _bindRipples();
  _checkActive();
}

function _resize() {
  if (!_canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  _w = _canvas.clientWidth || window.innerWidth;
  _h = _canvas.clientHeight || window.innerHeight;
  _canvas.width = Math.floor(_w * dpr);
  _canvas.height = Math.floor(_h * dpr);
  _ctx = _canvas.getContext('2d');
  if (_ctx) _ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function _checkActive() {
  const active =
    document.getElementById('screen-menu')?.classList.contains('active') ||
    document.getElementById('screen-lan')?.classList.contains('active') ||
    document.getElementById('screen-wardrobe')?.classList.contains('active') ||
    document.getElementById('screen-settings')?.classList.contains('active') ||
    document.getElementById('screen-achievements')?.classList.contains('active');

  if (active && !_running) {
    _running = true;
    _loop();
  } else if (!active && _running) {
    _running = false;
    cancelAnimationFrame(_rAF);
  }
}

/* ---------------------------------------------------------
   PARTICLES — Floating dust / data-stream
   --------------------------------------------------------- */
class Particle {
  constructor() {
    this.reset();
  }
  reset() {
    this.x = Math.random() * _w;
    this.y = Math.random() * _h;
    this.vx = (Math.random() - 0.5) * 0.4;
    this.vy = -Math.random() * 0.6 - 0.15;
    this.size = Math.random() * 2 + 0.5;
    this.alpha = Math.random() * 0.35 + 0.1;
    this.life = Math.random() * 300 + 200;
    this.maxLife = this.life;
    const colors = ['rgba(40,224,255,', 'rgba(57,255,158,', 'rgba(255,196,77,'];
    this.colorBase = colors[Math.floor(Math.random() * colors.length)];
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
    if (this.life <= 0 || this.y < -10) this.reset();
  }
  draw(ctx) {
    const a = this.alpha * (this.life / this.maxLife);
    ctx.fillStyle = this.colorBase + a + ')';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ---------------------------------------------------------
   RIPPLES — Expanding rings on button click
   --------------------------------------------------------- */
class Ripple {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = 2;
    this.alpha = 0.45;
    this.speed = 2.5;
  }
  update() {
    this.r += this.speed;
    this.alpha -= 0.012;
  }
  draw(ctx) {
    if (this.alpha <= 0) return;
    ctx.strokeStyle = 'rgba(40,224,255,' + this.alpha + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/* ---------------------------------------------------------
   LOOP
   --------------------------------------------------------- */
function _loop() {
  if (!_running || !_ctx) return;

  /* Khởi tạo particle pool */
  if (_particles.length === 0) {
    for (let i = 0; i < 70; i++) _particles.push(new Particle());
  }

  _ctx.clearRect(0, 0, _w, _h);

  for (const p of _particles) {
    p.update();
    p.draw(_ctx);
  }

  for (let i = _ripples.length - 1; i >= 0; i--) {
    const r = _ripples[i];
    r.update();
    r.draw(_ctx);
    if (r.alpha <= 0) _ripples.splice(i, 1);
  }

  _rAF = requestAnimationFrame(_loop);
}

/* ---------------------------------------------------------
   RIPPLE BINDING
   --------------------------------------------------------- */
function _bindRipples() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button, .btn, .diff-opt, .card, .skin-card, .inv-slot');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    _ripples.push(new Ripple(x, y));

    /* Thêm DOM ripple nếu là .btn */
    if (btn.classList.contains('btn') || btn.classList.contains('btn-3d')) {
      _addDomRipple(btn, e.clientX - rect.left, e.clientY - rect.top);
    }
  });
}

function _addDomRipple(btn, localX, localY) {
  const el = document.createElement('span');
  el.className = 'btn-ripple-effect';
  const size = Math.max(btn.offsetWidth, btn.offsetHeight) * 1.2;
  el.style.width = size + 'px';
  el.style.height = size + 'px';
  el.style.left = (localX - size / 2) + 'px';
  el.style.top = (localY - size / 2) + 'px';
  btn.appendChild(el);
  setTimeout(() => el.remove(), 600);
}

/* ---------------------------------------------------------
   GLITCH TRANSITION
   Gọi trước khi showScreen để kích hoạt hiệu ứng giật.
   --------------------------------------------------------- */
export function triggerGlitch(el) {
  if (!el) return;
  el.classList.remove('glitch-in');
  void el.offsetWidth; /* force reflow */
  el.classList.add('glitch-in');
  setTimeout(() => el.classList.remove('glitch-in'), 400);
}

/* ---------------------------------------------------------
   SCANLINE WIPE
   --------------------------------------------------------- */
export function triggerScanWipe(el) {
  if (!el) return;
  el.classList.remove('scan-in');
  void el.offsetWidth;
  el.classList.add('scan-in');
  setTimeout(() => el.classList.remove('scan-in'), 300);
}

export default { initMenuFX, triggerGlitch, triggerScanWipe };
