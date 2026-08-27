import { ANALYTICS_OPT_OUT_KEY, isAllowedEvent, normalizePath } from './allowlist';
import type { UmamiWindow } from './umami';
import { UmamiTransport } from './umami';

export interface AnalyticsStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface AnalyticsTransport {
  load(): void;
  sendPageView(): void;
  sendEvent(name: string): void;
  cancelPending(): void;
}

export interface AnalyticsPlatform {
  pathname(): string;
  doNotTrackEnabled(): boolean;
  store: AnalyticsStore;
  transport: AnalyticsTransport;
  devLog?(message: string): void;
}

export interface AnalyticsOptions {
  trackerUrl: string;
  websiteId: string;
  domains: string;
  store?: AnalyticsStore;
  loadScript: (src: string, attrs: Record<string, string>) => void;
  getWindow: () => UmamiWindow | undefined;
  doNotTrackEnabled?: () => boolean;
  pathname?: () => string;
  devLog?: (message: string) => void;
}

/**
 * 官网统计（SiteAnalytics）。
 *
 * 约束：
 * - 只接受规范化的公开路径与固定事件名，拒绝任意字符串和 event data；
 * - 不读取 DOM 文本、表单值、LocalStorage（退出标志除外）、GM storage、URL query/hash；
 * - `/app` 及非 allowlist 路径不初始化、不加载 tracker、不发请求；
 * - 尊重 Do Not Track；提供本浏览器退出统计；
 * - 统计失败静默降级，不影响任何产品操作。
 */
export class SiteAnalytics {
  private enabled = false;

  constructor(private platform: AnalyticsPlatform) {}

  /** 在公开页面初始化；非公开路径 / 退出 / DNT / 存储不可用时返回 false。 */
  init(): boolean {
    this.enabled = this.evaluateEnablement();
    if (!this.enabled) return false;
    this.platform.transport.load();
    const path = normalizePath(this.platform.pathname());
    if (path) this.platform.transport.sendPageView();
    return true;
  }

  trackPageView(path?: string): boolean {
    if (!this.enabled) return false;
    const normalized = normalizePath(path ?? this.platform.pathname());
    if (!normalized) return false;
    this.platform.transport.sendPageView();
    return true;
  }

  trackAllowedEvent(name: string): boolean {
    return this.trackEvent(name);
  }

  /** 只接受固定事件名；第二个参数（event data）被设计层面拒绝。 */
  trackEvent(name: string): boolean {
    if (!this.enabled) return false;
    if (!isAllowedEvent(name)) {
      this.platform.devLog?.(`[analytics] 拒绝非 allowlist 事件：${name}`);
      return false;
    }
    this.platform.transport.sendEvent(name);
    return true;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** 本浏览器退出统计：取消所有待发送请求、写入本地退出标志并停止后续事件。 */
  disableForBrowser(): void {
    this.enabled = false;
    this.platform.transport.cancelPending();
    try {
      this.platform.store.set(ANALYTICS_OPT_OUT_KEY, '1');
    } catch {
      // 无法保存退出选择时，本会话仍保持关闭
    }
  }

  /** 恢复统计：删除本地退出标志，刷新后生效。 */
  enableAnalytics(): void {
    try {
      this.platform.store.remove(ANALYTICS_OPT_OUT_KEY);
    } catch {
      // ignore
    }
  }

  private evaluateEnablement(): boolean {
    let optedOut = false;
    try {
      optedOut = this.platform.store.get(ANALYTICS_OPT_OUT_KEY) === '1';
    } catch {
      // localStorage 被禁用时默认不统计（无法保存退出选择）
      return false;
    }
    if (optedOut) return false;
    if (this.platform.doNotTrackEnabled()) return false;
    const path = normalizePath(this.platform.pathname());
    if (!path) return false;
    return true;
  }
}

function localStorageStore(): AnalyticsStore {
  const storage = typeof localStorage !== 'undefined' ? localStorage : null;
  return {
    get(key) {
      if (!storage) throw new Error('localStorage unavailable');
      return storage.getItem(key);
    },
    set(key, value) {
      if (!storage) throw new Error('localStorage unavailable');
      storage.setItem(key, value);
    },
    remove(key) {
      if (!storage) throw new Error('localStorage unavailable');
      storage.removeItem(key);
    },
  };
}

export function defaultDoNotTrack(): boolean {
  const v = typeof navigator !== 'undefined' ? (navigator as Navigator & { doNotTrack?: string }).doNotTrack : undefined;
  return v === '1' || v === 'yes';
}

export function createSiteAnalytics(options: AnalyticsOptions): SiteAnalytics {
  const transport = new UmamiTransport({
    trackerUrl: options.trackerUrl,
    websiteId: options.websiteId,
    domains: options.domains,
    loadScript: options.loadScript,
    getWindow: options.getWindow,
  });
  const platform: AnalyticsPlatform = {
    pathname: options.pathname ?? (() => (typeof location !== 'undefined' ? location.pathname : '/')),
    doNotTrackEnabled: options.doNotTrackEnabled ?? defaultDoNotTrack,
    store: options.store ?? localStorageStore(),
    transport,
    devLog: options.devLog,
  };
  return new SiteAnalytics(platform);
}

export { ANALYTICS_OPT_OUT_KEY, isAllowedEvent, normalizePath, ALLOWED_EVENTS, ALLOWED_PATHS } from './allowlist';
