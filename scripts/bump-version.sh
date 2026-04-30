#!/bin/bash
# bump-version.sh
#
# 在 git commit 时自动为有变更的 packages 子包的 patch 版本号 +1。
# 仅当 packages/<name>/src 下有暂存文件变更时才触发。

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

  # 替换版本号（macOS sed 兼容写法）
  sed -i '' "s/\"version\": *\"${CURRENT_VERSION}\"/\"version\": \"${NEW_VERSION}\"/" "$PKG_JSON"

  # 将修改后的 package.json 加入暂存区
  git add "$PKG_JSON"

  echo "📦 ${pkg}: ${CURRENT_VERSION} → ${NEW_VERSION}"
done
