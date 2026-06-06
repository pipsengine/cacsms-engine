#!/bin/sh
set -e
cd /app
if [ ! -f node_modules/.docker-ready ]; then
  echo "[cacsms-web] Installing dependencies..."
  npm ci --omit=dev
  touch node_modules/.docker-ready
fi
exec node apps/web/server.mjs
