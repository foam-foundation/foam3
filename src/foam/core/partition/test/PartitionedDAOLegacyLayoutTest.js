/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'PartitionedDAOLegacyLayoutTest',
  extends: 'foam.core.test.Test',

  documentation: `An old-layout partition journal is moved into the partition's
    directory on first load and replays without operator intervention.`,

  javaImports: [
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.partition.PartitionedDAO',
    'foam.dao.DAO',
    'foam.dao.java.JDAO',
    'foam.lang.X',
    'java.io.File'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        String root = System.getProperty("java.io.tmpdir") + File.separator
          + "partition_legacy_layout_" + System.nanoTime();
        FileSystemStorage fs = new FileSystemStorage(root);
        X tx = x.put(Storage.class, fs).put(FileSystemStorage.class, fs);

        String dir  = "legacyPartitions/";
        String part = "7";
        String id   = part + PartitionedDAO.SEPARATOR + "1";

        fs.get(dir).mkdirs();
        DAO legacy = new JDAO(tx, PartitionStrRecord.getOwnClassInfo(), dir + part);
        PartitionStrRecord record = new PartitionStrRecord();
        record.setId(id);
        record.setBucket(7);
        record.setData("preserved");
        legacy.put(record);

        File legacyFile = fs.get(dir + part);
        test(legacyFile.isFile(), "old-layout partition starts as a file");

        PartitionedDAO dao = new PartitionedDAO(
          tx, PartitionStrRecord.getOwnClassInfo(), dir, PartitionStrRecord.BUCKET);
        PartitionStrRecord loaded = (PartitionStrRecord) dao.getDelegate(part).find(id);

        test(fs.get(dir + part).isDirectory(), "partition path is migrated to a directory");
        test(fs.get(dir + part + "/" + PartitionedDAO.PART_JOURNAL).isFile(),
          "legacy journal is retained under the fixed journal name");
        test(loaded != null && "preserved".equals(loaded.getData()),
          "legacy journal record replays after migration");
      `
    }
  ]
});
