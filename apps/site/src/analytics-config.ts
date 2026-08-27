/**
 * 统计配置。正式统计域名固定为 stats.bossfetcher.icu；
 * website id 属于构建时注入的运营数据，通过 VITE_UMAMI_WEBSITE_ID 提供，
 * 未注入时保留占位符（scripts/verify-release.mjs --release 会阻止发布）。
 * 必须与 infra/site/*.conf、infra/analytics/compose.yaml 保持同步。
 *
 * - trackerScriptName: compose.yaml 中 TRACKER_SCRIPT_NAME 的值
 * - collectEndpoint:    compose.yaml 中 COLLECT_API_ENDPOINT 的值
 * - statsOrigin:        统计子域名，需同时在 CSP connect-src 和 script-src 中放行
 */
const websiteId = import.meta.env?.VITE_UMAMI_WEBSITE_ID || '__UMAMI_WEBSITE_ID__';

export const ANALYTICS_CONFIG = {
  statsOrigin: 'https://stats.bossfetcher.icu',
  trackerUrl: 'https://stats.bossfetcher.icu/bossfetcher-tracker.js',
  websiteId,
  domains: 'www.bossfetcher.icu',
  collectEndpoint: '/api/collect',
} as const;
