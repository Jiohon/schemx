#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/release/common.sh"

PRERELEASE_BACKUP_DIR=""
PRERELEASE_TARGETS=()
LATEST_BACKUP_DIR=""
LATEST_TRANSACTION_FILES=()
PLANNED_PACKAGES=()
PLANNED_VERSIONS=()
PLANNED_CANDIDATES=()
# 选择器通过 stdout 返回结果，取消操作也需要一个可识别值，避免误当成包名继续发布。
RELEASE_CANCELLED_TARGET="__SCHEMX_RELEASE_CANCELLED__"

# 输出统一命令入口与参数约束，供帮助和错误分支复用。
usage() {
  cat <<'USAGE'
用法：
  pnpm release:check
  pnpm release:pack
  pnpm release:publish [dev|alpha|beta|rc|next|latest] [all|core[,vue,vant]] [current|patch|minor|major|x.y.z]

版本处理：
  patch - 提升 patch 版本，也就是 x.y.z 的 z 位
  minor - 提升 minor 版本，也就是 x.y.z 的 y 位
  major - 提升 major 版本，也就是 x.y.z 的 x 位

也可以直接调用：
  bash scripts/release/release.sh check
  bash scripts/release/release.sh pack [all|core[,vue,vant]]
  bash scripts/release/release.sh publish [dev|alpha|beta|rc|next|latest] [all|core[,vue,vant]] [current|patch|minor|major|x.y.z]
USAGE
}

SELECTED_CHANNEL=""
SELECTED_TARGET=""
SELECTED_VERSION_ACTION=""
SELECTED_RELEASE_OPTION=""

# 调用 Node 选择器，并通过全局变量返回结果，保持整个提示链路连接 TTY。
select_release_option() {
  local kind="$1"
  local channel="$2"
  local target="$3"
  local selected result_file
  shift 3
  SELECTED_RELEASE_OPTION=""

  # 不使用任何命令替换包裹本函数：否则 selector 会继承被捕获的 stdout，
  # Clack 将无法稳定显示当前焦点。结果改由临时文件返回。
  result_file="$(mktemp)"
  if ! node "$ROOT_DIR/scripts/select-release-option.mjs" \
    --kind "$kind" \
    --channel "$channel" \
    --target "$target" \
    --result-file "$result_file" \
    "$@"; then
    rm -f "$result_file"
    return 1
  fi
  IFS= read -r selected <"$result_file" || true
  rm -f "$result_file"

  SELECTED_RELEASE_OPTION="$selected"
}

# 解析显式或交互选择的发布通道。
select_release_channel() {
  local channel="${1:-}"

  if [[ -z "$channel" ]]; then
    select_release_option channel latest "" "${RELEASE_CHANNELS[@]}"
    channel="$SELECTED_RELEASE_OPTION"
  fi
  if [[ "$channel" == "$RELEASE_CANCELLED_TARGET" ]]; then
    exit 0
  fi

  assert_release_channel "$channel"
  SELECTED_CHANNEL="$channel"
}

# 解析显式或交互选择的一个或多个发布目标。
select_publish_target() {
  local target="${1:-}"
  local channel="${2:-latest}"

  if [[ -n "$target" ]]; then
    assert_publish_target "$target"
    SELECTED_TARGET="$target"
    return
  fi

  select_release_option target "$channel" "" all "${RELEASE_PACKAGES[@]}"
  SELECTED_TARGET="$SELECTED_RELEASE_OPTION"
  if [[ "$SELECTED_TARGET" == "$RELEASE_CANCELLED_TARGET" ]]; then
    exit 0
  fi
  assert_publish_target "$SELECTED_TARGET"
}

# 仅 latest 发布需要版本动作；custom 会继续读取精确版本号。
select_version_action() {
  local action="${1:-}"
  local channel="${2:-latest}"

  if [[ -z "$action" ]]; then
    select_release_option version-action "$channel" "$SELECTED_TARGET" current patch minor major custom
    action="$SELECTED_RELEASE_OPTION"
  fi
  if [[ "$action" == "$RELEASE_CANCELLED_TARGET" ]]; then
    exit 0
  fi

  if [[ "$action" == "custom" ]]; then
    select_release_option custom-version "$channel" "$SELECTED_TARGET"
    action="$SELECTED_RELEASE_OPTION"
  fi

  assert_version_action "$action"
  SELECTED_VERSION_ACTION="$action"
}

# 在执行任何写操作前展示最终发布计划，便于人工确认。
print_publish_selection_summary() {
  local targets=()

  targets=($(resolve_targets "$SELECTED_TARGET"))
  info "发布计划"
  release_kv "通道" "$SELECTED_CHANNEL - $(release_channel_label "$SELECTED_CHANNEL")"
  release_kv "说明" "$(release_channel_description "$SELECTED_CHANNEL")"
  release_kv "目标" "$(target_summary "${targets[@]}")"

  if [[ "$SELECTED_CHANNEL" == "latest" ]]; then
    release_kv "版本" "$SELECTED_VERSION_ACTION - $(version_action_label "$SELECTED_VERSION_ACTION")"
    return
  fi

  release_kv "tag" "$SELECTED_CHANNEL"
}

# 委托独立脚本校验正式发布分支。
assert_main_branch() {
  bash "$ROOT_DIR/scripts/release/assert-main-branch.sh"
}

# 委托独立脚本校验工作区无未提交改动。
assert_clean_git() {
  bash "$ROOT_DIR/scripts/release/assert-clean-git.sh"
}

# 预发布会临时改写 package.json，因此只要求这些目标文件事先干净。
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

# 在发布前确认 npm token 或交互登录可用。
assert_npm_auth() {
  bash "$ROOT_DIR/scripts/release/check-npm-auth.sh"
}

# 正式版创建 GitHub Release 前确认 gh 已认证。
assert_github_auth() {
  bash "$ROOT_DIR/scripts/release/check-github-auth.sh"
}

# 打印当前 registry 与发布 registry，便于发现错误配置。
assert_npm_registry() {
  bash "$ROOT_DIR/scripts/release/check-npm-registry.sh"
}

# 运行发布前质量门禁，可按目标缩小到依赖链。
run_quality_checks() {
  bash "$ROOT_DIR/scripts/release/run-quality-checks.sh" "$@"
}

# 对全部发布包执行 dry-run，检查实际会发布的文件。
pack_packages() {
  info "检查发布包内容"

  pack_target_packages "${RELEASE_PACKAGES[@]}"
}

# 对指定目标执行 dry-run，供单包发布复用。
pack_target_packages() {
  bash "$ROOT_DIR/scripts/release/pack-packages.sh" "$@"
}

# release:check 依次执行质量门禁和全量发布内容检查。
run_check() {
  run_quality_checks "${RELEASE_PACKAGES[@]}"
  pack_packages
}

# 生成可供本地安装验证的 tarball，不发布也不改版本。
run_pack() {
  local target="${1:-all}"
  local targets=()
  local pkg

  targets=($(resolve_targets "$target"))
  info "生成本地 tarball"

  # 每个目标单独 pack，方便定位和安装。
  for pkg in "${targets[@]}"; do
    mkdir -p "$ROOT_DIR/.packs"
    release_task "生成 @schemx/$pkg 本地 tarball" pnpm --filter "@schemx/$pkg" pack --pack-destination "$ROOT_DIR/.packs"
  done
}

# 发布一个已通过检查的包；预发布通道会传入 npm dist-tag。
publish_one() {
  local pkg="$1"
  local tag="${2:-}"
  assert_package "$pkg"

  bash "$ROOT_DIR/scripts/release/publish-package.sh" "$pkg" "$tag"
}

# 按固定顺序发布目标包；中途失败时明确报告不可回滚的部分发布结果。
publish_target_packages() {
  local tag="$1"
  local targets=()
  local published=()
  local remaining=()
  local index pkg published_text remaining_text
  shift
  targets=("$@")

  for index in "${!targets[@]}"; do
    pkg="${targets[$index]}"
    if publish_one "$pkg" "$tag"; then
      published+=("$pkg")
      continue
    fi

    remaining=("${targets[@]:$((index + 1))}")
    published_text="无"
    remaining_text="无"
    if [[ "${#published[@]}" -gt 0 ]]; then
      published_text="$(target_summary "${published[@]}")"
    fi
    if [[ "${#remaining[@]}" -gt 0 ]]; then
      remaining_text="$(target_summary "${remaining[@]}")"
    fi

    info "发布中断"
    warn "已发布：$published_text"
    warn "失败：$pkg"
    warn "未执行：$remaining_text"
    return 1
  done
}

# 避免 npm 上已有同版本时发布到流程末尾才失败。
check_target_versions_available() {
  bash "$ROOT_DIR/scripts/release/check-versions-available.sh" "$@"
}

# 只读取当前版本并生成一次性候选版本计划，不修改任何文件。
build_release_plan() {
  local channel="$1"
  local version_action="$2"
  local pkg current_version candidate_version
  shift 2

  PLANNED_PACKAGES=()
  PLANNED_VERSIONS=()
  PLANNED_CANDIDATES=()

  for pkg in "$@"; do
    current_version="$(package_json_value "$pkg" version)"
    if [[ "$channel" == "latest" ]]; then
      candidate_version="$(next_stable_version "$current_version" "$version_action")"
    else
      candidate_version="$(next_prerelease_version "$current_version" "$channel")"
    fi

    PLANNED_PACKAGES+=("$pkg")
    PLANNED_VERSIONS+=("$candidate_version")
    PLANNED_CANDIDATES+=("$pkg=$candidate_version")
  done
}

# 兼容“通道优先”和“目标优先”两种 CLI 写法，并归一化为全局选择结果。
resolve_publish_arguments() {
  local first="${1:-}"
  local second="${2:-}"
  local third="${3:-}"
  local target_arg=""
  local version_arg=""
  local selected_targets=()

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
    selected_targets=($(resolve_targets "$SELECTED_TARGET"))
    if is_exact_version "$SELECTED_VERSION_ACTION" && [[ "${#selected_targets[@]}" -ne 1 ]]; then
      die "指定版本只能用于单个发布目标，请选择 core、vue 或 vant。"
    fi
  elif [[ -n "$version_arg" ]]; then
    die "预发布不需要版本处理方式，请使用：pnpm release:publish $SELECTED_CHANNEL $SELECTED_TARGET"
  fi
}

# 根据单包或多包版本变更生成稳定的提交信息。
version_commit_message() {
  if [[ "$#" -eq 1 ]]; then
    printf 'chore(发布): 提升 %s 版本' "$1"
    return
  fi

  printf 'chore(发布): 提升 packages 版本'
}

# 为正式版本写入建立文件级事务，失败时可以恢复写入前状态。
begin_latest_version_transaction() {
  local index file

  LATEST_BACKUP_DIR="$(mktemp -d)"
  LATEST_TRANSACTION_FILES=("$@")

  for index in "${!LATEST_TRANSACTION_FILES[@]}"; do
    file="${LATEST_TRANSACTION_FILES[$index]}"
    cp "$file" "$LATEST_BACKUP_DIR/$index"
  done
}

# 清理正式版本事务的临时备份。
cleanup_latest_version_transaction() {
  if [[ -n "$LATEST_BACKUP_DIR" && -d "$LATEST_BACKUP_DIR" ]]; then
    rm -rf "$LATEST_BACKUP_DIR"
  fi

  LATEST_BACKUP_DIR=""
  LATEST_TRANSACTION_FILES=()
}

# 提交前任一步骤失败时恢复文件，并撤销可能已产生的暂存状态。
rollback_latest_version_transaction() {
  local index file backup

  if [[ -z "$LATEST_BACKUP_DIR" || ! -d "$LATEST_BACKUP_DIR" ]]; then
    return
  fi

  git restore --staged -- "${LATEST_TRANSACTION_FILES[@]}" >/dev/null 2>&1 || true
  for index in "${!LATEST_TRANSACTION_FILES[@]}"; do
    file="${LATEST_TRANSACTION_FILES[$index]}"
    backup="$LATEST_BACKUP_DIR/$index"
    if [[ -f "$backup" ]]; then
      cp "$backup" "$file"
    fi
  done

  cleanup_latest_version_transaction
}

# 对正式版执行版本升级、锁文件同步与提交，确保 npm/tag/Release 指向同一提交。
apply_latest_version_action() {
  local action="$1"
  local targets=()
  local files=()
  local index pkg candidate_version
  shift
  targets=("$@")

  if [[ "$action" == "current" ]]; then
    return
  fi

  if is_exact_version "$action" && [[ "${#targets[@]}" -ne 1 ]]; then
    die "指定版本只能用于单个发布目标，请选择 core、vue 或 vant。"
  fi

  for pkg in "${targets[@]}"; do
    files+=("$(package_path "$pkg")/package.json")
  done
  files+=("pnpm-lock.yaml")

  begin_latest_version_transaction "${files[@]}"
  trap rollback_latest_version_transaction EXIT

  # 使用预检阶段确定的候选版本，保证检查、写入与发布指向同一版本。
  info "提升正式版本：${action}（$(target_summary "${targets[@]}")）"
  for index in "${!targets[@]}"; do
    pkg="${targets[$index]}"
    candidate_version="${PLANNED_VERSIONS[$index]}"
    release_task "更新 @schemx/$pkg 版本" npm --prefix "$(package_path "$pkg")" version "$candidate_version" --no-git-tag-version
  done

  info "同步 pnpm-lock.yaml"
  release_task "同步 pnpm-lock.yaml" pnpm install --lockfile-only

  info "提交版本变更"
  release_task "暂存版本变更" git add "${files[@]}"
  release_task "提交版本变更" git commit -m "$(version_commit_message "${targets[@]}")"
  trap - EXIT
  cleanup_latest_version_transaction
  assert_clean_git
}

# 生成真实可发布的临时 prerelease 版本，并备份原始 package.json。
prepare_prerelease_versions() {
  local channel="$1"
  local index pkg pkg_json current_version next_version

  PRERELEASE_BACKUP_DIR="$(mktemp -d)"
  PRERELEASE_TARGETS=("${PLANNED_PACKAGES[@]}")

  # 预发布需要真实 npm semver，但不应把临时版本写回开发分支。
  info "生成临时 ${channel} 预发布版本"
  for index in "${!PRERELEASE_TARGETS[@]}"; do
    pkg="${PRERELEASE_TARGETS[$index]}"
    pkg_json="$(package_path "$pkg")/package.json"
    cp "$pkg_json" "$PRERELEASE_BACKUP_DIR/$pkg.json"

    current_version="$(package_json_value "$pkg" version)"
    next_version="${PLANNED_VERSIONS[$index]}"
    set_package_version "$pkg_json" "$next_version"

    printf '@schemx/%s: %s → %s\n' "$pkg" "$current_version" "$next_version"
  done
}

# 从备份恢复开发版本；可安全重复调用，供 EXIT trap 兜底。
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

# 正式发布必须在 main 且工作区干净，发布后创建 tag 和 GitHub Release。
run_latest_publish() {
  local target="$1"
  local version_action="$2"
  local targets=()

  assert_main_branch
  assert_clean_git
  assert_npm_registry
  assert_npm_auth
  assert_github_auth

  # 检查、构建、dry-run、npm 发布的目标集合必须完全一致。
  targets=($(resolve_targets "$target"))
  build_release_plan latest "$version_action" "${targets[@]}"
  check_target_versions_available "${PLANNED_CANDIDATES[@]}"
  bash "$ROOT_DIR/scripts/release/check-release-markers-available.sh" "${PLANNED_CANDIDATES[@]}"
  run_quality_checks "${targets[@]}"
  pack_target_packages "${targets[@]}"
  apply_latest_version_action "$version_action" "${targets[@]}"

  publish_target_packages "" "${targets[@]}"

  bash "$ROOT_DIR/scripts/release/create-release-tag.sh" "${targets[@]}"
  bash "$ROOT_DIR/scripts/release/create-github-release.sh" "${targets[@]}"
}

# 预发布不提交版本变更，只在发布窗口内使用临时版本并通过 trap 恢复。
run_prerelease_publish() {
  local channel="$1"
  local target="$2"
  local targets=()

  assert_release_channel "$channel"
  targets=($(resolve_targets "$target"))
  assert_prerelease_version_files_clean "${targets[@]}"

  assert_npm_registry
  assert_npm_auth
  build_release_plan "$channel" current "${targets[@]}"
  check_target_versions_available "${PLANNED_CANDIDATES[@]}"
  run_quality_checks "${targets[@]}"
  pack_target_packages "${targets[@]}"

  prepare_prerelease_versions "$channel"
  trap restore_prerelease_versions EXIT

  publish_target_packages "$channel" "${targets[@]}"

  restore_prerelease_versions
  trap - EXIT
}

# 根据已解析通道分派到正式版或预发布流程。
run_publish() {
  resolve_publish_arguments "$@"
  print_publish_selection_summary

  if [[ "$SELECTED_CHANNEL" == "latest" ]]; then
    run_latest_publish "$SELECTED_TARGET" "$SELECTED_VERSION_ACTION"
    return
  fi

  run_prerelease_publish "$SELECTED_CHANNEL" "$SELECTED_TARGET"
}

# 作为唯一 CLI 入口，保持 check、pack、publish 的参数分派集中。
main() {
  local command="${1:-}"

  release_ui intro "Schemx Release"

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

  release_ui outro "发布流程完成"
}

main "$@"
