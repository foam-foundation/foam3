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

echo "==> Packaging .vsix..."
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
