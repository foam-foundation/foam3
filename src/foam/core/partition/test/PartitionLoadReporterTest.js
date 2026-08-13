/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'PartitionLoadReporterTest',
  extends: 'foam.core.test.Test',

  documentation: 'Tests PartitionLoadReporter directly: start() puts a row, addChars() throttles then accumulates, done() removes the row and is idempotent.',

  javaImports: [
    'foam.core.partition.PartitionLoadReporter',
    'foam.core.partition.PartitionLoadStatus',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.lang.X'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        DAO status = new MDAO(PartitionLoadStatus.getOwnClassInfo());
        X testX = x.put("partitionLoadStatusDAO", status);

        PartitionLoadReporter r = new PartitionLoadReporter(testX, "jrn/1", "myDAO", "2026/7");

        r.start(1000L);
        PartitionLoadStatus row = (PartitionLoadStatus) status.find("jrn/1");
        test(row != null, "start() puts a status row");
        test(row != null && row.getTotalBytes() == 1000L, "row carries totalBytes");
        test(row != null && "myDAO".equals(row.getServiceName()), "row carries serviceName");
        test(row != null && "2026/7".equals(row.getPartition()), "row carries partition");

        r.addChars(100);
        row = (PartitionLoadStatus) status.find("jrn/1");
        test(row.getBytesRead() == 0L, "immediate addChars throttled (row still at start value)");

        try { Thread.sleep(300); } catch ( InterruptedException e ) {}
        r.addChars(50);
        row = (PartitionLoadStatus) status.find("jrn/1");
        test(row.getBytesRead() == 150L, "post-throttle addChars updates row with accumulated total");
        test(r.getBytesRead() == 150L, "getBytesRead reflects accumulation");

        r.done();
        test(status.find("jrn/1") == null, "done() removes the row");
        r.done();
        test(status.find("jrn/1") == null, "done() is idempotent");
      `
    }
  ]
});
