# 隐私与数据流（BossFetcher Web）

本文记录代码层面对数据边界的技术事实，供隐私文案与验收对照。最终对外承诺由产品负责人确认。

## 一句话

岗位、公司、简历、AI 输入/输出和用户 API Key 留在用户浏览器；用户主动打开官网时，官网只向 BossFetcher 自建统计服务器发送固定事件名与规范化路径。

## 数据流

| 链路 | 数据 | 去向 |
| --- | --- | --- |
| 采集链 | BOSS 已渲染页面 → Page Parser → LocalRepository → Tampermonkey 存储 | 只在本浏览器 |
| 展示链 | `/app` 静态外壳 → Dashboard Bootstrap → LocalRepository → 渲染 | 只在本浏览器 |
| AI 链（第二阶段） | 用户选择内容 → Consent Gate → 用户选择的第三方服务商 | 不经过 BossFetcher |
| 官网统计链 | 公开官网页面 → SiteAnalytics allowlist → 自托管 Umami → PostgreSQL | 固定事件名 + 规范化路径 |

## 边界实现

- 用户脚本 `@match` 只声明 `https://www.zhipin.com/*` 与 `https://<官网域名>/*`；无 `@connect *`、无 `GM_xmlhttpRequest`。
- 用户脚本不包含 analytics 代码（`packages/analytics` 只被 `apps/site` 引用）。
- `/app` 使用独立 entry（`apps/site/app.html` + `src/app-main.tsx`），只引入 dashboard 样式，物理排除 Umami tracker / website id / 统计调用。
- `SiteAnalytics`（`packages/analytics`）：
  - 页面路径 allowlist：`/`、`/install`、`/help`、`/privacy`；`/app` 及其子路径一律返回 null。
  - 事件 allowlist：10 个固定事件名；`trackEvent(name)` 只接受枚举，不接收 event data。
  - 初始化前检查本地退出标志 `bf.analytics_opt_out` 与 `navigator.doNotTrack`；本地存储不可用默认不统计。
  - 不读取 DOM 文本、表单值、GM storage、URL query/hash；不调用 `identify()`。
- 自托管 Umami 配置（`infra/analytics/compose.yaml`）：`DISABLE_TELEMETRY=1`、`DISABLE_UPDATES=1`、`PRIVATE_MODE=1`，不启用 Replay/Heatmap/User ID/Share URL。
- Nginx：`Referrer-Policy: no-referrer`；统计收集端点 `access_log off`；官网访问日志用最小格式并保留 7 天。
- API Key 只存本地设置；`exportBackup()` 默认置空 apiKey，备份不含密钥。

## 保留期

- Umami 统计数据：最长 12 个月（官方 Website Reset/Delete 清除）。
- Nginx 官网访问日志：7 天。
- 统计数据库备份：30 天。

## 验收手段

- `scripts/verify-release.mjs`：no-localhost、密钥扫描、占位符、userscript 元数据、`/app` no-tracker、官网 bundle allowlist 事件、用户脚本零统计。
- 自动化测试（`packages/analytics/src/analytics.test.ts`）：未知事件拒绝、DNT/退出不加载、query/hash 剥离、`/app` 不初始化。
- 真机 Network 审计：BossFetcher 域名收不到岗位/公司/简历/API Key/Cookie。
