#!/bin/bash
# Lore — start the Maya1 sidecar + Next.js web app together.
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Activate venv if present.
if [ -f "$ROOT/venv/bin/activate" ]; then
  source "$ROOT/venv/bin/activate"
fi

echo "[lore] starting Maya1 sidecar on :8000 ..."
( cd "$ROOT/sidecar" && uvicorn main:app --host 0.0.0.0 --port 8000 ) &
SIDECAR_PID=$!

# Stop the sidecar when this script exits.
trap "echo '[lore] stopping sidecar'; kill $SIDECAR_PID 2>/dev/null" EXIT

echo "[lore] starting Next.js web on :3000 ..."
cd "$ROOT" && npm run dev
