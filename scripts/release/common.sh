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

release_tag_name() {
  local pkg="$1"
  local version

  version="$(package_json_value "$pkg" version)"
  printf '@schemx/%s@%s' "$pkg" "$version"
}

release_title() {
  local pkg="$1"
  local version

  version="$(package_json_value "$pkg" version)"
  printf '@schemx/%s@%s' "$pkg" "$version"
}

github_repository() {
  local repo="${GITHUB_REPOSITORY:-}"

  if [[ -z "$repo" ]]; then
    repo="$(git config --get remote.origin.url 2>/dev/null || true)"
  fi

  case "$repo" in
    git@github.com:*)
      repo="${repo#git@github.com:}"
      ;;
    ssh://git@github.com/*)
      repo="${repo#ssh://git@github.com/}"
      ;;
    https://github.com/*)
      repo="${repo#https://github.com/}"
      ;;
    http://github.com/*)
      repo="${repo#http://github.com/}"
      ;;
  esac

  repo="${repo%.git}"

  if [[ ! "$repo" =~ ^[^/]+/[^/]+$ ]]; then
    die "无法从 origin remote 解析 GitHub 仓库，请设置 GITHUB_REPOSITORY=owner/repo。"
  fi

  printf '%s' "$repo"
}

npm_registry_auth_key() {
  local registry="$1"

  registry="${registry#http://}"
  registry="${registry#https://}"
  registry="${registry%/}/"

  printf '//%s:_authToken' "$registry"
}

configure_npm_token_auth() {
  local npm_token="${NPM_TOKEN:-}"
  local auth_key user_config

  if [[ -z "$npm_token" ]]; then
    return 0
  fi

  if [[ -n "${SCHEMX_NPM_TOKEN_USERCONFIG:-}" ]]; then
    export NPM_CONFIG_USERCONFIG="$SCHEMX_NPM_TOKEN_USERCONFIG"
    return 0
  fi

  auth_key="$(npm_registry_auth_key "$NPM_REGISTRY")"
  user_config="$(mktemp "${TMPDIR:-/tmp}/schemx-npmrc.XXXXXX")"

  {
    printf 'registry=%s\n' "$NPM_REGISTRY"
    printf '%s=%s\n' "$auth_key" "$npm_token"
    printf 'always-auth=true\n'
  } >"$user_config"

  export SCHEMX_NPM_TOKEN_USERCONFIG="$user_config"
  export NPM_CONFIG_USERCONFIG="$user_config"
}
