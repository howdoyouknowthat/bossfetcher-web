# 官网静态部署（Nginx，腾讯云中国大陆）

目标：`个人域名 ──HTTPS──> Nginx ──> 官网静态文件`；统计子域名反向代理到本机 Umami。

正式域名：`www.bossfetcher.icu`（主站）、`bossfetcher.icu`（根域）、`stats.bossfetcher.icu`（统计）。
证书：`/etc/letsencrypt/live/bossfetcher.icu/fullchain.pem` 与 `privkey.pem`（覆盖三个 SAN）。

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

- `bossfetcher-site.conf`：官网 vhost，80→443，静态资源 hash 长缓存，`index.html`/用户脚本短缓存，安全头与 CSP（`script-src`/`connect-src` 只放行 `https://stats.bossfetcher.icu`），`Referrer-Policy: no-referrer`。
- `stats.bossfetcher.conf`：统计子域名反向代理到 `127.0.0.1:3000`；收集端点 `access_log off`；管理后台按来源 IP 限制（默认 `deny all` 返回 403）。
- `nginx-logrotate.conf`：官网访问日志保留 7 天。
- 用户脚本必须以 `application/javascript` 提供，且安装地址短缓存，历史版本长缓存。

## 上线前置门槛（按顺序执行，全部通过才公开）

1. **ICP 备案**：未取得备案号前，Nginx 不得在公网 80/443 提供网站内容。
2. **证书自动续期**：当前证书为手动 DNS-01 签发（2026-11-21 到期），`certbot.timer` 运行不等于可续期。ICP 通过后改用 webroot 续期并验证：

   ```bash
   sudo mkdir -p /var/www/certbot
   # 80 端口只服务 /.well-known/acme-challenge/，再执行：
   sudo certbot certonly --webroot --webroot-path /var/www/certbot \
     --cert-name bossfetcher.icu \
     -d bossfetcher.icu -d www.bossfetcher.icu -d stats.bossfetcher.icu
   sudo certbot renew --dry-run
   ```

   预期：三个 SAN 保留，dry-run 无需手动 TXT 记录即成功。

3. **Nginx 与端口校验**（先于复制站点内容）：

   ```bash
   sudo nginx -t
   sudo ss -lntp | grep -E ':(80|443)\b'
   ```

   预期：Nginx 独占 80/443；Docker 服务不绑定公网端口。
4. **安全组**：从公网确认 3000、5432、2375/2376、8080、9000 不可达；安全组只放通 80、443，以及限制来源的 22。
5. **冒烟测试**：

   ```bash
   curl -fsSI https://www.bossfetcher.icu/                      # HTML
   curl -fsSI https://www.bossfetcher.icu/bossfetcher.user.js   # JS MIME + 完整元数据
   curl -fsSI https://stats.bossfetcher.icu/bossfetcher-tracker.js
   ```

   并确认 `/app` 无 tracker 请求、未授权访问 Umami 管理根路径返回 403。

完整发布流程与回滚演练见 `docs/release-runbook.md`。
