/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'PartitionLoadReplayTest',
  extends: 'foam.core.test.Test',

  documentation: 'Proves F3FileJournal replay feeds a PartitionLoadReporter placed in X (foam.dao.F3FileJournal.js replay loop), and that replay is unaffected when no reporter is present.',

  javaImports: [
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.partition.PartitionLoadReporter',
    'foam.core.partition.PartitionLoadStatus',
    'foam.core.partition.test.PartitionStrRecord',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.dao.java.JDAO',
    'foam.lang.X',
    'java.io.File'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        X tx = newStorageContext(x);
        String jrn = "partitionLoadReplayTest_" + System.currentTimeMillis();

        // Write a journal with enough rows to make accumulation observable
        JDAO writer = new JDAO(tx, PartitionStrRecord.getOwnClassInfo(), jrn);
        for ( int i = 0 ; i < 500 ; i++ ) {
          PartitionStrRecord rec = new PartitionStrRecord();
          rec.setId("r" + i);
          writer.put(rec);
        }

        // Re-replay with a reporter in X
        DAO status = new MDAO(PartitionLoadStatus.getOwnClassInfo());
        X testX = tx.put("partitionLoadStatusDAO", status);
        PartitionLoadReporter reporter = new PartitionLoadReporter(testX, jrn, "svc", "");
        reporter.start(0L);
        new JDAO(testX.put(PartitionLoadReporter.CTX_KEY, reporter), PartitionStrRecord.getOwnClassInfo(), jrn);

        test(reporter.getBytesRead() > 0, "replay accumulated chars into reporter (got " + reporter.getBytesRead() + ")");

        // No reporter in X: replay still works, nothing accumulates anywhere
        JDAO plain = new JDAO(tx, PartitionStrRecord.getOwnClassInfo(), jrn);
        test(plain.find("r0") != null, "replay without reporter unchanged");
      `
    },
    {
      name: 'newStorageContext',
      args: 'X x',
      type: 'X',
      documentation: 'Sub-context with a temp-dir FileSystemStorage so journals are isolated from the real runtime journals dir.',
      javaCode: `
        String dir = System.getProperty("java.io.tmpdir") + File.separator
          + "prlreplay_" + System.nanoTime();
        new File(dir).mkdirs();
        FileSystemStorage fs = new FileSystemStorage(dir);
        return x.put(Storage.class, fs).put(FileSystemStorage.class, fs);
      `
    }
  ]
});
