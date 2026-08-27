export const SCHEMA_VERSION = 1 as const;

/** 单一版本真源，发布脚本核对脚本元数据与构建产物保持一致。 */
export const APP_VERSION = '0.1.0' as const;

export interface JobV1 {
  schemaVersion: 1;
  jobId: string;
  title: string;
  companyId: string | null;
  companyName: string | null;
  keyword: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  salaryText: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryMonths: number | null;
  experience: string | null;
  degree: string | null;
  workTime: string | null;
  weekend: string | null;
  jdText: string | null;
  url: string | null;
  anonymous: boolean;
  agency: string | null;
  active: boolean;
  capturedAt: string;
  firstSeen: string;
  lastSeen: string;
}

export interface CompanyV1 {
  schemaVersion: 1;
  companyId: string;
  name: string;
  financing: string | null;
  size: string | null;
  industry: string | null;
  registeredCapital: string | null;
  foundedDate: string | null;
  legalRep: string | null;
  intro: string | null;
  openJobs: string[];
  openJobsCapturedAt: string | null;
  firstSeen: string;
  lastSeen: string;
}

export type CaptureStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';

export interface QueueItem {
  jobId: string;
  url: string;
  keyword: string;
}

export interface PendingCompany {
  brandId: string;
  step: 'company' | 'company_jobs';
}

export interface CaptureStateV1 {
  schemaVersion: 1;
  status: CaptureStatus;
  queue: QueueItem[];
  seenJobs: Record<string, number>;
  doneJobs: Record<string, number>;
  keywordCounts: Record<string, number>;
  companiesToday: Record<string, number>;
  currentKeyword: string;
  currentJob: QueueItem | null;
  pendingCompany: PendingCompany | null;
  today: string;
  dailyCount: number;
  lastMessage: string;
  sessionId: string;
  queueTotal: number;
  dashboardOpenedSessionId: string;
  updatedAt: string;
}

export interface CaptureLimits {
  perKeywordLimit: number;
  maxPages: number;
  dailyAccountCap: number;
  delayMinSeconds: number;
  delayMaxSeconds: number;
  listDelayMinSeconds: number;
  listDelayMaxSeconds: number;
  activeStartHour: number;
  activeEndHour: number;
}

export interface SettingsV1 {
  schemaVersion: 1;
  locale: string;
  theme: 'light' | 'dark' | 'system';
  captureLimits: CaptureLimits;
  activeHoursEnabled: boolean;
  defaultFilters: {
    keywordInclude: string;
    keywordExclude: string;
    city: string;
    degree: string;
    experience: string;
    sortBy: 'salary' | 'capturedAt' | 'title';
    sortDir: 'asc' | 'desc';
  };
  aiEnabled: boolean;
  aiProvider: string | null;
  aiBaseUrl: string | null;
  aiModel: string | null;
  apiKey: string | null;
  consentVersion: number;
  consentTimestamp: string | null;
}

export type BackupImportMode = 'merge' | 'replace';

export interface BackupV1 {
  backupFormatVersion: 1;
  exportedAt: string;
  appVersion: string;
  jobs: JobV1[];
  companies: CompanyV1[];
  captureState: CaptureStateV1 | null;
  settings: SettingsV1 | null;
  recordCounts: {
    jobs: number;
    companies: number;
  };
  checksum: string;
}

export interface Overview {
  totalJobs: number;
  activeJobs: number;
  totalCompanies: number;
  byCity: Record<string, number>;
  salaryMedianMin: number | null;
  salaryMedianMax: number | null;
  salaryTexts: string[];
  byDegree: Record<string, number>;
  byExperience: Record<string, number>;
  bySize: Record<string, number>;
  byFinancing: Record<string, number>;
  capturedToday: number;
}

export interface JobQuery {
  search?: string;
  keywordInclude?: string;
  keywordExclude?: string;
  city?: string;
  district?: string;
  degree?: string;
  experience?: string;
  sortBy?: 'salary' | 'capturedAt' | 'title';
  sortDir?: 'asc' | 'desc';
  offset?: number;
  limit?: number;
}

export interface JobPage {
  items: JobV1[];
  total: number;
  offset: number;
  limit: number;
}

export interface ImportResult {
  jobsAdded: number;
  jobsUpdated: number;
  companiesAdded: number;
  companiesUpdated: number;
  errors: Array<{ jobId?: string; message: string }>;
}

export interface DiagnosticInfo {
  appVersion: string;
  schemaVersion: number;
  userAgent: string;
  platform: string;
  language: string;
  recordCounts: { jobs: number; companies: number };
  storageBytes: number;
  tampermonkeyAvailable: boolean;
  errors: string[];
}
