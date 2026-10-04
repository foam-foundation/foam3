<flow name="JournalFiles" category="DOC/GUIDE" spid="foam" description="Journal file naming, generations and the non-blocking cutover: what replays at boot, how rolling freezes a generation, and how a snapshot supersedes one." keywords="journal,jdao,roll,generation,compaction,gzip,snapshot,naming,knowledge"/>

# Journal Files: Naming, Generations and Rolling

A DAO's data lives in a set of files that differ in who may write them, which storage they are read through, and whether they replay at boot. Which file is which is **derived from the filesystem**, never from stored state -- so a directory listing is the whole truth, and a crash leaves nothing to reconcile.

Every claim cites the code that proves it. Line numbers drift; anchor on the named method if a citation no longer lines up.

For what compaction does with these files, see [Compaction.md](Compaction.md).

---

## The file set

For a journal named `foo`:

| File | Written by | Read through | Replays at boot |
|---|---|---|---|
| `foo.0` | the build (ships in the resources jar) | `Storage` | yes, first |
| `foo.N` | `roll`, by renaming the live journal | `FileSystemStorage` | yes, ascending |
| `foo.N.gz` | by hand, compressing a frozen generation | `FileSystemStorage` | yes, in place of `foo.N` |
| `foo.N.snap.gz` | compaction | `FileSystemStorage` | yes, and supersedes everything at or below N |
| `foo` | the running app, append-only | `FileSystemStorage` | yes, last |
| `*.tmp` | transiently, mid-write | -- | no |

Generations start at 1. The live journal is **always** `foo` -- it is never numbered, so nothing has to migrate and an existing deployment works untouched.

### Only `.snap.gz` claims completeness

`foo.5.gz` is generation 5, merely compressed -- it replays in sequence like any other. `foo.5.snap.gz` is *the complete state through generation 5*, so generations at or below 5 are skipped and may be deleted.

Keeping those meanings apart is what makes `gzip foo.3` safe to run by hand: compressing a generation can never be mistaken for a claim that earlier history is redundant.

### `.tmp` is always discardable

A half-written file is always **derived data** -- a snapshot is a rewrite of state that still exists in the generations it was going to supersede, so deleting it loses nothing. A tail file is the opposite: the only copy of its writes, and never `.tmp`. That invariant is what makes "just throw it out" correct rather than merely convenient.

`JournalGenerations` skips `.tmp` by an explicit rule rather than as a side effect of parsing (`JournalGenerations.java:101`), so the intent survives a change to the parsing.

---

## Boot load order

`JDAO` assembles the journals in `delegate`'s `javaPostSet` and replays them through a `CompositeJournal`:

```
foo.0                     repo journal, from the jar
foo.N | .gz | .snap.gz    generations ascending, superseded ones skipped
foo                       the live journal
```

Later entries win, so the order is the whole point: the live journal must apply after everything it amends.

A generation appears in one of three forms and replays the same way in each: `foo.N` as `roll` leaves it, `foo.N.gz` if compressed by hand, `foo.N.snap.gz` if written by compaction. Ordering is by generation number, so the form never changes where it replays.

The generation list is derived at boot by listing the directory (`JournalGenerations.java:138`). Generation 0 is not in it -- it is a jar resource read through `Storage`, and a dev tree without a resource jar has it on disk too, where counting it would replay it twice (`JournalGenerations.java:120`).

`runtimeOnly` skips everything but the live journal (`JDAO.js:133-137`); Medusa uses it to bootstrap from existing data.

### `foo.0` is immutable, and not by convention

With `-Dresource.journals.dir` set, `Storage` resolves to a `ResourceStorage` (`Boot.java:60-63`) whose `getOutputStream` throws outright (`ResourceStorage.java:79-81`), as does `get` (`ResourceStorage.java:74-76`). Nothing can update it in place, and the jar already deflates it, so there is nothing to gain by compressing it further.

---

## Rolling

`roll` freezes the live journal as the next generation and starts a fresh one (`AbstractF3FileJournal.js:666`). It is reached by sending a `FileRollCmd` through the DAO.

```
1. flush and close the writer
2. rename foo -> foo.N     (atomic)
3. clear the cached writer, so the next write opens a fresh foo
```

**It runs as a job on the journal's own assembly line** (`AbstractF3FileJournal.js:690`). Every `put` and `remove` already passes through `getLine()`, a `SyncAssemblyLine`, so the cutover is ordered against them by construction: writes enqueued before it have written their bytes, writes after it open the new file. **Nothing is blocked** -- not writes, not reads -- and no caller has to pause traffic first.

That ordering is also what makes a rename safe. The usual objection -- that a rename moves only the inode, leaving the VM writing into the renamed file -- applies to a writer left open across it. Here the writer is closed first and the cached one cleared after (`AbstractF3FileJournal.js:704`).

**A rename moves no data**, so a cutover costs the same whether the journal is a megabyte or a hundred gigabytes.

### Rolling manually

From a BeanShell script, where `x` is already in scope:

```java
x.get("somethingDAO").cmd(new foam.dao.FileRollCmd());
```

`cmd(Object)` runs on the DAO's own context (`AbstractDAO.js:547-553`), `ProxyDAO.cmd_` passes it down the stack (`ProxyDAO.js:50-58`), and `JDAO` hands it to the journal before its delegate. The returned `FileRollCmd` carries the frozen filename in `getRolledFilename()`, or a message in `getError()`.

This is safe on a live system. It was not always -- `roll` used to require its caller to block journal I/O -- but the assembly line supplies that ordering now.

### Choosing N

`JournalGenerations` lists the directory, classifies each name, and returns the highest generation plus one (`JournalGenerations.java:163`). Because the classification understands `.gz` and `.snap.gz`, a compressed generation still occupies its number and cannot be silently overwritten. A `.tmp` left by a failed attempt is *not* counted, so its number is reused and the stale file written over.

**N ascends chronologically.** `foo.1` is the oldest generation, not the newest.

---

## Compaction

Compaction rolls, then rewrites every object from the MDAO into a **new snapshot file** -- not into the live journal.

```
1. roll            foo -> foo.5, fresh foo for live traffic   Compactor.js:94
2. snapshot        MDAO select, written to foo.5.snap.gz.tmp  Compactor.js:157
3. commit          close (writes the gzip trailer), rename    Compactor.js:267
4. clean up        delete generations <= 5                    Compactor.js:279
```

It is driven by the JDAO that owns the journal: a `CompactionCmd` sent down the
DAO stack is handled there (`JDAO.js:261-262`), and the JDAO hands itself to the
`Compactor`. That is what makes it partition-safe -- a `PartitionedDAO` forwards
the command to each partition (`PartitionedDAO.java:158`) and every journal
compacts its own data, instead of an orchestrator searching the stack and
finding one of many.

Nothing is blocked at any step. The MDAO's index is a functional data structure -- `put_` installs a new state rather than mutating the old one (`MDAO.java:203-215`) -- so the select holds a snapshot that later writes cannot disturb (`MDAO.java:266`), and the rewrite can take as long as it likes beside live traffic.

Step 3 is the **only commit point**. Before it the frozen generations are still the record; after it they are dead weight.

Step 4 is currently **off by default**: `keepSupersededGenerations` retains
them, so while compaction is being proven a bad snapshot never destroys the
generations it was built from. It costs disk only -- `replayOrder()` skips a
superseded generation by name, whether or not it is still there, so a retained
one is never opened, decompressed or replayed. Retained generations can be
gzipped in place and stay skipped.

Full detail in [Compaction.md](Compaction.md).

### Crash windows

Every one resolves by the same read rule, with no recovery procedure:

| crash | on disk | boot result |
|---|---|---|
| during the snapshot | `foo.5.snap.gz.tmp` + generations | `.tmp` ignored, generations replay -- correct |
| after rename, before cleanup | snapshot **and** `foo.1`..`foo.5` | superseded generations skipped -- correct |
| after cleanup | snapshot + `foo.6` | correct |

The middle row is why `.snap.gz` has to mean *complete*. Replaying a superseded generation would otherwise resurrect rows deleted before the snapshot was taken: a later put overwrites an earlier one, but nothing un-deletes a row the snapshot simply omits.

---

## Gotchas

1. **A misnamed file is silently ignored.** Names that do not parse are skipped, not reported. A journal that quietly loads less data still boots reporting success -- verify with the replay log, which names each file it read and how many entries it processed.

2. **Generations replay, archives-by-another-name do not.** Anything not matching `foo.N[.gz|.snap.gz]` is invisible to the loader.

3. **A compressed *live* journal cannot work.** Write-side gzip needs the stream closed to emit its trailer, and a live journal is flushed and never closed (see the `gzip` property). It is for write-once files such as snapshots.

4. **`Storage` is not `FileSystemStorage`.** Anything in the runtime directory must be reached through `FileSystemStorage`; `Storage` is the jar's `ResourceStorage` wherever `.0` journals ship as resources, and it cannot open a `File` at all (`ResourceStorage.java:74-76`). `JDAO` builds the live and generation journals on a context with `Storage` swapped (`JDAO.js:112`).

5. **A journal path that resolves to a directory is skipped**, not replayed (`F3FileJournal.js:80`).

---

## Partitioned journals

A `PartitionedDAO` gives every partition its own **directory**, with the journal
inside it under the fixed name `journal` (`PartitionedDAO.java:206-215`). So the
whole file set above repeats per partition:

```
cmp/7/journal              the live journal for partition 7
cmp/7/journal.1            a frozen generation
cmp/7/journal.2.snap.gz    a snapshot through generation 2
cmp/9.0/journal            partition "9.0" -- needs no escaping
```

That keeps two namespaces apart **structurally**: a partition value is a
directory name, and a journal's own bookkeeping is a file name beneath it.
Nothing has to be parsed to tell them apart, a partition value can be anything
the filesystem accepts, and removing a partition is removing its directory.
Chained levels build their child's directory from the same method, so every
level is the same shape (`cmp/1/202401/journal`).

Partition discovery is then just "the entries that are directories"
(`PartitionedDAO.java:350-356`). Compaction reaches each one because
`CompactionCmd` is forwarded per partition, and each partition's JDAO compacts
its own journal.

---

## Key Files

| File | Purpose |
|---|---|
| `foam/dao/JournalGenerations.java` | Derives the generation set from the filesystem |
| `foam/dao/java/JDAO.js` | Assembles the boot load order |
| `foam/dao/AbstractF3FileJournal.js` | `reader`, `writer`, `roll`, the `gzip` flag |
| `foam/dao/F3FileJournal.js` | `replay` |
| `foam/dao/ReadOnlyF3FileJournal.js` | Replay-only journal, used for every frozen file |
| `foam/dao/WriteOnlyF3FileJournal.js` | Write-only journal, used for the snapshot |
| `foam/dao/FileRollCmd.js` | Command that triggers a cutover |
| `foam/dao/compaction/Compactor.js` | Roll plus snapshot, driven by one JDAO |
| `foam/dao/compaction/CompactionCmd.js` | The command that reaches every JDAO in a stack |
| `foam/dao/test/JournalGenerationsTest.js` | The derivation rule |
| `foam/core/boot/Boot.java` | Binds `Storage` and `FileSystemStorage` |
