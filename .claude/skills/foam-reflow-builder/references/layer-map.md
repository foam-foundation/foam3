# Layer map

Paths are under `src/foam/core/reflow/`.

## From a typed line to a drawn block

1. The Console (`Console.js`, a `foam.u2.Controller`) is the page. It holds one `Flow` as `value` and a flat list of `flowChildren`, the blocks.
2. At render it selects every command from `commandDAO` and puts one async function per command id into `localScope` (`Console.js:1453-1464`). A function clones the command into `currentBlock` and calls `execute(...args)`.
3. `eval_(cmd, opt_ignoreSelect, ignoreHistory, flowParent)` runs a line (`Console.js:1627-1735`):
   - it creates a block of `flowParent.childType` (a plain `Block`, or a `LayoutNode` under a layout, `LayoutBlock.js:99-104`) with `cmd` set (`:1639-1642`);
   - it evaluates the line inside three nested `with` scopes: `localScope` (commands), `innerScope` (`block`, `eval_`, `addValue`, `log`, `out`, `start`, `tag`, `find`), `flowScope` (the other blocks by name) (`:1644-1656`);
   - it names the block from the call (`cells(2,3)` is `cells1`) or from the command word (`:1661-1666`, `Flowable.js:136-141`);
   - a failure becomes a `BadBlock` named `error1` (`:1678-1686`, `BadBlock.js`);
   - a string, number, boolean or date result is wrapped in a Holder (`:1712-1727`).
4. A command puts what it makes in `block.value`, usually with `addValue(obj)`, which draws `obj` in the block and sets `block.value` (`Block.js:249-252`). `addValue(obj, true)` sets the value without drawing it.
5. `refreshFlowScope` rebuilds `flowScope` from all blocks: `flowName` maps to the block's `value` (a Holder is unwrapped), `flowName$block` to the block, and a block named `fooDAO` is also bound as `foo` (`Console.js:1601-1621`).

So `uploads.count` in a later command reads the `count` of the value of the block named `uploads`.

## The flow JSON

`Flow.script` is a JSON array, one object per block (`Flow.js:208-239`). `Console.generateScriptString` writes it with the strict outputter, leaves out properties equal to their default, and keeps `reactions_` (`Console.js:1900-1913`). `Block.outputJSON` lists what a block saves: `flowName`, `cmd`, `value`, `flowChildren`, `reactions_`, `allowLimitedEdit`, `border`, `shown`, plus the style properties (`Block.js:270-278`). A layout block adds `borderClass`, `gridColumns`, `flexContainerType`, `flexValue` (`LayoutBlock.js:30-47`).

```json
[
  { "flowName": "recent", "cmd": "dao om1MinuteDAO",
    "value": { "class": "foam.core.reflow.DAOPrompt", "aql": "count > 10", "limit": 0,
               "select": { "class": "foam.core.reflow.CountDAOAgent" } },
    "shown": true },
  { "flowName": "title", "cmd": "h1 Busy keys", "reactions_": { "shown": "recent.rowCount > 0" } }
]
```

The `cmd` is replayed on load, then `value` is copied onto the new value object (`Console.js:1304-1400`). So a saved block is "run the command, then restore these properties".

A flow is also a `Flowable`, so a block may hold `flowChildren` and a layout block holds its children in a layout (`Flowable.js:55-58`). The `include` command adds the blocks of another flow as children that are not saved with this flow (`cmd/Include.js:19-26`, `Block.js:270-273`).

## Load

1. The `route` property (the flow name in the URL) runs `load("name")` (`Console.js:1009-1027`), or offers the autosaved copy first (below).
2. `Load.execute` finds the flow in `flowDAO`, calls its `preLoadScript` without awaiting it, then `copyFrom(loaded)` (`cmd/Load.js:20-41`).
3. The change of `script` fires `onScriptChange`, subscribed at `Console.js:1473`. It clears the flow, then `includeScript` evaluates each block's `cmd`, copies the saved properties in, awaits the value's `onLoad`, and recurses into `flowChildren` (`Console.js:2280-2306`, `:1304-1400`).
4. An error in one block's `onLoad` turns that block into a `BadBlock` and the loop goes on (`Console.js:1376-1382`). `loadComplete` is published after `includeScript` returns, so BadBlocks do not stop it; it fires unless `includeScript` itself throws (`Console.js:2291`, `:2306`).

`onLoad` is how a value holds up the next block: `DAOPrompt.onLoad` returns a latch that resolves after its first select (`DAOPrompt.js:540-542`), and `AbstractScript.onLoad` runs the script when `autoRun` is true (`AbstractScript.js:51-53`).

## Modes

`flowMode` is an enum with one set of switches per value (`Console.js:653-800`).

| Mode | Prompts and tree | Header | Autosave written | Autosave offered on load |
|---|---|---|---|---|
| `CONSOLE` | yes | yes | yes | yes |
| `PRESENTATION` | no | yes | yes | yes |
| `PRESENTATION_ONLY` | no | no | no | no |
| `LIMIT_EDIT` | no | yes | no | yes |
| `LIMIT_EDIT_CONSOLE` | yes | yes | yes | yes |

`PRESENTATION_ONLY` is the embed mode for a page that must not edit (`Console.js:753-766`). The Escape key toggles `CONSOLE` and `PRESENTATION` through `getToggleTarget` (`:734`, `:750`). The `reflow` action on a flow row opens `flow_/<name>?flowMode=PRESENTATION` unless a mode is given (`Flow.js:376-387`).

## Save, autosave, history

- **Save.** `save()` asks before it overwrites an unsaved flow of the same name, then `doSave_` regenerates the script, bumps `version`, puts the flow in `flowDAO`, copies the result back and clears the autosave (`Console.js:1792-1850`).
- **Autosave.** After any block change, a merged listener writes `{ script }` to `localStorage` under `foam.reflow.autosavedscript:<flowName>`, only when the mode allows it, the flow has a name and `revision > 0` (`Console.js:869-870`, `:1204-1209`, `:2322-2352`). The key lives in the browser origin, so another server on another port has its own drafts. On the next load of that flow the Console offers the draft when it differs from the stored script (`Console.js:2032-2095`).
- **Version and revision.** `version` counts saves; `revision` counts unsaved edits and is transient (`Flow.js:178-197`).
- **History.** A rule on `flowDAO` runs after each put and appends a `FlowHistoryRecord` listing the changed properties; a put that changed nothing writes no record (`rules.jrl:1-15`, `FlowHistoryRuleAction.js:10-14`). `Flow.history` is a read-only view of those records for the flow (`Flow.js:243-261`).
- **Undo.** `mementoMgr` holds the undo stack. A load or a save clears it (`cmd/Load.js:38-40`, `Console.js:1837-1840`).

## Reactions

A block or a value can hold `reactions_`, a map of property name to formula. Each formula is evaluated in the flow scope about once a second and its result is assigned to the property; an error is reported per property (`ReactiveDetailView.js:85-140`). A formula may name a block that comes later in the flow. It polls, so it does not fire on a change.
