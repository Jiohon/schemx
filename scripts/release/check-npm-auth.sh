#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/release/common.sh"

info "检查 npm 登录状态"
if ! pnpm whoami --registry "$NPM_REGISTRY" >/dev/null 2>&1; then
  printf -v login_hint 'pnpm login --registry "%s"' "$NPM_REGISTRY"
  die "$(printf 'npm 未登录或当前 registry 无权限，请先执行 `%s`，或检查 npm token / registry 配置。' "$login_hint")"
fi
