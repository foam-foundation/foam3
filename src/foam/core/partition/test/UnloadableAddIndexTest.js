/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'UnloadableAddIndexTest',
  extends: 'foam.core.test.Test',

  documentation: `Indexes on an unloadable EasyDAO, from both ends. One added
    while the delegate is loaded has to reach the live MDAO; one added while
    nothing is loaded is recorded and applied by the next createDAO().

    Also covers AddIndexService, which sends a list of them: an index the DAO
    cannot place is reported and the rest of the list still goes out.`,

  javaImports: [
    'foam.core.boot.CSpec',
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.partition.AbstractPartitionedDAO',
    'foam.dao.DAO',
    'foam.dao.EasyDAO',
    'foam.dao.JournalType',
    'foam.dao.MDAO',
    'foam.dao.index.AddIndexCommand',
    'foam.dao.index.AddIndexService',
    'foam.lang.FObject',
    'foam.lang.Indexer',
    'foam.lang.X',
    'foam.mlang.MLang',
    'java.io.File'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        String journalName = "unloadableAddIndex_" + System.nanoTime();

        CSpec cspec = new CSpec();
        cspec.setName(journalName);
        cspec.setLazy(false);

        X tx = newStorageContext(x).put(CSpec.class, cspec);

        EasyDAO easy = new EasyDAO.Builder(tx)
          .setAuthorize(false)
          .setOf(UnloadableDecoratedRecord.getOwnClassInfo())
          .setSeqNo(true)
          .setJournalType(JournalType.SINGLE_JOURNAL)
          .setJournalName(journalName)
          .setUnloadable(true)
          .build();

        UnloadableDecoratedRecord r1 = new UnloadableDecoratedRecord(); r1.setData("r1");
        UnloadableDecoratedRecord r2 = new UnloadableDecoratedRecord(); r2.setData("r2");
        UnloadableDecoratedRecord r3 = new UnloadableDecoratedRecord(); r3.setData("r3");
        easy.put(r1);
        easy.put(r2);
        easy.put(r3);

        MDAO mdao = (MDAO) easy.getMdao();
        test( mdao.getIndexCount() == 1,
          "delegate is loaded and holds only the primary index, count=" + mdao.getIndexCount() );

        easy.addPropertyIndex(new foam.lang.PropertyInfo[] { UnloadableDecoratedRecord.DATA });

        test( mdao.getIndexCount() == 2,
          "index added after the delegate loaded reached the live MDAO, count=" + mdao.getIndexCount() );

        FObject found = easy.find(MLang.EQ(UnloadableDecoratedRecord.DATA, "r2"));
        test( found != null && "r2".equals(UnloadableDecoratedRecord.DATA.get(found)),
          "the newly indexed property still answers the query it indexes" );

        easy.cmd(AbstractPartitionedDAO.UNLOAD_CMD);

        AddIndexCommand pending = new AddIndexCommand();
        pending.setIndexers(new Indexer[] { UnloadableDecoratedRecord.DATA2 });
        easy.cmd_(tx, pending);

        easy.find(MLang.EQ(UnloadableDecoratedRecord.DATA, "r2"));

        MDAO reloaded = (MDAO) easy.getMdao();
        test( reloaded != mdao,
          "unload rebuilt the inner chain, so getMdao() tracks a new store" );
        test( reloaded.getIndexCount() == 3,
          "both recorded indexes are replayed onto the rebuilt MDAO, count=" + reloaded.getIndexCount() );

        RefusingDAO refusing = new RefusingDAO(tx);
        new AddIndexService.Builder(tx.put("refusingIndexTarget", refusing))
          .setCSpec("refusingIndexTarget")
          .build()
          .addIndex(new Indexer[] { UnloadableDecoratedRecord.DATA })
          .addIndex(new Indexer[] { UnloadableDecoratedRecord.DATA2 })
          .start();
        test( refusing.attempts == 2,
          "an index a DAO refuses does not stop the ones listed after it, attempts=" + refusing.attempts );
      `
    },
    {
      name: 'newStorageContext',
      args: 'X x',
      type: 'X',
      documentation: 'Sub-context with a temp-dir FileSystemStorage so journals are isolated.',
      javaCode: `
        String dir = System.getProperty("java.io.tmpdir") + File.separator
          + "unloadableaddindex_" + System.nanoTime();
        new File(dir).mkdirs();
        FileSystemStorage fs = new FileSystemStorage(dir);
        return x.put(Storage.class, fs).put(FileSystemStorage.class, fs);
      `
    }
  ],

  javaCode: `
    /** Refuses every AddIndexCommand and counts the attempts, so a caller that
        gives up after the first refusal shows as a count of one. */
    public static class RefusingDAO extends foam.dao.ProxyDAO {
      public int attempts = 0;

      public RefusingDAO(X x) {
        setX(x);
        setDelegate(new MDAO(UnloadableDecoratedRecord.getOwnClassInfo()));
      }

      public Object cmd_(X x, Object cmd) {
        if ( cmd instanceof AddIndexCommand ) {
          attempts++;
          return null;
        }
        return super.cmd_(x, cmd);
      }
    }
  `
});
