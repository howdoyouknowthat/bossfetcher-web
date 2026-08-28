# 发布运行手册（BossFetcher Web）

## 版本号

单一版本真源：`packages/contracts/src/index.ts` 的 `APP_VERSION`。构建、用户脚本 `@version`、根 `package.json` 由 `scripts/verify-release.mjs` 校验一致。

## 发布检查清单

### 构建前

- [ ] `pnpm install`（CI 使用 frozen install）
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm test` 通过（含 parser parity、repository 5000 条、capture 状态机、analytics guard）

### 构建

```bash
pnpm build
node scripts/verify-release.mjs --release
```

发布模式会强制：
- 域名占位符（`bossfetcher.example.com`、`stats.bossfetcher.example.com`、`__UMAMI_WEBSITE_ID__`）必须已替换；
- 产物不含 localhost / 密钥 / `/app` 不含 tracker；
- 用户脚本元数据与 `APP_VERSION` 一致。

一键发布检查（构建机需注入真实 `VITE_UMAMI_WEBSITE_ID` 与备案号原文）：

```bash
VITE_UMAMI_WEBSITE_ID='实际 website id' VITE_ICP_NUMBER='备案号原文' pnpm verify:release
```

### staging 验收（每次发布）

- 全新 Chrome / Edge 用户目录走完安装向导；
- 手动抓一个岗位 → `/app` 出现记录；
- 5,000 条合成数据搜索/筛选/分页/导出/恢复；
- Network 审计：官网域名无岗位/简历/API Key 外发；
- `/app`、BOSS 页面、用户脚本零统计请求；
- Do Not Track / 本地退出生效；
- 统计服务停止时安装流程不阻塞。

浏览器级自动验收：`pnpm test:e2e`（公开页渲染、`/app` 无 tracker、退出统计后零请求）。
手动 Chrome/Edge + Tampermonkey 验收记录见 `docs/staging-acceptance.md`。

## production 发布（ICP 备案通过后）

### 硬性门槛 0：ICP 备案

- 未取得 ICP 备案号前，**不得**让 Nginx 在公网 80/443 提供网站内容。
- 页脚必须显示备案号原文并链接工信部备案系统 `https://beian.miit.gov.cn/`。

### 硬性门槛 1：证书改为 webroot 自动续期（ICP 通过后）

先安装 Nginx、创建 `/var/www/certbot`，并确保 80 端口只服务 `/.well-known/acme-challenge/`（不启用站点内容），然后：

```bash
sudo certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --cert-name bossfetcher.icu \
  -d bossfetcher.icu \
  -d www.bossfetcher.icu \
  -d stats.bossfetcher.icu
sudo certbot renew --dry-run
```

预期：证书保留全部三个 SAN，dry-run 成功且无需手动 TXT 记录。

### 硬性门槛 2：Nginx 校验先于站点内容

```bash
sudo nginx -t
sudo ss -lntp | grep -E ':(80|443)\b'
```

预期：Nginx 独占 80 与 443；Docker 服务不绑定公网端口（3000、5432、2375/2376、8080、9000 均不得有公网监听）。

### 硬性门槛 3：统计只经回环与 Nginx 暴露

```bash
docker compose ps
ss -lntp | grep '127.0.0.1:3000'
ss -lntp | grep ':5432' && exit 1 || true
./verify-runtime-env.sh .env
```

预期：Umami 只绑定 `127.0.0.1:3000`；PostgreSQL 无宿主端口；运行时环境校验通过且不打印任何真实密钥。

### 硬性门槛 4：创建 Umami website 并关闭发布占位符

- 只通过 SSH 隧道或临时固定管理员 IP 白名单访问 Umami 管理界面；
- 为 `www.bossfetcher.icu` 创建一个 website，把 website id 复制到受保护的构建环境作为 `VITE_UMAMI_WEBSITE_ID`；
- 立即修改默认管理员密码；
- 保持 `PRIVATE_MODE=1`、`DISABLE_TELEMETRY=1`、`DISABLE_UPDATES=1`。

然后运行：

```bash
pnpm verify:release
```

预期：全部发布 guard 通过。

### 硬性门槛 5：production 冒烟测试

```bash
curl -fsSI https://www.bossfetcher.icu/
curl -fsSI https://www.bossfetcher.icu/bossfetcher.user.js
curl -fsSI https://stats.bossfetcher.icu/bossfetcher-tracker.js
```

预期：
- 主页返回 HTML；
- 用户脚本返回 JavaScript MIME 与完整 Tampermonkey 元数据块；
- tracker 脚本可达；
- `/app` 无任何 tracker 请求；
- 未授权来源访问 Umami 管理根路径返回 403。

### 硬性门槛 6：备份、恢复、保留与回滚演练

执行并记录（只记录命令、时间戳、退出码与记录数；**绝不**记录 payload 正文或 IP 地址）：

- 一次 PostgreSQL 逻辑备份，并恢复到一次性 staging 数据库验证；
- 确认 30 天备份删除策略生效；
- 确认 7 天 Nginx 日志轮转生效；
- 在 staging website 上演练 Umami Website Reset/Delete；
- 将静态 `current` 符号链接切回上一版本再切回，验证回滚。

### 上线发布

1. 将完整构建产物和用户脚本上传 `/srv/bossfetcher/web/releases/<version>/`；
2. 用 `current.next` 创建新符号链接，再以 `mv -Tf` 原子替换 `/srv/bossfetcher/web/current`；
3. `nginx -t && systemctl reload nginx`；
4. 验证 `/bossfetcher.user.js` 返回完整脚本（非 HTML 错误页），安装地址短缓存；
5. 检查 Umami 收集端点 `/api/collect` 正常；管理后台未授权访问返回拒绝。

### 最终发布门（全部勾选后才允许公开）

- [ ] ICP number has been issued and is displayed with the official MIIT link.
- [ ] `certbot renew --dry-run` passes automatically.
- [ ] `pnpm verify:release` passes.
- [ ] `pnpm test:e2e` passes.
- [ ] Chrome and Edge manual Tampermonkey acceptance is checked.
- [ ] Umami Network payload review matches the privacy page.
- [ ] 12-month / 7-day / 30-day cleanup rehearsal passes.
- [ ] TCP 80/443 是仅有的全 IPv4 Web 服务端口；TCP 22 已限制到批准的管理来源或受保护的管理通道。
- [ ] Rollback rehearsal passes without deleting browser-local data.

### 回滚

- 官网：切回上一个 `releases/` 构建（保留最近 N 个）。
- 用户脚本：更新 `@updateURL`/`@downloadURL` 指向历史版本，或保留旧版文件让 Tampermonkey 回滚。回滚不删除任何本地数据（数据在浏览器，不随网站部署变化）。
- 统计：恢复 `infra/analytics/backups/` 中 30 天内备份；数据库数据卷独立于站点目录。

### 数据迁移

- schema 升级在 `LocalRepository.runMigrations` 中实现；升级前先备份导出。
- 迁移失败进入只读恢复模式，先引导导出备份与诊断，禁止继续写入。

### 12 个月统计清理

- 在 staging 演练 Umami 官方 Website Reset/Delete；
- 生产执行后记录操作时间、站点 id、结果与磁盘/记录数变化；
- 清理失败产生管理员告警（不含事件正文）。

## 发布产物存档

每次发布保存：网站构建产物、用户脚本单文件、版本号、checksum、变更说明、schema migration 说明、自动测试结果、手工验收记录、回滚目标版本。
