#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/release/common.sh"

pkg="${1:-}"
tag="${2:-}"

if [[ -z "$pkg" ]]; then
  die "缺少要发布的包名。"
fi

release_kv "registry" "$NPM_REGISTRY" 10
if [[ -n "$tag" ]]; then
  release_kv "tag" "$tag" 10
fi
# 提前说明 npm 的人工认证停顿，避免误判命令卡死。
warn "$(cat <<'MESSAGE'
如果 npm 要求网页登录、二维码确认或 OTP，终端可能会停在认证提示处。
请按终端提示完成浏览器认证，完成后回到这里等待发布继续。
MESSAGE
)"

# prerelease 显式写入 dist-tag；latest 则沿用 npm 默认标签。
if [[ -n "$tag" ]]; then
  release_task "发布 @schemx/$pkg" pnpm --dir "$(package_path "$pkg")" publish --access public --registry "$NPM_REGISTRY" --tag "$tag" --no-git-checks
  exit 0
fi

release_task "发布 @schemx/$pkg" pnpm --dir "$(package_path "$pkg")" publish --access public --registry "$NPM_REGISTRY"
