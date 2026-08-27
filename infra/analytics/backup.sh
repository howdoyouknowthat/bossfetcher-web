#!/usr/bin/env bash
# PostgreSQL 每日逻辑备份：保留 30 天，并复制到可异地取回的位置。
# 用法：crontab 每日执行，例如
#   15 4 * * * /srv/bossfetcher/analytics/backup.sh
set -euo pipefail

APP_DIR="/srv/bossfetcher/analytics"
BACKUP_DIR="${APP_DIR}/backups"
REMOTE_DIR="${REMOTE_BACKUP_DIR:-}"   # 可选：异地目录 / 受控 COS 挂载点

mkdir -p "${BACKUP_DIR}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
FILE="${BACKUP_DIR}/umami-${STAMP}.sql.gz"

echo "[backup] starting at ${STAMP}"

docker compose -f "${APP_DIR}/compose.yaml" exec -T db pg_dump -U umami -d umami \
  | gzip > "${FILE}"
echo "[backup] wrote ${FILE}"

# 保留 30 天
find "${BACKUP_DIR}" -name 'umami-*.sql.gz' -mtime +30 -delete

# 复制到异地（如配置），同样保留 30 天
if [[ -n "${REMOTE_DIR}" ]]; then
  cp "${FILE}" "${REMOTE_DIR}/"
  find "${REMOTE_DIR}" -name 'umami-*.sql.gz' -mtime +30 -delete
  echo "[backup] copied to ${REMOTE_DIR}"
fi

echo "[backup] done"
