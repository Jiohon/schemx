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
    if [[ "${MOCK_NPM_AUTH_FAIL:-0}" == "1" ]]; then
      printf 'npm whoami failed\n' >&2
      exit 1
    fi
    printf 'mock-user\n'
    ;;
  view)
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

cat >"$MOCK_BIN/node" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${MOCK_RELEASE_CANCEL:-0}" == "1" && "${1:-}" == */select-release-target.mjs ]]; then
  printf '已取消发布目标选择\n' >&2
  printf '__SCHEMX_RELEASE_CANCELLED__\n'
  exit 0
fi

exec "${REAL_NODE:?}" "$@"
MOCK

chmod +x "$MOCK_BIN/git" "$MOCK_BIN/pnpm" "$MOCK_BIN/npm" "$MOCK_BIN/node"

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

  assert_contains "$output" "pnpm release:publish:dev"
  assert_contains "$output" "pnpm release:publish:next"
  assert_not_contains "$output" "pnpm release:publish:core"
  assert_not_contains "$output" "pnpm release:publish:wot"
  assert_contains "$output" "bash scripts/release.sh publish-dev [all|core|vue|vant|wot]"
}

test_package_scripts_keep_only_publish_channels() {
  local scripts
  scripts="$(node -e "
const pkg = require('$ROOT_DIR/package.json');
console.log(Object.keys(pkg.scripts).filter((name) => name.startsWith('release:publish')).join('\n'));
")"

  assert_contains "$scripts" "release:publish"
  assert_contains "$scripts" "release:publish:dev"
  assert_contains "$scripts" "release:publish:beta"
  assert_contains "$scripts" "release:publish:rc"
  assert_contains "$scripts" "release:publish:next"
  assert_not_contains "$scripts" "release:publish:core"
  assert_not_contains "$scripts" "release:publish:vue"
  assert_not_contains "$scripts" "release:publish:vant"
  assert_not_contains "$scripts" "release:publish:wot"
}

test_latest_publish_is_main_only() {
  local output status

  export MOCK_BRANCH="feature/demo"
  set +e
  output="$(run_release publish core 2>&1)"
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
  output="$(run_release publish core 2>&1)"
  status=$?
  set -e
  unset MOCK_NPM_AUTH_FAIL

  if [[ "$status" -eq 0 ]]; then
    printf '未登录 npm 时，发布应失败。\n' >&2
    exit 1
  fi

  assert_contains "$output" "检查 npm 登录状态"
  assert_contains "$output" "npm 未登录或当前 registry 无权限"
  assert_not_contains "$output" "ELIFECYCLE"
}

test_dev_publish_uses_dev_tag_and_restores_version() {
  local before after

  before="$(node -p "require('$ROOT_DIR/packages/core/package.json').version")"
  : >"$COMMAND_LOG"

  export MOCK_BRANCH="feature/demo"
  output="$(run_release publish-dev core)"
  unset MOCK_BRANCH

  after="$(node -p "require('$ROOT_DIR/packages/core/package.json').version")"

  if [[ "$before" != "$after" ]]; then
    printf 'dev 发布后应恢复 package.json 版本：%s != %s\n' "$before" "$after" >&2
    exit 1
  fi

  assert_contains "$output" "发布模式：dev"
  assert_contains "$output" "发布目标：core"
  assert_log_contains "pnpm --dir packages/core publish --access public --registry https://registry.npmjs.org/ --tag dev --no-git-checks"
}

test_publish_without_target_prompts_for_package_selection() {
  local output

  : >"$COMMAND_LOG"

  output="$(SCHEMX_RELEASE_TARGET=core run_release publish)"

  assert_contains "$output" "发布模式：latest"
  assert_contains "$output" "发布目标：core"
  assert_not_contains "$output" "输入序号或名称"
  assert_log_contains "pnpm --dir packages/core publish --access public --registry https://registry.npmjs.org/"
  assert_log_not_contains "pnpm --dir packages/vue publish"
}

test_selector_rejects_unknown_environment_target() {
  local output status

  set +e
  output="$(SCHEMX_RELEASE_TARGET=unknown node "$ROOT_DIR/scripts/select-release-target.mjs" all core vue 2>&1)"
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
  output="$(node "$ROOT_DIR/scripts/select-release-target.mjs" all core vue 2>&1)"
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
  output="$(SCHEMX_RELEASE_TARGET=core node "$ROOT_DIR/scripts/select-release-target.mjs" --channel unknown all core vue 2>&1)"
  status=$?
  set -e

  if [[ "$status" -eq 0 ]]; then
    printf '选择器应拒绝未知发布模式。\n' >&2
    exit 1
  fi

  assert_contains "$output" "未知发布模式"
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

  assert_contains "$output" "已取消发布目标选择"
  assert_log_not_contains "pnpm --dir packages/core publish"
  assert_log_not_contains "pnpm --dir packages/vue publish"
}

test_help_lists_channel_commands_without_package_shortcuts
test_package_scripts_keep_only_publish_channels
test_latest_publish_is_main_only
test_publish_without_npm_auth_shows_clear_message
test_dev_publish_uses_dev_tag_and_restores_version
test_publish_without_target_prompts_for_package_selection
test_selector_rejects_unknown_environment_target
test_selector_requires_tty_or_automation_target
test_selector_rejects_unknown_channel
test_cancelled_selector_exits_without_lifecycle_failure

printf 'release script tests passed\n'
