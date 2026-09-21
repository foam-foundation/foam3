---
name: foam-screenshot-builder
description: Use when a FOAM UI change needs before/after screenshots cropped to what changed, with numbered callouts — for a PR, a ticket, or comparing two branches or theme variants. Also for numbered how-to strips, Chrome DevTools Recorder JSON in either direction, and "walk these menus and screenshot each" against a running FOAM app.
---

# foam-screenshot-builder

Two servers (base commit, branch), one `rows.json` naming the screen, the element to crop, the mode and the things to point at. Playwright takes the crops, `compose.mjs` renders before | after with callouts. No image library, no manual cropping.

## When to use

- PR description for anything that changes pixels (tokens, CSS, icons, dark mode, layout).
- "dark v1 vs dark v2", "development vs my branch", "EN vs FR" on the same crop.
- Re-shoot after a rebase: same rows, rerun.

Not for: pixel-diff CI gates (Playwright `toHaveScreenshot`), native popups (select lists, scrollbars, date pickers — not in the page bitmap), screens that need seeded data the demo lacks.

## Setup (once per machine)

```bash
cd <skill dir>/scripts && npm i          # pulls playwright, then ~100 MB of Chromium
```

One worktree per side, one server each with its OWN app name — the value attached to the flag:

```bash
BASE=$(git merge-base origin/development <branch>)
git worktree add .claude/worktrees/shots-before "$BASE"
git worktree add .claude/worktrees/shots-after  <branch>       # or reuse the branch's worktree
(cd .claude/worktrees/shots-before && env -u NODE_OPTIONS ./build.sh -Nfoam-before -Jdemo -W9092 &)
(cd .claude/worktrees/shots-after  && env -u NODE_OPTIONS ./build.sh -Nfoam-after  -Jdemo -W9091 &)
```

Builds run in the background (several minutes); `curl -s -o /dev/null -w '%{http_code}' localhost:9091/` says 200 when up.

Two builds without distinct `-N` share `/opt/foam-full/journals`; the second build rewrites the first's `menus.0`, `themes.0`, sessions. `-N foam-before` (with a space) fails with `Task not found`.

## Run

```bash
cp rows.example.json rows.json    # edit rows; scripts/rows.json is the default
node shots.mjs                    # crops + .json mark boxes under out/<name>/
node compose.mjs                  # out/<name>/<mode>-compose.png, ready for the PR
node shots.mjs scripts-table      # just one row; every run retakes what it shoots
node shots.mjs ../other/rows.json # another rows file: out/ and profile/ follow it
```

Any working directory works; paths in a rows file resolve against that file's folder. A row that fails leaves the others alone and exits 1.

`shots.mjs` runs headless. It opens a window only when a server has no session in the profile, prints `LOGIN NEEDED`, and waits; the human logs in there. Never type a password for them and never put one in `rows.json`.

Output images go into the PR by drag-drop; `gh` has no upload path for description images.

## rows.json

```json
{ "servers": { "before": "http://localhost:9092/", "after": "http://localhost:9091/" },
  "rows": [
    { "name": "scripts-table", "menu": "admin.scripts", "sel": ".foam-comics-v3-DAOView",
      "modes": ["light", "dark"], "maxH": 560,
      "prep": [{ "click": "text=/create/i", "wait": 2500 }, { "js": "ctrl.notify('Saved','','INFO')" }],
      "marks": [{ "sel": "role=button[name=/export/i]", "note": "icon follows text colour" }] } ] }
```

| key | meaning |
|---|---|
| `menu` | menu id; launched with `menuDAO.find(id).launch(ctx)` — no hash navigation (a reload on a deep hash boots blank) |
| `sel` / `nth` / `pad` / `maxH` | crop = first match's box + padding, height capped |
| `wait` | ms to settle after the menu opens (default 2500) |
| `modes` | `light`/`dark`; sets `theme.activeVariants` and calls `foam.u2.CSS.reloadStyles` by hand (the auto listener only exists with `useVariants`) |
| `prep` | steps after launch: `click`, `dblclick`, `hover`, `check`, `uncheck`, `fill: [sel, text]`, `press: key`, `js`; each takes `wait` ms |
| `marks` | Playwright selectors (`css`, `text=`, `role=`, `>> nth=`) or a list of candidates; numbered in order; `note` feeds the legend |
| `steps` | how-to strip instead of before/after: same step forms as `prep` plus `note`, `sel` |
| `stepSel` | strip fallback crop when a step's view has no `sel` (default: the stack content area) |
| `servers` per row | subset, e.g. `["after"]` for something that did not exist before |
| `layout` | `stack` or `row`; by default wide panels stack |

Top level besides `servers` and `rows`: `out` (default `out/`), `profile` (default `profile/`, the Chromium profile holding the logins), `main` (which server strips and exports use; default the last one listed).

Find selectors before writing rows: `node discover.mjs admin.scripts` lists the biggest FOAM containers on that screen with sizes (`.foam-comics-v3-DAOView 1168x740`, `.foam-u2-table-TableView-tr n=36`). FOAM classes are `<package>-<Class>[-<sub>]`; enum badges are `.enum-label`, buttons answer to `role=button[name=/export/i]`.

Wide panels stack automatically; a wide table that should still sit side by side gets `"layout": "row"`.

## Step strips and Chrome Recorder imports

A row with `steps` instead of `marks` produces a numbered how-to: one panel per step showing the screen *before* the step with its target marked ①②③, then a `result` panel, legend from each step's `note`. Strips shoot the last server only unless `servers` says otherwise. A step may carry its own `sel` when it opens a different view; otherwise the crop falls back to the row's `sel`, then the stack content area.

### Recording → row

Record the flow in Chrome DevTools → Recorder → Export → JSON, then:

```bash
node import-recording.mjs flow.json --strip > row.json   # or without --strip → prep steps
```

The importer keeps every recorded selector alternative as a candidate (`aria/` → `role=`/`text=`, `xpath/` → `xpath=`, `pierce/` → plain css); the player takes the first that matches. Fix up: replace `<crop selector>`, drop `keyDown` noise it already skipped, add `note`s, change typed values that only exist in the recorded environment.

### Row → recording (replay in the human's own Chrome)

```bash
node export-recording.mjs how-to-open-script --server after > flow.json   # Recorder → Import → Replay
```

Emits a flow that waits for login, opens the menu through `menuDAO` (a deep-hash `navigate` can boot blank), waits for each element, then clicks. A step with `"emphasize": true` gets an orange outline for 4 s plus a pause (`"pause": ms`) before it runs — use it to make the viewer look at one control. Replay speed and per-step breakpoints live in the Recorder panel, not the file.

Recorder limits: a regex selector (`role=button[name=/export/i]`) cannot be exported — Recorder matches names exactly, so the export stops and names the step; give that step a css or plain `text=` selector. A step `timeout` must be ≤ 30000; `aria/` and `text/` targets cannot be outlined (the highlight resolves css and xpath); typing replays as one `change`, not keystrokes.

## Common mistakes

| Mistake | Fix |
|---|---|
| Same `-N` for both servers | distinct names; check `/opt/<name>/journals` exists per side |
| Edited source, browser shows old JS | server sends `Cache-Control: immutable`; `shots.mjs` clears cache on open, otherwise Cmd+Shift+R |
| Mark on a checked checkbox / `<select>` to show `color-scheme` | no pixel change in page bitmap; describe in text |
| Mark selector with a comma and `>>` chain | one chain per mark; split into two marks |
| Screenshot of the wrong branch | `git -C <worktree> log -1` before building each side |
| A prep step's popup never appears | click landed but view differs; two tries, then drop the row |
| A prep step's leftovers (open form, toast) bleed into the next row | give the next row its own `menu` launch, or put the cleanup click in its `prep` |

## Files

`scripts/lib.mjs` (browser, login wait, mode, launch, crop + sidecar) · `scripts/shots.mjs` · `scripts/compose.mjs` · `scripts/discover.mjs` · `scripts/import-recording.mjs` · `scripts/export-recording.mjs` · `scripts/rows.example.json` (five worked rows: navbar, table, side nav, toast, create form).
