# Live Reload

Save a `.js` file while the app is open in the browser and the page picks the edit up without a reload. A `css:` edit restyles what is on screen. A code edit rebuilds that class's on-screen instances in place. Scroll position, the open menu and property-bound edits stay.

Source runs only. A jar build never loads it.

For the basics of how a class is defined and rendered, start with [U3.md](U3.md) and [Build.md](Build.md). This guide covers what live reload gives you, what it cannot do, and what it costs.

---

## Turn it on

```bash
./build.sh -l                # build, run, and watch the .js files under the project root
./build.sh -l -W9090         # same, on another port; combines with every other flag
```

`-l` adds the `live` deployment journal (`tools/JavaTooling.js:48`). That journal registers two services (`deployment/live/services.jrl`):

- `sourceChangeDAO`, an in-memory DAO served to the browser with remote listener support;
- `sourceWatcher`, the server-side poller that writes into it.

Without `-l` neither exists, and the browser side stays off: `ApplicationController.onClientLoad` creates the reloader only when the page is not running `foam-bin` and the client has `sourceChangeDAO` (`src/foam/core/controller/ApplicationController.js:479`).

## What you see

One console line per saved file:

```
[reload] /src/app/ui/Card.js: 0 class(es) redefined, 1 stylesheet(s) swapped, 0 view(s) rebuilt
[reload] /src/app/ui/Card.js: 1 class(es) redefined, 0 stylesheet(s) swapped, 9 view(s) rebuilt
[reload] /src/foam/lang/Slot.js: 1 class(es) redefined, 0 stylesheet(s) swapped, 0 view(s) rebuilt. Reload the page: foam.lang.Slot is a boot class
```

| Count | Meaning |
|---|---|
| `class(es) redefined` | Classes re-run and re-registered, including every subclass of an edited class. A css-only edit is not counted here: its old class object stays registered and only its style text changes. |
| `stylesheet(s) swapped` | Classes whose file changed in `css:` and nothing else. The installed `<style>` block is rewritten in place. |
| `view(s) rebuilt` | On-screen instances of the redefined classes that were replaced by a fresh instance. |
| `Reload the page: ...` | The edit reached the page only partly. Each hint names why. |

`0 view(s) rebuilt` with no hint means no instance of that class is on screen, in the main page or in an open popup.

A save that reports `no loaded class came from this file` means the browser never loaded that file, so there is nothing to swap.

## What a rebuild keeps and what it drops

A rebuilt instance is a fresh `create()` of the new class, with the old instance's property values linked in by slot, then swapped into the parent with `Element.replaceChild` (`ViewReloader.replace`).

Kept:

- every property the old instance set, or whose factory already ran, linked two-way so a `data$` binding still reaches the original object;
- CSS classes and inline styles the parent put on the node, such as a grid column a dashboard assigns per widget;
- HTML attributes other than `class`, `style` and `id`.

Dropped:

- DOM focus, scroll position inside the element, and text typed into an `<input>` that is not bound to a property;
- listeners another view attached with `.on(...)` from outside the class's own `render()`;
- an `id` set with `setID()`;
- a CSS class the edit removed from `render()`, until the next page reload.

The old instance is kept alive off-screen as the relay between the new one and its data. Each save of the same file adds one more relay. Reload the page when a long session gets slow.

## When a page reload is still needed

The console hint names each case:

| Hint | Why |
|---|---|
| `the file defines a foam.SCRIPT` | A `foam.SCRIPT` runs once at load. Re-running the file runs it again, and the reloader has no way to undo the first run. |
| `<id> is a boot class` | `foam.lang.*` classes are what every other class is built from. Redefining one leaves the rest built on the old one. |
| `N instance(s) render through a SlotNode` | `this.add(someSlot)` and `this.add(this.slot(...))` render their value outside the parent's `childNodes` (`src/foam/u2/Element2.js:1361`), so the instance has no slot to be swapped into. It is counted and left as is. A `dynamic()` block is a `FunctionNode` whose children are ordinary `childNodes`, so views inside it are rebuilt normally. |
| `<id> stylesheet count changed` | Adding the first `css:` block, or removing the last one, leaves nothing to rewrite in place. |

Cases without a hint:

- **CSS token values.** A token expands to its literal value when a stylesheet is installed (`foam.CSS.replaceTokens`). Editing the token's own definition rewrites nothing that already inlined the old value.
- **A file that throws while loading.** A syntax error, or a runtime throw inside `foam.CLASS`, restores the old classes and logs `failed, old classes restored`. Fix the file and save again; if the page is left in a mixed state, reload it.

## How it works

```
SourceWatcher (server)          sourceChangeDAO          ViewReloader (browser)
stat every known .js / 500ms -> put SourceChange{id} -> WebSocket put
walk the tree / 30s                                  -> <script src=path?t=...>
                                                     -> css-only: rewrite <style>
                                                     -> else: cascade subclasses,
                                                        refinements, rebuild views
```

- `foam.core.fs.SourceWatcher` is a `foam.core.fs.PollingWatcher`: a stat of the known files every `pollInterval` (500 ms) and a full tree walk every `rescanInterval` (30 s) to pick up new and deleted files (`src/foam/core/fs/PollingWatcher.js`). It watches `core.webroot`, which the build sets to the project root for source runs (`tools/JavaTooling.js:28,486`). It skips `build` and `node_modules` (`src/foam/core/fs/SourceWatcher.js:30`), and the walk never enters a directory whose name starts with a dot (`PollingWatcher.scan`).
- The `SourceChange.id` is the webroot-relative path with a leading slash. That is also the URL the browser loaded the file from, so the reloader matches it against `Model.source` with no lookup table (`src/foam/core/fs/SourceChange.js:11-15`). Every put reaches every listener, so a second save of the same file needs no timestamp to be seen.
- `foam.u2.ViewReloader.reload_` clears the file's classes from the context cache and re-runs the file as a `<script>` tag. A css-only edit moves the new css text onto the old class's axioms and lets `CSS.reloadStyles` rewrite the installed blocks. Any other edit rebuilds every `foam.USED` subclass parents-first, re-applies refinements from other files, and replaces on-screen instances (`src/foam/u2/ViewReloader.js`). Two rapid saves run one after the other through a promise chain, never at once.
- Instances are looked for under every Element loaded as a root of its own: the application controller, and any `Popup` or `ModalOverlay` open beside it on `document.body`. The reloader creates `document.u2Roots` when it starts; from then on `Element.load()` adds a parentless Element to it and `detach()` removes it (`src/foam/u2/Element2.js`). A build without the reloader never creates the set, so it holds nothing in production.

A stat poll instead of `java.nio.WatchService` because on macOS `WatchService` polls every registered directory. On a tree of 3,522 directories and 5,725 `.js` files the two measured against an idle server:

| 60 s window | Share of one core |
|---|---|
| `WatchService` on every directory | 14.2% |
| Stat of the known files every 500 ms | 4.1% |
| Server idle, `-l` off / on | 0.7% / 5.4% |

`SourceWatcherBenchmark` times one poll tick over the current tree; one tick's share of a core at the default interval is `(1000 / ops) / 500`.

## Tune the watcher

The poller's knobs are properties on `SourceWatcher`, so an app overrides them by redefining the `sourceWatcher` CSpec in a journal that loads after `live`:

```
p({
  "class":"foam.core.boot.CSpec",
  "name":"sourceWatcher",
  "lazy":false,
  "service": {
    "class": "foam.core.fs.SourceWatcher",
    "skipDirs": [ "build", "node_modules", "docs" ],
    "pollInterval": 1000,
    "rescanInterval": 60000
  }
})
```

A large checkout with extra top-level directories that hold `.js` files is the usual reason: every file the walk finds is stat'ed on every tick, and every one that changes is pushed to every open tab. Dot-directories are skipped without being listed.

## Tests

```bash
./build.sh server-tests:WatcherTest              # poll loop, rescan, skipDirs, WatchService path
./build.sh server-tests:SourceWatcherTest        # a changed .js becomes a SourceChange; off without core.webroot
./build.sh client-tests:ViewReloaderTest         # path lookup, css-only detection, cascade, in-place rebuild, popup roots
./build.sh javaBenchmarks:SourceWatcherBenchmark # ticks per second over the current tree
```
