#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PACKAGES=(core vue vant)
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org/}"

usage() {
  cat <<'USAGE'
用法：
  pnpm release:check
  pnpm release:pack
  pnpm release:publish
  pnpm release:publish:core
  pnpm release:publish:vue
  pnpm release:publish:vant
  pnpm release:version:patch
  pnpm release:version:minor
  pnpm release:version:major

也可以直接调用：
  bash scripts/release.sh check
  bash scripts/release.sh pack
  bash scripts/release.sh publish [core|vue|vant]
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

  die "未知包：$pkg，可选值为 core、vue、vant"
}

assert_clean_git() {
  if [[ -n "$(git status --porcelain)" ]]; then
    git status --short
    die "工作区不干净。请先提交或暂存当前改动，再执行发布。"
  fi
}

assert_npm_auth() {
  info "检查 npm 登录状态"
  pnpm whoami --registry "$NPM_REGISTRY" >/dev/null
}

assert_npm_registry() {
  info "检查 npm registry"
  local configured_registry

  configured_registry="$(pnpm config get registry)"
  printf '当前 registry：%s\n' "$configured_registry"
  printf '发布 registry：%s\n' "$NPM_REGISTRY"
}

run_quality_checks() {
  info "安装依赖一致性检查"
  pnpm install --frozen-lockfile

  info "运行测试"
  pnpm test

  info "运行 lint"
  pnpm lint

  info "构建发布产物"
  pnpm build
}

pack_packages() {
  info "检查发布包内容"

  for pkg in "${PACKAGES[@]}"; do
    pnpm --filter "@schemx/$pkg" pack --dry-run
  done
}

check_version_available() {
  local pkg package_name version

  pkg="$1"
  package_name="$(package_json_value "$pkg" name)"
  version="$(package_json_value "$pkg" version)"

  if pnpm view "${package_name}@${version}" version --registry "$NPM_REGISTRY" >/dev/null 2>&1; then
    die "${package_name}@${version} 已存在，请先提升版本号。"
  fi

  printf '%s@%s 可发布\n' "$package_name" "$version"
}

check_versions_available() {
  info "检查 npm 上是否已存在当前版本"

  local pkg
  for pkg in "${PACKAGES[@]}"; do
    check_version_available "$pkg"
  done
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
  assert_package "$pkg"

  info "发布 @schemx/$pkg"
  pnpm --dir "$(package_path "$pkg")" publish --access public --registry "$NPM_REGISTRY"
}

run_publish() {
  local target="${1:-all}"

  assert_clean_git
  assert_npm_registry
  assert_npm_auth

  if [[ "$target" == "all" ]]; then
    check_versions_available
    run_quality_checks
    pack_packages
    publish_one core
    publish_one vue
    publish_one vant
    return
  fi

  assert_package "$target"
  info "检查 npm 上是否已存在当前版本"
  check_version_available "$target"
  run_quality_checks
  pack_packages
  publish_one "$target"
}

run_version() {
  local level="${1:-patch}"

  case "$level" in
    patch | minor | major) ;;
    *) die "版本类型只能是 patch、minor 或 major" ;;
  esac

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
      run_publish "${2:-all}"
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
