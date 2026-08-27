import { useMemo, useRef, useState } from 'react';
import type { BackupV1, BackupImportMode } from '@bossfetcher/contracts';
import type { LocalRepository } from '@bossfetcher/repository';
import { Card, PageHead, SectionTitle, Stat } from '../components';

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function fileStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DataPage({ repo, tick }: { repo: LocalRepository; tick: number }) {
  const overview = useMemo(() => repo.getOverview(), [repo, tick]);
  const settings = useMemo(() => repo.getSettings(), [repo, tick]);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [mode, setMode] = useState<BackupImportMode>('merge');
  const [pendingFile, setPendingFile] = useState<BackupV1 | null>(null);
  const [preflight, setPreflight] = useState<{ ok: boolean; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function exportBackup() {
    const backup = repo.exportBackup();
    download(`bossfetcher-backup-${fileStamp()}.json`, JSON.stringify(backup, null, 2), 'application/json');
    setResult({ ok: true, text: `已导出 ${backup.recordCounts.jobs} 条岗位 / ${backup.recordCounts.companies} 家公司（不含 API Key）` });
  }

  function exportCsv() {
    const csv = repo.exportCsv();
    download(`bossfetcher-jobs-${fileStamp()}.csv`, '\ufeff' + csv, 'text/csv;charset=utf-8');
    setResult({ ok: true, text: '已导出 CSV' });
  }

  async function onFileSelected(file: File | undefined) {
    setResult(null);
    setPreflight(null);
    setPendingFile(null);
    if (!file) return;
    try {
      const text = await file.text();
      const backup = JSON.parse(text) as BackupV1;
      const check = repo.preflightBackup(backup);
      setPreflight(check);
      if (check.ok) setPendingFile(backup);
    } catch (e) {
      setPreflight({ ok: false, errors: [`无法解析备份文件：${e instanceof Error ? e.message : String(e)}`] });
    }
  }

  async function doImport() {
    if (!pendingFile) return;
    if (mode === 'replace' && !window.confirm('replace 模式将先清空全部现有数据再导入。确定要继续吗？此操作不可撤销。')) return;
    try {
      const res = repo.importBackup(pendingFile, mode);
      setResult({
        ok: true,
        text: `导入完成：新增岗位 ${res.jobsAdded}，更新 ${res.jobsUpdated}；新增公司 ${res.companiesAdded}，更新 ${res.companiesUpdated}${res.errors.length ? `；错误 ${res.errors.length} 条` : ''}`,
      });
      setPendingFile(null);
      setPreflight(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  }

  async function clearAll() {
    if (!window.confirm('确定要清空全部 BossFetcher 本地数据吗？此操作不可撤销，建议先导出备份。')) return;
    if (!window.confirm('再次确认：将删除本浏览器保存的全部岗位和公司记录。')) return;
    try {
      await repo.clearAll();
      setResult({ ok: true, text: '已清空全部本地数据' });
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  }

  async function removeKey() {
    if (!window.confirm('删除已保存的 API Key 和 AI 设置？')) return;
    try {
      await repo.removeApiKey();
      setResult({ ok: true, text: '已删除 API Key 与 AI 设置' });
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  }

  async function copyDiagnostics() {
    const diag = repo.getDiagnostics();
    const text = JSON.stringify(diag, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setResult({ ok: true, text: '诊断信息已复制（不含岗位/简历/API Key）' });
    } catch {
      setResult({ ok: false, text: '复制失败，请手动复制' });
    }
  }

  return (
    <div>
      <PageHead title="数据管理" desc="数据只保存在本浏览器（Tampermonkey 存储）。导出、恢复与清空都在本地完成。" />
      <div className="bfd-stat-row">
        <Stat label="本地岗位" value={overview.totalJobs} />
        <Stat label="本地公司" value={overview.totalCompanies} />
        <Stat label="存储占用" value={`${((repo.getDiagnostics().storageBytes || 0) / 1024).toFixed(1)} KB`} />
        <Stat label="API Key" value={settings.apiKey ? '已保存' : '未保存'} />
      </div>

      <div className="bfd-grid" style={{ marginTop: 16 }}>
        <Card>
          <SectionTitle>导出</SectionTitle>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="bfd-btn" onClick={exportBackup}>导出完整备份 (JSON)</button>
            <button className="bfd-btn ghost" onClick={exportCsv}>导出 CSV</button>
          </div>
          <p className="bfd-muted" style={{ marginTop: 10, fontSize: 12.5 }}>
            默认备份不包含 API Key。换电脑或清理浏览器前请先导出。
          </p>
        </Card>

        <Card>
          <SectionTitle>导入恢复</SectionTitle>
          <div className="bfd-upload" style={{ cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
            点击选择备份文件（JSON）
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => void onFileSelected(e.target.files?.[0])}
          />
          {preflight ? (
            <div className={`bfd-result ${preflight.ok ? 'ok' : 'bad'}`} style={{ marginTop: 12 }}>
              {preflight.ok ? '预检通过，可以导入。' : `预检失败：${preflight.errors.join('；')}`}
            </div>
          ) : null}
          {pendingFile ? (
            <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <select className="bfd-input" style={{ maxWidth: 200 }} value={mode} onChange={(e) => setMode(e.target.value as BackupImportMode)}>
                <option value="merge">merge：按 ID 合并，不删除现有</option>
                <option value="replace">replace：清空后导入（需二次确认）</option>
              </select>
              <button className="bfd-btn" onClick={() => void doImport()}>导入</button>
            </div>
          ) : null}
        </Card>

        <Card>
          <SectionTitle>隐私与安全</SectionTitle>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="bfd-btn ghost" onClick={() => void copyDiagnostics()}>复制诊断信息</button>
            {settings.apiKey ? (
              <button className="bfd-btn ghost" onClick={() => void removeKey()}>删除 API Key</button>
            ) : null}
          </div>
          <p className="bfd-muted" style={{ marginTop: 10, fontSize: 12.5 }}>
            诊断信息不含岗位正文、简历、API Key 和页面 HTML，可安全粘贴到 BossFetcher GitHub 仓库的 Issue。
          </p>
        </Card>

        <div className="bfd-danger-zone">
          <SectionTitle>危险操作</SectionTitle>
          <p className="bfd-muted" style={{ marginTop: 0 }}>
            清空会删除本浏览器保存的全部岗位与公司记录，不可恢复。
          </p>
          <button className="bfd-btn danger" onClick={() => void clearAll()}>清空全部数据</button>
        </div>

        {result ? <div className={`bfd-result ${result.ok ? 'ok' : 'bad'}`}>{result.text}</div> : null}
      </div>
    </div>
  );
}
