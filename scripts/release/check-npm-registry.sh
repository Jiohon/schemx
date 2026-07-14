#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/release/common.sh"

# 只展示差异，不强制覆盖用户当前 registry；publish 命令会显式指定目标 registry。
info "检查 npm registry"
configured_registry="$(pnpm config get registry)"
release_kv "current" "$configured_registry" 10
release_kv "registry" "$NPM_REGISTRY" 10
