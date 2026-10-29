#!/usr/bin/env bash
set -euo pipefail
id="${1:?task id required}"
base="${2:-main}"
[[ "$id" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "invalid task id" >&2; exit 2; }
here="$(cd "$(dirname "$0")" && pwd)"
common="$(git -C "$here" rev-parse --path-format=absolute --git-common-dir)"
ROOT="$(dirname "$common")"
path="$ROOT/.codex/worktrees/$id"
if [ -e "$path/.git" ]; then echo "$path"; exit 0; fi
mkdir -p "$ROOT/.codex/worktrees"
if git -C "$ROOT" show-ref --verify --quiet "refs/heads/codex/$id"; then
  git -C "$ROOT" worktree add -q "$path" "codex/$id"
else
  git -C "$ROOT" worktree add -q -b "codex/$id" "$path" "$base"
fi
echo "$path"
