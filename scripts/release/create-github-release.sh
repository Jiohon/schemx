#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/release/common.sh"

if [[ "$#" -eq 0 ]]; then
  die "缺少用于生成 GitHub Release 的包名。"
fi

repo="$(github_repository)"

# 每个包单独生成 notes 与 Release，避免多包版本混入同一条发布记录。
for pkg in "$@"; do
  tag_name="$(release_tag_name "$pkg")"
  title="$(release_title "$pkg")"
  notes_file="$(mktemp)"
  # 临时 notes 文件必须在成功和失败路径都清理。
  cleanup_notes_file() {
    rm -f "$notes_file"
  }
  trap cleanup_notes_file EXIT

  info "生成 GitHub Release notes：$title"
  bash "$ROOT_DIR/scripts/release/generate-release-notes.sh" "$pkg" >"$notes_file"

  info "创建 GitHub Release：$title"
  gh release create "$tag_name" --repo "$repo" --title "$title" --notes-file "$notes_file"

  cleanup_notes_file
  trap - EXIT
done
