/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'FilteredDAOListenTest',
  extends: 'foam.core.test.Test',

  documentation: `FilteredDAO computes its predicate through predicateIn(x), so a
    subclass can scope on the calling context rather than on a fixed predicate.
    find_, select_ and removeAll_ all call it. listen_ must too, or a subscriber
    receives rows the same context refuses to read.`,

  javaImports: [
    'foam.core.auth.EnabledAwareDummy',
    'foam.lang.Detachable',
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.mlang.MLang',
    'foam.mlang.predicate.Predicate',
    'java.util.ArrayList',
    'java.util.List'
  ],

  methods: [
    {
      name: 'scopedDAO',
      args: 'X x, DAO delegate',
      javaType: 'foam.dao.FilteredDAO',
      documentation: `Scoped by the calling context rather than by a fixed predicate -
        how a context-aware decorator is written: override predicateIn and leave the
        static predicate unset.`,
      javaCode: `
        FilteredDAO dao = new FilteredDAO() {
          @Override
          public Predicate predicateIn(X x) {
            Object scope = x.get("testScope");
            return scope == null ? MLang.TRUE : MLang.EQ(EnabledAwareDummy.ENABLED, scope);
          }
        };

        dao.setX(x);
        dao.setDelegate(delegate);
        return dao;
      `
    },
    {
      name: 'dummy',
      args: 'X x, long id, boolean enabled',
      javaType: 'foam.lang.FObject',
      javaCode: `
        return new EnabledAwareDummy.Builder(x).setId(id).setEnabled(enabled).build();
      `
    },
    {
      name: 'runTest',
      javaCode: `
        DAO         delegate = new MDAO(EnabledAwareDummy.getOwnClassInfo());
        FilteredDAO scoped   = scopedDAO(x, delegate);
        X           inScope  = x.put("testScope", true);

        delegate.put(dummy(x, 1, true));
        delegate.put(dummy(x, 2, false));

        // The reads already honour it.
        ArraySink sel = (ArraySink) scoped.inX(inScope).select(new ArraySink());
        test(sel.getArray().size() == 1,
          "select honours predicateIn, got " + sel.getArray().size());
        test(scoped.inX(inScope).find(2L) == null, "find honours predicateIn");

        // So must listen.
        final List<Object> seen = new ArrayList<>();
        scoped.inX(inScope).listen(new AbstractSink() {
          @Override
          public void put(Object obj, Detachable sub) { seen.add(obj); }
        }, null);

        delegate.put(dummy(x, 3, false));
        test(seen.size() == 0,
          "listen honours predicateIn: an out-of-scope put is not delivered, got " + seen.size());

        delegate.put(dummy(x, 4, true));
        test(seen.size() == 1, "an in-scope put is delivered, got " + seen.size());

        // A caller's own predicate narrows the scope rather than replacing it, and
        // must not be composed with a null.
        final List<Object> narrowed = new ArrayList<>();
        scoped.inX(inScope).listen(new AbstractSink() {
          @Override
          public void put(Object obj, Detachable sub) { narrowed.add(obj); }
        }, MLang.EQ(EnabledAwareDummy.ID, 5L));

        delegate.put(dummy(x, 5, true));
        test(narrowed.size() == 1,
          "a caller's predicate composes with the scope, got " + narrowed.size());

        delegate.put(dummy(x, 6, false));
        test(narrowed.size() == 1,
          "and the scope still applies alongside it, got " + narrowed.size());
      `
    }
  ]
});
