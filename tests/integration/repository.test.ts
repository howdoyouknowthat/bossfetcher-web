import { describe, expect, it } from 'vitest';
import type { BackupV1, CompanyV1, JobV1 } from '@bossfetcher/contracts';
import { createRepository, createMemoryStore, StorageError } from '@bossfetcher/repository';

function makeJob(id: string, over: Partial<JobV1> = {}): JobV1 {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    jobId: id,
    title: `岗位${id}`,
    companyId: `c${id}`,
    companyName: `公司${id}`,
    keyword: '运营',
    city: '杭州',
    district: '滨江区',
    address: '杭州市滨江区某大厦',
    salaryText: '20-30K',
    salaryMin: 20000,
    salaryMax: 30000,
    salaryMonths: 12,
    experience: '3-5年',
    degree: '本科',
    workTime: null,
    weekend: null,
    jdText: `岗位职责：${id}`,
    url: `https://www.zhipin.com/job_detail/${id}.html`,
    anonymous: false,
    agency: null,
    active: true,
    capturedAt: now,
    firstSeen: now,
    lastSeen: now,
    ...over,
  };
}

function makeCompany(id: string, over: Partial<CompanyV1> = {}): CompanyV1 {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    companyId: id,
    name: `公司${id}`,
    financing: '不需要融资',
    size: '100-499人',
    industry: '电子商务',
    registeredCapital: '118万人民币',
    foundedDate: '2016-12-23',
    legalRep: '张三',
    intro: null,
    openJobs: [],
    openJobsCapturedAt: null,
    firstSeen: now,
    lastSeen: now,
    ...over,
  };
}

describe('LocalRepository', () => {
  it('initializes schema and round-trips a job', async () => {
    const repo = createRepository(createMemoryStore());
    await repo.init();
    expect(repo.getSchemaVersion()).toBe(1);

    await repo.upsertJob(makeJob('j1'));
    const job = repo.getJob('j1');
    expect(job?.title).toBe('岗位j1');
    expect(job?.companyId).toBe('cj1');

    const page = repo.listJobs({ search: 'j1' });
    expect(page.total).toBe(1);
    expect(page.items[0].jobId).toBe('j1');
  });

  it('dedupes by jobId — duplicate upsert does not add records', async () => {
    const repo = createRepository(createMemoryStore());
    await repo.init();
    await repo.upsertJob(makeJob('dup'));
    await repo.upsertJob(makeJob('dup'));
    expect(repo.listJobs().total).toBe(1);
  });

  it('company merge keeps old value when new value is empty', async () => {
    const repo = createRepository(createMemoryStore());
    await repo.init();
    await repo.upsertCompany(makeCompany('c1', { financing: '不需要融资', size: '100-499人' }));
    await repo.upsertCompany(makeCompany('c1', { financing: null, size: '', industry: '电子商务' }));
    const c = repo.getCompany('c1');
    expect(c?.financing).toBe('不需要融资');
    expect(c?.size).toBe('100-499人');
    expect(c?.industry).toBe('电子商务');
  });

  it('company merge overwrites with valid new value', async () => {
    const repo = createRepository(createMemoryStore());
    await repo.init();
    await repo.upsertCompany(makeCompany('c1', { financing: '不需要融资' }));
    await repo.upsertCompany(makeCompany('c1', { financing: 'B轮' }));
    expect(repo.getCompany('c1')?.financing).toBe('B轮');
  });

  it('replaceCompanyOpenJobs replaces titles wholesale with capturedAt', async () => {
    const repo = createRepository(createMemoryStore());
    await repo.init();
    await repo.upsertCompany(makeCompany('c1', { openJobs: ['旧岗位'] }));
    await repo.replaceCompanyOpenJobs('c1', ['新岗位A', '新岗位B'], '2026-08-21T00:00:00.000Z');
    const c = repo.getCompany('c1');
    expect(c?.openJobs).toEqual(['新岗位A', '新岗位B']);
    expect(c?.openJobsCapturedAt).toBe('2026-08-21T00:00:00.000Z');
  });

  it('filters, sorts and paginates jobs', async () => {
    const repo = createRepository(createMemoryStore());
    await repo.init();
    await repo.upsertJob(makeJob('a', { salaryMin: 10000, city: '北京', keyword: '产品' }));
    await repo.upsertJob(makeJob('b', { salaryMin: 30000, city: '杭州', keyword: '运营' }));
    await repo.upsertJob(makeJob('c', { salaryMin: 20000, city: '杭州', keyword: '产品' }));

    const byCity = repo.listJobs({ city: '杭州', sortBy: 'salary', sortDir: 'asc' });
    expect(byCity.total).toBe(2);
    expect(byCity.items.map((j) => j.jobId)).toEqual(['c', 'b']);

    const paged = repo.listJobs({ limit: 1, offset: 0 });
    expect(paged.items).toHaveLength(1);
    expect(paged.total).toBe(3);
  });

  it('getOverview computes market stats', async () => {
    const repo = createRepository(createMemoryStore());
    await repo.init();
    await repo.upsertJob(makeJob('a', { salaryMin: 10000, salaryMax: 20000, degree: '本科', experience: '3-5年' }));
    await repo.upsertJob(makeJob('b', { salaryMin: 20000, salaryMax: 30000, degree: '本科', experience: '3-5年' }));
    await repo.upsertCompany(makeCompany('c1', { size: '100-499人', financing: '不需要融资' }));

    const ov = repo.getOverview();
    expect(ov.totalJobs).toBe(2);
    expect(ov.totalCompanies).toBe(1);
    expect(ov.byDegree['本科']).toBe(2);
    expect(ov.salaryMedianMin).toBe(15000);
    expect(ov.salaryMedianMax).toBe(25000);
  });

  it('handles 5000 synthetic jobs — save, load, filter, paginate', async () => {
    const repo = createRepository(createMemoryStore());
    await repo.init();
    const t0 = Date.now();
    for (let i = 0; i < 5000; i++) {
      const id = `bulk-${String(i).padStart(4, '0')}`;
      await repo.upsertJob(
        makeJob(id, {
          city: i % 2 === 0 ? '杭州' : '上海',
          degree: ['本科', '硕士', '大专'][i % 3],
          salaryMin: 10000 + (i % 30) * 1000,
        }),
      );
    }
    const writeMs = Date.now() - t0;

    expect(repo.listJobs().total).toBe(5000);

    const t1 = Date.now();
    const page = repo.listJobs({ city: '杭州', degree: '本科', limit: 50, offset: 0, sortBy: 'salary', sortDir: 'desc' });
    const readMs = Date.now() - t1;
    expect(page.total).toBeGreaterThan(0);
    expect(page.items.length).toBeLessThanOrEqual(50);
    expect(page.items.every((j) => j.city === '杭州' && j.degree === '本科')).toBe(true);

    const backup = repo.exportBackup();
    expect(backup.recordCounts.jobs).toBe(5000);

    // 报告写入/读取耗时，便于判断 Tampermonkey 容量是否可接受
    expect(writeMs).toBeLessThan(60000);
    expect(readMs).toBeLessThan(60000);
  });

  it('backup → clear → restore keeps counts and checksum consistent', async () => {
    const repo = createRepository(createMemoryStore());
    await repo.init();
    await repo.upsertJob(makeJob('a', { title: '备份A' }));
    await repo.upsertJob(makeJob('b', { title: '备份B' }));
    await repo.upsertCompany(makeCompany('c1'));

    const backup = repo.exportBackup();
    expect(backup.checksum).toBeTruthy();

    const repo2 = createRepository(createMemoryStore());
    await repo2.init();
    const preflight = repo2.preflightBackup(backup);
    expect(preflight.ok).toBe(true);

    const result = repo2.importBackup(backup, 'replace');
    expect(result.jobsAdded).toBe(2);
    expect(result.jobsUpdated).toBe(0);
    expect(repo2.listJobs().total).toBe(2);
    expect(repo2.getJob('a')?.title).toBe('备份A');

    const reexported = repo2.exportBackup();
    expect(reexported.recordCounts.jobs).toBe(2);
    expect(reexported.checksum).toBe(backup.checksum);

    await repo2.clearAll();
    expect(repo2.listJobs().total).toBe(0);
  });

  it('rejects invalid backup with checksum error and refuses to write', async () => {
    const repo = createRepository(createMemoryStore());
    await repo.init();
    const backup = repo.exportBackup();
    const bad: BackupV1 = { ...backup, jobs: [...backup.jobs, { ...backup.jobs[0] }] };
    const preflight = repo.preflightBackup(bad);
    expect(preflight.ok).toBe(false);

    const bad2 = { ...backup, backupFormatVersion: 99 } as unknown as BackupV1;
    expect(() => repo.importBackup(bad2, 'merge')).toThrow(StorageError);
  });

  it('preflight rejects backups missing companyId', async () => {
    const repo = createRepository(createMemoryStore());
    await repo.init();
    const backup = repo.exportBackup();
    const bad = { ...backup, companies: [{ schemaVersion: 1, name: 'no-id' }] };
    const preflight = repo.preflightBackup(bad);
    expect(preflight.ok).toBe(false);
    expect(preflight.errors.join('')).toContain('companyId');
  });

  it('default backup excludes the API key', async () => {
    const repo = createRepository(createMemoryStore());
    await repo.init();
    const s = repo.getSettings();
    s.apiKey = 'sk-secret-123';
    await repo.saveSettings(s);
    const backup = repo.exportBackup();
    expect(JSON.stringify(backup)).not.toContain('sk-secret-123');
    expect(backup.settings?.apiKey).toBeNull();
  });

  it('notifies subscribers on revision changes', async () => {
    const repo = createRepository(createMemoryStore());
    await repo.init();
    let notified = 0;
    const unsub = repo.subscribe(() => notified++);
    await repo.upsertJob(makeJob('n1'));
    await new Promise((r) => setTimeout(r, 10));
    expect(notified).toBeGreaterThan(0);
    unsub();
    const before = notified;
    await repo.upsertJob(makeJob('n2'));
    await new Promise((r) => setTimeout(r, 10));
    expect(notified).toBe(before);
  });

  it('migrates missing schema to current version without data loss', async () => {
    const store = createMemoryStore();
    // 模拟旧版本：只有岗位记录，没有 schema key
    const now = new Date().toISOString();
    store.set('bf:job:legacy', JSON.stringify(makeJob('legacy', { capturedAt: now, lastSeen: now })));
    store.set('bf:index:jobs', JSON.stringify(['legacy']));

    const repo = createRepository(store);
    await repo.init();
    expect(repo.getSchemaVersion()).toBe(1);
    expect(repo.getJob('legacy')?.jobId).toBe('legacy');
  });

  it('deleteJob removes a single record', async () => {
    const repo = createRepository(createMemoryStore());
    await repo.init();
    await repo.upsertJob(makeJob('del1'));
    await repo.upsertJob(makeJob('del2'));
    await repo.deleteJob('del1');
    expect(repo.getJob('del1')).toBeUndefined();
    expect(repo.getJob('del2')).toBeDefined();
    expect(repo.listJobs().total).toBe(1);
  });
});
