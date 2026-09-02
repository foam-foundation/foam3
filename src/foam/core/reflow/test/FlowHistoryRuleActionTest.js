/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.test',
  name: 'FlowHistoryRuleActionTest',
  extends: 'foam.core.test.Test',

  documentation: `FlowHistoryRuleAction writes one FlowHistoryRecord per changed
    put into a PartitionedDAO keyed by flow name, a fresh DAO over the same
    files replays only the partition a history query names, and a record is
    readable exactly when its flow is.`,

  javaImports: [
    'foam.core.auth.AuthorizationException',
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.partition.PartitionedDAO',
    'foam.core.reflow.Flow',
    'foam.core.reflow.FlowHistoryRecord',
    'foam.core.reflow.FlowHistoryRuleAction',
    'foam.dao.ArraySink',
    'foam.dao.MDAO',
    'foam.lang.DirectAgency',
    'foam.lang.X',
    'java.io.File',
    'static foam.mlang.MLang.EQ'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        X      tx  = newStorageContext(x);
        String dir = "flowHistoryTest_" + System.nanoTime() + "/";
        PartitionedDAO history = new PartitionedDAO(tx, FlowHistoryRecord.getOwnClassInfo(), dir, FlowHistoryRecord.OBJECT_ID);
        X ax = tx.put("localFlowHistoryDAO", history);

        FlowHistoryRuleAction action = new FlowHistoryRuleAction();
        DirectAgency          agency = new DirectAgency();

        Flow a1 = new Flow();
        a1.setName("Recon A");
        a1.setScript("v1");
        action.applyAction(ax, a1, null, null, null, agency);

        Flow a2 = (Flow) a1.fclone();
        a2.setScript("v2");
        action.applyAction(ax, a2, a1, null, null, agency);

        // Unchanged put: no record.
        action.applyAction(ax, a2, a2, null, null, agency);

        Flow b = new Flow();
        b.setName("Recon B");
        b.setScript("v1");
        action.applyAction(ax, b, null, null, null, agency);

        ArraySink a = (ArraySink) history
          .where(EQ(FlowHistoryRecord.OBJECT_ID, "Recon A"))
          .orderBy(FlowHistoryRecord.ID)
          .select(new ArraySink());
        test(a.getArray().size() == 2, "Recon A has create + one edit, got " + a.getArray().size());

        FlowHistoryRecord create = (FlowHistoryRecord) a.getArray().get(0);
        FlowHistoryRecord edit   = (FlowHistoryRecord) a.getArray().get(1);
        test(create.getUpdates().length == 0, "create record carries no updates");
        test(edit.getUpdates().length == 1 && "script".equals(edit.getUpdates()[0].getName()),
          "edit record names the one changed property");
        test("v1".equals(edit.getUpdates()[0].getOldValue()) && "v2".equals(edit.getUpdates()[0].getNewValue()),
          "edit record carries old and new script");
        test(history.find("Recon A~2") != null, "find routes <flowName>~<seq> to its partition");

        FileSystemStorage fs = (FileSystemStorage) tx.get(FileSystemStorage.class);
        test(fs.get(dir + "Recon A").exists() && fs.get(dir + "Recon B").exists(), "one journal file per flow");

        // Fresh DAO over the same files: a history query loads its own partition only.
        PartitionedDAO fresh = new PartitionedDAO(tx, FlowHistoryRecord.getOwnClassInfo(), dir, FlowHistoryRecord.OBJECT_ID);
        ArraySink again = (ArraySink) fresh
          .where(EQ(FlowHistoryRecord.OBJECT_ID, "Recon A"))
          .select(new ArraySink());
        test(again.getArray().size() == 2, "replayed partition holds both Recon A records, got " + again.getArray().size());
        test(fresh.isLoaded("Recon A") && ! fresh.isLoaded("Recon B"), "only the queried flow's partition is loaded");

        // A record is readable exactly when its flow is findable through flowDAO in the caller's context.
        MDAO flows = new MDAO(Flow.getOwnClassInfo());
        flows.put(a2);
        X rx = tx.put("flowDAO", flows);
        FlowHistoryRecord ofB = (FlowHistoryRecord) history.find("Recon B~1");
        test(canRead(rx, edit), "record readable when its flow is");
        test(! canRead(rx, ofB), "record hidden when its flow is not");
        boolean createDenied = false;
        try { edit.authorizeOnCreate(rx); } catch ( AuthorizationException e ) { createDenied = true; }
        test(createDenied, "clients cannot create history records");
      `
    },
    {
      name: 'canRead',
      args: 'X x, FlowHistoryRecord record',
      type: 'boolean',
      javaCode: `
        try {
          record.authorizeOnRead(x);
          return true;
        } catch ( AuthorizationException e ) {
          return false;
        }
      `
    },
    {
      name: 'newStorageContext',
      args: 'X x',
      type: 'X',
      documentation: 'Sub-context with a temp-dir FileSystemStorage so journals stay out of the runtime journals dir.',
      javaCode: `
        String dir = System.getProperty("java.io.tmpdir") + File.separator
          + "flowhistory_" + System.nanoTime();
        new File(dir).mkdirs();
        FileSystemStorage fs = new FileSystemStorage(dir);
        return x.put(Storage.class, fs).put(FileSystemStorage.class, fs);
      `
    }
  ]
});
