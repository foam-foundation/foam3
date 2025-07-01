/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.store.test',
  name: 'StoreTestModelPerfTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'static foam.mlang.MLang.EQ',
    'static foam.mlang.MLang.COUNT',
    'foam.mlang.sink.Count',
    'foam.core.pm.PM',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.dao.index.*',
    'foam.dao.store.*',
    'foam.lang.X',
    'java.util.ArrayList',
    'java.util.List'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
      int num = 2000;

      Logger logger = Loggers.logger(x, this);
      DAO dao =  getDAO(x);
      PM pm = new PM("StoreTestModelPerfTest-create");
      for ( long i = 1; i <= num; i++ ) {
        StoreTestModel stm = new StoreTestModel();
        String s = String.valueOf(i);
        // stm.setId(i);
        stm.setName(s);
        stm.setData(s);
        stm.setStorageTransientData(s);
        stm = (StoreTestModel) dao.put(stm);

        if ( i % 1000 == 0 ) {
          logger.info("created", i, "of", num);
        }
        // var result = (StoreTestModel) dao.find(stm.getId());
        // if ( result == null ) {
        //   test (false, "M find by id ("+i+") "+stm.getId());
        // }
        // result = (StoreTestModel) dao.find(EQ(StoreTestModel.NAME, stm.getName()));
        // if ( result == null ) {
        //   test (false, "M find by NAME "+stm.getName()+", "+stm.getId());
        // }
      }
      pm.log(x);

      logger.info("created", num, java.time.Duration.ofMillis(pm.getTime()));

      pm = new PM("StoreTestModelPerfTest-load");
      dao =  getDAO(x);
      pm.log(x);
      logger.info("loaded", num, java.time.Duration.ofMillis(pm.getTime()));

      Count count = (Count) dao.select(COUNT());
      test ( count.getValue() == num, "Count correct " +count.getValue() );
      int pass = 0;
      List<StoreTestModel> list = (List) (ArrayList) ((ArraySink) dao.select(new ArraySink())).getArray();
      int i = 1;
      for ( StoreTestModel stm : list ) {
        var result = (StoreTestModel) dao.find(stm.getId());
        if ( result == null ) {
          test (false, "F find by id ("+i+") "+stm.getId());
          result = (StoreTestModel) dao.find(EQ(StoreTestModel.ID, stm.getId()));
          if ( result == null ) {
            test (false, "F find id by EQ(ID) ("+i+") "+stm.getId());
          }
        } else {
          pass += 1;
        }
        result = (StoreTestModel) dao.find(EQ(StoreTestModel.NAME, stm.getName()));
        if ( result == null ) {
          test (false, "F find by EQ(NAME) "+stm.getName()+", "+stm.getId());
        }
        i += 1;
      }

      test ( pass == count.getValue(), "counts match "+pass+"=="+count.getValue());
      `
    },
    {
      name: 'getDAO',
      args: 'Context x',
      javaType: 'foam.dao.DAO',
      javaCode: `
      return new foam.dao.EasyDAO.Builder(x)
      .setOf(foam.dao.store.test.StoreTestModel.getOwnClassInfo())
      .setSeqNo(true)
      .setJournalType(foam.dao.JournalType.STORE)
      .setJournalName("storetestmodels")
      .build()
      .addPropertyIndex(new foam.lang.Indexer[] { foam.dao.store.test.StoreTestModel.ID })
      .addPropertyIndex(new foam.lang.Indexer[] { foam.dao.store.test.StoreTestModel.NAME });
      `
    }
  ]
});
