# FOAM LSP — Language Server Protocol for FOAM3

A runtime-aware Language Server for FOAM3 that provides autocomplete, hover, go-to-definition, diagnostics, workspace analysis, and Java code validation for `foam.CLASS`, `foam.ENUM`, and `foam.INTERFACE` definitions.

## Quick Start

```bash
# Run from your FOAM project root (e.g., ptv3/):
node foam3/tools/lsp-start.js

# Run tests:
cd <your-project> && node foam3/tools/tests/testFoamLSP.js

# VS Code debug mode:
cd foam3/tools/lsp/editors/vscode && npm install && npx tsc -p ./
# Open foam3/tools/lsp/editors/vscode/ in VS Code, press F5
```

## Architecture

```
VS Code Extension (TypeScript)              FOAM LSP Server (Node.js)
tools/lsp/editors/vscode/                    tools/lsp/

  extension.ts ──stdio──►  server.js (JSON-RPC main loop)
  FoamTreeProvider.ts                │
  FoamAnalysisRunner.ts              ├── FileModelCache.js (eval-intercept model extraction)
                                     ├── FoamIndex.js (class registry queries)
                                     ├── FoamClassGrammar.js (FOAM grammar parser)
                                     ├── CursorAnalyzer.js (shared text utilities)
                                     ├── TypeTracker.js (variable type resolution)
                                     └── handlers/
                                         ├── CompletionHandler.js
                                         ├── HoverHandler.js
                                         ├── DefinitionHandler.js
                                         ├── DiagnosticsHandler.js
                                         ├── MemberCompletionHandler.js
                                         ├── SymbolHandler.js
                                         ├── JavaBlockValidator.js
                                         ├── WorkspaceAnalyzer.js
                                         └── SemanticTokenHandler.js
```

### Boot Sequence

1. `lsp-start.js` redirects console.log to stderr, sets buildlib globals
2. `pmake` loads FOAM runtime via `foam_node.js`, walks all POMs, loads all models
3. `LSPMaker.js` runs after POM traversal — builds file index, starts server
4. `server.js` creates FoamIndex, FileModelCache, grammar, handlers — listens on stdio for JSON-RPC

### Key Components

#### FileModelCache (`tools/lsp/FileModelCache.js`)
Eval-intercept cache that captures FOAM model objects directly. Same pattern as `ModelFileDAO.js` — executes file text with overridden `foam.CLASS/ENUM/INTERFACE` to capture the raw JS objects passed to each call. This gives handlers direct access to all model fields (`extends`, `requires`, `properties`, `javaImports`, etc.) without any regex parsing.

- **`getModels(uri, text)`**: returns cached array of model objects, or parses fresh
- **`getModelAt(uri, text, line)`**: returns the model at a given line number
- **`parseFileModels(text)`**: eval-intercept extraction, with bracket-matching fallback for SyntaxError
- **Caching**: per-URI, invalidated on file change

#### FoamIndex (`tools/lsp/FoamIndex.js`)
The query layer over the FOAM runtime. All handlers go through FoamIndex, never touch `foam.*` directly.

- **Class discovery**: `getAllClassIds()` uses `foam.__context__.__cache__` (includes bootstrap classes)
- **File index**: `buildFileIndex()` walks ALL POMs recursively (including test/swift/node projects), stores `{ path, flags }` per class
- **Properties**: `getProperties()`, `getOwnProperties()`, `getInheritedProperties()`
- **Java mappings**: `getJavaImportMappings()`, `getPropertyJavaType()`
- **Documentation**: `getClassDoc()`, `getPropertyDoc()`

#### FoamClassGrammar (`tools/lsp/FoamClassGrammar.js`)
FOAM grammar that parses entire `.js` files using a skip-and-match pattern. Used only for cursor-position-aware completion suggestions (`sug()`).

```
START = repeat(alt(foamCall, ignoredContent))
foamCall = foam.CLASS/ENUM/INTERFACE + classBody
ignoredContent = anyChar()  // skip one character, try again
```

Dynamic suggestions built from FOAM registry:
- Property types: all subclasses of `foam.lang.Property` → `sug()` entries
- Class names: all known class IDs → `sug()` entries

#### CursorAnalyzer (`tools/lsp/CursorAnalyzer.js`)
Shared text/position utilities used by handlers. Provides fallback regex parsing for incomplete files where eval fails.

10 methods: `offsetToPosition`, `positionToOffset`, `getDottedWordAtPosition`, `getSegmentAtPosition`, `resolveClassId`, `parseRequires`, `parseImports`, `resolveShortName`, `findCreateContext`, `getMethodSignature`

#### TypeTracker (`tools/lsp/TypeTracker.js`)
Resolves variable types from `.create()` assignments. Scans backward from cursor position to find `var x = this.Foo.create()` patterns and resolves `Foo` through the requires map.

- **`getVariableTypes(text, position, model, index)`**: returns `{ varName: classId }` for variables in scope at the cursor position

Used by MemberCompletionHandler and SemanticTokenHandler to provide type-aware completions and highlighting for local variables.

## Data Flow

```
File text ──► FileModelCache.parseFileModels()
                  │
                  ├── eval with overridden foam.CLASS ──► model objects
                  │     (captures: package, name, extends, requires,
                  │      implements, properties, methods, javaImports, ...)
                  │
                  └── SyntaxError fallback ──► bracket-matching + individual eval
                  │
                  ▼
              model objects ──► handlers read fields directly
                  │
                  ├── DiagnosticsHandler: model.extends, model.requires, model.properties[].class
                  ├── JavaBlockValidator: model.javaImports, model.javaCode, model.properties[].javaPostSet
                  ├── HoverHandler: model.package + model.name → classId → FoamIndex
                  ├── MemberCompletionHandler: model.requires, model.imports
                  └── SymbolHandler: model.properties, model.methods → document outline
```

## Features

### Completion
| Context | What it suggests |
|---|---|
| `class: '▊'` | Property types (76 types from registry) |
| `extends: '▊'` | All class IDs (4000+) |
| `extends: 'foam.▊'` | Filtered class IDs |
| `of: '▊'` | Class IDs |
| `requires: ['▊']` | Class IDs |
| `javaImports: ['▊']` | Java package names |
| `this.▊` | Properties + methods + requires + imports |
| `this.X.create({▊})` | Target class properties |
| Top-level key position | package, name, extends, properties, etc. |
| Property key position | class, name, of, value, factory, etc. |
| Java block: `get▊` / `set▊` | Getters/setters with Java types |
| Java block: `variable.▊` | Getters/setters on resolved variable type |
| Java block: empty line | All getters and setters for current model |

### Hover
- **Class names**: own vs inherited properties, documentation, methods
- **Short names from requires**: resolves to full class
- **`create` keyword**: shows target class properties
- **Method names**: signature with parameters
- **Properties inside `.create({})`**: type from target class
- **Property types**: type info and documentation
- **Java block getters/setters**: shows return/parameter types inside `javaCode` blocks
- **Java block type names**: resolves FOAM class names inside Java blocks

### Go-to-Definition
- Classes in `extends:`, `requires:`, `of:` → navigates to source file
- Property types → navigates to type definition
- 4310 files indexed from POM tree

### Diagnostics
- Unknown class in `extends:` / `requires:` (checks runtime + file index)
- Unknown property type (both short and full names)
- Wrong Java imports (`foam.nanos.*` → suggests correct package)
- Invalid getter/setter in `javaCode` (bare calls on `this`)
- Flag-aware: test/swift/node classes known but not flagged

### Find References
- Find all subclasses of a class (`extends:`)
- Find all implementors of an interface (`implements:`)
- Results shown in VS Code References panel

### Signature Help
- Shows parameter names inside method parentheses
- Triggered by `(` and `,`

### Workspace Analyzer
- On-demand full codebase scan
- Auto-runs on startup
- Respects active flags (test/swift/node files filtered)
- Pattern grouping for false positive identification
- Results in VS Code Problems panel + sidebar

### Semantic Tokens
- Highlights resolved class references (`this.ShortName`) as type tokens
- Highlights typed variables (assigned from `.create()`) as class tokens
- VS Code renders these with theme-aware colors for better readability

### i18n Translation
- Hardcoded `.add('...')` display strings get an "Extract to messages:" code action (plain, or with a seeded `messageMap`)
- With a reachable translation model, extraction can also translate on the spot, and a HINT flags `messages:` entries missing a configured language with a one-click translate fix
- See **i18n Translation** below for setup and configuration

### Additional LSP Features
- **Workspace Symbols** (`Cmd+T`): search all FOAM classes by name
- **Folding Ranges**: fold properties/methods/requires/etc. blocks
- **Code Actions**: "Did you mean X?" for unknown classes, fix wrong imports
- **TextMate Grammar**: Java syntax highlighting in `javaCode` blocks
- **Document Symbols**: outline of properties/methods/actions

## i18n Translation

Two i18n surfaces in the LSP can call out to a local translation model:
extracting a hardcoded display string to a `messages:` entry, and filling in
a `messageMap` translation that's missing for a configured language. Both are
optional — with no model reachable, the LSP still offers the non-translating
extract actions; it just won't offer the translate-while-extracting or
translate-missing actions.

### Setup

Run any OpenAI-compatible chat server locally and have `translategemma:4b`
(or another translation-capable model) loaded. The LSP probes
`http://127.0.0.1:11434` (Ollama's default) then `http://127.0.0.1:1234`
(LM Studio's default), in order, and uses the first one that lists the
configured model.

```bash
# Ollama
ollama pull translategemma:4b
ollama serve   # listens on 127.0.0.1:11434

# LM Studio: load a translation-capable chat model in the app, then
# start its local server (Developer tab) — default 127.0.0.1:1234
```

Any other OpenAI-compatible server (llama.cpp, vLLM, ...) works too — just
point `endpoint` at it.

### Configuration

Passed via LSP `initializationOptions.foam.i18n` (all optional):

| Key | Default | Notes |
|---|---|---|
| `languages` | every distinct `locale` in `journals/locales.jrl` | Target language codes, e.g. `['fr', 'de']` |
| `sourceLanguage` | `'en'` | Language the bare `message:` value is written in |
| `endpoint` | `http://127.0.0.1:11434`, `http://127.0.0.1:1234` | Also settable via the `OLLAMA_HOST` env var |
| `model` | `translategemma:4b` | Also settable via the `OLLAMA_TRANSLATION_MODEL` env var |

### Code actions

| Action | Offered when | What it does |
|---|---|---|
| Extract `'<text>'` to a messages: entry | Always (on the hardcoded-string diagnostic) | Rewrites the usage to `this.<NAME>`, adds a plain `{ name, message }` entry |
| Extract `'<text>'` to messages: with messageMap | Always | Same, plus an empty `messageMap` seeded with the source-language key |
| Extract `'<text>'` + translate to `<langs>` via `<model>` | Model reachable AND target languages configured | Extracts and translates into every configured language in one edit |
| Translate `'<name>'` to `<lang>` via `<model>` (one per missing language, plus an "all missing languages" variant) | Model reachable AND target languages configured | Fills in the missing `messageMap[lang]` entries for a `messages:` entry the `i18n-missing-language` HINT flagged |

### Troubleshooting

**The translate/extract-and-translate actions never show up.** They're gated
on a confirmed-reachable model — check `foam/i18nStatus` (any MCP-connected
agent can call it, or use `foam_i18n_translate`, which surfaces the same
status) or probe the endpoint directly:

```bash
curl http://127.0.0.1:11434/v1/models   # or :1234 for LM Studio
```

If the model isn't in that list, `translationReady` stays `false` and only
the plain (non-translating) extract actions are offered. Also confirm target
languages are actually configured — an empty `languages` list with nothing
in `journals/locales.jrl` closes the gate even with a live model.

**Flag toggle / model swap not picked up.** Same as changing `foam.flags` —
restart the LSP (kill the MCP server or restart the agent) to re-probe.

## VS Code Extension

### Sidebar Panel
- **Analysis**: run button, stats, auto-analyze on startup
- **Files with Issues**: expandable tree with clickable diagnostics
- **Patterns**: grouped diagnostic patterns with counts
- **Active Flags**: js, java, web, test, node, swift — clickable toggles
- **Server Info**: indexed classes, files, property types

### Installation

```bash
cd foam3/tools/lsp/editors/vscode
npm install
npx tsc -p ./

# Debug mode: press F5 in VS Code
# Or package: npx @vscode/vsce package --allow-missing-repository
# Then: code --install-extension foam-lsp-*.vsix
```

## Testing

### Quick Test (seconds, no build)
```bash
cd <your-project> && node foam3/tools/tests/testFoamLSP.js
```

123 tests covering:
- FoamIndex queries (class discovery, property types, file index)
- Grammar parsing (5 real FOAM files)
- FileModelCache (single/multi-class, enums, refines, implements, broken files, caching)
- Completion (property types, class names, partial values, this., .create({}))
- Hover (class, property type, short names, create, methods)
- Diagnostics (valid/invalid classes, property types, constants)
- Definition (real file path resolution)
- CursorAnalyzer (position math, class resolution, requires parsing)
- WorkspaceAnalyzer (single file, pattern grouping)
- Folding ranges, code actions, workspace symbols
- TypeTracker (variable type resolution from .create() assignments)
- SemanticTokenHandler (class references, typed variables)
- Flag-aware file index (test classes not flagged as unknown)
- Java block completions (getters/setters, variable.method, empty-line)
- Java block hover (getter types, class name resolution)
- ReferencesHandler (subclasses, implementors)

### FOAM Test Framework
```bash
./build.sh -W9090 -Jlsp --flags:test client-tests:FoamIndexTest,FoamClassGrammarTest,HandlersTest,JavaBlockValidatorTest,LSPIntegrationTest
```

## File Structure

```
foam3/tools/
├── LSPMaker.js                    # Build Maker — hooks into pmake
├── lsp-start.js                   # Entry point for LSP server
├── lsp/
│   ├── pom.js
│   ├── FileModelCache.js          # Eval-intercept model extraction
│   ├── FoamIndex.js               # Class registry queries
│   ├── FoamClassGrammar.js        # FOAM grammar parser
│   ├── CursorAnalyzer.js          # Shared text utilities
│   ├── TypeTracker.js             # Variable type resolution
│   ├── server.js                  # JSON-RPC main loop (500+ lines)
│   ├── handlers/
│   │   ├── pom.js
│   │   ├── CompletionHandler.js   # textDocument/completion
│   │   ├── HoverHandler.js        # textDocument/hover
│   │   ├── DefinitionHandler.js   # textDocument/definition
│   │   ├── DiagnosticsHandler.js  # textDocument/publishDiagnostics
│   │   ├── MemberCompletionHandler.js  # this. and .create({}) completion
│   │   ├── SymbolHandler.js       # textDocument/documentSymbol
│   │   ├── JavaBlockValidator.js  # javaCode validation
│   │   ├── WorkspaceAnalyzer.js   # foam/analyzeWorkspace
│   │   ├── SemanticTokenHandler.js # textDocument/semanticTokens
│   │   └── ReferencesHandler.js   # textDocument/references
│   └── test/
│       ├── pom.js
│       ├── tests.jrl
│       ├── FoamIndexTest.js
│       ├── FoamClassGrammarTest.js
│       ├── HandlersTest.js
│       ├── JavaBlockValidatorTest.js
│       └── LSPIntegrationTest.js
├── tests/
│   └── testFoamLSP.js      # Quick standalone test (123 tests)
└── editors/
    ├── vscode/                    # VS Code extension
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── install.sh
    │   ├── resources/foam-icon.svg
    │   ├── syntaxes/foam-js.tmLanguage.json
    │   └── src/
    │       ├── extension.ts
    │       ├── FoamTreeProvider.ts
    │       └── FoamAnalysisRunner.ts
    ├── emacs/                     # Emacs (eglot + lsp-mode)
    │   ├── lsp-foam.el
    │   └── install.sh
    └── zed-foam3/                 # Zed IDE extension
        ├── extension.toml
        ├── Cargo.toml
        ├── install.sh
        └── src/lib.rs
```

## Known Limitations

1. **Incomplete files**: When user is mid-edit with syntax errors, eval-intercept falls back to regex for requires/imports
2. **Java-only properties**: Properties added by Java code generation (not in JS model) can't be validated
3. **Flag toggle**: Changing flags shows a message but requires LSP restart to take effect
4. **Refinement properties**: Some properties added by refinements after class boot may not be visible
5. **Boot time**: ~10-15s to load all FOAM models on startup
