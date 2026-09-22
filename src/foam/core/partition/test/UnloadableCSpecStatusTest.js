/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'UnloadableCSpecStatusTest',
  extends: 'foam.core.test.Test',

  documentation: 'The CSpec of an unloadable EasyDAO tracks its journal lifecycle: READY once the replay completes, UNLOADED after UNLOAD_CMD, READY again after the reload.',

  javaImports: [
    'foam.core.boot.CSpec',
    'foam.core.boot.CSpecAware',
    'foam.core.boot.CSpecStatus',
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.dao.DAO',
    'foam.dao.EasyDAO',
    'foam.dao.JournalType',
    'foam.dao.MDAO',
    'foam.dao.ProxyDAO',
    'foam.lang.ContextAware',
    'foam.lang.X',
    'java.io.File',
    'java.io.FileWriter'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        String dir = System.getProperty("java.io.tmpdir") + File.separator
          + "unloadablestatus_" + System.nanoTime();
        new File(dir).mkdirs();
        FileSystemStorage fs = new FileSystemStorage(dir);

        String journalName = "unloadableStatus";
        try ( FileWriter w = new FileWriter(new File(dir, journalName + ".0")) ) {
          w.write("p({\\"class\\":\\"foam.core.partition.test.UnloadableDecoratedRecord\\",\\"id\\":1,\\"data\\":\\"seed\\"})\\n");
        }

        X plainX = x.put(Storage.class, fs).put(FileSystemStorage.class, fs);

        DAO cSpecDAO = new MDAO(CSpec.getOwnClassInfo());
        CSpec spec = new CSpec();
        spec.setX(plainX);
        spec.setName("unloadableStatusDAO");
        spec.setCSpecDAO(cSpecDAO);
        cSpecDAO.put(spec);
        X cspecX = plainX.put(CSpec.class, spec).put(CSpec.CSPEC_CTX_KEY, spec);

        DAO dao = new EasyDAO.Builder(cspecX)
          .setAuthorize(false)
          .setOf(UnloadableDecoratedRecord.getOwnClassInfo())
          .setJournalType(JournalType.SINGLE_JOURNAL)
          .setJournalName(journalName)
          .setUnloadable(true)
          .build();

        // What CSpecFactory.initService does to a freshly built service: reset
        // every ContextAware in the ProxyDAO chain to the boot context and bind
        // the CSpec by property. The CSpec is lazy, so nothing has replayed yet.
        Object ns = dao;
        while ( ns != null ) {
          if ( ns instanceof ContextAware ) ((ContextAware) ns).setX(plainX);
          if ( ns instanceof CSpecAware && ((CSpecAware) ns).getCSpec() == null ) ((CSpecAware) ns).setCSpec(spec);
          ns = ns instanceof ProxyDAO ? ((ProxyDAO) ns).getDelegate() : null;
        }

        dao.find_(plainX, 1L);
        CSpec after = (CSpec) cSpecDAO.find(spec.getName());
        test( after.getStatus() == CSpecStatus.READY,
          "READY after the first-access replay completes, got " + after.getStatus() );
        test( after.getMessage().contains("complete," + journalName + ".0"),
          "replay completion recorded in the message" );

        dao.cmd_(plainX, foam.core.partition.AbstractPartitionedDAO.UNLOAD_CMD);
        after = (CSpec) cSpecDAO.find(spec.getName());
        test( after.getStatus() == CSpecStatus.UNLOADED,
          "UNLOADED after UNLOAD_CMD, got " + after.getStatus() );

        dao.find_(plainX, 1L);
        after = (CSpec) cSpecDAO.find(spec.getName());
        test( after.getStatus() == CSpecStatus.READY,
          "READY again after the reload replays, got " + after.getStatus() );
      `
    }
  ]
});
