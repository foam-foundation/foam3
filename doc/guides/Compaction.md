# Journal Compaction

## Table of Contents
1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [Default Behavior](#default-behavior)
4. [Configuration](#configuration)
5. [Invoking Compaction](#invoking-compaction)
6. [Running Programmatically](#running-programmatically)
7. [Filtering and Archiving](#filtering-and-archiving)
8. [Custom Compaction Sinks](#custom-compaction-sinks)
9. [Rollback](#rollback)
10. [Monitoring](#monitoring)
11. [Gotchas](#gotchas)
12. [Key Files](#key-files)

---

## Overview

Each DAO operation on the same object generates a journal entry containing just the changed fields. Over time a single object may have hundreds of entries, slowing **replay** since replay time is proportional to journal line count. **Compaction** writes each object to a new journal file in its entirety, reducing many entries to one and dramatically improving replay time.

Used in conjunction with custom compaction sinks, the compaction process can also facilitate **archiving** by only writing recent or active objects to the new journal.

---

## How It Works

Compaction follows a five-step process:

```
+--------------------------------------------------------------------+
|                    CompactionDAO.execute()                          |
|                                                                    |
|  1. BLOCK         All DAO operations are paused                    |
|       |                                                            |
|  2. ROLL          Journal copied to backup (.1, .2, etc.)          |
|       |           Original truncated (new empty journal)           |
|       |                                                            |
|  3. UNBLOCK       DAO operations resume                            |
|       |           New traffic writes to the new empty journal      |
|       |                                                            |
|  4. COMPACT       Read all objects from MDAO (in-memory)           |
|       |           Write full copies through sink chain             |
|       |           to the new journal (concurrent with traffic)     |
|       |                                                            |
|  5. COMPLETE      Log statistics, record EventRecord               |
+--------------------------------------------------------------------+
```

**Journal files after compaction:**
```
Before:                     After first compaction:
  users (large, many        users (compacted + new traffic)
   delta entries)            users.1 (backup of original)
```

The roll step uses **copy + truncate** (not rename) because on Linux, renaming only updates the inode. The JVM file operations continue against the original inode, so a rename would leave the writer pointing at the backup file.

**Key point:** Live traffic continues during step 4. New writes go to the new journal alongside compacted entries. This is why compaction should run during low-traffic periods.

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
  users   (926 entries -- only modified/new objects)
  users.1 (backup of original runtime journal)
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
| `predicate` | none | No filtering -- all objects are compacted |
| `createdSince` | none | No date filter on creation time |
| `lastModifiedSince` | none | No date filter on modification time |

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
| `predicate` | Predicate | null | Custom filter -- only matching objects are compacted |
| `createdSince` | DateTime | null | Only compact objects created on/after this date |
| `lastModifiedSince` | DateTime | null | Only compact objects modified on/after this date |
| `journalName` | String | auto | Journal filename. Defaults to CSpec name with "DAO" removed + "s" |

---

## Invoking Compaction

Compaction is controlled by the `DAOCompaction` Script and its `ScriptParameter`.

1. Configure which DAOs to compact in the `DAOCompaction` ScriptParameter:
   - Set `parameters.daos` to a comma-separated list of DAO service names
   - Enable the parameter

2. Run the `DAOCompaction` script from the Scripts admin menu

3. After completion, check:
   - **ScriptEvents** for an 'OK' message
   - **EventRecords** for a compaction summary with statistics

### Considerations

- Schedule compaction during a **maintenance window** with low traffic
- Compaction can fail, requiring manual intervention (see Rollback)
- If the DAO stack contains a `FixedSizedDAO`, only retained records are compacted

---

## Running Programmatically

### Full compaction (roll + rewrite)

```java
import foam.dao.compaction.CompactionDAO;

CompactionDAO compactor = new CompactionDAO(x, "myDAO");
compactor.execute(x);
```

### Roll only (no compaction)

If you only need to back up the current journal and start a fresh one:

```java
import foam.dao.FileRollCmd;

DAO dao = (DAO) x.get("myDAO");
FileRollCmd cmd = new FileRollCmd();
cmd = (FileRollCmd) dao.cmd_(x, cmd);
// cmd.getRolledFilename() = "mymodel.1"
```

**Warning:** Roll-only does NOT compact. The backup retains all delta entries. The new journal only contains writes after the roll.

---

## Filtering and Archiving

Compaction sinks allow filtering which objects are written to the new journal. Objects not matching the filter are discarded, effectively archiving them.

### Sink Chain

```
+-------------------+     +----------------------+     +-------------+
| CompactionSink    |---->| Filter Sink(s)       |---->| JournalSink |
| (faceted lookup)  |     | (optional per config)|     | (writes)    |
+-------------------+     +----------------------+     +-------------+
```

### Filter options

**1. By predicate** -- Only objects matching the predicate are kept:

```
p({
  class: "foam.dao.compaction.Compaction",
  cSpec: "approvalRequestDAO",
  compactible: true,
  predicate: {
    class: "foam.mlang.predicate.FScriptPredicate",
    query: 'status == foam.core.approval.ApprovalStatus.REQUESTED'
  }
})
```

**2. By creation date** -- Only objects created after the date are kept:

```
p({
  class: "foam.dao.compaction.Compaction",
  cSpec: "transactionDAO",
  compactible: true,
  createdSince: "2024-01-01T00:00:00.000Z"
})
```

**3. By last modified date** -- Only recently modified objects are kept:

```
p({
  class: "foam.dao.compaction.Compaction",
  cSpec: "logDAO",
  compactible: true,
  lastModifiedSince: "2024-06-01T00:00:00.000Z"
})
```

**Note:** Predicate, createdSince, and lastModifiedSince are mutually exclusive. Only one is used (checked in that order).

---

## Custom Compaction Sinks

For per-model filtering logic, create a faceted sink class. The system auto-discovers classes named `{ModelClassId}CompactionSink` via FacetManager.

```javascript
foam.CLASS({
  package: 'com.example',
  name: 'MyModelCompactionSink',
  extends: 'foam.dao.ProxySink',
  implements: ['foam.lang.ContextAware'],

  methods: [
    {
      name: 'put',
      javaCode: `
      MyModel model = (MyModel) obj;
      if ( model.getStatus() == Status.ACTIVE ) {
        getDelegate().put(obj, sub);  // Keep: forward to journal
      }
      // Discard: don't forward
      `
    }
  ]
});
```

See `deployment/compaction/compactions.jrl` for working examples including `TicketCompactionSink` and `ApprovalRequestCompactionSink`.

---

## Rollback

Should compaction fail, the system should be considered in an **unknown state**. Live traffic must be halted immediately. Operations that occurred during compaction will be lost.

### Rollback Steps

1. **Halt the system** -- Stop all traffic
2. **Restore the journal** -- Discard the new journal file and rename the highest-numbered backup back to the original name:
   ```
   rm journals/users
   mv journals/users.1 journals/users
   ```
3. **Restart the system** -- The restored journal will replay on startup

### Data loss

Any writes that occurred between the roll and the failure are lost. This is why compaction should be scheduled during maintenance windows with minimal traffic.

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
[INFO] CompactionDAO compaction progress processed=25000 50%
```

---

## Gotchas

1. **Roll-only does NOT compact** -- `FileRollCmd` only copies the journal and truncates. Use `CompactionDAO.execute()` for full compaction.

2. **ProxyDAO requirement** -- `CompactionDAO.roll()` casts `x.get(serviceName)` to `ProxyDAO`. The DAO must be wrapped in a ProxyDAO or roll will fail.

3. **Compaction is async** -- The compaction step runs on the thread pool. `execute()` polls for completion every 5 seconds.

4. **Live traffic during compaction** -- After the roll, DAO operations resume. New writes go to the new journal. If compaction fails, these writes are lost on rollback.

5. **MDAO is the source** -- Compaction reads from MDAO, not the journal file. The in-memory state is what gets written.

6. **FixedSizedDAO interaction** -- If the DAO stack includes a FixedSizedDAO, only objects retained by it are compacted.

7. **eventRecordDAO required** -- `execute()` writes to `eventRecordDAO`. Must be available in context.

8. **Filter mutual exclusivity** -- Only one of predicate/createdSince/lastModifiedSince is applied (checked in that order as if/else if).

---

## Key Files

| File | Purpose |
|------|---------|
| `foam/dao/compaction/Compaction.js` | Configuration model |
| `foam/dao/compaction/CompactionDAO.js` | Orchestrator (roll + compact) |
| `foam/dao/compaction/BlockingDAO.js` | Thread synchronization during roll |
| `foam/dao/compaction/CompactionSink.js` | Faceted sink discovery |
| `foam/dao/compaction/LifecycleDeletedCompactionSink.js` | Filter deleted objects |
| `foam/dao/compaction/PredicateCompactionSink.js` | Filter by predicate |
| `foam/dao/compaction/CreatedCompactionSink.js` | Filter by creation date |
| `foam/dao/compaction/LastModifiedCompactionSink.js` | Filter by modification date |
| `foam/dao/FileRollCmd.js` | Command to trigger journal roll |
| `foam/dao/AbstractF3FileJournal.js` | Journal roll implementation |
| `deployment/compaction/services.jrl` | compactionDAO service definition |
| `deployment/compaction/compactions.jrl` | Per-DAO compaction configuration |
| `deployment/compaction/scripts.jrl` | DAOCompaction script |
| `deployment/compaction/scriptparameters.jrl` | Script parameters |
