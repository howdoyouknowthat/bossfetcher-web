import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  parseJobPage,
  parseCompanyPage,
  parseCompanyJobsPage,
  parseSalary,
  pageTypeFromPath,
  jobIdFromUrlString,
  brandIdFromUrlString,
} from '@bossfetcher/parser';

function docFrom(html: string): Document {
  return new JSDOM(html).window.document;
}

describe('parser parity (Python parse_html.py)', () => {
  const JOB_HTML = `
<html><body>
  <h1>私域运营经理</h1>
  <span class="salary">20-30K</span>
  <p class="text-experiece">3-5年</p>
  <p class="text-degree">本科</p>
  <span class="text-city">杭州</span>
  <div class="location-address">杭州市滨江区西兴街道</div>
  <div class="job-sec-text">岗位职责：负责社群运营和用户增长，双休，9:00-18:00。</div>
  <div class="sider-company">
    <div class="company-info"><a href="/gongsi/synthetic-brand.html" title="示例科技">示例科技</a></div>
    <a href="/gongsi/synthetic-brand.html">公司主页</a>
    <p><i class="icon-stage"></i>不需要融资</p>
    <p><i class="icon-scale"></i>100-499人</p>
    <p><i class="icon-industry"></i>电子商务</p>
  </div>
</body></html>`;

  it('parses a job detail page', () => {
    const { job, company } = parseJobPage(docFrom(JOB_HTML), 'https://www.zhipin.com/job_detail/synthetic-job-001.html');
    expect(job.title).toBe('私域运营经理');
    expect(job.salaryText).toBe('20-30K');
    expect([job.salaryMin, job.salaryMax, job.salaryMonths]).toEqual([20000, 30000, 12]);
    expect(job.experience).toBe('3-5年');
    expect(job.degree).toBe('本科');
    expect(job.city).toBe('杭州');
    expect(job.address).toContain('杭州');
    expect(job.jdText).toBeTruthy();
    expect(job.jdText!.length).toBeGreaterThan(10);
    expect(company).not.toBeNull();
    expect(company!.name).toBe('示例科技');
    expect(company!.financing).toBe('不需要融资');
    expect(company!.size).toBe('100-499人');
    expect(company!.industry).toBe('电子商务');
  });

  const COMPANY_HTML = `
<html><body>
  <div class="info-primary"><div class="info"><h1 class="name">示例科技</h1></div></div>
  <div class="business-detail">
    <div class="business-detail-money">注册资本：118万人民币</div>
    <div class="business-detail-time">成立时间：2016-12-23</div>
    <div class="business-detail-user">法定代表人：张三</div>
    <div class="business-detail-status">经营状态：存续</div>
  </div>
</body></html>`;

  it('parses a company page', () => {
    const comp = parseCompanyPage(docFrom(COMPANY_HTML), 'synthetic-brand-001');
    expect(comp.companyId).toBe('synthetic-brand-001');
    expect(comp.registeredCapital).toBe('118万人民币');
    expect(comp.foundedDate).toBe('2016-12-23');
    expect(comp.legalRep).toBe('张三');
    expect(comp.name).toContain('示例');
  });

  const COMPANY_JOBS_HTML = `
<html><body>
  <div class="company-position-job">
    <a class="job-name">私域运营经理</a>
    <a class="job-name">用户运营</a>
    <a class="job-name">内容运营</a>
  </div>
</body></html>`;

  it('parses company open job titles', () => {
    const titles = parseCompanyJobsPage(docFrom(COMPANY_JOBS_HTML));
    expect(titles).toHaveLength(3);
    expect(titles[0]).toBe('私域运营经理');
  });

  it('strips BOSS watermark and restores split words in JD', () => {
    const html =
      "<h1>大健康销售</h1>" +
      "<div class='job-sec-text'>BOSS直聘 岗位职责: 公司提供资<span>BOSS直聘</span>源渠道,通过企业微信联系客户</div>";
    const { job } = parseJobPage(docFrom(html), 'https://www.zhipin.com/job_detail/xx.html');
    expect(job.jdText).not.toContain('BOSS直聘');
    expect(job.jdText).toContain('资源渠道');
    expect(job.jdText!.startsWith('岗位职责')).toBe(true);
  });

  it('extracts district from city + address', () => {
    const html =
      "<h1>私域运营</h1>" +
      "<div class='text-city'>杭州</div>" +
      "<div class='location-address'>杭州市滨江区西兴街道</div>" +
      "<div class='job-sec-text'>负责社群运营</div>";
    const { job } = parseJobPage(docFrom(html), 'https://www.zhipin.com/job_detail/district1.html');
    expect(job.city).toBe('杭州');
    expect(job.address).toBe('杭州市滨江区西兴街道');
    expect(job.district).toBe('滨江区');
  });

  it('throws when the page has no title (structure changed, no fake record)', () => {
    const html = '<html><body><div class="not-a-job-page">验证码</div></body></html>';
    expect(() => parseJobPage(docFrom(html), 'https://www.zhipin.com/job_detail/missing.html')).toThrow(/岗位标题/);
  });

  it('marks anonymous/agency jobs without a fake company', () => {
    const html =
      "<h1>产品经理</h1>" +
      "<div class='salary'>20-30K</div>" +
      "<div class='brand-name'>代招公司：某新零售公司</div>" +
      "<div class='boss-info-attr'>上海洛全企业 · 猎头顾问</div>" +
      "<div class='info-company-logo is-anonymity'></div>" +
      "<div class='job-sec-text'>岗位职责: 负责产品规划</div>";
    const { job, company } = parseJobPage(docFrom(html), 'https://www.zhipin.com/job_detail/anon1.html');
    expect(job.companyId).toBeNull();
    expect(company).toBeNull();
    expect(job.companyName).toBe('代招公司：某新零售公司');
    expect(job.anonymous).toBe(true);
    expect(job.agency).toBe('上海洛全企业 · 猎头顾问');
    expect(job.salaryMin).toBe(20000);
    expect(job.title).toBe('产品经理');
  });

  it('normalizes NFKC compatibility characters in JD', () => {
    const html =
      "<h1>测试</h1>" +
      "<div class='job-sec-text'>负责⽤户增长与⼴告投放（全角数字１２３）</div>";
    const { job } = parseJobPage(docFrom(html), 'https://www.zhipin.com/job_detail/nfkc.html');
    expect(job.jdText).toContain('负责用户增长与广告投放');
    expect(job.jdText).toContain('全角数字123');
  });
});

describe('salary parity (Python salary.py)', () => {
  const cases: Array<[string | null, [number | null, number | null, number | null]]> = [
    ['20-35K', [20000, 35000, 12]],
    ['20-35K·13薪', [20000, 35000, 13]],
    ['8千-1.2万', [8000, 12000, 12]],
    ['1.2万-2万·14薪', [12000, 20000, 14]],
    ['300-500元/天', [300, 500, null]],
    ['面议', [null, null, null]],
    ['', [null, null, null]],
    ['15K', [15000, 15000, 12]],
    ['6-8K·15薪', [6000, 8000, 15]],
    [null, [null, null, null]],
  ];

  it.each(cases)('parseSalary(%j) === %j', (input, expected) => {
    const r = parseSalary(input);
    expect([r.salaryMin, r.salaryMax, r.salaryMonths]).toEqual(expected);
  });

  it('clears font-encrypted (PUA) salary numeric fields but keeps text', () => {
    const html =
      "<h1>测试</h1>" +
      '<div class="salary">20-30K\uE011\uE102</div>';
    const { job } = parseJobPage(docFrom(html), 'https://www.zhipin.com/job_detail/pua.html');
    expect(job.salaryText).toBe('20-30K\uE011\uE102');
    expect(job.salaryMin).toBeNull();
    expect(job.salaryMax).toBeNull();
    expect(job.salaryMonths).toBeNull();
  });
});

describe('url helpers', () => {
  it('extracts job/brand ids and page types', () => {
    expect(jobIdFromUrlString('https://www.zhipin.com/job_detail/abc123.html?query=x')).toBe('abc123');
    expect(brandIdFromUrlString('https://www.zhipin.com/gongsi/brand99.html')).toBe('brand99');
    expect(brandIdFromUrlString('https://www.zhipin.com/gongsi/job/brand99.html')).toBe('brand99');
    expect(pageTypeFromPath('/web/geek/jobs')).toBe('search');
    expect(pageTypeFromPath('/job_detail/abc.html')).toBe('job_detail');
    expect(pageTypeFromPath('/gongsi/job/brand99.html')).toBe('company_jobs');
    expect(pageTypeFromPath('/gongsi/brand99.html')).toBe('company');
    expect(pageTypeFromPath('/other')).toBe('page');
  });
});
