#!/bin/sh
set -e
cd "$(dirname "$0")"

# Compile TypeScript
npx tsc

# Copy static files
cp src/popup/popup.html dist/popup/
cp src/popup/popup.css dist/popup/
mkdir -p dist/icons
cp src/icons/*.png dist/icons/
cp src/manifest.json dist/
