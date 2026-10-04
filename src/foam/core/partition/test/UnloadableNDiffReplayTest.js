/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'UnloadableNDiffReplayTest',
  extends: 'foam.core.test.Test',

  documentation: 'An unloadable, ndiff-enabled EasyDAO whose CSpec is lazy replays its .0 journal on first access, after CSpecFactory.initService has reset every DAO in its chain to the bare boot context. The rebuilt JDAO must still find the CSpec and record an NDiff for each seed row.',

  javaImports: [
    'foam.core.boot.CSpec',
    'foam.core.boot.CSpecAware',
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.ndiff.NDiff',
    'foam.core.ndiff.NDiffId',
    'foam.dao.DAO',
    'foam.dao.EasyDAO',
    'foam.dao.JournalType',
    'foam.dao.MDAO',
    'foam.dao.ProxyDAO',
    'foam.lang.ContextAware',
    'foam.lang.FObject',
    'foam.lang.X',
    'java.io.File',
    'java.io.FileWriter'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        String dir = System.getProperty("java.io.tmpdir") + File.separator
          + "unloadablendiff_" + System.nanoTime();
        new File(dir).mkdirs();
        FileSystemStorage fs = new FileSystemStorage(dir);

        String journalName = "unloadableNdiff";
        try ( FileWriter w = new FileWriter(new File(dir, journalName + ".0")) ) {
          w.write("p({\\"class\\":\\"foam.core.partition.test.UnloadableDecoratedRecord\\",\\"id\\":1,\\"data\\":\\"seed\\"})\\n");
        }

        DAO ndiffDAO = new MDAO(NDiff.getOwnClassInfo());
        X plainX = x.put(Storage.class, fs).put(FileSystemStorage.class, fs).put("ndiffDAO", ndiffDAO);

        CSpec spec = new CSpec();
        spec.setName("unloadableNdiffDAO");
        X cspecX = plainX.put(CSpec.class, spec).put(CSpec.CSPEC_CTX_KEY, spec);

        DAO dao = new EasyDAO.Builder(cspecX)
          .setAuthorize(false)
          .setOf(UnloadableDecoratedRecord.getOwnClassInfo())
          .setJournalType(JournalType.SINGLE_JOURNAL)
          .setJournalName(journalName)
          .setUnloadable(true)
          .setNdiff(true)
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

        FObject seed = dao.find_(plainX, 1L);
        test( seed != null && "seed".equals(UnloadableDecoratedRecord.DATA.get(seed)),
          "seed row replayed from the .0 journal on first access" );

        NDiff ndiff = (NDiff) ndiffDAO.find(new NDiffId(spec.getName(), "1"));
        test( ndiff != null,
          "NDiff recorded for the seed row: the JDAO rebuilt after the context reset still wrapped the journals in NDiffJournal" );
        test( ndiff != null && "seed".equals(UnloadableDecoratedRecord.DATA.get(ndiff.getInitialFObject())),
          "NDiff initialFObject is the .0 copy of the row" );
      `
    }
  ]
});
