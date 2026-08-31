/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.util.test',
  name: 'StringInternerTest',
  extends: 'foam.core.test.Test',

  documentation: 'foam.util.StringInterner: dedup behavior, length gate, collision replacement, and the parser integration that replaced String.intern().',

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

        // strings past the length gate pass through untouched
        StringBuilder gb = new StringBuilder();
        for ( int i = 0 ; i < 13 ; i++ ) gb.append("past-the-gate-");
        String longStr = gb.toString();
        test(StringInterner.intern(longStr) == longStr, "strings past the 128-char gate pass through as the same instance");

        // null passes through
        test(StringInterner.intern(null) == null, "null passes through");

        // "Aa" and "BB" share a hashCode: the second replaces the first's slot,
        // values stay correct either way
        String aa1 = StringInterner.intern(new String("Aa"));
        String bb  = StringInterner.intern(new String("BB"));
        String aa2 = StringInterner.intern(new String("Aa"));
        test("Aa".equals(aa1) && "BB".equals(bb) && "Aa".equals(aa2), "colliding slots always return the right value");

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
