# FOAM DevTools

A Chrome DevTools extension for inspecting FOAM3 apps at runtime. This build
has one feature: an **Elements sidebar** that answers what the browser's own
Elements panel can't — the stack of `u2` views above the selected DOM node,
what each one binds (DAO, record, property), and a copyable FOAM path. It only
reads from the live FOAM registry inside the inspected page; the one thing it
writes is the `$v`/`$d` console handles.

## Install

1. Open `chrome://extensions`, turn on **Developer mode**.
2. **Load unpacked** → select this folder (`tools/devtools/`).
3. Open a FOAM3 app page and **reload it** (content scripts inject on page
   load), then open DevTools (F12) → **Elements**. A **FOAM** pane appears in
   the sidebar next to Styles/Computed.

## The sidebar

Select any DOM node in Elements. The pane shows the **view stack** — every
`u2` view from the selected node up to `ctrl`, root at the top, wrappers
(`foam.u2.Element`, `SlotNode`, `HTMLView`, `Text`) folded away:

```
ApplicationController
  DAOBrowseControllerView   dao userDAO
    TableView               dao of User
      UnstyledTableRow      User #123 — Ajeet Gill
        PropertyBorder      prop email          VIEW / RO   ← selected
ctrl › DAOBrowseControllerView[userDAO] › TableView[User] › UnstyledTableRow[123] › email
console: $v = selected view, $d = its data
map: 1834 elements, 1210 with a DOM node, 12.4ms
```

Per row: the view's short class name (full id in the tooltip) and what it
binds — `dao <contextKey>` when the view carries a `config.daoKey`, else
`dao of <Class>`; `<Class> #<id> — <summary>` for a bound record; `prop
<name>` for a property view. `controllerMode / displayMode` is shown only on
rows where it differs from the row above.

- **Click a row** → Chrome reveals that view's root DOM node in the Elements
  tab (the pane then re-renders with that layer selected).
- **Path line** — the FOAM-level selector: `ctrl › Class[key|Of|id] › … ›
  prop`. Read-only input; click to select all.
- **`$v` / `$d`** — after every selection the page gets `window.$v` (the
  selected view) and `window.$d` (the nearest record above it), like React
  DevTools' `$r`. Console: `$v.controllerMode`, `$d.errors_`, `$d.email`.
- **map** — how many `u2` elements were walked, how many had a DOM node, and
  the walk time in ms.

Other states: "not a FOAM page" (no `window.foam`/`window.ctrl`), "no owning
u2 Element found" (the node is outside the `ctrl` tree — e.g. a browser
extension's own DOM), or a red error line (most often "no backend — reload the
inspected page").

## Architecture — three layers, one contract each

**Page world** (`shapers.js`, `backend.js`, `inspect-backend.js`; MAIN-world
content scripts, loaded in that order). `shapers.js` is pure: the DOM→`u2`
walk (`resolveOwner`), the stack of non-wrapper ancestors (`namedStack`) and
the per-layer shape (`layerOf`: DAO / record / prop / modes), with no
`window.foam` or DOM API use so it runs under Node. `backend.js` is the
core: `window.__foamDevtools.register(name, fn)` and `call(name, ...args)`.
**Contract:** `call` always returns a JSON string — `guard()` serialises the
result and turns any throw into `{"error": msg}`. Feature files register
methods; the core never changes per feature.

One documented exception: `window.__foamDevtools.node(i)` returns a live DOM
node (the `i`-th layer of the last inspected stack). It exists so the panel
can evaluate `inspect(node(i))` — Chrome's `inspect()` is a Command Line API
function that only exists inside `inspectedWindow.eval`, so the reveal has
to be composed on the panel side. It is installed directly on the API object,
never through `register`, so `call` itself never hands out a non-JSON value.

**Transport** (`common.js`, loaded by every extension page). `foamEval(expr)`
wraps `chrome.devtools.inspectedWindow.eval` and parses the JSON string.
**Contract:** never rejects — exceptions, non-string results and bad JSON all
resolve to `{error}`. `rpc(name, argExprs)` builds the one eval string
(`window.__foamDevtools.call(...)` with a no-backend fallback); `reveal(i)`
builds the other (`inspect(window.__foamDevtools.node(i))`). Views never
hand-write an eval string. `argExprs` are page-side JS fragments: `'$0'` for
the Elements selection, `JSON.stringify(v)` for data.

**Panel side** (`devtools.js`, `sidebar-core.js`, `sidebar.*`). `render(result)`
builds DOM from the response object alone — no page references, no state.
**Contract:** a view is a function of the last response. `sidebar-core.js`
holds the pure part (`pathOf`, `shortName`) so it has a Node test.

### Adding a method (how slice 2 plugs in)

1. Put the logic in a pure module with a Node test.
2. Add a page-world file that calls `window.__foamDevtools.register('name', fn)`
   and list it in `manifest.json` `content_scripts.js` after `backend.js`.
3. Call it from a view with `rpc('name', [ argExprs ])`.

## Limits

- Snapshot per selection; no live updates. Reselect to refresh.
- The `u2` tree is walked from `window.ctrl` on every `inspect` call (fresh
  `WeakMap`); large pages pay the walk each time — the **map** line shows the
  cost.
- The MAIN-world content script injects `window.__foamDevtools` into every
  page matching `<all_urls>`. This is a load-unpacked dev tool; narrow
  `matches` in `manifest.json` if that bothers you.

## Testing

Pure logic has Node tests with no dependencies:

```bash
node tools/devtools/test/shapers-test.js        # shapers-test: 17 passed
node tools/devtools/test/sidebar-core-test.js   # sidebar-core-test: 4 passed
node tools/devtools/test/backend-test.js        # backend-test: 4 passed
node tools/devtools/test/common-test.js         # common-test: 3 passed
```

### Smoke checklist (manual, ~3 minutes, after every load/reload of the extension)

1. **Bridge proof.** Load unpacked, open a FOAM app, reload the page, open
   DevTools → Elements. The FOAM pane reads "select an element…"; selecting
   `<body>` shows a one-row stack and a `map:` line. On a non-FOAM page the
   pane reads "not a FOAM page". In the page console
   `JSON.parse(__foamDevtools.call('ping')).foam` is `true`.
2. **Stack.** Select a table cell: the stack shows the controller row with
   `dao <key>`, the table with `dao of <Class>`, the row with `<Class> #<id>
   — <summary>`, and the selected layer last. `map: … ms` under 100 ms. The
   path input reads `ctrl › … › …[<id>] › …`.
3. **Reveal + handles.** Click the table row's stack entry: the Elements
   selection jumps to that row's DOM node and the pane re-renders with that
   layer selected. Console: `$v.cls_.id` is the selected layer's class,
   `$d.id` is the record id.
