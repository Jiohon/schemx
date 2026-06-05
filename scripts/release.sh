#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PACKAGES=(core vue vant)
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org/}"
PRERELEASE_BACKUP_DIR=""
PRERELEASE_TARGETS=()
RELEASE_CANCELLED_TARGET="__SCHEMX_RELEASE_CANCELLED__"

usage() {
  cat <<'USAGE'
用法：
  pnpm release:check
  pnpm release:pack
  pnpm release:publish
  pnpm release:publish:dev
  pnpm release:publish:beta
  pnpm release:publish:rc
  pnpm release:publish:next
  pnpm release:version:patch
  pnpm release:version:minor
  pnpm release:version:major

也可以直接调用：
  bash scripts/release.sh check
  bash scripts/release.sh pack
  bash scripts/release.sh publish [all|core|vue|vant]
  bash scripts/release.sh publish-dev [all|core|vue|vant]
  bash scripts/release.sh publish-beta [all|core|vue|vant]
  bash scripts/release.sh publish-rc [all|core|vue|vant]
  bash scripts/release.sh publish-next [all|core|vue|vant]
  bash scripts/release.sh version [patch|minor|major]
USAGE
}

info() {
  printf '\n==> %s\n' "$1"
}

die() {
  printf '错误：%s\n' "$1" >&2
  exit 1
}

package_choices() {
  local IFS="、"
  printf '%s' "${PACKAGES[*]}"
}

package_path() {
  printf 'packages/%s' "$1"
}

package_json_value() {
  local pkg="$1"
  local field="$2"

  node -p "const pkg=require('./$(package_path "$pkg")/package.json'); pkg['$field']"
}

assert_package() {
  local pkg="$1"

  for item in "${PACKAGES[@]}"; do
    if [[ "$item" == "$pkg" ]]; then
      return
    fi
  done

  die "未知包：$pkg，可选值为 $(package_choices)"
}

assert_publish_target() {
  local target="$1"

  if [[ "$target" == "all" ]]; then
    return
  fi

  assert_package "$target"
}

SELECTED_TARGET=""

select_publish_target() {
  local target="${1:-}"
  local channel="${2:-latest}"

  if [[ -n "$target" ]]; then
    assert_publish_target "$target"
    SELECTED_TARGET="$target"
    printf '发布模式：%s\n' "$channel"
    printf '发布目标：%s\n' "$SELECTED_TARGET"
    return
  fi

  SELECTED_TARGET="$(node "$ROOT_DIR/scripts/select-release-target.mjs" --channel "$channel" all "${PACKAGES[@]}")"
  if [[ "$SELECTED_TARGET" == "$RELEASE_CANCELLED_TARGET" ]]; then
    exit 0
  fi

  assert_publish_target "$SELECTED_TARGET"
  printf '发布模式：%s\n' "$channel"
  printf '发布目标：%s\n' "$SELECTED_TARGET"
}

assert_main_branch() {
  bash "$ROOT_DIR/scripts/release/assert-main-branch.sh"
}

assert_clean_git() {
  bash "$ROOT_DIR/scripts/release/assert-clean-git.sh"
}

assert_prerelease_channel() {
  local channel="$1"

  case "$channel" in
    dev | beta | rc | next) ;;
    *) die "预发布 tag 只能是 dev、beta、rc 或 next" ;;
  esac
}

assert_prerelease_version_files_clean() {
  local pkg pkg_json

  for pkg in "$@"; do
    pkg_json="$(package_path "$pkg")/package.json"
    if [[ -n "$(git status --porcelain -- "$pkg_json")" ]]; then
      git status --short -- "$pkg_json"
      die "预发布会临时修改 $pkg_json。请先提交或还原该文件的当前改动。"
    fi
  done
}

assert_npm_auth() {
  bash "$ROOT_DIR/scripts/release/check-npm-auth.sh"
}

assert_npm_registry() {
  bash "$ROOT_DIR/scripts/release/check-npm-registry.sh"
}

run_quality_checks() {
  bash "$ROOT_DIR/scripts/release/run-quality-checks.sh"
}

pack_packages() {
  info "检查发布包内容"

  pack_target_packages "${PACKAGES[@]}"
}

pack_target_packages() {
  bash "$ROOT_DIR/scripts/release/pack-packages.sh" "$@"
}

run_check() {
  run_quality_checks
  pack_packages
}

run_pack() {
  info "生成本地 tarball"

  for pkg in "${PACKAGES[@]}"; do
    pnpm --filter "@schemx/$pkg" pack --pack-destination "$ROOT_DIR"
  done
}

publish_one() {
  local pkg="$1"
  local tag="${2:-}"
  assert_package "$pkg"

  bash "$ROOT_DIR/scripts/release/publish-package.sh" "$pkg" "$tag"
}

resolve_targets() {
  local target="${1:-all}"

  if [[ "$target" == "all" ]]; then
    printf '%s\n' "${PACKAGES[@]}"
    return
  fi

  assert_package "$target"
  printf '%s\n' "$target"
}

check_target_versions_available() {
  bash "$ROOT_DIR/scripts/release/check-versions-available.sh" "$@"
}

set_package_version() {
  local pkg_json="$1"
  local version="$2"

  node -e "
const fs = require('node:fs');
const pkgPath = process.argv[1];
const version = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
" "$pkg_json" "$version"
}

next_prerelease_version() {
  local current_version="$1"
  local channel="$2"
  local base major minor patch timestamp sha

  base="${current_version%%-*}"
  IFS=. read -r major minor patch <<<"$base"

  if [[ -z "${major:-}" || -z "${minor:-}" || -z "${patch:-}" ]]; then
    die "无法解析版本号：$current_version"
  fi

  patch=$((patch + 1))
  timestamp="${SCHEMX_RELEASE_TIMESTAMP:-$(date +%Y%m%d%H%M%S)}"
  sha="${SCHEMX_RELEASE_SHA:-$(git rev-parse --short HEAD 2>/dev/null || printf 'local')}"

  printf '%s.%s.%s-%s.%s.%s' "$major" "$minor" "$patch" "$channel" "$timestamp" "$sha"
}

prepare_prerelease_versions() {
  local channel="$1"
  local pkg pkg_json current_version next_version
  shift

  PRERELEASE_BACKUP_DIR="$(mktemp -d)"
  PRERELEASE_TARGETS=("$@")

  info "生成临时 ${channel} 预发布版本"
  for pkg in "${PRERELEASE_TARGETS[@]}"; do
    pkg_json="$(package_path "$pkg")/package.json"
    cp "$pkg_json" "$PRERELEASE_BACKUP_DIR/$pkg.json"

    current_version="$(package_json_value "$pkg" version)"
    next_version="$(next_prerelease_version "$current_version" "$channel")"
    set_package_version "$pkg_json" "$next_version"

    printf '@schemx/%s: %s → %s\n' "$pkg" "$current_version" "$next_version"
  done
}

restore_prerelease_versions() {
  local pkg backup

  if [[ -z "$PRERELEASE_BACKUP_DIR" || ! -d "$PRERELEASE_BACKUP_DIR" ]]; then
    return
  fi

  for pkg in "${PRERELEASE_TARGETS[@]}"; do
    backup="$PRERELEASE_BACKUP_DIR/$pkg.json"
    if [[ -f "$backup" ]]; then
      cp "$backup" "$(package_path "$pkg")/package.json"
    fi
  done

  rm -rf "$PRERELEASE_BACKUP_DIR"
  PRERELEASE_BACKUP_DIR=""
  PRERELEASE_TARGETS=()
}

run_publish() {
  local target="${1:-}"
  local targets=()
  local pkg

  select_publish_target "$target" latest
  target="$SELECTED_TARGET"
  assert_main_branch
  assert_clean_git
  assert_npm_registry
  assert_npm_auth

  targets=($(resolve_targets "$target"))
  check_target_versions_available "${targets[@]}"
  run_quality_checks
  pack_target_packages "${targets[@]}"

  for pkg in "${targets[@]}"; do
    publish_one "$pkg"
  done

  bash "$ROOT_DIR/scripts/release/create-release-tag.sh" "${targets[@]}"
}

run_prerelease_publish() {
  local channel="$1"
  local target="${2:-}"
  local targets=()
  local pkg

  assert_prerelease_channel "$channel"
  select_publish_target "$target" "$channel"
  target="$SELECTED_TARGET"
  targets=($(resolve_targets "$target"))
  assert_prerelease_version_files_clean "${targets[@]}"

  prepare_prerelease_versions "$channel" "${targets[@]}"
  trap restore_prerelease_versions EXIT

  assert_npm_registry
  assert_npm_auth
  check_target_versions_available "${targets[@]}"
  run_quality_checks
  pack_target_packages "${targets[@]}"

  for pkg in "${targets[@]}"; do
    publish_one "$pkg" "$channel"
  done

  restore_prerelease_versions
  trap - EXIT
}

run_version() {
  local level="${1:-patch}"

  case "$level" in
    patch | minor | major) ;;
    *) die "版本类型只能是 patch、minor 或 major" ;;
  esac

  assert_main_branch
  assert_clean_git

  info "提升 packages 版本：$level"
  for pkg in "${PACKAGES[@]}"; do
    npm --prefix "$(package_path "$pkg")" version "$level" --no-git-tag-version
  done

  info "同步 pnpm-lock.yaml"
  pnpm install --lockfile-only
}

main() {
  local command="${1:-}"

  case "$command" in
    check)
      run_check
      ;;
    pack)
      run_pack
      ;;
    publish)
      run_publish "${2:-}"
      ;;
    publish-dev)
      run_prerelease_publish dev "${2:-}"
      ;;
    publish-beta)
      run_prerelease_publish beta "${2:-}"
      ;;
    publish-rc)
      run_prerelease_publish rc "${2:-}"
      ;;
    publish-next)
      run_prerelease_publish next "${2:-}"
      ;;
    version)
      run_version "${2:-patch}"
      ;;
    -h | --help | help | "")
      usage
      ;;
    *)
      usage
      die "未知命令：$command"
      ;;
  esac
}

main "$@"
