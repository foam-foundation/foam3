/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'SingleToPartitionMigratorTest',
  extends: 'foam.core.test.Test',

  documentation: 'Tests SingleToPartitionMigrator: routing, counts, archive, idempotent re-run.',

  javaImports: [
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.partition.PartitionedDAO',
    'foam.core.partition.SingleToPartitionMigrator',
    'foam.dao.DAO',
    'foam.dao.java.JDAO',
    'foam.lang.X',
    'foam.mlang.Constant',
    'foam.mlang.sink.Count',
    'java.io.File',
    'java.util.Map',
    'static foam.mlang.MLang.COUNT'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        testMigrateRoutesByBucket(x);
      `
    },
    {
      name: 'newStorageContext',
      args: 'X x',
      type: 'X',
      documentation: 'Sub-context with a temp-dir FileSystemStorage so journals are isolated.',
      javaCode: `
        String dir = System.getProperty("java.io.tmpdir") + File.separator
          + "partmig_" + System.nanoTime();
        new File(dir).mkdirs();
        FileSystemStorage fs = new FileSystemStorage(dir);
        return x.put(Storage.class, fs).put(FileSystemStorage.class, fs);
      `
    },
    {
      name: 'seedRec',
      args: 'X x, DAO dao, long id, int bucket',
      type: 'Void',
      javaCode: `
        PartitionTestRecord r = new PartitionTestRecord();
        r.setId(id);
        r.setBucket(bucket);
        r.setData("d" + id);
        dao.put(r);
      `
    },
    {
      name: 'newPartitioned',
      args: 'X x',
      type: 'PartitionedDAO',
      javaCode: `
        // Use Constant(null) as identityExpr so put_ routes via getPartition(obj)
        // (the default IdentityExpr returns a Long which cannot be cast to String).
        return new PartitionedDAO(
          x,
          PartitionTestRecord.getOwnClassInfo(),
          "ptest",
          new Constant(null),
          PartitionTestRecord.BUCKET);
      `
    },
    {
      name: 'testMigrateRoutesByBucket',
      args: 'X x',
      type: 'Void',
      javaThrows: ['Throwable'],
      javaCode: `
        X tx = newStorageContext(x);
        String src = "ptestSource_" + System.nanoTime();

        DAO writeDAO = new JDAO(tx, PartitionTestRecord.getOwnClassInfo(), src);
        seedRec(tx, writeDAO, 1L, 1);
        seedRec(tx, writeDAO, 2L, 1);
        seedRec(tx, writeDAO, 3L, 1);
        seedRec(tx, writeDAO, 4L, 2);
        seedRec(tx, writeDAO, 5L, 2);

        DAO source = new JDAO(tx, PartitionTestRecord.getOwnClassInfo(), src);
        PartitionedDAO target = newPartitioned(tx);

        Map<String,Long> counts = new SingleToPartitionMigrator().migrate(tx, source, target);

        test( counts.size() == 2, "Two partitions written, got " + counts.size() );
        test( counts.get("1") != null && counts.get("1") == 3L,
          "Bucket 1 has 3 records, got " + counts.get("1") );
        test( counts.get("2") != null && counts.get("2") == 2L,
          "Bucket 2 has 2 records, got " + counts.get("2") );

        Count c1 = (Count) target.getDelegate("1").select(COUNT());
        Count c2 = (Count) target.getDelegate("2").select(COUNT());
        test( c1.getValue() == 3, "Bucket 1 journal has 3 rows, got " + c1.getValue() );
        test( c2.getValue() == 2, "Bucket 2 journal has 2 rows, got " + c2.getValue() );
      `
    }
  ]
});
