import type { ReactNode } from 'react';
import { HomePage } from './pages/home';
import { InstallPage } from './pages/install';
import { HelpPage } from './pages/help';
import { PrivacyPage } from './pages/privacy';

export type Route = 'home' | 'install' | 'help' | 'privacy';

function routeFromPath(pathname: string): Route {
  if (pathname.startsWith('/install')) return 'install';
  if (pathname.startsWith('/help')) return 'help';
  if (pathname.startsWith('/privacy')) return 'privacy';
  return 'home';
}

function Link({ to, children, className, onClick }: { to: string; children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <a href={to} className={className} onClick={onClick}>
      {children}
    </a>
  );
}

export function App({ pathname }: { pathname?: string }) {
  const route = routeFromPath(pathname ?? location.pathname);

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <a className="site-brand" href="/">
            <span className="site-logo">BF</span>
            帮你刷 boss
          </a>
          <nav className="site-nav">
            <Link to="/install" className={route === 'install' ? 'active' : ''}>安装</Link>
            <Link to="/help" className={route === 'help' ? 'active' : ''}>帮助</Link>
            <Link to="/privacy" className={route === 'privacy' ? 'active' : ''}>隐私</Link>
            <Link to="/app">我的岗位库</Link>
          </nav>
        </div>
      </header>
      <main className="site-main">
        {route === 'home' ? <HomePage /> : route === 'install' ? <InstallPage /> : route === 'help' ? <HelpPage /> : <PrivacyPage />}
      </main>
      <footer className="site-footer">
        <div className="site-footer-inner">
          <span>帮你刷 boss · BossFetcher</span>
          <span>岗位与简历数据只保存在你的浏览器</span>
        </div>
      </footer>
    </>
  );
}
