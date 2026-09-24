/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.test',
  name: 'EasyDAOPropertyIndexesTest',
  extends: 'foam.core.test.Test',

  documentation: `A service script calls addPropertyIndex after build(), before
    anything reads the DAO. The index is in the MDAO before the journal
    replays into it, so the replay's bulk load builds it. Covers a journalled
    DAO, an unloadable one and its reload, a dedup one, one with no journal,
    and an index added after first use.`,

  javaImports: [
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.partition.AbstractPartitionedDAO',
    'foam.dao.EasyDAO',
    'foam.dao.JournalType',
    'foam.dao.MDAO',
    'foam.dao.index.test.IndexKeyRecord',
    'foam.lang.Indexer',
    'foam.lang.PropertyInfo',
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
        String dir = System.getProperty("java.io.tmpdir") + File.separator + "easydaopropertyindexes_" + System.nanoTime();
        new File(dir).mkdirs();
        FileSystemStorage fs = new FileSystemStorage(dir);
        X tx = x.put(Storage.class, fs).put(FileSystemStorage.class, fs);

        // A journalled DAO: the replay builds the index.
        seed(dir, "journalled");
        ProbeIndexer probe = new ProbeIndexer(IndexKeyRecord.NAME);
        EasyDAO dao = build(tx, "journalled", probe, false, false);
        test( count(dao) == 2, "the index answers its query, count=" + count(dao) );
        test( probe.built && ! probe.afterReplay, "a journalled DAO builds the index in the replay's bulk load" );
        test( ((MDAO) dao.getMdao()).getIndexCount() == 3, "the MDAO holds both indexes, count=" + ((MDAO) dao.getMdao()).getIndexCount() );

        // An unloadable DAO: its first access and every reload build it.
        seed(dir, "unloadable");
        probe = new ProbeIndexer(IndexKeyRecord.NAME);
        dao = build(tx, "unloadable", probe, true, false);
        test( count(dao) == 2 && probe.built && ! probe.afterReplay,
          "an unloadable DAO builds the index in the replay's bulk load" );
        dao.cmd(AbstractPartitionedDAO.UNLOAD_CMD);
        probe.built = false;
        test( count(dao) == 2 && probe.built && ! probe.afterReplay,
          "its reload builds the index in the replay's bulk load again" );
        test( ((MDAO) dao.getMdao()).getIndexCount() == 3, "the reloaded MDAO holds both indexes, count=" + ((MDAO) dao.getMdao()).getIndexCount() );

        // DeDupDAO sits outside the journal, so a dedup DAO replays the same way.
        seed(dir, "dedup");
        probe = new ProbeIndexer(IndexKeyRecord.NAME);
        dao = build(tx, "dedup", probe, false, true);
        test( count(dao) == 2 && probe.built && ! probe.afterReplay, "a dedup DAO builds the index in the replay's bulk load" );

        // No journal: the index is there for the first put.
        probe = new ProbeIndexer(IndexKeyRecord.NAME);
        dao = new EasyDAO.Builder(tx)
          .setAuthorize(false)
          .setOf(IndexKeyRecord.getOwnClassInfo())
          .build()
          .addPropertyIndex(new Indexer[] { probe })
          .addPropertyIndex(new Indexer[] { IndexKeyRecord.GROUP_ID });
        for ( int i = 1 ; i <= 3 ; i++ ) dao.put(record(i));
        test( ((MDAO) dao.getMdao()).getIndexCount() == 3 && count(dao) == 2,
          "a DAO with no journal holds both indexes, count=" + ((MDAO) dao.getMdao()).getIndexCount() );

        // After first use the rows are in, so the index is built from them.
        seed(dir, "late");
        probe = new ProbeIndexer(IndexKeyRecord.NAME);
        dao = build(tx, "late", new ProbeIndexer(IndexKeyRecord.NAME), false, false);
        count(dao);
        dao.addPropertyIndex(new Indexer[] { probe });
        test( probe.built && probe.afterReplay && ((MDAO) dao.getMdao()).getIndexCount() == 4,
          "an index added after first use is built from the loaded rows, count=" + ((MDAO) dao.getMdao()).getIndexCount() );
      `
    },
    {
      name: 'build',
      args: 'X x, String journalName, ProbeIndexer probe, boolean unloadable, boolean dedup',
      javaType: 'EasyDAO',
      documentation: 'Built the way a service script builds one: addPropertyIndex after build().',
      javaCode: `
        return new EasyDAO.Builder(x)
          .setAuthorize(false)
          .setOf(IndexKeyRecord.getOwnClassInfo())
          .setJournalType(JournalType.SINGLE_JOURNAL)
          .setJournalName(journalName)
          .setUnloadable(unloadable)
          .setDedup(dedup)
          .build()
          .addPropertyIndex(new Indexer[] { probe })
          .addPropertyIndex(new Indexer[] { IndexKeyRecord.GROUP_ID });
      `
    },
    {
      name: 'count',
      args: 'EasyDAO dao',
      type: 'Long',
      javaCode: `
        return ((Number) ((Count) dao.where(MLang.EQ(IndexKeyRecord.GROUP_ID, 7L)).select(new Count())).getValue()).longValue();
      `
    },
    {
      name: 'record',
      args: 'int i',
      javaType: 'IndexKeyRecord',
      javaCode: `
        IndexKeyRecord r = new IndexKeyRecord();
        r.setId(i);
        r.setGroupId(i < 3 ? 7 : 8);
        r.setName("n" + i);
        return r;
      `
    },
    {
      name: 'seed',
      args: 'String dir, String journalName',
      documentation: 'Writes a journal of three rows, two in group 7, so the DAO has something to replay.',
      javaCode: `
        try ( FileWriter w = new FileWriter(new File(dir, journalName + ".0")) ) {
          for ( int i = 1 ; i <= 3 ; i++ ) {
            w.write("p({\\"class\\":\\"foam.dao.index.test.IndexKeyRecord\\",\\"id\\":" + i + ",\\"groupId\\":" + ( i < 3 ? 7 : 8 ) + ",\\"name\\":\\"n" + i + "\\"})\\n");
          }
        } catch ( java.io.IOException e ) {
          throw new RuntimeException(e);
        }
      `
    }
  ],

  javaCode: `
    /** An Indexer over a property that records the comparisons its index
        makes: whether any happened, and whether AltIndex.addIndex made one,
        which it does only for an index added to a DAO that already holds its
        rows. */
    public static class ProbeIndexer implements Indexer {
      public final    PropertyInfo prop;
      public volatile boolean      built       = false;
      public volatile boolean      afterReplay = false;

      public ProbeIndexer(PropertyInfo prop) {
        this.prop = prop;
      }

      public Object f(Object o) {
        return prop.f(o);
      }

      public int comparePropertyToValue(Object key, Object value) {
        return prop.comparePropertyToValue(key, value);
      }

      public int compare(Object o1, Object o2) {
        built = true;
        if ( StackWalker.getInstance().walk(frames -> frames.anyMatch(f ->
          "foam.dao.index.AltIndex".equals(f.getClassName()) && "addIndex".equals(f.getMethodName()))) ) {
          afterReplay = true;
        }
        return prop.compare(o1, o2);
      }
    }
  `
});
