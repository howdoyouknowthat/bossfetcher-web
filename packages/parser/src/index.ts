import type { CompanyV1, JobV1 } from '@bossfetcher/contracts';
import { parseSalary, type ParsedSalary } from './salary';

export { parseSalary };
export type { ParsedSalary };

export interface ParseJobResult {
  job: JobV1;
  company: CompanyV1 | null;
}

export interface ParseError {
  kind: 'missing-job-id' | 'missing-title' | 'structure-changed' | 'unknown';
  message: string;
  url?: string;
}

const WATERMARK = /\s*(?:来自\s*)?BOSS\s*直聘\s*/g;
const BRAND_RE = /gongsi\/(?:job\/)?([^./?]+)\.html/;
const JOBID_RE = /job_detail\/([^./?]+)\.html/;
const SIZE_RE = /\d+\s*-\s*\d+\s*人|\d+\s*人以[上下]|\d+\s*人/;
const DISTRICT_RE = /[一-鿿]{2,3}(?:区|县)/;
const PLACEHOLDER = new Set(['', '-', '—', '暂无', '未公开', '未披露', '保密']);

function nowIso(): string {
  return new Date().toISOString();
}

function noPlaceholder(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const t = v.trim();
  return PLACEHOLDER.has(t) ? null : t;
}

function hasPua(s: string | null | undefined): boolean {
  if (!s) return false;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xe000 && c <= 0xf8ff) return true;
  }
  return false;
}

function isElement(node: Node | null): node is Element {
  return !!node && node.nodeType === 1;
}

/**
 * 等价于 BeautifulSoup 的 get_text(" ", strip=True)：元素间以单个空格连接，
 * 空白折叠后去除首尾。
 */
function getText(el: Element | null | undefined): string | null {
  if (!el) return null;
  const parts: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      const t = node.textContent;
      if (t) parts.push(t);
    } else if (node.nodeType === 1) {
      for (const child of node.childNodes) walk(child);
    }
  };
  walk(el);
  const joined = parts.join(' ').replace(/\s+/g, ' ').trim();
  return joined || null;
}

function stripLabel(s: string | null | undefined): string | null {
  if (!s) return s ?? null;
  for (const sep of ['：', ':']) {
    const idx = s.indexOf(sep);
    if (idx !== -1) return s.slice(idx + 1).trim();
  }
  return s.trim();
}

function brandIdFrom(scope: ParentNode): string | null {
  const anchors = scope.querySelectorAll("a[href*='/gongsi/']");
  for (const a of Array.from(anchors)) {
    const href = a.getAttribute('href') || '';
    const m = BRAND_RE.exec(href);
    if (m && m[1]) return m[1];
  }
  return null;
}

function iconText(scope: ParentNode, iconClass: string): string | null {
  const icon = scope.querySelector(`i.${iconClass}`);
  if (icon && isElement(icon.parentElement)) return getText(icon.parentElement);
  return null;
}

function district(city: string | null | undefined, address: string | null | undefined): string | null {
  if (!address) return null;
  let rest = address;
  if (city && rest.startsWith(city)) rest = rest.slice(city.length);
  rest = rest.replace(/^市/, '');
  const m = DISTRICT_RE.exec(rest);
  return m ? m[0] : null;
}

function jobIdFromUrl(url: string | null | undefined, doc: Document): string | null {
  if (url) {
    const m = JOBID_RE.exec(url);
    if (m) return m[1];
  }
  const canonical = doc.querySelector("link[rel='canonical']");
  if (canonical) {
    const href = canonical.getAttribute('href');
    if (href) {
      const m = JOBID_RE.exec(href);
      if (m) return m[1];
    }
  }
  return null;
}

/**
 * 岗位详情页 -> JobV1 + 公司基本信息。
 * 纯函数：不写存储、不发网络、不保留完整 HTML。
 */
export function parseJobPage(doc: Document, url?: string | null): ParseJobResult {
  const jobId = jobIdFromUrl(url, doc) || `unknown:${(getText(doc.querySelector('h1')) || '').slice(0, 24)}`;

  const title = getText(doc.querySelector('h1')) || '';
  if (!title) {
    throw new Error("页面结构已变化：无法提取岗位标题");
  }

  const salaryText = getText(doc.querySelector('.salary'));
  let { salaryMin, salaryMax, salaryMonths } = parseSalary(salaryText);
  if (salaryText && hasPua(salaryText)) {
    salaryMin = salaryMax = salaryMonths = null;
  }

  let name: string | null = null;
  let financing: string | null = null;
  let size: string | null = null;
  let industry: string | null = null;
  let brand: string | null = null;
  const sider = doc.querySelector('.sider-company');
  if (sider) {
    brand = brandIdFrom(sider);
    const infoAnchor = sider.querySelector('.company-info a[title]');
    if (infoAnchor && isElement(infoAnchor)) {
      const t = infoAnchor.getAttribute('title');
      name = (t && t.trim()) || getText(sider.querySelector('.company-info a'));
    } else {
      name = getText(sider.querySelector('.company-info a'));
    }
    financing = iconText(sider, 'icon-stage');
    size = iconText(sider, 'icon-scale');
    industry = iconText(sider, 'icon-industry');
  }

  let anonymous = false;
  let agency: string | null = null;
  if (!brand) {
    const bn = getText(doc.querySelector('.brand-name'));
    if (doc.querySelector("[class*='is-anonymity']") || (bn && bn.includes('代招'))) {
      anonymous = true;
      name = name || bn;
      agency = getText(doc.querySelector('.boss-info-attr'));
    }
  }

  const secs: string[] = [];
  for (const el of Array.from(doc.querySelectorAll('.job-sec-text'))) {
    const t = getText(el);
    if (t) secs.push(t);
  }
  let jd = secs.join('\n').replace(WATERMARK, '').trim();
  if (jd) {
    try {
      jd = jd.normalize('NFKC');
    } catch {
      // keep as-is if normalize is unavailable
    }
  } else {
    jd = '';
  }

  const city = getText(doc.querySelector('.text-city'));
  const address = getText(doc.querySelector('.location-address'));

  const job: JobV1 = {
    schemaVersion: 1,
    jobId,
    title,
    companyId: brand,
    companyName: name,
    keyword: null,
    city,
    district: district(city, address),
    address,
    salaryText,
    salaryMin,
    salaryMax,
    salaryMonths,
    experience: getText(doc.querySelector('.text-experiece')),
    degree: getText(doc.querySelector('.text-degree')),
    workTime: null,
    weekend: null,
    jdText: jd || null,
    url: url ?? null,
    anonymous,
    agency,
    active: true,
    capturedAt: nowIso(),
    firstSeen: nowIso(),
    lastSeen: nowIso(),
  };

  const company: CompanyV1 | null = anonymous
    ? null
    : {
        schemaVersion: 1,
        companyId: brand || name || 'unknown',
        name: name || '',
        financing,
        size,
        industry,
        registeredCapital: null,
        foundedDate: null,
        legalRep: null,
        intro: null,
        openJobs: [],
        openJobsCapturedAt: null,
        firstSeen: nowIso(),
        lastSeen: nowIso(),
      };

  return { job, company };
}

function businessDetail(doc: Document, cls: string): string | null {
  return stripLabel(getText(doc.querySelector(`.${cls}`)));
}

/**
 * 公司页（工商信息）-> CompanyV1。
 */
export function parseCompanyPage(doc: Document, brandId?: string | null): CompanyV1 {
  let name: string | null = null;
  const h1 = doc.querySelector('.info-primary .info h1.name, .info-primary h1.name, h1.name');
  if (h1) {
    const direct = Array.from(h1.childNodes).find((n) => n.nodeType === 3);
    name = (direct && direct.textContent ? direct.textContent.trim() : null) || getText(h1);
  }
  const fullName = getText(doc.querySelector('.company-full-name'));
  if (name && (name.includes('…') || name.includes('...'))) {
    name = fullName || name;
  }

  let financing: string | null = null;
  let size: string | null = null;
  let industry: string | null = null;
  const p = doc.querySelector('.info-primary .info > p') || doc.querySelector('.info-primary .info p');
  if (p) {
    industry = getText(p.querySelector('.industry-link'));
    const ptxt = getText(p) || '';
    const m = SIZE_RE.exec(ptxt);
    if (m) {
      size = m[0].replace(/\s+/g, '');
      if (size) financing = ptxt.split(size)[0].trim() || null;
    } else if (industry) {
      financing = ptxt.split(industry)[0].trim() || null;
    }
  }

  return {
    schemaVersion: 1,
    companyId: brandId || brandIdFrom(doc) || fullName || name || 'unknown',
    name: name || fullName || '',
    financing,
    size,
    industry,
    registeredCapital: noPlaceholder(businessDetail(doc, 'business-detail-money')),
    foundedDate: noPlaceholder(businessDetail(doc, 'business-detail-time')),
    legalRep: noPlaceholder(businessDetail(doc, 'business-detail-user')),
    intro: null,
    openJobs: [],
    openJobsCapturedAt: null,
    firstSeen: nowIso(),
    lastSeen: nowIso(),
  };
}

/**
 * 公司在招岗位页 -> 同期在招岗位标题列表。
 */
export function parseCompanyJobsPage(doc: Document): string[] {
  let scope = Array.from(doc.querySelectorAll('.position-job-list a.job-name, .company-position-job a.job-name'));
  if (scope.length === 0) {
    scope = Array.from(doc.querySelectorAll('a.job-name'));
  }
  return scope.map((a) => getText(a)).filter((t): t is string => !!t);
}

export function pageTypeFromPath(pathname: string): 'search' | 'job_detail' | 'company_jobs' | 'company' | 'page' {
  if (/\/web\/geek\/jobs/.test(pathname)) return 'search';
  if (/\/job_detail\//.test(pathname)) return 'job_detail';
  if (/\/gongsi\/job\//.test(pathname)) return 'company_jobs';
  if (/\/gongsi\//.test(pathname)) return 'company';
  return 'page';
}

export function jobIdFromUrlString(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = JOBID_RE.exec(url);
  return m ? m[1] : null;
}

export function brandIdFromUrlString(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = BRAND_RE.exec(url);
  return m ? m[1] : null;
}
