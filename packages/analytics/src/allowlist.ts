export const ANALYTICS_OPT_OUT_KEY = 'bf.analytics_opt_out';

export const ALLOWED_PATHS = ['/', '/install', '/help', '/privacy'] as const;
export type AllowedPath = (typeof ALLOWED_PATHS)[number];

export const ALLOWED_EVENTS = [
  'install_cta_click',
  'tampermonkey_store_open',
  'allow_user_scripts_help_open',
  'userscript_install_open',
  'userscript_ready_detected',
  'boss_login_help_open',
  'boss_site_open',
  'dashboard_open_click',
  'install_help_open',
  'install_retry_click',
] as const;
export type AllowedEvent = (typeof ALLOWED_EVENTS)[number];

export function isAllowedPath(path: string): path is AllowedPath {
  return (ALLOWED_PATHS as readonly string[]).includes(path);
}

export function isAllowedEvent(name: string): name is AllowedEvent {
  return (ALLOWED_EVENTS as readonly string[]).includes(name);
}

/**
 * 规范化为公开路径 allowlist 中的路径。先剥离 query 与 hash，再校验；
 * 禁止返回原始 location.href。`/app` 及其子路径返回 null（不统计）。
 */
export function normalizePath(input: string): string | null {
  let p = (input || '/').split('?')[0].split('#')[0];
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.length > 1 && p.endsWith('/')) p = p.replace(/\/+$/, '');
  if (p.startsWith('/app')) return null;
  return isAllowedPath(p) ? p : null;
}
