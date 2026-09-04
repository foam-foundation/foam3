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
| `FileModelCache.js` | Eval-intercept model extraction + caching | `getModels()`, `getModelAt()`, `parseFileModels()`. `sourceLine_` on each model comes from `FileClassifier.significantCalls()` |
| `FoamIndex.js` | Query layer over FOAM registry | `getAllClassIds()`, `getProperties()`, `getFilePath()`, `getClassLine()`, `getSymbolPosition()`, `resolveSymbol()`, `buildFileIndex()` |
| `FoamClassGrammar.js` | Grammar parser for completion `sug()` only | Skip-and-match pattern, dynamic `sug()` from registry |
| `CursorAnalyzer.js` | Shared text/position utilities + regex fallback | `offsetToPosition()`, `resolveClassId()`, `parseRequires()`, `findCreateContext()` |
| `TypeTracker.js` | Variable type resolution from `.create()` assignments | `getVariableTypes()` |
| `JrlLoader.js` | Load and parse .jrl (journal) files containing FOAM FObject records | `loadString()`, `filterByClass()` |
| `JrlGrammar.js` | Position-harvesting grammar for .jrl files (entry heads, embedded class refs, triple-string spans) | `collectJrlPositions()` |
| `JournalEntryIndex.js` | Query-driven journal lookup: service name / model-entry id → journal file + line. Service lookups touch only services.jrl; journals over maxFileSize skipped; raw-text pre-gate skips parsing non-matching files; per-entry eval isolates malformed entries; per-file parses cached by mtime+size; invalidated on .jrl save | `getServiceLocations()`, `getEntryLocations()`, `invalidate()` |
| `FileClassifier.js` | The ONE answer to "what kind of file is this", and the ONE scan for where a file's `foam.<X>(` calls are | `classify(uri, text)`. `.jrl` and `pom.js` are decided by FILENAME; everything else by PARSE — the first significant `foam.UPPERCASE(` call, where significant means outside comments and string literals. Both the server dispatch and `DiagnosticsHandler` route through one shared instance, which is also what makes its per-URI memo effective. `significantCalls(text)` returns every such call as `{ name, offset, line }` — see "Model positions" below |
| `server.js` | JSON-RPC main loop | Message dispatch, handler creation, helper functions |
| `lsp-start.js` | Entry point | Console redirect, buildlib globals, pmake invocation |
| `LSPMaker.js` | Build Maker for pmake | Sets flags, builds file index, starts server |

### Handlers
| Handler | LSP Method | What It Does |
|---|---|---|
| `CompletionHandler.js` | `textDocument/completion` | Grammar-based + context fallback for partial values |
| `MemberCompletionHandler.js` | (routed from completion) | `this.` members, `.create({})` properties, requires/imports |
| `HoverHandler.js` | `textDocument/hover` | Class docs, method signatures, property types, create info. A property's type carries its `of:` target — `` `Enum<ButtonStyle>` `` — except the primitive `of:` an array class already implies (`StringArray of: 'String'`) |
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
| `JrlHandler.js` | (custom hover + tokens for `.jrl`) | JRL class-ref resolution, embedded block tokens, cross-reference go-to-definition (daoKey → services.jrl CSpec, Reference values → journal entry, class ids inside serviceScript/client strings) |
| `DocumentHighlightHandler.js` | `textDocument/documentHighlight` | Highlight all occurrences of identifier under cursor |
| `TypeHierarchyHandler.js` | `textDocument/prepareTypeHierarchy` + `typeHierarchy/{supertypes,subtypes}` | Inheritance tree for any class, interface implementors included |
| `ImplementationHandler.js` | `textDocument/implementation` | Concrete implementors of a FOAM interface |
| `TypeDefinitionHandler.js` | `textDocument/typeDefinition` | For a property usage, jump to the property's class (e.g. `foam.lang.Long`) |
| `CallHierarchyHandler.js` | `textDocument/prepareCallHierarchy` + `callHierarchy/{incomingCalls,outgoingCalls}` | Who calls / who's called for any FOAM method |
| `PomValidator.js` | `foam/validatePoms` (+ called by Diagnostics on pom.js files) | Orphan files, missing POM entries, duplicate registrations; `validateEntries(text, pomPath)` adds entry-level checks — whitespace in name/flags values (`pom-name-whitespace`/`pom-flag-whitespace` ERROR), unknown flag tokens (`pom-flag-unknown` WARNING, vocabulary drifts), entries pointing at missing files (`pom-file-missing` ERROR). Positions come from the grammar harvest (`pomFileName`/`pomJavaFileName`/`pomFlagValue` kinds), never regex; `validate()` rolls them up as `entryIssues`. An OPEN pom is re-pushed on EVERY save (`reindexFile`), not gated on the affected-class set the class lane uses: `pom-file-missing` resolves each entry against disk, so the save that clears one is the save creating a file the pom names — a file whose class the pom's axiom state knows nothing about |
| `CodeLensHandler.js` | `textDocument/codeLens` | Two independent, feature-toggled lenses: `codeLens.i18n` (missing-translation counts, delegates to `I18nHandler.scanMissingLanguages` — so it inherits that entry point's `translationReady` gate AND its test/demo/mock URI exemption; also requires `hints.i18nMissingLanguage`, since clicking translates) and `codeLens.hierarchy` (subclass counts, informational — anchored on the advertised no-op command `foam.lens.info`; a click is answered with null). Both bail on a multi-model file. |
| `ScaffoldHandler.js` | `workspace/executeCommand` `foam.scaffold.newClass` | Builds a `WorkspaceEdit` (new class file + pom.js `files:` append) from `{ dir, name }`. Nothing written to disk server-side — the client applies the edit. No `featureConfig` — the command only runs when explicitly invoked. Containment: `wsRoot` and the target dir are both `fs.realpathSync`'d before comparison (a lexical compare let `ln -s / <ws>/escape` target `/etc`), and with `requireWsRoot` set and no `rootUri` from the client it refuses outright rather than inheriting `process.cwd()`. The derived package is validated as a dotted identifier path — a folder named `it's` is refused, not emitted into `package: '…'`. |

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

### Model positions: one scan, never a second regex

A file's models are located by `FileClassifier.significantCalls(text)` — every
`foam.<X>(` written outside comments and string literals, with its offset and
line. Two things read it:

- `FileModelCache` sets each model's `sourceLine_` from it (where the model STARTS).
- `DiagnosticsHandler.validateExpressions_` takes the next call's offset as
  where the model ENDS.

A third reads it too: `FileModelCache`'s SyntaxError fallback, which
bracket-matches and evals one block at a time when the file does not parse.

All three used to run their own `foam\.[A-Z]...\(` regex over the source, and a
regex cannot tell a real call from one written in a doc comment or a test
fixture string. `src/foam/lang/Proxy.js` has 4 real calls and 6 regex matches;
`Enum.js` has 6 and 9. The failure was silent in the worst way: a model whose
text was cut short at a comment simply stopped being validated, so a genuinely
wrong `expression:` argument produced no diagnostic at all rather than a
degraded one.

Two details worth keeping straight:

- A model's start offset is the start of its CALL, not of its line. Taking the
  line start made an indented `foam.CLASS(` match as its own next model, and the
  model's text became the indentation — 93 files under `src/` have their first
  foam call at a column other than 0.
- The fallback path sets `sourceLine_` from the call it is evaluating
  (`evalState.forcedLine`), not from a running count. A block that fails to eval
  must not shift the line of the next one.

If you need to know where something is in a model file, ask this scan. Adding
another regex re-opens the same hole.

### Refinements declare members, and they live in another file

A refined class keeps its OWN file as its definition site — `fileIndex_` only
falls back to a refining file when nothing else claims the id. So a member that
only a refinement declares has no entry in the class's own position map, and
`getSymbolPosition` used to fall back to the class's declaration line: every one
of them landed at the top of the wrong file.

`refinementIndex_` (built next to `fileIndex_`) maps a refined class id to every
file refining it, each with the refining model's own `[line, endLine)` range.
`refinementMemberPosition_` walks those files' position maps and accepts a hit
only inside the range. Two things make the range necessary:

- A refinement usually shares a file with the class that motivated it, and both
  can declare the same member name.
- `collectAxiomPositions` keeps ONE record per name per file for
  single-occurrence kinds. `FromCsvRefines.js` declares `fromCSV` six times, for
  six classes. The record now carries `also` — the later sightings — so a caller
  that knows which model it means can pick. Readers wanting just a position see
  the same first record as before.

A refinement's `name:` is optional; the index's name guard runs AFTER the
`refines` branch for that reason.

`getSymbolPosition` returns a `uri` along with the line, and that uri is
authoritative — a member's declaration is not always in its class's file. Every
caller must use it. `WorkspaceSymbolHandler` and `CallHierarchyHandler` used to
keep the class's own path and take only the line, which put a line number in a
file that had no such line: 34 workspace symbols pointed past the end of the
file they named, 21 of them through the Java path long before refinements were
indexed. `DefinitionHandler.buildLocationAtProperty` takes the class id for the
same reason — when the class's own file does not declare the property, it asks
the index instead of landing on line 0.

Cost: a lookup that misses parses each refining file once, mtime-cached.
`foam.lang.Property` is the worst case in this repo at 26 refining files —
181ms cold, 0ms warm, 0.11ms per warm hit.

Known residue (not this machinery): members whose refining file never reaches
the grammar's whole-file parse. Concentrated in `Element2.js`,
`java/refinements.js`, `u2/view/TableCellFormatter.js` and
`swift/refines/Method.js`.

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

## Dispatch: a table for the uniform requests, a switch for the rest

`handleMessage` consults `DOC_REQUESTS` before it reaches its `switch`. That
table holds the twelve document-scoped requests that are all answered the same
way — look up the open document, answer an empty value if the request does not
apply to it, call one handler inside a try, answer the empty value again on a
throw. Only three things differ per request, so a row declares only those:

| Field | Meaning |
|---|---|
| `run(doc, params)` | the handler call, the only required field |
| `list: true` | the empty answer is a fresh `[]`; absent means `null` |
| `anyDoc: true` | any open document will do; the default requires a FOAM class file |

`answerDocRequest_` holds the shape itself, once. **Adding a request of this
kind is one row, not a new case** — and a case that needs anything else
(feature-flag gating, a `.jrl` branch, disk reads, multi-step commands) stays
a real case in the switch, which is why `initialize`, `workspace/executeCommand`,
the `foam/i18n*` methods and the pull-diagnostic endpoint are still written out.

The routing is pinned over the wire in the `dispatch` test category, against a
spawned server: each routed method is asked once on a class document and once
on a plain one. Note that the guard assertions only prove a route is WIRED —
an empty answer and a handler that ran and found nothing look identical over
the wire. Three cases (`documentSymbol`, `foldingRange`, `documentHighlight`)
assert a NON-empty answer on the fixture, and those are the ones that catch a
row calling the wrong handler or losing its `anyDoc` flag.

## Feature toggles (FeatureConfig)

`FeatureConfig.js` is a plain Node module (not `foam.CLASS` — `server.js` and
its handlers are plain Node consumers, so it stays a bare `require()` with no
FOAM boot cost) that merges three layers into one config object, lowest to
highest precedence:

1. **`DEFAULTS`** (`FeatureConfig.js`) — baked-in fallback for every flag.
2. **`foam-lsp.json`** at the workspace root — optional; a missing file is
   silent, malformed JSON gets one warning and that layer is skipped.
3. **`initializationOptions.foam`** from the LSP client (VS Code settings,
   Zed's `lsp.<id>.initialization_options`, or any other client) — highest
   precedence, applied at `initialize`.

An unknown key at any layer (a typo, a renamed flag) is dropped with a
`console.error('[LSP] config: Unknown feature flag "X" ignored')` warning
rather than silently accepted — a typo that would otherwise just never take
effect gets flagged instead. Three more things are said out loud for the same
reason:
- an unknown key inside the `i18n:` section (`langauges`, `endpiont`) is
  dropped and warned the same way, against `FeatureConfig.I18N_KEYS`;
- a non-boolean feature value still coerces to `false` (`=== true`, so the
  string `"false"` can never turn a flag ON) but the coercion is now warned
  about, naming the flag and the discarded value — `"true"` and `1` are both
  easy to write by hand in JSON and both mean OFF;
- `enabled(flag)` called with a name that isn't in `DEFAULTS` logs once via
  `console.error`. That one is a MISUSE guard for future handlers, not user
  config: only a typo in our own code reaches it, and it would otherwise
  answer a silent, permanent `false` — a feature that quietly never runs.

**Restart-only, by design.** Feature flags are read once, at `initialize`
(`server.js:519`). There is no live-reload: editing `foam-lsp.json`, flipping
a VS Code setting, or changing Zed's `initialization_options` does nothing
until the server restarts. This mirrors the existing i18n provider-detection
rule (probed once at boot) rather than adding a second reload mechanism.

`caps.*Provider` flags in the `initialize` response are only ever ADDED when
a feature is on, never sent as `false` — a client that never sees the
capability never sends the request, so a disabled feature costs nothing at
all (`server.js:613-635`).

| Flag | Default | Gates |
|---|---|---|
| `diagnostics.java` | `true` | Java-block validation diagnostics |
| `diagnostics.i18n` | `true` | Hardcoded-display-string diagnostic |
| `diagnostics.pom` | `true` | Entry-level pom.js diagnostics (`PomValidator.validateEntries` via `DiagnosticsHandler.pomDiagnostics_`) |
| `hints.i18nMissingLanguage` | `true` | Every unsolicited offer to machine-translate: the missing-translation HINT, code actions C/D, AND the `codeLens.i18n` lens (clicking it translates) |
| `completion` | `true` | `completionProvider` capability |
| `hover` | `true` | `hoverProvider` capability |
| `semanticTokens` | `true` | `semanticTokensProvider` capability |
| `signatureHelp` | `true` | `signatureHelpProvider` capability |
| `folding` | `true` | `foldingRangeProvider` capability |
| `codeLens.i18n` | `true` | i18n lens in `CodeLensHandler` — requires `hints.i18nMissingLanguage` as well, since the lens is itself a translate offer |
| `codeLens.hierarchy` | `false` | Subclass-count lens in `CodeLensHandler` — OFF by default: it's informational-only (no click action yet) and adds a lens to every class file |

`i18n.*` config (`languages`, `sourceLanguage`, `endpoint`, `model`) rides the
same three-layer merge but is a separate top-level key (`featureConfig.i18n`)
from the boolean `features` map — see "i18n translation" below for what each
key does. `FeatureConfig` deliberately reads nothing else: env vars
(`OLLAMA_HOST`, `OLLAMA_TRANSLATION_MODEL`) and the `journals/locales.jrl`
fallback stay in `server.js` (Ruling R1 in `FeatureConfig.js`).

**Design ruling — the MCP/agent lane is deliberately ungated at the
capability level.** `editors/mcp/server.js` never sends
`initializationOptions` when it spawns the LSP, and never reads
`featureConfig` at all — the MCP tool list (`foam_hover`, `foam_diagnostics`,
`foam_i18n_translate`, …) is static and independent of which `caps.*Provider`
flags the LSP would have advertised to an editor client. A coding agent
always gets the full toolset, regardless of `foam-lsp.json` or any client
settings a human editor happens to have. This is intentional, not an
oversight: the flags exist to let a human tune their own editor's noise
(fewer squiggles, no hierarchy lens cluttering a file), not to restrict what
an agent can ask the server to do. Guards that protect a *shared* resource
rather than tune per-client noise — `hints.i18nMissingLanguage` gating
translation code actions, `translationReady` gating unsolicited scans — still
apply on the MCP lane too, since those live inside the handler logic
(`I18nHandler`, `CodeActionHandler`) rather than in capability advertisement.

## i18n translation (#5283)

Turns two existing i18n surfaces into translate-capable ones: the hardcoded-
display-string extraction diagnostic (`i18n-hardcoded-display-string`,
`DiagnosticsHandler.js:359-362`) gains a "translate while extracting" variant, and
a new `i18n-missing-language` HINT (`DiagnosticsHandler.js:140-150`) flags
`messages:` entries whose `messageMap` is missing a configured language and
offers a fix. All translation logic lives in `I18nHandler.js`; the HTTP
provider lives in `I18nProviders.js` (`foam.parse.lsp.HttpChatProvider`).

**Config** — the i18n settings come from `featureConfig.i18n`, the merge of
`foam-lsp.json` at the workspace root and `initializationOptions.foam.i18n`
(`FeatureConfig.js`); `server.js`'s `initialize` case applies it:
- `languages` — target language codes. Falls back to every distinct `locale`
  in `journals/locales.jrl` (`I18nHandler.deriveLanguagesFromJournals`,
  `handlers/I18nHandler.js:1036-1064`) when unset or `[]`.
- `sourceLanguage` — language the bare `message:` value is written in
  (default `'en'`); seeds `messageMap[sourceLanguage]` when a map is created.
- `endpoint` / `model` — provider config; `OLLAMA_HOST` / `OLLAMA_TRANSLATION_MODEL`
  env vars are the fallback when the merged config doesn't set them. Those two
  env fallbacks and the locales.jrl derivation stay in `server.js` on purpose —
  `FeatureConfig` merges its three declared layers and reads nothing else.

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
(`foam/i18nStatus` → `refreshAvailability()`, `server.js:911-927`), so it's
noticed within `negativeCacheTtlMs`. The editor lane probes exactly once, at
boot (`server.js:573`) — a model that comes up mid-session is never noticed
without a restart; see the README's Troubleshooting section for the same
restart advice from the user's side.
Placeholder sentinels (`${...}`, `{0}`, `%s`, HTML tags/entities —
`PLACEHOLDER_PATTERN`, `I18nProviders.js:389`) are token-protected before the
prompt and restored after, with a warning on any sentinel a model drops.

**Gating** — `translationReady` (`I18nHandler.js:40-42`) is set by
`refreshAvailability()` probing `provider.detect()`, fired at boot as
fire-and-forget (`server.js:573`, never awaited by `initialize`). It gates:
- `scanMissingLanguages()` (`I18nHandler.js:506-534`) — the public entry point,
  with exactly TWO direct callers: `DiagnosticsHandler` (the
  `i18n-missing-language` HINT) and `CodeLensHandler` (the "N translations
  missing" lens). No confirmed provider means no unsolicited HINT/lens noise.
- Code action C ("extract + translate") and D ("translate missing") in
  `CodeActionHandler.js` — both also require non-empty `targetLanguages` and
  the `hints.i18nMissingLanguage` feature flag (turning the hints off is how a
  user says "stop offering me machine translation"). `CodeActionHandler` does
  NOT call `scanMissingLanguages` itself: action D is diagnostic-driven, offered
  off the HINT that scan already produced, so it inherits the gates at one
  remove.

The **test/demo/mock URI exemption lives on that same public entry point**
(`isI18nExemptUri_`, `I18nHandler.js:486-503`), not in each consumer. It was
originally only in `DiagnosticsHandler`, so a demo file got no
missing-language HINT and yet still got a clickable "N translations missing"
CodeLens that really translated it when clicked. One check at the source is
what makes both direct callers agree — and, because action D rides the HINT,
what keeps the code actions out of demo files too.
`DiagnosticsHandler` keeps its own copy of the same predicate for
`validateAddStrings_` — a different scan, with the same exemption, that never
goes through `I18nHandler`.

The *internal* `scanMissingLanguages_()` (trailing underscore) is UNGATED on
both counts — `foam/i18nTranslate`'s dry-run path calls it directly (via
`resolveTranslateTargets_`, `I18nHandler.js:190-214`) because "what needs
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
  `I18nHandler.executeCommand()` (`server.js:1048-1074`); the built edit is sent
  to the client via outbound `workspace/applyEdit` (`server.js:1056`), never
  applied server-side.
- `foam/i18nStatus` — probe + report `{ available, model, endpoint, targetLanguages }`
  (`server.js:911-927`).
- `foam/i18nTranslate` — `{ uri, messageName?, languages?, dryRun? }`; real
  branch calls `translateMessages()`, `dryRun:true` calls
  `dryRunTranslateStrings()` (no network) — `server.js:929-946`.
- `foam/i18nApply` — `{ uri, translations: { NAME: { lang: '...' } } }`, routes
  to `applyTranslations()`, which validates every placeholder in the current
  source survives in every offered translation before building any edit
  (`server.js:948-963`, `handlers/I18nHandler.js:280-342`).

**MCP two-phase dance** (`editors/mcp/server.js:767-812`) — `foam_i18n_translate`
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
