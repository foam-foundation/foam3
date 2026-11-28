# tools — build tooling

Guides: `doc/guides/Build.md`, `doc/guides/POM.md`, `doc/guides/Testing.md`. The language server lives in FOAM-LSP (`doc/guides/LSP.md`), with its own notes in that repo's `CLAUDE.md`.

## Traps

- **`dev&web` hides a class from its own client test.** The build's default flags have no `dev` (`src/foam_node.js:9-21`), and a test run only adds `test` (`JavaTooling.js:631`). Flag a dev-only class that has a client test `dev&web|web&test`. See `doc/guides/POM.md`.
- **Folders whose names end in `test` or `tests` are skipped** unless the build has the `test` flag (`pmake.js:94-95`).
- **Every `.jrl` under a POM directory ships**, as a journal named after the file; two kinds wait for the `test` flag: any file whose name ends in `tests.jrl`, and a file listed in the POM's `journalFiles` with a `test` flag (`JournalMaker.js:141-165`, the two checks at `:151-160`). Keep one-off migration scripts out of the repository.
- **A markdown file becomes a Flow document only with a `<flow ...>` tag** (`JournalMaker.js:170-189`). A new guide in `doc/guides/` needs one; a `CLAUDE.md` without one is ignored by the build.
- **`--hot-swap` / `--swap` need `-T+HotSwap` and are for local `start-core` runs only.** Without `-T+HotSwap` the flags are unknown and JavaTooling must never name `HOT_SWAP` or `SWAP`. The swap flag and the debug agent go on the server's command line (`HotSwapTooling.js` fills JavaTooling's `SERVER_JVM_ARGS`), never into `JAVA_TOOL_OPTIONS`: child JVMs and non-JetBrains JVMs would stop on them. `--swap` makes `JavacMaker` compile into `build/classes-swap` and move changed classes in; the list is `build/swap-manifest`, kept until a swap exits 0; `swap-live` and `swap-stale` mark a server and a plain build after it. Tests: `node foam3/tools/tests/testHotSwap.js` (HOTSWAP_SMOKE=off skips the live JVM part), `testJavacSwap.js`. See `doc/guides/Build.md`.
- **`node tools/pmake.js ...` does nothing.** The file only exports a function (`pmake.js:158`); `tools/build.js` calls it as `pmake.bind(Object.assign({}, EXPORTS), '<args>')()` (`build.js:791`). Run builds through `build.sh`.
