#!/usr/bin/env node
/**
 * 生成 5,000 条合成岗位 JSON，用于 LocalRepository 性能验收（保存/加载/筛选/分页/导出/恢复）。
 * 输出到 fixtures/jobs-5000.json（gitignore），不包含任何真实数据。
 *
 * 用法：node scripts/generate-fixtures.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outFile = resolve(__dirname, '..', 'fixtures', 'jobs-5000.json');

const cities = ['杭州', '上海', '北京', '深圳', '广州'];
const degrees = ['大专', '本科', '硕士'];
const experiences = ['1-3年', '3-5年', '5-10年', '在校/应届'];
const titles = ['前端工程师', '后端工程师', '产品经理', '运营专员', '数据分析师', '测试工程师', 'UI设计师'];

function makeJob(i) {
  const id = `synth-${String(i).padStart(5, '0')}`;
  const now = new Date(Date.UTC(2026, 7, 20, 12, 0, 0) + i * 60000).toISOString();
  return {
    schemaVersion: 1,
    jobId: id,
    title: titles[i % titles.length],
    companyId: `c${i % 2000}`,
    companyName: `合成公司${i % 2000}`,
    keyword: i % 2 === 0 ? '运营' : '研发',
    city: cities[i % cities.length],
    district: null,
    address: `${cities[i % cities.length]}某大厦`,
    salaryText: `${10 + (i % 30)}-${20 + (i % 30)}K`,
    salaryMin: 10000 + (i % 30) * 1000,
    salaryMax: 20000 + (i % 30) * 1000,
    salaryMonths: 12 + (i % 4),
    experience: experiences[i % experiences.length],
    degree: degrees[i % degrees.length],
    workTime: null,
    weekend: i % 3 === 0 ? '双休' : '大小周',
    jdText: `岗位职责：负责${titles[i % titles.length]}相关工作（合成数据，仅用于性能测试）。`,
    url: `https://www.zhipin.com/job_detail/${id}.html`,
    anonymous: false,
    agency: null,
    active: true,
    capturedAt: now,
    firstSeen: now,
    lastSeen: now,
  };
}

mkdirSync(resolve(__dirname, '..', 'fixtures'), { recursive: true });
const jobs = Array.from({ length: 5000 }, (_, i) => makeJob(i));
writeFileSync(outFile, JSON.stringify(jobs));
console.log(`已生成 ${jobs.length} 条合成岗位 → ${outFile}`);
