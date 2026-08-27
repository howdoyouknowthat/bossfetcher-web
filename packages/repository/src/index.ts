import type {
  BackupImportMode,
  BackupV1,
  CaptureStateV1,
  CompanyV1,
  DiagnosticInfo,
  ImportResult,
  JobPage,
  JobQuery,
  JobV1,
  Overview,
  SettingsV1,
} from '@bossfetcher/contracts';
import { APP_VERSION, SCHEMA_VERSION } from '@bossfetcher/contracts';
import type { KeyValueStore } from './store';

export class StorageError extends Error {
  constructor(message: string, public kind: 'write' | 'read' | 'migration' | 'capacity' | 'invalid-backup') {
    super(message);
    this.name = 'StorageError';
  }
}

export class MigrationError extends StorageError {
  constructor(message: string) {
    super(message, 'migration');
    this.name = 'MigrationError';
  }
}

/** 仅供诊断判断：Tampermonkey 环境注入的全局函数。 */
declare const GM_getValue: unknown;

const KEYS = {
  schema: 'bf:schema-version',
  job: (id: string) => `bf:job:${id}`,
  company: (id: string) => `bf:company:${id}`,
  indexJobs: 'bf:index:jobs',
  indexCompanies: 'bf:index:companies',
  captureState: 'bf:capture-state',
  settings: 'bf:settings',
  revision: 'bf:revision',
};

export const CURRENT_SCHEMA = SCHEMA_VERSION;

function defaultCaptureState(now = new Date().toISOString()): CaptureStateV1 {
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
    today: todayKey(),
    dailyCount: 0,
    lastMessage: '就绪',
    sessionId: '',
    queueTotal: 0,
    dashboardOpenedSessionId: '',
    updatedAt: now,
  };
}

function todayKey(now = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

export function defaultSettings(): SettingsV1 {
  return {
    schemaVersion: 1,
    locale: 'zh-CN',
    theme: 'system',
    captureLimits: {
      perKeywordLimit: 500,
      maxPages: 10,
      dailyAccountCap: 120,
      delayMinSeconds: 8,
      delayMaxSeconds: 20,
      listDelayMinSeconds: 6,
      listDelayMaxSeconds: 14,
      activeStartHour: 9,
      activeEndHour: 21,
    },
    activeHoursEnabled: true,
    defaultFilters: {
      keywordInclude: '',
      keywordExclude: '',
      city: '',
      degree: '',
      experience: '',
      sortBy: 'capturedAt',
      sortDir: 'desc',
    },
    aiEnabled: false,
    aiProvider: null,
    aiBaseUrl: null,
    aiModel: null,
    apiKey: null,
    consentVersion: 0,
    consentTimestamp: null,
  };
}

function checksum(obj: unknown): string {
  const json = JSON.stringify(obj);
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return `fnv1a-${h.toString(16).padStart(8, '0')}`;
}

function parse<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

/** 新值为空时保留旧值；新值明确且有效时覆盖旧值。 */
function mergeJob(existing: JobV1, incoming: JobV1): JobV1 {
  const merged: JobV1 = { ...existing, ...incoming };
  for (const key of Object.keys(incoming) as Array<keyof JobV1>) {
    if (key === 'firstSeen' || key === 'lastSeen' || key === 'schemaVersion') continue;
    if (isEmpty(incoming[key])) {
      (merged as unknown as Record<string, unknown>)[key] = existing[key];
    }
  }
  merged.schemaVersion = 1;
  merged.firstSeen = existing.firstSeen || incoming.firstSeen || new Date().toISOString();
  merged.lastSeen = incoming.capturedAt || new Date().toISOString();
  merged.active = true;
  return merged;
}

function mergeCompany(existing: CompanyV1, incoming: CompanyV1): CompanyV1 {
  const merged: CompanyV1 = { ...existing };
  for (const key of Object.keys(incoming) as Array<keyof CompanyV1>) {
    if (key === 'firstSeen' || key === 'lastSeen' || key === 'schemaVersion' || key === 'openJobs') continue;
    if (!isEmpty(incoming[key])) {
      (merged as unknown as Record<string, unknown>)[key] = incoming[key];
    }
  }
  merged.schemaVersion = 1;
  merged.firstSeen = existing.firstSeen || incoming.firstSeen || new Date().toISOString();
  merged.lastSeen = new Date().toISOString();
  return merged;
}

function jobSortValue(job: JobV1, by: JobQuery['sortBy']): number | string {
  switch (by) {
    case 'salary':
      return job.salaryMin ?? -1;
    case 'title':
      return job.title;
    default:
      return job.capturedAt;
  }
}

export interface LocalRepository {
  init(): Promise<number>;
  getSchemaVersion(): number;

  upsertJob(job: JobV1): Promise<void>;
  upsertCompany(company: CompanyV1): Promise<void>;
  replaceCompanyOpenJobs(companyId: string, titles: string[], capturedAt: string): Promise<void>;
  getJob(jobId: string): JobV1 | undefined;
  getCompany(companyId: string): CompanyV1 | undefined;
  listJobs(query?: JobQuery): JobPage;
  listCompanies(): CompanyV1[];
  deleteJob(jobId: string): Promise<void>;
  getOverview(): Overview;

  getCaptureState(): CaptureStateV1;
  saveCaptureState(state: CaptureStateV1): Promise<void>;

  getSettings(): SettingsV1;
  saveSettings(settings: SettingsV1): Promise<void>;
  removeApiKey(): Promise<SettingsV1>;

  exportBackup(): BackupV1;
  preflightBackup(backup: BackupV1): { ok: boolean; errors: string[] };
  importBackup(backup: BackupV1, mode: BackupImportMode): ImportResult;
  exportCsv(): string;
  clearAll(): Promise<void>;
  getDiagnostics(): DiagnosticInfo;
  subscribe(listener: () => void): () => void;
}

function assertBackupShape(backup: unknown): asserts backup is BackupV1 {
  if (!backup || typeof backup !== 'object') {
    throw new StorageError('备份不是有效对象', 'invalid-backup');
  }
  const b = backup as BackupV1;
  if (b.backupFormatVersion !== 1) {
    throw new StorageError(`不支持的备份格式版本：${String(b.backupFormatVersion)}`, 'invalid-backup');
  }
  if (!Array.isArray(b.jobs) || !Array.isArray(b.companies)) {
    throw new StorageError('备份缺少 jobs/companies 数组', 'invalid-backup');
  }
}

export class LocalRepositoryImpl implements LocalRepository {
  private schemaVersion = CURRENT_SCHEMA;
  private revision = 0;

  constructor(private store: KeyValueStore) {}

  async init(): Promise<number> {
    const raw = this.store.get(KEYS.schema);
    if (raw === undefined) {
      this.store.set(KEYS.schema, String(CURRENT_SCHEMA));
      this.bumpRevision();
      this.schemaVersion = CURRENT_SCHEMA;
      return CURRENT_SCHEMA;
    }
    const existing = parseInt(raw, 10);
    if (existing > CURRENT_SCHEMA) {
      throw new MigrationError(
        `本地 schema ${existing} 高于当前支持的 ${CURRENT_SCHEMA}，请升级 BossFetcher 脚本后再使用`,
      );
    }
    if (existing < CURRENT_SCHEMA) {
      this.runMigrations(existing);
      this.store.set(KEYS.schema, String(CURRENT_SCHEMA));
      this.bumpRevision();
    }
    this.schemaVersion = CURRENT_SCHEMA;
    return CURRENT_SCHEMA;
  }

  getSchemaVersion(): number {
    return this.schemaVersion;
  }

  private runMigrations(from: number): void {
    // v0 -> v1: 新存储布局，无历史数据可迁移。未来版本在此追加步骤。
    void from;
  }

  private bumpRevision(): void {
    this.revision += 1;
    this.store.set(KEYS.revision, String(this.revision));
  }

  private readIndexJobs(): string[] {
    return parse<string[]>(this.store.get(KEYS.indexJobs), []);
  }

  private writeIndexJobs(ids: string[]): void {
    this.store.set(KEYS.indexJobs, JSON.stringify(ids));
  }

  private readIndexCompanies(): string[] {
    return parse<string[]>(this.store.get(KEYS.indexCompanies), []);
  }

  private writeIndexCompanies(ids: string[]): void {
    this.store.set(KEYS.indexCompanies, JSON.stringify(ids));
  }

  async upsertJob(job: JobV1): Promise<void> {
    try {
      const existing = this.getJob(job.jobId);
      const merged = existing ? mergeJob(existing, job) : job;
      if (!existing) {
        const ids = this.readIndexJobs();
        if (!ids.includes(merged.jobId)) ids.push(merged.jobId);
        this.writeIndexJobs(ids);
      }
      this.store.set(KEYS.job(merged.jobId), JSON.stringify(merged));
      this.bumpRevision();
    } catch (e) {
      throw this.wrapWrite(e, '岗位写入失败');
    }
  }

  async upsertCompany(company: CompanyV1): Promise<void> {
    try {
      const existing = this.getCompany(company.companyId);
      const merged = existing ? mergeCompany(existing, company) : company;
      if (!existing) {
        const ids = this.readIndexCompanies();
        if (!ids.includes(merged.companyId)) ids.push(merged.companyId);
        this.writeIndexCompanies(ids);
      }
      this.store.set(KEYS.company(merged.companyId), JSON.stringify(merged));
      this.bumpRevision();
    } catch (e) {
      throw this.wrapWrite(e, '公司写入失败');
    }
  }

  async replaceCompanyOpenJobs(companyId: string, titles: string[], capturedAt: string): Promise<void> {
    try {
      const existing = this.getCompany(companyId);
      const merged: CompanyV1 = existing
        ? { ...existing, openJobs: titles, openJobsCapturedAt: capturedAt, lastSeen: new Date().toISOString() }
        : {
            schemaVersion: 1,
            companyId,
            name: companyId,
            financing: null,
            size: null,
            industry: null,
            registeredCapital: null,
            foundedDate: null,
            legalRep: null,
            intro: null,
            openJobs: titles,
            openJobsCapturedAt: capturedAt,
            firstSeen: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
          };
      if (!existing) {
        const ids = this.readIndexCompanies();
        if (!ids.includes(companyId)) ids.push(companyId);
        this.writeIndexCompanies(ids);
      }
      this.store.set(KEYS.company(companyId), JSON.stringify(merged));
      this.bumpRevision();
    } catch (e) {
      throw this.wrapWrite(e, '公司在招写入失败');
    }
  }

  getJob(jobId: string): JobV1 | undefined {
    const raw = this.store.get(KEYS.job(jobId));
    return raw ? parse<JobV1>(raw, undefined as unknown as JobV1) : undefined;
  }

  getCompany(companyId: string): CompanyV1 | undefined {
    const raw = this.store.get(KEYS.company(companyId));
    return raw ? parse<CompanyV1>(raw, undefined as unknown as CompanyV1) : undefined;
  }

  private loadAllJobs(): JobV1[] {
    const ids = this.readIndexJobs();
    const raw = this.store.getMany(ids.map(KEYS.job));
    const jobs: JobV1[] = [];
    for (const id of ids) {
      const r = raw[KEYS.job(id)];
      if (r) {
        const j = parse<JobV1>(r, undefined as unknown as JobV1);
        if (j && j.jobId) jobs.push(j);
      }
    }
    return jobs;
  }

  listJobs(query: JobQuery = {}): JobPage {
    let jobs = this.loadAllJobs();
    const {
      search,
      keywordInclude,
      keywordExclude,
      city,
      district,
      degree,
      experience,
      sortBy = 'capturedAt',
      sortDir = 'desc',
      offset = 0,
      limit = 50,
    } = query;

    if (search) {
      const q = search.trim().toLowerCase();
      jobs = jobs.filter((j) => (j.title || '').toLowerCase().includes(q));
    }
    if (keywordInclude) {
      const kw = keywordInclude.trim();
      jobs = jobs.filter((j) => (j.keyword || '').includes(kw));
    }
    if (keywordExclude) {
      const kw = keywordExclude.trim();
      jobs = jobs.filter((j) => !(j.keyword || '').includes(kw));
    }
    if (city) jobs = jobs.filter((j) => j.city === city);
    if (district) jobs = jobs.filter((j) => j.district === district);
    if (degree) jobs = jobs.filter((j) => j.degree === degree);
    if (experience) jobs = jobs.filter((j) => j.experience === experience);

    jobs.sort((a, b) => {
      const va = jobSortValue(a, sortBy);
      const vb = jobSortValue(b, sortBy);
      let cmp: number;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb), 'zh-CN');
      return sortDir === 'desc' ? -cmp : cmp;
    });

    const total = jobs.length;
    const items = jobs.slice(offset, offset + limit);
    return { items, total, offset, limit };
  }

  listCompanies(): CompanyV1[] {
    const ids = this.readIndexCompanies();
    const raw = this.store.getMany(ids.map(KEYS.company));
    const companies: CompanyV1[] = [];
    for (const id of ids) {
      const r = raw[KEYS.company(id)];
      if (r) {
        const c = parse<CompanyV1>(r, undefined as unknown as CompanyV1);
        if (c && c.companyId) companies.push(c);
      }
    }
    return companies;
  }

  async deleteJob(jobId: string): Promise<void> {
    try {
      this.store.delete(KEYS.job(jobId));
      const ids = this.readIndexJobs().filter((id) => id !== jobId);
      this.writeIndexJobs(ids);
      this.bumpRevision();
    } catch (e) {
      throw this.wrapWrite(e, '删除岗位失败');
    }
  }

  getOverview(): Overview {
    const jobs = this.loadAllJobs();
    const companies = this.listCompanies();

    const count = (arr: Array<string | undefined | null> | undefined): Record<string, number> => {
      const out: Record<string, number> = {};
      for (const v of arr || []) {
        if (!v) continue;
        out[v] = (out[v] || 0) + 1;
      }
      return out;
    };

    const salaryMins = jobs.filter((j) => j.salaryMin !== null && j.salaryMin !== undefined).map((j) => j.salaryMin!);
    const salaryMaxs = jobs.filter((j) => j.salaryMax !== null && j.salaryMax !== undefined).map((j) => j.salaryMax!);
    const median = (arr: number[]): number | null => {
      if (arr.length === 0) return null;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    };

    const today = todayKey();
    const capturedToday = jobs.filter((j) => (j.capturedAt || '').slice(0, 10) === today).length;

    return {
      totalJobs: jobs.length,
      activeJobs: jobs.filter((j) => j.active !== false).length,
      totalCompanies: companies.length,
      byCity: count(jobs.map((j) => j.city ?? undefined)),
      salaryMedianMin: median(salaryMins),
      salaryMedianMax: median(salaryMaxs),
      salaryTexts: jobs.slice(0, 20).map((j) => j.salaryText || '').filter(Boolean),
      byDegree: count(jobs.map((j) => j.degree ?? undefined)),
      byExperience: count(jobs.map((j) => j.experience ?? undefined)),
      bySize: count(companies.map((c) => c.size ?? undefined)),
      byFinancing: count(companies.map((c) => c.financing ?? undefined)),
      capturedToday,
    };
  }

  getCaptureState(): CaptureStateV1 {
    const raw = this.store.get(KEYS.captureState);
    if (!raw) return defaultCaptureState();
    const st = parse<CaptureStateV1>(raw, defaultCaptureState());
    return { ...defaultCaptureState(), ...st };
  }

  async saveCaptureState(state: CaptureStateV1): Promise<void> {
    try {
      const merged: CaptureStateV1 = { ...state, updatedAt: new Date().toISOString() };
      this.store.set(KEYS.captureState, JSON.stringify(merged));
      this.bumpRevision();
    } catch (e) {
      throw this.wrapWrite(e, '采集状态保存失败');
    }
  }

  getSettings(): SettingsV1 {
    const raw = this.store.get(KEYS.settings);
    return raw ? { ...defaultSettings(), ...parse<Partial<SettingsV1>>(raw, {}) } : defaultSettings();
  }

  async saveSettings(settings: SettingsV1): Promise<void> {
    try {
      this.store.set(KEYS.settings, JSON.stringify({ ...settings, schemaVersion: 1 }));
      this.bumpRevision();
    } catch (e) {
      throw this.wrapWrite(e, '设置保存失败');
    }
  }

  async removeApiKey(): Promise<SettingsV1> {
    const s = this.getSettings();
    s.apiKey = null;
    s.aiProvider = null;
    s.aiBaseUrl = null;
    s.aiModel = null;
    s.aiEnabled = false;
    await this.saveSettings(s);
    return s;
  }

  exportBackup(): BackupV1 {
    const jobs = this.loadAllJobs();
    const companies = this.listCompanies();
    const settings = this.getSettings();
    const nonSecretSettings: SettingsV1 = {
      ...settings,
      apiKey: null,
      aiEnabled: false,
    };
    const backup: BackupV1 = {
      backupFormatVersion: 1,
      exportedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      jobs,
      companies,
      captureState: this.getCaptureState(),
      settings: nonSecretSettings,
      recordCounts: { jobs: jobs.length, companies: companies.length },
      checksum: '',
    };
    backup.checksum = checksum({ jobs, companies });
    return backup;
  }

  preflightBackup(backup: BackupV1): { ok: boolean; errors: string[] } {
    try {
      assertBackupShape(backup);
    } catch (e) {
      return { ok: false, errors: [(e as Error).message] };
    }
    const errors: string[] = [];
    for (const job of backup.jobs) {
      if (!job || typeof job.jobId !== 'string' || !job.jobId) {
        errors.push('存在缺少 jobId 的岗位记录');
        break;
      }
    }
    for (const company of backup.companies) {
      if (!company || typeof company.companyId !== 'string' || !company.companyId) {
        errors.push('存在缺少 companyId 的公司记录');
        break;
      }
    }
    if (backup.checksum && backup.checksum !== checksum({ jobs: backup.jobs, companies: backup.companies })) {
      errors.push('校验和不匹配，备份可能损坏');
    }
    return { ok: errors.length === 0, errors };
  }

  importBackup(backup: BackupV1, mode: BackupImportMode): ImportResult {
    const preflight = this.preflightBackup(backup);
    if (!preflight.ok) {
      throw new StorageError(`导入前预检失败：${preflight.errors.join('；')}`, 'invalid-backup');
    }
    const result: ImportResult = { jobsAdded: 0, jobsUpdated: 0, companiesAdded: 0, companiesUpdated: 0, errors: [] };

    if (mode === 'replace') {
      this.clearAllSync();
    }

    for (const company of backup.companies) {
      const existing = this.getCompany(company.companyId);
      try {
        const merged = existing ? mergeCompany(existing, company) : company;
        if (!existing) {
          const ids = this.readIndexCompanies();
          if (!ids.includes(merged.companyId)) ids.push(merged.companyId);
          this.writeIndexCompanies(ids);
          result.companiesAdded += 1;
        } else {
          result.companiesUpdated += 1;
        }
        this.store.set(KEYS.company(merged.companyId), JSON.stringify(merged));
      } catch (e) {
        result.errors.push({ message: `公司导入失败：${(e as Error).message}` });
      }
    }

    for (const job of backup.jobs) {
      if (!job || typeof job.jobId !== 'string' || !job.jobId) {
        result.errors.push({ message: '跳过缺少 jobId 的岗位' });
        continue;
      }
      const existing = this.getJob(job.jobId);
      try {
        const merged = existing ? mergeJob(existing, job) : job;
        if (!existing) {
          const ids = this.readIndexJobs();
          if (!ids.includes(merged.jobId)) ids.push(merged.jobId);
          this.writeIndexJobs(ids);
          result.jobsAdded += 1;
        } else {
          result.jobsUpdated += 1;
        }
        this.store.set(KEYS.job(merged.jobId), JSON.stringify(merged));
      } catch (e) {
        result.errors.push({ jobId: job.jobId, message: `岗位导入失败：${(e as Error).message}` });
      }
    }

    if (mode === 'replace' && backup.settings) {
      const s = this.getSettings();
      this.store.set(KEYS.settings, JSON.stringify({ ...s, ...backup.settings, schemaVersion: 1 }));
    }
    this.bumpRevision();
    return result;
  }

  exportCsv(): string {
    const jobs = this.loadAllJobs();
    const header = [
      'jobId', 'title', 'companyName', 'keyword', 'city', 'district', 'address',
      'salaryText', 'salaryMin', 'salaryMax', 'salaryMonths', 'experience', 'degree',
      'jdText', 'url', 'capturedAt',
    ];
    const esc = (v: unknown): string => {
      const s = v === null || v === undefined ? '' : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const rows = [header.join(',')];
    for (const j of jobs) {
      rows.push(
        [
          esc(j.jobId), esc(j.title), esc(j.companyName), esc(j.keyword), esc(j.city), esc(j.district),
          esc(j.address), esc(j.salaryText), esc(j.salaryMin), esc(j.salaryMax), esc(j.salaryMonths),
          esc(j.experience), esc(j.degree), esc(j.jdText), esc(j.url), esc(j.capturedAt),
        ].join(','),
      );
    }
    return rows.join('\n');
  }

  clearAll(): Promise<void> {
    this.clearAllSync();
    return Promise.resolve();
  }

  private clearAllSync(): void {
    for (const key of this.store.listKeys()) {
      if (key.startsWith('bf:')) this.store.delete(key);
    }
    this.store.set(KEYS.schema, String(CURRENT_SCHEMA));
    this.revision = 0;
    this.store.set(KEYS.revision, '0');
  }

  getDiagnostics(): DiagnosticInfo {
    const jobs = this.readIndexJobs().length;
    const companies = this.readIndexCompanies().length;
    return {
      appVersion: APP_VERSION,
      schemaVersion: this.schemaVersion,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      platform: typeof navigator !== 'undefined' ? navigator.platform : '',
      language: typeof navigator !== 'undefined' ? navigator.language : '',
      recordCounts: { jobs, companies },
      storageBytes: this.store.usedBytes ? this.store.usedBytes() : 0,
      tampermonkeyAvailable: typeof GM_getValue !== 'undefined',
      errors: [],
    };
  }

  subscribe(listener: () => void): () => void {
    let pending = false;
    const unsub = this.store.onChange((key) => {
      if (key !== KEYS.revision) return;
      if (pending) return;
      pending = true;
      queueMicrotask(() => {
        pending = false;
        listener();
      });
    });
    return unsub;
  }

  private wrapWrite(e: unknown, prefix: string): StorageError {
    if (e instanceof StorageError) return e;
    const msg = e instanceof Error ? e.message : String(e);
    const capacityHint = /quota|exceeded|5 GB|maximum/i.test(msg);
    return new StorageError(
      `${prefix}：${msg}${capacityHint ? '（本地存储可能已接近上限，请先导出备份）' : ''}`,
      capacityHint ? 'capacity' : 'write',
    );
  }
}

export function createRepository(store: KeyValueStore): LocalRepository {
  return new LocalRepositoryImpl(store);
}

export {
  MemoryKeyValueStore,
  GMKeyValueStore,
  createMemoryStore,
  createGMStore,
} from './store';
export type { KeyValueStore, GMApi } from './store';
