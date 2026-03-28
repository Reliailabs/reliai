#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

set -a
if [[ -f "$ROOT_DIR/.env.local" ]]; then
  source "$ROOT_DIR/.env.local"
fi
set +a

cd "$ROOT_DIR"
mkdir -p apps/web/.next/standalone/apps/web/.next/static apps/web/.next/standalone/apps/web/public
cp -R apps/web/.next/static/. apps/web/.next/standalone/apps/web/.next/static/
cp -R apps/web/public/. apps/web/.next/standalone/apps/web/public/
PORT="${PORT:-3000}" HOSTNAME="localhost" node apps/web/.next/standalone/apps/web/server.js
