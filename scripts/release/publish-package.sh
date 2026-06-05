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

info "发布 @schemx/$pkg"
if [[ -n "$tag" ]]; then
  pnpm --dir "$(package_path "$pkg")" publish --access public --registry "$NPM_REGISTRY" --tag "$tag" --no-git-checks
  exit 0
fi

pnpm --dir "$(package_path "$pkg")" publish --access public --registry "$NPM_REGISTRY"
