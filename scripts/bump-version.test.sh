#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

create_repo() {
  local repo="$1"

  mkdir -p "$repo/scripts" "$repo/packages/core/src"
  cp "$ROOT_DIR/scripts/bump-version.sh" "$repo/scripts/bump-version.sh"

  cat >"$repo/packages/core/package.json" <<'JSON'
{
  "name": "@schemx/core",
  "version": "1.0.0"
}
JSON

  (
    cd "$repo"
    git init -q
    git config user.email "test@example.com"
    git config user.name "Release Test"
    git checkout -q -b main
    git add packages/core/package.json
    git commit -q -m "init"
    printf 'export const value = 1\n' >packages/core/src/index.ts
    git add packages/core/src/index.ts
  )
}

package_version() {
  local repo="$1"
  node -p "require('$repo/packages/core/package.json').version"
}

test_commit_bump_is_disabled_by_default() {
  local repo="$TMP_DIR/default-disabled"

  create_repo "$repo"
  (
    cd "$repo"
    bash scripts/bump-version.sh
  )

  if [[ "$(package_version "$repo")" != "1.0.0" ]]; then
    printf '默认 commit 阶段不应自动提升版本号。\n' >&2
    exit 1
  fi
}

test_commit_bump_requires_main_when_explicitly_enabled() {
  local repo="$TMP_DIR/non-main-disabled"

  create_repo "$repo"
  (
    cd "$repo"
    git checkout -q -b feature/demo
    SCHEMX_ENABLE_COMMIT_VERSION_BUMP=1 bash scripts/bump-version.sh
  )

  if [[ "$(package_version "$repo")" != "1.0.0" ]]; then
    printf '非 main 分支不应自动提升版本号。\n' >&2
    exit 1
  fi
}

test_commit_bump_can_be_enabled_on_main_for_compatibility() {
  local repo="$TMP_DIR/main-enabled"

  create_repo "$repo"
  (
    cd "$repo"
    SCHEMX_ENABLE_COMMIT_VERSION_BUMP=1 bash scripts/bump-version.sh
  )

  if [[ "$(package_version "$repo")" != "1.0.1" ]]; then
    printf '显式开启后，main 分支应保留旧的 patch +1 兼容能力。\n' >&2
    exit 1
  fi
}

test_commit_bump_is_disabled_by_default
test_commit_bump_requires_main_when_explicitly_enabled
test_commit_bump_can_be_enabled_on_main_for_compatibility

printf 'bump version tests passed\n'
