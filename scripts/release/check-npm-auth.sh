#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/release/common.sh"

info "检查 npm 登录状态"
configure_npm_token_auth
if ! pnpm whoami --registry "$NPM_REGISTRY" >/dev/null 2>&1; then
  printf -v login_hint 'pnpm login --registry "%s"' "$NPM_REGISTRY"
  die "$(printf 'npm 未登录或当前 registry 无权限，请设置 NPM_TOKEN，或先执行 `%s`。' "$login_hint")"
fi
