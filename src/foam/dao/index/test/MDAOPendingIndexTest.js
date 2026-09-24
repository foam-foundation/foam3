/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.index.test',
  name: 'MDAOPendingIndexTest',
  extends: 'foam.core.test.Test',

  documentation: `An index added to an MDAO that already holds rows waits, and
    every index waiting is built in one pass by LOAD_CMD or by the next read
    or write. A service script adds its indexes after build() has loaded the
    journal, so CSpecFactory's LOAD_CMD builds them all once the script has
    returned.`,

  javaImports: [
    'foam.core.boot.CSpec',
    'foam.core.boot.CSpecFactory',
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.dao.index.Index',
    'foam.dao.index.ProxyIndex',
    'foam.dao.index.TreeIndex',
    'foam.lang.FObject',
    'foam.lang.Indexer',
    'foam.lang.ProxyX',
    'foam.lang.X',
    'foam.mlang.MLang',
    'foam.mlang.sink.Count',
    'java.io.File',
    'java.io.FileWriter'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        // LOAD_CMD builds every index added since the MDAO filled.
        MDAO mdao = filled();
        ProbeIndex byGroup = newProbe(IndexKeyRecord.GROUP_ID);
        ProbeIndex byName  = newProbe(IndexKeyRecord.NAME);
        mdao.addIndex(byGroup);
        mdao.addIndex(byName);
        test( byGroup.bulkLoads == 0 && byName.bulkLoads == 0,
          "indexes added to an MDAO that holds rows wait" );
        mdao.cmd(DAO.LOAD_CMD);
        test( byGroup.bulkLoads == 1 && byGroup.rows == 3 && byName.bulkLoads == 1 && byName.rows == 3,
          "LOAD_CMD builds both from all 3 rows, bulkLoads=" + byGroup.bulkLoads + "," + byName.bulkLoads );
        test( mdao.getIndexCount() == 3, "the MDAO holds 3 indexes, count=" + mdao.getIndexCount() );

        // Without LOAD_CMD, the first read builds them.
        mdao = filled();
        byGroup = newProbe(IndexKeyRecord.GROUP_ID);
        mdao.addIndex(byGroup);
        long n = ((Number) ((Count) mdao.where(MLang.EQ(IndexKeyRecord.GROUP_ID, 7L)).select(new Count())).getValue()).longValue();
        test( byGroup.bulkLoads == 1 && byGroup.rows == 3, "the first read builds a waiting index, bulkLoads=" + byGroup.bulkLoads );
        test( n == 2, "the query it answers is right, count=" + n );

        // A service script adds its indexes after build() has loaded the
        // journal; they are built once the script has returned.
        String dir = System.getProperty("java.io.tmpdir") + File.separator + "mdaopending_" + System.nanoTime();
        new File(dir).mkdirs();
        FileSystemStorage fs = new FileSystemStorage(dir);
        X tx = x.put(Storage.class, fs).put(FileSystemStorage.class, fs);
        seed(dir, "boot");
        seed(dir, "lazy");

        DAO cSpecDAO = new MDAO(CSpec.getOwnClassInfo());
        CSpec spec = newSpec(tx, cSpecDAO, "mdaoPendingBootDAO", "boot");
        spec.setLazy(false);
        cSpecDAO.put(spec);
        resetProbes();
        new CSpecFactory(new ProxyX(tx), spec).create(tx);
        test( groupProbe.bulkLoads == 1 && groupProbe.rows == 3 && nameProbe.bulkLoads == 1 && nameProbe.rows == 3,
          "a lazy:false service builds both indexes from all 3 rows, bulkLoads=" + groupProbe.bulkLoads + "," + nameProbe.bulkLoads );
        test( groupProbe.afterScript && nameProbe.afterScript,
          "both are built after the service script has returned, not one per addIndex call" );

        CSpec lazySpec = newSpec(tx, cSpecDAO, "mdaoPendingLazyDAO", "lazy");
        cSpecDAO.put(lazySpec);
        resetProbes();
        DAO lazy = (DAO) new CSpecFactory(new ProxyX(tx), lazySpec).create(tx);
        test( groupProbe.bulkLoads == 0, "a lazy service leaves its indexes waiting, bulkLoads=" + groupProbe.bulkLoads );
        lazy.find(1L);
        test( groupProbe.bulkLoads == 1 && nameProbe.bulkLoads == 1 && groupProbe.rows == 3,
          "its first access builds them, bulkLoads=" + groupProbe.bulkLoads + "," + nameProbe.bulkLoads );
      `
    },
    {
      name: 'filled',
      type: 'foam.dao.MDAO',
      javaCode: `
        MDAO mdao = new MDAO(IndexKeyRecord.getOwnClassInfo());
        long[] groups = { 7, 7, 8 };
        for ( int i = 0 ; i < groups.length ; i++ ) {
          IndexKeyRecord r = new IndexKeyRecord();
          r.setId(i + 1);
          r.setGroupId(groups[i]);
          r.setName("n" + i);
          mdao.put(r);
        }
        return mdao;
      `
    },
    {
      name: 'seed',
      args: 'String dir, String journalName',
      documentation: 'Writes a journal of three rows, so the DAO has something to replay.',
      javaCode: `
        try ( FileWriter w = new FileWriter(new File(dir, journalName + ".0")) ) {
          for ( int i = 1 ; i <= 3 ; i++ ) {
            w.write("p({\\"class\\":\\"foam.dao.index.test.IndexKeyRecord\\",\\"id\\":" + i + ",\\"groupId\\":7,\\"name\\":\\"n" + i + "\\"})\\n");
          }
        } catch ( java.io.IOException e ) {
          throw new RuntimeException(e);
        }
      `
    },
    {
      name: 'newSpec',
      args: 'X x, DAO cSpecDAO, String name, String journalName',
      type: 'foam.core.boot.CSpec',
      javaCode: `
        CSpec spec = new CSpec();
        spec.setX(x);
        spec.setName(name);
        spec.setCSpecDAO(cSpecDAO);
        spec.setServiceScript(
          "dao = new foam.dao.EasyDAO.Builder(x)" +
          ".setAuthorize(false)" +
          ".setOf(foam.dao.index.test.IndexKeyRecord.getOwnClassInfo())" +
          ".setJournalType(foam.dao.JournalType.SINGLE_JOURNAL)" +
          ".setJournalName(\\"" + journalName + "\\")" +
          ".build()" +
          ".addIndex(foam.dao.index.test.MDAOPendingIndexTest.groupProbe)" +
          ".addIndex(foam.dao.index.test.MDAOPendingIndexTest.nameProbe);" +
          "foam.dao.index.test.MDAOPendingIndexTest.scriptDone = true;" +
          "return dao;");
        return spec;
      `
    },
    {
      name: 'resetProbes',
      javaCode: `
        groupProbe = newProbe(IndexKeyRecord.GROUP_ID);
        nameProbe  = newProbe(IndexKeyRecord.NAME);
        scriptDone = false;
      `
    },
    {
      name: 'newProbe',
      args: 'foam.lang.PropertyInfo prop',
      javaType: 'ProbeIndex',
      javaCode: `
        return new ProbeIndex(new TreeIndex((Indexer) prop,
          new TreeIndex((Indexer) IndexKeyRecord.ID, true), false));
      `
    }
  ],

  javaCode: `
    /** Read by the service script, which has no other way to reach the test. */
    public static ProbeIndex groupProbe;
    public static ProbeIndex nameProbe;

    /** Set by the service script after its last addIndex. */
    public static volatile boolean scriptDone;

    /** Records each bulkLoad: how many rows, and whether the service script
        had returned by then. */
    public static class ProbeIndex extends ProxyIndex {
      public int     bulkLoads   = 0;
      public long    rows        = 0;
      public boolean afterScript = false;

      public ProbeIndex(Index delegate) {
        super(delegate);
      }

      public Object bulkLoad(FObject[] a, int lo, int hi) {
        bulkLoads++;
        rows        = hi - lo + 1;
        afterScript = scriptDone;
        return getDelegate().bulkLoad(a, lo, hi);
      }
    }
  `
});
