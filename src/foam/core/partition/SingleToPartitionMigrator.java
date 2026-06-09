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

  public Map<String,Long> migrate(X x, DAO source, PartitionedDAO target) {
    final Map<String,Long> counts = new HashMap<>();
    source.select(new AbstractSink() {
      public void put(Object obj, foam.lang.Detachable sub) {
        FObject record = (FObject) obj;
        target.put_(x, record);
        String part = target.getPartition(record);
        counts.merge(part, 1L, Long::sum);
      }
    });
    Loggers.logger(x, this).info("Migrated partitions:", counts.toString());
    return counts;
  }

  public boolean needsMigration(Storage storage, String journalName) {
    File runtime = storage.get(journalName);
    File repo    = storage.get(journalName + ".0");
    return ( runtime != null && runtime.exists() )
        || ( repo != null && repo.exists() );
  }

  public void archive(Storage storage, String journalName) {
    moveIfExists(storage, journalName,        journalName + ".migrated");
    moveIfExists(storage, journalName + ".0", journalName + ".0.migrated");
  }

  private void moveIfExists(Storage storage, String from, String to) {
    File src = storage.get(from);
    if ( src == null || ! src.exists() ) return;
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

  public void run(X x, String legacyJournalName, PartitionedDAO target) {
    Storage storage = (Storage) x.get(Storage.class);
    if ( ! needsMigration(storage, legacyJournalName) ) {
      Loggers.logger(x, this).info("No legacy journal to migrate:", legacyJournalName);
      return;
    }

    DAO source = new JDAO(x, target.getOf(), legacyJournalName);
    long srcCount = ((Count) source.select(COUNT())).getValue();

    Map<String,Long> counts = migrate(x, source, target);
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

    archive(storage, legacyJournalName);
    Loggers.logger(x, this).info(
      "Migration complete and archived:", legacyJournalName, "records", srcCount);
  }
}
