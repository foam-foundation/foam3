/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'ProxyDAOListenContextTest',
  extends: 'foam.core.test.Test',

  documentation: `ProxyDAO passes the caller's context to its delegate for put_, find_, select_,
    remove_, removeAll_ and cmd_. listen_ must too, or a decorator below the proxy cannot tell
    who is listening. CSpecFactory wraps every served DAO in a ProxyDAO, so without this every
    listen reaches the DAO in the proxy's own context, never the session's.`,

  javaImports: [
    'foam.core.auth.EnabledAwareDummy',
    'foam.lang.Detachable',
    'foam.lang.X',
    'foam.mlang.predicate.Predicate',
    'java.util.ArrayList',
    'java.util.List'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        final List<X> heardIn = new ArrayList<>();
        DAO recorder = new ProxyDAO(x, new MDAO(EnabledAwareDummy.getOwnClassInfo())) {
          @Override
          public void listen_(X lx, Sink sink, Predicate predicate) {
            heardIn.add(lx);
            super.listen_(lx, sink, predicate);
          }
        };
        ProxyDAO proxy  = new ProxyDAO(x, recorder);
        X        caller = x.put("listenCallerMarker", "caller");

        proxy.listen_(caller, new AbstractSink() {
          @Override
          public void put(Object obj, Detachable sub) { }
        }, null);

        test(heardIn.size() == 1, "the delegate's listen_ is called once");
        test(heardIn.size() == 1 && "caller".equals(heardIn.get(0).get("listenCallerMarker")),
          "the delegate's listen_ gets the caller's context, not the proxy's own");
      `
    }
  ]
});
