# 自托管 Umami + PostgreSQL（腾讯云单机）

BossFetcher 网站统计：只统计公开官网页面与固定安装漏斗，不接收岗位/公司/简历/API Key/Cookie。

## 首次部署

```bash
cp .env.example .env && chmod 600 .env
# 编辑 .env：填入 openssl rand -hex 32 生成的真实值
./verify-runtime-env.sh .env     # 校验权限、键完整性与长度，不打印任何值
docker compose up -d
docker compose ps
```

- 首次登录：`admin` / `umami`，**登录后立即改强密码**。
- 只通过 SSH 隧道或临时固定管理员 IP 白名单访问 Umami 管理界面；为 `www.bossfetcher.icu` 创建一个 website，把 website id 复制到受保护的构建环境作为 `VITE_UMAMI_WEBSITE_ID`（构建机执行 `pnpm verify:release` 时导出），不要把 website id 写进仓库。
- 固定镜像版本：`compose.yaml` 已固定 `docker.umami.is/umami-software/umami:postgresql-v3.3.1` 与 `postgres:16.3-alpine`，需在 staging 验证 tag/digest 后再用于生产。

## 运行时环境校验

`verify-runtime-env.sh` 在服务器上检查 `.env`：

- 文件存在且权限为 600；
- `POSTGRES_PASSWORD`、`APP_SECRET`、`TWO_FACTOR_ENCRYPTION_KEY` 均已填写、长度 ≥ 32、不含示例值；
- 绝不读取或打印真实值。

## 安全基线

- Umami 只绑定 `127.0.0.1:3000`，公网只能经 Nginx HTTPS 进入。
- PostgreSQL 只在 Docker 内网，无公网端口。
- `.env`、数据库密码、`APP_SECRET`、`TWO_FACTOR_ENCRYPTION_KEY` 不进入 Git。
- 已设置：`DISABLE_TELEMETRY=1`、`DISABLE_UPDATES=1`、`PRIVATE_MODE=1`（关闭所有外部网络调用）。
- 不启用 Session Replay、Heatmap、User ID、`identify()`、Share URL 与第三方集成。

上线前验证（预期：Umami 只在回环、PostgreSQL 无宿主端口、校验通过）：

```bash
docker compose ps
ss -lntp | grep '127.0.0.1:3000'
ss -lntp | grep ':5432' && exit 1 || true
./verify-runtime-env.sh .env
```

## 备份 / 恢复 / 清理

```bash
# 每日逻辑备份（保留 30 天），写入 crontab
15 4 * * * /srv/bossfetcher/analytics/backup.sh

# 恢复演练：恢复到一次性 staging 数据库，确认记录数后再处理
gunzip -c backups/umami-<stamp>.sql.gz | docker compose exec -T db psql -U umami -d umami

# 12 个月统计数据清理：通过 Umami 后台的 Website Reset/Delete 能力清除该站点数据
# （先在 staging 演练，确认只删目标站点、不误删其他站点）
```

保留策略：统计数据最长 12 个月；Nginx 官网访问日志 7 天；统计数据库备份 30 天。
所有演练只记录命令、时间戳、退出码与记录数，不记录 payload 正文或 IP 地址。

## 升级

1. 备份 PostgreSQL；
2. 阅读当前版本官方迁移说明（Umami 大版本可能运行 schema migration）；
3. 先在 staging 验证新版本与 digest；
4. 人工发布：修改 `compose.yaml` 版本 → `docker compose pull` → `docker compose up -d`；
5. 验证 `/api/health`、官网与收集端点。
