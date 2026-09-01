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

Navigation tools are **name-addressable**: pass `symbol` (a class id like
`foam.u2.DetailView`, a short class name like `DetailView`, or `Class.member`
like `foam.u2.DetailView.data`) instead of `uri` + `line` + `character`. This lets an
agent trace by name without first opening the file to count columns. Results
come back as compact `path:line:character` text (paths project-relative,
positions 0-based) rather than raw LSP JSON.

| Tool | Arguments | Returns |
|---|---|---|
| `foam_hover` | `symbol` \| `uri`+`line`+`character` | Class docs, property types, method signatures, short-name resolution |
| `foam_definition` | `symbol` \| `uri`+`line`+`character` | Source location for classes in `extends:`, `requires:`, `of:`, property types |
| `foam_references` | `symbol` \| `uri`+`line`+`character` | Subclasses, interface implementors, and JS/Java/string usages |
| `foam_implementation` | `symbol` \| `uri`+`line`+`character` | Concrete implementors of an interface (or direct subclasses) |
| `foam_type_definition` | `symbol` \| `uri`+`line`+`character` | For a property usage, the property's type class |
| `foam_type_hierarchy` | `symbol` \| position, `direction` (`subtypes`/`supertypes`/`both`) | Supertypes (extends chain) and/or subtypes (subclasses + implementors) |
| `foam_call_hierarchy` | `symbol` \| position, `direction` (`incoming`/`outgoing`/`both`) | Method callers and/or callees |
| `foam_document_symbols` | `uri` | Outline of a file (classes, properties, methods, actions) with lines |
| `foam_workspace_symbols` | `query` | Ranked class/property/method matches (capped at 60; narrow to see more) |
| `foam_diagnostics` | `uri` (optional) | Unknown classes, bad `foam.nanos.*` imports, CSS-token violations, invalid getters/setters in javaCode |
| `foam_code_actions` | `uri`, `line` (optional) | Quick fixes with ready-to-apply edits: extract hardcoded strings to `messages:` (i18n), raw color → `$token`, wrong Java package, did-you-mean class suggestions |
| `foam_i18n_translate` | `file`, `messageName` (optional), `languages` (optional) | Translates `messages:` entries missing configured languages. Provider up: translates + writes the edit to disk. Provider down: a `needs-translations` payload for the agent to translate itself and hand back via `foam_i18n_apply` |
| `foam_i18n_apply` | `file`, `translations` (`{ NAME: { lang: '...' } }`) | Applies agent-supplied translations, validating every placeholder survives, and writes the edit to disk |

URIs accept: absolute paths, project-relative paths, or `file://` URIs.
`foam_i18n_translate`/`foam_i18n_apply` take `file` (same path forms) instead
of `uri` since they're single-file tools, not position-based navigation.

## Two-Phase i18n Translation

`foam_i18n_translate` and `foam_i18n_apply` write straight to disk — unlike
the navigation tools, there's no editor client in a headless MCP host to hand
a `workspace/applyEdit` to, so the MCP server applies the LSP's edit itself
(`editors/mcp/server.js:82-96`, descending-offset order per file so earlier
edits never invalidate later ones' offsets).

`foam_i18n_translate` always checks `foam/i18nStatus` first
(`editors/mcp/server.js:757-793`):

- **Provider reachable** (a local Ollama/LM Studio/etc. server has the
  configured model loaded): translates for real and applies the edit — one
  tool call, done.
- **Provider unreachable**: instead of failing, it returns a
  `needs-translations` payload — `{ status: 'needs-translations', strings:
  { NAME: 'source text' }, targetLanguages, instructions }` — built from the
  LSP's `dryRun:true` path (no network call from the LSP side either). The
  calling agent translates each string itself (any coding agent already
  speaks translation), preserving `${...}` placeholders, `{0}` tokens, and
  HTML tags exactly, then calls `foam_i18n_apply` with `{ file, translations:
  { NAME: { fr: '...' } } }`. `foam_i18n_apply` re-validates that every
  placeholder present in the source survived in each offered translation
  before writing anything — an agent's translation is untrusted the same way
  a model's is, so a dropped `${name}` fails the whole call (listing every
  offending message name) rather than silently applying a broken UI string.

This two-phase shape means i18n translation works whether or not the user has
a local model running: with one, it's a single `foam_i18n_translate` call;
without one, the coding agent itself becomes the translation provider via the
`foam_i18n_translate` → translate → `foam_i18n_apply` round trip.

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
