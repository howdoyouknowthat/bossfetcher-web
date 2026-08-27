import { createRoot } from 'react-dom/client';
import { createRepository, MigrationError } from '@bossfetcher/repository';
import { DashboardApp } from '@bossfetcher/dashboard';
import { APP_VERSION_FULL } from './metadata';
import { createBossFetcherStore } from './bf-store';

/**
 * Dashboard Bootstrap：仅在 `/app` 启动，检查 schema 后挂载结果界面。
 * 不向页面上下文发送完整岗位数组，不向 BossFetcher 域名发岗位请求。
 */
export async function bootDashboard(): Promise<void> {
  const rootEl = document.getElementById('root');
  if (!rootEl) return;
  // /app 是静态外壳，容器内预置了"未检测到脚本"占位文案；挂载前清空。
  rootEl.replaceChildren();

  const store = createBossFetcherStore();
  const repo = createRepository(store);

  try {
    await repo.init();
  } catch (e) {
    if (e instanceof MigrationError) {
      renderRecovery(rootEl, e.message);
    } else {
      renderRecovery(rootEl, `本地存储初始化失败：${e instanceof Error ? e.message : String(e)}`);
    }
    return;
  }

  const root = createRoot(rootEl);
  root.render(<DashboardApp repo={repo} version={APP_VERSION_FULL} />);
}

function renderRecovery(rootEl: HTMLElement, message: string): void {
  const root = createRoot(rootEl);
  root.render(
    <div style={{ maxWidth: 520, margin: '80px auto', fontFamily: 'system-ui, sans-serif', textAlign: 'center', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 20 }}>本地数据需要手动处理</h1>
      <p style={{ color: '#6b6b66' }}>{message}</p>
      <p style={{ color: '#6b6b66', fontSize: 13 }}>
        请先导出备份再升级脚本。此页面已进入只读恢复模式，不会继续写入任何数据。
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid #d8d8d4', background: '#fff', cursor: 'pointer' }}
      >
        刷新
      </button>
    </div>,
  );
}
