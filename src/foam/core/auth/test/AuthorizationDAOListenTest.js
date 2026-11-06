/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth.test',
  name: 'AuthorizationDAOListenTest',
  extends: 'foam.core.test.Test',

  documentation: `
    A listener hears only the rows a select would show it.
    Checked for puts and removes, in the listener's own context.
    The listen goes through a ProxyDAO first, as on a served DAO.
  `,

  javaImports: [
    'foam.core.auth.AuthorizationDAO',
    'foam.core.auth.AuthorizationException',
    'foam.core.auth.Authorizer',
    'foam.core.auth.EnabledAwareDummy',
    'foam.dao.AbstractSink',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.dao.ProxyDAO',
    'foam.lang.Detachable',
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.mlang.predicate.Predicate',
    'java.util.ArrayList',
    'java.util.List'
  ],

  methods: [
    {
      name: 'authorizer',
      args: 'boolean globalRead',
      javaType: 'foam.core.auth.Authorizer',
      documentation: 'Only the "reader" may read, and never row 2. globalRead skips the check.',
      javaCode: `
        return new Authorizer() {
          public void authorizeOnCreate(X x, FObject obj) { }
          public void authorizeOnUpdate(X x, FObject oldObj, FObject newObj) { }
          public void authorizeOnDelete(X x, FObject obj) { }
          public void authorizeOnRead(X x, FObject obj) {
            if ( ! "reader".equals(x.get("listenTestCaller")) ) throw new AuthorizationException("not the reader");
            if ( ((Long) obj.getProperty("id")) == 2L ) throw new AuthorizationException("row 2 is hidden");
          }
          public boolean checkGlobalRead(X x, Predicate predicate) { return globalRead; }
          public boolean checkGlobalRemove(X x) { return false; }
        };
      `
    },
    {
      name: 'row',
      args: 'X x, long id',
      javaType: 'foam.lang.FObject',
      javaCode: `return new EnabledAwareDummy.Builder(x).setId(id).setEnabled(true).build();`
    },
    {
      name: 'ids',
      args: 'List rows',
      javaType: 'String',
      javaCode: `
        StringBuilder b = new StringBuilder();
        for ( Object o : rows ) b.append(b.length() == 0 ? "" : ",").append(((FObject) o).getProperty("id"));
        return b.toString();
      `
    },
    {
      name: 'listen',
      args: 'X caller, DAO served, List puts, List removes, Predicate predicate',
      javaCode: `
        served.listen_(caller, new AbstractSink() {
          @Override
          public void put(Object obj, Detachable sub) { puts.add(obj); }
          @Override
          public void remove(Object obj, Detachable sub) { removes.add(obj); }
        }, predicate);
      `
    },
    {
      name: 'runTest',
      javaCode: `
        X reader   = x.put("listenTestCaller", "reader");
        X stranger = x.put("listenTestCaller", "stranger");

        // a served DAO: a ProxyDAO (as CSpecFactory adds) over the AuthorizationDAO over the store
        DAO store  = new MDAO(EnabledAwareDummy.getOwnClassInfo());
        DAO served = new ProxyDAO(x, new AuthorizationDAO(x, store, authorizer(false)));

        List rPuts = new ArrayList(), rRemoves = new ArrayList();
        List sPuts = new ArrayList(), sRemoves = new ArrayList();
        listen(reader,   served, rPuts, rRemoves, null);
        listen(stranger, served, sPuts, sRemoves, null);

        store.put(row(x, 1));
        store.put(row(x, 2));
        store.remove(row(x, 1));
        store.remove(row(x, 2));

        test("1".equals(ids(rPuts)),    "a listener hears only the puts it may read, got " + ids(rPuts));
        test("1".equals(ids(rRemoves)), "and only the removes it may read, got " + ids(rRemoves));
        test(sPuts.isEmpty() && sRemoves.isEmpty(), "a caller who may read nothing hears nothing");

        // a caller's own predicate: a put it does not match comes down as a remove of the whole row
        List fPuts = new ArrayList(), fRemoves = new ArrayList();
        listen(reader, served, fPuts, fRemoves, foam.mlang.MLang.EQ(EnabledAwareDummy.ENABLED, true));
        store.put(new EnabledAwareDummy.Builder(x).setId(2).setEnabled(false).build());
        test(fRemoves.isEmpty(), "a hidden row that fails the caller's predicate is not sent as a remove, got " + ids(fRemoves));

        // global read: no per-row check, as for select
        DAO open = new ProxyDAO(x, new AuthorizationDAO(x, store, authorizer(true)));
        List oPuts = new ArrayList(), oRemoves = new ArrayList();
        listen(stranger, open, oPuts, oRemoves, null);
        store.put(row(x, 3));
        test("3".equals(ids(oPuts)), "with global read a listener hears every put, as a select would return it");
      `
    }
  ]
});
