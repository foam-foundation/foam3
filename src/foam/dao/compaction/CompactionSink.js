/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.compaction',
  name: 'CompactionSink',
  extends: 'foam.dao.ProxySink',

  documentation: 'Find CompactionSink Facet for nspec dao of',

  javaImports: [
    'foam.lang.ClassInfo',
    'foam.lang.ContextAware',
    'foam.lang.X',
    'foam.lang.FacetManager',
    'foam.dao.DAO',
    'foam.dao.ProxySink',
    'foam.dao.Sink',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers'
  ],

  javaCode: `
    public CompactionSink(X x, String serviceName, Sink delegate) {
      super(x, delegate);
      setServiceName(serviceName);
      setSink(getFacetedSink(x));
    }
  `,

  properties: [
    {
      name: 'serviceName',
      class: 'String'
    },
    {
      name: 'sink',
      class: 'Object'
    },
    {
      name: 'isEof',
      class: 'Boolean'
    }
  ],

  methods: [
    {
      name: 'put',
      javaCode: `
      ((Sink) getSink()).put(obj, sub);
      `
    },
    {
      name: 'getFacetedSink',
      args: 'X x',
      type: 'Sink',
      javaCode: `
      DAO dao = (DAO) x.get(getServiceName());
      Compaction compaction = (Compaction) ((DAO) getX().get("compactionDAO")).find(getServiceName());
      Sink sink = null;
      if ( compaction != null ) {
        sink = (Sink) compaction.getSink();
      }
      if ( sink == null ) {
        try {
          FacetManager fm = (FacetManager) x.get("facetManager");
          sink = (Sink) fm.create(dao.getOf().getId()+"CompactionSink", x);
        } catch (Throwable t) {
          // nop
        }
      }
      if ( sink != null ) {
        if ( sink instanceof ContextAware ) {
          ((ContextAware) sink).setX(x);
        }
        ((ProxySink) sink).setDelegate(getDelegate());
      } else {
        sink = getDelegate();
      }

      ((Logger) x.get("logger")).info("CompactionSink",getServiceName(), "sink",sink.getClass().getName());
      return sink;
      `
    },
    {
      name: 'eof',
      javaCode: 'setIsEof(true);'
    }
  ]
});
