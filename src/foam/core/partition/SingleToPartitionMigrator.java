/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.partition;

import foam.core.fs.Storage;
import foam.core.logger.Loggers;
import foam.dao.AbstractSink;
import foam.dao.DAO;
import foam.dao.java.JDAO;
import foam.lang.FObject;
import foam.lang.X;
import foam.mlang.sink.Count;
import foam.util.SafetyUtil;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.Map;

import static foam.mlang.MLang.COUNT;

/**
 * One-time migrator: copies a single-file DAO journal into a PartitionedDAO's
 * per-partition journals, validates by count, then archives the legacy journal
 * by rename. Generic — no knowledge of any specific model.
 */
public class SingleToPartitionMigrator {

  public long migrate(X x, DAO source, PartitionedDAO target, Map<String,String> idMap) {
    // Lean entirely on the target's put_: it routes the record through every
    // partition level (PartitionedDAO -> nested DatePartitionedDAO -> JDAO) and
    // stamps the composite id. The migrator no longer recomputes the partition
    // itself (that only ever modelled the top level and broke on multi-level
    // targets); it just counts the records put_ accepts.
    final foam.lang.PropertyInfo idProp = target.getIdProperty();
    final boolean strId = idProp != null && String.class.equals(idProp.getValueClass());
    final long[] migrated = { 0L };
    source.select(new AbstractSink() {
      public void put(Object obj, foam.lang.Detachable sub) {
        // select() returns frozen objects; clone before put_ since a per-partition
        // seqNo may stamp a composite id on the record.
        FObject record = ((FObject) obj).fclone();
        // Only String-id models get restamped (the per-partition seqNo); capture
        // the id change so references held by other DAOs can be rewritten.
        String oldId = strId ? (String) idProp.f(record) : null;
        FObject stored = target.put_(x, record);
        String newId = strId ? (String) idProp.f(stored) : null;
        if ( ! SafetyUtil.isEmpty(oldId) && ! oldId.equals(newId) ) {
          idMap.put(oldId, newId);
        }
        migrated[0]++;
      }
    });
    Loggers.logger(x, this).info("Migrated records:", migrated[0]);
    return migrated[0];
  }

  public boolean needsMigration(Storage storage, String journalName) {
    // A directory at the journal name (e.g. a sibling PartitionedDAO nesting its
    // per-partition files under "<name>/") is not a legacy journal to migrate.
    File runtime = storage.get(journalName);
    File repo    = storage.get(journalName + ".0");
    return ( runtime != null && runtime.exists() && ! runtime.isDirectory() )
        || ( repo != null && repo.exists() && ! repo.isDirectory() );
  }

  /** True when the target's partition directory already contains partition
      journal files. Partition journals are named "<dirName><part>" (see
      PartitionedDAO.createDAO). A dirName ending in '/' owns its directory,
      so any file inside counts; a flat dirName shares its parent with
      unrelated journals, so only files with the dirName's basename as a
      prefix count. */
  protected boolean hasExistingPartitions(Storage storage, PartitionedDAO target) {
    String dirName = target.getDirName();
    if ( dirName.endsWith("/") ) {
      File dir = storage.get(dirName);
      if ( dir == null || ! dir.isDirectory() ) return false;
      File[] files = dir.listFiles();
      return files != null && files.length > 0;
    }
    File probe = storage.get(dirName);
    File dir   = probe == null ? null : probe.getParentFile();
    if ( dir == null || ! dir.isDirectory() ) return false;
    final String prefix = probe.getName();
    File[] files = dir.listFiles((d, name) -> name.startsWith(prefix));
    return files != null && files.length > 0;
  }

  public void archive(Storage storage, String journalName) {
    moveIfExists(storage, journalName,        journalName + ".migrated");
    moveIfExists(storage, journalName + ".0", journalName + ".0.migrated");
  }

  private void moveIfExists(Storage storage, String from, String to) {
    File src = storage.get(from);
    if ( src == null || ! src.exists() ) return;
    // Never archive a directory — when partitions are nested under a dir named
    // like the legacy journal, that dir shares the journal's base name; only
    // journal files should be renamed to .migrated.
    if ( src.isDirectory() ) return;
    File dst = storage.get(to);
    try {
      Files.move(src.toPath(), dst.toPath(), StandardCopyOption.REPLACE_EXISTING);
    } catch ( java.io.IOException e ) {
      throw new RuntimeException("Failed to archive journal " + from + " -> " + to, e);
    }
  }

  /** Migration without reference fixup — for targets no other DAO references. */
  public void run(X x, String legacyJournalName, PartitionedDAO target) {
    run(x, legacyJournalName, target, null);
  }

  public void run(X x, String legacyJournalName, PartitionedDAO target, String daoKey) {
    // Use the WRITABLE FileSystemStorage (JOURNAL_HOME), not Storage.class — the
    // latter is a read-only ResourceStorage when -Dresource.journals.dir is set
    // (dev/most deploys), which can't detect or rename the runtime journal.
    // The source read (new JDAO below) still pulls .0 from resources transparently,
    // so any records shipped in the repo .0 are imported on the first migration.
    Storage storage = (Storage) x.get(foam.core.fs.FileSystemStorage.class);
    if ( ! needsMigration(storage, legacyJournalName) ) {
      Loggers.logger(x, this).info("No legacy journal to migrate:", legacyJournalName);
      return;
    }

    // A legacy journal alongside already-populated partition journals means a
    // previous migration crashed partway (or writes raced the migration).
    // Re-running would duplicate records under fresh seqNo ids, so fail loudly
    // and leave everything untouched for manual recovery: either restore the
    // legacy journal as the source of truth and delete the partition journals,
    // or delete/archive the legacy journal if the partitions are complete.
    if ( hasExistingPartitions(storage, target) ) {
      Loggers.logger(x, this).error(
        "Partial previous migration detected; NOT migrating.",
        "legacy", legacyJournalName, "partitionDir", target.getDirName());
      return;
    }

    DAO source = new JDAO(x, target.getOf(), legacyJournalName);
    long srcCount = ((Count) source.select(COUNT())).getValue();

    Map<String,String> idMap    = new HashMap<>();
    long               migrated = migrate(x, source, target, idMap);

    if ( migrated != srcCount ) {
      Loggers.logger(x, this).warning(
        "Migration count mismatch; NOT archiving.",
        "source", srcCount, "migrated", migrated);
      return;
    }

    // Fix references held by other DAOs before archiving — the archived
    // journal doubles as the completion marker: any crash before this point
    // leaves the journal in place alongside populated partitions, which the
    // pre-flight guard reports loudly as a partial migration on the next boot.
    if ( daoKey != null && ! idMap.isEmpty() ) {
      try {
        if ( ! new ReferenceMigrator(daoKey).fixReferences(x, idMap) ) {
          Loggers.logger(x, this).warning("Reference fixup incomplete; NOT archiving.");
          return;
        }
      } catch ( Throwable t ) {
        Loggers.logger(x, this).error("Reference fixup failed; NOT archiving.", t);
        return;
      }
    }

    archive(storage, legacyJournalName);
    Loggers.logger(x, this).info(
      "Migration complete and archived:", legacyJournalName, "records", srcCount);
  }
}
