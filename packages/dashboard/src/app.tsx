import { useEffect, useMemo, useState } from 'react';
import type { LocalRepository } from '@bossfetcher/repository';
import { OverviewPage } from './pages/overview';
import { BrowsePage } from './pages/browse';
import { CapturePage } from './pages/capture';
import { DataPage } from './pages/data';

export type DashboardTab = 'overview' | 'browse' | 'capture' | 'data';

const NAV: Array<{ key: DashboardTab; label: string }> = [
  { key: 'overview', label: '市场概览' },
  { key: 'browse', label: '岗位浏览' },
  { key: 'capture', label: '采集进度' },
  { key: 'data', label: '数据管理' },
];

export interface DashboardAppProps {
  repo: LocalRepository;
  dailyCap?: number;
  version?: string;
}

/**
 * 结果页业务界面。由用户脚本在 BossFetcher `/app` 静态外壳上挂载，
 * 只通过 LocalRepository 读写本地数据；本组件不发起任何网络请求。
 */
export function DashboardApp({ repo, dailyCap, version }: DashboardAppProps) {
  const [tab, setTab] = useState<DashboardTab>('overview');
  const [tick, setTick] = useState(0);

  useEffect(() => repo.subscribe(() => setTick((t) => t + 1)), [repo]);

  const settings = useMemo(() => repo.getSettings(), [repo, tick]);
  const cap = dailyCap ?? settings.captureLimits.dailyAccountCap;
  const overview = useMemo(() => repo.getOverview(), [repo, tick]);
  const captureState = useMemo(() => repo.getCaptureState(), [repo, tick]);

  return (
    <div className="bfd-app">
      <aside className="bfd-sidebar">
        <div className="bfd-brand">
          <div className="bfd-logo">BF</div>
          BossFetcher
        </div>
        {NAV.map((n) => (
          <button
            key={n.key}
            className={`bfd-nav-item${tab === n.key ? ' active' : ''}`}
            onClick={() => setTab(n.key)}
          >
            {n.label}
          </button>
        ))}
        <div className="bfd-side-foot">
          v{version || '0.1.0'} · 数据只保存在本浏览器
        </div>
      </aside>
      <main className="bfd-main">
        {tab === 'overview' ? <OverviewPage overview={overview} />
          : tab === 'browse' ? <BrowsePage repo={repo} tick={tick} />
          : tab === 'capture' ? <CapturePage captureState={captureState} dailyCap={cap} />
          : <DataPage repo={repo} tick={tick} />}
      </main>
    </div>
  );
}
