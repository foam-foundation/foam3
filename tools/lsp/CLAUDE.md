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
| `FoamIndex.js` | Query layer over FOAM registry | `getAllClassIds()`, `getProperties()`, `getFilePath()`, `getClassLine()`, `getSymbolPosition()`, `resolveSymbol()`, `buildFileIndex()` |
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
| `DiagnosticsHandler.js` | `textDocument/{publishDiagnostics,diagnostic}` | Push + pull diagnostic models |
| `JavaBlockValidator.js` | (called by Diagnostics) | Java import validation, getter/setter validation via model fields |
| `SymbolHandler.js` | `textDocument/documentSymbol` | Document outline via model objects |
| `WorkspaceAnalyzer.js` | `foam/analyzeWorkspace` | Full codebase scan |
| `SemanticTokenHandler.js` | `textDocument/semanticTokens/full` | Highlights resolved class refs and typed variables |
| `ReferencesHandler.js` | `textDocument/references` | Subclasses, implementors, requires, of-users + JS/Java/string usages |
| `SignatureHelpHandler.js` | `textDocument/signatureHelp` | Method parameter hints inside `(...)` |
| `FoldingRangeHandler.js` | `textDocument/foldingRange` | Folds `properties:`/`methods:`/`requires:`/etc. arrays |
| `CodeActionHandler.js` | `textDocument/codeAction` | Quick-fixes: "Did you mean X?", single-quote conversion, raw-color → $token, wrong-Java-package, i18n extract/translate |
| `I18nHandler.js` | (called by Diagnostics/CodeAction/server.js custom methods) | i18n edit building (extract, messageMap), missing-language scan, translate-command execution |
| `WorkspaceSymbolHandler.js` | `workspace/symbol` | Class + property + method search with ranking, cap 500 |
| `RenameHandler.js` | `textDocument/{prepareRename,rename}` | Rename a class id + short-name occurrences |
| `JrlHandler.js` | (custom hover + tokens for `.jrl`) | JRL class-ref resolution, embedded block tokens |
| `DocumentHighlightHandler.js` | `textDocument/documentHighlight` | Highlight all occurrences of identifier under cursor |
| `TypeHierarchyHandler.js` | `textDocument/prepareTypeHierarchy` + `typeHierarchy/{supertypes,subtypes}` | Inheritance tree for any class, interface implementors included |
| `ImplementationHandler.js` | `textDocument/implementation` | Concrete implementors of a FOAM interface |
| `TypeDefinitionHandler.js` | `textDocument/typeDefinition` | For a property usage, jump to the property's class (e.g. `foam.lang.Long`) |
| `CallHierarchyHandler.js` | `textDocument/prepareCallHierarchy` + `callHierarchy/{incomingCalls,outgoingCalls}` | Who calls / who's called for any FOAM method |
| `PomValidator.js` | `foam/validatePoms` | Orphan files, missing POM entries, duplicate registrations |

### Workspace usage indexes
`FoamIndex` lazy-builds four byTarget maps on first request:

| Method | Returns | Source |
|---|---|---|
| `getJsUsages(classId)` | classes whose JS code references the class: `this.<Short>` via requires, `.create()` receivers, `.tag(X, {})` args, `{ class: 'dotted.Id' }` spec strings | Grammar `collectAxiomPositions` per source file (memberRef / instCreateReceiver / instTagClass / instClassRef); registry `fn.toString()` scan only for file-less (runtime-registered) classes |
| `getJavaUsages(classId)` | classes whose javaCode / javaPostSet / etc. reference the type | Same axiom walk, `javaImports` resolves short→full |
| `getStringUsages(name)` | classes importing the name + Producer classes exporting it + services.jrl CSpec entries | `cls.getOwnAxiomsByClass(foam.lang.Import/Export)` + `JrlLoader.loadFile(...services.jrl)` |
| `getMemberUsages(classId, memberName)` | per-class `this.X` usages of an own / inherited property or method | Reuses `scanFunctions_` axiom walk |

All four indexes share the same invalidation hook (`invalidateSymbolIndex_`)
so the LSP's reindexFile on save keeps them coherent.

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
# Quick test (all categories):
cd <project> && node foam3/tools/tests/testFoamLSP.js

# One category (see tools/tests/testFoamLSP.js CATEGORIES for the full list —
# foamIndex, grammar, utilities, completion, hover, diagnostics, i18n,
# navigation, java, jrl, editorFeatures, typeHierarchy, usageIndex,
# callHierarchy, pomValidation, pomNavigation, mcp):
node foam3/tools/tests/testFoamLSP.js i18n

# FOAM framework tests:
./build.sh -W9090 -Jlsp --flags:test client-tests:FoamIndexTest
```
The `i18n` category is async (mock HTTP providers, timeouts, TTL waits) —
`testFoamLSP.js` awaits its exported `done` promise before tallying, and the
watchdog is 240s (up from a sync-only 80s baseline) to cover it
(`tools/tests/testFoamLSP.js:16-31`).

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

### Grammar-harvested positions (single-parse `P.msg` records)
`FoamClassGrammar` emits position-tagged `P.msg` records harvested by the `apply` hook in one parse. Beyond axiom positions (`collectAxiomPositions`):
- `collectRanges(text)` → `{comment, documentation}` spans (`P.msg({kind:'comment'|'documentation'})`). Drives comment/doc suppression in `HoverHandler` (no hover inside) and `SemanticTokenHandler` (no non-comment tokens inside).
- `collectInstantiations(text)` → grouped `X.create({…})` / `.tag(this.X,{…})` calls with receiver class + key/value spans (`instCall`/`instCreateReceiver`/`instTagClass`/`instKey`/`instValue` kinds). The receiver chain uses `P.not` negative lookahead so only real create/tag calls match — generic `foo.bar(...)` emits nothing. Drives enum value completion (`MemberCompletionHandler`) and value diagnostics (`DiagnosticsHandler`).
- `FoamIndex.getRelationships(classId)` (relationship hover, #5091) and `FoamIndex.getPropertyInfo(classId, prop)` (enum/primitive value resolution, #5093) back the index-side lookups.

## i18n translation (#5283)

Turns two existing i18n surfaces into translate-capable ones: the hardcoded-
display-string extraction diagnostic (`i18n-hardcoded-display-string`,
`DiagnosticsHandler.js:339`) gains a "translate while extracting" variant, and
a new `i18n-missing-language` HINT (`DiagnosticsHandler.js:120-131`) flags
`messages:` entries whose `messageMap` is missing a configured language and
offers a fix. All translation logic lives in `I18nHandler.js`; the HTTP
provider lives in `I18nProviders.js` (`foam.parse.lsp.HttpChatProvider`).

**Config** — `server.js:477-509` reads `initializationOptions.foam.i18n`:
- `languages` — target language codes. Falls back to every distinct `locale`
  in `journals/locales.jrl` (`I18nHandler.deriveLanguagesFromJournals`,
  `handlers/I18nHandler.js:930-958`) when unset or `[]`.
- `sourceLanguage` — language the bare `message:` value is written in
  (default `'en'`); seeds `messageMap[sourceLanguage]` when a map is created.
- `endpoint` / `model` — provider config; `OLLAMA_HOST` / `OLLAMA_TRANSLATION_MODEL`
  env vars are the fallback when initOpts don't set them (`server.js:500-509`).

**Provider** — `HttpChatProvider` (`I18nProviders.js`) is OpenAI-compatible
(`/v1/models` + `/v1/chat/completions`): Ollama, LM Studio, llama.cpp, vLLM
all work. `detect()` caches a positive result until something disproves it and
a negative one for `negativeCacheTtlMs` (60s default) so a down server isn't
hammered (`I18nProviders.js:74-136`). What disproves a positive: a `translate()`
whose `fetch` REJECTS (connection refused, DNS, timeout) — OR whose body read
rejects right after a 2xx response (the connection drops mid-body, or the
abort timeout fires while still reading) — clears the cache so the next
`detect()` re-probes — a provider that dies mid-session would otherwise keep
every lane on the "available" path until an LSP restart. A non-2xx answer
does not clear it: that server is up, only the request failed.
Whether a server *started* mid-session is noticed soon after depends on the
lane: the MCP lane re-probes on every call
(`foam/i18nStatus` → `refreshAvailability()`, `server.js:788-792`), so it's
noticed within `negativeCacheTtlMs`. The editor lane probes exactly once, at
boot (`server.js:512`) — a model that comes up mid-session is never noticed
without a restart; see the README's Troubleshooting section for the same
restart advice from the user's side.
Placeholder sentinels (`${...}`, `{0}`, `%s`, HTML tags/entities —
`PLACEHOLDER_PATTERN`, `I18nProviders.js:361`) are token-protected before the
prompt and restored after, with a warning on any sentinel a model drops.

**Gating** — `translationReady` (`I18nHandler.js:41-42`) is set by
`refreshAvailability()` probing `provider.detect()`, fired at boot as
fire-and-forget (`server.js:512`, never awaited by `initialize`). It gates:
- `scanMissingLanguages()` (`I18nHandler.js:442-459`) — the public,
  diagnostic/code-action-facing entry point; no confirmed provider means no
  unsolicited HINT/action noise.
- Code action C ("extract + translate") and D ("translate missing") in
  `CodeActionHandler.js:111-112,140-141` — both also require non-empty
  `targetLanguages`.

The *internal* `scanMissingLanguages_()` (trailing underscore) is UNGATED —
`foam/i18nTranslate`'s dry-run path calls it directly (via
`resolveTranslateTargets_`, `I18nHandler.js:158-171`) because "what needs
translating" from an explicit tool call isn't the noise the gate suppresses,
and `translationReady === false` is exactly the situation dry-run exists for
(no local model — hand the agent the strings instead). A pinned
`messageName` skips the scan but not its missing-language filter
(`missingLanguagesFor_`): an entry that already carries every requested
language resolves to no targets at all, so the dry run reports an empty
`strings` map and the real path makes no provider call.

**Only entries an edit can follow are offered.** `scanMissingLanguages_`
drops any entry `buildMessageMapEdit` could not write — today that means a
`message:` written as a template literal (backticks), whose no-map branch
matches `'`/`"` only. The model objects the scanner reads report a template
literal as a plain string, so without the source-level check
(`messageMapEditable_`) the HINT and action D were offered and then failed on
click with "the file changed since the action was offered". An entry that
already has a `messageMap` stays eligible whatever its quoting — that takes
the append branch, which never reads the message literal.

**Commands / custom methods**:
- `workspace/executeCommand` — `foam.i18n.extractAndTranslate` (action C) and
  `foam.i18n.translateMessage` (action D), both routed to
  `I18nHandler.executeCommand()` (`server.js:879-915`); the built edit is sent
  to the client via outbound `workspace/applyEdit` (`server.js:889`), never
  applied server-side.
- `foam/i18nStatus` — probe + report `{ available, model, endpoint, targetLanguages }`
  (`server.js:788-804`).
- `foam/i18nTranslate` — `{ uri, messageName?, languages?, dryRun? }`; real
  branch calls `translateMessages()`, `dryRun:true` calls
  `dryRunTranslateStrings()` (no network) — `server.js:806-823`.
- `foam/i18nApply` — `{ uri, translations: { NAME: { lang: '...' } } }`, routes
  to `applyTranslations()`, which validates every placeholder in the current
  source survives in every offered translation before building any edit
  (`server.js:825-840`, `handlers/I18nHandler.js:236-298`).

**MCP two-phase dance** (`editors/mcp/server.js:757-819`) — `foam_i18n_translate`
calls `foam/i18nStatus` first:
- provider up → calls `foam/i18nTranslate` for real, writes the resulting edit
  straight to disk (`applyWorkspaceEdit`, `editors/mcp/server.js:82-96` — no
  editor client in a headless MCP host).
- provider down → calls `foam/i18nTranslate` with `dryRun:true`, returns a
  `needs-translations` payload (`{ strings, targetLanguages, instructions }`)
  for the calling agent to translate itself, which it then hands back via
  `foam_i18n_apply` → `foam/i18nApply` → same placeholder-validated edit,
  applied to disk the same way.
- Both tools report honestly when there's nothing to do, rather than a blanket
  success: `foam_i18n_translate` returns `{ status: 'nothing-to-translate' }`
  when the dry-run scan found no missing strings, and `foam_i18n_apply`
  returns a "nothing to apply" message (no disk write) when every requested
  language was already present — `applyTranslations` legally builds zero
  edits in that case.

## Metrics
- ~19,800 lines of LSP code
- ~1,200 assertions across the automated test suite
- 4310 classes indexed
- 76 property types
- Boot time: ~10-15s
