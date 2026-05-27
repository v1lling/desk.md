#!/usr/bin/env bash
#
# Download the latest Desk release DMG, install it to /Applications, and strip
# the macOS quarantine flag so it opens without the "is damaged" Gatekeeper error.
#
# Requires: gh (authenticated — the desk.md repo is private).
# Usage: ./scripts/install-latest.sh

set -euo pipefail

REPO="v1lling/desk.md"
APP_NAME="Desk.app"
INSTALL_DIR="/Applications"

command -v gh >/dev/null || { echo "error: gh CLI not found — install it and run 'gh auth login'"; exit 1; }

TAG=$(gh release view --repo "$REPO" --json tagName -q .tagName)
echo "Latest release: $TAG"

WORK_DIR=$(mktemp -d)
MOUNT_DIR=$(mktemp -d)

cleanup() {
  hdiutil detach "$MOUNT_DIR" -quiet 2>/dev/null || true
  rm -rf "$WORK_DIR" "$MOUNT_DIR"
}
trap cleanup EXIT

echo "Downloading DMG…"
gh release download "$TAG" --repo "$REPO" --pattern '*.dmg' --dir "$WORK_DIR"
DMG=$(find "$WORK_DIR" -name '*.dmg' | head -1)
[ -n "$DMG" ] || { echo "error: no DMG asset found in release $TAG"; exit 1; }

echo "Mounting DMG…"
hdiutil attach -nobrowse -mountpoint "$MOUNT_DIR" "$DMG" >/dev/null
APP_SRC=$(find "$MOUNT_DIR" -maxdepth 1 -name '*.app' | head -1)
[ -n "$APP_SRC" ] || { echo "error: no .app found inside DMG"; exit 1; }

# Quit a running instance so the bundle can be replaced cleanly.
osascript -e 'quit app "Desk"' 2>/dev/null || true

echo "Installing to ${INSTALL_DIR}/${APP_NAME}…"
rm -rf "${INSTALL_DIR:?}/$APP_NAME"
cp -R "$APP_SRC" "$INSTALL_DIR/$APP_NAME"

echo "Stripping quarantine flag…"
xattr -dr com.apple.quarantine "$INSTALL_DIR/$APP_NAME"

echo "Done — $TAG installed. Launch it with: open '$INSTALL_DIR/$APP_NAME'"
