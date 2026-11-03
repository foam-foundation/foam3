/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'PartitionedDAOUnprefixedFindTest',
  extends: 'foam.core.test.Test',

  documentation: `A find on an id with no partition segment, such as the empty
    id of a record not yet put, returns null and opens no partition.`,

  javaImports: [
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.partition.PartitionedDAO',
    'foam.lang.X',
    'java.io.File',
    'java.util.Arrays'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        X tx = newStorageContext(x);
        PartitionedDAO dao = new PartitionedDAO(
          tx, PartitionStrRecord.getOwnClassInfo(), "prtUnprefixed" + System.nanoTime() + "/",
          PartitionStrRecord.BUCKET);

        PartitionStrRecord a = new PartitionStrRecord(); a.setBucket(5); a.setData("a");
        a = (PartitionStrRecord) dao.put(a);

        test(dao.find("") == null, "find on the empty id returns null");
        test(dao.find("abc") == null, "find on an id with no partition segment returns null");
        test(dao.find(a.getId()) != null, "find on a composite id still finds the record");

        String[] parts = dao.getPartitions();
        test(Arrays.equals(parts, new String[] { "5" }),
          "only the partition that was written exists, got " + Arrays.toString(parts));
      `
    },
    {
      name: 'newStorageContext',
      args: 'X x',
      type: 'X',
      documentation: 'Sub-context with a temp-dir FileSystemStorage so journals stay out of the runtime journals dir.',
      javaCode: `
        String dir = System.getProperty("java.io.tmpdir") + File.separator
          + "prtunprefixed_" + System.nanoTime();
        new File(dir).mkdirs();
        FileSystemStorage fs = new FileSystemStorage(dir);
        return x.put(Storage.class, fs).put(FileSystemStorage.class, fs);
      `
    }
  ]
});
