# FOAM LSP — Claude Code MCP Integration

Exposes the FOAM Language Server to Claude Code as an MCP (Model Context
Protocol) server, so Claude can query hover, definitions, references,
symbols, and diagnostics against the live FOAM registry — instead of
falling back to text search.

## Install

```bash
./install.sh
```

The installer writes (or merges into) `.mcp.json` at the FOAM project
root with a `foam-lsp` MCP server entry. Restart Claude Code (or run
`/mcp` to reload). On first prompt, approve the project-scoped `.mcp.json`.

The LSP takes ~10-15 seconds to index all FOAM models on first startup.
Because the MCP server keeps the LSP alive for the session, only the
first tool call in a given Claude Code session pays that cost.

## Tools

| Tool | Arguments | Returns |
|---|---|---|
| `foam_hover` | `uri`, `line`, `character` (0-based) | Class docs, property types, method signatures, short-name resolution |
| `foam_definition` | `uri`, `line`, `character` | Source location for classes in `extends:`, `requires:`, `of:`, property types |
| `foam_references` | `uri`, `line`, `character` | Subclasses of a class, implementors of an interface |
| `foam_document_symbols` | `uri` | Outline of a file (classes, properties, methods, actions) |
| `foam_workspace_symbols` | `query` | All FOAM classes matching a name substring |
| `foam_diagnostics` | `uri` (optional) | Unknown classes, bad `foam.nanos.*` imports, CSS-token violations, invalid getters/setters in javaCode |

URIs accept: absolute paths, project-relative paths, or `file://` URIs.

## Architecture

```
Claude Code ──NDJSON──► server.js ──Content-Length JSON-RPC──► lsp-start.js
  (MCP stdio)           (this dir)                             (foam3/tools)
```

- `server.js` — pure Node, zero dependencies. Speaks MCP on its own
  stdin/stdout, spawns the FOAM LSP as a child, translates MCP tool
  calls into LSP JSON-RPC requests.
- `install.sh` — detects the project root (first ancestor with `pom.js`
  and a `foam3/` dir), writes or merges `.mcp.json`.

## Troubleshooting

**LSP boot never completes.** Check stderr output in Claude Code's
`/mcp` view. The server logs are prefixed `[foam-mcp]` and the LSP's
output is forwarded with `[foam-lsp]`. A syntax error in a model file
is non-fatal — the LSP continues — but a broken `pom.js` will prevent
model indexing.

**Tool returns empty results.** For `foam_workspace_symbols`, the query
matches substrings against full class ids. For position-based tools,
verify the URI + line/character land on a FOAM class reference (not
inside a string literal or Java block that the LSP doesn't yet parse).

**Changing `foam.flags`.** The LSP respects `{ js, java, web, test,
node, swift, debug }` flag state. Toggling flags requires restarting
the LSP — kill the MCP server (via `/mcp` or restart Claude Code) and
it'll respawn the LSP on the next tool call.

**Uninstall.** Remove the `foam-lsp` entry from `.mcp.json` at the
project root.

## License

Apache 2.0 (FOAM Authors, 2026). Same as the rest of `foam3/`.
