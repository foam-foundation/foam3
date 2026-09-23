<flow name="Compaction" category="DOC/GUIDE" spid="foam" description="Covers FOAM journal compaction: the five-step process that rewrites delta entries into one entry per object." keywords="compaction,journal,replay,rollback,knowledge"/>

# Journal Compaction

## Table of Contents
1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [Default Behavior](#default-behavior)
4. [Configuration](#configuration)
5. [Invoking Compaction](#invoking-compaction)
6. [Running Programmatically](#running-programmatically)
7. [Deciding what survives](#deciding-what-survives)
8. [Rollback](#rollback)
9. [Monitoring](#monitoring)
10. [Gotchas](#gotchas)
11. [Key Files](#key-files)

---

## Overview

Each DAO operation on the same object generates a journal entry containing just the changed fields. Over time a single object may have hundreds of entries, slowing **replay** since replay time is proportional to journal line count. **Compaction** writes each object to a new journal file in its entirety, reducing many entries to one and dramatically improving replay time.

Used in conjunction with custom compaction sinks, the compaction process can also facilitate **archiving** by only writing recent or active objects to the new journal.

---

## How It Works

Compaction follows a five-step process:

```
+--------------------------------------------------------------------+
|             CompactionCmd -> JDAO.cmd_ -> Compactor                 |
|                                                                    |
|  1. ROLL          foo renamed to the next generation, foo.N        |
|       |           A fresh foo takes live traffic immediately       |
|       |                                                            |
|  2. SNAPSHOT      Read all objects from MDAO (a functional         |
|       |           snapshot -- later writes cannot disturb it)      |
|       |           Write full copies through the sink chain to      |
|       |           foo.N.snap.gz.tmp, beside live traffic           |
|       |                                                            |
|  3. COMMIT        Close (writes the gzip trailer), then rename     |
|       |           into place. This is the only commit point.       |
|       |                                                            |
|  4. CLEAN UP      Delete generations <= N, now superseded          |
|       |                                                            |
|  5. COMPLETE      Log statistics, record EventRecord               |
+--------------------------------------------------------------------+
```

**Nothing is blocked at any step.** Reads and writes continue throughout. See
[JournalFiles.md](JournalFiles.md) for the naming, the ordering guarantee and
the crash windows.

**Journal files after compaction:**
```
Before:                     After first compaction:
  users (large, many        users (new traffic only)
   delta entries)            users.1.snap.gz (compacted state)
```

The roll step is an **atomic rename**, run as a job on the journal's own assembly line so that it is ordered against every put and remove without blocking them. A rename moves no data, so the cutover costs the same at any journal size. (It used to be a copy + truncate, because a rename leaves an open writer pointing at the renamed file; the line lets the writer be closed first and reopened after.)

**Key point:** live traffic never stops. It writes to the fresh `users` from the instant of the rename, while the snapshot is built separately.

---

## .0 Awareness

Compaction is aware of `.0` (deployment) journals. During step 4, objects that are **identical to their `.0` version** are skipped -- they don't need to be in the runtime journal since `.0` is replayed on every startup.

This significantly reduces the compacted journal size when most data comes from deployment:

```
Before compaction:
  users.0 (22,000 objects from deployment)
  users   (50,000 delta entries for 926 modified objects)

After compaction:
  users.0 (22,000 objects, unchanged)
  users.1.snap.gz (926 entries -- only modified/new objects)
  users   (new traffic only)
```

### How it works

1. Replay `.0` into a temporary in-memory MDAO
2. For each object in the main MDAO, compare against the `.0` version
3. **Identical** -- skip (`.0` provides it on startup)
4. **Modified or new** -- write to the compacted journal
5. **Deleted at runtime** (exists in `.0` but not in MDAO) -- write a `remove` entry to prevent resurrection on next startup

### No configuration needed

This optimization is automatic when a `.0` file exists. It works with both filesystem and JAR-embedded `.0` files. If no `.0` file is found, compaction proceeds normally (all objects written).

---

## Default Behavior

| Setting | Default | Meaning |
|---------|---------|---------|
| `compactible` | `true` | All DAOs are compacted by default |
| `discardLifecycleDeleted` | `true` | Objects marked DELETED are not written to the new journal |

If no `Compaction` record exists for a DAO, default settings are used: the DAO is compacted with lifecycle-deleted objects discarded.

---

## Setup

Compaction requires the `deployment/compaction` journals to be included in your build. Add them to the `-J` flag:

```
./build.sh -J../foam3/deployment/compaction,...
```

The compaction deployment provides:

| File | Purpose |
|------|---------|
| `services.jrl` | Registers the `compactionDAO` service for storing per-DAO configuration |
| `compactions.jrl` | Per-DAO compaction configuration entries |
| `scripts.jrl` | The `DAOCompaction` BeanShell script |
| `scriptparameters.jrl` | Script parameter with the `daos` list |

Without these journals, the compaction script and `compactionDAO` service will not be available.

---

## Configuration

Compaction is configured per-DAO in `deployment/compaction/compactions.jrl`.

### Enable compaction (default)

A DAO is compactible by default. To explicitly configure it:

```
p({
  class: "foam.dao.compaction.Compaction",
  cSpec: "userDAO"
})
```

### Disable compaction for a DAO

Set `compactible: false`. The journal is still rolled, but **no data is written** to the new journal from the old data. Only new live traffic after the roll goes to the new journal.

```
p({
  class: "foam.dao.compaction.Compaction",
  cSpec: "alarmDAO",
  compactible: false
})
```

### Compaction Model Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `cSpec` | Reference | (required) | CSpec ID of the DAO to configure |
| `compactible` | Boolean | `true` | If true, objects are compacted to new journal. If false, entries are discarded |
| `discardLifecycleDeleted` | Boolean | `true` | Discard objects with lifecycleState=DELETED |
| `journalName` | String | auto | Journal filename. Defaults to CSpec name with "DAO" removed + "s" |

---

## Invoking Compaction

Compaction is a **command sent through the DAO stack**, so it reaches whichever JDAOs are underneath: one for an ordinary DAO, one per partition for a partitioned one. Each appends its own report to the command.

Compaction is controlled by the `DAOCompaction` Script and its `ScriptParameter`.

1. Configure which DAOs to compact in the `DAOCompaction` ScriptParameter:
   - Set `parameters.daos` to a comma-separated list of DAO service names
   - Enable the parameter

2. Run the `DAOCompaction` script from the Scripts admin menu

3. After completion, check:
   - **ScriptEvents** for an 'OK' message
   - **EventRecords** for a compaction summary with statistics

### Considerations

- Compaction no longer needs a maintenance window: nothing is blocked, and it can run as slowly as it likes beside live traffic
- A held MDAO snapshot retains every row version superseded while it runs, so memory grows with write churn during compaction -- pace long runs by write volume, not wall clock
- If the DAO stack contains a `FixedSizedDAO`, only retained records are compacted

---

## Running Programmatically

### Full compaction (roll + rewrite)

```java
import foam.dao.compaction.CompactionCmd;

CompactionCmd cmd = new CompactionCmd();
cmd.setServiceName("myDAO");
((DAO) x.get("myDAO")).cmd(cmd);
print(cmd.getReport());
```

### Roll only (no compaction)

If you only need to back up the current journal and start a fresh one:

From a BeanShell script, where `x` is already in scope, this is a one-liner:

```java
x.get("somethingDAO").cmd(new foam.dao.FileRollCmd());
```

Or, keeping the result to read the archive name back:

```java
import foam.dao.FileRollCmd;

DAO dao = (DAO) x.get("myDAO");
FileRollCmd cmd = new FileRollCmd();
cmd = (FileRollCmd) dao.cmd_(x, cmd);
// cmd.getRolledFilename() = "mymodel.1"
```

**Warning:** Roll-only does NOT compact. The frozen generation retains all delta entries, and is replayed on every startup. The new journal only contains writes after the roll.

Roll-only is safe on a live system: the cutover is ordered against journal writes by the assembly line. See [JournalFiles.md](JournalFiles.md#rolling-manually).

---

## Deciding what survives

Compaction writes whatever the MDAO currently holds. **Deciding what should be
in it is a separate concern** -- run it on its own schedule and compaction will
reflect it the next time it runs.

| policy | how |
|---|---|
| date TTL | drop the partition's directory (see [JournalFiles.md](JournalFiles.md)) |
| age, status, anything else | a CRON calling `removeAll()` with the predicate you want |
| lifecycle-deleted tombstones | `discardLifecycleDeleted` (below) |

Compaction used to take a `predicate`, `createdSince` or `lastModifiedSince` and
drop non-matching objects as it rewrote. Those are gone, along with the
per-model `{ModelId}CompactionSink` faceted lookup. Two reasons:

1. **A filtered row stayed live until compaction ran.** It was in the MDAO,
   queries returned it, listeners had seen it -- and then one day compaction
   silently dropped it. A `removeAll()` deletes when the policy says to, writes
   `r()` entries, fires events, and is visible to readers immediately.
2. **It duplicated the DAO.** Predicate matching is what `removeAll_` already
   does; the filters carried a second copy plus config plumbing.

The cost of a `removeAll()` is one journal entry per removed row, and those land
in a generation the next compaction supersedes and deletes -- transient disk,
not permanent.

**`discardLifecycleDeleted` stays**, because it is not substitutable: for a
`LifecycleAware` object, `LifecycleAwareDAO.remove_` converts a remove into a
`setLifecycleState(DELETED)` **put** (`LifecycleAwareDAO.js:144-147`). A CRON
`removeAll` against the served DAO therefore re-marks tombstones rather than
purging them; doing it properly means aiming below that decorator.

---

## Rollback

**There is no rollback procedure, because a failed compaction is not a state to recover from.** The snapshot only becomes visible at the rename; until then the frozen generations are still the record, and live traffic has been landing in the current journal the whole time. A failure leaves a `.tmp` that the next boot ignores and anything may delete.

If compaction throws, check the EventRecord for the cause and run it again. Nothing is lost and nothing needs restoring.

### Reverting a completed compaction

A committed snapshot supersedes the generations it covers, and cleanup deletes them, so there is nothing to revert to afterwards. To keep that option, take a copy of the generation files before running compaction -- they are ordinary files and can be restored by putting them back and deleting the snapshot.

---

## Monitoring

### EventRecords

Each compaction run creates EventRecords tracking progress:
- **Start**: Records compaction initiation
- **Complete**: Includes a CSV summary report

### Report Format

The human-readable report printed by the DAOCompaction script:

```
Compaction Report
  Instance:          localhost
  Date:              Mon Feb 13 16:07:51 GMT 2026
  Duration:          5s
  Objects processed:  22926
  Objects compacted:  926
  Objects filtered:   0.00%
  Journal entries:    160000 -> 926 (99.42% reduction)
  Journal size:       48.0 MB -> 1.2 MB (97.50% reduction)
  Skipped (.0):       22000 (unchanged from .0)
  Removed (.0):       3 (deleted at runtime)
```

| Field | Description |
|-------|-------------|
| processed | Total objects read from MDAO |
| compacted | Objects written to new journal |
| filtered | Percentage of objects removed by sink filters |
| journal entries | Line count before vs after compaction |
| journal size | File size before vs after compaction |
| skipped (.0) | Objects identical to `.0` version (not written) |
| removed (.0) | `.0` objects deleted at runtime (remove entries written) |

### Progress Logging

During compaction, progress is logged every 5 seconds:
```
[INFO] Compactor compaction progress processed=25000 50%
```

---

## Gotchas

1. **Roll-only does NOT compact** -- `FileRollCmd` only freezes the journal as a generation. Send a `CompactionCmd` for full compaction.

2. **Compaction is async** -- The snapshot runs on the thread pool. `execute()` polls for completion every 5 seconds.

3. **Live traffic during compaction** -- Writes go to the fresh journal from the moment of the cutover and are never at risk; the snapshot is a separate file that only becomes visible once complete.

4. **MDAO is the source** -- Compaction reads from MDAO, not the journal file. The in-memory state is what gets written.

5. **FixedSizedDAO interaction** -- If the DAO stack includes a FixedSizedDAO, only objects retained by it are compacted.

6. **eventRecordDAO required** -- `execute()` writes to `eventRecordDAO`. Must be available in context.

---

## Key Files

| File | Purpose |
|------|---------|
| `foam/dao/compaction/Compaction.js` | Configuration model |
| `foam/dao/compaction/CompactionCmd.js` | Command sent through the DAO stack; config in, report out |
| `foam/dao/compaction/Compactor.js` | Roll + snapshot for one JDAO's journal |
| `foam/dao/compaction/LifecycleDeletedCompactionSink.js` | Discard lifecycle-deleted tombstones |
| `foam/dao/FileRollCmd.js` | Command to trigger journal roll |
| `foam/dao/AbstractF3FileJournal.js` | Journal roll implementation |
| `foam/dao/JournalGenerations.java` | Derives the generation set from the filesystem |
| `doc/guides/JournalFiles.md` | Journal naming, numbering and rolling scheme |
| `deployment/compaction/services.jrl` | compactionDAO service definition |
| `deployment/compaction/compactions.jrl` | Per-DAO compaction configuration |
| `deployment/compaction/scripts.jrl` | DAOCompaction script |
| `deployment/compaction/scriptparameters.jrl` | Script parameters |
