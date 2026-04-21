#!/usr/bin/env bash
# Register the FOAM LSP MCP server with Claude Code by writing/merging
# `.mcp.json` at the FOAM project root.
#
# Usage:
#   ./install.sh        # detect project root and install
#   ./install.sh --dry  # print the entry that would be written, no write

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_JS="$SCRIPT_DIR/server.js"

# --- sanity checks --------------------------------------------------------

if ! command -v node &>/dev/null; then
  echo "ERROR: node is not installed. Install Node.js first." >&2
  exit 1
fi

if ! command -v claude &>/dev/null; then
  echo "WARNING: 'claude' CLI not found in PATH." >&2
  echo "         Install Claude Code: https://docs.claude.com/en/docs/claude-code/setup" >&2
  echo "         Continuing — .mcp.json will still be written." >&2
fi

if [ ! -f "$SERVER_JS" ]; then
  echo "ERROR: MCP server not found at $SERVER_JS" >&2
  exit 1
fi

# --- locate project root -------------------------------------------------
#
# This script lives at <root>/foam3/tools/lsp/editors/claude-code/, so the
# project root is exactly 5 levels up. (Walking upward by "pom.js + foam3/"
# is unreliable because foam3/ self-symlinks foam3 -> .)

if [ -n "${FOAM_PROJECT_ROOT:-}" ]; then
  PROJECT_ROOT="$FOAM_PROJECT_ROOT"
else
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
fi

if [ ! -f "$PROJECT_ROOT/pom.js" ]; then
  echo "ERROR: $PROJECT_ROOT/pom.js not found — not a FOAM project root." >&2
  echo "       Set FOAM_PROJECT_ROOT explicitly and retry." >&2
  exit 1
fi

MCP_JSON="$PROJECT_ROOT/.mcp.json"

echo "==> FOAM LSP MCP — installing for Claude Code"
echo "    Project root : $PROJECT_ROOT"
echo "    Server       : $SERVER_JS"
echo "    Config       : $MCP_JSON"
echo ""

# --- build the merged config via Node (reliable JSON handling) ----------

NEW_JSON="$(
  node -e '
    const fs = require("fs");
    const p  = process.argv[1];
    const server = process.argv[2];
    const root   = process.argv[3];
    let cfg = {};
    if ( fs.existsSync(p) ) {
      try { cfg = JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { cfg = {}; }
    }
    if ( ! cfg.mcpServers ) cfg.mcpServers = {};
    cfg.mcpServers["foam-lsp"] = {
      command: "node",
      args:    [server],
      env:     { FOAM_PROJECT_ROOT: root }
    };
    process.stdout.write(JSON.stringify(cfg, null, 2) + "\n");
  ' "$MCP_JSON" "$SERVER_JS" "$PROJECT_ROOT"
)"

if [ "${1:-}" = "--dry" ]; then
  echo "--- Dry run — would write to $MCP_JSON ---"
  echo "$NEW_JSON"
  exit 0
fi

printf '%s' "$NEW_JSON" > "$MCP_JSON"

echo "OK — wrote $MCP_JSON"
echo ""
echo "============================================================"
echo "  FOAM LSP MCP server registered."
echo ""
echo "  Next steps:"
echo "    1. Restart Claude Code (or run /mcp to reload)."
echo "    2. Approve the project-scoped .mcp.json if prompted."
echo "    3. First tool call pays ~10-15s LSP boot; then fast."
echo ""
echo "  Available tools:"
echo "    foam_hover              hover info at a cursor position"
echo "    foam_definition         jump to definition"
echo "    foam_references         find subclasses / implementors"
echo "    foam_document_symbols   outline of a file"
echo "    foam_workspace_symbols  search classes by name"
echo "    foam_diagnostics        FOAM-aware diagnostics"
echo ""
echo "  To uninstall: remove the \"foam-lsp\" entry from .mcp.json"
echo "============================================================"
