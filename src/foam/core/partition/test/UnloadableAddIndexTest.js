/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'UnloadableAddIndexTest',
  extends: 'foam.core.test.Test',

  documentation: `An index added to an unloadable EasyDAO after its delegate is
    already loaded has to reach the live MDAO, not only the list replayed on the
    next load. A cSpec with lazy:false builds the delegate inside the delegate
    factory, which runs before the serviceScript's own addPropertyIndex() calls,
    so an AddIndexCommand that is merely recorded leaves every query on that
    property scanning the whole table until something unloads the DAO.

    The unloaded case is asserted too: recording is the whole job there, so the
    command answers TRUE. AddIndexService abandons the rest of its list on any
    other answer, and it targets lazy cSpecs whose delegate is never built.`,

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
        Object answer = easy.cmd_(tx, pending);
        test( Boolean.TRUE.equals(answer),
          "an index added while nothing is loaded answers TRUE, got " + answer );

        easy.find(MLang.EQ(UnloadableDecoratedRecord.DATA, "r2"));

        MDAO reloaded = (MDAO) easy.getMdao();
        test( reloaded != mdao,
          "unload rebuilt the inner chain, so getMdao() tracks a new store" );
        test( reloaded.getIndexCount() == 3,
          "both recorded indexes are replayed onto the rebuilt MDAO, count=" + reloaded.getIndexCount() );
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
  ]
});
