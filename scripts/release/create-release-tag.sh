#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/release/common.sh"

if [[ "$#" -eq 0 ]]; then
  die "缺少用于生成 release tag 的包名。"
fi

# 先验证所有 tag 均不存在，避免只创建部分 tag 后才失败。
release_tags=()

for pkg in "$@"; do
  tag_name="$(release_tag_name "$pkg")"

  if [[ -n "$(git tag -l "$tag_name")" ]]; then
    die "Git tag $tag_name 已存在。"
  fi

  assert_remote_tag_available "$tag_name"

  release_tags+=("$tag_name")
done

# 所有本地 tag 创建成功后，再统一推送 main 和 tag。
for tag_name in "${release_tags[@]}"; do
  release_task "创建 $tag_name" git tag -a "$tag_name" -m "release: $tag_name"
done

release_task "推送 main" git push origin main

for tag_name in "${release_tags[@]}"; do
  release_task "推送 $tag_name" git push origin "$tag_name"
done
