/**
 * BossFetcher 官网域名与版本号。
 *
 * 构建时由 packages/userscript/vite.config.ts 通过 Vite define 注入
 * __BOSSFETCHER_SITE_ORIGIN__（来自 BOSSFETCHER_SITE_ORIGIN 环境变量）
 * 与 __BOSSFETCHER_APP_VERSION__（来自 contracts 源码真源）。
 * 本文件不得 import 任何 workspace 包：vite.config.ts 会在 Node 配置
 * 加载阶段执行此模块，Node 20 无法加载 .ts 扩展的裸导入。
 */
declare const __BOSSFETCHER_SITE_ORIGIN__: string | undefined;
declare const __BOSSFETCHER_APP_VERSION__: string | undefined;

export const SITE_ORIGIN: string =
  typeof __BOSSFETCHER_SITE_ORIGIN__ !== 'undefined' && __BOSSFETCHER_SITE_ORIGIN__
    ? __BOSSFETCHER_SITE_ORIGIN__
    : 'https://www.bossfetcher.icu';

export const APP_VERSION_FULL: string =
  typeof __BOSSFETCHER_APP_VERSION__ !== 'undefined' && __BOSSFETCHER_APP_VERSION__
    ? __BOSSFETCHER_APP_VERSION__
    : '0.0.0';

export function buildMetadata(version: string, siteOrigin: string = SITE_ORIGIN): string {
  return `// ==UserScript==
// @name         BossFetcher
// @namespace    bossfetcher
// @version      ${version}
// @description  帮你刷 boss：本地采集 BOSS 直聘岗位，结果保存在你的浏览器（不注册、不登录、不云同步）。
// @author       BossFetcher
// @match        https://www.zhipin.com/*
// @match        ${siteOrigin}/*
// @run-at       document-idle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_getValues
// @grant        GM_listValues
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_openInTab
// @updateURL    ${siteOrigin}/bossfetcher.user.js
// @downloadURL  ${siteOrigin}/bossfetcher.user.js
// ==/UserScript==
`;
}
