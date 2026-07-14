#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/release/common.sh"

if [[ "$#" -eq 0 ]]; then
  die "缺少要检查的候选发布标记。"
fi

repo="$(github_repository)"
info "检查正式版发布标记冲突"

for candidate in "$@"; do
  pkg="${candidate%%=*}"
  version="${candidate#*=}"
  assert_package "$pkg"

  if [[ "$pkg" == "$candidate" ]] || ! is_exact_version "$version"; then
    die "无效正式版候选版本：$candidate"
  fi

  tag_name="@schemx/${pkg}@${version}"

  if [[ -n "$(git tag -l "$tag_name")" ]]; then
    die "本地 Git tag 已存在：$tag_name"
  fi

  assert_remote_tag_available "$tag_name"
  assert_github_release_available "$tag_name" "$repo"

  success "$tag_name 可创建"
done
