#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
MOCK_BIN="$TMP_DIR/bin"
COMMAND_LOG="$TMP_DIR/commands.log"

mkdir -p "$MOCK_BIN"
touch "$COMMAND_LOG"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

cat >"$MOCK_BIN/git" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail

printf 'git %s\n' "$*" >>"${COMMAND_LOG:?}"

case "$1" in
  branch)
    if [[ "${2:-}" == "--show-current" ]]; then
      printf '%s\n' "${MOCK_BRANCH:-main}"
      exit 0
    fi
    ;;
  status)
    exit 0
    ;;
  rev-parse)
    if [[ "${2:-}" == "--short" ]]; then
      printf 'abc1234\n'
      exit 0
    fi
    ;;
  config)
    if [[ "${2:-}" == "--get" && "${3:-}" == "remote.origin.url" ]]; then
      printf 'git@github.com:Jiohon/schemx.git\n'
      exit 0
    fi
    ;;
  tag)
    if [[ "${2:-}" == "--sort=-creatordate" ]]; then
      printf '@schemx/core@0.1.22\n'
      printf '@schemx/vue@0.1.19\n'
      printf '@schemx/vant@0.1.9\n'
      exit 0
    fi
    exit 0
    ;;
  add)
    exit 0
    ;;
  commit)
    exit 0
    ;;
  log)
    if [[ "$*" == *"--format=%s"* ]]; then
      printf 'feat(core): 支持动态 schema 更新\n'
      printf 'fix(vue): 修复 renderer 字段值同步链路\n'
      printf 'chore(发布): 优化发布流程\n'
      exit 0
    fi
    ;;
  push)
    exit 0
    ;;
esac

printf 'unexpected git command: %s\n' "$*" >&2
exit 1
MOCK

cat >"$MOCK_BIN/pnpm" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail

printf 'pnpm %s\n' "$*" >>"${COMMAND_LOG:?}"

case "$1" in
  config)
    printf 'https://registry.npmjs.org/\n'
    ;;
  whoami)
    if [[ "${MOCK_NPM_AUTH_FAIL:-0}" == "1" && -z "${NPM_CONFIG_USERCONFIG:-}" ]]; then
      printf 'npm whoami failed\n' >&2
      exit 1
    fi
    printf 'mock-user\n'
    ;;
  view)
    if [[ -n "${MOCK_PNPM_VIEW_EXISTS:-}" && "$*" == *"${MOCK_PNPM_VIEW_EXISTS}"* ]]; then
      printf '0.0.0\n'
      exit 0
    fi
    exit 1
    ;;
  *)
    ;;
esac
MOCK

cat >"$MOCK_BIN/npm" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail

printf 'npm %s\n' "$*" >>"${COMMAND_LOG:?}"
MOCK

cat >"$MOCK_BIN/gh" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail

printf 'gh %s\n' "$*" >>"${COMMAND_LOG:?}"

case "$1" in
  auth)
    if [[ "${2:-}" == "status" ]]; then
      if [[ "${MOCK_GITHUB_AUTH_FAIL:-0}" == "1" ]]; then
        printf 'gh auth failed\n' >&2
        exit 1
      fi
      exit 0
    fi
    ;;
  release)
    if [[ "${2:-}" == "create" ]]; then
      tag_name="${3:-}"
      pkg="${tag_name#@schemx/}"
      pkg="${pkg%%@*}"
      version="${tag_name#@schemx/${pkg}@}"
      notes_file=""

      while [[ "$#" -gt 0 ]]; do
        if [[ "$1" == "--notes-file" ]]; then
          notes_file="${2:-}"
          break
        fi
        shift
      done

      if [[ -z "$notes_file" || ! -f "$notes_file" ]]; then
        printf 'missing release notes file\n' >&2
        exit 1
      fi

      grep -Fq "## @schemx/${pkg}@${version}" "$notes_file"
      grep -Fq "@schemx/${pkg}@${version}" "$notes_file"
      grep -Fq 'feat(core): 支持动态 schema 更新' "$notes_file"
      exit 0
    fi
    ;;
esac

printf 'unexpected gh command: %s\n' "$*" >&2
exit 1
MOCK

cat >"$MOCK_BIN/node" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${MOCK_RELEASE_CANCEL:-0}" == "1" && "${1:-}" == */select-release-option.mjs ]]; then
  printf '已取消选择\n' >&2
  printf '__SCHEMX_RELEASE_CANCELLED__\n'
  exit 0
fi

exec "${REAL_NODE:?}" "$@"
MOCK

chmod +x "$MOCK_BIN/git" "$MOCK_BIN/pnpm" "$MOCK_BIN/npm" "$MOCK_BIN/gh" "$MOCK_BIN/node"

export REAL_NODE="$(command -v node)"
export PATH="$MOCK_BIN:$PATH"
export COMMAND_LOG

run_release() {
  bash "$ROOT_DIR/scripts/release.sh" "$@"
}

assert_contains() {
  local haystack="$1"
  local needle="$2"

  if [[ "$haystack" != *"$needle"* ]]; then
    printf '期望输出包含：%s\n实际输出：\n%s\n' "$needle" "$haystack" >&2
    exit 1
  fi
}

assert_not_contains() {
  local haystack="$1"
  local needle="$2"

  if [[ "$haystack" == *"$needle"* ]]; then
    printf '期望输出不包含：%s\n实际输出：\n%s\n' "$needle" "$haystack" >&2
    exit 1
  fi
}

assert_occurrences() {
  local haystack="$1"
  local needle="$2"
  local expected="$3"
  local actual

  actual="$(printf '%s' "$haystack" | grep -Fo -- "$needle" | wc -l | tr -d ' ')"

  if [[ "$actual" != "$expected" ]]; then
    printf '期望输出中 %s 出现 %s 次，实际出现 %s 次。\n实际输出：\n%s\n' "$needle" "$expected" "$actual" "$haystack" >&2
    exit 1
  fi
}

assert_log_contains() {
  local needle="$1"

  if ! grep -Fq -- "$needle" "$COMMAND_LOG"; then
    printf '期望命令日志包含：%s\n实际日志：\n' "$needle" >&2
    cat "$COMMAND_LOG" >&2
    exit 1
  fi
}

assert_log_not_contains() {
  local needle="$1"

  if grep -Fq -- "$needle" "$COMMAND_LOG"; then
    printf '期望命令日志不包含：%s\n实际日志：\n' "$needle" >&2
    cat "$COMMAND_LOG" >&2
    exit 1
  fi
}

test_help_lists_channel_commands_without_package_shortcuts() {
  local output
  output="$(run_release help)"

  assert_contains "$output" "pnpm release:publish [dev|alpha|beta|rc|next|latest] [all|core|vue|vant] [current|patch|minor|major|x.y.z]"
  assert_not_contains "$output" "pnpm release:publish:alpha"
  assert_not_contains "$output" "pnpm release:version:patch"
  assert_not_contains "$output" "bash scripts/release.sh publish-alpha"
  assert_not_contains "$output" "bash scripts/release.sh version"
}

test_package_scripts_keep_single_publish_entry() {
  local scripts
  scripts="$(node -e "
const pkg = require('$ROOT_DIR/package.json');
console.log(Object.keys(pkg.scripts).filter((name) => name.startsWith('release:')).join('\n'));
")"

  assert_contains "$scripts" "release:publish"
  assert_not_contains "$scripts" "release:publish:"
  assert_not_contains "$scripts" "release:version:"
}

test_release_channel_choices_put_latest_last() {
  local output

  output="$(bash -c "source '$ROOT_DIR/scripts/release/common.sh'; release_channel_choices")"

  if [[ "$output" != "dev、alpha、beta、rc、next、latest" ]]; then
    printf '发布通道选项应把 latest 放在最后。\n实际输出：%s\n' "$output" >&2
    exit 1
  fi
}

test_release_test_runs_only_release_script_tests() {
  local script
  script="$(node -p "require('$ROOT_DIR/package.json').scripts['release:test']")"

  if [[ "$script" != "bash scripts/release.test.sh" ]]; then
    printf 'release:test 应只运行 release.test.sh。\n实际脚本：%s\n' "$script" >&2
    exit 1
  fi
}

test_dev_publish_uses_dev_tag_and_restores_version() {
  local before after output

  before="$(node -p "require('$ROOT_DIR/packages/core/package.json').version")"
  : >"$COMMAND_LOG"

  export MOCK_BRANCH="feature/demo"
  output="$(run_release publish dev core)"
  unset MOCK_BRANCH

  after="$(node -p "require('$ROOT_DIR/packages/core/package.json').version")"

  if [[ "$before" != "$after" ]]; then
    printf 'dev 发布后应恢复 package.json 版本：%s != %s\n' "$before" "$after" >&2
    exit 1
  fi

  assert_contains "$output" "发布计划"
  assert_contains "$output" "通道    dev - Dev 开发测试发布"
  assert_contains "$output" "目标    core"
  assert_contains "$output" "tag     dev"
  assert_not_contains "$output" "发布模式：dev"
  assert_log_contains "pnpm --dir packages/core publish --access public --registry https://registry.npmjs.org/ --tag dev --no-git-checks"
  assert_log_not_contains "gh auth status"
  assert_log_not_contains "gh release create"
  assert_log_not_contains "git tag"
  assert_log_not_contains "git push"
}

test_latest_publish_is_main_only() {
  local output status

  export MOCK_BRANCH="feature/demo"
  set +e
  output="$(run_release publish latest core current 2>&1)"
  status=$?
  set -e
  unset MOCK_BRANCH

  if [[ "$status" -eq 0 ]]; then
    printf '非 main 分支正式发布应失败。\n' >&2
    exit 1
  fi

  assert_contains "$output" "正式发布只能在 main 分支执行"
}

test_publish_without_npm_auth_shows_clear_message() {
  local output status

  export MOCK_NPM_AUTH_FAIL=1
  set +e
  output="$(run_release publish latest core current 2>&1)"
  status=$?
  set -e
  unset MOCK_NPM_AUTH_FAIL

  if [[ "$status" -eq 0 ]]; then
    printf '未登录 npm 时，发布应失败。\n' >&2
    exit 1
  fi

  assert_contains "$output" "检查 npm 登录状态"
  assert_contains "$output" "npm 未登录或当前 registry 无权限"
  assert_contains "$output" "设置 NPM_TOKEN 后重新执行发布命令"
  assert_contains "$output" "pnpm login --registry \"https://registry.npmjs.org/\""
  assert_contains "$output" "完成浏览器确认后，请回到终端等待命令继续"
  assert_not_contains "$output" "ELIFECYCLE"
}

test_publish_accepts_npm_token_auth() {
  local output status

  export MOCK_NPM_AUTH_FAIL=1
  export NPM_TOKEN=mock-token
  set +e
  output="$(run_release publish alpha core 2>&1)"
  status=$?
  set -e
  unset MOCK_NPM_AUTH_FAIL
  unset NPM_TOKEN

  if [[ "$status" -ne 0 ]]; then
    printf '设置 NPM_TOKEN 后，npm auth 检查应通过。\n%s\n' "$output" >&2
    exit 1
  fi

  assert_contains "$output" "检查 npm 登录状态"
  assert_not_contains "$output" "npm 未登录或当前 registry 无权限"
  assert_log_contains "pnpm --dir packages/core publish --access public --registry https://registry.npmjs.org/ --tag alpha --no-git-checks"
}

test_publish_without_github_auth_stops_before_publish() {
  local output status

  : >"$COMMAND_LOG"

  export MOCK_GITHUB_AUTH_FAIL=1
  set +e
  output="$(run_release publish latest core current 2>&1)"
  status=$?
  set -e
  unset MOCK_GITHUB_AUTH_FAIL

  if [[ "$status" -eq 0 ]]; then
    printf 'GitHub CLI 未登录时，正式发布应失败。\n' >&2
    exit 1
  fi

  assert_contains "$output" "检查 GitHub CLI 登录状态"
  assert_contains "$output" "GitHub CLI 未登录或无权限"
  assert_log_contains "gh auth status"
  assert_log_not_contains "pnpm --dir packages/core publish"
}

test_publish_existing_version_suggests_release_version() {
  local output status

  export MOCK_PNPM_VIEW_EXISTS="@schemx/vue@"
  set +e
  output="$(run_release publish latest vue current 2>&1)"
  status=$?
  set -e
  unset MOCK_PNPM_VIEW_EXISTS

  if [[ "$status" -eq 0 ]]; then
    printf '已存在的正式版本应阻止发布。\n' >&2
    exit 1
  fi

  assert_contains "$output" "@schemx/vue@"
  assert_contains "$output" "已存在"
  assert_contains "$output" "pnpm release:publish latest vue patch"
  assert_log_not_contains "pnpm --dir packages/vue publish"
}

test_alpha_publish_uses_alpha_tag_and_restores_version() {
  local before after

  before="$(node -p "require('$ROOT_DIR/packages/core/package.json').version")"
  : >"$COMMAND_LOG"

  export MOCK_BRANCH="feature/demo"
  output="$(run_release publish alpha core)"
  unset MOCK_BRANCH

  after="$(node -p "require('$ROOT_DIR/packages/core/package.json').version")"

  if [[ "$before" != "$after" ]]; then
    printf 'alpha 发布后应恢复 package.json 版本：%s != %s\n' "$before" "$after" >&2
    exit 1
  fi

  assert_contains "$output" "发布计划"
  assert_contains "$output" "通道    alpha - Alpha 预发布"
  assert_contains "$output" "目标    core"
  assert_contains "$output" "tag     alpha"
  assert_not_contains "$output" "发布模式：alpha"
  assert_contains "$output" "registry  https://registry.npmjs.org/"
  assert_contains "$output" "tag       alpha"
  assert_contains "$output" "终端可能会停在认证提示处"
  assert_contains "$output" "完成后回到这里等待发布继续"
  assert_log_contains "pnpm --dir packages/core publish --access public --registry https://registry.npmjs.org/ --tag alpha --no-git-checks"
  assert_log_not_contains "gh auth status"
  assert_log_not_contains "gh release create"
  assert_log_not_contains "git tag"
  assert_log_not_contains "git push"
}

test_pack_accepts_target() {
  : >"$COMMAND_LOG"

  run_release pack vant >/dev/null

  assert_log_contains "pnpm --filter @schemx/vant pack --pack-destination $ROOT_DIR"
  assert_log_not_contains "pnpm --filter @schemx/core pack --pack-destination $ROOT_DIR"
  assert_log_not_contains "pnpm --filter @schemx/vue pack --pack-destination $ROOT_DIR"
}

test_latest_publish_patch_bumps_commits_and_publishes_target() {
  : >"$COMMAND_LOG"

  run_release publish latest vue patch >/dev/null

  assert_log_contains "npm --prefix packages/vue version patch --no-git-tag-version"
  assert_log_not_contains "npm --prefix packages/core version patch --no-git-tag-version"
  assert_log_not_contains "npm --prefix packages/vant version patch --no-git-tag-version"
  assert_log_contains "pnpm install --lockfile-only"
  assert_log_contains "git add packages/vue/package.json pnpm-lock.yaml"
  assert_log_contains "git commit -m chore(发布): 提升 vue 版本"
  assert_log_contains "pnpm --dir packages/vue publish --access public --registry https://registry.npmjs.org/"
}

test_latest_publish_patch_all_bumps_and_commits_all_packages() {
  : >"$COMMAND_LOG"

  run_release publish latest all patch >/dev/null

  assert_log_contains "npm --prefix packages/core version patch --no-git-tag-version"
  assert_log_contains "npm --prefix packages/vue version patch --no-git-tag-version"
  assert_log_contains "npm --prefix packages/vant version patch --no-git-tag-version"
  assert_log_contains "pnpm install --lockfile-only"
  assert_log_contains "git add packages/core/package.json packages/vue/package.json packages/vant/package.json pnpm-lock.yaml"
  assert_log_contains "git commit -m chore(发布): 提升 packages 版本"
}

test_latest_publish_explicit_version_requires_single_target() {
  local output status

  set +e
  output="$(run_release publish latest all 1.2.3 2>&1)"
  status=$?
  set -e

  if [[ "$status" -eq 0 ]]; then
    printf '指定精确版本发布 all 应失败，避免把不同包强行设成同一版本。\n' >&2
    exit 1
  fi

  assert_contains "$output" "指定版本只能用于单个发布目标"
  assert_log_not_contains "npm --prefix packages/core version 1.2.3 --no-git-tag-version"
}

test_publish_checks_only_target_dependency_chain() {
  local output

  : >"$COMMAND_LOG"

  export MOCK_BRANCH="feature/demo"
  output="$(run_release publish alpha vant)"
  unset MOCK_BRANCH

  assert_contains "$output" "运行目标依赖链测试：vant"
  assert_contains "$output" "运行目标依赖链 lint：vant"
  assert_contains "$output" "构建目标依赖链发布产物：vant"
  assert_log_contains "pnpm --filter @schemx/vant... test"
  assert_log_contains "pnpm --filter @schemx/vant... lint"
  assert_log_contains "pnpm --filter @schemx/vant... build"
  assert_log_not_contains "pnpm test"
  assert_log_not_contains "pnpm lint"
  assert_log_not_contains "pnpm build"
  assert_log_contains "pnpm --dir packages/vant publish --access public --registry https://registry.npmjs.org/ --tag alpha --no-git-checks"
}

test_release_output_uses_colors_when_forced() {
  local output error_output status
  local cyan green yellow red bold

  cyan=$'\033[36m'
  green=$'\033[32m'
  yellow=$'\033[33m'
  red=$'\033[31m'
  bold=$'\033[1m'

  : >"$COMMAND_LOG"

  export MOCK_BRANCH="feature/demo"
  unset NO_COLOR
  export FORCE_COLOR=1
  output="$(run_release publish alpha core 2>&1)"
  unset FORCE_COLOR
  unset MOCK_BRANCH

  assert_contains "$output" "${cyan}${bold}◆ 发布计划"
  assert_contains "$output" "${cyan}${bold}◆ 发布 @schemx/core"
  assert_contains "$output" "${green}✓ @schemx/core@"
  assert_contains "$output" "可发布"
  assert_contains "$output" "${yellow}! 如果 npm 要求网页登录、二维码确认或 OTP"

  export MOCK_BRANCH="feature/demo"
  unset NO_COLOR
  export FORCE_COLOR=1
  set +e
  error_output="$(run_release publish latest core current 2>&1)"
  status=$?
  set -e
  unset FORCE_COLOR
  unset MOCK_BRANCH

  if [[ "$status" -eq 0 ]]; then
    printf '非 main 分支正式发布应失败。\n' >&2
    exit 1
  fi

  assert_contains "$error_output" "${red}✖ 错误：正式发布只能在 main 分支执行。当前分支：feature/demo"
}

test_release_output_omits_colors_without_tty() {
  local output

  : >"$COMMAND_LOG"

  export MOCK_BRANCH="feature/demo"
  export NO_COLOR=1
  export FORCE_COLOR=1
  output="$(run_release publish alpha core 2>&1)"
  unset NO_COLOR
  unset FORCE_COLOR
  unset MOCK_BRANCH

  assert_not_contains "$output" $'\033['
}

test_publish_without_args_uses_channel_target_and_version_env_selection() {
  local output

  : >"$COMMAND_LOG"

  output="$(SCHEMX_RELEASE_CHANNEL=latest SCHEMX_RELEASE_TARGET=core SCHEMX_RELEASE_VERSION_ACTION=current run_release publish)"

  assert_contains "$output" "发布计划"
  assert_contains "$output" "目标    core"
  assert_contains "$output" "通道    latest - 正式版发布"
  assert_contains "$output" "说明    发布到 npm latest，仅允许 main 分支。"
  assert_contains "$output" "版本    current - 使用当前版本"
  assert_occurrences "$output" "发布计划" 1
  assert_not_contains "$output" "==> 已选择"
  assert_not_contains "$output" "==> 本次发布选择"
  assert_not_contains "$output" "发布信息"
  assert_not_contains "$output" "----------------------------------------"
  assert_not_contains "$output" "发布模式：latest"
  assert_not_contains "$output" "输入序号或名称"
  assert_log_contains "pnpm --dir packages/core publish --access public --registry https://registry.npmjs.org/"
  assert_log_not_contains "pnpm --dir packages/vue publish"
}

test_selector_does_not_print_confirmation_line_after_enter() {
  local output status

  if ! command -v script >/dev/null 2>&1; then
    return
  fi

  set +e
  output="$(printf '\r' | script -q /dev/null node "$ROOT_DIR/scripts/select-release-option.mjs" --kind target --channel alpha all core 2>&1)"
  status=$?
  set -e

  if [[ "$status" -ne 0 ]]; then
    return
  fi

  assert_contains "$output" "all"
  assert_not_contains "$output" "请选择发布目标：all"
}

test_latest_publish_tags_and_pushes_after_publish() {
  local version

  version="$(node -p "require('$ROOT_DIR/packages/core/package.json').version")"
  : >"$COMMAND_LOG"

  run_release publish latest core current

  assert_log_contains "pnpm --dir packages/core publish --access public --registry https://registry.npmjs.org/"
  assert_log_contains "git tag -a @schemx/core@${version} -m release: @schemx/core@${version}"
  assert_log_contains "git push origin main"
  assert_log_contains "git push origin @schemx/core@${version}"
  assert_log_contains "gh auth status"
  assert_log_contains "gh release create @schemx/core@${version} --repo Jiohon/schemx --title @schemx/core@${version} --notes-file"
}

test_latest_publish_all_creates_package_scoped_tags_and_releases() {
  local core_version vue_version vant_version

  core_version="$(node -p "require('$ROOT_DIR/packages/core/package.json').version")"
  vue_version="$(node -p "require('$ROOT_DIR/packages/vue/package.json').version")"
  vant_version="$(node -p "require('$ROOT_DIR/packages/vant/package.json').version")"
  : >"$COMMAND_LOG"

  run_release publish latest all current

  assert_log_contains "pnpm --dir packages/core publish --access public --registry https://registry.npmjs.org/"
  assert_log_contains "pnpm --dir packages/vue publish --access public --registry https://registry.npmjs.org/"
  assert_log_contains "pnpm --dir packages/vant publish --access public --registry https://registry.npmjs.org/"
  assert_log_contains "git tag -a @schemx/core@${core_version} -m release: @schemx/core@${core_version}"
  assert_log_contains "git tag -a @schemx/vue@${vue_version} -m release: @schemx/vue@${vue_version}"
  assert_log_contains "git tag -a @schemx/vant@${vant_version} -m release: @schemx/vant@${vant_version}"
  assert_log_contains "git push origin @schemx/core@${core_version}"
  assert_log_contains "git push origin @schemx/vue@${vue_version}"
  assert_log_contains "git push origin @schemx/vant@${vant_version}"
  assert_log_contains "gh release create @schemx/core@${core_version} --repo Jiohon/schemx --title @schemx/core@${core_version} --notes-file"
  assert_log_contains "gh release create @schemx/vue@${vue_version} --repo Jiohon/schemx --title @schemx/vue@${vue_version} --notes-file"
  assert_log_contains "gh release create @schemx/vant@${vant_version} --repo Jiohon/schemx --title @schemx/vant@${vant_version} --notes-file"
}

test_selector_rejects_unknown_environment_target() {
  local output status

  set +e
  output="$(SCHEMX_RELEASE_TARGET=unknown node "$ROOT_DIR/scripts/select-release-option.mjs" --kind target all core vue 2>&1)"
  status=$?
  set -e

  if [[ "$status" -eq 0 ]]; then
    printf '选择器应拒绝未知发布目标。\n' >&2
    exit 1
  fi

  assert_contains "$output" "未知发布目标"
}

test_selector_requires_tty_or_automation_target() {
  local output status

  set +e
  output="$(node "$ROOT_DIR/scripts/select-release-option.mjs" --kind target all core vue 2>&1)"
  status=$?
  set -e

  if [[ "$status" -eq 0 ]]; then
    printf '非 TTY 且未设置自动化目标时，选择器应失败。\n' >&2
    exit 1
  fi

  assert_contains "$output" "不支持交互选择"
}

test_selector_rejects_unknown_channel() {
  local output status

  set +e
  output="$(SCHEMX_RELEASE_TARGET=core node "$ROOT_DIR/scripts/select-release-option.mjs" --kind target --channel unknown all core vue 2>&1)"
  status=$?
  set -e

  if [[ "$status" -eq 0 ]]; then
    printf '选择器应拒绝未知发布模式。\n' >&2
    exit 1
  fi

  assert_contains "$output" "未知发布模式"
}

test_selector_accepts_dev_channel() {
  local output

  output="$(SCHEMX_RELEASE_TARGET=core node "$ROOT_DIR/scripts/select-release-option.mjs" --kind target --channel dev all core vue)"

  if [[ "$output" != "core" ]]; then
    printf 'dev 发布模式应允许自动化目标选择。\n实际输出：%s\n' "$output" >&2
    exit 1
  fi
}

test_cancelled_selector_exits_without_lifecycle_failure() {
  local output status

  : >"$COMMAND_LOG"

  export MOCK_RELEASE_CANCEL=1
  set +e
  output="$(run_release publish 2>&1)"
  status=$?
  set -e
  unset MOCK_RELEASE_CANCEL

  if [[ "$status" -ne 0 ]]; then
    printf '取消发布目标选择应以 0 退出，避免 pnpm 输出 ELIFECYCLE。\n实际输出：\n%s\n' "$output" >&2
    exit 1
  fi

  assert_contains "$output" "已取消选择"
  assert_log_not_contains "pnpm --dir packages/core publish"
  assert_log_not_contains "pnpm --dir packages/vue publish"
}

test_help_lists_channel_commands_without_package_shortcuts
test_package_scripts_keep_single_publish_entry
test_release_channel_choices_put_latest_last
test_release_test_runs_only_release_script_tests
test_latest_publish_is_main_only
test_publish_without_npm_auth_shows_clear_message
test_publish_accepts_npm_token_auth
test_publish_without_github_auth_stops_before_publish
test_publish_existing_version_suggests_release_version
test_alpha_publish_uses_alpha_tag_and_restores_version
test_publish_checks_only_target_dependency_chain
test_release_output_uses_colors_when_forced
test_release_output_omits_colors_without_tty
test_pack_accepts_target
test_latest_publish_patch_bumps_commits_and_publishes_target
test_latest_publish_patch_all_bumps_and_commits_all_packages
test_latest_publish_explicit_version_requires_single_target
test_publish_without_args_uses_channel_target_and_version_env_selection
test_selector_does_not_print_confirmation_line_after_enter
test_latest_publish_tags_and_pushes_after_publish
test_latest_publish_all_creates_package_scoped_tags_and_releases
test_selector_rejects_unknown_environment_target
test_selector_requires_tty_or_automation_target
test_selector_rejects_unknown_channel
test_selector_accepts_dev_channel
test_cancelled_selector_exits_without_lifecycle_failure

printf 'release script tests passed\n'
