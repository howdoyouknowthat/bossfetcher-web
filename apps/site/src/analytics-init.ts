import { createSiteAnalytics, type SiteAnalytics } from '@bossfetcher/analytics';
import { ANALYTICS_CONFIG } from './analytics-config';

let instance: SiteAnalytics | null = null;

/**
 * 官网公开页面的统计入口。仅加载在公开官网页面；
 * `/app` 使用独立 entry（app-main.tsx），物理排除此模块。
 */
export function getAnalytics(): SiteAnalytics {
  if (instance) return instance;

  instance = createSiteAnalytics({
    trackerUrl: ANALYTICS_CONFIG.trackerUrl,
    websiteId: ANALYTICS_CONFIG.websiteId,
    domains: ANALYTICS_CONFIG.domains,
    loadScript: (_src, attrs) => {
      const s = document.createElement('script');
      for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    },
    getWindow: () => window as unknown as Window & { umami?: { track: (name?: string) => void } },
    devLog: (msg) => console.warn(msg),
  });

  instance.init();
  return instance;
}
