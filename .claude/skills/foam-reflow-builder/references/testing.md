# Testing a Reflow change

Paths are under `src/foam/core/reflow/`. The base classes, pom flags, `tests.jrl` rows and run commands are in `foam-test-builder`; this page says what exists for Reflow and what to add.

## Tests that exist

All are registered in `test/tests.jrl` and `test/pom.js`. A test that extends `JSTest` runs in the browser; one that extends `Test` with `javaCode` runs on the server.

| Test | Side | What it pins |
|---|---|---|
| `DAOPromptRunningTest` | client | `DAOPrompt.running` is true from a run request or an `aql` change until the select returns; an error leaves `hasError` true and the next good run clears it |
| `BlockCmdSaveTest` | client | a block's `cmd` survives Save unchanged when it holds a backslash, an escaped quote or a tab |
| `FlowScriptShapeTest` | server | `Flow.script` parses from the escaped-string, triple-quoted and JSON shapes, and the JSON shape round-trips through the journal formatter |
| `FlowAuthorizationTest` | server | save and read checks against the stored flow: creator, admin, each `accessLevel`, and the rule that a save cannot change access unless made by the creator or an admin |
| `FlowHistoryRuleActionTest` | server | one `FlowHistoryRecord` per changed put, none for an unchanged put, dates round-trip |
| `DependencyScannerTest` | client | which block names a block's `cmd`, `reactions_` and scripts refer to, including forward and nested references |
| `ColumnParserTest` | client | `columns` strings resolve names, short names and aliases |
| `CommandToolTest` | client | the agent's `execute_command` tool runs a script through a stand-in `eval_` and refuses what its `predicate` does not allow |
| `MarkdownExampleTagTest` | client | the `<example>` tag evaluates its code under the flow scope |
| `FlowDocumentDocsTest` | client | Knowledge Base list order, `<docnav>` crumb and links |
| `MappingAScriptTest` | client | upload mapping formulas |
| `UploadAgentJobTest` | server | an upload batch runs as a job |
| `UploadSinkJobTest` | client | the upload sink puts 2000-row batches as jobs |
| `dashboard/test/*` | client | chart agents: saved JSON shapes, old property names, baseline output, the chart field property |

For chart agents use the notes in `foam-chart-builder` ("testing").

## Which test to write

| You changed | Add or extend | How |
|---|---|---|
| a command | a `JSTest` that calls its `execute` with a stand-in context | A command takes `addValue`, `block`, `log`, `out` and `eval_` from the context (`cmd/Command.js:21`), so the test passes stubs for the ones `execute` calls, for example an `addValue` that records the value. `CommandToolTest` builds a fake `eval_` that records scripts and returns the block it would make. A `Command` row with a `script` has no class to test; check it in a flow |
| a `DAOPrompt` option or an agent | a `JSTest` over an `MDAO` of a small model | `DAOPromptRunningTest` makes `DAOPrompt.create({ dao: dao, autoRun: true }, vx)` with `vx = x.createSubContext({ block: {}, scope: {}, eval_: () => {} })` and a probe agent (`DAOPromptRunningTest.js:33-60`) |
| a sink that runs on the server | a server `Test` with `javaCode` that puts rows into an `MDAO` and selects with the sink, plus a `JSTest` for the browser side | one test per side; `foam-test-builder` |
| a saved-flow shape or a serializer | a test that builds the JSON, parses it and compares | `FlowScriptShapeTest`, `BlockCmdSaveTest` |
| flow access | a server `Test` with a stub auth service that grants nothing | `FlowAuthorizationTest`; do not rely on putting a subject on the context, because the runner's session still passes `*` |
| a flow's output | a FLOAT flow: `testresults`, then `test(block.value, 'description')` blocks | the `test` command reads `testResults` from the scope and creates it when missing (`float/cmds.jrl`); `float/flows.jrl` has a sample flow in category `TEST` |

Register the class in `test/pom.js` as `flags: 'js&test|java&test'` and add its row to `test/tests.jrl` (`test/pom.js`, `test/tests.jrl`). Reflow's other sub-packages follow the same layout (`dashboard/test/`).

Run them, one build per change:

```bash
./build.sh -W9090 client-tests:DAOPromptRunningTest,BlockCmdSaveTest
./build.sh -W9090 server-tests:FlowAuthorizationTest
```

## Check it in a running flow

Unit tests run a sink or an agent in isolation. A flow adds the pieces they skip: the saved JSON, the context clone, the network between browser and server. Check each of these in a real flow before calling a change done.

1. **Start a server from your checkout.** `./build.sh -W9090` builds the source and runs it; a test build is not a server (`README.md:70-79`, `doc/guides/Build.md:180`). Add `-l` to reload edited `.js` files without a refresh (`doc/guides/LiveReload.md`). Sign in as `admin` / `admin`, then open REFLOW from the Admin menu (`src/menus.jrl:306-314`).
2. **Build the smallest flow that uses the change.** Use the demo DAOs: `dao logMessageDAO`, `dao om1MinuteDAO`, `dao userDAO`. Example: set `select` to your new agent in the block's form.
3. **Save, reload, reopen.** Name the flow, save it, reload the page and open the flow again. A change that only works on a fresh block shows up here: a saved property that is missing, a class that is not registered at load, a `BadBlock` where the block was.
4. **Open it as a person without the grant.** Sign in as a non-admin and confirm the gated command or agent is absent and the rest of the flow still loads.
5. **Watch the network tab for a sink that should run on the server.** The request should carry the sink class and the answer should hold no row fields. A response full of rows means the sink ran in the browser.
6. **Clear the autosave when you compare.** A draft in `localStorage` wins over the saved flow on load until you answer its prompt, so a stale draft makes a fixed flow look unfixed (`Console.js:2032-2095`).
7. **Look at the console.** A block that fails to load logs `Error loading block:` with its name (`Console.js:1379`).
