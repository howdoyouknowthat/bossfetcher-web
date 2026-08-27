/**
 * 统计配置。正式发布前必须替换为已备案域名与真实 website id。
 * 必须与 infra/site/*.conf、infra/analytics/compose.yaml 保持同步。
 *
 * - trackerScriptName: compose.yaml 中 TRACKER_SCRIPT_NAME 的值
 * - collectEndpoint:    compose.yaml 中 COLLECT_API_ENDPOINT 的值
 * - statsOrigin:        统计子域名，需同时在 CSP connect-src 和 script-src 中放行
 */
export const ANALYTICS_CONFIG = {
  statsOrigin: 'https://stats.bossfetcher.example.com',
  trackerUrl: 'https://stats.bossfetcher.example.com/bossfetcher-tracker.js',
  websiteId: '__UMAMI_WEBSITE_ID__',
  domains: 'bossfetcher.example.com',
  collectEndpoint: '/api/collect',
} as const;