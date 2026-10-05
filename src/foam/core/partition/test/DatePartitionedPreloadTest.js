/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'DatePartitionedPreloadTest',
  extends: 'foam.core.test.Test',

  documentation: `With preload set, start() opens every partition the default
    query window covers and nothing outside it; without it, start() opens
    none. A partition outside the window still opens on its first touch.`,

  javaImports: [
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.partition.DatePartitionedDAO',
    'foam.core.partition.DatePartitioningScheme',
    'foam.lang.X',
    'foam.mlang.Expr',
    'java.io.File',
    'java.util.Date'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        X tx = newStorageContext(x);

        DatePartitionedDAO dao = new DatePartitionedDAO(
          tx, PartitionStrRecord.getOwnClassInfo(), "dpdPreload" + System.nanoTime() + "_",
          (Expr) PartitionStrRecord.DATE, DatePartitioningScheme.YYYYWW);
        dao.setTimeWindow(14);

        String[] window = dao.getPartitions(dao.extractPredicateRange(null));
        test(window.length >= 3 && window.length <= 4,
          "a 14-day window spans 3 or 4 weekly partitions, got " + window.length);

        // Default: start() is a no-op, the window stays unopened.
        dao.start();
        test(loadedCount(dao, window) == 0, "without preload start() opens nothing, got " + loadedCount(dao, window));

        // Configured: start() opens exactly the window.
        dao.setPreload(true);
        dao.start();
        test(loadedCount(dao, window) == window.length,
          "with preload start() opens every window partition, got " + loadedCount(dao, window) + " of " + window.length);

        PartitionStrRecord old = new PartitionStrRecord();
        old.setDate(new Date(System.currentTimeMillis() - 60 * DatePartitionedDAO.DAY));
        String older = dao.getPartition(old);
        test(! dao.isLoaded(older), "a partition outside the window is not preloaded: " + older);

        // Outside the window still opens on first touch.
        dao.getDelegate(older);
        test(dao.isLoaded(older), "a partition outside the window opens on its first touch: " + older);
      `
    },
    {
      name: 'loadedCount',
      args: 'DatePartitionedDAO dao, String[] parts',
      type: 'Integer',
      javaCode: `
        int n = 0;
        for ( String p : parts ) if ( dao.isLoaded(p) ) n++;
        return n;
      `
    },
    {
      name: 'newStorageContext',
      args: 'X x',
      type: 'X',
      documentation: 'Sub-context with a temp-dir FileSystemStorage so journals stay out of the runtime journals dir.',
      javaCode: `
        String dir = System.getProperty("java.io.tmpdir") + File.separator
          + "dpdpreload_" + System.nanoTime();
        new File(dir).mkdirs();
        FileSystemStorage fs = new FileSystemStorage(dir);
        return x.put(Storage.class, fs).put(FileSystemStorage.class, fs);
      `
    }
  ]
});
