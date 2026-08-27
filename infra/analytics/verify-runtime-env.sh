#!/usr/bin/env bash
# 服务器端运行时 .env 校验：只检查存在性、权限与长度，绝不打印真实值。
# 用法：./verify-runtime-env.sh [env-file]（默认 .env）
set -euo pipefail

env_file="${1:-.env}"
test -f "$env_file" || { echo "missing runtime env file" >&2; exit 1; }
test "$(stat -c '%a' "$env_file")" = "600" || { echo "runtime env must be mode 600" >&2; exit 1; }

for key in POSTGRES_PASSWORD APP_SECRET TWO_FACTOR_ENCRYPTION_KEY; do
  line="$(grep -E "^${key}=" "$env_file" || true)"
  value="${line#*=}"
  test "$line" != "$value" || { echo "missing ${key}" >&2; exit 1; }
  test "${#value}" -ge 32 || { echo "${key} is too short" >&2; exit 1; }
  case "$value" in
    *change-me*) echo "${key} still uses example content" >&2; exit 1 ;;
  esac
done

echo "runtime env ok"
