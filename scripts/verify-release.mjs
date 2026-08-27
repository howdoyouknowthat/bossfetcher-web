#!/usr/bin/env node
/**
 * 发布前检查：版本一致性 + 产物扫描（no-localhost / 密钥 / 占位符 / no-tracker / 脚本元数据 / infra 域名）。
 *
 * 用法：
 *   node scripts/verify-release.mjs            # 开发检查（允许占位符域名）
 *   node scripts/verify-release.mjs --release  # 发布检查（占位符域名/website id 必须已替换）
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const RELEASE = process.argv.includes('--release');

const RELEASE_PLACEHOLDERS = ['bossfetcher.example.com', 'stats.bossfetcher.example.com', '__UMAMI_WEBSITE_ID__', 'your-domain.example'];
const PLACEHOLDERS = RELEASE_PLACEHOLDERS;
const SECRET_PATTERNS = [/sk-[A-Za-z0-9]{16,}/, /AKIA[0-9A-Z]{16}/, /api[_ -]?key\s*[:=]\s*["'][^"']{8,}["']/i];
const FORBIDDEN_LOCALHOST = ['localhost', '127.0.0.1', '0.0.0.0', '127.0.0.1:8765', 'collector_server'];
const TRACKER_PATTERNS = [/umami/i, /website-id/i, /stats\.bossfetcher/i, /bossfetcher-tracker\.js/];

let failures = 0;
const results = [];

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
}

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

function walkFiles(dir) {
  const out = [];
  const walk = (d) => {
    if (!existsSync(d)) return;
    for (const entry of readdirSync(d)) {
      const full = resolve(d, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(js|css|html|json|user\.js)$/.test(full)) out.push(full);
    }
  };
  walk(dir);
  return out;
}

function collectSite() {
  return walkFiles(resolve(root, 'apps/site/dist'));
}

function collectInfra() {
  return [
    resolve(root, 'infra/site/bossfetcher-site.conf'),
    resolve(root, 'infra/site/stats.bossfetcher.conf'),
    resolve(root, 'infra/analytics/compose.yaml'),
    resolve(root, 'infra/analytics/backup.sh'),
    resolve(root, 'infra/analytics/.env.example'),
  ].filter(existsSync);
}

// ---- 1. 版本一致性 ----
const rootPkg = readJson(resolve(root, 'package.json'));
const contracts = readJson(resolve(root, 'packages/contracts/package.json'));
const contractsSrc = readFileSync(resolve(root, 'packages/contracts/src/index.ts'), 'utf8');
const versionMatch = /APP_VERSION = '([^']+)'/.exec(contractsSrc);
const appVersion = versionMatch ? versionMatch[1] : null;

const userscriptPath = resolve(root, 'packages/userscript/dist/bossfetcher.user.js');
let userscriptVersion = null;
let userscriptMeta = '';
if (existsSync(userscriptPath)) {
  userscriptMeta = readFileSync(userscriptPath, 'utf8').slice(0, 2000);
  const vm = /\/\/ @version\s+(\S+)/.exec(userscriptMeta);
  userscriptVersion = vm ? vm[1] : null;
}
check('APP_VERSION 已定义', !!appVersion, `contracts APP_VERSION=${appVersion}`);
check('userscript @version 与 APP_VERSION 一致', userscriptVersion !== null && userscriptVersion === appVersion, `@version=${userscriptVersion} vs APP_VERSION=${appVersion}`);
check('root package.json version 与 APP_VERSION 一致', rootPkg.version === appVersion, `${rootPkg.version} vs ${appVersion}`);

// ---- 2. 用户脚本元数据校验 ----
if (existsSync(userscriptPath)) {
  check('userscript 元数据块存在', userscriptMeta.startsWith('// ==UserScript=='));
  check('userscript @name', /\/\/ @name\s+BossFetcher/.test(userscriptMeta));
  check('userscript @match zhipin', /\/\/ @match\s+https:\/\/www\.zhipin\.com\/\*/.test(userscriptMeta));
  check('userscript @updateURL 指向站点域名', /\/\/ @updateURL\s+https:\/\//.test(userscriptMeta) && /\/bossfetcher\.user\.js/.test(userscriptMeta));
  check('userscript 无 @connect *', !/@connect\s+\*/.test(userscriptMeta));
  check('userscript 无 @grant GM_xmlhttpRequest', !/@grant\s+GM_xmlhttpRequest/.test(userscriptMeta));
}

// ---- 3. 产物扫描 ----
const files = [...collectSite(), ...collectInfra(), ...(existsSync(userscriptPath) ? [userscriptPath] : [])];
for (const f of files) {
  const content = readFileSync(f, 'utf8');
  if (!f.includes('infra/')) {
    for (const pat of FORBIDDEN_LOCALHOST) {
      if (content.includes(pat)) check(`no-localhost: ${f}`, false, `包含 "${pat}"`);
    }
  }
  for (const pat of SECRET_PATTERNS) {
    if (pat.test(content)) check(`secret-scan: ${f}`, false, `匹配 ${pat}`);
  }
  if (RELEASE) {
    for (const ph of PLACEHOLDERS) {
      if (content.includes(ph)) check(`release-placeholder: ${f}`, false, `仍包含占位符 "${ph}"`);
    }
  }
}

// ---- 4. /app no-tracker guard ----
const appHtml = resolve(root, 'apps/site/dist/app.html');
if (existsSync(appHtml)) {
  const appCssFiles = walkFiles(resolve(root, 'apps/site/dist/assets')).filter((f) => f.endsWith('.css'));
  const appBundleText = [appHtml, ...appCssFiles].map((f) => readFileSync(f, 'utf8')).join('\n');
  for (const pat of TRACKER_PATTERNS) {
    const ok = !pat.test(appBundleText);
    check('app no-tracker', ok, ok ? '' : `app 产物包含 "${pat}"`);
  }
}

// ---- 5. 官网 bundle 应包含 analytics（公开页面） ----
const mainJs = walkFiles(resolve(root, 'apps/site/dist/assets')).find((f) => f.includes('main-') && f.endsWith('.js'));
if (mainJs) {
  const content = readFileSync(mainJs, 'utf8');
  const events = ['install_cta_click', 'tampermonkey_store_open', 'userscript_install_open', 'userscript_ready_detected'];
  for (const ev of events) {
    check(`analytics allowlist in site bundle: ${ev}`, content.includes(ev));
  }
}

// ---- 6. 用户脚本零统计 guard ----
if (existsSync(userscriptPath)) {
  const content = readFileSync(userscriptPath, 'utf8');
  check('userscript 零统计（无 umami）', !/umami/i.test(content));
  check('userscript 零统计（无 trackEvent 调用）', !/trackEvent/.test(content));
  check('userscript 零统计（无 data-website-id）', !/website-id/.test(content));
}

console.log(`\n===== verify-release ${RELEASE ? '(release)' : '(dev)'} =====`);
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
}
console.log(`\n${failures === 0 ? '✅ 全部通过' : `❌ ${failures} 项失败`}`);
process.exit(failures === 0 ? 0 : 1);