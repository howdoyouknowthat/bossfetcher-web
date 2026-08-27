export interface UmamiWindow extends Window {
  umami?: {
    track(eventName?: string, eventData?: Record<string, unknown>): void;
    trackEvent?(eventName?: string, eventData?: Record<string, unknown>): void;
    identify?(payload: Record<string, unknown>): void;
  };
}

/**
 * Self-hosted Umami transport layer.
 * Loads the tracker once from stats subdomain, queues calls until ready.
 * All failures degrade silently without blocking product features.
 */
export class UmamiTransport {
  private loaded = false;
  private pending: Array<{ fn: () => void }> = [];
  private drainAttempts = 0;
  private drainGeneration = 0;
  private readonly maxDrainAttempts = 10;

  constructor(
    private opts: {
      trackerUrl: string;
      websiteId: string;
      domains: string;
      loadScript: (src: string, attrs: Record<string, string>) => void;
      getWindow: () => UmamiWindow | undefined;
    },
  ) {}

  load(): void {
    if (this.loaded) return;
    this.loaded = true;
    this.opts.loadScript(this.opts.trackerUrl, {
      src: this.opts.trackerUrl,
      async: 'true',
      defer: 'true',
      'data-website-id': this.opts.websiteId,
      'data-domains': this.opts.domains,
      'data-auto-pageview': 'false',
      'data-exclude-search': 'true',
      'data-exclude-hash': 'true',
      'data-do-not-track': 'true',
    });
  }

  private trySend(fn: () => void): void {
    const umami = this.opts.getWindow()?.umami;
    if (umami) {
      try { fn(); } catch {}
      return;
    }
    if (this.pending.length < this.maxDrainAttempts) {
      this.pending.push({ fn });
      if (this.pending.length === 1) this.drain();
    }
  }

  /** 取消全部待发送请求并终止后续 drain（退出统计时调用）。 */
  cancelPending(): void {
    this.pending.length = 0;
    this.drainGeneration += 1;
  }

  private drain(): void {
    this.drainAttempts = 0;
    const generation = this.drainGeneration;
    const attempt = () => {
      if (generation !== this.drainGeneration) return;
      this.drainAttempts += 1;
      const umami = this.opts.getWindow()?.umami;
      if (umami) {
        for (const item of this.pending.splice(0)) {
          try { item.fn(); } catch {}
        }
        this.drainAttempts = 0;
        return;
      }
      if (this.pending.length > 0 && this.drainAttempts < this.maxDrainAttempts) {
        setTimeout(attempt, 500);
      } else {
        this.pending.length = 0;
      }
    };
    setTimeout(attempt, 500);
  }

  /** Pageview: umami.track() with no args records current URL as pageview. */
  sendPageView(): void {
    this.trySend(() => this.opts.getWindow()?.umami?.track());
  }

  sendEvent(name: string): void {
    this.trySend(() => this.opts.getWindow()?.umami?.track(name));
  }
}
