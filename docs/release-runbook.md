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

### staging 验收（每次发布）

- 全新 Chrome / Edge 用户目录走完安装向导；
- 手动抓一个岗位 → `/app` 出现记录；
- 5,000 条合成数据搜索/筛选/分页/导出/恢复；
- Network 审计：官网域名无岗位/简历/API Key 外发；
- `/app`、BOSS 页面、用户脚本零统计请求；
- Do Not Track / 本地退出生效；
- 统计服务停止时安装流程不阻塞。

### production 发布

1. 构建产物上传 `/srv/bossfetcher/web/current/`；
2. 用户脚本同时写入 `/srv/bossfetcher/web/current/bossfetcher.user.js` 与 `/srv/bossfetcher/web/releases/<version>/bossfetcher.user.js`；
3. `nginx -t && systemctl reload nginx`；
4. 验证 `/bossfetcher.user.js` 返回完整脚本（非 HTML 错误页），安装地址短缓存；
5. 检查 Umami 收集端点 `/api/collect` 正常；管理后台未授权访问返回拒绝。

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
