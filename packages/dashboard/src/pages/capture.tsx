import type { CaptureStateV1 } from '@bossfetcher/contracts';
import { Card, PageHead, SectionTitle } from '../components';

const STATUS_TEXT: Record<string, string> = {
  idle: '空闲',
  running: '运行中',
  paused: '已暂停',
  completed: '已完成',
  error: '出错',
};

function statusTone(status: string): string {
  if (status === 'running') return 'running';
  if (status === 'error') return 'error';
  if (status === 'completed') return 'completed';
  return '';
}

export function CapturePage({ captureState, dailyCap }: { captureState: CaptureStateV1; dailyCap: number }) {
  const st = captureState;
  const total = st.queueTotal || 0;
  const done = total - st.queue.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div>
      <PageHead title="采集进度" desc="采集由你在 BOSS 页面主动开始；本页只读取本地状态。" />
      <div className="bfd-grid">
        <Card>
          <SectionTitle hint="来自本地采集状态">运行状态</SectionTitle>
          <div style={{ fontSize: 15, fontWeight: 600 }}>
            <span className={`bfd-status-dot ${statusTone(st.status)}`} />
            {STATUS_TEXT[st.status] || st.status}
          </div>
          <p className="bfd-muted" style={{ margin: '8px 0 0' }}>{st.lastMessage || '就绪'}</p>
          <div style={{ marginTop: 16 }}>
            <div className="bfd-bar-row">
              <div className="lbl">队列</div>
              <div className="track">
                <div className="fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="n">{done}/{total}</div>
            </div>
          </div>
        </Card>

        <div className="bfd-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card>
            <SectionTitle>当前关键词</SectionTitle>
            <div style={{ fontSize: 18, fontWeight: 650 }}>{st.currentKeyword || '—'}</div>
          </Card>
          <Card>
            <SectionTitle>今日采集</SectionTitle>
            <div style={{ fontSize: 18, fontWeight: 650 }}>
              {st.dailyCount} / {dailyCap}
            </div>
            <div className="bfd-muted" style={{ fontSize: 12 }}>超过上限会自动暂停</div>
          </Card>
        </div>

        <Card>
          <SectionTitle>当前岗位</SectionTitle>
          <div>
            {st.currentJob ? (
              <span>
                {st.currentJob.jobId}
                {st.currentJob.url ? (
                  <>
                    {' '}
                    <a href={st.currentJob.url} target="_blank" rel="noreferrer">打开</a>
                  </>
                ) : null}
              </span>
            ) : (
              <span className="bfd-muted">无</span>
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle hint="下一步">操作</SectionTitle>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a className="bfd-btn" href="https://www.zhipin.com/web/geek/jobs" target="_blank" rel="noreferrer">
              打开 BOSS 搜索页
            </a>
            <span className="bfd-muted" style={{ alignSelf: 'center' }}>
              在 BOSS 页面点击右下角“开始”采集；本页会自动跟随进度。
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
