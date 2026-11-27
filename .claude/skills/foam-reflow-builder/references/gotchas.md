# Gotchas

Each entry starts with what you see. Paths are under `src/foam/core/reflow/` unless a root is named. "Read from code" means the cause follows from the cited lines; run the check before you rely on it.

## Data and filters

### A count, sum or group block stops at 100
**Cause.** `DAOPrompt.limit` defaults to 100 and is applied whenever it is not 0 (`DAOPrompt.js:244-248`, `:351-356`). Every agent but the table selects from the limited DAO (`AbstractDAOAgent.js:23`); the table reads the unlimited one (`TableDAOAgent.js:86-89`). **Fix.** Set `"limit": 0` on every block that aggregates.

### A typo in `aql` shows every row
**Cause.** The parsed predicate is applied only when it is truthy, and a failed parse gives nothing (`DAOPrompt.js:275-280`). No error is shown. A bad `where` string shows no error either (`:272`). **Fix.** Check the string in the editor's autocomplete, or compare `rowCount` with an expected number.

### `where` is set but the `aql` field disappeared
**Cause.** A non-empty `where` sets `enableAQL_` to false, which hides the `aql` field (`DAOPrompt.js:371`, `:381`, `:322`). Both strings still apply, `where` first (`:268-280`). `FromParser` fills `aql`, so `FROM x WHERE ...` and a `where` string can both be active on one block (`parser/FromParser.js`). **Fix.** Use one of them per block, and prefer `aql`.

### A `FilteredDAOAgent` ignores `aql` once `where` is set
**Cause.** Unlike `DAOPrompt`, it uses `aql` only while `enableAQL_` is true and `where` only when it is false (`FilteredDAOAgent.js:66-79`). **Fix.** Fill one field.

### The block shows the old answer after a script changed it
**Cause.** The view re-selects on `data`, `version` or a new `where`; a change to `aql` or `order` re-selects only with `autoRun`; any other property never does (`DAOPrompt.js:37-44`, `:576-579`, `:639-653`). **Fix.** Call `block.run()` after the change.

### A block of a busy DAO redraws all the time
**Cause.** The prompt listens to its DAO and re-selects 100 ms after any put or remove (`DAOPrompt.js:531`, `:626-637`). A count over a log DAO re-selects as lines arrive. **Fix.** Filter to rows that change rarely, or read the DAO once in a script block behind a button.

### A group key never equals what you compare it to
**Cause.** `GroupBy.groups` is a plain object, so keys are text: `'true'`, `'123'` (`mlang/sink/GroupBy.js:42-48`). **Fix.** Compare `key === 'true'` or `Number(key)`. When the grouped answer must add up, send a plain `COUNT()` in the same `SEQ` and compare.

### A "count where X" returns the full count
**Cause.** `FilteredSink` takes `predicate` and `delegate`. Created with other names (`arg1`), it has no predicate and lets every row through (`mlang/sink/FilteredSink.js:15-26`, `:40`). **Fix.** Use `predicate:`. To make a wrong condition visible, group by the condition: `GROUP_BY(EQ(field, ''), COUNT())` gives a `'true'` and a `'false'` group that must sum to the plain count.

### A script's `select` pulls the whole table into the browser
**Cause.** `ClientDAO` sends only `Serializable` sinks to the server and fills any other sink row by row in the browser (`dao/ClientDAO.js:62-90`). A tree is as local as its least capable member. **Fix.** Select with `COUNT`, `GROUP_BY`, `SEQ` or `FilteredSink`, built from `foam.mlang.Expressions`. Check the network tab: the request should name sink classes and the answer should hold no row fields.

### `TypeError ... reading 'comparePropertyValues'`
**Cause.** A `GroupBy` was built with an undefined property (`mlang/sink/GroupBy.js:96-102`). `GroupByDAOAgent.createSink` passes `this.prop` through unvalidated (`GroupByDAOAgent.js:132-135`); the form validates it, a script that builds the agent does not. **Fix.** Set `prop` before the select runs, then call `run()` (below).

## Blocks and order

### A chart-shaped hole: the block is there but empty, with no error
**Cause.** A script assigned the agent's property after the prompt already ran its select. The view re-selects only on `data` or `version` (`DAOPrompt.js:37-44`). **Fix.** Put the script after the block, set the property, then `block.run()`. Reading a block by name gives its value, so `myChart.select.prop = 'x'; myChart.run();`.

### `Cannot set properties of undefined`, or `x is not defined`, in a script
**Cause.** A block name in scope is the block's `value`, not the block (`Console.js:1601-1621`); `myChart.value.select` is undefined while `myChart.select` works. A name is also undefined when its block is later in the flow, and for a command the person may not read (`Console.js:1453-1464`). **Fix.** Use `name` for the value and `name$block` for the block; order the blocks; grant the command.

### The second argument of a one-line command is ignored
**Cause.** After a syntax error `eval_` calls the command with the rest of the line as one string (`Console.js:1667-1694`). `dao logMessageDAO logs` passes `'logMessageDAO logs'` as the DAO. **Fix.** Use the call form `dao('logMessageDAO', 'logs')`.

### A command added to `cmds.jrl` is not found
**Cause.** Commands are read once, when the Console renders (`Console.js:1453-1464`). **Fix.** Reload after changing `cmds.jrl`.

### A gated block loads as an error for some people
**Cause.** The command or agent is not in their scope without `command.read.<id>` or `agent.read.<id>` (`cmd/Command.js:83-89`, `SinkAgent.js:60-66`); the block becomes a `BadBlock` and the rest of the flow loads (`Console.js:1376-1381`). **Fix.** Grant it, or leave the gated block out of flows others open.

### A flow that works on a fresh block fails after Save and reload
**Cause.** A saved block is "run `cmd`, then copy these properties". A property not saved (`transient`), a class not registered at load, or an agent saved as an object whose class is missing fails only on reload (`Console.js:1349-1381`, `Block.js:270-278`). **Fix.** Always save, reload and reopen before calling a change done (`testing.md`).

### Derived values keep growing the saved flow
**Cause.** A property computed from others is saved with the block and in the undo history unless it is `transient` (`Block.js:270-278`). **Fix.** `transient: true`.

### Hiding a block by assigning `shown` edits the flow
**Cause.** `shown` is saved (`Block.js:132-134`, `:270-278`) and autosave stores whatever the last run left (`Console.js:2322-2352`). **Fix.** Put a formula in `reactions_`: `{ "shown": "other.rowCount > 0" }` (`ReactiveDetailView.js:91-140`).

### Two blocks with a value handed through `globalThis` show no link
**Cause.** The scanner looks for block names in `cmd`, `reactions_` and scripts, not for globals (`DependencyScanner.js:1-24`), and globals survive `clearFlow` into the next flow in the tab (`Console.js:1411-1419`). **Fix.** Return the value from a `function` block and read it by name.

### An old draft overrides the flow you just fixed
**Cause.** Autosave writes the script to `localStorage` per flow name and per origin; on load the Console offers it when it differs from the stored script (`Console.js:869-870`, `:1204-1209`, `:2032-2095`). **Fix.** Answer the prompt with discard, or clear the key `foam.reflow.autosavedscript:<flowName>`.

## Code in a flow

### `preLoadScript` fails and the blocks cannot find a class
**Cause.** It is wrapped as one async function and not awaited; one syntax error or one thrown line stops it, and the Console does not catch it (`cmd/Load.js:27`, `:43-47`). Anything after its first `await` may run after the blocks start. **Fix.** Define classes before the first `await`. Compile the text as the body of an async function in a throwaway check before saving it.

### `Class constant conflict` and the class is missing
**Cause.** A message and a property whose names give the same constant (`RUNNING`, `running`) throw in `installConstant` (`lang/FObject.js:186-197`). The class is not defined, so the view is blank, with one line in the console. **Fix.** Name messages `RUNNING_MSG`.

### `is already registered in this context`
**Cause.** A `foam.CLASS` in `preLoadScript` runs on every load, and a second registration of one id asserts (`lang/Context.js:144-154`). **Fix.** `if ( ! foam.maybeLookup('my.pkg.Thing') ) foam.CLASS({...});`, then reload the page after editing the class, since the guard keeps the old one (`lang/Context.js:71-75`).

### Saving a flow from the browser halves each `\\` in a script
**Cause.** The browser sends objects with the network outputter (`box/HTTPBox.js:118-124`, `lang/JSON.js:747-757`). Its string escape keeps an existing `\\`, `\"` or `\u` as it is, without escaping the backslash again (`lang/JSON.js:322-336`, `:439-447`). `Flow.script` is sent as parsed JSON, so the strings of its blocks take this path (`Flow.js:220-226`). The server reads `\\` as one backslash. A lone `\d` in a regex is escaped and survives (read from code). **Fix.** Write the character itself, or a regex literal (`/\d/`) instead of a string holding `'\\d'`, and read the flow back after a put to compare.

### A `foam.core.reflow.*DAOAgent` fails when used as a plain sink
**Cause.** An agent is not a sink. It builds one in `createSink()` and reads `this.block.value` while it runs (`AbstractDAOAgent.js:46-58`). **Fix.** In a script, select with `foam.mlang.Expressions` sinks (`E.COUNT()`, `E.GROUP_BY(prop, E.SUM(prop2))`).

### A `function` block says it must return something
**Cause.** Its `code` is validated for the word `return` outside comments (`function/Function.js:44-50`). **Fix.** Return the value, or use a `script` block for side effects.

## Agents and sinks

### A sink counts rows twice on the second run
**Cause.** The prompt runs the same agent again and `dao.select` never clears the sink it is given (`AbstractDAOAgent.js:46-51`). An agent that keeps its sink in a property adds to it. **Fix.** `createSink()` returns a new sink every call.

### A group-by of nothing: `GroupBy.getArg1() is null` on the server
**Cause.** A sink built from fields before they are picked groups by nothing. `GridBy` clears its stored `rows` and `cols` whenever `xFunc`, `yFunc` or `acc` change so they rebuild (`GridBy.js:83-95`); a sink with its own stored factories needs the same. **Fix.** Clear derived properties on input change, or compute them in `createSink()`.

### The new agent is missing from the picker
**Causes, in order of frequency.** The `agents.jrl` row has a `type` other than `format`, `structure`, `calculation` or `chart` (`SinkView.js:59`); the row is `sink: false` and you are looking in a group-by's "Operation" field (`SinkView.js:58`); `permissionRequired` is true and the person has no `agent.read.<id>` (`SinkAgent.js:60-66`); the class is not in `pom.js`. **Fix.** Walk the list.

### A new agent id shows an old grant
**Cause.** The id is the permission name `agent.read.<id>` (`SinkAgent.js:62`). Grants outlive rows. **Fix.** Never reuse an id.

### A calendar chart shows one cell per month and loses days
**Cause.** `CalendarDAOChartView` keys values by month and year from labels shaped `YYYY-MM...` and writes each label into the same cell, so a later day of a month overwrites an earlier one, and a label with no `-` is skipped (`src/org/chartjs/CalendarDAOChartView.js:49-62`). Its sink is not `Serializable`, so the rows are pulled to the browser (`dashboard/DashboardSinks.js:2422-2430`). `DateToYYYYMMDDExpr` returns `YYYY/MM/DD` (`mlang/expr/DateToYYYYMMDDExpr.js:28-30`). **Fix.** For a per-day view, draw your own strip from a grouped count. Other chart traps are in `foam-chart-builder`.

## Documents

### A Knowledge Base page shows the wrong name or merges with another
**Cause.** A flow's id is its `name` (`Flow.js:34`), so two flows with one name are one row. **Fix.** Give every flow a unique name.
