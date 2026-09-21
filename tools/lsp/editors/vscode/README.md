# FOAM3 Language Support — VS Code Extension

VS Code extension providing code intelligence for FOAM3 model files via the
FOAM Language Server.

## Features

- **Autocomplete** — property types, class names, `this.` members, `.create({})` properties, CSS tokens, Java getters/setters
- **Hover** — class documentation, method signatures, property types, Java block info
- **Go-to-Definition** — navigate to class source files and type definitions
- **Find References** — subclasses and interface implementors
- **Diagnostics** — unknown classes, wrong property types, incorrect Java imports
- **Document Symbols** — outline of properties, methods, actions
- **Workspace Analysis** — sidebar panel with full codebase scan, flag toggles, pattern grouping
- **Semantic Tokens** — highlights resolved class references and typed variables
- **CodeLens** — "N translations missing" above a `messages:` entry (click to translate); optionally "N subclasses" above each class
- **New Class** — `FOAM: New Class` scaffolds a class file and registers it in the nearest `pom.js`, as one undoable edit
- **Status Bar** — boot progress, the active translation model, and a menu to restart the server or open its log
- **Feature Toggles** — turn any diagnostic, hint, or lens off in Settings (`foam.features.*`); a checked-in `foam-lsp.json` sets the team's defaults
- **JRL Support** — hover and highlighting for `.jrl` journal files
- **TextMate Grammars** — Java syntax highlighting inside `javaCode` blocks, JRL syntax

## Install

### One Command

```bash
./install.sh
```

This installs dependencies, compiles TypeScript, packages a `.vsix`, and installs
it into VS Code.

### Manual

```bash
npm install
npm run compile
npm run package
code --install-extension foam-lsp-*.vsix
```

### Build Only (no install)

```bash
./install.sh --build
```

Produces a `.vsix` file you can share or install later with
`code --install-extension foam-lsp-0.1.0.vsix`.

## Development

### Watch Mode

```bash
npm run watch
```

Recompiles on every TypeScript change.

### Debug in VS Code

1. Open the `tools/lsp/editors/vscode/` folder in VS Code
2. Press **F5** (or Run → Start Debugging)
3. A new VS Code window opens with the extension loaded
4. Open a FOAM project in that window to test

The launch configuration is in `.vscode/launch.json`.

### Project Structure

```
tools/lsp/editors/vscode/
  src/
    extension.ts           # LSP client, server startup, status bar
    FoamTreeProvider.ts    # Sidebar tree view (analysis, files, patterns, flags)
    FoamAnalysisRunner.ts  # Workspace analysis runner + progress handler
  syntaxes/
    foam-jrl.tmLanguage.json   # FOAM Journal syntax highlighting
    foam-js.tmLanguage.json    # Java injection grammar for javaCode blocks
  resources/
    foam-icon.svg          # Sidebar icon
  package.json             # Extension manifest
  tsconfig.json            # TypeScript configuration
  .vscodeignore            # Files excluded from .vsix package
```

## How It Works

The extension spawns the FOAM LSP server as a child process:

```
node foam3/tools/lsp-start.js <pom-path>
```

Communication uses JSON-RPC 2.0 over stdio. The server boots the full FOAM
runtime (~10-15 seconds), then serves language features.

### Activation

The extension activates when VS Code detects:
- A `pom.js` file in the workspace root
- A `foam3/src/foam.js` file in the workspace
- Any JavaScript or `.jrl` file is opened

### Status Bar

During boot: `$(loading~spin) FOAM: Indexing...`
After ready: `$(check) FOAM: Ready` (plus the translation model name when one
is reachable, e.g. `FOAM: Ready · translategemma:4b`)
After a failed start: `$(error) FOAM: Error`

Click it for a menu: **Restart FOAM LSP** (also the way to pick up a changed
feature flag — they're read once at boot) or **Show Output**.

### New Class

`FOAM: New Class` from the command palette prompts for a class name and
scaffolds it into the active editor's folder (or the first workspace folder
when nothing is open). The server builds the whole change — new file, license
header copied from a sibling, and the `pom.js` `files:` entry — as one
WorkspaceEdit, so it is a single undo away.

### Sidebar Panel

Click the FOAM icon in the activity bar to open the sidebar:

- **Analysis** — run workspace analysis, view stats
- **Files with Issues** — expandable tree with clickable diagnostics
- **Patterns** — grouped diagnostic patterns with counts
- **Active Flags** — toggle js, java, web, test, node, swift flags
- **Server Info** — indexed classes, files, property types

### Configuration

| Setting | Default | Description |
|---|---|---|
| `foam.buildScript` | `./build.sh` | Path to build script relative to workspace root |
| `foam.nodePath` | (empty) | Node binary that launches the server; empty uses the Node bundled with VS Code |
| `foam.features.*` | see Settings | One boolean per feature — diagnostics, hints, completion, hover, semantic tokens, signature help, folding, and each CodeLens |
| `foam.i18n.*` | see Settings | `languages`, `sourceLanguage`, `endpoint`, `model` for the translation provider |

Only settings you have actually changed are forwarded to the server, so a
`foam-lsp.json` at the workspace root (the team's checked-in defaults) stays
authoritative for everything you left alone. Both are read once at boot —
restart the server from the status bar to apply a change.

## npm Scripts

| Script | Description |
|---|---|
| `npm run compile` | Compile TypeScript to `out/` |
| `npm run watch` | Compile in watch mode |
| `npm run package` | Build `.vsix` for distribution |

## Requirements

- Node.js 18+
- VS Code 1.85+
- A FOAM3 project with `pom.js` in the workspace root
