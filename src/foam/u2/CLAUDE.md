# foam.u2 — UI framework

Framework reference: `doc/guides/claude.md` (section 18 is the view layer).

## Traps

Most of these fail quietly: the page renders, just wrong. Paths that do not start with `src/` or `doc/` are relative to this folder.

- **Bare `el.dynamic(fn)` stacks DOM on every re-run.** `dynamic()` is the plain `FObject` method (`src/foam/lang/FObject.js:748`) and never removes what the last run added. Write `el.add(this.dynamic(fn))`: `add()` wraps it in a `FunctionNode` that clears its previous output first (`Element2.js:1355-1357`, `:302-316`).
- **`callIf(cond, fn)` runs once, at render.** It is `if ( bool ) f.apply(this, args)` (`src/foam/lang/Fluent.js:33-37`). For a condition that changes later, use `.add(this.dynamic(fn))`.
- **A text input writes `data` on blur, not per keystroke.** `Input` binds the DOM `change` event unless `onKey` is true (`tag/Input.js:186`), and `onKey` defaults to true only for a property with validation (`:192-193`). A listener looks dead while the user types; set `onKey: true` on the view when you need every key.
- **`.add(this.SOME_ACTION)` binds the button to the context's `data`, not to your view.** The action's view takes `X.data$` (`Element2.js:2541-2545`). In a view that does not export itself as `data`, write `.tag(this.SOME_ACTION, { data: this })`.
- **An action named like an Element method replaces it.** An action installs a method of the same name (`src/foam/lang/Action.js:350-353`); an action called `add` breaks rendering.
- **`startContext({ controllerMode: 'VIEW' })` passes a string, and sectioned detail views then throw.** Context values are never adapted; pass `foam.u2.ControllerMode.VIEW`. See `doc/guides/ControllerModeAndVisibility.md`.
- **An action's `confirmationView` needs `ctrl` in the context and opens behind a `Popup.open()` dialog.** Without `ctrl` the action runs unconfirmed (`ActionView.js:189`); with it the modal goes under `ctrl` while the popup sits later on `body`. See `doc/guides/CSSLayout.md` section 5.
- **`foam.u2.JsLib` resolves even when the script fails to load.** `onload` and `onerror` both resolve (`JsLib.js:69`); check the library's global after awaiting it.
- **A read-only money value needs `objData` in the context** or it shows no symbol and can throw. See `doc/guides/CurrencyAndUnits.md`.
- **`^` in a `css:` block is rewritten everywhere, including `[class^="btn"]`.** See `doc/guides/CSSLayout.md` section 2.
- **Two `foam.comics.v3.DAOView`s on one page share the context's `config`.** `config` falls back to the imported one (`src/foam/comics/v3/DAOView.js:14`, `:52-55`); pass each its own: `.tag(this.DAOView, { data: dao, config: cfg })`.
- **A tab whose label is a view gets a counter as its URL key.** `mementoLabel` copies the label only when it is a string (`Tabs.js:32-36`), otherwise `0`, `1`, ... in add order (`UnstyledTabs.js:57-58`); set `mementoLabel` for a stable link.
- **Table sort order never reaches the URL.** `UnstyledTableView` reads a `memento` it never imports (`table/UnstyledTableView.js:39`, `:332`). See `doc/guides/Memento.md`.
- **Enum status needs no hand-made pill.** Colour the enum values and `ReadOnlyEnumView` draws the badge. See `doc/guides/Enum.md`.

Longer guides for these: `doc/guides/CurrencyAndUnits.md`, `doc/guides/CSSLayout.md`, `doc/guides/QA2.md` (the questionnaire engine in `qa/`), `doc/guides/Slots.md`, `doc/guides/Memento.md`.
