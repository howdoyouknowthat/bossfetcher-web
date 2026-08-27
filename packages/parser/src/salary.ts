export interface ParsedSalary {
  salaryMin: number | null;
  salaryMax: number | null;
  salaryMonths: number | null;
}

const NUM_UNIT = /(\d+(?:\.\d+)?)\s*(K|k|千|万)?/;

function toYuan(n: number, unit: string | null): number {
  if (unit === 'K' || unit === 'k' || unit === '千') return Math.round(n * 1000);
  if (unit === '万') return Math.round(n * 10000);
  return Math.round(n);
}

/**
 * 移植自 bossfetcher/salary.py 的薪资归一化。
 * BOSS 常见格式：
 *   20-35K          -> {20000, 35000, 12}
 *   20-35K·13薪      -> {20000, 35000, 13}
 *   8千-1.2万        -> {8000, 12000, 12}
 *   1.2万-2万·14薪   -> {12000, 20000, 14}
 *   300-500元/天     -> {300, 500, null}   // 日薪不按月数归一
 *   面议 / 空        -> {null, null, null}
 */
export function parseSalary(text: string | null | undefined): ParsedSalary {
  if (!text) return { salaryMin: null, salaryMax: null, salaryMonths: null };
  const t = String(text).trim();
  if (t.includes('面议') || !/\d/.test(t)) {
    return { salaryMin: null, salaryMax: null, salaryMonths: null };
  }

  let months: number | null = 12;
  const m = /(\d+)\s*薪/.exec(t);
  if (m) months = parseInt(m[1], 10);

  const head = t.split(/[·]/)[0];
  let period: 'month' | 'day' | 'hour' = 'month';
  if (head.includes('天') || head.includes('日')) period = 'day';
  else if (head.includes('时')) period = 'hour';

  function extract(part: string): [number | null, string | null] {
    const mm = NUM_UNIT.exec(part);
    if (!mm) return [null, null];
    return [parseFloat(mm[1]), mm[2] ?? null];
  }

  const parts = head.split('-');
  let salaryMin: number | null = null;
  let salaryMax: number | null = null;
  if (parts.length >= 2) {
    const [lo, lou] = extract(parts[0]);
    const [hi, hiu] = extract(parts[1]);
    const unit = lou || hiu;
    if (lo !== null) salaryMin = toYuan(lo, lou || unit);
    if (hi !== null) salaryMax = toYuan(hi, hiu || unit);
  } else {
    const [lo, lou] = extract(parts[0]);
    if (lo !== null) salaryMin = salaryMax = toYuan(lo, lou);
  }

  if (period !== 'month') months = null;
  return { salaryMin, salaryMax, salaryMonths: months };
}
