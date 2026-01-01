/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.test',
  name: 'ArrayDAOTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'foam.lang.Currency',
    'foam.dao.DAO',
    'foam.dao.ArrayDAO',
    'foam.dao.ArraySink',
    'static foam.mlang.MLang.EQ',
    'foam.mlang.predicate.FScript',
    'foam.mlang.predicate.FScriptPredicate',
    'java.util.ArrayList',
    'java.util.List'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
      ArrayDAO dao = new ArrayDAO(x);
      dao.setOf(Currency.getOwnClassInfo());
      dao.setIdentityExpr(Currency.SYMBOL);

      // setup
      Currency cur = new Currency(x);
      cur.setId("CA1");
      cur.setNumericCode(1L);
      cur.setSymbol("1");
      dao.put(cur);

      cur = new Currency(x);
      cur.setId("CA2");
      cur.setNumericCode(2L);
      cur.setSymbol("2");
      dao.put(cur);

      cur = new Currency(x);
      cur.setId("CA3");
      cur.setNumericCode(3L);
      cur.setSymbol("3");
      dao.put(cur);

      // Select
      List results = (List) ((ArraySink)dao.select(new ArraySink())).getArray();
      test(results != null, "Select All not null");
      test(results.size() == 3, "Select All size 3");

      // Find by FObject, compare with IdentityExpr
      Currency c = (Currency) dao.find(cur); // last one is 3
      test(c != null, "Find FObject 3 not null");
      test(c != null && c.getSymbol().equals("3"), "Find FObject 3");

      // Find by property of identityExpr
      c = (Currency) dao.find("2");
      test(c != null, "Find Identity 2 not null");
      test(c != null && c.getSymbol().equals("2"), "Find Identity 2");

      // Find with predicate
      c = (Currency) dao.find(EQ(Currency.NUMERIC_CODE, 1));
      test(c != null, "Find Predicate 1 not null");
      test(c != null && c.getSymbol().equals("1"), "Find Predidicate 1");

      // Select with Predicate
      results = (List) ((ArraySink)dao.select_(x, new ArraySink(), 0, 0, null, EQ(Currency.NUMERIC_CODE, 1))).getArray();
      test(results != null, "Select Predicate not null");
      test(results.size() == 1, "Select Predicate size expected 1, found "+results.size());

      // Find with FScriptPredicate
      c = (Currency) dao.find(new FScriptPredicate("symbol==\\"1\\"", null));
      test(c != null, "Find FScriptPredicate 1 not null");
      test(c != null && c.getSymbol().equals("1"), "Find FScriptPredicate 1");

      // Select with FScriptPredicate
      results = (List) ((ArraySink)dao.select_(x, new ArraySink(), 0, 0, null, new FScriptPredicate("symbol==\\"3\\"", null))).getArray();
      test(results != null, "Select FScriptPredicate not null");
      test(results.size() == 1, "Select FScriptPredicate size expected 1, found "+results.size());

      // remove
      dao.remove(cur);

      // test size reduced after remove
      results = (List) ((ArraySink)dao.select(new ArraySink())).getArray();
      test(results != null && results.size() == 2, "Select size 2");

      // test correct removed item removed.
      c = (Currency) dao.find(cur); // last one is 3
      test(c == null, "Find FObject 3 not found");
      `
    }
  ]
});
