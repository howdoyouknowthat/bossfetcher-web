import { Fragment, useMemo, useState } from 'react';
import type { JobV1, JobQuery } from '@bossfetcher/contracts';
import type { LocalRepository } from '@bossfetcher/repository';
import { Chip, Empty, PageHead } from '../components';

const PAGE_SIZE = 20;

function salaryLabel(j: JobV1): string {
  return j.salaryText || '—';
}

export function BrowsePage({ repo, tick }: { repo: LocalRepository; tick: number }) {
  const [search, setSearch] = useState('');
  const [kwInclude, setKwInclude] = useState('');
  const [kwExclude, setKwExclude] = useState('');
  const [city, setCity] = useState('');
  const [degree, setDegree] = useState('');
  const [experience, setExperience] = useState('');
  const [sortBy, setSortBy] = useState<JobQuery['sortBy']>('capturedAt');
  const [sortDir, setSortDir] = useState<JobQuery['sortDir']>('desc');
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState('');

  const query: JobQuery = useMemo(
    () => ({
      search,
      keywordInclude: kwInclude,
      keywordExclude: kwExclude,
      city: city || undefined,
      degree: degree || undefined,
      experience: experience || undefined,
      sortBy,
      sortDir,
      offset,
      limit: PAGE_SIZE,
    }),
    [search, kwInclude, kwExclude, city, degree, experience, sortBy, sortDir, offset],
  );

  const page = useMemo(() => repo.listJobs(query), [repo, query, tick]);
  const totalPages = Math.max(1, Math.ceil(page.total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  function toggleSort(next: NonNullable<JobQuery['sortBy']>) {
    if (sortBy === next) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(next);
      setSortDir(next === 'title' ? 'asc' : 'desc');
    }
    setOffset(0);
  }

  async function removeJob(id: string) {
    if (!window.confirm('删除这条岗位记录？此操作只影响本地数据。')) return;
    try {
      await repo.deleteJob(id);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function toggleExpand(id: string) {
    setExpanded((cur) => (cur === id ? null : id));
  }

  return (
    <div>
      <PageHead title="岗位浏览" desc="搜索、筛选、排序本地的岗位样本，全部在本浏览器完成。" />
      <div className="bfd-filter-bar">
        <input className="bfd-input" style={{ maxWidth: 200 }} placeholder="标题搜索" value={search} onChange={(e) => { setSearch(e.target.value); setOffset(0); }} />
        <input className="bfd-input" style={{ maxWidth: 140 }} placeholder="关键词包含" value={kwInclude} onChange={(e) => { setKwInclude(e.target.value); setOffset(0); }} />
        <input className="bfd-input" style={{ maxWidth: 140 }} placeholder="关键词排除" value={kwExclude} onChange={(e) => { setKwExclude(e.target.value); setOffset(0); }} />
        <input className="bfd-input" style={{ maxWidth: 110 }} placeholder="城市" value={city} onChange={(e) => { setCity(e.target.value); setOffset(0); }} />
        <select className="bfd-input" style={{ maxWidth: 110 }} value={degree} onChange={(e) => { setDegree(e.target.value); setOffset(0); }}>
          <option value="">学历</option>
          <option>大专</option>
          <option>本科</option>
          <option>硕士</option>
          <option>博士</option>
          <option>不限</option>
        </select>
        <select className="bfd-input" style={{ maxWidth: 110 }} value={experience} onChange={(e) => { setExperience(e.target.value); setOffset(0); }}>
          <option value="">经验</option>
          <option>在校/应届</option>
          <option>1-3年</option>
          <option>3-5年</option>
          <option>5-10年</option>
          <option>10年以上</option>
        </select>
      </div>

      {error ? <div className="bfd-result bad">{error}</div> : null}

      <div className="bfd-card" style={{ overflow: 'auto' }}>
        {page.total === 0 ? (
          <Empty>
            没有匹配的岗位。先安装脚本后在 BOSS 页面点击“开始”采集，数据只保存在你的浏览器。
          </Empty>
        ) : (
          <table className="bfd-table">
            <thead>
              <tr>
                <th>
                  <button className={`bfd-sort-head${sortBy === 'title' ? ' active' : ''}`} onClick={() => toggleSort('title')}>标题</button>
                </th>
                <th>公司</th>
                <th>城市</th>
                <th>
                  <button className={`bfd-sort-head${sortBy === 'salary' ? ' active' : ''}`} onClick={() => toggleSort('salary')}>薪资</button>
                </th>
                <th>经验</th>
                <th>学历</th>
                <th>
                  <button className={`bfd-sort-head${sortBy === 'capturedAt' ? ' active' : ''}`} onClick={() => toggleSort('capturedAt')}>采集时间</button>
                </th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((j) => (
                <Fragment key={j.jobId}>
                  <tr style={{ cursor: 'pointer' }} onClick={() => toggleExpand(j.jobId)}>
                    <td>
                      {j.title}
                      {j.keyword ? <span className="bfd-muted"> · {j.keyword}</span> : null}
                    </td>
                    <td>{j.companyName || '—'}</td>
                    <td>{j.city || '—'}</td>
                    <td>{salaryLabel(j)}</td>
                    <td>{j.experience || '—'}</td>
                    <td>{j.degree || '—'}</td>
                    <td>{(j.capturedAt || '').slice(0, 10)}</td>
                    <td>
                      {j.url ? (
                        <a href={j.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>来源</a>
                      ) : null}
                      <button
                        className="bfd-btn ghost"
                        style={{ marginLeft: 8, padding: '2px 8px', fontSize: 12 }}
                        onClick={(e) => { e.stopPropagation(); void removeJob(j.jobId); }}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                  {expanded === j.jobId ? (
                    <tr key={`${j.jobId}-jd`}>
                      <td colSpan={8}>
                        <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7 }}>
                          {j.jdText || '无 JD 文本'}
                        </div>
                        {j.address ? <div className="bfd-muted" style={{ marginTop: 8 }}>地址：{j.address}</div> : null}
                        {j.anonymous ? <Chip tone="warn">匿名/代招</Chip> : null}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bfd-pagination">
        <button className="bfd-btn ghost" disabled={currentPage <= 1} onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}>上一页</button>
        <span className="page-info">第 {currentPage} / {totalPages} 页 · 共 {page.total} 条</span>
        <button className="bfd-btn ghost" disabled={currentPage >= totalPages} onClick={() => setOffset((o) => o + PAGE_SIZE)}>下一页</button>
      </div>
    </div>
  );
}
