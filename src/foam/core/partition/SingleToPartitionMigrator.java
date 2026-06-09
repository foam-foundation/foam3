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
    throw new UnsupportedOperationException("not implemented");
  }

  public void archive(Storage storage, String journalName) {
    throw new UnsupportedOperationException("not implemented");
  }

  public boolean validate(X x, PartitionedDAO target, Map<String,Long> expected) {
    throw new UnsupportedOperationException("not implemented");
  }

  public void run(X x, String legacyJournalName, PartitionedDAO target) {
    throw new UnsupportedOperationException("not implemented");
  }
}
