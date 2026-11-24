#!/usr/bin/env node
/* Build Lịch Việt: src/ -> dist/
 *  - mọi file .js trong src (trừ sw.js): terser (nén) rồi javascript-obfuscator (làm rối mức vừa phải)
 *  - sw.js: chỉ nén nhẹ (không làm rối để tránh lỗi cập nhật), điền mã phiên bản và danh sách file cache
 *  - index.html và mọi file .css: nén khoảng trắng và chú thích
 *  - các file còn lại (holidays.json, manifest.json, icons, _headers): chép nguyên
 * Host nào cũng chỉ cần: lệnh build "npm run build", thư mục xuất "dist" (Netlify, Cloudflare Pages, Vercel...). */
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const DIST = path.join(__dirname, 'dist');

// ALLOW_NO_MINIFY=1 chỉ dùng khi thử build trên máy chưa cài gói. Trên host KHÔNG đặt biến này.
const SOFT = process.env.ALLOW_NO_MINIFY === '1';
let terser = null, Obfuscator = null;
try {
  terser = require('terser');
  Obfuscator = require('javascript-obfuscator');
} catch (e) {
  if (!SOFT) {
    console.error('Thiếu gói terser hoặc javascript-obfuscator. Chạy "npm install" trước khi build.');
    process.exit(1);
  }
  console.warn('[cảnh báo] Thiếu terser/javascript-obfuscator: bỏ qua bước nén và làm rối (chỉ dùng để thử).');
}

const now = new Date();
const vn = new Date(now.getTime() + 7 * 3600 * 1000);
// Mã commit: thử biến của từng host (Netlify, Cloudflare Pages, Vercel, GitHub Actions), rồi tới git, cuối cùng là "local"
function getCommit() {
  const e = process.env;
  const fromEnv = e.COMMIT_REF || e.CF_PAGES_COMMIT_SHA || e.VERCEL_GIT_COMMIT_SHA || e.GITHUB_SHA;
  if (fromEnv) return fromEnv;
  try {
    return require('child_process')
      .execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim() || 'local';
  } catch (err) {
    return 'local';
  }
}
const commit = getCommit().slice(0, 7);
const stamp = vn.toISOString().slice(0, 16).replace('T', ' ');
const APP_VERSION = commit + ' · ' + stamp;
const BUILD_ID = commit + '-' + now.getTime().toString(36);

const OBF = {
  compact: true,
  simplify: true,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  renameProperties: false,
  transformObjectKeys: false,
  stringArray: true,
  stringArrayThreshold: 0.75,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayEncoding: [],
  splitStrings: false,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  selfDefending: false,
  debugProtection: false,
  disableConsoleOutput: false,
  unicodeEscapeSequence: false,
  target: 'browser',
  sourceMap: false
};

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    const a = path.join(from, name), b = path.join(to, name);
    if (fs.statSync(a).isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  }
}
function listFiles(dir, base) {
  base = base || dir;
  let out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) out = out.concat(listFiles(p, base));
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out.sort();
}
const read = (f) => fs.readFileSync(path.join(DIST, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(DIST, f), s);

async function minify(code, name) {
  if (!terser) return code;
  const r = await terser.minify(code, { compress: true, mangle: true, format: { comments: false } });
  if (r.error || !r.code) throw new Error('terser lỗi ở ' + name + ': ' + (r.error || 'không có kết quả'));
  return r.code;
}
function obfuscate(code, name) {
  if (!Obfuscator) return code;
  return Obfuscator.obfuscate(code, OBF).getObfuscatedCode();
}

function minHtml(s) {
  return s.replace(/<!--[\s\S]*?-->/g, '').replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ').trim();
}
function minCss(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};,])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}

(async () => {
  rmrf(DIST);
  copyDir(SRC, DIST);

  // JS ứng dụng: nén rồi làm rối
  // Tự lấy mọi file .js trong src (trừ sw.js), nên build.js giống hệt nhau ở cả 3 repo
  const jsFiles = fs.readdirSync(DIST).filter((f) => f.endsWith('.js') && f !== 'sw.js');
  for (const f of jsFiles) {
    let code = read(f).split('__APP_VERSION__').join(APP_VERSION);
    code = await minify(code, f);
    code = obfuscate(code, f);
    write(f, code);
  }

  // Giao diện
  write('index.html', minHtml(read('index.html')));
  for (const f of fs.readdirSync(DIST).filter((n) => n.endsWith('.css'))) write(f, minCss(read(f)));

  // Service worker: điền phiên bản và danh sách file, chỉ nén nhẹ
  const assets = ['./'].concat(listFiles(DIST).filter((f) => f !== 'sw.js' && f !== '_headers' && f !== 'giapha.enc.json'));
  let sw = read('sw.js').split('__BUILD__').join(BUILD_ID);
  const re = /\/\*__ASSETS__\*\/\s*\[[\s\S]*?\]/;
  if (!re.test(sw)) throw new Error('Không tìm thấy mốc ASSETS trong sw.js');
  sw = sw.replace(re, JSON.stringify(assets));
  write('sw.js', await minify(sw, 'sw.js'));

  // Kiểm tra sau build
  const problems = [];
  if (/__APP_VERSION__|__BUILD__|__ASSETS__/.test(jsFiles.map(read).join('') + read('sw.js'))) problems.push('còn sót mốc thay thế');
  if (!read('sw.js').includes(BUILD_ID)) problems.push('sw.js thiếu mã phiên bản');
  for (const f of assets) if (f !== './' && !fs.existsSync(path.join(DIST, f))) problems.push('thiếu file ' + f);
  if (!fs.existsSync(path.join(DIST, 'manifest.json'))) problems.push('thiếu manifest.json');
  for (const f of listFiles(DIST).filter((n) => n.endsWith('.json'))) {
    try { JSON.parse(read(f)); } catch (e) { problems.push('JSON lỗi ở ' + f + ': ' + e.message); }
  }
  if (problems.length) { console.error('Build lỗi:\n- ' + problems.join('\n- ')); process.exit(1); }

  console.log('Build xong: ' + APP_VERSION + ' (cache ' + BUILD_ID + '), ' + assets.length + ' mục cache' + (terser ? '' : ', KHÔNG nén/làm rối'));
})().catch((e) => { console.error(e); process.exit(1); });
