# foam.dao

Read `doc/guides/DaoGotchas.md` before debugging a DAO; journals are in `doc/guides/Journals.md` and `doc/guides/JournalFiles.md`. Framework reference: `doc/guides/claude.md` section 8.

## Traps

Paths that do not start with `src/`, `doc/` or `tools/` are relative to this folder.

- **Add an index with `addPropertyIndex(...)` (`EasyDAO.js:1438-1466`), never `addIndex` on `getMdao()`.** Only an `AddIndexCommand` sent through `cmd_` is recorded and rebuilt after an unloadable DAO reloads (`EasyDAO.js:230-245`, `src/foam/core/partition/NotPartitionedDAO.java:149-150`).
- **Only `Eq`, `Gt`, `Gte`, `Lt`, `Lte` and `In` use an index** (`index/TreeIndex.java:145-210`); `NOT`, `INSTANCE_OF`, `CONTAINS` and `Neq` are checked row by row. A top-level `OR` is planned per arm, so each indexed arm still uses its index (`MDAO.java:268-277`).
- **A predicate on a DAO shared by several subclasses silently skips rows it cannot cast.** `PredicatedSink` and the MDAO's `ValuePlan` swallow the `ClassCastException` (`PredicatedSink.js:27-32`, `index/ValuePlan.java:25-29`); put `INSTANCE_OF(Sub.class)` first. See `doc/guides/DaoGotchas.md`.
- **A `.jrl` file's name is its journal's name.** A file no DAO names ships and never loads (`tools/JournalMaker.js:141-143`). See `doc/guides/Journals.md`.
- **A seed `r()` cannot remove a row the runtime journal re-puts**, because the runtime journal replays last (`java/JDAO.js:154-201`). See `doc/guides/Journals.md`.
- **Changing a property's class leaves stored rows in the old shape.** See `doc/guides/Journals.md`.
- **BeanShell cannot call MLang varargs.** In a journal script `AND(eq, gte)` fails with `Static method AND( ... ) not found`; pass an array, `AND(new Predicate[] { eq, gte })`, as `src/foam/core/auth/scripts.jrl:22` does. Java code is fine.
- **Every served DAO has an admin browser.** A CSpec whose id ends in `DAO` and has `serve: true` is listed at `#admin.data/<id>` (`src/foam/core/boot/DAOCSpecMenu.js:33-45`); no menu entry is needed.
- **One money column in an export makes every `javaGetter`-only column export its JavaScript default** (empty, `0` or `false`), not the server's value (`src/foam/core/export/TableExportDriver.js:66`). See `doc/guides/CurrencyAndUnits.md`.
