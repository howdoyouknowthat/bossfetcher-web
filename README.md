# BossFetcher Web（帮你刷 boss）

BossFetcher Web 是独立于原开源 BossFetcher 的 Web 版项目：静态官网 + 单一 Tampermonkey 用户脚本，实现 BOSS 直聘本地采集、本地存储与本地结果页。**不注册、不登录、数据默认只留在用户浏览器。**

## 快速开始（开发）

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-release.mjs --release   # 发布前检查
```

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
- 参考规格：`docs/superpowers/specs/2026-08-20-bossfetcher-web-local-userscript-development-spec.md`（上游仓库）。

## 产品/部署门

- 域名、备案、GitHub 仓库归属、Umami website id 等由产品负责人确认（见规格 Gate U1–U4）。
- 部署基线见 `docs/superpowers/research/2026-08-21-tencent-cloud-server-baseline.md` 与 `infra/`。
