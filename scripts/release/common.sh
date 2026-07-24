#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org/}"
RELEASE_PACKAGES=(core vue vant)
RELEASE_CHANNELS=(dev alpha beta rc next latest)
RELEASE_VERSION_ACTIONS=(current patch minor major custom)

# 将 Shell 层的输出交给 Node UI，集中处理颜色和对齐。
release_ui() {
  node "$ROOT_DIR/scripts/terminal.mjs" "$@"
}

# 以公共 spinner 执行发布阶段命令；SCHEMX_VERBOSE=1 时实时透传日志。
release_task() {
  local label="$1"
  shift
  release_ui task "$label" -- "$@"
}

# 输出发布流程的阶段标题。
info() {
  release_ui section "$1"
}

# 输出成功结果。
success() {
  release_ui success "$1"
}

# 输出需要人工留意但不立即中止的提示。
warn() {
  release_ui warn "$1"
}

# 输出错误并终止当前发布流程。
die() {
  release_ui error "$1" >&2
  exit 1
}

# 输出对齐的键值信息，供发布计划和认证状态复用。
release_kv() {
  local label="$1"
  local value="$2"
  local width="${3:-8}"

  release_ui kv "$label" "$value" "$width"
}

# 生成面向用户的可发布包列表。
package_choices() {
  local IFS="、"
  printf '%s' "${RELEASE_PACKAGES[*]}"
}

# 生成面向用户的发布通道列表。
release_channel_choices() {
  local IFS="、"
  printf '%s' "${RELEASE_CHANNELS[*]}"
}

# 生成正式版可选的版本处理方式。
version_action_choices() {
  local IFS="、"
  printf '%s' "${RELEASE_VERSION_ACTIONS[*]}"
}

# 返回发布通道的简短中文名称。
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

# 返回发布通道的用途与约束，供交互确认展示。
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

# 返回版本处理方式的说明，同时兼容直接传入的精确版本号。
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

# 将逻辑包名转换为仓库内 packages 路径。
package_path() {
  printf 'packages/%s' "$1"
}

# 从指定包的 package.json 读取单个字段。
package_json_value() {
  local pkg="$1"
  local field="$2"

  node -p "const pkg=require('./$(package_path "$pkg")/package.json'); pkg['$field']"
}

# 验证包名属于可发布集合。
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

# 以退出码验证发布目标，允许 all、单包或逗号分隔的多个已知包。
is_publish_target() {
  local target="$1"
  local pkg candidate marker
  local selected=()
  local seen=","

  if [[ "$target" == "all" ]]; then
    return 0
  fi
  if [[ -z "$target" ]]; then
    return 1
  fi

  IFS=',' read -r -a selected <<< "$target" || true
  if [[ "${#selected[@]}" -eq 0 ]]; then
    return 1
  fi

  for pkg in "${selected[@]}"; do
    if [[ -z "$pkg" ]]; then
      return 1
    fi
    for candidate in "${RELEASE_PACKAGES[@]}"; do
      if [[ "$candidate" == "$pkg" ]]; then
        break
      fi
    done
    if [[ "$candidate" != "$pkg" ]]; then
      return 1
    fi
    marker=",${pkg},"
    if [[ "$seen" == *"$marker"* ]]; then
      return 1
    fi
    seen+="${pkg},"
  done
}

# 验证发布目标，允许 all、单包或逗号分隔的多个已知包。
assert_publish_target() {
  local target="$1"

  if ! is_publish_target "$target"; then
    die "未知或重复的发布目标：${target}，可选值为 all、$(package_choices)，多个包请用英文逗号分隔"
  fi
}

# 验证发布通道属于受支持集合。
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

# 以退出码形式判断发布通道是否合法。
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

# 仅接受无 prerelease/build metadata 的 x.y.z 正式版本。
is_exact_version() {
  [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
}

# 在不修改文件的情况下计算正式候选版本。
next_stable_version() {
  local current_version="$1"
  local action="$2"
  local major minor patch

  if [[ "$action" == "current" ]]; then
    printf '%s' "$current_version"
    return
  fi

  if is_exact_version "$action"; then
    printf '%s' "$action"
    return
  fi

  if ! is_exact_version "$current_version"; then
    die "无法从非正式版本计算下一版本：$current_version"
  fi

  IFS=. read -r major minor patch <<<"$current_version"
  case "$action" in
    patch)
      patch=$((patch + 1))
      ;;
    minor)
      minor=$((minor + 1))
      patch=0
      ;;
    major)
      major=$((major + 1))
      minor=0
      patch=0
      ;;
    *)
      die "无法计算版本处理方式：$action"
      ;;
  esac

  printf '%s.%s.%s' "$major" "$minor" "$patch"
}

# 确认远端 tag 不存在，并区分“未找到”与连接故障。
assert_remote_tag_available() {
  local tag_name="$1"
  local lookup_output=""
  local lookup_status=0

  if lookup_output="$(git ls-remote --exit-code --tags origin "refs/tags/$tag_name" 2>&1)"; then
    die "远端 Git tag 已存在：${tag_name}"
  else
    lookup_status=$?
  fi

  if [[ "$lookup_status" -ne 2 ]]; then
    die "无法检查远端 Git tag ${tag_name}：$lookup_output"
  fi
}

# 确认 GitHub Release 不存在，并阻止查询故障被当作未创建。
assert_github_release_available() {
  local tag_name="$1"
  local repo="$2"
  local lookup_output=""

  if lookup_output="$(gh release view "$tag_name" --repo "$repo" 2>&1)"; then
    die "GitHub Release 已存在：${tag_name}"
  fi

  if [[ "$lookup_output" != *"release not found"* && "$lookup_output" != *"HTTP 404"* ]]; then
    die "无法检查 GitHub Release ${tag_name}：$lookup_output"
  fi
}

# 验证版本动作或用户传入的精确正式版本号。
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

# 将 all 或逗号分隔目标展开为稳定的发布顺序。
resolve_targets() {
  local target="${1:-all}"
  local pkg marker

  assert_publish_target "$target"
  if [[ "$target" == "all" ]]; then
    printf '%s\n' "${RELEASE_PACKAGES[@]}"
    return
  fi

  for pkg in "${RELEASE_PACKAGES[@]}"; do
    marker=",${pkg},"
    if [[ ",${target}," == *"$marker"* ]]; then
      printf '%s\n' "$pkg"
    fi
  done
}

# 用中文顿号拼接目标名，供日志展示。
target_summary() {
  local IFS="、"
  printf '%s' "$*"
}

# 仅改写 package.json 的版本字段，用于短暂的预发布版本窗口。
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

# 基于当前正式版本生成唯一的 npm prerelease 版本，避免覆盖已发布版本。
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

# 生成与 npm 包版本一一对应的 Git tag 名称。
release_tag_name() {
  local pkg="$1"
  local version

  version="$(package_json_value "$pkg" version)"
  printf '@schemx/%s@%s' "$pkg" "$version"
}

# 生成 GitHub Release 的标题。
release_title() {
  local pkg="$1"
  local version

  version="$(package_json_value "$pkg" version)"
  printf '@schemx/%s@%s' "$pkg" "$version"
}

# 优先使用显式环境变量，否则从 origin remote 规范化出 owner/repo。
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

# 将 registry URL 转为 npmrc 所需的 token 键名。
npm_registry_auth_key() {
  local registry="$1"

  registry="${registry#http://}"
  registry="${registry#https://}"
  registry="${registry%/}/"

  printf '//%s:_authToken' "$registry"
}

# NPM_TOKEN 存在时写入临时 npmrc，避免修改用户全局认证配置。
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
