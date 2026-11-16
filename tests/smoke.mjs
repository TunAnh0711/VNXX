/* =========================================================
   SMOKE TEST — HALF NIFE (headless Edge qua playwright-core)
   1. Boot game, thu console error + page error
   2. Verify main menu reactor hiển thị đúng
   3. Verify màn level-up KHÔNG còn bug nesting (panel > 0×0)
   4. Verify donate / settings screens hiển thị được
   5. Verify responsive mobile viewport
   6. Chụp screenshot menu + levelup
   ========================================================= */
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire('C:/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/');
const { chromium } = require('playwright-core');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(ROOT, 'screenshots');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.GAME_URL || 'http://localhost:3000';
const URL = BASE + '/index.html';

let pass = 0, fail = 0;
const fails = [];
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log('  [PASS] ' + name + (detail ? ' — ' + detail : '')); }
  else { fail++; fails.push(name + (detail ? ' — ' + detail : '')); console.log('  [FAIL] ' + name + (detail ? ' — ' + detail : '')); }
}

const browser = await chromium.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required']
});

const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });

const consoleErrors = [];
const pageErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
});
page.on('pageerror', (err) => pageErrors.push(String(err).slice(0, 300)));

console.log('== 1. BOOT ==');
await page.goto(URL, { waitUntil: 'load', timeout: 20000 });

// Bỏ qua intro nếu có
try {
  await page.waitForSelector('#screen-menu.active', { timeout: 12000 });
} catch {
  try {
    await page.click('.intro-skip', { timeout: 3000 });
    await page.waitForSelector('#screen-menu.active', { timeout: 8000 });
  } catch { /* ignore */ }
}
check('Menu reactor active sau boot', await page.evaluate(() => document.getElementById('screen-menu')?.classList.contains('active')));

await page.waitForTimeout(1200); // chờ animation boot

// Thu thập lỗi thực sự (bỏ qua favicon/resource 404 ngoài luồng)
const realErrors = [...pageErrors, ...consoleErrors.filter(e =>
  !/favicon|net::ERR_FILE_NOT_FOUND.*(favicon|assets\/.*\.mp3|\.ogg|\.wav)/i.test(e)
)];
check('Không có page error (uncaught exception)', pageErrors.length === 0, pageErrors.join(' | ') || 'clean');
if (realErrors.length) console.log('  (i) console errors: ' + realErrors.slice(0, 5).join(' | '));

console.log('== 2. MAIN MENU RENDER ==');
const menuInfo = await page.evaluate(() => {
  const el = document.getElementById('screen-menu');
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return { display: cs.display, opacity: cs.opacity, w: Math.round(r.width), h: Math.round(r.height) };
});
check('Menu hiển thị (display:flex, opacity:1)', menuInfo.display === 'flex' && menuInfo.opacity === '1', JSON.stringify(menuInfo));
check('Menu phủ toàn màn viewport', menuInfo.w >= 1400 && menuInfo.h >= 700, `${menuInfo.w}x${menuInfo.h}`);

const heroInfo = await page.evaluate(() => {
  const logo = document.querySelector('.hero-logo');
  const core = document.querySelector('.hero-core');
  const lr = logo?.getBoundingClientRect();
  const cr = core?.getBoundingClientRect();
  return {
    logo: lr ? `${Math.round(lr.width)}x${Math.round(lr.height)}` : 'null',
    core: cr ? `${Math.round(cr.width)}x${Math.round(cr.height)}` : 'null'
  };
});
check('Logo HALF NIFE hiển thị', heroInfo.logo !== 'null', heroInfo.logo);
check('Reactor core hiển thị', heroInfo.core !== 'null', heroInfo.core);

const dockCount = await page.evaluate(() => document.querySelectorAll('.menu-dock .dock-btn').length);
check('Dock có đủ 8 nút điều hướng', dockCount === 8, String(dockCount));

const glitchInfo = await page.evaluate(() => {
  const hl = document.querySelector('.hl-half');
  if (!hl) return null;
  const before = getComputedStyle(hl, '::before');
  const after = getComputedStyle(hl, '::after');
  return { beforeColor: before.color, afterColor: after.color, beforeAnim: before.animationName, afterAnim: after.animationName };
});
check('Logo glitch RGB pseudo-elements chạy', glitchInfo && glitchInfo.beforeAnim !== 'none' && glitchInfo.afterAnim !== 'none', JSON.stringify(glitchInfo));

await page.screenshot({ path: path.join(SHOTS, 'menu_smoke.png') });

console.log('== 3. LEVEL-UP SCREEN (regression nesting bug) ==');
const levelupInfo = await page.evaluate(() => {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-levelup');
  el.classList.add('active');
  const panel = el.querySelector('.levelup-panel');
  let p = el.parentElement, nested = false;
  while (p) { if (p.classList?.contains('screen') && p !== el) { nested = true; break; } p = p.parentElement; }
  return { nested, parentId: el.parentElement?.id || el.parentElement?.tagName };
});
check('Level-up screen KHONG nam trong screen khac', !levelupInfo.nested, 'parent=' + levelupInfo.parentId);
await page.waitForTimeout(400); // cho animation screen-boot (0.22s) chay xong

// Render 3 card that nhu showLevelUp roi do panel SAU khi co cards
const cardInfo = await page.evaluate(() => {
  const wrap = document.getElementById('levelupCards');
  wrap.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'card upgrade-card ' + (i === 1 ? 'rare' : 'common');
    b.innerHTML = '<span class="card-key">' + (i + 1) + '</span><span class="card-rarity">' + (i === 1 ? 'HIEM' : 'THUONG') + '</span><div class="ci">◆</div><div class="cn">TEST ' + (i + 1) + '</div><div class="cd">Mo ta nang cap</div><div class="card-choose"><span>CHON NANG CAP</span><b>⏎</b></div>';
    wrap.appendChild(b);
  }
  const cards = [...wrap.querySelectorAll('.card')];
  const r0 = cards[0].getBoundingClientRect();
  const el = document.elementFromPoint(r0.x + r0.width / 2, r0.y + r0.height / 2);
  const panel = document.querySelector('.levelup-panel').getBoundingClientRect();
  const screen = document.getElementById('screen-levelup');
  return {
    count: cards.length,
    card0: `${Math.round(r0.width)}x${Math.round(r0.height)}`,
    clickable: el?.classList?.contains('card') === true,
    hitTag: el?.tagName + '.' + (el?.className || ''),
    panel: `${Math.round(panel.width)}x${Math.round(panel.height)}`,
    screenOpacity: getComputedStyle(screen).opacity
  };
});
check('Level-up screen hien thi (opacity gan 1)', parseFloat(cardInfo.screenOpacity) >= 0.9, 'opacity=' + cardInfo.screenOpacity);
check('Level-up panel du lon khi co cards', (() => { const [w, h] = cardInfo.panel.split('x').map(Number); return w > 800 && h > 400; })(), cardInfo.panel);
check('3 card render day du', cardInfo.count === 3);
check('Card du lon va click duoc bang chuot (elementFromPoint)', cardInfo.clickable, `${cardInfo.card0} → ${cardInfo.hitTag}`);

await page.screenshot({ path: path.join(SHOTS, 'levelup_smoke.png') });

console.log('== 4. DONATE + SETTINGS SCREENS ==');
for (const [id, sel] of [['screen-donate', '.donate-qr-wrap'], ['screen-settings', '#swSfx']]) {
  const info = await page.evaluate(({ id, sel }) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    el.classList.add('active');
    const panel = el.querySelector('.panel');
    const r = panel?.getBoundingClientRect();
    const sub = el.querySelector(sel);
    return { w: Math.round(r?.width || 0), h: Math.round(r?.height || 0), sub: !!sub };
  }, { id, sel });
  check(`${id} hiển thị (panel ${info.w}x${info.h}, element: ${info.sub})`, info.w > 300 && info.h > 200 && info.sub);
}

console.log('== 5. MOBILE VIEWPORT (390x844) ==');
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(600);
const mobileInfo = await page.evaluate(() => {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-menu').classList.add('active');
  const dock = document.querySelector('.menu-dock').getBoundingClientRect();
  const logo = document.querySelector('.hero-logo').getBoundingClientRect();
  const intel = getComputedStyle(document.querySelector('.menu-intel')).display;
  return { dock: `${Math.round(dock.width)}x${Math.round(dock.height)}`, logo: Math.round(logo.width), intel };
});
check('Mobile: dock hiển thị gọn trong 390px', (() => { const w = parseInt(mobileInfo.dock); return w >= 300 && w <= 390; })(), mobileInfo.dock);
check('Mobile: logo scale theo viewport', mobileInfo.logo > 200 && mobileInfo.logo < 390, 'w=' + mobileInfo.logo);
check('Mobile: intel panel ẩn (theo menu.css responsive)', mobileInfo.intel === 'none', mobileInfo.intel);
await page.screenshot({ path: path.join(SHOTS, 'menu_mobile_smoke.png'), fullPage: false });

console.log('== 6. FULLSCREEN TOGGLE ELEMENT ==');
const fsBtn = await page.evaluate(() => !!document.getElementById('fsToggle'));
check('Nút fullscreen tồn tại', fsBtn);

await browser.close();

console.log('\n' + '='.repeat(56));
console.log(`SMOKE TEST: ${pass} pass · ${fail} fail`);
if (fails.length) { console.log('FAILED:'); fails.forEach(f => console.log('  - ' + f)); }
console.log('='.repeat(56));
process.exit(fail > 0 ? 1 : 0);
