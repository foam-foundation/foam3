# FOAM LSP — AI Agent Context

## What This Is
A runtime-aware Language Server Protocol implementation for the FOAM3 framework. It provides IDE features (autocomplete, hover, go-to-definition, diagnostics) for FOAM model files (`.js` files using `foam.CLASS`, `foam.ENUM`, `foam.INTERFACE`).

## How It Works
The LSP boots the FOAM runtime via `pmake` (same as `build.sh`), loading all model definitions into memory. It then serves IDE features over stdio JSON-RPC. The FOAM class registry (`foam.__context__.__cache__`) provides complete metadata about every class, property, method, and axiom.

**Model extraction** uses eval-intercept: `FileModelCache` executes file text with overridden `foam.CLASS/ENUM/INTERFACE` to capture raw model objects directly (same pattern as `ModelFileDAO.js`). All handlers read model fields instead of regex parsing. For incomplete files (user mid-edit), falls back to regex.

## Key Files

### Core
| File | Purpose | Key Functions |
|---|---|---|
| `FileModelCache.js` | Eval-intercept model extraction + caching | `getModels()`, `getModelAt()`, `parseFileModels()` |
| `FoamIndex.js` | Query layer over FOAM registry | `getAllClassIds()`, `getProperties()`, `getFilePath()`, `buildFileIndex()` |
| `FoamClassGrammar.js` | Grammar parser for completion `sug()` only | Skip-and-match pattern, dynamic `sug()` from registry |
| `CursorAnalyzer.js` | Shared text/position utilities + regex fallback | `offsetToPosition()`, `resolveClassId()`, `parseRequires()`, `findCreateContext()` |
| `TypeTracker.js` | Variable type resolution from `.create()` assignments | `getVariableTypes()` |
| `server.js` | JSON-RPC main loop | Message dispatch, handler creation, helper functions |
| `lsp-start.js` | Entry point | Console redirect, buildlib globals, pmake invocation |
| `LSPMaker.js` | Build Maker for pmake | Sets flags, builds file index, starts server |

### Handlers
| Handler | LSP Method | What It Does |
|---|---|---|
| `CompletionHandler.js` | `textDocument/completion` | Grammar-based + context fallback for partial values |
| `MemberCompletionHandler.js` | (routed from completion) | `this.` members, `.create({})` properties, requires/imports |
| `HoverHandler.js` | `textDocument/hover` | Class docs, method signatures, property types, create info |
| `DefinitionHandler.js` | `textDocument/definition` | File index lookup for class → file path |
| `DiagnosticsHandler.js` | `textDocument/publishDiagnostics` | Class/type validation via model objects, delegates to JavaBlockValidator |
| `JavaBlockValidator.js` | (called by Diagnostics) | Java import validation, getter/setter validation via model fields |
| `SymbolHandler.js` | `textDocument/documentSymbol` | Document outline via model objects |
| `WorkspaceAnalyzer.js` | `foam/analyzeWorkspace` | Full codebase scan |
| `SemanticTokenHandler.js` | `textDocument/semanticTokens/full` | Highlights resolved class refs and typed variables |
| `ReferencesHandler.js` | `textDocument/references` | Find subclasses and interface implementors |

### VS Code Extension
| File | Purpose |
|---|---|
| `extension.ts` | Spawns LSP server, registers commands, auto-analyzes on startup |
| `FoamTreeProvider.ts` | Sidebar tree view (analysis, files, patterns, flags) |
| `FoamAnalysisRunner.ts` | Sends workspace analysis request, handles progress |

## FOAM Concepts for AI Agents

### Class Registry
- `foam.__context__.__cache__` — ALL registered classes (including lazy factories)
- `foam.USED` / `foam.UNUSED` — classes tracked after EndBoot.js (NOT bootstrap classes)
- `foam.maybeLookup(id)` — resolves a class, returns null if not found
- `foam.isRegistered(id)` — checks if class ID exists in cache
- `cls.getAxiomsByClass(foam.lang.Property)` — ALL properties including inherited
- `cls.getOwnAxiomsByClass(foam.lang.Property)` — only properties on this class

### Eval-Intercept Pattern
`FileModelCache.parseFileModels(text)` captures model objects by:
1. Creating a context with overridden `foam.CLASS`, `foam.ENUM`, `foam.INTERFACE`, `foam.RELATIONSHIP`
2. Each override pushes the raw JS object into an array
3. `eval(text)` with this context — JS executes the file, calls our overrides
4. SyntaxError fallback: bracket-matching extracts individual blocks, evals each separately
5. Returns array of raw model objects with all fields: `package`, `name`, `extends`, `requires`, `properties`, `javaImports`, etc.

### Interfaces
- FOAM interfaces (`foam.INTERFACE`) define properties/methods
- Implementing classes get interface properties ONLY if explicitly declared in JS
- Some interface properties are Java-only (added by Java code generation)
- Handlers check `model.implements` array to resolve interface properties

### Refinements
- `refines: 'target.Class'` modifies an existing class, doesn't create a new one
- A file can have multiple `refines:` blocks — eval-intercept captures ALL of them
- Refinements are in `foam.USED` with `m.refines` set

### Variable Type Tracking
- `TypeTracker` scans backward from cursor to find `var x = this.Foo.create()` patterns
- Resolves `Foo` through the model's requires map to a full class ID
- Used by MemberCompletionHandler (type-aware `x.` completions) and SemanticTokenHandler (highlighting)

### Flags
- `foam.flags` controls which files are loaded: `{ js, java, web, test, node, swift, debug }`
- POM file entries have `flags: "js|java"` or `flags: "js&test|java&test"`
- Test/swift/node classes aren't loaded by default but ARE in the file index
- File index stores per-class flag metadata for filtering

### Property Types
- All subclasses of `foam.lang.Property` (76 types: String, Long, FObjectProperty, etc.)
- Discovered dynamically via `PropertyClass.isSubClass(cls)`
- Includes custom types from the project

## Testing
```bash
# Quick test (123 tests, ~30s):
cd <project> && node foam3/tools/tests/testFoamLSP.js

# FOAM framework tests:
./build.sh -W9090 -Jlsp --flags:test client-tests:FoamIndexTest
```

## Common Patterns for Modifications

### Adding a new LSP feature
1. Add handler method in appropriate handler file
2. Add capability in `server.js` initialize response
3. Add dispatch case in `server.js` handleMessage switch
4. Add test in `testFoamLSP.js`
5. If VS Code-specific, update `extension.ts` and `package.json`

### Adding a new diagnostic check
1. Add check in `DiagnosticsHandler.validateModel_()`
2. Read model fields directly (e.g., `model.extends`, `model.properties`)
3. Use `this.classKnown_(id)` to check class existence (respects flags)
4. Use `this.findInText_()` + `this.addDiag_()` for position-aware diagnostics
5. Add test case in tools test

### Adding to the grammar
1. Add rule in `FoamClassGrammar.buildGrammar_()`
2. Use `P.sug()` for completions, `P.sym()` for rule references
3. Dynamic parsers built from registry in `buildDynamicParsers_()`

## Metrics
- ~3800 lines of LSP code
- 123 automated tests
- 4310 classes indexed
- 76 property types
- Boot time: ~10-15s
