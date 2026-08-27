# BossFetcher Web（帮你刷 boss）

BossFetcher Web 是独立于原开源 BossFetcher 的 Web 版项目：静态官网 + 单一 Tampermonkey 用户脚本，实现 BOSS 直聘本地采集、本地存储与本地结果页。

## 产品与数据边界

- 官网无需注册或登录。
- 岗位、公司和采集状态保存在 Tampermonkey 本地存储。
- 公开官网使用自托管 Umami 统计公开页面和固定安装事件。
- `/app`、BOSS 页面和用户脚本不加载统计。
- AI 是第二阶段可选功能，第一阶段没有 AI 远程调用。

## 快速开始（开发）

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e                              # 浏览器级 staging 测试（需先 pnpm build）
node scripts/verify-release.mjs --release   # 发布前检查
```

CI（GitHub Actions）在 pull request 与 main push 时执行 `pnpm verify` 与 `pnpm test:e2e`。

## 仓库结构

```text
apps/site/                 官网（/、/install、/help、/privacy）+ /app 静态外壳（独立 entry，无统计）
packages/contracts/        JobV1 / CompanyV1 / CaptureStateV1 / SettingsV1 / BackupV1 数据契约
packages/parser/           DOM 与薪资解析纯函数（Python parse_html.py / salary.py 的 JS 移植）
packages/repository/       LocalRepository + Tampermonkey(GM)/内存 Adapter
packages/capture/          采集 Controller（状态机、队列、限速）
packages/dashboard/        结果页 UI（概览/浏览/采集/数据管理）
packages/analytics/        SiteAnalytics（页面/事件 allowlist、Umami、退出与 DNT）
packages/userscript/       用户脚本 composition root（BOSS 面板 + /app 挂载 + 站点就绪标记）
infra/                     Nginx 配置 + Umami/PostgreSQL Compose + 备份
fixtures/                  合成 HTML 与 5,000 条性能数据（脚本生成）
tests/                     parity / integration / e2e
scripts/                   verify-release、generate-fixtures
docs/                      privacy-data-flow、release-runbook
```

## 核心边界

- 用户脚本 `@match` 只含 BOSS 直聘与官网域名；无 `@connect *`、无 `GM_xmlhttpRequest`。
- `/app` 不加载统计；统计只覆盖公开官网页面与固定安装漏斗。
- 统计事件仅固定 10 个名称，无 event data；支持本地退出与 Do Not Track。
- API Key 只在本地设置，默认备份不含密钥。

## 文档

- 隐私与数据流：`docs/privacy-data-flow.md`
- 安装向导：官网 `/install`（本地 `pnpm --filter @bossfetcher/site dev` 后访问）
- 开发与验证：本 README「快速开始」与 `scripts/verify-release.mjs`
- 发布运行手册：`docs/release-runbook.md`
- staging 验收记录：`docs/staging-acceptance.md`
- 安全报告：请通过 [GitHub Issues](https://github.com/howdoyouknowthat/bossfetcher-web/issues) 提交；请勿在 Issue 中包含岗位正文、简历、API Key、Cookie 或个人信息。
