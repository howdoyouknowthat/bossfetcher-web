import type { CaptureLimits, CaptureStateV1, QueueItem } from '@bossfetcher/contracts';
import type { LocalRepository } from '@bossfetcher/repository';

export type PageType = 'search' | 'job_detail' | 'company_jobs' | 'company' | 'page';

export interface CollectedLinks {
  items: QueueItem[];
  added: number;
}

/**
 * 浏览器侧副作用接口：控制器保持纯逻辑，所有 DOM 读写、导航、定时与打开
 * Dashboard 都通过 driver 完成，便于用内存 store + 桩 driver 做状态机回归。
 */
export interface CaptureDriver {
  pageType(): PageType;
  currentUrl(): string;
  currentOrigin(): string;
  currentKeyword(): string;
  currentPageNum(): number;
  collectJobLinks(keyword: string, limit: number, seen: Record<string, number>, done: Record<string, number>): CollectedLinks;
  parseJobDetail(): { job: Parameters<LocalRepository['upsertJob']>[0]; company: Parameters<LocalRepository['upsertCompany']>[0] | null } | null;
  parseCompany(): Parameters<LocalRepository['upsertCompany']>[0] | null;
  parseCompanyJobs(): string[];
  navigate(url: string): void;
  openDashboard(sessionId: string): void;
  schedule(label: string, minSeconds: number, maxSeconds: number, fn: () => void): void;
  /** 固定短延迟（约 600ms）执行，用于恢复/继续队列等启动路径。 */
  runSoon(label: string, fn: () => void): void;
  now(): Date;
  /** 每次状态变化后回调（面板渲染/状态上报）。 */
  report(state: CaptureStateV1): void;
  onRun(state: CaptureStateV1): void;
}

export interface CaptureConfig {
  perKeywordLimit: number;
  maxPages: number;
  dailyAccountCap: number;
  delayMinSeconds: number;
  delayMaxSeconds: number;
  listDelayMinSeconds: number;
  listDelayMaxSeconds: number;
  listStableDelayMinSeconds: number;
  listStableDelayMaxSeconds: number;
  listRetryDelayMinSeconds: number;
  listRetryDelayMaxSeconds: number;
  activeStartHour: number;
  activeEndHour: number;
}

export function defaultCaptureConfig(): CaptureConfig {
  return {
    perKeywordLimit: 500,
    maxPages: 10,
    dailyAccountCap: 120,
    delayMinSeconds: 8,
    delayMaxSeconds: 20,
    listDelayMinSeconds: 6,
    listDelayMaxSeconds: 14,
    listStableDelayMinSeconds: 1.5,
    listStableDelayMaxSeconds: 2.5,
    listRetryDelayMinSeconds: 3,
    listRetryDelayMaxSeconds: 5,
    activeStartHour: 9,
    activeEndHour: 21,
  };
}

export function configFromLimits(limits: CaptureLimits): CaptureConfig {
  return {
    perKeywordLimit: limits.perKeywordLimit,
    maxPages: limits.maxPages,
    dailyAccountCap: limits.dailyAccountCap,
    delayMinSeconds: limits.delayMinSeconds,
    delayMaxSeconds: limits.delayMaxSeconds,
    listDelayMinSeconds: limits.listDelayMinSeconds,
    listDelayMaxSeconds: limits.listDelayMaxSeconds,
    listStableDelayMinSeconds: 1.5,
    listStableDelayMaxSeconds: 2.5,
    listRetryDelayMinSeconds: 3,
    listRetryDelayMaxSeconds: 5,
    activeStartHour: limits.activeStartHour,
    activeEndHour: limits.activeEndHour,
  };
}

export function todayKey(now: Date): string {
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}
