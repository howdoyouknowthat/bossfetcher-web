import { APP_VERSION } from '@bossfetcher/contracts';

/**
 * BossFetcher 官网域名。默认为正式主站，构建时可通过 Vite define 注入
 * BOSSFETCHER_SITE_ORIGIN 环境变量覆盖（scripts/verify-release.mjs 会扫描产物）。
 */
declare const __BOSSFETCHER_SITE_ORIGIN__: string | undefined;

export const SITE_ORIGIN: string =
  typeof __BOSSFETCHER_SITE_ORIGIN__ !== 'undefined' && __BOSSFETCHER_SITE_ORIGIN__
    ? __BOSSFETCHER_SITE_ORIGIN__
    : 'https://www.bossfetcher.icu';

export const APP_VERSION_FULL = APP_VERSION;

export function buildMetadata(version: string): string {
  return `// ==UserScript==
// @name         BossFetcher
// @namespace    bossfetcher
// @version      ${version}
// @description  帮你刷 boss：本地采集 BOSS 直聘岗位，结果保存在你的浏览器（不注册、不登录、不云同步）。
// @author       BossFetcher
// @match        https://www.zhipin.com/*
// @match        ${SITE_ORIGIN}/*
// @run-at       document-idle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_getValues
// @grant        GM_listValues
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_openInTab
// @updateURL    ${SITE_ORIGIN}/bossfetcher.user.js
// @downloadURL  ${SITE_ORIGIN}/bossfetcher.user.js
// ==/UserScript==
`;
}
