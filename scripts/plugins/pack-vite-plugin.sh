#!/usr/bin/env bash
set -euo pipefail

# 将指定 Vite 插件以带时间戳的本地版本打包到 .packs 目录。
# 用法：bash scripts/plugins/pack-vite-plugin.sh <插件目录名> [版本后缀]

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PLUGIN_KEY="${1:-}"
SUFFIX="${2:-dev}"

case "$PLUGIN_KEY" in
  vite-plugin-workspace-source | vite-plugin-package-resolution-compat | vite-plugin-realpath-fallback)
    ;;
  *)
    printf '未知 Vite 插件：%s\n' "$PLUGIN_KEY" >&2
    exit 1
    ;;
esac

PACKS_DIR="$ROOT/.packs"
PLUGIN_DIR="$ROOT/plugins/$PLUGIN_KEY"
PACKAGE_JSON="$PLUGIN_DIR/package.json"
TIMESTAMP="$(date +%Y%m%d%H%M%S)"

read_package_field() {
  local field="$1"

  node -e "
const fs = require('node:fs');
const pkg = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
process.stdout.write(pkg[process.argv[2]]);
" "$PACKAGE_JSON" "$field"
}

write_version() {
  local version="$1"

  node -e "
const fs = require('node:fs');
const path = process.argv[1];
const version = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
pkg.version = version;
fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
" "$PACKAGE_JSON" "$version"
}

PLUGIN_NAME="$(read_package_field name)"
ORIGINAL_VERSION="$(read_package_field version)"
PACK_VERSION="${ORIGINAL_VERSION}-${SUFFIX}.${TIMESTAMP}"

restore_version() {
  write_version "$ORIGINAL_VERSION"
}
trap restore_version EXIT

mkdir -p "$PACKS_DIR"

node "$ROOT/scripts/terminal.mjs" section "打包 $PLUGIN_NAME ($PACK_VERSION)"
printf '输出目录：%s\n' "$PACKS_DIR"

write_version "$PACK_VERSION"

cd "$PLUGIN_DIR"
pnpm build
CI=true pnpm pack --pack-destination "$PACKS_DIR"

TARBALL_PATH="$(find "$PACKS_DIR" -maxdepth 1 -type f -name "*-${PACK_VERSION}.tgz" -print -quit)"

if [[ -z "$TARBALL_PATH" ]]; then
  printf '未找到本次打包产物：%s\n' "$PACK_VERSION" >&2
  exit 1
fi

node "$ROOT/scripts/terminal.mjs" section "打包完成"
ls -lh "$TARBALL_PATH"
printf '__SCHEMX_LOCAL_TARBALL__=%s\n' "$TARBALL_PATH"
