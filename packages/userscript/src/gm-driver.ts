import type { CaptureStateV1, QueueItem } from '@bossfetcher/contracts';
import {
  brandIdFromUrlString,
  jobIdFromUrlString,
  pageTypeFromPath,
  parseCompanyJobsPage,
  parseCompanyPage,
  parseJobPage,
} from '@bossfetcher/parser';
import type { CaptureDriver, PageType, CollectedLinks } from '@bossfetcher/capture';
import { SITE_ORIGIN } from './metadata';

declare function GM_openInTab(url: string, opts: { active?: boolean; insert?: boolean }): void;

function absUrl(href: string): string {
  try {
    return new URL(href, location.origin).href;
  } catch {
    return '';
  }
}

function randomDelayMs(minSeconds: number, maxSeconds: number): number {
  const min = Math.max(1, minSeconds);
  const max = Math.max(min, maxSeconds);
  return Math.floor((min + Math.random() * (max - min)) * 1000);
}

export function createGMCaptureDriver(opts: {
  onReport: (st: CaptureStateV1) => void;
  onRun: (st: CaptureStateV1) => void;
}): CaptureDriver {
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function schedule(_label: string, minSeconds: number, maxSeconds: number, fn: () => void) {
    clearTimer();
    timer = setTimeout(fn, randomDelayMs(minSeconds, maxSeconds));
  }

  function runSoon(_label: string, fn: () => void) {
    clearTimer();
    timer = setTimeout(fn, 600);
  }

  const driver: CaptureDriver = {
    pageType(): PageType {
      return pageTypeFromPath(location.pathname);
    },
    currentUrl: () => location.href,
    currentOrigin: () => location.origin,
    currentKeyword: () => {
      try {
        return new URL(location.href).searchParams.get('query') || '';
      } catch {
        return '';
      }
    },
    currentPageNum: () => {
      try {
        return parseInt(new URL(location.href).searchParams.get('page') || '1', 10) || 1;
      } catch {
        return 1;
      }
    },
    collectJobLinks(keyword: string, limit: number, seen: Record<string, number>, done: Record<string, number>): CollectedLinks {
      const items: QueueItem[] = [];
      const anchors = document.querySelectorAll("a[href*='job_detail']");
      for (const a of Array.from(anchors)) {
        if (items.length >= limit) break;
        const url = absUrl(a.getAttribute('href') || '');
        const jobId = jobIdFromUrlString(url);
        if (!jobId || seen[jobId] || done[jobId]) continue;
        seen[jobId] = 1;
        items.push({ jobId, url, keyword });
      }
      return { items, added: items.length };
    },
    parseJobDetail() {
      const result = parseJobPage(document, location.href);
      return { job: result.job, company: result.company };
    },
    parseCompany() {
      const brandId = brandIdFromUrlString(location.href);
      return parseCompanyPage(document, brandId);
    },
    parseCompanyJobs() {
      return parseCompanyJobsPage(document);
    },
    navigate(url: string) {
      location.href = url;
    },
    openDashboard(sessionId: string) {
      try {
        if (typeof GM_openInTab !== 'undefined') {
          GM_openInTab(`${SITE_ORIGIN}/app?capture=1&session_id=${encodeURIComponent(sessionId)}`, { active: true, insert: true });
        }
      } catch {
        // GM_openInTab 不可用时静默失败
      }
    },
    schedule,
    runSoon,
    now: () => new Date(),
    report: (st) => opts.onReport(st),
    onRun: (st) => opts.onRun(st),
  };

  return driver;
}
