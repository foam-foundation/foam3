/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'IndexBeforeReplayTest',
  extends: 'foam.core.test.Test',

  documentation: `An index recorded on an unloadable DAO is in the MDAO
    before the journal replays into it, so the replay's bulk load builds it
    with the rest. Added after the replay, it would be built on its own from
    the rows already loaded.

    Covers a reload, a lazy:false CSpec whose service script adds the index
    after build(), a lazy CSpec, and the dedup path, which replays one put at a time and so
    still adds its indexes after.`,

  javaImports: [
    'foam.core.boot.CSpec',
    'foam.core.boot.CSpecFactory',
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.partition.AbstractPartitionedDAO',
    'foam.dao.DAO',
    'foam.dao.EasyDAO',
    'foam.dao.JournalType',
    'foam.dao.MDAO',
    'foam.dao.index.Index',
    'foam.dao.index.ProxyIndex',
    'foam.dao.index.TreeIndex',
    'foam.lang.FObject',
    'foam.lang.Indexer',
    'foam.lang.ProxyX',
    'foam.lang.X',
    'foam.mlang.MLang',
    'java.io.File',
    'java.io.FileWriter'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        String dir = System.getProperty("java.io.tmpdir") + File.separator
          + "indexbeforereplay_" + System.nanoTime();
        new File(dir).mkdirs();
        FileSystemStorage fs = new FileSystemStorage(dir);
        X tx = x.put(Storage.class, fs).put(FileSystemStorage.class, fs);

        // Reload: the first access replays, and so does the one after an unload.
        seed(dir, "reload");
        ProbeIndex probe = newProbe();
        EasyDAO easy = new EasyDAO.Builder(tx)
          .setAuthorize(false)
          .setOf(UnloadableDecoratedRecord.getOwnClassInfo())
          .setJournalType(JournalType.SINGLE_JOURNAL)
          .setJournalName("reload")
          .setUnloadable(true)
          .build();
        easy.addIndex(probe);

        FObject found = easy.find(MLang.EQ(UnloadableDecoratedRecord.DATA, "b"));
        test( found != null, "the indexed property answers its query" );
        test( probe.bulkLoads == 1 && probe.rows == 3,
          "the first access builds the index from all 3 rows, bulkLoads=" + probe.bulkLoads + " rows=" + probe.rows );
        test( ! probe.afterReplay, "the first access builds the index in the replay's bulk load" );

        easy.cmd(AbstractPartitionedDAO.UNLOAD_CMD);
        easy.find(MLang.EQ(UnloadableDecoratedRecord.DATA, "b"));
        test( probe.bulkLoads == 2 && probe.rows == 3,
          "the reload builds it again from all 3 rows, bulkLoads=" + probe.bulkLoads + " rows=" + probe.rows );
        test( ! probe.afterReplay, "the reload builds the index in the replay's bulk load" );

        // lazy:false: the service script adds the index after build(), and the
        // data is still loaded at boot, before anything reads it.
        seed(dir, "boot");
        bootProbe = newProbe();
        DAO cSpecDAO = new MDAO(CSpec.getOwnClassInfo());
        CSpec spec = new CSpec();
        spec.setX(tx);
        spec.setName("indexBeforeReplayDAO");
        spec.setLazy(false);
        spec.setCSpecDAO(cSpecDAO);
        spec.setServiceScript(
          "return new foam.dao.EasyDAO.Builder(x)" +
          ".setAuthorize(false)" +
          ".setOf(foam.core.partition.test.UnloadableDecoratedRecord.getOwnClassInfo())" +
          ".setJournalType(foam.dao.JournalType.SINGLE_JOURNAL)" +
          ".setJournalName(\\"boot\\")" +
          ".setUnloadable(true)" +
          ".build()" +
          ".addIndex(foam.core.partition.test.IndexBeforeReplayTest.bootProbe);");
        cSpecDAO.put(spec);

        Object service = new CSpecFactory(new ProxyX(tx), spec).create(tx);
        test( service instanceof DAO, "the CSpec builds a DAO" );
        test( bootProbe.bulkLoads == 1 && bootProbe.rows == 3,
          "a lazy:false DAO is loaded when its service is created, bulkLoads=" + bootProbe.bulkLoads + " rows=" + bootProbe.rows );
        test( ! bootProbe.afterReplay,
          "an index the service script adds after build() is built in the replay's bulk load" );

        // A lazy CSpec still loads on its first access, not when it is created.
        seed(dir, "lazy");
        bootProbe = newProbe();
        CSpec lazySpec = new CSpec();
        lazySpec.setX(tx);
        lazySpec.setName("indexBeforeReplayLazyDAO");
        lazySpec.setCSpecDAO(cSpecDAO);
        lazySpec.setServiceScript(spec.getServiceScript().replace("\\"boot\\"", "\\"lazy\\""));
        cSpecDAO.put(lazySpec);

        DAO lazy = (DAO) new CSpecFactory(new ProxyX(tx), lazySpec).create(tx);
        test( bootProbe.bulkLoads == 0, "a lazy DAO is not loaded when its service is created, bulkLoads=" + bootProbe.bulkLoads );
        lazy.find(1L);
        test( bootProbe.bulkLoads == 1 && bootProbe.rows == 3 && ! bootProbe.afterReplay,
          "its first access loads it, with the index in the replay's bulk load, bulkLoads=" + bootProbe.bulkLoads + " rows=" + bootProbe.rows );

        // Dedup replays one put at a time, so its indexes still go on after.
        seed(dir, "dedup");
        ProbeIndex dedupProbe = newProbe();
        EasyDAO dedup = new EasyDAO.Builder(tx)
          .setAuthorize(false)
          .setOf(UnloadableDecoratedRecord.getOwnClassInfo())
          .setJournalType(JournalType.SINGLE_JOURNAL)
          .setJournalName("dedup")
          .setUnloadable(true)
          .setDedup(true)
          .build();
        dedup.addIndex(dedupProbe);
        found = dedup.find(MLang.EQ(UnloadableDecoratedRecord.DATA, "c"));
        test( found != null && dedupProbe.rows == 3,
          "a dedup DAO still builds the index from all 3 rows, rows=" + dedupProbe.rows );
        test( dedupProbe.afterReplay, "a dedup DAO adds the index after the replay" );
      `
    },
    {
      name: 'seed',
      args: 'String dir, String journalName',
      documentation: 'Writes a journal of three rows, so the DAO has something to replay.',
      javaCode: `
        try ( FileWriter w = new FileWriter(new File(dir, journalName + ".0")) ) {
          String[] data = { "a", "b", "c" };
          for ( int i = 0 ; i < data.length ; i++ ) {
            w.write("p({\\"class\\":\\"foam.core.partition.test.UnloadableDecoratedRecord\\",\\"id\\":" + ( i + 1 ) + ",\\"data\\":\\"" + data[i] + "\\"})\\n");
          }
        } catch ( java.io.IOException e ) {
          throw new RuntimeException(e);
        }
      `
    },
    {
      name: 'newProbe',
      javaType: 'ProbeIndex',
      javaCode: `
        return new ProbeIndex(new TreeIndex((Indexer) UnloadableDecoratedRecord.DATA,
          new TreeIndex((Indexer) UnloadableDecoratedRecord.ID, true), false));
      `
    }
  ],

  javaCode: `
    /** Read by the service script, which has no other way to reach the test. */
    public static ProbeIndex bootProbe;

    /** Records each bulkLoad: how many rows, and whether AltIndex.addIndex or
        addIndexes made the call, which they do only for an index added to a
        DAO that already holds its rows. */
    public static class ProbeIndex extends ProxyIndex {
      public int     bulkLoads   = 0;
      public long    rows        = 0;
      public boolean afterReplay = false;

      public ProbeIndex(Index delegate) {
        super(delegate);
      }

      public Object bulkLoad(FObject[] a, int lo, int hi) {
        bulkLoads++;
        rows        = hi - lo + 1;
        afterReplay = StackWalker.getInstance().walk(frames -> frames.anyMatch(f ->
          "foam.dao.index.AltIndex".equals(f.getClassName()) && f.getMethodName().startsWith("addIndex")));
        return getDelegate().bulkLoad(a, lo, hi);
      }
    }
  `
});
