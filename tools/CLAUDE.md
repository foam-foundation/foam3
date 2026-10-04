# tools — build tooling

Guides: `doc/guides/Build.md`, `doc/guides/POM.md`, `doc/guides/Testing.md`. The language server has its own notes in `tools/lsp/CLAUDE.md`.

## Traps

- **`dev&web` hides a class from its own client test.** The build's default flags have no `dev` (`src/foam_node.js:9-21`), and a test run only adds `test` (`JavaTooling.js:631`). Flag a dev-only class that has a client test `dev&web|web&test`. See `doc/guides/POM.md`.
- **Folders whose names end in `test` or `tests` are skipped** unless the build has the `test` flag (`pmake.js:94-95`).
- **Every `.jrl` under a POM directory ships**, as a journal named after the file; two kinds wait for the `test` flag: any file whose name ends in `tests.jrl`, and a file listed in the POM's `journalFiles` with a `test` flag (`JournalMaker.js:141-165`, the two checks at `:151-160`). Keep one-off migration scripts out of the repository.
- **A markdown file becomes a Flow document only with a `<flow ...>` tag** (`JournalMaker.js:170-189`). A new guide in `doc/guides/` needs one; a `CLAUDE.md` without one is ignored by the build.
- **`node tools/pmake.js ...` does nothing.** The file only exports a function (`pmake.js:158`); `tools/build.js` calls it as `pmake.bind(Object.assign({}, EXPORTS), '<args>')()` (`build.js:791`). Run builds through `build.sh`.
