#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/release/common.sh"

if [[ "$#" -eq 0 ]]; then
  die "缺少要检查发布内容的包名。"
fi

# dry-run 使用 pnpm 的实际发布文件计算逻辑。
for pkg in "$@"; do
  release_task "检查 @schemx/$pkg 发布内容" pnpm --filter "@schemx/$pkg" pack --dry-run
done
