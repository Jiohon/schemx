#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/release/common.sh"

PRERELEASE_BACKUP_DIR=""
PRERELEASE_TARGETS=()
# 选择器通过 stdout 返回结果，取消操作也需要一个可识别值，避免误当成包名继续发布。
RELEASE_CANCELLED_TARGET="__SCHEMX_RELEASE_CANCELLED__"

usage() {
  cat <<'USAGE'
用法：
  pnpm release:check
  pnpm release:pack
  pnpm release:publish [dev|alpha|beta|rc|next|latest] [all|core|vue|vant] [current|patch|minor|major|x.y.z]

版本处理：
  patch - 提升 patch 版本，也就是 x.y.z 的 z 位
  minor - 提升 minor 版本，也就是 x.y.z 的 y 位
  major - 提升 major 版本，也就是 x.y.z 的 x 位

也可以直接调用：
  bash scripts/release.sh check
  bash scripts/release.sh pack [all|core|vue|vant]
  bash scripts/release.sh publish [dev|alpha|beta|rc|next|latest] [all|core|vue|vant] [current|patch|minor|major|x.y.z]
USAGE
}

SELECTED_CHANNEL=""
SELECTED_TARGET=""
SELECTED_VERSION_ACTION=""

select_release_option() {
  local kind="$1"
  local channel="$2"
  local target="$3"
  local selected
  shift 3

  selected="$(node "$ROOT_DIR/scripts/select-release-option.mjs" --kind "$kind" --channel "$channel" --target "$target" "$@")"
  if [[ "$selected" == "$RELEASE_CANCELLED_TARGET" ]]; then
    printf '%s' "$selected"
    return 0
  fi

  printf '%s' "$selected"
}

select_release_channel() {
  local channel="${1:-}"

  if [[ -z "$channel" ]]; then
    channel="$(select_release_option channel latest "" "${RELEASE_CHANNELS[@]}")"
  fi
  if [[ "$channel" == "$RELEASE_CANCELLED_TARGET" ]]; then
    exit 0
  fi

  assert_release_channel "$channel"
  SELECTED_CHANNEL="$channel"
}

select_publish_target() {
  local target="${1:-}"
  local channel="${2:-latest}"

  if [[ -n "$target" ]]; then
    assert_publish_target "$target"
    SELECTED_TARGET="$target"
    return
  fi

  SELECTED_TARGET="$(select_release_option target "$channel" "" all "${RELEASE_PACKAGES[@]}")"
  if [[ "$SELECTED_TARGET" == "$RELEASE_CANCELLED_TARGET" ]]; then
    exit 0
  fi
  assert_publish_target "$SELECTED_TARGET"
}

prompt_custom_version() {
  local version

  if [[ ! -t 0 || ! -t 2 ]]; then
    die "当前终端不支持输入指定版本。请传入 x.y.z，例如：pnpm release:publish latest vue 0.1.21。"
  fi

  printf '请输入正式版本号（x.y.z）：' >&2
  read -r version

  if ! is_exact_version "$version"; then
    die "版本号必须是 x.y.z 格式。"
  fi

  printf '%s' "$version"
}

select_version_action() {
  local action="${1:-}"
  local channel="${2:-latest}"

  if [[ -z "$action" ]]; then
    action="$(select_release_option version-action "$channel" "$SELECTED_TARGET" current patch minor major custom)"
  fi
  if [[ "$action" == "$RELEASE_CANCELLED_TARGET" ]]; then
    exit 0
  fi

  if [[ "$action" == "custom" ]]; then
    action="$(prompt_custom_version)"
  fi

  assert_version_action "$action"
  SELECTED_VERSION_ACTION="$action"
}

print_publish_selection_summary() {
  info "发布计划"
  release_kv "通道" "$SELECTED_CHANNEL - $(release_channel_label "$SELECTED_CHANNEL")"
  release_kv "说明" "$(release_channel_description "$SELECTED_CHANNEL")"
  release_kv "目标" "$SELECTED_TARGET"

  if [[ "$SELECTED_CHANNEL" == "latest" ]]; then
    release_kv "版本" "$SELECTED_VERSION_ACTION - $(version_action_label "$SELECTED_VERSION_ACTION")"
    return
  fi

  release_kv "tag" "$SELECTED_CHANNEL"
}

assert_main_branch() {
  bash "$ROOT_DIR/scripts/release/assert-main-branch.sh"
}

assert_clean_git() {
  bash "$ROOT_DIR/scripts/release/assert-clean-git.sh"
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

assert_github_auth() {
  bash "$ROOT_DIR/scripts/release/check-github-auth.sh"
}

assert_npm_registry() {
  bash "$ROOT_DIR/scripts/release/check-npm-registry.sh"
}

run_quality_checks() {
  bash "$ROOT_DIR/scripts/release/run-quality-checks.sh" "$@"
}

pack_packages() {
  info "检查发布包内容"

  pack_target_packages "${RELEASE_PACKAGES[@]}"
}

pack_target_packages() {
  bash "$ROOT_DIR/scripts/release/pack-packages.sh" "$@"
}

run_check() {
  run_quality_checks
  pack_packages
}

run_pack() {
  local target="${1:-all}"
  local targets=()
  local pkg

  targets=($(resolve_targets "$target"))
  info "生成本地 tarball"

  for pkg in "${targets[@]}"; do
    pnpm --filter "@schemx/$pkg" pack --pack-destination "$ROOT_DIR"
  done
}

publish_one() {
  local pkg="$1"
  local tag="${2:-}"
  assert_package "$pkg"

  bash "$ROOT_DIR/scripts/release/publish-package.sh" "$pkg" "$tag"
}

check_target_versions_available() {
  bash "$ROOT_DIR/scripts/release/check-versions-available.sh" "$@"
}

resolve_publish_arguments() {
  local first="${1:-}"
  local second="${2:-}"
  local third="${3:-}"
  local target_arg=""
  local version_arg=""

  SELECTED_CHANNEL=""
  SELECTED_TARGET=""
  SELECTED_VERSION_ACTION=""

  if [[ -z "$first" ]]; then
    select_release_channel
  elif is_release_channel "$first"; then
    select_release_channel "$first"
    target_arg="$second"
    version_arg="$third"
  elif is_publish_target "$first"; then
    select_release_channel latest
    target_arg="$first"
    version_arg="$second"
  else
    die "未知发布模式或目标：$first"
  fi

  select_publish_target "$target_arg" "$SELECTED_CHANNEL"

  if [[ "$SELECTED_CHANNEL" == "latest" ]]; then
    select_version_action "$version_arg" "$SELECTED_CHANNEL"
    if is_exact_version "$SELECTED_VERSION_ACTION" && [[ "$SELECTED_TARGET" == "all" ]]; then
      die "指定版本只能用于单个发布目标，请选择 core、vue 或 vant。"
    fi
  elif [[ -n "$version_arg" ]]; then
    die "预发布不需要版本处理方式，请使用：pnpm release:publish $SELECTED_CHANNEL $SELECTED_TARGET"
  fi
}

version_commit_message() {
  if [[ "$#" -eq 1 ]]; then
    printf 'chore(发布): 提升 %s 版本' "$1"
    return
  fi

  printf 'chore(发布): 提升 packages 版本'
}

apply_latest_version_action() {
  local action="$1"
  local targets=()
  local files=()
  local pkg
  shift
  targets=("$@")

  if [[ "$action" == "current" ]]; then
    return
  fi

  if is_exact_version "$action" && [[ "${#targets[@]}" -ne 1 ]]; then
    die "指定版本只能用于单个发布目标，请选择 core、vue 或 vant。"
  fi

  # 融合发布流程时，正式版本变更必须先自动提交，保证 npm、Git tag 和 GitHub Release 指向同一个版本提交。
  info "提升正式版本：${action}（$(target_summary "${targets[@]}")）"
  for pkg in "${targets[@]}"; do
    npm --prefix "$(package_path "$pkg")" version "$action" --no-git-tag-version
    files+=("$(package_path "$pkg")/package.json")
  done

  info "同步 pnpm-lock.yaml"
  pnpm install --lockfile-only
  files+=("pnpm-lock.yaml")

  info "提交版本变更"
  git add "${files[@]}"
  git commit -m "$(version_commit_message "${targets[@]}")"
  assert_clean_git
}

prepare_prerelease_versions() {
  local channel="$1"
  local pkg pkg_json current_version next_version
  shift

  PRERELEASE_BACKUP_DIR="$(mktemp -d)"
  PRERELEASE_TARGETS=("$@")

  # 预发布需要真实 npm semver，但不应把临时版本写回开发分支。
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

run_latest_publish() {
  local target="$1"
  local version_action="$2"
  local targets=()
  local pkg

  assert_main_branch
  assert_clean_git
  assert_npm_registry
  assert_npm_auth
  assert_github_auth

  targets=($(resolve_targets "$target"))
  apply_latest_version_action "$version_action" "${targets[@]}"
  check_target_versions_available "${targets[@]}"
  run_quality_checks "${targets[@]}"
  pack_target_packages "${targets[@]}"

  for pkg in "${targets[@]}"; do
    publish_one "$pkg"
  done

  bash "$ROOT_DIR/scripts/release/create-release-tag.sh" "${targets[@]}"
  bash "$ROOT_DIR/scripts/release/create-github-release.sh" "${targets[@]}"
}

run_prerelease_publish() {
  local channel="$1"
  local target="$2"
  local targets=()
  local pkg

  assert_release_channel "$channel"
  targets=($(resolve_targets "$target"))
  assert_prerelease_version_files_clean "${targets[@]}"

  prepare_prerelease_versions "$channel" "${targets[@]}"
  trap restore_prerelease_versions EXIT

  assert_npm_registry
  assert_npm_auth
  check_target_versions_available "${targets[@]}"
  run_quality_checks "${targets[@]}"
  pack_target_packages "${targets[@]}"

  for pkg in "${targets[@]}"; do
    publish_one "$pkg" "$channel"
  done

  restore_prerelease_versions
  trap - EXIT
}

run_publish() {
  resolve_publish_arguments "$@"
  print_publish_selection_summary

  if [[ "$SELECTED_CHANNEL" == "latest" ]]; then
    run_latest_publish "$SELECTED_TARGET" "$SELECTED_VERSION_ACTION"
    return
  fi

  run_prerelease_publish "$SELECTED_CHANNEL" "$SELECTED_TARGET"
}

main() {
  local command="${1:-}"

  case "$command" in
    check)
      run_check
      ;;
    pack)
      run_pack "${2:-all}"
      ;;
    publish)
      shift
      run_publish "$@"
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
