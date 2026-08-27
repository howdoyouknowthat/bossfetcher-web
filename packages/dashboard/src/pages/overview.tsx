import { useMemo } from 'react';
import type { Overview } from '@bossfetcher/contracts';
import { BarRow, Card, Empty, PageHead, SectionTitle, Stat } from '../components';

function fmtYuan(n: number | null): string {
  if (n === null) return '—';
  return `¥${(n / 1000).toFixed(0)}k`;
}

function topEntries(by: Record<string, number>, n: number): Array<[string, number]> {
  return Object.entries(by)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

export function OverviewPage({ overview }: { overview: Overview }) {
  const { byCity, byDegree, byExperience, bySize, byFinancing } = overview;
  const cityTotal = useMemo(() => Object.values(byCity).reduce((a, b) => a + b, 0), [byCity]);
  const degreeTotal = useMemo(() => Object.values(byDegree).reduce((a, b) => a + b, 0), [byDegree]);
  const expTotal = useMemo(() => Object.values(byExperience).reduce((a, b) => a + b, 0), [byExperience]);
  const sizeTotal = useMemo(() => Object.values(bySize).reduce((a, b) => a + b, 0), [bySize]);
  const finTotal = useMemo(() => Object.values(byFinancing).reduce((a, b) => a + b, 0), [byFinancing]);

  return (
    <div>
      <PageHead title="市场概览" desc="所有统计都在本浏览器本地计算，不会上传。" />
      <div className="bfd-stat-row">
        <Stat label="累计岗位" value={overview.totalJobs} sub={`今日采集 ${overview.capturedToday}`} />
        <Stat label="当前有效岗位" value={overview.activeJobs} />
        <Stat label="公司数" value={overview.totalCompanies} />
        <Stat
          label="薪资中位数"
          value={overview.salaryMedianMin !== null ? `${fmtYuan(overview.salaryMedianMin)}–${fmtYuan(overview.salaryMedianMax)}` : '—'}
          sub="月薪（已解析字段）"
        />
      </div>

      <div className="bfd-grid" style={{ marginTop: 16 }}>
        <div className="bfd-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card>
            <SectionTitle hint="Top 10">地区分布</SectionTitle>
            {cityTotal === 0 ? (
              <Empty>暂无岗位</Empty>
            ) : (
              <div className="bfd-bars">
                {topEntries(byCity, 10).map(([k, v]) => (
                  <BarRow key={k} label={k} count={v} total={cityTotal} />
                ))}
              </div>
            )}
          </Card>
          <Card>
            <SectionTitle>学历分布</SectionTitle>
            {degreeTotal === 0 ? (
              <Empty>暂无数据</Empty>
            ) : (
              <div className="bfd-bars">
                {topEntries(byDegree, 8).map(([k, v]) => (
                  <BarRow key={k} label={k || '未填'} count={v} total={degreeTotal} />
                ))}
              </div>
            )}
          </Card>
        </div>
        <div className="bfd-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card>
            <SectionTitle>经验分布</SectionTitle>
            {expTotal === 0 ? (
              <Empty>暂无数据</Empty>
            ) : (
              <div className="bfd-bars">
                {topEntries(byExperience, 8).map(([k, v]) => (
                  <BarRow key={k} label={k || '未填'} count={v} total={expTotal} />
                ))}
              </div>
            )}
          </Card>
          <Card>
            <SectionTitle>公司规模</SectionTitle>
            {sizeTotal === 0 ? (
              <Empty>暂无公司数据</Empty>
            ) : (
              <div className="bfd-bars">
                {topEntries(bySize, 8).map(([k, v]) => (
                  <BarRow key={k} label={k || '未填'} count={v} total={sizeTotal} />
                ))}
              </div>
            )}
          </Card>
        </div>
        <Card>
          <SectionTitle>融资状态</SectionTitle>
          {finTotal === 0 ? (
            <Empty>暂无公司数据</Empty>
          ) : (
            <div className="bfd-bars">
              {topEntries(byFinancing, 10).map(([k, v]) => (
                <BarRow key={k} label={k || '未填'} count={v} total={finTotal} />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
