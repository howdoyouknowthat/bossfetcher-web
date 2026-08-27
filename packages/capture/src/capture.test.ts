import { describe, expect, it } from 'vitest';
import type { CaptureStateV1 } from '@bossfetcher/contracts';
import { createMemoryStore, createRepository } from '@bossfetcher/repository';
import { CaptureController, defaultCaptureConfig } from '@bossfetcher/capture';
import type { CaptureDriver, PageType } from '@bossfetcher/capture';

interface Pending {
  fn: () => void;
  ms: number;
}

function state(over: Partial<CaptureStateV1> = {}): CaptureStateV1 {
  return {
    schemaVersion: 1,
    status: 'idle',
    queue: [],
    seenJobs: {},
    doneJobs: {},
    keywordCounts: {},
    companiesToday: {},
    currentKeyword: '',
    currentJob: null,
    pendingCompany: null,
    today: '2026-07-18',
    dailyCount: 0,
    lastMessage: '就绪',
    sessionId: '',
    queueTotal: 0,
    dashboardOpenedSessionId: '',
    updatedAt: '2026-07-18T00:00:00.000Z',
    ...over,
  };
}

function makeDriver(initUrl: string): { driver: CaptureDriver; location: { href: string }; pending: { current: Pending | null }; snapshots: CaptureStateV1[] } {
  const location = { href: initUrl };
  const pending = { current: null as Pending | null };
  const snapshots: CaptureStateV1[] = [];

  const pageType = (): PageType => {
    const p = new URL(location.href).pathname;
    if (/\/web\/geek\/jobs/.test(p)) return 'search';
    if (/\/job_detail\//.test(p)) return 'job_detail';
    if (/\/gongsi\/job\//.test(p)) return 'company_jobs';
    if (/\/gongsi\//.test(p)) return 'company';
    return 'page';
  };

  const driver: CaptureDriver = {
    pageType,
    currentUrl: () => location.href,
    currentOrigin: () => new URL(location.href).origin,
    currentKeyword: () => new URL(location.href).searchParams.get('query') || '',
    currentPageNum: () => parseInt(new URL(location.href).searchParams.get('page') || '1', 10) || 1,
    collectJobLinks: () => ({ items: [], added: 0 }),
    parseJobDetail: () => null,
    parseCompany: () => null,
    parseCompanyJobs: () => [],
    navigate: (url) => {
      location.href = url;
    },
    openDashboard: () => undefined,
    schedule: (_label, minSeconds, maxSeconds, fn) => {
      const min = Math.max(1, minSeconds);
      const max = Math.max(min, maxSeconds);
      pending.current = { fn, ms: Math.floor((min + 0 * (max - min)) * 1000) };
    },
    runSoon: (_label, fn) => {
      pending.current = { fn, ms: 600 };
    },
    now: () => new Date(2026, 6, 18, 14, 0, 0),
    report: (st) => snapshots.push(JSON.parse(JSON.stringify(st))),
    onRun: () => undefined,
  };

  return { driver, location, pending, snapshots };
}

async function setup(initUrl: string, initialState: CaptureStateV1) {
  const store = createMemoryStore();
  const repo = createRepository(store);
  await repo.init();
  await repo.saveCaptureState(initialState);
  const ctx = makeDriver(initUrl);
  const controller = new CaptureController(repo, ctx.driver, defaultCaptureConfig());
  return { repo, controller, ...ctx };
}

function lastSnapshot(snapshots: CaptureStateV1[]): CaptureStateV1 | undefined {
  return snapshots.length > 0 ? snapshots[snapshots.length - 1] : undefined;
}

describe('CaptureController state machine (parity with test_userscript_behavior.mjs)', () => {
  it('case1: matching current_job + keyword → resume', async () => {
    const { controller, pending, snapshots } = await setup(
      'https://www.zhipin.com/job_detail/abc123.html',
      state({
        status: 'paused',
        seenJobs: { abc123: 1 },
        keywordCounts: { 产品经理: 5 },
        currentKeyword: '产品经理',
        currentJob: { jobId: 'abc123', url: 'https://www.zhipin.com/job_detail/abc123.html', keyword: '产品经理' } as never,
        today: '2026-07-18',
        dailyCount: 3,
        lastMessage: '已暂停',
        sessionId: 'bf-old',
        queueTotal: 12,
      }),
    );
    snapshots.length = 0;

    controller.start();

    const snap = lastSnapshot(snapshots)!;
    expect(snap.status).toBe('running');
    expect(snap.lastMessage).toContain('恢复');
    expect(snap.queueTotal).toBe(12);
    expect(pending.current).not.toBeNull();
    expect(pending.current!.ms).toBe(600);
  });

  it('case2: current_job=A, page=X → return to A without losing A', async () => {
    const jobAUrl = 'https://www.zhipin.com/job_detail/abc123.html';
    const { controller, location, pending, snapshots } = await setup(
      'https://www.zhipin.com/job_detail/xyz999.html',
      state({
        status: 'paused',
        queue: [{ jobId: 'def456', url: 'https://www.zhipin.com/job_detail/def456.html', keyword: '运营' }],
        seenJobs: { abc123: 1, def456: 1 },
        keywordCounts: { 运营: 2 },
        currentKeyword: '运营',
        currentJob: { jobId: 'abc123', url: jobAUrl, keyword: '运营' } as never,
        today: '2026-07-18',
        dailyCount: 7,
        lastMessage: '已暂停',
        sessionId: 'bf-old',
        queueTotal: 10,
      }),
    );
    snapshots.length = 0;

    controller.start();

    const snap = lastSnapshot(snapshots)!;
    expect(snap.status).toBe('running');
    expect(snap.lastMessage).toContain('返回未完成');
    expect(snap.lastMessage).toContain('abc123');
    expect(snap.queueTotal).toBe(10);
    expect(pending.current).not.toBeNull();
    expect(pending.current!.ms).toBe(600);

    pending.current!.fn();
    expect(location.href).toBe(jobAUrl);
  });

  it('case3: no current_job + queue → nextJob consumes queue', async () => {
    const { controller, pending, snapshots } = await setup(
      'https://www.zhipin.com/job_detail/xyz999.html',
      state({
        status: 'paused',
        queue: [
          { jobId: 'aaa111', url: 'https://www.zhipin.com/job_detail/aaa111.html', keyword: '运营' },
          { jobId: 'bbb222', url: 'https://www.zhipin.com/job_detail/bbb222.html', keyword: '运营' },
        ],
        seenJobs: { aaa111: 1, bbb222: 1 },
        keywordCounts: { 运营: 2 },
        currentKeyword: '运营',
        today: '2026-07-18',
        lastMessage: '就绪',
        sessionId: '',
        queueTotal: 8,
      }),
    );
    snapshots.length = 0;

    controller.start();

    const snap = lastSnapshot(snapshots)!;
    expect(snap.status).toBe('running');
    expect(snap.lastMessage).toContain('从队列继续');
    expect(pending.current).not.toBeNull();
    expect(pending.current!.ms).toBe(600);

    pending.current!.fn();
    // nextJob navigates; queue shrinks
  });

  it('case4a: nothing valid → idle', async () => {
    const { controller, pending, snapshots } = await setup(
      'https://www.zhipin.com/job_detail/unknown999.html',
      state({ status: 'idle', queue: [], today: '2026-07-18' }),
    );
    snapshots.length = 0;

    controller.start();

    const snap = lastSnapshot(snapshots)!;
    expect(snap.status).toBe('idle');
    expect(snap.lastMessage).toContain('返回搜索页');
    expect(pending.current).toBeNull();
  });

  it('case4b: matching but no keyword → idle', async () => {
    const { controller, snapshots } = await setup(
      'https://www.zhipin.com/job_detail/abc123.html',
      state({
        status: 'paused',
        seenJobs: { abc123: 1 },
        currentJob: { jobId: 'abc123', url: 'https://www.zhipin.com/job_detail/abc123.html', keyword: '' } as never,
        today: '2026-07-18',
        dailyCount: 1,
        lastMessage: '已暂停',
        sessionId: 'bf-old',
        queueTotal: 5,
      }),
    );
    snapshots.length = 0;

    controller.start();

    expect(lastSnapshot(snapshots)!.status).toBe('idle');
  });

  it('search page without keyword stays idle', async () => {
    const { controller, snapshots } = await setup(
      'https://www.zhipin.com/web/geek/jobs',
      state({ status: 'idle', today: '2026-07-18' }),
    );
    snapshots.length = 0;
    controller.start();
    const snap = lastSnapshot(snapshots)!;
    expect(snap.status).toBe('idle');
    expect(snap.lastMessage).toContain('搜索岗位关键词');
  });

  it('non-capture page prompts login', async () => {
    const { controller, snapshots } = await setup(
      'https://www.zhipin.com/web/geek/recommend',
      state({ status: 'idle', today: '2026-07-18' }),
    );
    snapshots.length = 0;
    controller.start();
    const snap = lastSnapshot(snapshots)!;
    expect(snap.lastMessage).toContain('请先登录并进入搜索页');
  });

  it('daily cap pauses automatically', async () => {
    const { controller, snapshots } = await setup(
      'https://www.zhipin.com/job_detail/abc123.html',
      state({
        status: 'running',
        currentJob: { jobId: 'abc123', url: 'https://www.zhipin.com/job_detail/abc123.html', keyword: '产品经理' } as never,
        currentKeyword: '产品经理',
        dailyCount: 120,
        today: '2026-07-18',
        lastMessage: '运行中',
      }),
    );
    snapshots.length = 0;
    controller.runAuto();
    const snap = lastSnapshot(snapshots)!;
    expect(snap.status).toBe('paused');
    expect(snap.lastMessage).toContain('今日额度已达上限');
  });

  it('per-keyword limit is enforced even when a page yields a full keyword batch', async () => {
    const store = createMemoryStore();
    const repo = createRepository(store);
    await repo.init();
    const ctx = makeDriver('https://www.zhipin.com/web/geek/jobs?query=研发&page=1');
    ctx.driver.collectJobLinks = (kw, limit, seen, done) => {
      const items = [];
      for (let i = 0; i < limit + 50; i++) {
        const id = `ov-${i}`;
        if (seen[id] || done[id]) continue;
        items.push({ jobId: id, url: `https://www.zhipin.com/job_detail/${id}.html`, keyword: kw });
      }
      return { items, added: items.length };
    };
    const controller = new CaptureController(repo, ctx.driver, defaultCaptureConfig());
    const st = repo.getCaptureState();
    st.status = 'running';
    st.currentKeyword = '研发';
    await repo.saveCaptureState(st);
    controller.runAuto();
    // runAuto -> handleSearchPage -> schedule -> fire list-stage callback -> collectJobLinks
    ctx.pending.current!.fn();
    const total = repo.getCaptureState().queueTotal;
    expect(total).toBeLessThanOrEqual(defaultCaptureConfig().perKeywordLimit);
  });

  it('manual capture on a parseable detail page writes one record', async () => {
    const store = createMemoryStore();
    const repo = createRepository(store);
    await repo.init();
    await repo.saveCaptureState(state({ status: 'idle', today: '2026-07-18' }));
    const ctx = makeDriver('https://www.zhipin.com/job_detail/manual1.html');
    ctx.driver.parseJobDetail = () => ({
      job: {
        schemaVersion: 1, jobId: 'manual1', title: '手动岗位', companyId: 'c1', companyName: '公司1',
        keyword: null, city: '杭州', district: null, address: null, salaryText: '20-30K',
        salaryMin: 20000, salaryMax: 30000, salaryMonths: 12, experience: null, degree: null,
        workTime: null, weekend: null, jdText: '岗位职责', url: 'https://www.zhipin.com/job_detail/manual1.html',
        anonymous: false, agency: null, active: true, capturedAt: new Date().toISOString(),
        firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString(),
      },
      company: {
        schemaVersion: 1, companyId: 'c1', name: '公司1', financing: null, size: null, industry: null,
        registeredCapital: null, foundedDate: null, legalRep: null, intro: null, openJobs: [],
        openJobsCapturedAt: null, firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString(),
      },
    });
    const controller = new CaptureController(repo, ctx.driver, defaultCaptureConfig());

    await controller.captureManual();
  
    expect(repo.getJob('manual1')).toBeDefined();
    expect(repo.getCompany('c1')).toBeDefined();
    expect(repo.getOverview().totalJobs).toBe(1);
  });
});
