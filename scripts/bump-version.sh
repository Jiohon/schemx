#!/usr/bin/env bash
# bump-version.sh
#
# 兼容旧 pre-commit hook 的版本提升脚本。
# 新发布策略默认不在 commit 阶段提升版本号；正式版本请使用 scripts/release.sh。

set -euo pipefail

if [[ "${SCHEMX_ENABLE_COMMIT_VERSION_BUMP:-0}" != "1" ]]; then
  exit 0
fi

CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  exit 0
fi

PACKAGES_DIR="packages"

# 获取暂存区中变更的文件列表
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

# 收集有变更的子包名称（去重）
CHANGED_PACKAGES=""
for file in $STAGED_FILES; do
  if echo "$file" | grep -q "^${PACKAGES_DIR}/"; then
    pkg_name=$(echo "$file" | cut -d'/' -f2)
    if ! echo "$CHANGED_PACKAGES" | grep -q "$pkg_name"; then
      CHANGED_PACKAGES="$CHANGED_PACKAGES $pkg_name"
    fi
  fi
done

if [ -z "$CHANGED_PACKAGES" ]; then
  exit 0
fi

for pkg in $CHANGED_PACKAGES; do
  PKG_JSON="${PACKAGES_DIR}/${pkg}/package.json"

  if [ ! -f "$PKG_JSON" ]; then
    continue
  fi

  # 读取当前版本号
  CURRENT_VERSION=$(grep -o '"version": *"[^"]*"' "$PKG_JSON" | head -1 | grep -o '[0-9]*\.[0-9]*\.[0-9]*')

  if [ -z "$CURRENT_VERSION" ]; then
    continue
  fi

  # 拆分版本号
  MAJOR=$(echo "$CURRENT_VERSION" | cut -d'.' -f1)
  MINOR=$(echo "$CURRENT_VERSION" | cut -d'.' -f2)
  PATCH=$(echo "$CURRENT_VERSION" | cut -d'.' -f3)

  # patch +1
  NEW_PATCH=$((PATCH + 1))
  NEW_VERSION="${MAJOR}.${MINOR}.${NEW_PATCH}"

  node -e "
const fs = require('node:fs');
const pkgPath = process.argv[1];
const version = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
" "$PKG_JSON" "$NEW_VERSION"

  # 将修改后的 package.json 加入暂存区
  git add "$PKG_JSON"

  echo "${pkg}: ${CURRENT_VERSION} -> ${NEW_VERSION}"
done
