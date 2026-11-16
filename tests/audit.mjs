/* =========================================================
   AUDIT TOÀN DIỆN v2 — HALF NIFE
   1. Parse HTML stack-based (fixed screen tracking + void tags)
   2. Phát hiện screen lồng trong screen (bug level-up trước đây)
   3. Đối chiếu ID: HTML <-> JS getElementById/querySelector
   4. Đối chiếu class: HTML <-> CSS (orphan + dead)
   5. Verify import path trong JS có file thật không
   6. Syntax check bằng `node --check` (thay vì tự đếm ngoặc)
   ========================================================= */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const NODE = 'C:/Users/admin/.workbuddy-ai/binaries/node/versions/22.22.2-6/node.exe';

let errors = 0;
let warns = 0;
const results = { errors: [], warns: [], ok: [] };
function err(msg) { errors++; results.errors.push(msg); }
function warn(msg) { warns++; results.warns.push(msg); }
function ok(msg) { results.ok.push(msg); }

/* ---------- 1. Parse HTML bằng stack ---------- */
const htmlPath = path.join(ROOT, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// Xóa comment để không parse nhầm thẻ mẫu trong comment
const htmlNoComments = html.replace(/<!--[\s\S]*?-->/g, '');

const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'source', 'area', 'base', 'col', 'embed', 'track', 'wbr']);
const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^"'>])*)>/g;

const stack = [];
const screenStack = []; // { id, depth } — depth = stack.length SAU KHI push div screen
let m;
const htmlIds = new Set();
const dupIds = [];
const screensFound = [];

while ((m = tagRe.exec(htmlNoComments)) !== null) {
  const [full, slash, tagRaw, attrs] = m;
  const tag = tagRaw.toLowerCase();
  const isClose = slash === '/';
  const isSelf = full.endsWith('/>');

  // Thu thập id/class cho MỌI thẻ (kể cả void)
  const idM = attrs.match(/id="([^"]+)"/);
  if (idM) {
    if (htmlIds.has(idM[1])) dupIds.push(idM[1]);
    htmlIds.add(idM[1]);
  }
  if (isSelf || VOID.has(tag)) continue;

  if (isClose) {
    const idx = stack.lastIndexOf(tag);
    if (idx === -1) {
      err(`Thẻ đóng </${tag}> không có thẻ mở tương ứng`);
      continue;
    }
    if (idx !== stack.length - 1) {
      err(`Thẻ <${tag}> đóng không đúng thứ tự — lồng lệch tại [${stack.slice(idx).join(' > ')}]`);
    }
    // Nếu div đang đóng chính là screen → pop screenStack
    if (tag === 'div' && screenStack.length && screenStack[screenStack.length - 1].depth === idx + 1) {
      screenStack.pop();
    }
    stack.length = idx;
    continue;
  }

  // Opening tag
  stack.push(tag);
  if (tag === 'div' && /class="[^"]*\bscreen\b/.test(attrs)) {
    const sid = idM ? idM[1] : '(no-id)';
    if (screenStack.length) {
      err(`BUG NESTING: #${sid} đang nằm TRONG #${screenStack[screenStack.length - 1].id} — màn này sẽ vô hình khi màn ngoài display:none`);
    }
    screenStack.push({ id: sid, depth: stack.length });
    screensFound.push(sid);
  }
}

if (stack.length > 0) err(`Thẻ chưa đóng: [${stack.join(' > ')}]`);
if (dupIds.length) err(`ID trùng lặp: ${[...new Set(dupIds)].join(', ')}`);
if (screenStack.length > 0) err(`Screen chưa đóng: ${screenStack.map(s => '#' + s.id).join(', ')}`);

if (!errors) ok(`Cấu trúc HTML hợp lệ — ${screensFound.length} screen, không có screen nào lồng trong screen khác, không có thẻ lồng lệch`);

/* ---------- 2. ID: HTML <-> JS ---------- */
function walkJs(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkJs(p));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}
const jsFiles = walkJs(path.join(ROOT, 'js'));

const usedIds = new Set();
for (const f of jsFiles) {
  const src = fs.readFileSync(f, 'utf8');
  let mm;
  const re1 = /getElementById\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  while ((mm = re1.exec(src))) usedIds.add(mm[1]);
  const re2 = /querySelector(?:All)?\(\s*['"`]#([A-Za-z0-9_-]+)[^'"`]*['"`]\s*\)/g;
  while ((mm = re2.exec(src))) usedIds.add(mm[1]);
}

const missingIds = [...usedIds].filter(id => !htmlIds.has(id));
if (missingIds.length) err(`JS dùng ID không tồn tại trong HTML: ${missingIds.join(', ')}`);
else ok(`Tất cả ${usedIds.size} ID được JS tham chiếu đều tồn tại trong HTML`);

/* ---------- 3. class HTML <-> CSS ---------- */
const htmlClasses = new Set();
const classRe = /class="([^"]+)"/g;
while ((m = classRe.exec(htmlNoComments))) {
  m[1].split(/\s+/).forEach(c => c && htmlClasses.add(c));
}
for (const f of jsFiles) {
  const src = fs.readFileSync(f, 'utf8');
  const re = /classList\.(?:add|toggle|remove)\(\s*['"`]([^'"`]+)['"`]/g;
  let mm;
  while ((mm = re.exec(src))) htmlClasses.add(mm[1]);
}

const cssFiles = [];
for (const e of fs.readdirSync(path.join(ROOT, 'css'))) {
  if (e.endsWith('.css')) cssFiles.push(path.join(ROOT, 'css', e));
}
const cssText = cssFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');

const orphanClasses = [...htmlClasses].filter(c =>
  !new RegExp('\\.' + c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(cssText)
);
if (orphanClasses.length) {
  warn(`Class dùng trong HTML/JS nhưng KHÔNG có rule CSS (${orphanClasses.length}): ${orphanClasses.slice(0, 20).join(', ')}${orphanClasses.length > 20 ? '…' : ''}`);
} else {
  ok('Tất cả class HTML/JS đều có rule CSS tương ứng');
}

const cssClassSel = new Set();
const cssSelRe = /\.([a-zA-Z][a-zA-Z0-9_-]{2,})/g;
while ((m = cssSelRe.exec(cssText))) cssClassSel.add(m[1]);
const deadCss = [...cssClassSel].filter(c =>
  !htmlClasses.has(c) &&
  !/-(hover|active|focus|on|open|selected|locked|danger|primary|hidden|small|big|glow|rare|epic|common|rare)$/.test(c)
);
if (deadCss.length) {
  warn(`CSS selector không thấy class trong HTML (có thể dead/dộng, ${deadCss.length}): ${deadCss.slice(0, 25).join(', ')}${deadCss.length > 25 ? '…' : ''}`);
}

/* ---------- 4. Import paths ---------- */
const badImports = [];
for (const f of jsFiles) {
  const src = fs.readFileSync(f, 'utf8');
  const re = /(?:import|export)[^'"]*from\s*['"](\.[^'"]+)['"]/g;
  let mm;
  while ((mm = re.exec(src))) {
    const target = path.resolve(path.dirname(f), mm[1]);
    if (!fs.existsSync(target)) badImports.push(`${path.relative(ROOT, f)} → ${mm[1]}`);
  }
}
if (badImports.length) err(`Import không tồn tại:\n  ${badImports.join('\n  ')}`);
else ok(`Tất cả import trong ${jsFiles.length} file JS đều hợp lệ`);

/* ---------- 5. Syntax check bằng node --check ---------- */
const syntaxBad = [];
for (const f of jsFiles) {
  try {
    execFileSync(NODE, ['--check', f], { stdio: 'pipe' });
  } catch (e) {
    syntaxBad.push(path.relative(ROOT, f));
  }
}
if (syntaxBad.length) err(`Syntax error:\n  ${syntaxBad.join('\n  ')}`);
else ok(`Syntax check ${jsFiles.length}/${jsFiles.length} file JS đều hợp lệ (node --check)`);

/* ---------- 6. CSS cơ bản: balance ---------- */
for (const f of cssFiles) {
  const src = fs.readFileSync(f, 'utf8');
  const open = (src.match(/{/g) || []).length;
  const close = (src.match(/}/g) || []).length;
  if (open !== close) err(`CSS mất cân bằng ngoặc: ${path.relative(ROOT, f)} (${open} { vs ${close} })`);
}
if (!results.errors.some(e => e.includes('CSS mất cân bằng'))) ok(`Cân bằng ngoặc ${cssFiles.length} file CSS OK`);

/* ---------- REPORT ---------- */
console.log('='.repeat(60));
console.log('AUDIT REPORT v2 — HALF NIFE');
console.log('='.repeat(60));
console.log(`\nPASS (${results.ok.length}):`);
results.ok.forEach(o => console.log('  [OK] ' + o));
if (results.warns.length) {
  console.log(`\nWARN (${results.warns.length}):`);
  results.warns.forEach(w => console.log('  [!] ' + w));
}
if (results.errors.length) {
  console.log(`\nERROR (${results.errors.length}):`);
  results.errors.forEach(e => console.log('  [X] ' + e));
} else {
  console.log('\nERROR (0) — khong co loi nghiem trong');
}
console.log('\n' + '='.repeat(60));
console.log(`TONG: ${results.ok.length} pass · ${results.warns.length} warn · ${results.errors.length} error`);
console.log('='.repeat(60));

fs.writeFileSync(path.join(ROOT, 'tests', 'audit-report.json'), JSON.stringify(results, null, 2));
process.exit(results.errors.length > 0 ? 1 : 0);
