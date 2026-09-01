#!/usr/bin/env bash
# Install the FOAM3 Language Support extension into Zed as a dev extension.
#
# Prerequisites:
#   - Zed IDE installed
#   - Rust installed via rustup (not Homebrew)
#
# Zed compiles the Rust code to WASM automatically on install.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> FOAM3 Language Support — Zed Setup"
echo ""

# Check prerequisites
if ! command -v rustc &>/dev/null; then
  echo "ERROR: Rust is not installed."
  echo "       Install via rustup: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  echo "       NOTE: Homebrew Rust will not work — Zed requires rustup."
  exit 1
fi

echo "Extension directory: $SCRIPT_DIR"
echo ""
echo "To install the extension in Zed:"
echo ""
echo "  1. Open Zed"
echo "  2. Open Command Palette (Cmd+Shift+P)"
echo "  3. Type: 'zed: extensions'"
echo "  4. Click 'Install Dev Extension'"
echo "  5. Select this directory:"
echo "     $SCRIPT_DIR"
echo ""
echo "Zed will compile the Rust extension to WASM automatically."
echo "After installation, the FOAM LSP activates for any JavaScript file"
echo "in a workspace containing pom.js."
echo ""
echo "--- Optional: Override server settings ---"
echo ""
echo "Add to your Zed settings.json (~/.config/zed/settings.json):"
echo ""
echo '  "lsp": {'
echo '    "foam3-lsp": {'
echo '      "binary": {'
echo '        "path": "/path/to/node",'
echo '        "arguments": ["foam3/tools/lsp-start.js"]'
echo '      }'
echo '    }'
echo '  }'
echo ""
echo "The default uses 'node' from PATH and 'foam3/tools/lsp-start.js'"
echo "relative to the workspace root."
echo ""
echo "--- Java syntax highlighting in javaCode: blocks ---"
echo ""
echo "For Java highlighting inside javaCode:, javaFactory:, javaPreSet:, etc.:"
echo "  Install the 'Java' extension in Zed (Command Palette → 'zed: extensions' → search 'Java')"
echo ""
echo "The FOAM JavaScript language automatically handles .js files with"
echo "Java injection rules. No extra configuration needed."
