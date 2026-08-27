import { useState } from 'react';
import { ANALYTICS_OPT_OUT_KEY } from '@bossfetcher/analytics';
import { getAnalytics } from '../analytics-init';

export function PrivacyPage() {
  const analytics = getAnalytics();
  const [optedOut, setOptedOut] = useState(() => {
    try {
      return localStorage.getItem(ANALYTICS_OPT_OUT_KEY) === '1';
    } catch {
      return true;
    }
  });

  function toggle() {
    if (optedOut) {
      analytics.enableAnalytics();
      setOptedOut(false);
      window.location.reload();
    } else {
      analytics.disableForBrowser();
      setOptedOut(true);
    }
  }

  return (
    <div>
      <h1>隐私与数据</h1>
      <p className="sub">最后更新：2026-08-21 · 产品公开名称“帮你刷 boss”，代码/产品名称 BossFetcher。</p>

      <section className="section" style={{ marginTop: 0 }}>
        <h2>本地数据边界</h2>
        <p>
          岗位信息、公司信息、简历正文、BOSS 账号、Cookie、浏览器扩展存储、AI 输入、AI 输出和 AI 服务商 API Key
          <strong> 不会发送给“帮你刷 boss”网站</strong>。BossFetcher 的采集数据默认只保存在你的浏览器
          （Tampermonkey 本地存储），可以在“数据管理”导出备份或清空。
        </p>
        <p>
          AI 功能默认关闭；只有你主动选择服务商、填写自己的 API Key 并确认外发内容后，数据才会直接发送给你选择的服务商，
          不经过 BossFetcher 服务器。
        </p>
      </section>

      <section className="section">
        <h2>网站统计说明</h2>
        <p>
          为了解“帮你刷 boss”官网和安装向导是否正常使用，本网站使用部署在腾讯云中国大陆服务器上的自建网站统计服务
          （自托管 Umami + PostgreSQL）。统计记录公开页面的规范化路径、固定的安装事件名称和事件发生时间；
          Umami 还可能根据请求推导粗粒度的来源类型、浏览器类别、操作系统类别、设备类别和国家，用来统计首页访问量、
          安装步骤完成情况和故障情况。
        </p>
        <p>
          统计服务不使用统计 Cookie，不建立 BossFetcher 用户账号，不使用邮箱、手机号或永久设备标识来识别用户。
          统计服务器可能接收网络请求所必需的网络信息；项目不调用用户识别功能，也不发送自定义事件属性。
          网站服务器的安全和访问日志可能由托管服务记录，具体以实际启用的日志配置为准。
        </p>
        <p>
          “我的岗位库”（/app）、BOSS 采集页面和 Tampermonkey 用户脚本<strong>不加载统计脚本、不发送统计事件</strong>。
        </p>

        <div className="opt-out-row">
          <div>
            <strong>{optedOut ? '你已退出网站统计' : '网站统计已开启'}</strong>
            <div className="sub" style={{ fontSize: 12.5 }}>
              关闭后本网站不再加载统计脚本、不再发送统计事件。不影响采集、查看或备份。此选择只保存在本浏览器。
            </div>
          </div>
          <button className="btn ghost" onClick={toggle}>
            {optedOut ? '恢复网站统计' : '关闭网站统计'}
          </button>
        </div>

        <p>
          你的浏览器发送的 <code>Do Not Track</code>（DNT）信号为开启时，本网站也不会加载统计脚本。
        </p>
      </section>

      <section className="section">
        <h2>保存期限</h2>
        <table className="data">
          <thead>
            <tr><th>数据</th><th>保留期</th><th>处理方式</th></tr>
          </thead>
          <tbody>
            <tr><td>网站统计数据</td><td>最长 12 个月</td><td>到期通过 Umami 官方站点 reset/delete 能力清除</td></tr>
            <tr><td>官网访问日志</td><td>7 天</td><td>轮转后删除</td></tr>
            <tr><td>统计数据库备份</td><td>30 天</td><td>到期删除，备份不含业务数据</td></tr>
          </tbody>
        </table>
        <p className="sub" style={{ marginTop: 12 }}>
          如果你的浏览器开启了 <code>Do Not Track</code> 或你点击了“关闭网站统计”，本网站不会加载统计脚本。
        </p>
      </section>

      <section className="section">
        <h2>自行验证</h2>
        <p>
          开发者可打开浏览器 Network 面板，确认“帮你刷 boss”域名没有收到岗位、公司、简历、API Key、Cookie
          或本地存储内容；统计请求只包含固定事件名与规范化路径。
        </p>
      </section>

      <p className="sub">
        如仍有疑问，请在
        <a
          href="https://github.com/howdoyouknowthat/bossfetcher-web/issues"
          target="_blank"
          rel="noopener noreferrer"
        >
          BossFetcher 的公开 GitHub 仓库
        </a>
        提交 Issue；提交前请删除岗位正文、简历、API Key、Cookie 和个人信息。
      </p>
    </div>
  );
}
