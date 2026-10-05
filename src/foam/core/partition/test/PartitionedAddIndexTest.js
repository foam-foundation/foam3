/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'PartitionedAddIndexTest',
  extends: 'foam.core.test.Test',

  documentation: `An index added to a PartitionedDAO reaches every partition:
    one already open gets it at once, one opened later gets it from the
    recorded list.`,

  javaImports: [
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.partition.PartitionedDAO',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.dao.ProxyDAO',
    'foam.dao.index.AddIndexCommand',
    'foam.lang.Indexer',
    'foam.lang.X',
    'java.io.File'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        X tx = newStorageContext(x);
        PartitionedDAO dao = new PartitionedDAO(
          tx, PartitionStrRecord.getOwnClassInfo(), "prtAddIndex" + System.nanoTime() + "/",
          PartitionStrRecord.BUCKET);

        PartitionStrRecord a = new PartitionStrRecord(); a.setBucket(5); a.setData("a");
        dao.put(a);

        MDAO open = mdaoOf(dao.getDelegate("5"));
        test(open.getIndexCount() == 1,
          "open partition holds only the primary index, count=" + open.getIndexCount());

        AddIndexCommand cmd = new AddIndexCommand();
        cmd.setIndexers(new Indexer[] { PartitionStrRecord.DATA });
        test(Boolean.TRUE.equals(dao.cmd(cmd)), "the partitioned DAO accepts the index");

        test(open.getIndexCount() == 2,
          "index added after the partition opened reached it, count=" + open.getIndexCount());

        PartitionStrRecord b = new PartitionStrRecord(); b.setBucket(7); b.setData("b");
        dao.put(b);

        MDAO later = mdaoOf(dao.getDelegate("7"));
        test(later.getIndexCount() == 2,
          "partition opened after the index was added has it too, count=" + later.getIndexCount());
      `
    },
    {
      name: 'mdaoOf',
      args: 'DAO dao',
      type: 'MDAO',
      documentation: 'The MDAO at the bottom of a partition delegate chain.',
      javaCode: `
        while ( dao instanceof ProxyDAO ) dao = ((ProxyDAO) dao).getDelegate();
        return (MDAO) dao;
      `
    },
    {
      name: 'newStorageContext',
      args: 'X x',
      type: 'X',
      documentation: 'Sub-context with a temp-dir FileSystemStorage so journals stay out of the runtime journals dir.',
      javaCode: `
        String dir = System.getProperty("java.io.tmpdir") + File.separator
          + "prtaddindex_" + System.nanoTime();
        new File(dir).mkdirs();
        FileSystemStorage fs = new FileSystemStorage(dir);
        return x.put(Storage.class, fs).put(FileSystemStorage.class, fs);
      `
    }
  ]
});
