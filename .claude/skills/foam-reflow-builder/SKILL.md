---
name: foam-reflow-builder
description: Use when adding or changing anything in Reflow, the FOAM notebook console (src/foam/core/reflow), or building a flow - a Console command (cmds.jrl, cmd/Command.js), a DAO agent or sink (AbstractDAOAgent, GroupByDAOAgent, agents.jrl SinkAgent row), a DAOPrompt option (aql, where, limit, order), a script block, preLoadScript, a flow's access level, flows.jrl or a Reflow test. Triggers on reflow, flow, flows.jrl, Console, Block, flowName, DAOPrompt, DAO agent, sink picker, aql, shown, reactions_, autoRun, FlowAccess, "blank block", "count stops at 100", "command not found".
---

# FOAM Reflow builder

Reflow is a notebook-style console. A flow is a saved list of named blocks. Each block ran one command line, and the command's result is drawn in the block. Read the layer you are changing before you write code: most changes are one command class, one agent class or one journal row.

Invoke `foam-design-patterns` first (its `references/reflow.md` holds the review rules). For charts, invoke `foam-chart-builder`; this skill stops where chart drawing starts. For a view, use `foam-view-builder`; for a test, `foam-test-builder`; for a new journal row or POM entry, `foam-feature-wiring`.

Paths below are under `src/foam/core/reflow/` unless they start with another directory.

## The layers, top down

| Layer | Class | What it owns |
|---|---|---|
| Console | `Console.js` | the prompt, the command scope, `eval_`, load, save, autosave, modes |
| Flow | `Flow.js` | the saved document: `name`, `script` (JSON), `preLoadScript`, `accessLevel`, history |
| Block | `Block.js`, `LayoutBlock.js` | one command run: `flowName`, `cmd`, `value`, `flowChildren`, `shown`, `reactions_`, border |
| Command | `cmd/Command.js`, `cmd/cmds.jrl` | the word typed at the prompt; creates the block's `value` |
| Block value | `DAOPrompt.js`, `Script.js`, `Markdown.js`, ... | the object a command puts in `block.value`; other blocks read it by name |
| DAO agent | `AbstractDAOAgent.js` and `*DAOAgent.js` | what to do with the rows of a DAOPrompt: table, count, group, chart |
| Sink | `foam.dao.Sink`, `foam.mlang.sink.*` | the accumulator an agent hands to `dao.select`; runs in the browser or on the server |
| Registry | `cmd/cmds.jrl`, `agents.jrl` | journal rows in `commandDAO` and `agentDAO` that make commands and agents appear |

How a typed line becomes a block: `references/layer-map.md`. The flow JSON shape, modes, autosave and history are there too.

## What you are changing, and where

| Change | Where | Read |
|---|---|---|
| a new word at the prompt | a `cmd.Command` subclass or a `Command` row with a `script`, plus a `cmds.jrl` row | `references/commands.md` |
| hide a command or agent from most users | `permissionRequired: true` on its row, then grant `command.read.<id>` or `agent.read.<id>` | `references/commands.md`, `references/access.md` |
| a filter, order or row cap on a DAO block | `where`, `aql`, `order`, `limit` on `DAOPrompt` | `references/daoprompt.md` |
| a new way to show or aggregate rows | a `*DAOAgent` class and an `agents.jrl` row | `references/agents-and-sinks.md` |
| a calculation that must run on the server | a `Serializable` sink with `javaCode` | `references/agents-and-sinks.md` |
| code inside a flow | a `script` or `function` block, `preLoadScript` | `references/scripts.md` |
| who can open or edit a flow | `Flow.accessLevel`, `specifiedUserAccess`, menus | `references/access.md` |
| a chart | `foam-chart-builder` | |
| prove a change works | `references/testing.md` | |
| a blank block, a count of 100, a flow that will not load | `references/gotchas.md` | |
| an AI agent that types commands | `references/ai-agents.md` | |

## Rules

Each rule has its reason and a place to check it.

- **A block's name is its variable.** A block named `uploads` puts its value in scope as `uploads` and the block as `uploads$block` (`Console.js:1601-1621`). A later block reads it by that name, so name a block before another block reads it.
- **A command is a JavaScript expression first.** `eval_` tries `eval(cmd)`. Only when that throws does it split at the first space and call `scope[word](rest)` with the rest as one string (`Console.js:1661-1694`). `dao om1MinuteDAO` works; a second argument needs the call form `dao('om1MinuteDAO', 'label')`.
- **A command the user may not read does not exist for them.** `commandDAO` filters its rows by `authorizeOnRead` (`cmd/Command.js:83-89`, `core/auth/AuthorizationDAO.js:91-94`), and the Console builds its scope from that select (`Console.js:1453-1464`). The user sees `x is not defined` for a bare word, or a syntax error message for `x arg`, never "permission denied" (`Console.js:1669-1686`).
- **`limit` defaults to 100 and every agent but the table reads the limited DAO.** A count tile over 5,000 rows shows 100 (`DAOPrompt.js:351-356`, `AbstractDAOAgent.js:23`). Set `limit: 0` on count, sum and group blocks.
- **`where` and `aql` are two parsers.** `where` goes through `QueryParser`, `aql` through `SimpleQueryParser`, and both apply when both are set (`DAOPrompt.js:269-280`). Prefer a string over a saved predicate object (`references/daoprompt.md`).
- **After changing an agent in code, call `run()`.** The block redraws on `data` or `version`. A new `where`, `skip` or `version` re-runs it, a new `aql` or `order` only with `autoRun`, and any other property never (`DAOPrompt.js:37-39`, `:576-579`, `:639-653`).
- **An agent's `createSink()` returns a new sink every call.** The same agent runs again on each refilter, and `dao.select` never clears a sink it is given (`AbstractDAOAgent.js:46-51`).
- **A sink that must run on the server implements `foam.lang.Serializable` and has `javaCode`.** `ClientDAO` sends only Serializable sinks; any other sink is fed row by row in the browser after the rows were fetched (`dao/ClientDAO.js:62-90`).
- **An agent is not a sink; it builds one.** `execute` reads `this.block.value` (`AbstractDAOAgent.js:54-55`), so an agent made outside a block fails. In a script block, select with sinks from `foam.mlang.Expressions` (`E.COUNT()`, `E.GROUP_BY(...)`) and leave the agents to `DAOPrompt.select`.
- **Gate visibility with a `reactions_` formula, not by assigning `shown`.** `shown` is saved with the block (`Block.js:132-134`, `:270-278`); a formula is re-evaluated every second after load (`ReactiveDetailView.js:91-140`).
- **Mark derived state `transient` on a value or an agent.** The saved script drops `transient` properties (`Console.js:1907`). `Block` saves only the fields it lists, so a new `Block` property is never saved (`Block.js:270-278`).
- **Keep state off `globalThis`.** `clearFlow` resets the scope but not globals (`Console.js:1411-1419`), and the dependency scanner cannot see a hand-off through a global (`DependencyScanner.js:1-24`). Return a value from a `function` block instead (`function/Function.js:16-28`).
- **Registering a class id twice asserts.** A `foam.CLASS` in `preLoadScript` runs on every load, so guard it with `foam.maybeLookup(id)` (`lang/Context.js:144-154`, `:71-75`).
- **Ids in `agents.jrl` and `cmds.jrl` are permission names.** `agent.read.<id>` and `command.read.<id>` are built from them (`SinkAgent.js:62`, `cmd/Command.js:85`). Never reuse a removed id: a grant given for the old agent would unlock the new one.
- **Check the grant, not the catalogue.** A `Permission` row in `cmd/permissions.jrl` only feeds the permission picker. Test a new gated command as a non-admin (`foam-feature-wiring`, "The permission catalogue enforces nothing").
- **Set `accessLevel` on purpose.** The default is `PUBLIC_RW`, so every reader may edit (`Flow.js:144-150`).

## Symptom to first check

| You see | Check first | Detail |
|---|---|---|
| a count shows 100 | `limit` is 0 | `gotchas.md`, "A count, sum or group block stops at 100" |
| a filter returns every row, or ignores the end of the query | the `aql` text parses to the end | `gotchas.md`, "A typo in `aql`" |
| a block is there but empty | the script that sets its agent ran after its select; call `run()` | `gotchas.md`, "A chart-shaped hole" |
| `x is not defined` for a command | the person's `command.read.<id>`; the page was reloaded after the journal changed | `gotchas.md` |
| the new agent is not in the picker | `type`, `sink`, `permissionRequired`, the pom entry | `gotchas.md`, "The new agent is missing" |
| a class is missing after load | `preLoadScript` threw, or two names share a constant | `gotchas.md`, "Code in a flow" |
| a fixed flow still looks broken | an old autosave draft in `localStorage` | `references/layer-map.md`, "Save, autosave, history" |
| the server tab shows rows moving | the sink is not `Serializable` | `references/agents-and-sinks.md`, "Where a sink runs" |

## Order of work

1. `grep` the id in `cmd/cmds.jrl` and `agents.jrl`. A command or agent that does your job may exist.
2. Pick the layer from the table above. Write the class, then the journal row.
3. Add a class to `pom.js` (`pom.js:129-157` lists the commands). A `Command` row with a `script` is a journal row and needs no pom entry. A `.jrl` needs none either: it loads because a `services.jrl` names its `journalName`, and the build joins every `.jrl` of that name (`cmd/services.jrl:12` names `cmds`, so `cmds.jrl` loads; `doc/guides/Journals.md:46`, `:58`).
4. Write the test (`references/testing.md`), then run the change in a flow on a server started from your checkout.
5. Walk `references/gotchas.md` for the symptom you saw.

## A small flow, end to end

Three blocks over the demo DAO `om1MinuteDAO`: a count, a grouped count and a title shown only when there is data. The `__Property__` shape for `prop` is what a property writes when the outputter passes properties by reference (`lang/JSON.js:42-47`, flag at `:229`); `flows.jrl:2` holds a group-by that uses it.

```json
[
  { "flowName": "all", "cmd": "dao om1MinuteDAO",
    "value": { "class": "foam.core.reflow.DAOPrompt", "limit": 0,
               "select": { "class": "foam.core.reflow.CountDAOAgent" } } },
  { "flowName": "byKey", "cmd": "dao om1MinuteDAO",
    "value": { "class": "foam.core.reflow.DAOPrompt", "limit": 0,
               "select": { "class": "foam.core.reflow.GroupByDAOAgent",
                           "prop": { "class": "__Property__", "forClass_": "foam.core.analytics.Candlestick", "name": "key" },
                           "sink": { "class": "foam.core.reflow.CountDAOAgent" } } } },
  { "flowName": "title", "cmd": "h2 Metrics by key", "reactions_": { "shown": "all.rowCount > 0" } }
]
```

Reading it: `all` is a prompt whose agent counts; `limit: 0` lifts the 100-row cap. `byKey` nests a count inside a group-by. `title` reads `all` by name, and its `shown` is a formula, not a saved assignment.

A flow row in `flows.jrl` holds that array as one string in `script`, with every `"` and newline escaped. Compact JSON on one line is enough (`function/flows.jrl:1`, shortened):

```js
p({"class": "foam.core.reflow.Flow", "category": "FLOAT", "name": "Function Blocks", "version": 1,
   "script": "[{\"flowName\": \"regions\", \"cmd\": \"dao region\", \"value\": {\"class\": \"foam.core.reflow.DAOPrompt\", \"label\": \"All regions\"}}]"})
```

## Before you call it done

1. The change is in a flow on a server started from your checkout, saved, reloaded and reopened (`references/testing.md`).
2. A gated command or agent has its grant, and you opened the flow as a person without it.
3. A sink meant for the server was seen running there, in the network tab.
4. Nothing you added is unused: no property no reader reads, no `agents.jrl` row for a class that was dropped, no `globalThis` hand-off.
5. A test covers the change on each side it touches.

## References

- `references/layer-map.md`: Console to view, the flow JSON, modes, load, save, autosave, history.
- `references/commands.md`: parsing, the command table, the recipe for a new command, permissions.
- `references/daoprompt.md`: every DAOPrompt option and its traps.
- `references/agents-and-sinks.md`: the agent family, `agents.jrl`, sinks on the server or in the browser, the recipe for a new agent.
- `references/scripts.md`: script, function, shell blocks, `preLoadScript`, scope, `autoRun`.
- `references/access.md`: `FlowAccess`, menus, permissions.
- `references/testing.md`: existing tests, how to add one, how to check in a running flow.
- `references/gotchas.md`: symptom, cause, fix.
- `references/ai-agents.md`: what the AI commands do today and what is direction only.
