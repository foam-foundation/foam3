/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'PartitionLoadStatusIntegrationTest',
  extends: 'foam.core.test.Test',

  documentation: 'End-to-end createDAO path with a listener capturing row lifecycle: PartitionedDAO and NotPartitionedDAO each publish/remove a status row per partition/journal they create, and republish across an explicit UNLOAD_CMD + reload. Also covers DatePartitionedDAO.select_: a range select over previously-unloaded partitions publishes a queued row per partition before its delegate loads, each queued row is overwritten (not duplicated) once its load starts, all are gone once the select completes, and a repeat select over now-warm partitions publishes nothing.',

  javaImports: [
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.partition.AbstractPartitionedDAO',
    'foam.core.partition.DatePartitionedDAO',
    'foam.core.partition.NotPartitionedDAO',
    'foam.core.partition.PartitionedDAO',
    'foam.core.partition.PartitionLoadStatus',
    'foam.core.partition.test.PartitionStrRecord',
    'foam.dao.AbstractSink',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.lang.Detachable',
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.mlang.predicate.Predicate',
    'java.io.File',
    'java.util.ArrayList',
    'java.util.Calendar',
    'java.util.Date',
    'java.util.HashSet',
    'java.util.List',
    'java.util.Set',
    'static foam.mlang.MLang.AND',
    'static foam.mlang.MLang.GTE',
    'static foam.mlang.MLang.LTE'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        final List<PartitionLoadStatus> puts    = new ArrayList<>();
        final List<Object>              removes = new ArrayList<>();

        DAO status = new MDAO(PartitionLoadStatus.getOwnClassInfo());
        status.listen(new AbstractSink() {
          public void put(Object obj, Detachable sub)    { puts.add((PartitionLoadStatus) ((FObject) obj).fclone()); }
          public void remove(Object obj, Detachable sub) { removes.add(obj); }
        }, null);

        X tx    = newStorageContext(x);
        X testX = tx.put("partitionLoadStatusDAO", status);

        String dir = "partitionLoadIntegTest_" + System.currentTimeMillis() + "/";
        PartitionedDAO pdao = new PartitionedDAO(
          testX,
          PartitionStrRecord.getOwnClassInfo(),
          dir,
          PartitionStrRecord.BUCKET);
        pdao.setServiceName("integSvc");

        // Seed two partitions (creates them: first load reports on empty/absent journals too)
        PartitionStrRecord a = new PartitionStrRecord();
        a.setId("a1"); a.setBucket(5);
        pdao.put(a);
        PartitionStrRecord b = new PartitionStrRecord();
        b.setId("b1"); b.setBucket(9);
        pdao.put(b);

        int putsAfterSeed = puts.size();
        test(putsAfterSeed >= 2, "each partition creation published at least one status row");
        test(removes.size() >= 2, "each load removed its row");
        boolean sawService = false;
        for ( PartitionLoadStatus s : puts ) if ( "integSvc".equals(s.getServiceName()) ) sawService = true;
        test(sawService, "status rows carry the DAO serviceName");
        test(pdao.find("5~a1") != null, "record intact after seeding");

        // Unload evicts all cached partitions; the next find() recreates the
        // partition's DAO from its journal, publishing a status row again.
        Object cmdResult = pdao.cmd(AbstractPartitionedDAO.UNLOAD_CMD);
        test(Boolean.TRUE.equals(cmdResult), "UNLOAD_CMD returns true");

        int putsBeforeReload = puts.size();
        test(pdao.find("5~a1") != null, "record intact after unload + reload");
        test(puts.size() > putsBeforeReload, "reload after UNLOAD_CMD published status rows again");

        // NotPartitionedDAO.createDAO runs the same reporter wrap over the
        // other createDAO path Task 4 wired; exercise its own unload + reload too.
        int putsAfterReload = puts.size();
        String npJournal = "partitionLoadIntegTest_np_" + System.currentTimeMillis();
        NotPartitionedDAO npdao = new NotPartitionedDAO(testX, PartitionStrRecord.getOwnClassInfo(), npJournal);
        npdao.setServiceName("integSvcNP");

        PartitionStrRecord c = new PartitionStrRecord();
        c.setId("c1");
        npdao.put(c);

        int putsAfterNP = puts.size();
        test(putsAfterNP > putsAfterReload, "NotPartitionedDAO creation also published a status row");
        boolean sawNPService = false;
        for ( PartitionLoadStatus s : puts ) if ( "integSvcNP".equals(s.getServiceName()) ) sawNPService = true;
        test(sawNPService, "NotPartitionedDAO status row carries its own serviceName");

        npdao.cmd(AbstractPartitionedDAO.UNLOAD_CMD);
        test(npdao.find("c1") != null, "NotPartitionedDAO record intact after unload + reload");
        test(puts.size() > putsAfterNP, "NotPartitionedDAO reload after UNLOAD_CMD published status rows again");

        // DatePartitionedDAO.select_: a range select over 3 unloaded partitions
        // should publish a queued row per partition ahead of the delegate loop,
        // each overwritten (not duplicated) once its own load starts, and none
        // left once the select completes. A repeat select over the now-warm
        // partitions should publish nothing new.
        String dateDir = "partitionLoadIntegTest_date_" + System.currentTimeMillis() + "/";
        DatePartitionedDAO ddao = new DatePartitionedDAO(
          testX,
          PartitionStrRecord.getOwnClassInfo(),
          dateDir,
          PartitionStrRecord.DATE);
        ddao.setServiceName("dateSvc");

        Calendar cal = Calendar.getInstance();
        cal.clear();
        cal.set(2026, Calendar.JANUARY, 15);
        Date jan = cal.getTime();
        cal.clear();
        cal.set(2026, Calendar.FEBRUARY, 15);
        Date feb = cal.getTime();
        cal.clear();
        cal.set(2026, Calendar.MARCH, 15);
        Date mar = cal.getTime();

        PartitionStrRecord rj = new PartitionStrRecord();
        rj.setId("dj"); rj.setDate(jan);
        ddao.put(rj);
        PartitionStrRecord rf = new PartitionStrRecord();
        rf.setId("df"); rf.setDate(feb);
        ddao.put(rf);
        PartitionStrRecord rm = new PartitionStrRecord();
        rm.setId("dm"); rm.setDate(mar);
        ddao.put(rm);

        // Evict the cache: without this isLoaded() is already true for all
        // three partitions and select_ would never publish a queued row.
        ddao.cmd(AbstractPartitionedDAO.UNLOAD_CMD);

        Predicate rangePred = AND(GTE(PartitionStrRecord.DATE, jan), LTE(PartitionStrRecord.DATE, mar));

        int putsBeforeDateSelect    = puts.size();
        int removesBeforeDateSelect = removes.size();
        ddao.where(rangePred).select(new ArraySink());

        Set<String> dateIds            = new HashSet<>();
        boolean     sawQueued          = false;
        boolean     sawActiveOverwrite = false;
        for ( int i = putsBeforeDateSelect ; i < puts.size() ; i++ ) {
          PartitionLoadStatus s = puts.get(i);
          if ( ! "dateSvc".equals(s.getServiceName()) ) continue;
          dateIds.add(s.getId());
          if ( s.getQueued() ) {
            sawQueued = true;
            test(s.getTotalBytes() >= 0, "queued row carries a non-negative totalBytes");
          } else {
            sawActiveOverwrite = true;
          }
        }
        test(sawQueued, "select_ published at least one queued row ahead of the delegate loop");
        test(sawActiveOverwrite, "a queued row was overwritten by an active (non-queued) put once its load started");
        test(dateIds.size() == 3, "queued-row publish touched exactly the 3 seeded partitions (got " + dateIds.size() + ")");
        test(removes.size() > removesBeforeDateSelect, "each loaded partition removed its row on completion");

        // Warm partitions: repeating the same select must publish nothing new.
        int putsBeforeWarmSelect = puts.size();
        ddao.where(rangePred).select(new ArraySink());
        test(puts.size() == putsBeforeWarmSelect, "warm-partition select published no new status rows");

        ArraySink remaining = (ArraySink) status.select(new ArraySink());
        test(remaining.getArray().size() == 0, "no rows left after loads complete");
      `
    },
    {
      name: 'newStorageContext',
      args: 'X x',
      type: 'X',
      documentation: 'Sub-context with a temp-dir FileSystemStorage so journals are isolated from the real runtime journals dir.',
      javaCode: `
        String dir = System.getProperty("java.io.tmpdir") + File.separator
          + "prlinteg_" + System.nanoTime();
        new File(dir).mkdirs();
        FileSystemStorage fs = new FileSystemStorage(dir);
        return x.put(Storage.class, fs).put(FileSystemStorage.class, fs);
      `
    }
  ]
});
