/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'UnloadableDecoratedDAOTest',
  extends: 'foam.core.test.Test',

  documentation: 'A SINGLE_JOURNAL EasyDAO with both setUnloadable(true) and a decorator set must still get the NotPartitionedDAO wrapper (regression for the getDecorator() == null exclusion), and the decorator plus seqNo stamping must survive an unload/reload cycle.',

  javaImports: [
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.partition.AbstractPartitionedDAO',
    'foam.core.partition.test.UnloadableDecoratedRecord',
    'foam.dao.DAO',
    'foam.dao.EasyDAO',
    'foam.dao.JournalType',
    'foam.dao.ProxyDAO',
    'foam.lang.FObject',
    'foam.lang.X',
    'java.io.File'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        X tx = newStorageContext(x);
        String journalName = "unloadableDecorated_" + System.nanoTime();

        CountingProxyDAO decorator = new CountingProxyDAO(tx);

        DAO dao = new EasyDAO.Builder(tx)
          .setAuthorize(false)
          .setOf(UnloadableDecoratedRecord.getOwnClassInfo())
          .setSeqNo(true)
          .setJournalType(JournalType.SINGLE_JOURNAL)
          .setJournalName(journalName)
          .setUnloadable(true)
          .setDecorator(decorator)
          .build();

        UnloadableDecoratedRecord r1 = new UnloadableDecoratedRecord(); r1.setData("r1");
        UnloadableDecoratedRecord r2 = new UnloadableDecoratedRecord(); r2.setData("r2");
        UnloadableDecoratedRecord r3 = new UnloadableDecoratedRecord(); r3.setData("r3");
        FObject p1 = dao.put(r1);
        FObject p2 = dao.put(r2);
        FObject p3 = dao.put(r3);

        long id1 = ((Long) UnloadableDecoratedRecord.ID.get(p1)).longValue();
        long id2 = ((Long) UnloadableDecoratedRecord.ID.get(p2)).longValue();
        long id3 = ((Long) UnloadableDecoratedRecord.ID.get(p3)).longValue();
        test( id1 > 0 && id2 == id1 + 1 && id3 == id2 + 1,
          "ids sequence-stamped: " + id1 + ", " + id2 + ", " + id3 );

        test( decorator.count > 0,
          "decorator saw put_ calls before unload, count=" + decorator.count );
        int countBeforeUnload = decorator.count;

        Object unloadResult = dao.cmd(AbstractPartitionedDAO.UNLOAD_CMD);
        test( Boolean.TRUE.equals(unloadResult),
          "UNLOAD_CMD returns TRUE: the NotPartitionedDAO wrapper is present even with a decorator set" );

        FObject found = dao.find_(tx, id2);
        test( found != null && "r2".equals(UnloadableDecoratedRecord.DATA.get(found)),
          "record 2 intact after unload/reload" );
        test( decorator.count > countBeforeUnload,
          "decorator is still in the chain after reload, count=" + decorator.count );

        UnloadableDecoratedRecord r4 = new UnloadableDecoratedRecord(); r4.setData("r4");
        FObject p4 = dao.put(r4);
        long id4 = ((Long) UnloadableDecoratedRecord.ID.get(p4)).longValue();
        test( id4 == id3 + 1,
          "seqNo continues after reload, got " + id4 + " expected " + (id3 + 1) );
      `
    },
    {
      name: 'newStorageContext',
      args: 'X x',
      type: 'X',
      documentation: 'Sub-context with a temp-dir FileSystemStorage so journals are isolated.',
      javaCode: `
        String dir = System.getProperty("java.io.tmpdir") + File.separator
          + "unloadabledecorated_" + System.nanoTime();
        new File(dir).mkdirs();
        FileSystemStorage fs = new FileSystemStorage(dir);
        return x.put(Storage.class, fs).put(FileSystemStorage.class, fs);
      `
    }
  ],

  javaCode: `
    /** Counts put_/find_ calls to prove the decorator is live in the chain, before and after unload/reload. */
    public static class CountingProxyDAO extends ProxyDAO {
      public int count = 0;

      public CountingProxyDAO(X x) {
        setX(x);
      }

      public FObject put_(X x, FObject obj) {
        count++;
        return super.put_(x, obj);
      }

      public FObject find_(X x, Object id) {
        count++;
        return super.find_(x, id);
      }
    }
  `
});
