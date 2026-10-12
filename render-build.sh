#!/usr/bin/env bash
# Render build: Python backend + Vite frontend, served as one service.
set -o errexit

echo "--- Installing Python deps ---"
pip install -r requirements.txt

echo "--- Building dashboard ---"
if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm not found in build environment" >&2
  exit 1
fi
cd dashboard
npm ci
npm run build
cd ..

echo "--- Verifying dashboard build ---"
ls dashboard/dist/index.html
echo "Build OK"
