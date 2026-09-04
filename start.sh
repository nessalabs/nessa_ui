#!/usr/bin/env bash

set -euo pipefail

nessa_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$nessa_root"

if ! command -v node >/dev/null 2>&1; then
  echo "Nessa UI requires Node.js $(tr -d '[:space:]' < .node-version) or newer." >&2
  exit 1
fi

nessa_required_node="$(tr -d '[:space:]' < .node-version)"
if ! node -e '
  const required = process.argv[1].split(".").map(Number)
  const current = process.versions.node.split(".").map(Number)
  const supported = current.some((value, index) => value > required[index] && current.slice(0, index).every((part, partIndex) => part === required[partIndex])) || current.every((value, index) => value === required[index])
  if (!supported) process.exit(1)
' "$nessa_required_node"; then
  echo "Nessa UI requires Node.js $nessa_required_node or newer; found $(node --version)." >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "Nessa UI requires pnpm 11.9.0. Install it with: corepack enable && corepack prepare pnpm@11.9.0 --activate" >&2
  exit 1
fi

nessa_required_pnpm="$(node -p 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")).packageManager.split("@").at(-1)')"
nessa_current_pnpm="$(pnpm --version)"
if [[ "$nessa_current_pnpm" != "$nessa_required_pnpm" ]]; then
  echo "Nessa UI requires pnpm $nessa_required_pnpm; found $nessa_current_pnpm." >&2
  echo "Run: corepack prepare pnpm@$nessa_required_pnpm --activate" >&2
  exit 1
fi

echo "Reconciling Nessa UI workspace dependencies..."
pnpm install --frozen-lockfile

nessa_storybook_host="${NESSA_STORYBOOK_HOST:-127.0.0.1}"
nessa_storybook_port="${NESSA_STORYBOOK_PORT:-6006}"

echo "Starting Nessa UI Storybook at http://${nessa_storybook_host}:${nessa_storybook_port}"
exec pnpm --filter @nessalabs/storybook exec storybook dev \
  --host "$nessa_storybook_host" \
  --port "$nessa_storybook_port" \
  "$@"
