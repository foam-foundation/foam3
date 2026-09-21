/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'PartitionedDAOListenTest',
  extends: 'foam.core.test.Test',

  documentation: `A listener registered on a PartitionedDAO hears every put and
    remove, whichever partition the write lands in, and a predicated listener
    hears only its partition.`,

  javaImports: [
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.partition.PartitionedDAO',
    'foam.dao.AbstractSink',
    'foam.lang.Detachable',
    'foam.lang.X',
    'java.io.File',
    'static foam.mlang.MLang.EQ'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        X tx = newStorageContext(x);
        PartitionedDAO dao = new PartitionedDAO(
          tx, PartitionStrRecord.getOwnClassInfo(), "prtListen" + System.nanoTime() + "/",
          PartitionStrRecord.BUCKET);

        int[] all    = new int[2];
        int[] bucket = new int[1];
        dao.listen(new AbstractSink() {
          @Override public void put(Object o, Detachable sub)    { all[0]++; }
          @Override public void remove(Object o, Detachable sub) { all[1]++; }
        }, null);
        dao.listen(new AbstractSink() {
          @Override public void put(Object o, Detachable sub) { bucket[0]++; }
        }, EQ(PartitionStrRecord.BUCKET, 5));

        PartitionStrRecord a = new PartitionStrRecord(); a.setBucket(5); a.setData("a");
        PartitionStrRecord b = new PartitionStrRecord(); b.setBucket(7); b.setData("b");
        a = (PartitionStrRecord) dao.put(a);
        dao.put(b);
        dao.remove(a);

        test(all[0] == 2, "listener heard both puts across partitions, got " + all[0]);
        test(all[1] == 1, "listener heard the remove, got " + all[1]);
        test(bucket[0] == 1, "predicated listener heard only its partition, got " + bucket[0]);
      `
    },
    {
      name: 'newStorageContext',
      args: 'X x',
      type: 'X',
      documentation: 'Sub-context with a temp-dir FileSystemStorage so journals stay out of the runtime journals dir.',
      javaCode: `
        String dir = System.getProperty("java.io.tmpdir") + File.separator
          + "prtlisten_" + System.nanoTime();
        new File(dir).mkdirs();
        FileSystemStorage fs = new FileSystemStorage(dir);
        return x.put(Storage.class, fs).put(FileSystemStorage.class, fs);
      `
    }
  ]
});
