/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.util.test',
  name: 'StringInternerTest',
  extends: 'foam.core.test.Test',

  documentation: 'foam.util.StringInterner: intern on second sight -- first sight stays raw, second sight interns the first instance, values that never repeat never reach the JVM table; the delegate sees only second sights; release, analytics, and the parser with and without a replay context.',

  javaImports: [
    'foam.util.StringInterner',
    'foam.lib.json.JSONParser'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        long tag = System.nanoTime();
        StringInterner c = new StringInterner();

        // first sight: the value comes back as itself, nothing reaches the table
        String v  = "usd-" + tag;
        String a  = new String(v);
        test(c.intern(a) == a && c.interned() == 0, "first sight returns the raw instance and sends nothing to the JVM table");

        // second sight interns the FIRST instance: the record that brought the value in already holds the canonical
        String b  = new String(v);
        String ib = c.intern(b);
        test(ib == a && ib != b, "second sight returns the first instance, not the second");
        test(a.intern() == a, "the first instance is the JVM canonical");
        test(c.intern(new String(v)) == a, "third sight returns the same canonical");
        test(c.hits() == 2 && c.calls() == 3 && c.interned() == 1,
          "two hits of three calls, one value interned (hits " + c.hits() + ", calls " + c.calls() + ", interned " + c.interned() + ")");

        // a value already in the JVM table (a literal): second sight returns the table's instance
        c.intern(new String("USD"));
        test(c.intern(new String("USD")) == "USD", "a value the JVM already holds interns to the existing canonical");

        // no length gate: a repeated 182-char value interns like any other
        StringBuilder gb = new StringBuilder();
        for ( int i = 0 ; i < 13 ; i++ ) gb.append("past-any-gate-");
        String g = gb.toString() + tag;
        String g1 = new String(g);
        c.intern(g1);
        test(c.intern(new String(g)) == g1, "long strings intern on second sight too");

        // null passes through
        test(c.intern(null) == null, "null passes through");

        // a value seen once, however many other values go by, is never interned
        StringInterner once = new StringInterner();
        for ( int i = 0 ; i < 10000 ; i++ ) once.intern("id-" + tag + "-" + i);
        test(once.interned() == 0 && once.calls() == 10000, "10,000 values seen once put nothing in the JVM table");

        // release: maps drop, calls return the raw value and count nothing
        StringInterner rel = new StringInterner();
        rel.intern(new String("released-" + tag));
        rel.release();
        String r2 = new String("released-" + tag);
        test(rel.intern(r2) == r2 && rel.calls() == 1, "after release, intern returns the raw value and does not count (calls " + rel.calls() + ")");

        // analytics: the bucket that saw the calls reports hits, misses and values interned
        StringInterner st = new StringInterner();
        for ( int i = 0 ; i < 50 ; i++ ) st.intern(new String("twelve-chars"));   // length 12 -> bucket 8-15
        String summary = st.summary();
        test(st.hits() == 49 && st.calls() == 50 && st.interned() == 1, "49 hits of 50 calls, one value interned");
        test(summary.contains("len 8-15 calls 50 hit 49 miss 1 interned 1") && summary.contains("total calls 50 hit 98.0% interned 1"),
          "summary reports the 8-15 bucket and the totals: " + summary);

        // parser with a replay interner in X: one record's value is seen once, even though parsers backtrack
        JSONParser p = new JSONParser();
        StringInterner pi = new StringInterner();
        p.setX(x.put(StringInterner.CTX_KEY, pi));
        String sp = "spid-" + tag;
        foam.core.auth.User u1 = (foam.core.auth.User) p.parseString("{\\"class\\":\\"foam.core.auth.User\\",\\"id\\":1,\\"spid\\":\\"" + sp + "\\"}");
        test(u1 != null && pi.interned() == 0, "one record carrying a value leaves it uninterned (interned " + pi.interned() + ")");
        // the second record's sight interns the first record's instance, so both records share it
        foam.core.auth.User u2 = (foam.core.auth.User) p.parseString("{\\"class\\":\\"foam.core.auth.User\\",\\"id\\":2,\\"spid\\":\\"" + sp + "\\"}");
        test(u2 != null && u2.getSpid() == u1.getSpid() && u1.getSpid() == sp.intern(),
          "parser with a replay interner: the second record shares the first record's instance, which is the canonical");

        // parser with no replay context keeps values as parsed
        JSONParser q = new JSONParser();
        q.setX(x);
        String sq = "live-spid-" + tag;
        foam.core.auth.User u3 = (foam.core.auth.User) q.parseString("{\\"class\\":\\"foam.core.auth.User\\",\\"id\\":3,\\"spid\\":\\"" + sq + "\\"}");
        foam.core.auth.User u4 = (foam.core.auth.User) q.parseString("{\\"class\\":\\"foam.core.auth.User\\",\\"id\\":4,\\"spid\\":\\"" + sq + "\\"}");
        test(u3 != null && u4 != null && sq.equals(u4.getSpid()) && u3.getSpid() != u4.getSpid(),
          "parser with no replay context keeps each record's value as parsed");

        // a delegate sees only second sights, and gets the first instance
        final String[] handed = { null };
        final int[] delegated = { 0 };
        StringInterner dl = new StringInterner(v2 -> { delegated[0]++; handed[0] = v2; return v2; });
        String d1 = new String("delegate-" + tag);
        dl.intern(d1);
        test(delegated[0] == 0, "first sight does not reach the delegate");
        test(dl.intern(new String("delegate-" + tag)) == d1 && delegated[0] == 1 && handed[0] == d1,
          "second sight hands the delegate the first instance and returns what the delegate returns");
        dl.intern(new String("delegate-" + tag));
        test(delegated[0] == 1, "later sights are answered by the maps (delegate calls " + delegated[0] + ")");

        // identity is a property of the table, not the value: consumers compare with equals()
        String pv1 = new String("per-record-value"), pv2 = new String("per-record-value");
        test(pv1.equals(pv2) && pv1 != pv2, "equal values are not the same instance until interned -- never compare strings with ==");
      `
    }
  ]
});
