/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'PartitionLoadStatusIntegrationTest',
  extends: 'foam.core.test.Test',

  documentation: 'End-to-end createDAO path with a listener capturing row lifecycle: PartitionedDAO and NotPartitionedDAO each publish/remove a status row per partition/journal they create, and republish across an explicit UNLOAD_CMD + reload.',

  javaImports: [
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.partition.AbstractPartitionedDAO',
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
    'java.io.File',
    'java.util.ArrayList',
    'java.util.List'
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
