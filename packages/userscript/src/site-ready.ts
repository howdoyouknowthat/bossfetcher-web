import { SITE_ORIGIN, APP_VERSION_FULL } from './metadata';

export const READY_MARKER_VERSION = APP_VERSION_FULL;

/**
 * 在官网公开页面注入只含版本与 ready 状态的标记，供安装向导检测。
 * 不读取、不携带任何业务数据。
 */
export function injectSiteReadyMarker(): void {
  try {
    const el = document.documentElement;
    el.setAttribute('data-bossfetcher-ready', '1');
    el.setAttribute('data-bossfetcher-version', READY_MARKER_VERSION);
  } catch {
    // ignore
  }
}

export function isSiteOrigin(): boolean {
  try {
    return location.origin === new URL(SITE_ORIGIN).origin;
  } catch {
    return false;
  }
}

export function isAppPath(): boolean {
  try {
    return location.pathname.startsWith('/app');
  } catch {
    return false;
  }
}

export function isZhipin(): boolean {
  return location.hostname === 'www.zhipin.com' || location.hostname === 'zhipin.com';
}
