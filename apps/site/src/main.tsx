import { createRoot } from 'react-dom/client';
import { App } from './App';
import { getAnalytics } from './analytics-init';
import './site.css';

// 公开官网页面：初始化统计（含退出 / DNT / 路径 allowlist 判断）
getAnalytics();

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
