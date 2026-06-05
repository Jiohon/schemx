#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org/}"

info() {
  printf '\n==> %s\n' "$1"
}

die() {
  printf '错误：%s\n' "$1" >&2
  exit 1
}

package_path() {
  printf 'packages/%s' "$1"
}

package_json_value() {
  local pkg="$1"
  local field="$2"

  node -p "const pkg=require('./$(package_path "$pkg")/package.json'); pkg['$field']"
}
