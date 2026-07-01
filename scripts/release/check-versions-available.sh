#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/release/common.sh"

if [[ "$#" -eq 0 ]]; then
  die "缺少要检查的包名。"
fi

info "检查 npm 上是否已存在当前版本"
for pkg in "$@"; do
  package_name="$(package_json_value "$pkg" name)"
  version="$(package_json_value "$pkg" version)"

  if pnpm view "${package_name}@${version}" version --registry "$NPM_REGISTRY" >/dev/null 2>&1; then
    die "${package_name}@${version} 已存在。正式发布前请使用 \`pnpm release:publish latest $pkg patch\` 或指定新的 x.y.z 版本。"
  fi

  success "${package_name}@${version} 可发布"
done
