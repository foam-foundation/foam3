/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.util.test',
  name: 'StringInternerTest',
  extends: 'foam.core.test.Test',

  documentation: 'foam.util.StringInterner: intern on second sight -- first sight stays raw, second sight canonicalizes, values that never repeat never reach the JVM table; eviction, release, sizing, analytics, and the parser with and without a replay context.',

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

        // first sight: the value comes back as itself, nothing reaches the table
        String a  = new String("USD");
        String ia = c.intern(a);
        test(ia == a && ia != "USD", "first sight returns the raw instance, not yet interned");
        test(c.interned() == 0, "first sight sends nothing to the JVM table");

        // second sight: canonical, and every later sight returns the same canonical
        String ib = c.intern(new String("USD"));
        test(ib == "USD", "second sight interns: the literal is the canonical");
        test(c.intern(new String("USD")) == ib, "third sight is a cache hit on the canonical");
        test(c.hits() == 2 && c.calls() == 3 && c.interned() == 1,
          "two hits of three calls, one value interned (hits " + c.hits() + ", calls " + c.calls() + ", interned " + c.interned() + ")");

        // no length gate: a repeated 182-char value interns like any other
        StringBuilder gb = new StringBuilder();
        for ( int i = 0 ; i < 13 ; i++ ) gb.append("past-any-gate-");
        c.intern(new String(gb.toString()));
        String g2 = c.intern(new String(gb.toString()));
        test(g2 == gb.toString().intern(), "long strings intern on second sight too");

        // null passes through
        test(c.intern(null) == null, "null passes through");

        // the canonical lives in the JVM table, so two interners agree once each has seen the value twice
        String u = "shared-" + tag;
        StringInterner i1 = new StringInterner(4), i2 = new StringInterner(4);
        i1.intern(new String(u)); i2.intern(new String(u));
        test(i1.intern(new String(u)) == i2.intern(new String(u)), "different interners return the same canonical on second sight");

        // eviction between sightings keeps the copies separate -- bounded loss, never a wrong value
        StringInterner tiny = new StringInterner(2);
        String k1 = new String("keep-" + tag);
        tiny.intern(k1);
        for ( int i = 0 ; i < 1000 ; i++ ) tiny.intern(new String("flood-" + tag + "-" + i));
        String k2 = new String("keep-" + tag);
        test(tiny.intern(k2) == k2 && tiny.interned() < 1000, "a value evicted before its second sight comes back raw again (interned " + tiny.interned() + ")");

        // release: slots drop, calls return the raw value and count nothing
        StringInterner rel = new StringInterner(8);
        rel.intern(new String("released-" + tag));
        rel.release();
        String r2 = new String("released-" + tag);
        test(rel.intern(r2) == r2 && rel.calls() == 1, "after release, intern returns the raw value and does not count (calls " + rel.calls() + ")");

        // analytics: the bucket that saw the calls reports them, and how many values reached the table
        StringInterner st = new StringInterner(8);
        for ( int i = 0 ; i < 50 ; i++ ) st.intern(new String("twelve-chars"));   // length 12 -> bucket 8-15
        String summary = st.summary();
        test(st.hits() == 49 && st.calls() == 50 && st.interned() == 1, "49 hits of 50 calls, one value interned");
        test(summary.contains("len 8-15 calls 50 hit 98.0%") && summary.contains("interned 1 slots 256"),
          "summary reports the 8-15 bucket and the interned count: " + summary);

        // sizing follows the journal: small journals get a small cache, unknown or huge ones the full one
        test(StringInterner.bitsFor(0) == StringInterner.MAX_BITS, "unknown size gets the full cache");
        test(StringInterner.bitsFor(10 * 1024) == StringInterner.MIN_BITS, "a 10 KB journal gets the smallest cache (" + StringInterner.bitsFor(10 * 1024) + " bits)");
        test(StringInterner.bitsFor(1L << 40) == StringInterner.MAX_BITS, "a 1 TB journal is clamped to the largest cache");
        test(StringInterner.bitsFor(1 << 20) <= StringInterner.bitsFor(1 << 24), "cache size does not shrink as the journal grows");

        // a re-sighting from the same entry is not a second sight (parsers backtrack and re-parse the same text)
        StringInterner en = new StringInterner(8);
        StringInterner.Entry e1 = en.entry(), e2 = en.entry();
        String ev = "entry-" + tag;
        e1.intern(new String(ev));
        test(e1.intern(new String(ev)) != ev.intern() && en.interned() == 0, "the same entry sighting a value twice does not intern it");
        test(e2.intern(new String(ev)) == ev.intern() && en.interned() == 1, "a sighting from another entry does");

        // parser with a replay interner in X: the first record keeps its raw value, the second gets the canonical
        JSONParser p = new JSONParser();
        StringInterner pi = new StringInterner(10);
        p.setX(x.put(StringInterner.CTX_KEY, pi));
        String sp = "spid-" + tag;
        foam.core.auth.User u1 = (foam.core.auth.User) p.parseString("{\\"class\\":\\"foam.core.auth.User\\",\\"id\\":1,\\"spid\\":\\"" + sp + "\\"}");
        foam.core.auth.User u2 = (foam.core.auth.User) p.parseString("{\\"class\\":\\"foam.core.auth.User\\",\\"id\\":2,\\"spid\\":\\"" + sp + "\\"}");
        // the second sight interns the FIRST record's instance, so both records share it and no stray is left
        test(u1 != null && u2 != null && u2.getSpid() == sp.intern() && u1.getSpid() == u2.getSpid() && pi.interned() >= 1,
          "parser with a replay interner: the second record's sight interns the first record's instance, both share it (interned " + pi.interned() + ")");

        // parser with no replay context goes through the shared interner: repeated values still end canonical
        JSONParser q = new JSONParser();
        q.setX(x);
        String sq = "shared-spid-" + tag;
        q.parseString("{\\"class\\":\\"foam.core.auth.User\\",\\"id\\":3,\\"spid\\":\\"" + sq + "\\"}");
        foam.core.auth.User u4 = (foam.core.auth.User) q.parseString("{\\"class\\":\\"foam.core.auth.User\\",\\"id\\":4,\\"spid\\":\\"" + sq + "\\"}");
        test(u4 != null && u4.getSpid() == sq.intern(), "parser with no replay context canonicalizes on second sight through the shared interner");

        // identity is a property of the table, not the value: consumers compare with equals()
        String pv1 = new String("per-record-value"), pv2 = new String("per-record-value");
        test(pv1.equals(pv2) && pv1 != pv2, "equal values are not the same instance until interned -- never compare strings with ==");
      `
    }
  ]
});
