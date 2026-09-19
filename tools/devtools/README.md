# FOAM DevTools

A Chrome DevTools extension for inspecting FOAM3 apps at runtime. Two
surfaces: an **Elements sidebar** showing the stack of `u2` views above the
selected DOM node, what each binds (DAO, record, property) and a copyable FOAM
path; and a **FOAM panel** whose **Why** tab explains, for the record on
screen, why each field is hidden or read-only, what validation is failing, why
each action is greyed or missing, and which permissions the screen has asked
for. It only reads from the live FOAM registry inside the inspected page; the
one thing it writes is the `$v`/`$d` console handles.

## Install

1. Open `chrome://extensions`, turn on **Developer mode**.
2. **Load unpacked** → select this folder (`tools/devtools/`).
3. Open a FOAM3 app page and **reload it** (content scripts inject on page
   load), then open DevTools (F12). A **FOAM** pane appears in the Elements
   sidebar next to Styles/Computed, and a **FOAM** tab next to Console.

## The sidebar

Select any DOM node in Elements. The pane shows the **view stack** — every
`u2` view from the selected node up to `ctrl`, root at the top, wrappers
(`foam.u2.Element`, `SlotNode`, `HTMLView`, `Text`) folded away:

```
ApplicationController
  DAOBrowseControllerView   dao userDAO
    TableView               dao of User
      UnstyledTableRow      User #123 — Ajeet Gill
        PropertyBorder      prop email          ← selected
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
  selected view) and `window.$d` (the record on screen), like React
  DevTools' `$r`. Console: `$v.controllerMode`, `$d.errors_`, `$d.email`.

  Which object is "the record" follows FOAM's own conventions, because a
  property view's `data` is the property *value* (`Element2.js:1816`) and
  enum values / nested objects look like records too. Rules (`pickRecord`
  in `shapers.js`): a layer bound to a DAO, a view or the navigation stack
  is skipped; an edit screen's `workingData` wins over its original; a
  layer whose `data` is a property value of the enclosing `objData` (the
  record PropertyBorder / DetailView / TableCellFormatter export) is a
  value view — skipped; a Reference citation under an id-valued property
  view is a foreign record — skipped; a detail view's own `currentData_`
  (comics v3) or `workingData` (comics v2) wins, also when reached through
  an action button bound to that view. So the status badge gives the
  record, not the enum; a field inside a nested address gives the address;
  the Save button gives what the form is editing.
- **map** — how many `u2` elements were walked, how many had a DOM node, and
  the walk time in ms.

Other states: "not a FOAM page" (no `window.foam`/`window.ctrl`), "no owning
u2 Element found" (the node is outside the `ctrl` tree — e.g. a browser
extension's own DOM), or a red error line (most often "no backend — reload the
inspected page").

## The Why tab

Select a node inside a form or table in Elements (the sidebar's `$d` is the
record), open the **FOAM** panel, press **Refresh**. Six blocks:

1. **Record** — class, id, summary, the `controllerMode` in force where you
   clicked (read from the context, the way FOAM's own views get it; "none in
   scope → FOAM default" means CREATE by `Element2.js:569`).
2. **Fields (N not RW)** — every property that is not read-write, with the
   step of FOAM's visibility ladder that decided it (`createVisibilityFor`
   in `foam.u2.Element2`): `readVisibility → RO`, `visibility function →
   HIDDEN`, `VIEW clamps RW → RO`, `user.rw.salary denied → RO`,
   `user.ro.salary denied → HIDDEN`. Read-write fields are collapsed under
   "and N read-write". A field marked `(hidden axiom)` has `hidden: true`.
   One FOAM quirk is called out explicitly: `readPermissionRequired` on its
   own never restricts on the client (write is not gated, so `allowCreate`
   stays true) — the row says `… denied but write not gated — no effect`.
3. **Validation (N failing)** — `obj.errors_`: field, current value, message.
4. **Actions (N blocked)** — per action: available ✓/✗, enabled ✓/✗, and the
   gate that failed: `isEnabled → false`, `running`, `user.approve denied`,
   `confirm required`.
5. **Sections** — only for classes that declare sections: `isAvailable` and
   the `<cls>.section.<name>` permission.
6. **Permissions checked (N, M denied)** — every permission string the page's
   cached auth service has been asked this session, ✓/✗/…, plus a copy box
   with the denied ones.

Permission answers are promises; the panel shows `…` and re-polls up to three
times (400 ms apart) until they land. Nothing is subscribed — press Refresh
after changing a value.

## Open in FOAM

The app already has an edit form for every record; you normally reach it
through a menu and a table. **Open in FOAM** (Why tab, record line) pushes
`foam.comics.v2.DAOUpdateView` for the selected record onto the app's own
navigation stack, so FOAM draws it with the app's styling, permissions and
validation — the extension writes no UI. The DAO comes from the view stack
(a table above the row) or the detail view's `config.dao`; with neither you
get a `SectionedDetailView` of the object (validates, no Save). Same
`stack.push(StackBlock)` call the comics controllers make
(`DAOSummaryView.js:180`). Use the app's Back to return.

## Architecture — three layers, one contract each

**Page world** (`shapers.js`, `why-core.js`, `backend.js`,
`inspect-backend.js`, `why-backend.js`, `open-backend.js`; MAIN-world content
scripts, loaded in that order). `shapers.js` and `why-core.js` are pure: the DOM→`u2` walk
(`resolveOwner`), the stack of non-wrapper ancestors (`namedStack`), the
per-layer shape (`layerOf`), and the gate replay (`propGate`, `actionGate`,
`sectionGate`) — no `window.foam` or DOM API use, so they run under Node with
injected evaluators. `backend.js` is the core: `window.__foamDevtools
.register(name, fn)` and `call(name, ...args)`.
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

**Panel side** (`devtools.js`, `sidebar-core.js`, `sidebar.*`, `why-explain.js`,
`panel.*`). `render(result)` builds DOM from the response object alone — no
page references. **Contract:** a view is a function of the last response. The
FOAM panel keeps all its state in one object (`state = { tab, why, pollsLeft }`)
and one `render(state)`; later tabs add a key and a render function. The pure
parts (`pathOf`, `shortName`; `explainProp`, `explainAction`,
`explainSection`) live in their own files so they have Node tests.

Shared page-side selection: `inspect` stores `D.selection = { data, view }`
(the record on screen and the view holding it); `why` reads it, so the panel
passes no arguments.

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
node tools/devtools/test/shapers-test.js        # shapers-test: 30 passed
node tools/devtools/test/sidebar-core-test.js   # sidebar-core-test: 4 passed
node tools/devtools/test/backend-test.js        # backend-test: 4 passed
node tools/devtools/test/common-test.js         # common-test: 3 passed
node tools/devtools/test/why-core-test.js       # why-core-test: 20 passed
node tools/devtools/test/why-explain-test.js    # why-explain-test: 15 passed
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

### Smoke checklist — Why tab

4. **Fields + validation.** Select a field inside a detail view → FOAM panel
   → Refresh. Record line names the record and its mode; Fields lists the
   hidden/RO ones with a reason; on a create form with a required field
   empty, Validation shows it with the "Please enter valid …" message.
5. **Permissions.** On a record whose model has a `writePermissionRequired`
   property, the why column names `<cls>.rw.<prop>` and Permissions checked
   lists it with ✓ or ✗ (may show `…` for one re-poll).
6. **Actions.** A greyed button on screen appears with `enabled: …` naming
   the gate; change the field it depends on, Refresh → flips.
7. **Open in FOAM.** Why tab → Open in FOAM → the app shows the edit form
   for the record you clicked; Back returns.
8. **Comics v3 header.** On an `admin.data` detail screen (comics v3),
   click the record title or the Edit/Save/Cancel buttons in Elements: the
   stack shows `ButtonGroup → … → Stack` (they live in the stack header) but
   the Why tab still names the record — it comes from the `detailView`
   context export.
