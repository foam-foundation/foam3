#!/usr/bin/env bash
# Build and install the FOAM3 Language Support extension into VS Code.
#
# Usage:
#   ./install.sh          # build + install
#   ./install.sh --build  # build .vsix only (no install)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> Installing npm dependencies..."
npm install --no-audit --no-fund

echo "==> Compiling TypeScript..."
npm run compile

# Derive the extension version at package time: patch = number of commits
# that touched this directory. Every merged extension change produces a
# higher version, so editors detect the rebuilt VSIX as an update — a fixed
# version means VS Code silently keeps the previously installed files
# (grammar included) forever. The repo's package.json stays untouched.
# Caveat: uncommitted local edits don't bump the count; the --force install
# below replaces the files regardless.
ORIG_VERSION=$(node -p "require('./package.json').version")
BASE_VERSION=$(echo "$ORIG_VERSION" | cut -d. -f1-2)
PATCH=$(git rev-list --count HEAD -- . 2>/dev/null || echo 0)
VERSION="${BASE_VERSION}.${PATCH}"

echo "==> Packaging .vsix (version $VERSION)..."
cp package.json package.json.orig
trap 'mv package.json.orig package.json' EXIT
node -e "
  const fs = require('fs');
  const p = require('./package.json');
  p.version = '$VERSION';
  fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
"
npm run package

VSIX=$(ls -t foam-lsp-*.vsix 2>/dev/null | head -1)

if [ -z "$VSIX" ]; then
  echo "ERROR: No .vsix file produced."
  exit 1
fi

if [ "${1:-}" = "--build" ]; then
  echo "==> Built: $VSIX"
  echo "    Install manually: code --install-extension $VSIX"
  exit 0
fi

echo "==> Installing $VSIX into VS Code..."
code --install-extension "$VSIX" --force

echo ""
echo "============================================================"
echo "  FOAM3 Language Support installed successfully."
echo ""
echo "  >>> Restart VS Code for the extension to load. <<<"
echo ""
echo "  The extension activates automatically in any workspace"
echo "  containing pom.js. The LSP server takes ~10-15 seconds"
echo "  to index all models on first startup."
echo "============================================================"
