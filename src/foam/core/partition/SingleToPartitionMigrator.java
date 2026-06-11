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

  public Map<String,Long> migrate(X x, DAO source, PartitionedDAO target, Map<String,String> idMap) {
    final Map<String,Long> counts = new HashMap<>();
    source.select(new AbstractSink() {
      public void put(Object obj, foam.lang.Detachable sub) {
        // select() returns frozen objects; clone before put_ since a per-partition
        // seqNo may stamp a composite id on the record.
        FObject record = ((FObject) obj).fclone();
        // Count by the same key put_ routes on — the partition property
        // (PartitionedDAO.put_). objToPath prefers the id prefix, which
        // misclassifies legacy plain ids (no '-') and negative ids ('-' at 0),
        // making validation compare against the wrong partitions.
        String part  = target.getPartition(record);
        String oldId = stringId(record);
        FObject stored = target.put_(x, record);
        String newId = stringId(stored);
        if ( ! SafetyUtil.isEmpty(oldId) && newId != null && ! oldId.equals(newId) ) {
          idMap.put(oldId, newId);
        }
        counts.merge(part, 1L, Long::sum);
      }
    });
    Loggers.logger(x, this).info("Migrated partitions:", counts.toString());
    return counts;
  }

  /** The record's id as a String, or null for non-String-id models. */
  protected String stringId(FObject record) {
    foam.lang.PropertyInfo idProp =
      (foam.lang.PropertyInfo) record.getClassInfo().getAxiomByName("id");
    if ( idProp == null || ! String.class.equals(idProp.getValueClass()) ) return null;
    return (String) idProp.get(record);
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
      journal files. Partition journals are named "<dirName>_<part>" (see
      PartitionedDAO.createDAO), so only files with that prefix count — the
      directory may be a shared root holding unrelated journals when dirName
      has no nested path. */
  protected boolean hasExistingPartitions(Storage storage, PartitionedDAO target) {
    File probe = storage.get(target.getDirName() + "_");
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

  public boolean validate(X x, PartitionedDAO target, Map<String,Long> expected) {
    for ( Map.Entry<String,Long> e : expected.entrySet() ) {
      Count c = (Count) target.getDelegate(e.getKey()).select(COUNT());
      if ( c.getValue() != e.getValue() ) {
        Loggers.logger(x, this).warning(
          "Partition validation mismatch for", e.getKey(),
          "expected", e.getValue(), "got", c.getValue());
        return false;
      }
    }
    return true;
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

    Map<String,String> idMap  = new HashMap<>();
    Map<String,Long>   counts = migrate(x, source, target, idMap);
    long migrated = 0L;
    for ( Long v : counts.values() ) migrated += v;

    if ( migrated != srcCount ) {
      Loggers.logger(x, this).warning(
        "Migration count mismatch; NOT archiving.",
        "source", srcCount, "migrated", migrated);
      return;
    }

    if ( ! validate(x, target, counts) ) {
      Loggers.logger(x, this).warning("Partition validation failed; NOT archiving.");
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
