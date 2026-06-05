#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/release/common.sh"

if [[ "$#" -eq 0 ]]; then
  die "缺少用于生成 GitHub Release 的包名。"
fi

first_pkg="$1"
version="$(package_json_value "$first_pkg" version)"
tag_name="v${version}"
repo="$(github_repository)"
notes_file="$(mktemp)"

cleanup() {
  rm -f "$notes_file"
}
trap cleanup EXIT

for pkg in "$@"; do
  current_version="$(package_json_value "$pkg" version)"
  if [[ "$current_version" != "$version" ]]; then
    die "发布目标版本不一致，无法创建统一 GitHub Release：$first_pkg=$version，$pkg=$current_version"
  fi
done

info "生成 GitHub Release notes：$tag_name"
bash "$ROOT_DIR/scripts/release/generate-release-notes.sh" "$@" >"$notes_file"

info "创建 GitHub Release：$tag_name"
gh release create "$tag_name" --repo "$repo" --title "$tag_name" --notes-file "$notes_file"
