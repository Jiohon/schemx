# 发布前置校验与版本事务实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将正式版和预发布统一为先完成不可变预检、再写入候选版本的两阶段流程，并为失败回滚和发布标记冲突补充自动化测试。

**架构：** `release.sh` 维护一次性候选版本计划，并把显式的 `pkg=version` 传给 npm 版本与发布标记检查。质量门禁和 dry-run 完全在版本文件修改前运行；预检通过后，正式版进入可回滚的版本提交事务，预发布进入带 `EXIT trap` 的临时版本事务。

**技术栈：** Bash 3.2 兼容 Shell、Node.js、pnpm、npm、Git、GitHub CLI、自定义 Shell 测试框架。

---

## 文件结构

- 修改：`scripts/release/common.sh`——提供正式版本计算和显式 `pkg=version` 解析工具。
- 修改：`scripts/release/check-versions-available.sh`——按候选版本计划查询 npm，不再读取已改写文件。
- 创建：`scripts/release/check-release-markers-available.sh`——检查候选 tag 的本地、远端和 GitHub Release 冲突。
- 修改：`scripts/release/release.sh`——生成候选版本计划、重排预检、实现正式版和预发布事务、记录多包发布进度。
- 修改：`scripts/release/release.test.sh`——扩展 mock 失败注入、顺序断言、回滚和冲突测试。
- 修改：`scripts/release/create-release-tag.sh`——保留最终防御性检查，并补充远端 tag 冲突保护。

### 任务 1：候选版本计划与显式 npm 查询

**文件：**

- 修改：`scripts/release/common.sh`
- 修改：`scripts/release/check-versions-available.sh`
- 测试：`scripts/release/release.test.sh`

- [ ] **步骤 1：编写候选正式版本和显式 npm 查询的失败测试**

在 `release.test.sh` 中添加：

```bash
test_next_stable_version_calculates_without_mutating_files() {
  local package_before output

  package_before="$(cat "$ROOT_DIR/packages/core/package.json")"
  output="$(bash -c "source '$ROOT_DIR/scripts/release/common.sh'; next_stable_version 1.2.3 minor")"

  [[ "$output" == "1.3.0" ]]
  [[ "$(cat "$ROOT_DIR/packages/core/package.json")" == "$package_before" ]]
}

test_version_availability_uses_explicit_candidate() {
  : >"$COMMAND_LOG"

  bash "$ROOT_DIR/scripts/release/check-versions-available.sh" "core=9.8.7"

  assert_log_contains "pnpm view @schemx/core@9.8.7 version --registry https://registry.npmjs.org/"
}
```

- [ ] **步骤 2：运行测试验证失败**

运行：`bash scripts/release/release.test.sh`

预期：FAIL，提示 `next_stable_version` 不存在，或 `check-versions-available.sh` 无法解析 `core=9.8.7`。

- [ ] **步骤 3：实现无副作用的正式版本计算**

在 `common.sh` 中添加：

```bash
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
    patch) patch=$((patch + 1)) ;;
    minor) minor=$((minor + 1)); patch=0 ;;
    major) major=$((major + 1)); minor=0; patch=0 ;;
    *) die "无法计算版本处理方式：$action" ;;
  esac

  printf '%s.%s.%s' "$major" "$minor" "$patch"
}
```

- [ ] **步骤 4：让 npm 查询接收显式候选版本**

将 `check-versions-available.sh` 的参数改为 `pkg=version`，使用以下解析方式：

```bash
for candidate in "$@"; do
  pkg="${candidate%%=*}"
  version="${candidate#*=}"
  assert_package "$pkg"

  if [[ "$pkg" == "$candidate" ]] || ! [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.-]+)?$ ]]; then
    die "无效候选版本：$candidate"
  fi

  package_name="$(package_json_value "$pkg" name)"
  pnpm view "${package_name}@${version}" version --registry "$NPM_REGISTRY"
done
```

- [ ] **步骤 5：运行发布脚本测试确认通过**

运行：`bash scripts/release/release.test.sh`

预期：新增候选版本测试通过；旧调用测试暂时可能因参数协议变化失败，任务 3 会统一迁移调用点。

- [ ] **步骤 6：提交候选版本基础能力**

```bash
git add scripts/release/common.sh scripts/release/check-versions-available.sh scripts/release/release.test.sh
git commit -m "refactor(发布): 添加无副作用候选版本计划"
```

### 任务 2：发布标记冲突预检

**文件：**

- 创建：`scripts/release/check-release-markers-available.sh`
- 修改：`scripts/release/create-release-tag.sh`
- 测试：`scripts/release/release.test.sh`

- [ ] **步骤 1：扩展 Git 与 GitHub mock**

让 mock 支持以下环境变量：

```bash
MOCK_LOCAL_TAG_EXISTS
MOCK_REMOTE_TAG_EXISTS
MOCK_GITHUB_RELEASE_EXISTS
```

对应行为：

```bash
# git tag -l <tag>
[[ -n "${MOCK_LOCAL_TAG_EXISTS:-}" ]] && printf '%s\n' "$MOCK_LOCAL_TAG_EXISTS"

# git ls-remote --exit-code --tags origin refs/tags/<tag>
[[ "${MOCK_REMOTE_TAG_EXISTS:-0}" == "1" ]] && exit 0
exit 2

# gh release view <tag> --repo <repo>
[[ "${MOCK_GITHUB_RELEASE_EXISTS:-0}" == "1" ]] && exit 0
exit 1
```

- [ ] **步骤 2：编写本地、远端和 GitHub Release 冲突失败测试**

每个测试运行：

```bash
bash scripts/release/check-release-markers-available.sh "core=9.8.7"
```

分别设置 3 个 mock 变量，预期命令失败且输出具体冲突对象；无冲突时预期输出 `@schemx/core@9.8.7 可创建`。

- [ ] **步骤 3：运行测试验证失败**

运行：`bash scripts/release/release.test.sh`

预期：FAIL，因为标记检查脚本尚不存在。

- [ ] **步骤 4：实现候选标记检查脚本**

核心循环：

```bash
repo="$(github_repository)"

for candidate in "$@"; do
  pkg="${candidate%%=*}"
  version="${candidate#*=}"
  tag_name="@schemx/${pkg}@${version}"

  [[ -z "$(git tag -l "$tag_name")" ]] || die "本地 Git tag 已存在：$tag_name"
  if git ls-remote --exit-code --tags origin "refs/tags/$tag_name" >/dev/null 2>&1; then
    die "远端 Git tag 已存在：$tag_name"
  fi
  if gh release view "$tag_name" --repo "$repo" >/dev/null 2>&1; then
    die "GitHub Release 已存在：$tag_name"
  fi

  success "$tag_name 可创建"
done
```

- [ ] **步骤 5：增强最终 tag 创建防御**

在 `create-release-tag.sh` 创建任何 tag 前，同样检查所有目标的远端 tag；只要一个冲突就不创建本地 tag。

- [ ] **步骤 6：运行标记测试确认通过**

运行：`bash scripts/release/release.test.sh`

预期：标记检查测试全部通过。

- [ ] **步骤 7：提交标记预检**

```bash
git add scripts/release/check-release-markers-available.sh scripts/release/create-release-tag.sh scripts/release/release.test.sh
git commit -m "feat(发布): 添加发布标记冲突预检"
```

### 任务 3：统一不可变预检顺序

**文件：**

- 修改：`scripts/release/release.sh`
- 修改：`scripts/release/release.test.sh`

- [ ] **步骤 1：添加命令顺序断言工具**

```bash
assert_log_order() {
  local first="$1"
  local second="$2"
  local first_line second_line

  first_line="$(grep -Fn -- "$first" "$COMMAND_LOG" | head -1 | cut -d: -f1)"
  second_line="$(grep -Fn -- "$second" "$COMMAND_LOG" | head -1 | cut -d: -f1)"

  [[ -n "$first_line" && -n "$second_line" && "$first_line" -lt "$second_line" ]] || {
    printf '期望命令 %s 早于 %s。\n' "$first" "$second" >&2
    cat "$COMMAND_LOG" >&2
    exit 1
  }
}
```

- [ ] **步骤 2：编写正式版和预发布顺序失败测试**

正式版断言：

```bash
assert_log_order "pnpm --filter @schemx/vue... test" "npm --prefix packages/vue version"
assert_log_order "pnpm --filter @schemx/vue pack --dry-run" "npm --prefix packages/vue version"
assert_log_order "git commit -m chore(发布): 提升 vue 版本" "pnpm --dir packages/vue publish"
```

预发布通过输出断言质量检查与 pack 的阶段文本早于“生成临时 alpha 预发布版本”，并确认 publish 使用计划中的同一版本。

- [ ] **步骤 3：运行测试验证当前顺序错误**

运行：`bash scripts/release/release.test.sh`

预期：FAIL，显示 `npm version` 或临时版本写入早于 test/pack。

- [ ] **步骤 4：在 `release.sh` 生成一次性候选计划**

使用 Bash 3.2 兼容的平行数组：

```bash
PLANNED_PACKAGES=()
PLANNED_VERSIONS=()
PLANNED_CANDIDATES=()

build_release_plan() {
  local channel="$1"
  local version_action="$2"
  shift 2

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
```

- [ ] **步骤 5：抽取共享预检并重排两个发布流程**

```bash
run_publish_preflight() {
  local channel="$1"
  shift

  assert_npm_registry
  assert_npm_auth
  check_target_versions_available "${PLANNED_CANDIDATES[@]}"
  if [[ "$channel" == "latest" ]]; then
    assert_github_auth
    bash "$ROOT_DIR/scripts/release/check-release-markers-available.sh" "${PLANNED_CANDIDATES[@]}"
  fi
  run_quality_checks "$@"
  pack_target_packages "$@"
}
```

`run_latest_publish` 在 main/clean 检查后构建计划并调用预检；`run_prerelease_publish` 在目标版本文件检查后构建计划并调用预检。两个流程都只在该函数成功返回后进入版本写入。

- [ ] **步骤 6：运行顺序与回归测试确认通过**

运行：`bash scripts/release/release.test.sh`

预期：所有顺序断言通过，既有发布参数和认证测试继续通过。

- [ ] **步骤 7：提交预检重排**

```bash
git add scripts/release/release.sh scripts/release/release.test.sh
git commit -m "refactor(发布): 将质量门禁前移到版本提升之前"
```

### 任务 4：正式版事务回滚与预发布延迟写入

**文件：**

- 修改：`scripts/release/release.sh`
- 修改：`scripts/release/release.test.sh`

- [ ] **步骤 1：扩展 mock 命令失败注入**

在 pnpm、npm 和 git mock 的命令日志写入后添加：

```bash
if [[ -n "${MOCK_COMMAND_FAIL_MATCH:-}" && "工具名 $*" == *"$MOCK_COMMAND_FAIL_MATCH"* ]]; then
  printf 'mock command failed: %s\n' "$*" >&2
  exit 1
fi
```

- [ ] **步骤 2：编写质量门禁失败不进入版本事务的测试**

分别让 test、lint、build、pack 失败，断言：

```bash
assert_log_not_contains "npm --prefix packages/core version"
assert_log_not_contains "pnpm install --lockfile-only"
assert_log_not_contains "git commit -m chore(发布)"
assert_log_not_contains "pnpm --dir packages/core publish"
```

预发布失败还需要比较执行前后的目标 `package.json` 内容完全一致。

- [ ] **步骤 3：运行失败测试确认红灯**

运行：`bash scripts/release/release.test.sh`

预期：至少正式版仍在 test 失败前执行 `npm version`，测试失败。

- [ ] **步骤 4：实现正式版版本事务备份与恢复**

使用全局事务状态：

```bash
LATEST_BACKUP_DIR=""
LATEST_TRANSACTION_FILES=()
LATEST_VERSION_COMMITTED=0

rollback_latest_version_transaction() {
  [[ -n "$LATEST_BACKUP_DIR" && -d "$LATEST_BACKUP_DIR" ]] || return
  [[ "$LATEST_VERSION_COMMITTED" == "0" ]] || return

  git restore --staged -- "${LATEST_TRANSACTION_FILES[@]}" >/dev/null 2>&1 || true
  # 按备份清单复制 package.json 和 pnpm-lock.yaml 回原路径。
  restore_latest_version_backups
}
```

事务开始时注册 `trap rollback_latest_version_transaction EXIT`。使用计划版本执行 `npm --prefix <path> version <candidate> --no-git-tag-version`，同步锁文件、暂存并 commit。commit 成功后将 `LATEST_VERSION_COMMITTED=1`，清理备份并取消 trap。

- [ ] **步骤 5：让预发布写入复用计划版本**

`prepare_prerelease_versions` 不再调用 `next_prerelease_version`，而是按 `PLANNED_PACKAGES` 与 `PLANNED_VERSIONS` 写入，保证 npm 查询和 publish 使用同一版本。

- [ ] **步骤 6：测试 lockfile 与 commit 失败回滚**

让 `pnpm install --lockfile-only` 和 `git commit` 分别失败；比较版本文件和锁文件执行前后字节一致，并确认没有 publish 命令。

- [ ] **步骤 7：运行事务测试确认通过**

运行：`bash scripts/release/release.test.sh`

预期：质量门禁失败不产生版本动作；正式版事务失败完整恢复；预发布成功和失败均恢复原版本。

- [ ] **步骤 8：提交版本事务实现**

```bash
git add scripts/release/release.sh scripts/release/release.test.sh
git commit -m "fix(发布): 避免前置检查失败后留下版本提交"
```

### 任务 5：多包部分发布状态与最终验证

**文件：**

- 修改：`scripts/release/release.sh`
- 修改：`scripts/release/release.test.sh`

- [ ] **步骤 1：编写多包中途失败测试**

让 Vue publish 失败，断言 Core 已执行、Vue 失败、Vant 未执行，并验证输出包含：

```text
已发布：core
失败：vue
未执行：vant
```

正式版断言保留版本 commit；预发布断言本地版本文件已恢复。

- [ ] **步骤 2：运行测试验证缺少状态输出**

运行：`bash scripts/release/release.test.sh`

预期：FAIL，因为当前流程没有记录已发布和未执行包。

- [ ] **步骤 3：实现发布进度记录**

```bash
PUBLISHED_PACKAGES=()

publish_planned_packages() {
  local tag="$1"
  local index pkg

  for index in "${!PLANNED_PACKAGES[@]}"; do
    pkg="${PLANNED_PACKAGES[$index]}"
    if ! publish_one "$pkg" "$tag"; then
      warn "已发布：$(target_summary "${PUBLISHED_PACKAGES[@]}")"
      warn "失败：$pkg"
      warn "未执行：$(target_summary "${PLANNED_PACKAGES[@]:$((index + 1))}")"
      return 1
    fi
    PUBLISHED_PACKAGES+=("$pkg")
  done
}
```

空列表使用“无”显示，避免空白提示。正式版失败后保留版本提交；预发布由已有 trap 恢复文件。

- [ ] **步骤 4：运行发布脚本全量测试**

运行：`bash scripts/release/release.test.sh`

预期：所有发布脚本测试通过。

- [ ] **步骤 5：运行 Shell 语法和格式检查**

运行：

```bash
bash -n scripts/release/common.sh
bash -n scripts/release/check-versions-available.sh
bash -n scripts/release/check-release-markers-available.sh
bash -n scripts/release/create-release-tag.sh
bash -n scripts/release/release.sh
bash -n scripts/release/release.test.sh
git diff --check
```

预期：全部退出码为 0。

- [ ] **步骤 6：运行仓库发布检查回归**

运行：`CI=true pnpm release:test`

预期：全部 release tests 通过，且命令结束后 `git status --short` 只保留执行前已有的三个 `package.json` 版本差异和本次脚本改动。

- [ ] **步骤 7：提交部分发布诊断**

```bash
git add scripts/release/release.sh scripts/release/release.test.sh
git commit -m "feat(发布): 补充多包发布失败状态提示"
```
