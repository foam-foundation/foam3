#!/usr/bin/env bash
# Register the FOAM LSP MCP server with one or more MCP-speaking coding
# agents. The server (server.js, zero-dependency Node) is agent-agnostic;
# only the config file each agent reads differs.
#
# Usage:
#   ./install.sh                 # detect installed agents and prompt
#   ./install.sh claude          # Claude Code        -> <root>/.mcp.json
#   ./install.sh codex           # OpenAI Codex CLI   -> <root>/.codex/config.toml
#   ./install.sh gemini          # Gemini CLI         -> <root>/.gemini/settings.json
#   ./install.sh cursor          # Cursor             -> <root>/.cursor/mcp.json
#   ./install.sh pi              # Pi coding agent    -> <root>/.pi/mcp.json
#   ./install.sh all             # every detected agent
#   ./install.sh claude codex    # any combination
#   ./install.sh --dry <agent>   # print what would be written, no write
#
# All configs are project-scoped so the FOAM_PROJECT_ROOT env the server
# needs is correct per checkout.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_JS="$SCRIPT_DIR/server.js"
SERVER_NAME="foam-lsp"

# --- sanity checks --------------------------------------------------------

if ! command -v node &>/dev/null; then
  echo "ERROR: node is not installed. Install Node.js first." >&2
  exit 1
fi

if [ ! -f "$SERVER_JS" ]; then
  echo "ERROR: MCP server not found at $SERVER_JS" >&2
  exit 1
fi

# --- locate project root -------------------------------------------------
#
# This script lives at <root>/foam3/tools/lsp/editors/mcp/, so the project
# root is exactly 5 levels up. (Walking upward by "pom.js + foam3/" is
# unreliable because foam3/ self-symlinks foam3 -> .)

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

DRY=0

# --- writers ---------------------------------------------------------------
#
# merge_mcp_json FILE — merge mcpServers.foam-lsp into a JSON file whose
# top-level mcpServers object follows the Claude Code shape. Used verbatim
# by Claude Code (.mcp.json), Pi (.pi/mcp.json), Cursor (.cursor/mcp.json),
# and Gemini CLI (.gemini/settings.json — same key inside its settings).

merge_mcp_json() {
  local file="$1"
  local out
  out="$(
    node -e '
      const fs = require("fs");
      const p      = process.argv[1];
      const server = process.argv[2];
      const root   = process.argv[3];
      const name   = process.argv[4];
      let cfg = {};
      if ( fs.existsSync(p) ) {
        try { cfg = JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { cfg = {}; }
      }
      if ( ! cfg.mcpServers ) cfg.mcpServers = {};
      cfg.mcpServers[name] = {
        command: "node",
        args:    [server],
        env:     { FOAM_PROJECT_ROOT: root }
      };
      process.stdout.write(JSON.stringify(cfg, null, 2) + "\n");
    ' "$file" "$SERVER_JS" "$PROJECT_ROOT" "$SERVER_NAME"
  )"
  if [ "$DRY" = 1 ]; then
    echo "--- Dry run — would write to $file ---"
    echo "$out"
    return 0
  fi
  mkdir -p "$(dirname "$file")"
  printf '%s' "$out" > "$file"
  echo "OK — wrote $file"
}

# merge_codex_toml FILE — replace-or-append the [mcp_servers.foam-lsp]
# block in a Codex config.toml, preserving everything else as plain text
# (no TOML parser needed for blocks keyed by their own headers).

merge_codex_toml() {
  local file="$1"
  local out
  out="$(
    node -e '
      const fs = require("fs");
      const p      = process.argv[1];
      const server = process.argv[2];
      const root   = process.argv[3];
      const name   = process.argv[4];
      let text = "";
      if ( fs.existsSync(p) ) text = fs.readFileSync(p, "utf8");
      const block =
        "[mcp_servers." + name + "]\n" +
        "command = \"node\"\n" +
        "args = [\"" + server + "\"]\n" +
        "\n" +
        "[mcp_servers." + name + ".env]\n" +
        "FOAM_PROJECT_ROOT = \"" + root + "\"\n";
      // Drop any existing [mcp_servers.<name>] / [mcp_servers.<name>.env]
      // blocks: the header line plus every following line that is not a
      // new [table] header (a bare [^\[]* would stop at the [ inside an
      // args = ["..."] value and leave half the old block behind).
      const re = new RegExp(
        "^\\[mcp_servers\\." + name + "(\\.env)?\\][^\\n]*\\n(?:(?!\\[)[^\\n]*\\n?)*", "gm");
      text = text.replace(re, "");
      text = text.replace(/\n{3,}/g, "\n\n");
      if ( text && ! text.endsWith("\n\n") ) text += text.endsWith("\n") ? "\n" : "\n\n";
      process.stdout.write(text + block);
    ' "$file" "$SERVER_JS" "$PROJECT_ROOT" "$SERVER_NAME"
  )"
  if [ "$DRY" = 1 ]; then
    echo "--- Dry run — would write to $file ---"
    echo "$out"
    return 0
  fi
  mkdir -p "$(dirname "$file")"
  printf '%s' "$out" > "$file"
  echo "OK — wrote $file"
}

# --- agents ----------------------------------------------------------------

install_claude() {
  echo "==> Claude Code"
  if ! command -v claude &>/dev/null; then
    echo "    note: 'claude' CLI not found in PATH — writing config anyway."
  fi
  merge_mcp_json "$PROJECT_ROOT/.mcp.json"
  echo "    Restart Claude Code (or run /mcp) and approve the project .mcp.json."
}

install_codex() {
  echo "==> OpenAI Codex CLI"
  if ! command -v codex &>/dev/null; then
    echo "    note: 'codex' CLI not found in PATH — writing config anyway."
  fi
  merge_codex_toml "$PROJECT_ROOT/.codex/config.toml"
  echo "    Project-scoped .codex/config.toml applies in trusted projects;"
  echo "    for the global config use: codex mcp add $SERVER_NAME \\"
  echo "      --env FOAM_PROJECT_ROOT=$PROJECT_ROOT -- node $SERVER_JS"
}

install_gemini() {
  echo "==> Gemini CLI"
  if ! command -v gemini &>/dev/null; then
    echo "    note: 'gemini' CLI not found in PATH — writing config anyway."
  fi
  merge_mcp_json "$PROJECT_ROOT/.gemini/settings.json"
}

install_cursor() {
  echo "==> Cursor"
  merge_mcp_json "$PROJECT_ROOT/.cursor/mcp.json"
}

install_pi() {
  echo "==> Pi coding agent"
  if ! command -v pi &>/dev/null; then
    echo "    note: 'pi' CLI not found in PATH — writing config anyway."
  fi
  merge_mcp_json "$PROJECT_ROOT/.pi/mcp.json"
}

AGENTS="claude codex gemini cursor pi"

detect_agents() {
  local found=()
  command -v claude &>/dev/null && found+=("claude")
  command -v codex  &>/dev/null && found+=("codex")
  command -v gemini &>/dev/null && found+=("gemini")
  command -v cursor &>/dev/null && found+=("cursor")
  command -v pi     &>/dev/null && found+=("pi")
  echo "${found[@]:-}"
}

install_agent() {
  case "$1" in
    claude|claude-code|claude_code) install_claude ;;
    codex)                          install_codex ;;
    gemini)                         install_gemini ;;
    cursor)                         install_cursor ;;
    pi)                             install_pi ;;
    *)
      echo "Unknown agent: $1" >&2
      echo "Available: $AGENTS" >&2
      return 1
      ;;
  esac
}

print_tools() {
  echo ""
  echo "  Available tools:"
  echo "    foam_hover              hover info at a cursor position"
  echo "    foam_definition         jump to definition"
  echo "    foam_references         find subclasses / implementors / view-spec users"
  echo "    foam_document_symbols   outline of a file"
  echo "    foam_workspace_symbols  search classes by name"
  echo "    foam_diagnostics        FOAM-aware diagnostics"
  echo "    foam_code_actions       quick fixes (i18n messages, \$css-tokens, imports)"
  echo ""
  echo "  First tool call pays ~10-15s LSP boot per session; then fast."
}

# --- main -------------------------------------------------------------------

ARGS=()
for a in "$@"; do
  case "$a" in
    --dry)        DRY=1 ;;
    --help|-h)    sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)            ARGS+=("$a") ;;
  esac
done

echo "==> FOAM LSP MCP — project root: $PROJECT_ROOT"
echo ""

if [ "${#ARGS[@]}" -eq 0 ]; then
  detected="$(detect_agents)"
  if [ -z "$detected" ]; then
    echo "No supported agents detected in PATH."
    echo "Supported: $AGENTS"
    echo "Run with an explicit agent: $0 claude"
    exit 1
  fi
  echo "Detected agents: $detected"
  read -rp "Install for which agent? (name, 'all', or 'q'): " choice
  case "$choice" in
    q|Q) exit 0 ;;
    a|all|A) for ag in $detected; do install_agent "$ag"; echo ""; done ;;
    *) install_agent "$choice" ;;
  esac
elif [ "${ARGS[0]}" = "all" ]; then
  detected="$(detect_agents)"
  if [ -z "$detected" ]; then
    echo "No supported agents detected in PATH. Supported: $AGENTS"
    exit 1
  fi
  for ag in $detected; do install_agent "$ag"; echo ""; done
else
  for ag in "${ARGS[@]}"; do install_agent "$ag"; echo ""; done
fi

print_tools
