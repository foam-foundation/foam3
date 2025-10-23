/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.logger',
  name: 'LoggerJDAO',
  extends: 'foam.dao.java.JDAO',

  documentation: `Only write to underlying JDAO if not PRODUCTION mode`,

  javaImports: [
    'foam.dao.MDAO'
  ],

  javaCode: `
    public LoggerJDAO(foam.lang.X x, foam.dao.DAO delegate, foam.lang.ClassInfo classInfo, String filename) {
      setX(x);
      setOf(classInfo);
      setFilename(filename);
      setDelegate(delegate);

      // create journal
      var y = x.put(foam.core.fs.Storage.class, x.get(foam.core.fs.FileSystemStorage.class));
      setJournal(new foam.core.logger.LoggerJournal.Builder(y)
        .setFilename(filename)
        .setCreateFile(true)
        .setDao(getDelegate())
        .setLogger(new foam.core.logger.PrefixLogger(new Object[] { "LoggerJDAO", filename }, foam.core.logger.StdoutLogger.instance()))
        .build());
    }
  `,

  properties: [
    {
      documentation: `Overwrite JDAO delegate to make javaPostSet a noop so when class is decorated by PipelinePMDAO the parent JDAO javaPostSet, which again calculates the 'journal' is not run.`,
      name: 'delegate',
      class: 'foam.dao.DAOProperty',
      javaFactory: 'return new MDAO(getOf());',
      javaPostSet: ' // noop'
    }
  ],

  methods: [
    {
      documentation: `Override JDAO removeAll which will remove all from journal, then mdao. We only want the mdao to be purged.`,
      name: 'removeAll_',
      javaCode: `
        getDelegate().select_(x, new foam.dao.RemoveSink(x, getDelegate()), skip, limit, order, predicate);
      `
    }
  ]
});
