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

if [[ "${MOCK_RELEASE_CANCEL:-0}" == "1" && "${1:-}" == */select-release-target.mjs ]]; then
  printf '已取消发布目标选择\n' >&2
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

  assert_contains "$output" "pnpm release:publish:alpha"
  assert_contains "$output" "pnpm release:publish:dev"
  assert_contains "$output" "pnpm release:publish:next"
  assert_not_contains "$output" "pnpm release:publish:core"
  assert_not_contains "$output" "pnpm release:publish:wot"
  assert_contains "$output" "bash scripts/release.sh publish-alpha [all|core|vue|vant]"
  assert_contains "$output" "bash scripts/release.sh publish-dev [all|core|vue|vant]"
}

test_package_scripts_keep_only_publish_channels() {
  local scripts
  scripts="$(node -e "
const pkg = require('$ROOT_DIR/package.json');
console.log(Object.keys(pkg.scripts).filter((name) => name.startsWith('release:publish')).join('\n'));
")"

  assert_contains "$scripts" "release:publish"
  assert_contains "$scripts" "release:publish:dev"
  assert_contains "$scripts" "release:publish:alpha"
  assert_contains "$scripts" "release:publish:beta"
  assert_contains "$scripts" "release:publish:rc"
  assert_contains "$scripts" "release:publish:next"
  assert_not_contains "$scripts" "release:publish:core"
  assert_not_contains "$scripts" "release:publish:vue"
  assert_not_contains "$scripts" "release:publish:vant"
  assert_not_contains "$scripts" "release:publish:wot"
}

test_dev_publish_uses_dev_tag_and_restores_version() {
  local before after output

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
  assert_log_not_contains "gh auth status"
  assert_log_not_contains "gh release create"
  assert_log_not_contains "git tag"
  assert_log_not_contains "git push"
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
  output="$(run_release publish-alpha core 2>&1)"
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
  output="$(run_release publish core 2>&1)"
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

test_alpha_publish_uses_alpha_tag_and_restores_version() {
  local before after

  before="$(node -p "require('$ROOT_DIR/packages/core/package.json').version")"
  : >"$COMMAND_LOG"

  export MOCK_BRANCH="feature/demo"
  output="$(run_release publish-alpha core)"
  unset MOCK_BRANCH

  after="$(node -p "require('$ROOT_DIR/packages/core/package.json').version")"

  if [[ "$before" != "$after" ]]; then
    printf 'alpha 发布后应恢复 package.json 版本：%s != %s\n' "$before" "$after" >&2
    exit 1
  fi

  assert_contains "$output" "发布模式：alpha"
  assert_contains "$output" "发布目标：core"
  assert_contains "$output" "发布 registry：https://registry.npmjs.org/"
  assert_contains "$output" "发布 tag：alpha"
  assert_contains "$output" "终端可能会停在认证提示处"
  assert_contains "$output" "完成后回到这里等待发布继续"
  assert_log_contains "pnpm --dir packages/core publish --access public --registry https://registry.npmjs.org/ --tag alpha --no-git-checks"
  assert_log_not_contains "gh auth status"
  assert_log_not_contains "gh release create"
  assert_log_not_contains "git tag"
  assert_log_not_contains "git push"
}

test_publish_checks_only_target_dependency_chain() {
  local output

  : >"$COMMAND_LOG"

  export MOCK_BRANCH="feature/demo"
  output="$(run_release publish-alpha vant)"
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

test_latest_publish_tags_and_pushes_after_publish() {
  local version

  version="$(node -p "require('$ROOT_DIR/packages/core/package.json').version")"
  : >"$COMMAND_LOG"

  SCHEMX_RELEASE_TARGET=core run_release publish

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

  SCHEMX_RELEASE_TARGET=all run_release publish

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

test_selector_accepts_dev_channel() {
  local output

  output="$(SCHEMX_RELEASE_TARGET=core node "$ROOT_DIR/scripts/select-release-target.mjs" --channel dev all core vue)"

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

  assert_contains "$output" "已取消发布目标选择"
  assert_log_not_contains "pnpm --dir packages/core publish"
  assert_log_not_contains "pnpm --dir packages/vue publish"
}

test_help_lists_channel_commands_without_package_shortcuts
test_package_scripts_keep_only_publish_channels
test_latest_publish_is_main_only
test_publish_without_npm_auth_shows_clear_message
test_publish_accepts_npm_token_auth
test_publish_without_github_auth_stops_before_publish
test_alpha_publish_uses_alpha_tag_and_restores_version
test_publish_checks_only_target_dependency_chain
test_publish_without_target_prompts_for_package_selection
test_latest_publish_tags_and_pushes_after_publish
test_latest_publish_all_creates_package_scoped_tags_and_releases
test_selector_rejects_unknown_environment_target
test_selector_requires_tty_or_automation_target
test_selector_rejects_unknown_channel
test_selector_accepts_dev_channel
test_cancelled_selector_exits_without_lifecycle_failure

printf 'release script tests passed\n'
