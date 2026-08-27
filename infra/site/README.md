# 官网静态部署（Nginx，腾讯云中国大陆）

目标：`个人域名 ──HTTPS──> Nginx ──> 官网静态文件`；统计子域名反向代理到本机 Umami。

## 目录布局

```text
/srv/bossfetcher/
├─ web/current/          # NGINX 返回的构建产物（apps/site/dist）
├─ web/releases/         # 最近若干个可回滚构建 + 历史用户脚本版本
├─ analytics/            # compose.yaml、.env、postgres/、backups/
├─ backups/              # 临时备份
└─ logs/                 # 访问日志（7 天轮转）
```

## 发布步骤（简版）

```bash
# 在构建机
pnpm build
# 将 apps/site/dist 上传到 /srv/bossfetcher/web/current
# 将 packages/userscript/dist/bossfetcher.user.js 上传到 /srv/bossfetcher/web/current/ 与 /srv/bossfetcher/web/releases/<version>/
# 在服务器
nginx -t && systemctl reload nginx
```

## 关键配置

- `bossfetcher-site.conf`：官网 vhost，80→443，静态资源 hash 长缓存，`index.html`/用户脚本短缓存，安全头与 CSP，`Referrer-Policy: no-referrer`。
- `stats.bossfetcher.conf`：统计子域名反向代理到 `127.0.0.1:3000`；收集端点 `access_log off`；管理后台按来源 IP 限制。
- `nginx-logrotate.conf`：官网访问日志保留 7 天。
- 用户脚本必须以 `application/javascript` 提供，且安装地址短缓存，历史版本长缓存。

## 上线前

- 替换所有 `your-domain.example` 为正式域名；配置证书。
- 从公网确认 3000、5432、2375/2376、8080、9000 不可达。
- 安全组只放通 80、443，以及限制来源的 22。
