# FOAM LSP — MCP Integration (Claude Code, Codex, Gemini, Cursor, Pi)

Exposes the FOAM Language Server to any MCP-speaking coding agent, so the
agent can query hover, definitions, references, symbols, diagnostics, and
quick fixes against the live FOAM registry — instead of falling back to
text search. One shared zero-dependency server; one install command per
agent, mirroring the per-editor installers.

## Install

```bash
./install.sh            # detect installed agents and prompt
./install.sh claude     # Claude Code        → <root>/.mcp.json
./install.sh codex      # OpenAI Codex CLI   → <root>/.codex/config.toml
./install.sh gemini     # Gemini CLI         → <root>/.gemini/settings.json
./install.sh cursor     # Cursor             → <root>/.cursor/mcp.json
./install.sh pi         # Pi coding agent    → <root>/.pi/mcp.json
./install.sh all        # every detected agent
./install.sh --dry codex  # preview without writing
```

Or via the parent installer: `foam3/tools/lsp/install.sh codex` (and the
`claude-code` name still works there).

Each installer writes (or merges into) the agent's project-scoped config
with a `foam-lsp` MCP server entry, preserving any other entries already
in the file. After installing, restart the agent (Claude Code: run
`/mcp` to reload and approve the project-scoped config).

The LSP takes ~10-15 seconds to index all FOAM models on first startup.
Because the MCP server keeps the LSP alive for the session, only the
first tool call in a given session pays that cost.

## Tools

| Tool | Arguments | Returns |
|---|---|---|
| `foam_hover` | `uri`, `line`, `character` (0-based) | Class docs, property types, method signatures, short-name resolution |
| `foam_definition` | `uri`, `line`, `character` | Source location for classes in `extends:`, `requires:`, `of:`, property types |
| `foam_references` | `uri`, `line`, `character` | Subclasses of a class, implementors of an interface |
| `foam_document_symbols` | `uri` | Outline of a file (classes, properties, methods, actions) |
| `foam_workspace_symbols` | `query` | All FOAM classes matching a name substring |
| `foam_diagnostics` | `uri` (optional) | Unknown classes, bad `foam.nanos.*` imports, CSS-token violations, invalid getters/setters in javaCode |
| `foam_code_actions` | `uri`, `line` (optional) | Quick fixes with ready-to-apply edits: extract hardcoded strings to `messages:` (i18n), raw color → `$token`, wrong Java package, did-you-mean class suggestions |

URIs accept: absolute paths, project-relative paths, or `file://` URIs.

## Architecture

```
MCP agent ──NDJSON──► server.js ──Content-Length JSON-RPC──► lsp-start.js
 (MCP stdio)          (this dir)                             (foam3/tools)
```

- `server.js` — pure Node, zero dependencies. Speaks MCP on its own
  stdin/stdout, spawns the FOAM LSP as a child, translates MCP tool
  calls into LSP JSON-RPC requests.
- `install.sh` — resolves the project root, then writes or merges the
  chosen agent's project-scoped MCP config. JSON-config agents (Claude
  Code, Gemini, Cursor, Pi) share one merge path; Codex gets a
  `[mcp_servers.foam-lsp]` block in `.codex/config.toml`.

## Troubleshooting

**LSP boot never completes.** Check the agent's MCP stderr view (Claude
Code: `/mcp`). The server logs are prefixed `[foam-mcp]` and the LSP's
output is forwarded with `[foam-lsp]`. A syntax error in a model file
is non-fatal — the LSP continues — but a broken `pom.js` will prevent
model indexing.

**Tool returns empty results.** For `foam_workspace_symbols`, the query
matches substrings against full class ids. For position-based tools,
verify the URI + line/character land on a FOAM class reference (not
inside a string literal or Java block that the LSP doesn't yet parse).

**Changing `foam.flags`.** The LSP respects `{ js, java, web, test,
node, swift, debug }` flag state. Toggling flags requires restarting
the LSP — kill the MCP server (restart the agent or reload its MCP
view) and it'll respawn the LSP on the next tool call.

**Uninstall.** Remove the `foam-lsp` entry from the agent's config file
(`.mcp.json`, `.codex/config.toml`, `.gemini/settings.json`,
`.cursor/mcp.json`, or `.pi/mcp.json`) at the project root.

## License

Apache 2.0 (FOAM Authors, 2026). Same as the rest of `foam3/`.
