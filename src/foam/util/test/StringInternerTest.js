/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.util.test',
  name: 'StringInternerTest',
  extends: 'foam.core.test.Test',

  documentation: 'foam.util.StringInterner: a per-replay cache in front of String.intern() -- hits, misses, eviction, analytics, and the parser integration with and without a replay context.',

  javaImports: [
    'foam.util.StringInterner',
    'foam.lib.json.JSONParser'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        long tag = System.nanoTime();
        StringInterner c = new StringInterner(10);

        // a value comes back as the JVM canonical, whichever path it took
        String a  = new String("USD");
        String ia = c.intern(a);
        test(a != ia && ia == "USD", "first sight interns into the JVM table: the literal is the canonical");
        test(c.intern(new String("USD")) == ia, "second sight is a cache hit on the same instance");
        test(c.hits() == 1 && c.calls() == 2, "one hit, two calls counted (hits " + c.hits() + ", calls " + c.calls() + ")");

        // no length gate: a repeated 182-char value dedups like any other
        StringBuilder gb = new StringBuilder();
        for ( int i = 0 ; i < 13 ; i++ ) gb.append("past-any-gate-");
        String g1 = c.intern(new String(gb.toString()));
        String g2 = c.intern(new String(gb.toString()));
        test(g1 == g2 && g1 == gb.toString().intern(), "long strings dedup to the JVM canonical too");

        // null passes through
        test(c.intern(null) == null, "null passes through");

        // two interners agree, because the canonical lives in the JVM table, not the cache
        String u = "shared-" + tag;
        test(new StringInterner(4).intern(new String(u)) == new StringInterner(4).intern(new String(u)),
          "different interners return the same canonical for equal values");

        // eviction loses the shortcut, never the dedup: 4 slots, flooded with distinct values
        StringInterner tiny = new StringInterner(2);
        String keep = tiny.intern(new String("keep-" + tag));
        for ( int i = 0 ; i < 1000 ; i++ ) tiny.intern(new String("flood-" + tag + "-" + i));
        test(tiny.intern(new String("keep-" + tag)) == keep, "an evicted value re-interns to the same canonical");
        test(tiny.hits() < 1002, "a 4-slot cache under a 1000-value flood mostly missed (hits " + tiny.hits() + ")");

        // analytics: the bucket that saw the calls reports them
        StringInterner st = new StringInterner(8);
        for ( int i = 0 ; i < 50 ; i++ ) st.intern(new String("twelve-chars"));   // length 12 -> bucket 8-15
        String summary = st.summary();
        test(st.hits() == 49 && st.calls() == 50, "49 hits of 50 calls on one repeated value");
        test(summary.contains("len 8-15 calls 50 hit 98.0%"), "summary reports the 8-15 bucket: " + summary);
        test(summary.endsWith("slots 256"), "summary reports the slot count: " + summary);

        // release drops the slots but keeps canonicalization and the counters
        StringInterner rel = new StringInterner(8);
        String before = rel.intern(new String("released-" + tag));
        rel.release();
        test(rel.intern(new String("released-" + tag)) == before, "after release, intern still returns the JVM canonical");
        test(rel.hits() == 0 && rel.calls() == 1, "after release, calls go straight to the table and are not counted -- the summary was already logged (hits " + rel.hits() + ", calls " + rel.calls() + ")");

        // sizing follows the journal: small journals get a small cache, unknown or huge ones the full one
        test(StringInterner.bitsFor(0) == StringInterner.MAX_BITS, "unknown size gets the full cache");
        test(StringInterner.bitsFor(10 * 1024) == StringInterner.MIN_BITS, "a 10 KB journal gets the smallest cache (" + StringInterner.bitsFor(10 * 1024) + " bits)");
        test(StringInterner.bitsFor(1L << 40) == StringInterner.MAX_BITS, "a 1 TB journal is clamped to the largest cache");
        test(StringInterner.bitsFor(1 << 20) <= StringInterner.bitsFor(1 << 24), "cache size does not shrink as the journal grows");

        // parser integration: with an interner in X, repeated values share one instance
        JSONParser p = new JSONParser();
        p.setX(x.put(StringInterner.CTX_KEY, new StringInterner(10)));
        foam.core.auth.User u1 = (foam.core.auth.User) p.parseString("{\\"class\\":\\"foam.core.auth.User\\",\\"id\\":1,\\"spid\\":\\"foam\\"}");
        foam.core.auth.User u2 = (foam.core.auth.User) p.parseString("{\\"class\\":\\"foam.core.auth.User\\",\\"id\\":2,\\"spid\\":\\"foam\\"}");
        test(u1 != null && u2 != null && u1.getSpid() == u2.getSpid(), "parser with a replay interner returns one instance for a repeated value");

        // and without one, values are still canonical through the JVM table directly
        JSONParser q = new JSONParser();
        q.setX(x);
        foam.core.auth.User u3 = (foam.core.auth.User) q.parseString("{\\"class\\":\\"foam.core.auth.User\\",\\"id\\":3,\\"spid\\":\\"foam\\"}");
        test(u3 != null && u3.getSpid() == "foam", "parser with no replay context interns directly: the literal is the canonical");

        // identity is a property of the table, not the value: consumers compare with equals()
        String pv1 = new String("per-record-value"), pv2 = new String("per-record-value");
        test(pv1.equals(pv2) && pv1 != pv2, "equal values are not the same instance until interned -- never compare strings with ==");
      `
    }
  ]
});
