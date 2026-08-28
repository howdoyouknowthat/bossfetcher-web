import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..', '..');
const userscriptPath = resolve(root, 'packages/userscript/dist/bossfetcher.user.js');
const appHtmlPath = resolve(root, 'apps/site/dist/app.html');
const appAssetsDir = resolve(root, 'apps/site/dist/assets');
const contractsSrc = readFileSync(resolve(root, 'packages/contracts/src/index.ts'), 'utf8');
const rootPkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

const versionMatch = /APP_VERSION = '([^']+)'/.exec(contractsSrc);
const APP_VERSION = versionMatch ? versionMatch[1] : null;

describe('version consistency', () => {
  it('contracts APP_VERSION matches root package.json', () => {
    expect(APP_VERSION).toBeTruthy();
    expect(rootPkg.version).toBe(APP_VERSION);
  });
});

describe('release guard script', () => {
  it('does not require real secrets in .env.example', () => {
    const source = readFileSync(resolve(root, 'scripts/verify-release.mjs'), 'utf8');
    expect(source).not.toMatch(/PLACEHOLDERS[^\n]*change-me/);
  });

  it('scans the built website, userscript and nginx domain templates in release mode', () => {
    const source = readFileSync(resolve(root, 'scripts/verify-release.mjs'), 'utf8');
    expect(source).toContain('collectSite()');
    expect(source).toContain('bossfetcher-site.conf');
    expect(source).toContain('stats.bossfetcher.conf');
    expect(source).toContain('bossfetcher-bootstrap-http.conf');
    expect(source).toContain('certbot-reload-nginx.sh');
    expect(source).toContain('nginx-logrotate.conf');
    expect(source).toContain('userscriptPath');
    expect(source).toContain('Umami website id is a UUID');
    expect(source).toContain('ICP number is embedded');
    expect(source).toContain('ICP number links to MIIT');
  });

  it('serves only versioned userscripts from the release archive', () => {
    const nginx = readFileSync(resolve(root, 'infra/site/bossfetcher-site.conf'), 'utf8');
    expect(nginx).toContain('alias /srv/bossfetcher/web/releases/$1/bossfetcher.user.js;');
    expect(nginx).toMatch(/location \/releases\/ \{\s*return 404;/);
  });
});

describe('built userscript guards', () => {
  const built = existsSync(userscriptPath);
  const run = built ? it : it.skip;

  run('metadata @version matches APP_VERSION', () => {
    const head = readFileSync(userscriptPath, 'utf8').slice(0, 1500);
    const m = /\/\/ @version\s+(\S+)/.exec(head);
    expect(m?.[1]).toBe(APP_VERSION);
  });

  run('has required metadata block', () => {
    const head = readFileSync(userscriptPath, 'utf8').slice(0, 2000);
    expect(head.startsWith('// ==UserScript==')).toBe(true);
    expect(head).toMatch(/\/\/ @name\s+BossFetcher/);
    expect(head).toMatch(/\/\/ @match\s+https:\/\/www\.zhipin\.com\/\*/);
    expect(head).not.toMatch(/@connect\s+\*/);
    expect(head).not.toMatch(/@grant\s+GM_xmlhttpRequest/);
  });

  run('no localhost / no transport grant / zero analytics', () => {
    const content = readFileSync(userscriptPath, 'utf8');
    expect(content).not.toMatch(/localhost|127\.0\.0\.1|collector_server/i);
    expect(content).not.toMatch(/GM_xmlhttpRequest/);
    expect(content).not.toMatch(/umami|website-id|trackEvent\(/i);
  });
});

describe('built /app no-tracker guard', () => {
  const built = existsSync(appHtmlPath);
  const run = built ? it : it.skip;

  run('/app artifacts contain no analytics references', () => {
    const appText = readFileSync(appHtmlPath, 'utf8');
    expect(appText).not.toMatch(/umami|website-id|stats\.bossfetcher/i);
    if (existsSync(appAssetsDir)) {
      const css = readFileSync(resolve(appAssetsDir, appText.match(/assets\/(app-[^"']+\.css)/)?.[1] ?? ''), 'utf8');
      expect(css).not.toMatch(/umami|website-id|stats\.bossfetcher/i);
    }
  });

  run('/app is a separate entry, not the public site bundle', () => {
    const appText = readFileSync(appHtmlPath, 'utf8');
    // /app 不应引用 main-*.js（公开站点 bundle，内含 analytics）
    expect(appText).not.toMatch(/assets\/main-[^"']+\.js/);
  });
});
