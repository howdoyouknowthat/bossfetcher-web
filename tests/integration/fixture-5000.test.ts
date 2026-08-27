import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { JobV1 } from '@bossfetcher/contracts';
import { createMemoryStore, createRepository } from '@bossfetcher/repository';

const fixturePath = resolve(__dirname, '..', '..', 'fixtures', 'jobs-5000.json');

/**
 * 若已通过 scripts/generate-fixtures.mjs 生成 5,000 条合成数据，则验证
 * 导入、搜索、筛选、分页与导出性能。未生成时跳过（不阻塞 CI）。
 */
describe('5000-record fixture (optional)', () => {
  const available = existsSync(fixturePath);
  const run = available ? it : it.skip;

  run('imports, queries and exports 5000 synthetic jobs within budget', async () => {
    const jobs = JSON.parse(readFileSync(fixturePath, 'utf8')) as JobV1[];
    expect(jobs.length).toBe(5000);

    const store = createMemoryStore();
    const repo = createRepository(store);
    await repo.init();

    const t0 = Date.now();
    for (const job of jobs) await repo.upsertJob(job);
    const writeMs = Date.now() - t0;
    expect(writeMs).toBeLessThan(60000);

    const t1 = Date.now();
    const page = repo.listJobs({ city: '杭州', degree: '本科', keywordInclude: '运营', limit: 50, sortBy: 'salary', sortDir: 'desc' });
    const readMs = Date.now() - t1;
    expect(page.items.length).toBeLessThanOrEqual(50);
    expect(page.total).toBeGreaterThan(0);

    const backup = repo.exportBackup();
    expect(backup.recordCounts.jobs).toBe(5000);
    expect(backup.checksum).toBeTruthy();

    const csv = repo.exportCsv();
    expect(csv.split('\n').length).toBe(5001);

    console.log(`  fixture perf: write=${writeMs}ms read=${readMs}ms`);
  });
});
