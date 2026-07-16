#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/release/common.sh"

if [[ "$#" -eq 0 ]]; then
  die "缺少要检查的包名。"
fi

# npm 不允许覆盖已发布版本，因此使用预先计算的候选版本尽早失败。
info "检查 npm 上是否已存在候选版本"
for candidate in "$@"; do
  lookup_output=""
  pkg="${candidate%%=*}"
  version="${candidate#*=}"

  assert_package "$pkg"
  if [[ "$pkg" == "$candidate" ]] ||
    ! [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.-]+)?$ ]]; then
    die "无效候选版本：$candidate"
  fi

  package_name="$(package_json_value "$pkg" name)"

  if lookup_output="$(pnpm view "${package_name}@${version}" version --registry "$NPM_REGISTRY" 2>&1)"; then
    die "${package_name}@${version} 已存在。正式发布前请使用 \`pnpm release:publish latest $pkg patch\` 或指定新的 x.y.z 版本。"
  fi

  if [[ "$lookup_output" != *"E404"* &&
    "$lookup_output" != *"404 Not Found"* &&
    "$lookup_output" != *"ERR_PNPM_NO_MATCHING_VERSION"* &&
    "$lookup_output" != *"No matching version found"* ]]; then
    die "无法确认 npm 候选版本 ${package_name}@${version} 是否可用：$lookup_output"
  fi

  success "${package_name}@${version} 可发布"
done
