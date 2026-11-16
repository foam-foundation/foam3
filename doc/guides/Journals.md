<flow name="Journals" category="DOC/GUIDE" spid="foam" description="Explains FOAM journals: append-only .jrl files, p/c/r/v operations, JSON delta compression, replay, and compaction." keywords="journal,jrl,replay,compaction,persistence,knowledge"/>

# FOAM Journals 

## What are FOAM Journals?

FOAM journals are append-only log files that record all data changes (creates, updates, deletes) to provide durable persistence and enable data recovery. They implement the `Journal` interface which defines three core operations: `put()` for recording object creation and updates, `remove()` for recording deletions, and `replay()` for reconstructing state from the journal.

## How Journals Work

Journals use a simple text-based format with three core operation types:

- **`c({...})`** - Records a create operation
- **`p({...})`** - Records an update operation
- **`r({...})`** - Records a remove (delete) operation
- **`// comment`** - Adds audit trail metadata (when the model does not implement LastModifiedByAware, or its lastModifiedBy is unset)
- **`v({...})`** - Records the application version for subsequent `put()` operations.

The journal stores objects as JSON with delta compression - only changed properties are written rather than the entire object, significantly reducing file size.

## How They're Used

### 1. **Data Persistence**
Journals provide durable storage by writing all DAO operations to disk. When the application starts, it replays the journal to reconstruct the in-memory state.

### 2. **Build System Integration**
The build system includes a `JournalMaker` that concatenates `.jrl` journal files from various locations during builds. You can specify additional journal directories using the `-J` flag: `./build.sh -Jdemo,test`.

### 3. **Deployment Structure**
Journals are organized in a standard directory structure:
- **Source journals**: `src/*/` - Contains feature specific configuration and default data. 
- **Application journals**: `journals/` - Contains configuration and initial data common to all application deployments.  Supercedes Source journals.
- **Deployment journals**: `deployment/*/` - Contains configuration and initial data specific to a deployment scenario.  Supercedes Application journals.
- **Build journals**: `build/journals/` - Concatenated journals from build process
- **Runtime journals**: `${APP_HOME}/journals/` - Active journals written during application runtime

### 4. **Compaction**
Over time, journals accumulate multiple entries for the same object. The [Compaction](./Compaction.md) system reduces replay time by writing out each object once in its entirety, eliminating redundant delta entries.

## Notes

Journals are typically used with `JDAO` (Journaled DAO) which wraps another DAO and automatically journals all operations. The `-j` build flag deletes runtime journals. Journal files can be manually edited to seed initial data or fix issues, as they're just text files with a simple format.

## Journal Concatenation

The build concatenates same named journal files with extension `.jrl`, into a single journal file with the same name and extension `.0`.  **replay** processes the `.0` files during application startup, before processing the runtime journals.

For example, building with `-Jhttps` will process the following `services.jrl` files, concatenating them into `build/journals/services.0`, in the following order:

1. src/foam/core/jetty/services.jrl
2. src/services.jrl
3. deployment/https/services.jrl

## Replay traps when changing journaled data

**`c()` merges like `p()`.** On replay, a create entry for an id that already exists is merged onto the existing object, exactly as a `p()` is (`src/foam/dao/F3FileJournal.js:192-197`). A later journal's `c()` with fewer fields no longer wipes the fields an earlier journal set.

**The file name is the journal name.** `JournalMaker` turns every `.jrl` under a POM-controlled directory into a build journal named after the file (`tools/JournalMaker.js:150-152`); there is no opt-in list. Two kinds wait for the `test` flag: any file whose name ends in `tests.jrl` (`:168-169`), and a file listed in the POM's `journalFiles` with a `test` flag (`:160-166`). A DAO opens exactly the journal it names, for example `.setJournalName("scripts")` (`src/foam/core/script/services.jrl:15`). So a file called `backfill-scripts.jrl` ships to every environment and builds a `backfill-scripts` journal that no DAO ever opens: its rows never load. A one-off migration script belongs outside the repository, run once through the Scripts admin screen.

**A seed row cannot undo a runtime row.** Replay reads the build journal (`<name>.0`) first, then frozen generations, then the runtime journal (`src/foam/dao/java/JDAO.js:157-201`). A later runtime `p()` for the same id wins over anything in the seed, including an `r()`. The exception is a DAO running with [NDiff](NDiff.md), which is off unless the DAO sets `ndiff: true` or the JVM has `-DUseNdiff` (`src/foam/dao/EasyDAO.js:658-664`). Rows the application writes back on its own are the usual case: the cron scheduler puts each cron row back every time it schedules or times it out (`src/foam/core/cron/CronScheduler.js:182`, `:207`). Renaming or deleting a seeded row that the app rewrites therefore needs a manual delete in the running app after deployment.

**Changing a property's class does not convert stored values.** Rows written before the change keep their old shape. For example, a property changed from `Map` to `FObjectArray` still holds `{"key":true}` objects in older rows, and code that expects an array fails on them; `FileArrayDAODecorator` now names the property and value when this happens (`src/foam/core/fs/FileArrayDAODecorator.js:116-129`). Removing and renaming a property are covered in [claude.md](claude.md) section 22; both rest on the Java parser skipping a key it does not know (`src/foam/lib/json/ModelParserFactory.java:236-239`).

## Feature Flags and Conditional Complilation

The [Build](./Build.md) determines source and journals to process based on the POMs it has been instructed to process. By default this is the project root `pom.js` file. Additional POMs can be specified with `-P` and `-J`.  The build reads these POMs and then traverses child POMs listed in `projects`.  The build only processes diretories which contain a POM file or child directories without a POM of a parent with a POM.

Using this behaviour, feature inclusion can be conditionally controlled.

[Compaction](./Compaction.md) is a working example.

Compaction's Java source under `src/foam/dao/compaction/` has its own POM, and FOAM's root `pom.js` lists it in `projects`, so the code is built by default. Its configuration is not: the `compactionDAO` service, the `DAOCompaction` script and its parameters live in `deployment/compaction/`, which is only read when that deployment is requested.

If we build with `-Jcompaction` then the journal configuration under `deployment/compaction/` is included as well.

### Source

- `src/foam/dao/Journal.js` - the `Journal` interface: `put`, `remove`, `replay`, `cmd`
- `src/foam/dao/AbstractF3FileJournal.js` - the `c`/`p`/`r`/`v` operation characters, delta output and the audit comment
- `src/foam/dao/F3FileJournal.js` - `replay`, including the `c`-as-`p` merge
- `src/foam/dao/java/JDAO.js` - assembles the replay order: `<name>.0`, frozen generations, then the runtime journal
- `tools/JournalMaker.js` - concatenates `.jrl` files into `build/journals/<name>.0`
- `tools/JavaTooling.js` - `JOURNAL_HOME`, `JOURNAL_OUT` and the `-J` (`journals`) option
- `src/foam/dao/compaction/Compaction.js` - per-DAO compaction configuration
