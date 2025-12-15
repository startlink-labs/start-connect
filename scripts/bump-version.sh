#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: ./scripts/bump-version.sh <version>"
  exit 1
fi

VERSION=$1

# Update tauri.conf.json
sed -i '' "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json

# Update Cargo.toml
sed -i '' "s/^version = \".*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml

# Update package.json
sed -i '' "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json

echo "✅ Updated to v$VERSION"

# Git add, commit, and push
git add src-tauri/tauri.conf.json src-tauri/Cargo.toml package.json
git commit -m "chore: release v$VERSION"
git push origin main

echo "🚀 Pushed to main. GitHub Actions will build the release."
