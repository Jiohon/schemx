#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org/}"
RELEASE_PACKAGES=(core vue vant)
RELEASE_CHANNELS=(dev alpha beta rc next latest)
RELEASE_VERSION_ACTIONS=(current patch minor major custom)

release_ui() {
  node "$ROOT_DIR/scripts/release/ui.mjs" "$@"
}

info() {
  release_ui section "$1"
}

success() {
  release_ui success "$1"
}

warn() {
  release_ui warn "$1"
}

die() {
  release_ui error "$1" >&2
  exit 1
}

release_kv() {
  local label="$1"
  local value="$2"
  local width="${3:-8}"

  release_ui kv "$label" "$value" "$width"
}

package_choices() {
  local IFS="、"
  printf '%s' "${RELEASE_PACKAGES[*]}"
}

release_channel_choices() {
  local IFS="、"
  printf '%s' "${RELEASE_CHANNELS[*]}"
}

version_action_choices() {
  local IFS="、"
  printf '%s' "${RELEASE_VERSION_ACTIONS[*]}"
}

release_channel_label() {
  case "$1" in
    latest) printf '正式版发布' ;;
    dev) printf 'Dev 开发测试发布' ;;
    alpha) printf 'Alpha 预发布' ;;
    beta) printf 'Beta 预发布' ;;
    rc) printf 'RC 候选发布' ;;
    next) printf 'Next 预发布' ;;
    *) printf '%s' "$1" ;;
  esac
}

release_channel_description() {
  case "$1" in
    latest) printf '发布到 npm latest，仅允许 main 分支。' ;;
    dev) printf '发布到 npm dev tag，用于日常开发测试，不保证稳定。' ;;
    alpha) printf '发布到 npm alpha tag，用于早期实验和开发分支临时验证。' ;;
    beta) printf '发布到 npm beta tag，用于公开测试。' ;;
    rc) printf '发布到 npm rc tag，用于正式版前的候选验证。' ;;
    next) printf '发布到 npm next tag，用于下一版本预览。' ;;
    *) printf '' ;;
  esac
}

version_action_label() {
  case "$1" in
    current) printf '使用当前版本' ;;
    patch) printf '提升 patch 版本（x.y.z 的 z 位）' ;;
    minor) printf '提升 minor 版本（x.y.z 的 y 位）' ;;
    major) printf '提升 major 版本（x.y.z 的 x 位）' ;;
    custom) printf '指定版本' ;;
    *)
      if is_exact_version "$1"; then
        printf '指定版本'
      else
        printf '%s' "$1"
      fi
      ;;
  esac
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
  local item

  for item in "${RELEASE_PACKAGES[@]}"; do
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

is_publish_target() {
  local target="$1"
  local item

  if [[ "$target" == "all" ]]; then
    return 0
  fi

  for item in "${RELEASE_PACKAGES[@]}"; do
    if [[ "$item" == "$target" ]]; then
      return 0
    fi
  done

  return 1
}

assert_release_channel() {
  local channel="$1"
  local item

  for item in "${RELEASE_CHANNELS[@]}"; do
    if [[ "$item" == "$channel" ]]; then
      return
    fi
  done

  die "未知发布模式：${channel}，可选值为 $(release_channel_choices)"
}

is_release_channel() {
  local channel="$1"
  local item

  for item in "${RELEASE_CHANNELS[@]}"; do
    if [[ "$item" == "$channel" ]]; then
      return 0
    fi
  done

  return 1
}

is_exact_version() {
  [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
}

assert_version_action() {
  local action="$1"

  case "$action" in
    current | patch | minor | major | custom)
      return
      ;;
  esac

  if is_exact_version "$action"; then
    return
  fi

  die "版本处理方式只能是 current、patch、minor、major 或 x.y.z"
}

resolve_targets() {
  local target="${1:-all}"

  if [[ "$target" == "all" ]]; then
    printf '%s\n' "${RELEASE_PACKAGES[@]}"
    return
  fi

  assert_package "$target"
  printf '%s\n' "$target"
}

target_summary() {
  local IFS="、"
  printf '%s' "$*"
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

release_tag_name() {
  local pkg="$1"
  local version

  version="$(package_json_value "$pkg" version)"
  printf '@schemx/%s@%s' "$pkg" "$version"
}

release_title() {
  local pkg="$1"
  local version

  version="$(package_json_value "$pkg" version)"
  printf '@schemx/%s@%s' "$pkg" "$version"
}

github_repository() {
  local repo="${GITHUB_REPOSITORY:-}"

  if [[ -z "$repo" ]]; then
    repo="$(git config --get remote.origin.url 2>/dev/null || true)"
  fi

  case "$repo" in
    git@github.com:*)
      repo="${repo#git@github.com:}"
      ;;
    ssh://git@github.com/*)
      repo="${repo#ssh://git@github.com/}"
      ;;
    https://github.com/*)
      repo="${repo#https://github.com/}"
      ;;
    http://github.com/*)
      repo="${repo#http://github.com/}"
      ;;
  esac

  repo="${repo%.git}"

  if [[ ! "$repo" =~ ^[^/]+/[^/]+$ ]]; then
    die "无法从 origin remote 解析 GitHub 仓库，请设置 GITHUB_REPOSITORY=owner/repo。"
  fi

  printf '%s' "$repo"
}

npm_registry_auth_key() {
  local registry="$1"

  registry="${registry#http://}"
  registry="${registry#https://}"
  registry="${registry%/}/"

  printf '//%s:_authToken' "$registry"
}

configure_npm_token_auth() {
  local npm_token="${NPM_TOKEN:-}"
  local auth_key user_config

  if [[ -z "$npm_token" ]]; then
    return 0
  fi

  if [[ -n "${SCHEMX_NPM_TOKEN_USERCONFIG:-}" ]]; then
    export NPM_CONFIG_USERCONFIG="$SCHEMX_NPM_TOKEN_USERCONFIG"
    return 0
  fi

  auth_key="$(npm_registry_auth_key "$NPM_REGISTRY")"
  user_config="$(mktemp "${TMPDIR:-/tmp}/schemx-npmrc.XXXXXX")"

  {
    printf 'registry=%s\n' "$NPM_REGISTRY"
    printf '%s=%s\n' "$auth_key" "$npm_token"
    printf 'always-auth=true\n'
  } >"$user_config"

  export SCHEMX_NPM_TOKEN_USERCONFIG="$user_config"
  export NPM_CONFIG_USERCONFIG="$user_config"
}
