# FOAM DevTools

A Chrome DevTools extension for inspecting FOAM3 apps at runtime. Two
surfaces: an **Elements sidebar** showing the stack of `u2` views above the
selected DOM node, what each binds (DAO, record, property) and a copyable FOAM
path; and a **FOAM panel** with two tabs: **Why** explains, for the record on
screen, why each field is hidden or read-only, what validation is failing, why
each action is greyed or missing, and which permissions the screen has asked
for; **Tree** shows the live `u2` view tree of the current screen, and a row
click selects that element everywhere. It reads the live FOAM registry inside the inspected page and writes
only: the `$v`/`$d` console handles; the hover outline while a Tree row is
hovered; permission checks it asks the app's
cached auth service (so the "checked" list grows with the panel's own
questions); and, on **Open in FOAM**, a view pushed onto the app's stack.

## Install

1. Open `chrome://extensions`, turn on **Developer mode**.
2. **Load unpacked** → select this folder (`tools/devtools/`).
3. Open a FOAM3 app page and open DevTools (F12). A **FOAM** pane appears in
   the Elements sidebar next to Styles/Computed, and a **FOAM** tab next to
   Console. The page-world backend is injected the first time either asks
   the page something, and again after a page reload — nothing runs on a
   page until a FOAM view is opened on it.

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
console: $v = the selected element, $d = the current target's record
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
  selected element itself, a wrapper `Element` when that is what you
  clicked) and `window.$d` (the record on screen), like React DevTools'
  `$r`. Console: `$v.controllerMode`, `$d.errors_`, `$d.email`.

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
extension's own DOM), or a red error line (`backend inject failed: …` when
the page refused the backend, e.g. mid-reload — pick the element again).

## The Why tab

Open a record in the app, open the **FOAM** panel: it explains the record on
screen, and follows you — the panel polls the route and stack position once a
second and reloads when they change, and a click in Elements counts as a
change. No Refresh needed. Selecting a node inside a form or table in
Elements overrides the screen record for as long as the node is inside the
stack's current view (a table row you clicked stops counting once its
record is opened, even though the hidden table stays in the DOM);
**Refresh** re-reads either way. On a table screen the panel says "table of
<Class>" until you open a row. Six blocks:

1. **Record** — class, id, summary, where it came from ("record on screen"
   or "from Elements selection"), and the `controllerMode` in force (read
   from the context, the way FOAM's own views get it; "none in scope → FOAM
   default" means CREATE by `Element2.js:569`).
2. **Fields (N not RW)** — every property that is not read-write, with the
   step of FOAM's visibility ladder that decided it (`createVisibilityFor`
   in `foam.u2.Element2`): `readVisibility → RO` (the factory default in
   VIEW), `visibility function → HIDDEN`, `VIEW clamps RW → RO` (only a
   visibility *function*'s result is clamped; `visibility: 'RW'` stays RW),
   `user.rw.salary denied → RO`, `user.ro.salary denied → HIDDEN`.
   Read-write fields are collapsed under "and N read-write". A field with
   `hidden: true` is marked `(hidden axiom)` and is HIDDEN whatever its
   ladder says — FOAM drops it before the ladder runs (Section.js:178) —
   unless a section names it in an explicit `properties` list, which keeps
   it (Section.js:161-175); then the ladder decides and the reason opens
   with `hidden: true, but a section lists it`. A record with no auth
   in its context reads `no auth in scope → HIDDEN` on every
   permission-gated field, which is what FOAM does (Element2.js:1888); an
   action's permission check is skipped in that case (Action.js:218), and a
   `permissionRequired` section stays blocked. This is the **class-level** ladder:
   a view's per-property `config` override (`{ name: 'x', visibility: 'RW' }`
   in a section or PropertyBorder) is not replayed.
   One FOAM quirk is called out explicitly: `readPermissionRequired` on its
   own never restricts on the client (write is not gated, so `allowCreate`
   stays true) — the row says `… denied but write not gated — no effect`.
3. **Validation (N failing)** — `obj.errors_`: field, current value, message.
4. **Actions (N blocked)** — per action: available ✓/✗/…, enabled ✓/✗/…, and
   the gate that failed: `isEnabled → false`, `running`, `user.approve
   denied`, `isAvailable pending (async)`, `confirm required`. An `async`
   gate is `…` until its promise settles, as in FOAM (a PromiseSlot holds
   the old value until then).
5. **Sections** — only for classes that declare sections: `isAvailable`, the
   `<cls>.section.<name>` permission, and "all N fields HIDDEN, all M actions
   unavailable" (a section shows when one of its fields is visible **or** one
   of its actions is available, SectionAxiom.js:157-164). The mark folds all
   three like an action's: ✗ when one has settled false, else `…` while any
   is still pending (an async `isAvailable`, a permission, an action's async
   `isAvailable` that could still turn the section on), else ✓.
6. **Permissions checked by the page or this panel (N, M denied)** — every
   permission string the record's cached auth service has been asked, by the
   app or by this replay, ✓/✗/…, plus a copy box with the denied ones.
   Answers are keyed by FOAM's own cached promise, so they reset when FOAM's
   cache does (login, group or capability change).

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

## The Tree tab

The live u2 view tree of the screen currently shown — the navigation stack's
current view (`ctrl.stack.current`) down, since `Stack.push` only hides the
previous view. One row per element: short class name, what it is bound to
(record, DAO, view) and its property when it has one; elements with
`shown === false` are greyed and tagged `hidden`. `▸`/`▾` toggles a subtree,
alt-click toggles the whole branch, **Expand all / Collapse all** the whole
tree (collapse keeps the root open); the root and two levels below it start
open, a chain of only children stays open until it branches, plus the path
to the selected element. **hide wrappers** (on by default, remembered) folds
`Element`, `SlotNode`, `Text` and `HTMLView` rows away and moves their
children up, so the tree reads as the views someone wrote — same list the
sidebar folds (`WRAPPER_CLASSES` in `shapers.js`, matched by exact class id:
a subclass you named is a view, not a wrapper). Unticked, those rows are
shown greyed with a `wrapper` tag, so you can see what ticking will fold.
A `hidden` tag marks `shown === false`.

Hovering a row outlines that element on the page (a blue box with the class
name and size — drawn by the page, since Chrome gives extensions no overlay
API; it is the only DOM the extension adds). It goes away on mouse-out, on
leaving the Tree tab, when the panel closes — and by itself 2.5 s after the
panel last repeated the hover (once a second while a row stays hovered), so
a panel that is hidden or torn down cannot leave it behind. A row
re-rendered under the pointer by the poll or a toggle fires no mouseleave;
before each repeat the panel checks that the row which started the hover is
still in its DOM and, if not, follows the row now under the pointer or
clears the outline.
Clicking a row selects the element: the sidebar shows its chain, the Why tab
explains its record, and `$v` / `$d` point at it — DevTools stays on this
panel. **Reveal in Elements** jumps the Elements tab to the selected
element's own DOM node when you want it. A selection made in Elements shows
up here too; when it is a wrapper (every `.start('div')` is a
`foam.u2.Element`) and wrappers are hidden, the nearest row above it is
marked. The tree reloads with the same 1s screen poll as the Why tab, so
navigating in the app swaps it; only the showing tab loads, and switching
tabs reloads the one you switch to. Snapshots are capped at 5000 nodes
("showing N nodes (capped)").

## Architecture — three layers, one contract each

**Page world** (`shapers.js`, `why-core.js`, `backend.js`,
`selection-backend.js`, `tree-backend.js`, `inspect-backend.js`,
`why-backend.js`, `open-backend.js`; `BACKEND_FILES` in `common.js`, in
that order). They are not content scripts: the first `rpc()` that finds no
`window.__foamDevtools` fetches them from the extension, concatenates them
under one `if ( ! window.__foamDevtools )` guard and evaluates the bundle
with `chrome.devtools.inspectedWindow.eval` — the same channel every call
uses, and exempt from the page's CSP like the console. So the manifest
lists no content scripts, permissions or host patterns, and a page the
panel never opened on carries nothing. `shapers.js` and `why-core.js` are
pure: the DOM→`u2` walk
(`resolveOwner`), the stack of non-wrapper ancestors (`namedStack`), the
per-layer shape (`layerOf`), the tree snapshot (`treeOf`, over the one child
rule `childrenOf`), and the gate replay (`propGate`, `actionGate`,
`sectionGate`) — no `window.foam` or DOM API use, so they run under Node with
injected evaluators. `backend.js` is the core: `window.__foamDevtools
.register(name, fn)` and `call(name, ...args)`.
**Contract:** `call` always returns a JSON string — `guard()` serialises the
result and turns any throw into `{"error": msg}`. Feature files register
methods; the core never changes per feature.

The panel-facing API is `call` and one documented exception:
`window.__foamDevtools.node(i)` returns a live DOM node (the `i`-th named
layer of the selection; with no index, the selected element's own). It
exists so the panel can evaluate `inspect(node(i))` — Chrome's `inspect()` is
a Command Line API function that only exists inside `inspectedWindow.eval`,
so the reveal has to be composed on the panel side. It is installed directly
on the API object, never through `register`, so `call` itself never hands out
a non-JSON value. The other members of `window.__foamDevtools` (`foamReady`,
`register`, `selectNode`, `currentTarget`, `screenRoot`, ...) are plumbing
between the page-side files, not part of the panel contract.

**Transport** (`common.js`, loaded by every extension page). `foamEval(expr)`
wraps `chrome.devtools.inspectedWindow.eval` and parses the JSON string.
**Contract:** never rejects — exceptions, non-string results and bad JSON all
resolve to `{error}`. `rpc(name, argExprs)` builds the one eval string
(`window.__foamDevtools.call(...)` with a no-backend fallback); `reveal(i)`
builds the other (`inspect(window.__foamDevtools.node(i))`). Views never
hand-write an eval string. `argExprs` are page-side JS fragments: `'$0'` for
the Elements selection, `JSON.stringify(v)` for data.

**Panel side** (`devtools.js`, `sidebar-core.js`, `sidebar.*`, `tree-core.js`,
`why-explain.js`, `panel.*`; the panel also loads the pure `shapers.js` for
`WRAPPER_CLASSES`, so its labels name the same list the page folds). `render(result)` builds DOM from the response object alone — no
page references. **Contract:** a view is a function of the last response. The
FOAM panel keeps all its state in one object (`state = { tab, why, tree,
expanded, selected, ... }`) and one `render(state)`; each tab has a render
function. The pure parts (`pathOf`, `shortName`, `layerText`; `flatten`,
`defaultExpanded`, `shownUid`; `explainProp`, `explainAction`,
`explainSection`) live in their own files so they have Node tests.

Page-side selection has one owner, `selection-backend.js`: `inspect` (from
Elements) and `selectUid` (from the Tree tab) hand it the pointed-at element
(`D.selectNode(el)`), which builds the named stack itself — one rule for
both entry points; `why` and `openRecord` ask `D.currentTarget()` — the
pointed-at element's record while its node is inside the screen
(`D.screenRoot()`: the navigation stack's current view), else the record the
screen is about, else the table it lists. Only the pointer is stored;
record, DAO and mode are resolved on every ask by the pure `resolveRecord`
/ `screenTarget` in `shapers.js`, so a view that moves from VIEW to EDIT
(and to its working copy) after the click is reported correctly. The same
file answers `screenKey`, what the panel polls. The state `tree-backend.js`
keeps is the uid→element map of its last snapshot (a cache of what the
panel is looking at, rebuilt on every `tree` call) and the handle of the
hover overlay. Every factory-backed read goes through `own(el, key)` (the
element's `instance_` only) — `element_`, `config`, `controllerMode`,
`mode`, `shown`, `currentData_`, `workingData` — because a FOAM property read can run
its factory: `element_` would create a DOM node, `controllerMode` would
default to CREATE. Plain getters (`data`, `prop`, `childNodes`, `$UID`) are
read directly. `why-backend.js` keeps one thing across calls: a `WeakMap` of
settled promises, keyed by the promise so it lives exactly as long as
FOAM's own auth cache entry; the auth itself is a closure argument per call.

### Adding a method

1. Put the logic in a pure module with a Node test.
2. Add a page-world file that calls `window.__foamDevtools.register('name', fn)`
   and list it in `BACKEND_FILES` (`common.js`) after `backend.js`.
3. Call it from a view with `rpc('name', [ argExprs ])`.

## Limits

- The sidebar is a snapshot per selection. The panel polls the route,
  stack position and selection once a second; nothing is subscribed. Only
  the showing tab loads; switching tabs reloads the one you switch to.
- The `u2` tree is walked from `window.ctrl` on every `inspect` call (fresh
  `WeakMap`); large pages pay the walk each time — the **map** line shows the
  cost.
- The backend lives in the page's main world once injected
  (`window.__foamDevtools`, `__foamShapers`, `__foamWhyCore`, `$v`, `$d`)
  for the rest of that page's life; only pages a FOAM view was opened on
  get it.
- The tree's uid → element map pins the last snapshot (up to 5000 elements,
  with their records and DAOs) while the Tree tab shows; leaving the tab or
  closing the panel releases it. A selected element is released once its
  DOM node leaves the document.

## Testing

Pure logic has Node tests with no dependencies. One command runs them all,
each file in its own process; the exit code is the number of failing files:

```bash
npm run test:devtools                           # = node tools/devtools/test/run-all.js
                                                # 7 files, 218 assertions passed
```

Or one at a time:

```bash
node tools/devtools/test/shapers-test.js        # shapers-test: 62 passed
node tools/devtools/test/sidebar-core-test.js   # sidebar-core-test: 15 passed
node tools/devtools/test/tree-core-test.js      # tree-core-test: 39 passed
node tools/devtools/test/backend-test.js        # backend-test: 5 passed
node tools/devtools/test/common-test.js         # common-test: 20 passed
node tools/devtools/test/why-core-test.js       # why-core-test: 40 passed
node tools/devtools/test/why-explain-test.js    # why-explain-test: 34 passed
```

### Smoke checklist (manual, ~3 minutes, after every load/reload of the extension)

1. **Bridge proof.** Load unpacked, open a FOAM app, open DevTools →
   Elements. The FOAM pane reads "select an element…"; selecting
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

4. **Fields + validation.** Open any record (e.g. `#admin.data/userDAO/1`)
   → FOAM panel. Without touching Elements, the Record line names the record
   and its mode within a second; navigate to another record → it follows.
   Fields lists the hidden/RO ones with a reason; on a create form with a
   required field empty, Validation shows it with the "Please enter valid …"
   message.
5. **Permissions.** On a record whose model has a `writePermissionRequired`
   property, the why column names `<cls>.rw.<prop>` and Permissions checked
   lists it with ✓ or ✗ (may show `…` for one re-poll).
6. **Actions.** A greyed button on screen appears with `enabled: …` naming
   the gate; change the field it depends on, Refresh → flips.
7. **Open in FOAM.** Why tab → Open in FOAM → the app shows the edit form
   for the record you clicked; Back returns.
8. **Comics v3 header (open question).** On an `admin.data` detail screen
   (comics v3), click the Edit/Save/Cancel buttons in Elements: the stack
   shows `ButtonGroup → … → Stack` (they live in the stack header,
   `Stack.js:155`, outside the current view's DOM). Expected by source:
   `onScreen` rejects them and the Record line reads "(record on screen)".
   If it reads "(from Elements selection)" instead, the `detailView` branch
   of `resolveRecord` is what answered; if not, that branch is dead and
   should go (`shapers.js` `resolveRecord`, its test, and this step).

### Smoke checklist — Tree tab

9. Open a record (e.g. `#admin.data/userDAO/1`) → FOAM panel → Tree. Rows
   show the screen's views; a `DetailView  User #1` row is present.
10. Hover a `PropertyBorder  prop email` row → a blue box outlines that
    field on the page, gone on mouse-out. Click the row → DevTools stays on
    the FOAM panel; the sidebar shows its chain, Why still says User #1,
    console `$v` is the PropertyBorder. **Reveal in Elements** → Elements
    tab jumps to its DOM node.
11. Click `▸` on a collapsed row → its children appear; click `▾` → gone; the
    1s poll does not reset the toggle. Alt-click `▸` → the whole branch
    opens. Untick **hide wrappers** → `Element`/`SlotNode` rows reappear.
12. Navigate to another record → tree swaps within a second, selection
    highlight clears.
13. Select a node in Elements → the Tree tab highlights its row and opens the
    path to it.
