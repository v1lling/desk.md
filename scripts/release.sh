#!/usr/bin/env bash
set -euo pipefail

# Local release build — replaces GitHub Actions workflow
# Usage: ./scripts/release.sh
#
# Prerequisites:
#   - gh CLI authenticated (brew install gh && gh auth login)
#   - jq installed (brew install jq)
#   - Signing keys: export TAURI_SIGNING_PRIVATE_KEY and TAURI_SIGNING_PRIVATE_KEY_PASSWORD
#     or put them in .env.release (sourced automatically, gitignored)

RELEASES_REPO="v1lling/deskmd-releases"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# ── Source .env.release if it exists ──────────────────────────────────────────
if [ -f .env.release ]; then
  echo "Loading signing keys from .env.release"
  set -a
  source .env.release
  set +a
fi

# ── Verify prerequisites ─────────────────────────────────────────────────────
if ! command -v gh &>/dev/null; then
  echo "ERROR: gh CLI not found. Install with: brew install gh"
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq not found. Install with: brew install jq"
  exit 1
fi

if [ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" ]; then
  echo "ERROR: TAURI_SIGNING_PRIVATE_KEY is not set."
  echo ""
  echo "Either export it in your shell:"
  echo "  export TAURI_SIGNING_PRIVATE_KEY='...'"
  echo "  export TAURI_SIGNING_PRIVATE_KEY_PASSWORD='...'"
  echo ""
  echo "Or create .env.release in the project root:"
  echo "  TAURI_SIGNING_PRIVATE_KEY='...'"
  echo "  TAURI_SIGNING_PRIVATE_KEY_PASSWORD='...'"
  exit 1
fi

# ── Read and verify version ───────────────────────────────────────────────────
PKG_VERSION=$(jq -r '.version' package.json)
TAURI_VERSION=$(jq -r '.version' src-tauri/tauri.conf.json)

if [ "$PKG_VERSION" != "$TAURI_VERSION" ]; then
  echo "ERROR: Version mismatch! package.json: $PKG_VERSION, tauri.conf.json: $TAURI_VERSION"
  exit 1
fi

VERSION="$PKG_VERSION"
echo "Building Desk v${VERSION}"
echo ""

# ── Build ─────────────────────────────────────────────────────────────────────
echo "=== Building Tauri app ==="
# DMG bundling can fail (create-dmg issues) but .app + updater artifacts still get created
npm run tauri:build || true

# ── Find artifacts ────────────────────────────────────────────────────────────
echo ""
echo "=== Finding build artifacts ==="

UPDATER=$(find src-tauri/target/release/bundle -name "Desk.app.tar.gz" | head -1)
SIG_FILE=$(find src-tauri/target/release/bundle -name "Desk.app.tar.gz.sig" | head -1)
DMG=$(find src-tauri/target/release/bundle -name "Desk_${VERSION}_aarch64.dmg" 2>/dev/null | head -1)

if [ -z "$UPDATER" ]; then
  echo "ERROR: Missing updater artifact (Desk.app.tar.gz)!"
  echo ""
  echo "All bundle files:"
  find src-tauri/target/release/bundle -type f 2>/dev/null || true
  exit 1
fi

if [ -z "$SIG_FILE" ]; then
  echo "ERROR: No signature file found! Check that TAURI_SIGNING_PRIVATE_KEY is correct."
  exit 1
fi

SIG_CONTENT=$(cat "$SIG_FILE")
if [ -z "$SIG_CONTENT" ]; then
  echo "ERROR: Signature file is empty!"
  exit 1
fi

echo "Updater: $UPDATER"
echo "Sig:     $SIG_FILE (${#SIG_CONTENT} chars)"
echo "DMG:     ${DMG:-not found (skipping)}"

# ── Prepare release files ─────────────────────────────────────────────────────
RELEASE_DIR="$ROOT_DIR/.release"
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

cp "$UPDATER" "$RELEASE_DIR/Desk.app.tar.gz"
if [ -n "$DMG" ]; then
  cp "$DMG" "$RELEASE_DIR/Desk_${VERSION}_aarch64.dmg"
fi

PUB_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
URL="https://github.com/${RELEASES_REPO}/releases/download/v${VERSION}/Desk.app.tar.gz"

jq -n \
  --arg version "v${VERSION}" \
  --arg notes "Release v${VERSION}" \
  --arg pub_date "$PUB_DATE" \
  --arg sig "$SIG_CONTENT" \
  --arg url "$URL" \
  '{version: $version, notes: $notes, pub_date: $pub_date, platforms: {"darwin-aarch64": {signature: $sig, url: $url}}}' \
  > "$RELEASE_DIR/latest.json"

echo ""
echo "=== latest.json ==="
cat "$RELEASE_DIR/latest.json"
echo ""

# ── Upload to releases repo ──────────────────────────────────────────────────
echo "=== Uploading to ${RELEASES_REPO} ==="

# Delete existing release if present
gh release delete "v${VERSION}" --repo "$RELEASES_REPO" --yes 2>/dev/null || true

# Collect upload files
UPLOAD_FILES=("$RELEASE_DIR/Desk.app.tar.gz" "$RELEASE_DIR/latest.json")
if [ -n "$DMG" ]; then
  UPLOAD_FILES+=("$RELEASE_DIR/Desk_${VERSION}_aarch64.dmg")
fi

# Create release and upload
gh release create "v${VERSION}" \
  --repo "$RELEASES_REPO" \
  --title "Desk v${VERSION}" \
  --notes "Release v${VERSION}" \
  "${UPLOAD_FILES[@]}"

# Cleanup
rm -rf "$RELEASE_DIR"

echo ""
echo "Done! Release v${VERSION} published to ${RELEASES_REPO}"
