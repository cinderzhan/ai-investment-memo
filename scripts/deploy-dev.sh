#!/usr/bin/env bash
# Deploy to dev server (run from a machine that can SSH to the host).
# Usage:
#   chmod +x scripts/deploy-dev.sh
#   ./scripts/deploy-dev.sh
# Optional env:
#   REMOTE_HOST=192.168.106.163 REMOTE_USER=root DEPLOY_DIR=/root/yutong/investmentmemo ./scripts/deploy-dev.sh

set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-192.168.106.163}"
REMOTE_USER="${REMOTE_USER:-root}"
DEPLOY_DIR="${DEPLOY_DIR:-/root/yutong/investmentmemo}"
GIT_URL="${GIT_URL:-https://github.com/cinderzhan/ai-investment-memo.git}"
HOST_PORT="${HOST_PORT:-3013}"

echo "==> Target: ${REMOTE_USER}@${REMOTE_HOST}:${DEPLOY_DIR} (host port ${HOST_PORT})"

ssh "${REMOTE_USER}@${REMOTE_HOST}" \
  REMOTE_DEPLOY_DIR="$DEPLOY_DIR" \
  REMOTE_GIT_URL="$GIT_URL" \
  REMOTE_HOST_PORT="$HOST_PORT" \
  bash -s <<'REMOTE'
set -euo pipefail
DEPLOY_DIR="$REMOTE_DEPLOY_DIR"
GIT_URL="$REMOTE_GIT_URL"
HOST_PORT="$REMOTE_HOST_PORT"

if command -v ss >/dev/null 2>&1; then
  if ss -tlnp 2>/dev/null | grep -qE ":${HOST_PORT}[[:space:]]"; then
    echo "ERROR: port ${HOST_PORT} is already in use. Stop the process or pick another port."
    ss -tlnp | grep -E ":${HOST_PORT}" || true
    exit 1
  fi
  echo "OK: port ${HOST_PORT} is free."
else
  echo "WARN: ss not found; skipping port check."
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not installed on server."
  exit 1
fi

mkdir -p "$(dirname "$DEPLOY_DIR")"

if [ ! -d "$DEPLOY_DIR/.git" ]; then
  echo "==> Cloning into $DEPLOY_DIR ..."
  git clone "$GIT_URL" "$DEPLOY_DIR"
else
  echo "==> git pull ..."
  cd "$DEPLOY_DIR"
  git fetch origin
  git reset --hard origin/main
fi

cd "$DEPLOY_DIR"

echo "==> docker compose build ..."
docker compose build

echo "==> docker compose up -d ..."
docker compose up -d

echo "==> Running containers:"
docker ps --filter "name=invest-yutong-dev-1" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "Done. Open: http://<server-ip>:${HOST_PORT}"
REMOTE

echo "==> Smoke test (from this machine): curl -sI http://${REMOTE_HOST}:${HOST_PORT} | head -5 || true"
