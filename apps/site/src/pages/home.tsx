import { getAnalytics } from '../analytics-init';

export function HomePage() {
  const analytics = getAnalytics();

  return (
    <div>
      <section className="site-hero">
        <h1>把 BOSS 直聘页面，变成你自己的岗位库</h1>
        <p className="lead">
          在已登录的 BOSS 直聘页面上，按你自己的节奏采集岗位、公司和在招信息。
          结果默认只保存在你的浏览器里，不注册、不登录、不上传云端。
        </p>
        <div className="site-cta">
          <a
            className="btn lg"
            href="/install"
            onClick={() => analytics.trackEvent('install_cta_click')}
          >
            开始安装
          </a>
          <a className="btn lg ghost" href="/app" onClick={() => analytics.trackEvent('dashboard_open_click')}>
            查看我的岗位库
          </a>
        </div>
      </section>

      <div className="privacy-box" style={{ maxWidth: 760, margin: '0 auto 48px', textAlign: 'center' }}>
        <strong>数据默认只留在浏览器。</strong>
        岗位、公司、简历和你的 API Key 不发送给“帮你刷 boss”网站。官网只统计匿名访问与安装步骤。
      </div>

      <section className="section">
        <h2>支持什么浏览器</h2>
        <p className="sub">第一版支持桌面端 Chrome 与 Edge（需开启“允许用户脚本”权限）。</p>
        <div className="grid-3">
          <div className="card">
            <div className="feature-icon">🌐</div>
            <h3>Chrome / Edge</h3>
            <p>安装 Tampermonkey，开启 Allow User Scripts，再安装 BossFetcher 脚本。</p>
          </div>
          <div className="card">
            <div className="feature-icon">🛡️</div>
            <h3>本地优先</h3>
            <p>采集结果写入 Tampermonkey 本地存储，重启浏览器后依然存在。</p>
          </div>
          <div className="card">
            <div className="feature-icon">⏱️</div>
            <h3>人速节奏</h3>
            <p>可暂停、可抓本页，支持随机等待、时间窗口与每日上限，始终由你掌握节奏。</p>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>怎么工作</h2>
        <div className="steps">
          <div className="step">
            <div className="num">1</div>
            <h4>安装脚本</h4>
            <p>按安装向导装好 Tampermonkey 与 BossFetcher 用户脚本。</p>
          </div>
          <div className="step">
            <div className="num">2</div>
            <h4>登录并搜索</h4>
            <p>自行登录 BOSS 直聘，搜索关键词进入列表页（BossFetcher 不接触账号凭据）。</p>
          </div>
          <div className="step">
            <div className="num">3</div>
            <h4>点击开始</h4>
            <p>在 BOSS 页面点击“开始”，脚本按人速自动抓取详情、公司与在招页。</p>
          </div>
          <div className="step">
            <div className="num">4</div>
            <h4>本地查看</h4>
            <p>回到“我的岗位库”浏览、筛选、统计、导出备份。一切都在本浏览器。</p>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>数据边界</h2>
        <table className="data">
          <thead>
            <tr>
              <th>内容</th>
              <th>默认保存在</th>
              <th>是否发送给官网</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>岗位、公司、在招信息</td><td>你的浏览器</td><td>否</td></tr>
            <tr><td>简历 / AI 内容 / API Key</td><td>你的浏览器（AI 默认关闭）</td><td>否</td></tr>
            <tr><td>BOSS 账号、密码、Cookie</td><td>不读取</td><td>否</td></tr>
            <tr><td>匿名访问与安装步骤统计</td><td>自建统计服务器</td><td>仅固定事件名</td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
