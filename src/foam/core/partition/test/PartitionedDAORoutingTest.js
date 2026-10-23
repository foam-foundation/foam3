/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'PartitionedDAORoutingTest',
  extends: 'foam.core.test.Test',

  documentation: `PartitionedDAO.select_ fans an IN over the partition property
    out to one partition per value, and a predicate with no partition term
    is refused instead of creating a partition named "null".`,

  javaImports: [
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.partition.PartitionedDAO',
    'foam.dao.ArraySink',
    'foam.lang.X',
    'java.io.File',
    'static foam.mlang.MLang.EQ',
    'static foam.mlang.MLang.IN'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        String dir = System.getProperty("java.io.tmpdir") + File.separator + "routing_" + System.nanoTime();
        new File(dir).mkdirs();
        FileSystemStorage fs = new FileSystemStorage(dir);
        X tx = x.put(Storage.class, fs).put(FileSystemStorage.class, fs);

        String dirName = "rt" + System.nanoTime() + "/";
        PartitionedDAO dao = new PartitionedDAO(
          tx, PartitionStrRecord.getOwnClassInfo(), dirName, PartitionStrRecord.BUCKET);
        for ( int b : new int[] { 5, 7, 9 } ) {
          PartitionStrRecord r = new PartitionStrRecord(); r.setBucket(b); r.setData("d" + b);
          dao.put(r);
        }

        ArraySink in = (ArraySink) dao.where(IN(PartitionStrRecord.BUCKET, new Object[] { 5, 9 })).select(new ArraySink());
        test(in.getArray().size() == 2, "IN over two partitions returns their two rows, got " + in.getArray().size());

        boolean threw = false;
        try {
          dao.where(EQ(PartitionStrRecord.DATA, "d7")).select(new ArraySink());
        } catch ( UnsupportedOperationException e ) {
          threw = true;
        }
        test(threw, "a predicate with no partition term is refused");
        test(! fs.get(dirName + "null").exists(), "no journal named null is created");
        test(! dao.isLoaded("null"), "no partition named null is cached");
      `
    }
  ]
});
