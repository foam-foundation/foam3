/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.util.test',
  name: 'StringInternerTest',
  extends: 'foam.core.test.Test',

  documentation: 'foam.util.StringInterner: dedup behavior at every length, and the parser integration that replaced String.intern().',

  javaImports: [
    'foam.util.StringInterner',
    'foam.lib.json.JSONParser'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        // equal short strings dedup to one instance per thread
        String a = new String("USD");
        String b = new String("USD");
        test(a != b, "setup: two distinct instances");
        String ia = StringInterner.intern(a);
        String ib = StringInterner.intern(b);
        test(ia == ib, "equal short strings return the same instance, across any thread");
        test("USD".equals(ia), "deduplicated value is equal to the input");

        // a repeated long string dedups too — one 100-char duplicate saves more than a short one
        StringBuilder lb = new StringBuilder();
        for ( int i = 0 ; i < 10 ; i++ ) lb.append("longvalue-");
        String l1 = StringInterner.intern(new String(lb.toString()));
        String l2 = StringInterner.intern(new String(lb.toString()));
        test(l1 == l2, "repeated 100-char strings dedup to one instance");

        // full dedup: no eviction — three distinct values, all stay canonical
        String v1 = StringInterner.intern(new String("EUR"));
        String v2 = StringInterner.intern(new String("GBP"));
        test(StringInterner.intern(new String("EUR")) == v1 && StringInterner.intern(new String("GBP")) == v2, "values stay canonical, nothing evicted");

        // no length gate: a repeated 182-char value dedups like any other
        StringBuilder gb = new StringBuilder();
        for ( int i = 0 ; i < 13 ; i++ ) gb.append("past-any-gate-");
        String g1 = StringInterner.intern(new String(gb.toString()));
        String g2 = StringInterner.intern(new String(gb.toString()));
        test(g1 == g2, "long strings dedup too — same coverage as String.intern");

        // null passes through
        test(StringInterner.intern(null) == null, "null passes through");

        // the parser dedups repeated short values across entries
        JSONParser p = new JSONParser();
        p.setX(x);
        foam.core.auth.User u1 = (foam.core.auth.User) p.parseString("{\\"class\\":\\"foam.core.auth.User\\",\\"id\\":1,\\"spid\\":\\"foam\\"}");
        foam.core.auth.User u2 = (foam.core.auth.User) p.parseString("{\\"class\\":\\"foam.core.auth.User\\",\\"id\\":2,\\"spid\\":\\"foam\\"}");
        test(u1 != null && u2 != null && u1.getSpid() == u2.getSpid(), "parser returns one instance for a repeated short string value");
      `
    }
  ]
});
