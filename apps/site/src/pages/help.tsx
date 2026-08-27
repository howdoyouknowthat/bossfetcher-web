export function HelpPage() {
  return (
    <div>
      <h1>帮助与排错</h1>
      <p className="sub">常见问题按安装、采集与数据分类。</p>

      <h2 id="tampermonkey">安装</h2>
      <div className="card" style={{ marginBottom: 14 }}>
        <h3>Tampermonkey 装好了，但脚本不运行？</h3>
        <p>
          新版 Chrome 默认禁止扩展运行用户脚本。请打开扩展管理页，找到 Tampermonkey，
          确认“允许用户脚本（Allow User Scripts）”已开启；开启后回到 BossFetcher 页面刷新。
        </p>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <h3>无法访问浏览器扩展商店？</h3>
        <p>
          如果所在网络无法访问 Chrome Web Store 或 Tampermonkey 官网，可以尝试：
          使用 Edge（微软 Edge 加载项商店可能可达）、更换网络环境，或请同事/朋友协助导出
          Tampermonkey 官方 crx 后按官方说明加载。BossFetcher 不会引导普通用户加载未打包扩展或修改企业策略。
        </p>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <h3>官网显示“尚未检测到脚本”</h3>
        <p>
          安装脚本后刷新页面即可。若仍未检测到，请确认：Tampermonkey 已启用、扩展详情页
          “允许用户脚本”已开启、脚本在 Tampermonkey 面板中处于启用状态。之后点击安装向导的“重新检测”。
        </p>
      </div>

      <h2>采集</h2>
      <div className="card" style={{ marginBottom: 14 }}>
        <h3>采集提示“请先登录并进入搜索页”</h3>
        <p>
          请在 BOSS 直聘上自行登录账号，进入搜索页并输入关键词后再点击“开始”。
          BossFetcher 不读取、不保存你的密码或 Cookie。
        </p>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <h3>出现“页面结构已变化”或解析字段缺失</h3>
        <p>
          为安全起见，脚本会停止当前记录写入并保留队列。请把<a href="/privacy">诊断信息</a>复制给支持人员，
          不要在反馈中包含岗位或简历原文。
        </p>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <h3>今日额度达到上限 / 时间窗口自动暂停</h3>
        <p>
          脚本默认每日有采集上限并只在设定时间窗口运行，到达后会自动暂停，第二天自动恢复。
          这是为了保护你的访问节奏。
        </p>
      </div>

      <h2>数据</h2>
      <div className="card" style={{ marginBottom: 14 }}>
        <h3>数据存在哪里？换了电脑还在吗？</h3>
        <p>
          数据只保存在当前浏览器（Tampermonkey 存储）里。换电脑或清理浏览器前，请先在“我的岗位库 → 数据管理”
          导出完整备份，再到新设备导入。
        </p>
      </div>
      <div className="card">
        <h3>如何撤回使用？</h3>
        <p>
          在“数据管理”点击“清空全部数据”（需二次确认），或在 Tampermonkey 中删除 BossFetcher 脚本并清空脚本存储。
          网站统计退出见<a href="/privacy">隐私页</a>。
        </p>
      </div>
    </div>
  );
}
