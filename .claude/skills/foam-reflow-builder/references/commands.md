# Commands

Paths are under `src/foam/core/reflow/`.

## How a line is parsed and run

`Console.eval_` (`Console.js:1627-1735`) does three things in order.

1. **`eval(cmd)`** in the scope `localScope`, `innerScope`, `flowScope` (`:1656-1661`). `h1('Errors')`, `clear`, `dao('logMessageDAO', 'logs')` and `recent.rowCount > 0` are all JavaScript, so this step runs them. A bare word such as `clear` evaluates to the command function, and `eval_` calls it (`:1690-1694`).
2. **Fallback on a syntax error.** `dao logMessageDAO` is not JavaScript, so `eval` throws. `eval_` splits at the first space, takes the word as the command id, and calls `scope[word](rest)` with everything after the space as one string (`:1667-1678`, `:1694`). It also turns a literal `\n` in the rest into a newline (`:1672`). So the one-line form takes exactly one argument; for two, use the call form.
3. **Otherwise a `BadBlock`.** An unknown word, a thrown error or a rejected promise makes a block named `error1` that shows the message (`:1678-1686`, `:1696-1703`).

Each command in `localScope` is a function made from a `commandDAO` row: it clones the command into the current block and calls `execute` (`:1459-1464`). Commands load once, when the Console renders, so a new `cmds.jrl` row needs a page reload.

Autocomplete is separate. `parser/CommandParser.js` builds one suggestion per visible row from the id and `description`, and a row's `parserClass` (a `foam.parse.Grammar`) completes its argument (`cmd/Command.js:34-48`, `parser/CommandParser.js:24-40`). `DAOTargetParser` completes DAO names and `FlowNameParser` completes flow names.

## Built-in commands

Ids are from `cmd/cmds.jrl`, `ai/cmds.jrl`, `float/cmds.jrl` and `man/cmds.jrl`. "Gated" means `permissionRequired: true`.

| Group | Command | What it makes |
|---|---|---|
| data | `dao <name>` | a `DAOPrompt` table of the DAO (`cmd/DAO.js:24-33`) |
| data | `FROM <dao> [SKIP n] [LIMIT n] [WHERE aql] [ORDER BY p] [COLUMNS a,b] [TO sink]` | the same, from a query line (`parser/FromParser.js:56-110`); gated |
| data | `daofilter <service>` | a filter bar over a DAO service name (`cmd/DAOFilter.js`) |
| data | `add <dao>` | a form to add a row (`cmd/DAOCreate.js`) |
| data | `upload <dao>` | the CSV, JSON or XML upload view |
| data | `daos`, `services`, `models`, `describe`, `api <dao>` | lists and explorers; `services`, `api` gated |
| data | `cells` | a spreadsheet grid; gated |
| text | `h`, `h1` to `h4`, `markdown`, `doc`, `image`, `signature`, `check`, `now`, `today`, `clock` | static or small widgets (`cmd/cmds.jrl:33-140`) |
| code | `script` | a browser JavaScript block (`Script.js`) |
| code | `function` | a script whose `return` is the block's value (`function/Function.js`) |
| code | `shell`, `beanshell`, `jshell` | a script that runs on the server as a job; gated |
| code | `button`, `buttons`, `input` | actions and prompts; `input` waits to be answered while a saved flow loads (`cmd/Input.js:7-20`) |
| flow | `flows`, `load <flow>`, `save <flow>`, `include <flow>`, `layout`, `clear`, `history`, `info`, `login` | flow management |
| flow | `preLoad`, `postLoad` | hidden hooks the Console runs itself (`Console.js:1513`) |
| help | `help`, `helpFn`, `helpMQL`, `man`, `example` | documentation |
| test | `testresults`, `test` | FLOAT test blocks (`float/cmds.jrl`) |
| perf | `perf`, `loadPerf <flow>` | load profiling; `loadPerf` gated |
| ai | `ai`, `agent`, `!`, `?`, `plan`, `ask`, `propose` | all gated; see `ai-agents.md` |

## Two ways to write a command

**A journal row with a `script`.** The script is the body of an async function. It sees `args` (the call's arguments), `addValue`, and the imports of `Command`: `block`, `currentBlock`, `log`, `out`, `eval_` (`cmd/Command.js:21`, `:56-69`). Use it for a few lines: `cmd/cmds.jrl:41-56` makes `now` and `today` this way.

```js
p({"class":"foam.core.reflow.cmd.Command", "id": "h2", "description": "Header 2", "icon": "h2",
   "script": "addValue(foam.core.reflow.Header.create({type:'h2', text: args.join(' ')}, this));"})
```

**A class that extends `foam.core.reflow.cmd.Command`.** Override `execute(...args)`. Use it for anything with imports, state or its own parser. `cmd/DAO.js:7-35` is the model, and `From` in the same file extends it to read a query line:

```js
foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'DAO',
  extends: 'foam.core.reflow.cmd.Command',
  requires: [ 'foam.core.reflow.DAOPrompt' ],
  imports: [ 'createFlowChildName' ],
  properties: [
    [ 'description', 'DAO data browser' ],
    [ 'parserClass', 'foam.core.reflow.parser.DAOTargetParser' ]
  ],
  methods: [
    function execute(dao, opt_label) {
      let p     = this.DAOPrompt.create({dao: dao, label: opt_label});
      let label = p.dao.of.model_.plural;
      p.addToE(this.out);                       // draw the value in the block
      this.currentBlock.flowName = opt_label || this.createFlowChildName(label.replaceAll(' ', '').toLowerCase());
      this.currentBlock.value    = p;           // other blocks read it by name
    }
  ]
});
```

The DAO name arrives as a string. `DAOPrompt` turns it into a DAO itself, through `DAOResolverMixin.resolveDAOFromKey`, which tries `<name>DAO` in the scope and the context, and dotted paths such as `flow.sub.dao` (`DAOResolverMixin.js:15-80`). A new data command should create a `DAOPrompt` with a different `select` agent and let it resolve the name.

A command may define `answer()` to return text for an LLM instead of its drawing (`cmd/Flows.js:38-40`, `Block.js:215-219`).

## Recipe: add a command

1. **Grep first.** `grep '"id": *"<word>"' cmd/cmds.jrl ai/cmds.jrl float/cmds.jrl`. Extend an existing command before adding a parallel one.
2. **Write it.** A `Command` row with a `script`, or a class in `cmd/<Name>.js` in package `foam.core.reflow.cmd`. Set `description`: it is the help text and the autocomplete label.
3. **Register it.** Add a row to `cmd/cmds.jrl`:
   ```js
   p({"class":"foam.core.reflow.cmd.RowCount", "id": "rowCount", "icon": "database", keywords: ["count"]})
   ```
   A `.jrl` beside a loaded `pom.js` needs no pom entry. `linkable: false` keeps it out of the clickable Components list and the help links, for commands that need arguments (`cmd/Command.js:30`, `Help.js:36-41`, `DynamicReflowComponents.js:74`). `hidden: true` removes it from help and autocomplete (`Help.js:31`, `parser/CommandParser.js:39`).
4. **Add the class to `pom.js`** as `{ name: 'cmd/RowCount', flags: 'js|java' }` (`pom.js:129-157`). The row replays on the server, which needs the Java class; a view-only class such as `cmd/DAORowView` is `js`.
5. **Permissions.** To gate it, set `permissionRequired: true` on the row. A user then needs `command.read.rowCount`: `authorizeOnRead` checks that string, and the select that builds the scope drops the row without it (`cmd/Command.js:83-89`, `core/auth/AuthorizationDAO.js:91-94`). Add `p({ "class": "foam.core.auth.Permission", "id": "command.read.rowCount" })` to `cmd/permissions.jrl` so the permission picker lists it, then grant it in a group or module (`access.md`). Not every gated command has a catalogue row (`FROM`, `api` and the `ai` commands do not), and the check works without one.
6. **Test it** (`testing.md`). Run the command through a stand-in `eval_` as `CommandToolTest` does, or put a `JSTest` over the class.
7. **Run it in a flow.** Reload the page, type the word, save the flow, reload and confirm the block comes back. A block that fails to reload becomes a `BadBlock` (`Console.js:1376-1381`).

## Traps

- A command that draws asynchronously must still return its promise, or the next block starts before it finishes: `includeScript` awaits `eval_` and then the value's `onLoad` (`Console.js:1349`, `:1377`).
- A command's `execute` runs on a clone made for the current block (`Console.js:1461`), so state kept on the command object is gone after the call. Keep state on the value.
- Naming: `createFlowChildName('x')` always returns `x1`, `x2`, ... (`Flowable.js:136-141`). A command that wants a fixed name sets `currentBlock.flowName` itself.
