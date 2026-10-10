/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'TwoLevelUnsetIdTest',
  extends: 'foam.core.test.Test',

  documentation: `A String-id record put with no id through two partition
    levels gets a distinct <a>~<b>~<seqNo> id per row. Before the fix the
    second level re-appended the first level's key as the sequence segment and
    every row of a leaf collapsed onto one id.`,

  javaImports: [
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.partition.PartitionedDAO',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.mlang.sink.Count',
    'java.io.File',
    'java.util.HashSet',
    'java.util.Set',
    'static foam.mlang.MLang.COUNT'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        X tx = newStorageContext(x);
        TwoLevelPartitionedDAO dao = new TwoLevelPartitionedDAO(
          tx, PartitionStrRecord.getOwnClassInfo(), "unset" + System.nanoTime() + "/",
          PartitionStrRecord.REGION, PartitionStrRecord.BUCKET);

        Set<String> ids = new HashSet<>();
        for ( int i = 0 ; i < 3 ; i++ ) {
          PartitionStrRecord r = new PartitionStrRecord();
          r.setRegion(1); r.setBucket(5); r.setData("d" + i);
          ids.add((String) PartitionStrRecord.ID.get(dao.put(r)));
        }

        DAO leaf = ((PartitionedDAO) dao.getDelegate("1")).getDelegate("5");
        long count = ((Count) leaf.select(COUNT())).getValue();
        test(count == 3, "three unset-id rows land as three rows in leaf 1~5, got " + count);
        test(ids.size() == 3, "three distinct ids, got " + ids);
        test(ids.contains("1" + PartitionedDAO.SEPARATOR + "5" + PartitionedDAO.SEPARATOR + "1"),
          "ids are <region>~<bucket>~<seqNo>, got " + ids);

        FObject found = dao.find("1" + PartitionedDAO.SEPARATOR + "5" + PartitionedDAO.SEPARATOR + "2");
        test(found != null && "d1".equals(PartitionStrRecord.DATA.get(found)),
          "find_ routes the stamped id back to its row");

        // Single level: an unset id still becomes <bucket>~<seqNo>.
        PartitionedDAO single = new PartitionedDAO(
          tx, PartitionStrRecord.getOwnClassInfo(), "unset1" + System.nanoTime() + "/",
          PartitionStrRecord.BUCKET);
        PartitionStrRecord s = new PartitionStrRecord(); s.setBucket(7);
        String sid = (String) PartitionStrRecord.ID.get(single.put(s));
        test(("7" + PartitionedDAO.SEPARATOR + "1").equals(sid), "single level stamps 7~1, got " + sid);
      `
    },
    {
      name: 'newStorageContext',
      args: 'X x',
      type: 'X',
      javaCode: `
        String dir = System.getProperty("java.io.tmpdir") + File.separator + "unsetid_" + System.nanoTime();
        new File(dir).mkdirs();
        FileSystemStorage fs = new FileSystemStorage(dir);
        return x.put(Storage.class, fs).put(FileSystemStorage.class, fs);
      `
    }
  ]
});
