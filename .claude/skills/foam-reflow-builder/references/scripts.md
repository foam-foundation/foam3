# Scripts and code in a flow

Paths are under `src/foam/core/reflow/`.

## The code blocks

| Command | Class | Runs | Result |
|---|---|---|---|
| `script` | `Script` | in the browser | text in the block's output area |
| `function` | `function/Function` | in the browser | its `return` value becomes the block's value |
| `button`, `buttons` | `cmd/Button`, `cmd/Buttons` | in the browser, on click | whatever the script does |
| `shell`, `beanshell`, `jshell` | `ShellScript`, `BeanShellScript`, `JShellScript` | on the server, as a job | the job's output; gated by `command.read.<id>` |

All except the buttons extend `AbstractScript`, which has `code`, `output` (transient), `autoRun` and the actions `run` and `clearOutput` (`AbstractScript.js:28-70`).

## Context of a browser script

`Script.run_` evaluates the code as an async function body under two `with` scopes (`Script.js:27-35`):

- the flow scope: every named block as its value, `name$block` as the block, the commands, `flow` (`Console.js:995-998`, `:1601-1621`);
- `x`, the script's own context (use `x.logMessageDAO` for a DAO), `log` (writes to this script's output) and `clear`.

`this` is the containing block (`Script.js:18-24`, `:31`). So `this.log(...)` writes into the block in the flow document, `this.tag(...)` and `this.start(...)` draw into it, and `log(...)` writes to the script's output area. `await` works.

Because the name resolves to the block's value, `myChart` is the `DAOPrompt` and its agent is `myChart.select`. A script that configures another block must come after that block in the flow, or the name is not defined yet (`Console.js:1601-1621`, blocks enter the scope as they are added).

After a script changes a prompt or an agent, call `myChart.run()` (`daoprompt.md`).

To hand a value to another block, use a `function` block. Its `return` value is the block's value, and `Function.run_` refreshes the scope after it settles, so another block reads it by the block's name (`function/Function.js:16-28`, `:60-71`). The block's `code` must contain `return`; it is validated (`:44-50`). A value passed through `globalThis` is invisible to the dependency scanner, so the editor shows no link between the blocks (`DependencyScanner.js:1-24`).

## `autoRun` and run on click

- `AbstractScript.onLoad` runs the script when `autoRun` is true and returns its promise, so the flow's load waits for it (`AbstractScript.js:51-53`, `Console.js:1377`). A script that never settles stalls the rest of the load.
- The `script` command sets `autoRun` to true when it is given code on the command line, and false for an empty block (`cmd/cmds.jrl:138-145`).
- With `autoRun` false the script does nothing on load. The person presses the block's Run action, or a button runs it.
- A `button` runs its `script` on click inside `with ( self.scope )` as an async function (`cmd/Button.js:50-60`). Put work that is expensive or reads a large table behind a button, since a flow runs every time it is opened.
- A server job script holds `running` while its job is in flight and disables Run (`AbstractJobScript.js:25-60`).

## `preLoadScript`

`Flow.preLoadScript` is one string of JavaScript run before the blocks (`Flow.js:198-206`).

- `Load.execute` wraps it as `(async function() { ... })`, calls it with `this` set to the load command, and does not await it (`cmd/Load.js:27`, `:43-47`). The blocks start while it may still be waiting.
- So define everything a block needs before the first `await`: classes, helper functions, a DAO.
- It runs before the flow's blocks exist, so it cannot read a block by name. It can reach `this.flow` and the globals.
- An error in it is not caught by the Console. The first sign is a block that cannot find a class, and one line in the browser console.
- It runs every time the flow loads in the same tab. A `foam.CLASS` that registers an id already registered asserts (`lang/Context.js:144-154`), so guard it: `if ( ! foam.maybeLookup('my.pkg.Thing') ) foam.CLASS({ ... });` (`lang/Context.js:71-75`). A guard keeps the old class until the page is reloaded, so reload after editing the class.
- A message and a property that give the same constant name stop the whole class. `RUNNING` and `running` both become `RUNNING`, and `installConstant` throws `Class constant conflict` (`lang/FObject.js:186-197`). Name messages `RUNNING_MSG`.
- Do not confuse it with the `preLoad` command. That is a hidden command the Console evaluates once when it renders; it deletes its own block and stamps `globalThis.preLoadTime` (`cmd/cmds.jrl:150-155`, `Console.js:1513`).

## Formulas in `reactions_`

A formula is a JavaScript expression evaluated in the flow scope about once a second; its result is assigned to the property (`ReactiveDetailView.js:91-140`). It may return a promise, and it may name a block that comes later. Use it for visibility, for a label, or for an `aql` that depends on another block:

```json
{ "flowName": "busy", "cmd": "dao om1MinuteDAO",
  "reactions_": { "shown": "all.rowCount > 0" } }
```

A reaction is the saved form. A script that assigns `busy$block.shown = ...` edits the document: `shown` is saved with the block and autosave stores whatever the last run left (`Block.js:132-134`, `:270-278`, `Console.js:2322-2352`). A sink agent draws its result only while `shown` is true, but it still runs its select while hidden (`AbstractDAOAgent.js:64-71`). A block that only feeds other blocks therefore still costs a select.
