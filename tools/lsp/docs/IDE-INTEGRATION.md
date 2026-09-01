# FOAM LSP — IDE Integration Guide

The FOAM Language Server provides code intelligence for FOAM3 model files across
any editor that supports the Language Server Protocol. This document explains how
the server works, what it provides, and how to connect it from VS Code, Emacs,
Zed, or any LSP-compatible editor.

## Architecture

```
  Editor (client)            FOAM LSP Server (Node.js)
  ─────────────────          ────────────────────────────────
  VS Code extension          server.js  (JSON-RPC main loop)
  Emacs eglot/lsp-mode           │
  Zed extension                  ├── FileModelCache.js  (eval-intercept model extraction)
  Neovim lspconfig               ├── FoamIndex.js       (class registry queries)
  Any LSP client                 ├── FoamClassGrammar.js (grammar parser for completions)
                                 ├── CursorAnalyzer.js   (shared text/position utilities)
       ──stdio──►                ├── TypeTracker.js      (variable type resolution)
    JSON-RPC 2.0                 ├── CSSTokenResolver.js (CSS token resolution)
    over stdin/stdout            └── handlers/
                                     ├── CompletionHandler.js
                                     ├── MemberCompletionHandler.js
                                     ├── HoverHandler.js
                                     ├── DefinitionHandler.js
                                     ├── DiagnosticsHandler.js
                                     ├── JavaBlockValidator.js
                                     ├── SymbolHandler.js
                                     ├── WorkspaceAnalyzer.js
                                     ├── SemanticTokenHandler.js
                                     ├── ReferencesHandler.js
                                     └── JrlHandler.js
```

### Transport

The server communicates over **stdio** using the Language Server Protocol wire
format: JSON-RPC 2.0 messages with `Content-Length` headers.

```
Content-Length: 123\r\n
\r\n
{"jsonrpc":"2.0","id":1,"method":"textDocument/hover","params":{...}}
```

- **stdin**: receives requests and notifications from the editor
- **stdout**: sends responses and notifications back to the editor
- **stderr**: diagnostic logging (all `console.log` output is redirected here)

### Boot Sequence

1. The editor spawns: `node foam3/tools/lsp-start.js [pom-path]`
2. `lsp-start.js` redirects console.log to stderr, sets up FOAM buildlib globals
3. `pmake` loads the FOAM runtime, walks all POM files, loads all model definitions
4. `LSPMaker.js` builds a file index (4300+ classes) and starts the JSON-RPC loop
5. The server responds to `initialize` with its capability list
6. Boot takes ~10-15 seconds (loading the full FOAM class registry)

### POM Path

The optional `pom-path` argument tells the server where the root POM file is.
If omitted, the server looks for `pom.js` in the current working directory.
Example:

```bash
node foam3/tools/lsp-start.js pom                    # relative to cwd
node foam3/tools/lsp-start.js /path/to/my-project/pom   # absolute path
```

## Capabilities

The FOAM LSP server announces these capabilities to the editor:

| Capability | LSP Method | Description |
|---|---|---|
| **Completion** | `textDocument/completion` | Property types (76 types), class names (4300+), `this.` members, `.create({})` properties, CSS tokens, Java getters/setters |
| **Hover** | `textDocument/hover` | Class documentation, method signatures, property types, Java block type info, CSS token colors |
| **Go-to-Definition** | `textDocument/definition` | Navigate to class source files, property type definitions |
| **Find References** | `textDocument/references` | Find subclasses and interface implementors |
| **Diagnostics** | server push notification | Unknown classes, wrong property types, incorrect Java imports, invalid getter/setter calls |
| **Document Symbols** | `textDocument/documentSymbol` | Outline of properties, methods, actions, listeners |
| **Signature Help** | `textDocument/signatureHelp` | Method parameter hints (triggered by `(` and `,`) |
| **Workspace Symbols** | `workspace/symbol` | Search all FOAM classes by name |
| **Folding Ranges** | `textDocument/foldingRange` | Fold properties, methods, requires, imports, exports, javaImports, actions, listeners |
| **Semantic Tokens** | `textDocument/semanticTokens/full` | Highlights resolved class references and typed variables |
| **Code Actions** | `textDocument/codeAction` | "Did you mean X?" for unknown classes, fix wrong Java imports |
| **JRL Support** | (hover + semantic tokens) | Hover and highlighting for `.jrl` (FOAM Journal) files |

### Experimental

| Method | Description |
|---|---|
| `foam/analyzeWorkspace` | Full codebase scan with pattern grouping and diagnostic categorization |

## Supported File Types

| File Type | Language ID | Features |
|---|---|---|
| `*.js` containing `foam.CLASS`, `foam.ENUM`, `foam.INTERFACE` | `javascript` | All capabilities |
| `*.jrl` (FOAM Journal files) | `foam-journal` | Hover, semantic tokens |

## Connecting Any Editor

Any editor with LSP support can connect to the FOAM server. The general pattern:

1. **Command**: `node foam3/tools/lsp-start.js`
2. **Arguments**: optional POM path (defaults to `pom` in cwd)
3. **Working directory**: your FOAM project root (the directory containing `pom.js`)
4. **Transport**: stdio (the default for most LSP clients)
5. **Language IDs**: `javascript`, `foam-journal`

The server expects the editor to send standard LSP lifecycle messages:
`initialize` → `initialized` → document sync → feature requests → `shutdown` → `exit`.

## Quick Install

The fastest way to set up any editor:

```bash
# Auto-detect editors and prompt
foam3/tools/lsp/install.sh

# Install for a specific editor
foam3/tools/lsp/install.sh vscode
foam3/tools/lsp/install.sh emacs
foam3/tools/lsp/install.sh zed

# Install for all detected editors
foam3/tools/lsp/install.sh all

# Via the build system
./build.sh lsp-install
./build.sh lsp-install:vscode
```

## Editor Setup

### VS Code

The dedicated VS Code extension lives at `foam3/tools/lsp/editors/vscode/`. It provides the
LSP client plus a sidebar panel for workspace analysis and flag management.

**Install locally:**

```bash
cd foam3/tools/lsp/editors/vscode
./install.sh
```

Or manually:

```bash
cd foam3/tools/lsp/editors/vscode
npm install
npm run compile
npm run package
code --install-extension foam-lsp-*.vsix
```

See `foam3/tools/lsp/editors/vscode/README.md` for development and debugging instructions.

### Emacs

Both **eglot** (built-in since Emacs 29) and **lsp-mode** are supported.

**eglot (zero dependencies)** — add to your `init.el`:

```elisp
(with-eval-after-load 'eglot
  (add-to-list 'eglot-server-programs
               '((js-mode js-ts-mode) . ("node" "/path/to/foam3/tools/lsp-start.js"))))
```

Then open a FOAM `.js` file and run `M-x eglot`.

**lsp-mode** — install the `lsp-foam.el` client:

```bash
cd foam3/tools/lsp/editors/emacs
./install.sh
```

See `foam3/tools/lsp/editors/emacs/README.md` for the full setup guide.

### Zed

Install the FOAM3 extension as a dev extension:

1. Open Zed
2. Open Command Palette → "zed: extensions"
3. Click "Install Dev Extension"
4. Select the `foam3/tools/lsp/editors/zed-foam3/` directory

Zed compiles the extension automatically. Requires Rust installed via `rustup`.

See `foam3/tools/lsp/editors/zed-foam3/README.md` for details.

### Neovim

Using `nvim-lspconfig`, add to your `init.lua`:

```lua
local lspconfig = require('lspconfig')
local configs = require('lspconfig.configs')

if not configs.foam_lsp then
  configs.foam_lsp = {
    default_config = {
      cmd = { 'node', 'foam3/tools/lsp-start.js' },
      filetypes = { 'javascript' },
      root_dir = lspconfig.util.root_pattern('pom.js', 'foam3'),
      settings = {},
    },
  }
end

lspconfig.foam_lsp.setup({})
```

### Sublime Text

Install the [LSP](https://github.com/sublimelsp/LSP) package, then add to
LSP Settings → Clients:

```json
{
  "foam-lsp": {
    "enabled": true,
    "command": ["node", "foam3/tools/lsp-start.js"],
    "selector": "source.js",
    "initializationOptions": {}
  }
}
```

### Other Editors

For any LSP-capable editor, configure a language server with:

- **Command**: `node`
- **Arguments**: `["foam3/tools/lsp-start.js"]`
- **Root directory**: the FOAM project root containing `pom.js`
- **File types**: JavaScript (`.js`), FOAM Journal (`.jrl`)
- **Transport**: stdio

## Troubleshooting

### Server does not start

- Verify Node.js is installed: `node --version` (requires Node 18+)
- Verify the path: `ls foam3/tools/lsp-start.js`
- Check `pom.js` exists in your project root
- Run manually to see errors: `node foam3/tools/lsp-start.js 2>/tmp/foam-lsp.log`

### Server starts but no completions

- Wait for boot to complete (~10-15 seconds). Look for the `initialize` response.
- Check stderr for errors: `node foam3/tools/lsp-start.js 2>&1 | head -50`
- Verify your file contains `foam.CLASS(`, `foam.ENUM(`, or `foam.INTERFACE(`

### Diagnostics not showing

- The server publishes diagnostics on file open and save
- Diagnostics respect compilation flags (test/swift/node classes are filtered)
- Run workspace analysis for a full scan

### Wrong Java import suggestions

- The server knows the FOAM3 package renames (e.g., `foam.nanos.*` → `foam.lang.*`)
- Code actions offer automatic fixes for common wrong imports

## Testing the LSP

Quick standalone test (no build required):

```bash
cd <your-project>
node foam3/tools/tests/testFoamLSP.js
```

This runs 200+ tests covering all handlers, the grammar, file model cache, and
type tracker.

## Further Reading

- [LSP README](../README.md) — full technical documentation
- [LSP CLAUDE.md](../CLAUDE.md) — AI agent context and development patterns
- [LSP Specification](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/)
