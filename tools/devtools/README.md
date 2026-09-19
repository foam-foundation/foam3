# FOAM DevTools

A Chrome DevTools extension for inspecting FOAM3 apps at runtime. This build
has one feature: an **Elements sidebar** that answers what the browser's own
Elements panel can't — which `u2` view owns a DOM node, what data object
backs it, and which controller/display mode it is in. It only reads from the
live FOAM registry inside the inspected page.

## Install

1. Open `chrome://extensions`, turn on **Developer mode**.
2. **Load unpacked** → select this folder (`tools/devtools/`).
3. Open a FOAM3 app page and **reload it** (content scripts inject on page
   load), then open DevTools (F12) → **Elements**. A **FOAM** pane appears in
   the sidebar next to Styles/Computed.

## The sidebar

Select any DOM node in Elements. The pane shows:

- **element:** the `u2.Element` subclass that rendered the node.
- **view:** the nearest ancestor that is not a plain wrapper
  (`foam.u2.Element`, `SlotNode`, `HTMLView`, `Text`) — the view class a
  developer actually wrote.
- **data:** the class of the data object on that view or the nearest ancestor
  holding one (`instance_.data` or `data`), or "no data object".
- **mode:** `controllerMode / displayMode` (`—` when unset).
- **map:** how many `u2` elements were walked, how many had a DOM node, and
  the walk time in ms.

Other states: "not a FOAM page" (no `window.foam`/`window.ctrl`), "no owning
u2 Element found" (the node is outside the `ctrl` tree — e.g. a browser
extension's own DOM), or a red error line (most often "no backend — reload the
inspected page").

## Architecture — three layers, one contract each

**Page world** (`shapers.js`, `backend.js`, `inspect-backend.js`; MAIN-world
content scripts, loaded in that order). `shapers.js` is pure: the DOM→`u2`
walk (`resolveOwner`), wrapper climbing (`namedOwner`) and data lookup
(`dataOwner`), with no `window.foam` or DOM API use so it runs under Node.
`backend.js` is the core: `window.__foamDevtools.register(name, fn)` and
`call(name, ...args)`. **Contract:** `call` always returns a JSON string —
`guard()` serialises the result and turns any throw into `{"error": msg}`.
Feature files register methods; the core never changes per feature.

**Transport** (`common.js`, loaded by every extension page). `foamEval(expr)`
wraps `chrome.devtools.inspectedWindow.eval` and parses the JSON string.
**Contract:** never rejects — exceptions, non-string results and bad JSON all
resolve to `{error}`. `rpc(name, argExprs)` builds the one eval string
(`window.__foamDevtools.call(...)` with a no-backend fallback); views never
hand-write an eval string. `argExprs` are page-side JS fragments: `'$0'` for
the Elements selection, `JSON.stringify(v)` for data.

**Panel side** (`devtools.js`, `sidebar.*`). `render(result)` builds DOM from
the response object alone — no page references, no state. **Contract:** a
view is a function of the last response.

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
node tools/devtools/test/shapers-test.js   # shapers-test: 12 passed
node tools/devtools/test/backend-test.js   # backend-test: 4 passed
node tools/devtools/test/common-test.js    # common-test: 2 passed
```

### Smoke checklist (manual, ~3 minutes, after every load/reload of the extension)

1. **Bridge proof.** Load unpacked, open a FOAM app, reload the page, open
   DevTools → Elements. The FOAM pane reads "select an element…"; selecting
   `<body>` shows a `view:` line and a `map:` line. On a non-FOAM page the
   pane reads "not a FOAM page". In the page console
   `JSON.parse(__foamDevtools.call('ping')).foam` is `true`.
2. **Owner resolution.** Select a deep node (table cell, menu label): a real
   `element:` class, a non-wrapper `view:` class, `map: … ms` under 100 ms.
3. **Across the app.** A menu item, a table cell and a form field each show a
   sensible view class; a form field inside a detail view shows `data:` with
   the record's class and a `mode:` matching the screen.
