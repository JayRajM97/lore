#!/bin/bash
# Lore — start the Kokoro sidecar + Next.js web app together.
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Prefer conda py312 env, fall back to project venv.
CONDA_ENV="$HOME/miniconda3/envs/py312"
NODE_BIN="$HOME/.nvm/versions/node/v20.20.2/bin"

if [ -d "$CONDA_ENV" ]; then
  export PATH="$CONDA_ENV/bin:$NODE_BIN:$PATH"
  PYTHON="$CONDA_ENV/bin/python"
  UVICORN="$CONDA_ENV/bin/uvicorn"
elif [ -f "$ROOT/venv/bin/activate" ]; then
  source "$ROOT/venv/bin/activate"
  UVICORN="uvicorn"
else
  echo "[lore] ERROR: no conda env or venv found. Run setup first." >&2
  exit 1
fi

echo "[lore] starting sidecar on :8000 ..."
( cd "$ROOT/sidecar"
  # Load secrets from ~/.lore/.env if present (ELEVENLABS_API_KEY etc.)
  [ -f "$HOME/.lore/.env" ] && set -a && source "$HOME/.lore/.env" && set +a
  "$UVICORN" main:app --host 0.0.0.0 --port 8000 ) &
SIDECAR_PID=$!

# Stop the sidecar when this script exits.
trap "echo '[lore] stopping sidecar'; kill $SIDECAR_PID 2>/dev/null" EXIT

echo "[lore] starting Next.js web on :3000 ..."
cd "$ROOT" && npm run dev
