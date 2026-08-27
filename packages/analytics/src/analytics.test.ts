import { describe, expect, it, vi } from 'vitest';
import { createSiteAnalytics, normalizePath, ANALYTICS_OPT_OUT_KEY, ALLOWED_EVENTS } from '@bossfetcher/analytics';
import { UmamiTransport } from './umami';

interface Recorded {
  loads: Array<Record<string, string>>;
  pageviews: string[];
  events: string[];
  identifyCalls: number;
}

function makeHarness(pathname = '/', doNotTrack = false, seedOptOut = false) {
  const store = new Map<string, string>();
  if (seedOptOut) store.set(ANALYTICS_OPT_OUT_KEY, '1');
  const rec: Recorded = { loads: [], pageviews: [], events: [], identifyCalls: 0 };
  let umami: Record<string, unknown> | undefined;

  const analytics = createSiteAnalytics({
    trackerUrl: 'https://stats.example.com/script.js',
    websiteId: 'test-site-id',
    domains: 'example.com',
    store: {
      get: (k) => store.get(k) ?? null,
      set: (k, v) => void store.set(k, v),
      remove: (k) => void store.delete(k),
    },
    loadScript: (_src, attrs) => {
      rec.loads.push(attrs);
      umami = {
        track: (eventName?: string, data?: unknown) => {
          // 防止任何 event data 进入 payload
          if (data && Object.keys(data as object).length > 0) {
            throw new Error('unexpected event data');
          }
          rec.events.push(String(eventName));
        },
        identify: () => {
          rec.identifyCalls += 1;
        },
      };
    },
    getWindow: () => ({ umami } as never),
    pathname: () => pathname,
    doNotTrackEnabled: () => doNotTrack,
    devLog: () => undefined,
  });

  return { analytics, rec, store };
}

describe('UmamiTransport', () => {
  it('never drains queued requests after cancelPending', () => {
    vi.useFakeTimers();
    const sent: string[] = [];
    let win: { umami?: { track: (name?: string) => void } } = {};
    const transport = new UmamiTransport({
      trackerUrl: 'https://stats.example.com/script.js',
      websiteId: 'site-id',
      domains: 'example.com',
      loadScript: () => undefined,
      getWindow: () => win as never,
    });

    transport.sendPageView();
    transport.sendEvent('install_cta_click');
    transport.cancelPending();
    win = { umami: { track: (name) => sent.push(name ?? 'pageview') } };
    vi.advanceTimersByTime(6000);

    expect(sent).toEqual([]);
    vi.useRealTimers();
  });
});

describe('SiteAnalytics', () => {
  it('trackEvent("unknown") is rejected and not sent', () => {
    const { analytics, rec } = makeHarness('/');
    analytics.init();
    const ok = analytics.trackEvent('unknown_event');
    expect(ok).toBe(false);
    expect(rec.events.filter(e => e !== 'undefined' && e !== 'null')).toEqual([]);
  });

  it('only allowlist events are sent', () => {
    const { analytics, rec } = makeHarness('/');
    analytics.init();
    analytics.trackEvent('install_cta_click');
    analytics.trackEvent('userscript_install_open');
    expect(rec.events.filter(e => e !== 'undefined' && e !== 'null')).toEqual(['install_cta_click', 'userscript_install_open']);
    expect(ALLOWED_EVENTS).toContain('userscript_install_open');
  });

  it('pageview calls umami.track() with no args (current URL)', () => {
    const { analytics, rec } = makeHarness('/install');
    analytics.init();
    // sendPageView() calls umami.track() with no argument for pageview
    expect(rec.events).toContain('undefined');
  });

  it('/app and non-allowlist paths never initialize the tracker', () => {
    for (const p of ['/app', '/app/', '/app/dashboard', '/unknown']) {
      const { analytics, rec } = makeHarness(p);
      expect(analytics.init()).toBe(false);
      expect(rec.loads).toHaveLength(0);
      expect(rec.events).toHaveLength(0);
    }
  });

  it('opt-out localStorage stops tracker load', () => {
    const { analytics, rec } = makeHarness('/', false, true);
    expect(analytics.init()).toBe(false);
    expect(rec.loads).toHaveLength(0);
    expect(rec.events).toHaveLength(0);
  });

  it('Do Not Track stops tracker load', () => {
    const { analytics, rec } = makeHarness('/', true);
    expect(analytics.init()).toBe(false);
    expect(rec.loads).toHaveLength(0);
    expect(rec.events).toHaveLength(0);
  });

  it('disableForBrowser writes opt-out and stops subsequent events', () => {
    const { analytics, rec, store } = makeHarness('/');
    analytics.init();
    expect(rec.loads).toHaveLength(1);
    analytics.disableForBrowser();
    analytics.trackEvent('install_cta_click');
    const nonPageview = rec.events.filter(e => e !== 'undefined' && e !== 'null');
    expect(nonPageview).toEqual([]);
    expect(store.get(ANALYTICS_OPT_OUT_KEY)).toBe('1');
  });

  it('identify() is never called and event data never sent', () => {
    const { analytics, rec } = makeHarness('/');
    analytics.init();
    expect(rec.identifyCalls).toBe(0);
    // pageview recorded as undefined (no-arg track), no bogus events
    expect(rec.events.filter((e) => e !== 'undefined' && e !== 'null')).toEqual([]);
  });

  it('tracker failure silently degrades without throwing', () => {
    const store = new Map<string, string>();
    const analytics = createSiteAnalytics({
      trackerUrl: 'https://stats.example.com/script.js',
      websiteId: 'w',
      domains: 'example.com',
      store: {
        get: (k) => store.get(k) ?? null,
        set: (k, v) => void store.set(k, v),
        remove: (k) => void store.delete(k),
      },
      loadScript: () => undefined,
      getWindow: () => undefined,
      pathname: () => '/',
    });
    expect(() => analytics.init()).not.toThrow();
    expect(() => analytics.trackEvent('install_cta_click')).not.toThrow();
  });

  it('normalizePath strips query/hash and rejects /app', () => {
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('/install?x=1#y')).toBe('/install');
    expect(normalizePath('/help/')).toBe('/help');
    expect(normalizePath('/privacy')).toBe('/privacy');
    expect(normalizePath('/app')).toBeNull();
    expect(normalizePath('/app/browse')).toBeNull();
    expect(normalizePath('/foo')).toBeNull();
  });
});
