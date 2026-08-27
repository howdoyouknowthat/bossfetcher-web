import type { CaptureStateV1, QueueItem } from '@bossfetcher/contracts';
import type { LocalRepository } from '@bossfetcher/repository';
import { pageTypeFromPath } from '@bossfetcher/parser';
import type { CaptureConfig, CaptureDriver } from './types';
import { todayKey } from './types';

function newSessionId(now: Date): string {
  const rand = Math.random().toString(16).slice(2, 8);
  return `bf-${now.getTime()}-${rand}`;
}

function statusLabel(status: string): string {
  if (status === 'running') return '运行中';
  if (status === 'paused') return '已暂停';
  if (status === 'completed') return '已完成';
  if (status === 'error') return '出错';
  return '空闲';
}

/**
 * 采集 Controller：保留原 boss_capture.user.js 的状态机与人速策略，
 * 把 HTTP POST / 心跳 / localhost Dashboard 替换为 Parser + LocalRepository。
 */
export class CaptureController {
  constructor(
    private repo: LocalRepository,
    private driver: CaptureDriver,
    private config: CaptureConfig,
  ) {}

  private load(): CaptureStateV1 {
    return ensureToday(this.repo.getCaptureState(), this.driver.now());
  }

  private save(st: CaptureStateV1): void {
    this.repo.saveCaptureState(st).catch(() => {
      st.status = 'error';
      st.lastMessage = '存储保存失败，当前状态可能无法持久化';
      this.driver.report(st);
    });
    this.driver.report(st);
  }

  start(): void {
    const st = this.load();
    const type = this.driver.pageType();

    if (type !== 'search' && type !== 'job_detail') {
      st.lastMessage = '请先登录并进入搜索页';
      this.save(st);
      return;
    }

    const keyword = this.driver.currentKeyword().trim();
    if (type === 'search' && !keyword) {
      st.status = 'idle';
      st.lastMessage = '请先在 BOSS 搜索岗位关键词，再点击开始';
      this.save(st);
      return;
    }

    if (type === 'job_detail') {
      this.startOnJobDetail(st);
      return;
    }

    st.sessionId = newSessionId(this.driver.now());
    st.status = 'running';
    st.currentKeyword = keyword || st.currentKeyword;
    st.queueTotal = st.queue.length;
    st.lastMessage = '开始收集列表页';
    this.save(st);
    this.openDashboardOnce(st.sessionId);
    this.driver.runSoon('开始采集', () => this.runAuto());
  }

  private startOnJobDetail(st: CaptureStateV1): void {
    const currentJobId = jobIdFromUrlString(this.driver.currentUrl());
    const currentJobExists = !!(st.currentJob && st.currentJob.jobId);
    const currentJobMatches = currentJobExists && st.currentJob!.jobId === currentJobId;
    const currentJobHasKeyword = currentJobExists && !!st.currentJob!.keyword;
    const hasValidQueue = st.queue.length > 0;
    const hasQueueKeyword = st.queue.some((item) => !!item.keyword);

    if (currentJobMatches && currentJobHasKeyword) {
      st.sessionId = newSessionId(this.driver.now());
      st.status = 'running';
      st.lastMessage = '恢复采集当前岗位';
      this.save(st);
      this.openDashboardOnce(st.sessionId);
      this.driver.runSoon('恢复采集', () => this.runAuto());
      return;
    }

    if (currentJobExists && !currentJobMatches) {
      st.sessionId = newSessionId(this.driver.now());
      st.status = 'running';
      st.lastMessage = `返回未完成的岗位：${st.currentJob!.jobId}`;
      const target = st.currentJob!.url;
      this.save(st);
      this.openDashboardOnce(st.sessionId);
      this.driver.runSoon('返回未完成岗位', () => this.driver.navigate(target));
      return;
    }

    if (!currentJobExists && hasValidQueue && hasQueueKeyword) {
      st.sessionId = newSessionId(this.driver.now());
      st.status = 'running';
      st.lastMessage = '从队列继续采集';
      this.save(st);
      this.openDashboardOnce(st.sessionId);
      this.driver.runSoon('继续队列', () => this.nextJob());
      return;
    }

    st.status = 'idle';
    st.lastMessage = '当前岗位不在队列中，请返回搜索页重新搜索';
    this.save(st);
  }

  pause(): void {
    this.driver.schedule('', 0, 0, () => undefined);
    const st = this.load();
    st.status = 'paused';
    st.lastMessage = '已暂停';
    this.save(st);
  }

  async captureManual(): Promise<boolean> {
    return this.captureCurrentAsync(false);
  }

  runAuto(): void {
    const st = this.load();
    if (!this.canRun(st)) return;
    const type = this.driver.pageType();
    if (type === 'search') this.handleSearchPage();
    else if (type === 'job_detail') this.handleJobDetail();
    else if (type === 'company') this.handleCompanyPage();
    else if (type === 'company_jobs') this.handleCompanyJobsPage();
    else this.scheduleNextJob('当前页面不可采，准备下一个岗位');
  }

  private canRun(st: CaptureStateV1): boolean {
    if (st.status !== 'running') return false;
    const h = this.driver.now().getHours();
    if (this.config.activeStartHour >= 0 && (h < this.config.activeStartHour || h >= this.config.activeEndHour)) {
      st.status = 'paused';
      st.lastMessage = `已暂停：仅在 ${this.config.activeStartHour}:00-${this.config.activeEndHour}:00 运行`;
      this.save(st);
      return false;
    }
    if (st.dailyCount >= this.config.dailyAccountCap) {
      st.status = 'paused';
      st.lastMessage = '已暂停：今日额度已达上限';
      this.save(st);
      return false;
    }
    return true;
  }

  // ---- 搜索列表页 ----
  private handleSearchPage(): void {
    const st = this.load();
    if (!this.canRun(st)) return;
    this.driver.schedule('列表已出现，等待渲染稳定', this.config.listStableDelayMinSeconds, this.config.listStableDelayMaxSeconds, () =>
      this.collectSearchPage(false),
    );
  }

  private collectSearchPage(retried: boolean): void {
    const s = this.load();
    if (!this.canRun(s)) return;
    const added = this.collectJobLinks(s);
    const kw = s.currentKeyword || this.driver.currentKeyword();
    const page = this.driver.currentPageNum();
    const limitReached = (s.keywordCounts[kw] || 0) >= this.config.perKeywordLimit;
    s.lastMessage = `第${page}页 新增${added}，累计${s.keywordCounts[kw] || 0}`;
    this.save(s);

    if (added === 0 && !retried) {
      this.driver.schedule(`第${page}页暂未发现新岗位，等待后重试`, this.config.listRetryDelayMinSeconds, this.config.listRetryDelayMaxSeconds, () =>
        this.collectSearchPage(true),
      );
      return;
    }
    if (added > 0 && !limitReached && page < this.config.maxPages) {
      const nextUrl = searchUrlForPage(this.driver.currentUrl(), page + 1);
      this.driver.schedule(`准备翻到第${page + 1}页`, this.config.listDelayMinSeconds, this.config.listDelayMaxSeconds, () => {
        const s2 = this.load();
        if (this.canRun(s2) && nextUrl) this.driver.navigate(nextUrl);
      });
      return;
    }
    this.scheduleNextJob(`列表收集完成（共${page}页），准备进入详情页`);
  }

  private collectJobLinks(st: CaptureStateV1): number {
    const kw = this.driver.currentKeyword() || st.currentKeyword;
    if (!kw) return 0;
    st.currentKeyword = kw;
    const currentCount = st.keywordCounts[kw] || 0;
    const remaining = Math.max(0, this.config.perKeywordLimit - currentCount);
    if (remaining <= 0) return 0;

    const { items } = this.driver.collectJobLinks(kw, remaining, st.seenJobs, st.doneJobs);
    const capped = items.slice(0, remaining);
    st.keywordCounts[kw] = currentCount + capped.length;
    for (const item of capped) {
      st.seenJobs[item.jobId] = 1;
      st.queue.push(item);
    }
    if (capped.length > 0) st.queueTotal = (st.queueTotal || 0) + capped.length;
    return capped.length;
  }

  // ---- 详情页 / 公司页 / 公司在招页 ----
  private handleJobDetail(): void {
    const st = this.load();
    if (!this.canRun(st)) return;
    const jobId = jobIdFromUrlString(this.driver.currentUrl());
    if (!st.currentJob || st.currentJob.jobId !== jobId) {
      st.currentJob = { jobId: jobId || '', url: this.driver.currentUrl(), keyword: st.currentKeyword || this.driver.currentKeyword() };
      this.save(st);
    }

    this.captureCurrent(true, (ok) => {
      if (!ok) return;
      const next = this.load();
      const brandId = next.currentJob ? jobBrandFromParsed(this.repo, next.currentJob.jobId) : null;
      if (jobId) next.doneJobs[jobId] = 1;
      if (brandId && !(next.companiesToday && next.companiesToday[brandId])) {
        next.pendingCompany = { brandId, step: 'company' };
        next.lastMessage = `岗位已抓，准备补抓公司 ${brandId}`;
        this.save(next);
        this.driver.schedule('准备进入公司页', this.config.delayMinSeconds, this.config.delayMaxSeconds, () => {
          const st2 = this.load();
          if (this.canRun(st2)) this.driver.navigate(`${this.driver.currentOrigin()}/gongsi/${brandId}.html`);
        });
        return;
      }
      next.currentJob = null;
      this.save(next);
      this.scheduleNextJob('岗位已抓，准备下一个');
    });
  }

  private handleCompanyPage(): void {
    const st = this.load();
    if (!this.canRun(st)) return;
    const pending = st.pendingCompany;
    const brandId = brandIdFromUrlString(this.driver.currentUrl()) || (pending && pending.brandId) || null;
    if (!pending || pending.step !== 'company' || pending.brandId !== brandId) {
      this.scheduleNextJob('非队列公司页，准备下一个岗位');
      return;
    }

    this.captureCurrent(true, (ok) => {
      if (!ok) return;
      const next = this.load();
      next.pendingCompany = { brandId: brandId!, step: 'company_jobs' };
      this.save(next);
      this.driver.schedule('准备进入公司在招页', this.config.delayMinSeconds, this.config.delayMaxSeconds, () => {
        const st2 = this.load();
        if (this.canRun(st2)) this.driver.navigate(`${this.driver.currentOrigin()}/gongsi/job/${brandId}.html`);
      });
    });
  }

  private handleCompanyJobsPage(): void {
    const st = this.load();
    if (!this.canRun(st)) return;
    const pending = st.pendingCompany;
    const brandId = brandIdFromUrlString(this.driver.currentUrl()) || (pending && pending.brandId) || null;
    if (!pending || pending.step !== 'company_jobs' || pending.brandId !== brandId) {
      this.scheduleNextJob('非队列在招页，准备下一个岗位');
      return;
    }

    this.captureCurrent(true, (ok) => {
      if (!ok) return;
      const next = this.load();
      if (brandId) next.companiesToday[brandId] = 1;
      next.pendingCompany = null;
      next.currentJob = null;
      this.save(next);
      this.scheduleNextJob('公司在招已抓，准备下一个岗位');
    });
  }

  // ---- 抓取当前页并写入仓库 ----
  private async captureCurrentAsync(auto: boolean): Promise<boolean> {
    const st = this.load();
    if (auto && !this.canRun(st)) return false;

    const type = this.driver.pageType();
    let ok = false;
    let message = 'OK';
    try {
      if (type === 'job_detail') {
        const parsed = this.driver.parseJobDetail();
        if (parsed) {
          await this.repo.upsertJob(parsed.job);
          if (parsed.company) await this.repo.upsertCompany(parsed.company);
          ok = true;
        } else {
          message = '解析岗位失败';
        }
      } else if (type === 'company') {
        const company = this.driver.parseCompany();
        if (company) {
          await this.repo.upsertCompany(company);
          ok = true;
        } else {
          message = '解析公司失败';
        }
      } else if (type === 'company_jobs') {
        const titles = this.driver.parseCompanyJobs();
        const brandId = brandIdFromUrlString(this.driver.currentUrl());
        if (brandId && titles) {
          await this.repo.replaceCompanyOpenJobs(brandId, titles, new Date().toISOString());
          ok = true;
        } else {
          message = '解析公司在招失败';
        }
      } else {
        message = '当前页面不可采集';
      }
    } catch (e) {
      ok = false;
      message = `存储写入失败：${e instanceof Error ? e.message : String(e)}`;
    }

    const next = this.load();
    if (ok) {
      if (auto) next.dailyCount += 1;
      next.lastMessage = `已抓取 ✓ ${message}`;
    } else {
      if (auto) next.status = 'error';
      next.lastMessage = `失败：${message}`;
    }
    this.save(next);
    return ok;
  }

  private captureCurrent(auto: boolean, done: (ok: boolean) => void): void {
    this.captureCurrentAsync(auto).then(done);
  }

  private scheduleNextJob(label: string): void {
    this.driver.schedule(label, this.config.delayMinSeconds, this.config.delayMaxSeconds, () => this.nextJob());
  }

  private nextJob(): void {
    const st = this.load();
    if (!this.canRun(st)) return;
    const item = st.queue.shift();
    if (!item) {
      st.status = 'completed';
      st.currentJob = null;
      st.pendingCompany = null;
      st.lastMessage = '队列完成';
      this.save(st);
      return;
    }
    st.currentJob = item;
    st.lastMessage = `准备进入岗位：${item.jobId}`;
    this.save(st);
    this.driver.navigate(item.url);
  }

  private openDashboardOnce(sessionId: string): void {
    const st = this.load();
    if (st.dashboardOpenedSessionId === sessionId) return;
    this.driver.openDashboard(sessionId);
    st.dashboardOpenedSessionId = sessionId;
    this.save(st);
  }

  // 暴露给面板渲染用的摘要
  progress(): { label: string; status: string; daily: string; queue: string } {
    const st = this.load();
    const done = (st.queueTotal || 0) - st.queue.length;
    return {
      label: statusLabel(st.status),
      status: st.status,
      daily: `${st.dailyCount}/${this.config.dailyAccountCap}`,
      queue: `${done}/${st.queueTotal || 0}`,
    };
  }
}

function ensureToday(st: CaptureStateV1, now: Date): CaptureStateV1 {
  const today = todayKey(now);
  if (st.today !== today) {
    st.today = today;
    st.dailyCount = 0;
    st.companiesToday = {};
    st.lastMessage = '新的一天，额度已重置';
  }
  return st;
}

function jobIdFromUrlString(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = /\/job_detail\/([^./?]+)\.html/.exec(url);
  return m ? m[1] : null;
}

function brandIdFromUrlString(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = /\/gongsi\/(?:job\/)?([^./?]+)\.html/.exec(url);
  return m ? m[1] : null;
}

function searchUrlForPage(url: string, n: number): string {
  try {
    const u = new URL(url);
    u.searchParams.set('page', String(n));
    return u.href;
  } catch {
    return '';
  }
}

function jobBrandFromParsed(repo: LocalRepository, jobId: string): string | null {
  const job = repo.getJob(jobId);
  return (job && job.companyId) || null;
}

export { pageTypeFromPath };
export type { QueueItem };
export { statusLabel };
export { defaultCaptureConfig, configFromLimits, todayKey } from './types';
export type { CaptureConfig, CaptureDriver, CollectedLinks, PageType } from './types';
