#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/release/common.sh"

if [[ "$#" -eq 0 ]]; then
  die "缺少用于生成 release tag 的包名。"
fi

first_pkg="$1"
version="$(package_json_value "$first_pkg" version)"
tag_name="v${version}"

for pkg in "$@"; do
  current_version="$(package_json_value "$pkg" version)"
  if [[ "$current_version" != "$version" ]]; then
    die "发布目标版本不一致，无法创建统一 tag：$first_pkg=$version，$pkg=$current_version"
  fi
done

if [[ -n "$(git tag -l "$tag_name")" ]]; then
  die "Git tag $tag_name 已存在。"
fi

info "创建并推送 release tag：$tag_name"
git tag -a "$tag_name" -m "release: $tag_name"
git push origin main
git push origin "$tag_name"
