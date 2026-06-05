#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/release/common.sh"

info "安装依赖一致性检查"
pnpm install --frozen-lockfile

info "运行测试"
pnpm test

info "运行 lint"
pnpm lint

info "构建发布产物"
pnpm build
