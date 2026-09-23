/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.util.test',
  name: 'StringInternerConcurrencyTest',
  extends: 'foam.core.test.Test',

  documentation: `
    StringInterner under concurrent use. Eight threads share one interner and
    every call hands in a fresh instance, like a parser. Every call returns a
    string equal to its input and nothing throws. Two threads sighting a value
    in the instant it is promoted can each keep a copy, so the instance count
    is bounded, not exact: at most one extra copy per value per thread. A
    release() mid-run keeps every call equal to its input and nothing throws.
  `,

  javaImports: [
    'foam.util.StringInterner',
    'java.util.ArrayList',
    'java.util.Collections',
    'java.util.IdentityHashMap',
    'java.util.List',
    'java.util.Set',
    'java.util.concurrent.CountDownLatch',
    'java.util.concurrent.atomic.AtomicLong'
  ],

  methods: [
    {
      name: 'sweep',
      documentation: 'THREADS threads, CALLS calls each, over values; returns the distinct instances handed out.',
      args: 'StringInterner interner, String[] values, int threads, int calls, AtomicLong wrong, AtomicLong thrown, Runnable midRun',
      javaType: 'Set<String>',
      javaCode: `
        final Set<String>    instances = Collections.newSetFromMap(new IdentityHashMap<String, Boolean>());
        final CountDownLatch started   = new CountDownLatch(threads);
        List<Thread> list = new ArrayList<>();
        for ( int t = 0 ; t < threads ; t++ ) {
          final int seed = t;
          Thread th = new Thread(() -> {
            Set<String> mine = Collections.newSetFromMap(new IdentityHashMap<String, Boolean>());
            started.countDown();
            for ( int k = 0 ; k < calls ; k++ ) {
              String in = new String(values[(k * 7 + seed) % values.length]);   // a fresh instance every call, like a parser
              try {
                String out = interner.intern(in);
                if ( ! in.equals(out) ) wrong.incrementAndGet();
                mine.add(out);
              } catch ( Throwable e ) { thrown.incrementAndGet(); }
            }
            synchronized ( instances ) { instances.addAll(mine); }
          });
          list.add(th); th.start();
        }
        try { started.await(); } catch ( InterruptedException e ) { Thread.currentThread().interrupt(); }
        if ( midRun != null ) midRun.run();
        for ( Thread th : list ) { try { th.join(); } catch ( InterruptedException e ) { Thread.currentThread().interrupt(); } }
        return instances;
      `
    },
    {
      name: 'runTest',
      javaCode: `
        final int      THREADS = 8, CALLS = 100_000, DISTINCT = 500;
        final String[] values  = new String[DISTINCT];
        for ( int i = 0 ; i < DISTINCT ; i++ ) values[i] = "conc-" + i;

        // ---- eight threads, one interner: the result is exact ----------------
        StringInterner c1 = new StringInterner();
        AtomicLong wrong = new AtomicLong(), thrown = new AtomicLong();
        Set<String> instances = sweep(c1, values, THREADS, CALLS, wrong, thrown, null);
        int canonical = 0;
        for ( String s : instances ) if ( s.intern() == s ) canonical++;
        test(wrong.get() == 0 && thrown.get() == 0, "shared: every call returned a string equal to its input and nothing threw (wrong " + wrong.get() + ", thrown " + thrown.get() + ")");
        test(instances.size() >= DISTINCT && instances.size() <= DISTINCT * THREADS,
          "shared: " + THREADS + " threads x " + CALLS + " calls over " + DISTINCT + " values handed out " + instances.size() + " instances (ideal " + DISTINCT + ", bound " + DISTINCT * THREADS + ")");
        test(c1.interned() >= DISTINCT && c1.interned() <= DISTINCT * THREADS, "shared: every value was interned, " + c1.interned() + " promotions for " + DISTINCT + " values");
        test(canonical == DISTINCT, "shared: one JVM canonical per value among the instances handed out (" + canonical + " of " + instances.size() + ")");

        // ---- release() while the threads are still running --------------------
        final StringInterner c3 = new StringInterner();
        wrong = new AtomicLong(); thrown = new AtomicLong();
        instances = sweep(c3, values, THREADS, CALLS, wrong, thrown, () -> {
          try { Thread.sleep(5); } catch ( InterruptedException e ) { Thread.currentThread().interrupt(); }
          c3.release();
        });
        test(wrong.get() == 0 && thrown.get() == 0, "release mid-run: every call still equal to its input, nothing threw (wrong " + wrong.get() + ", thrown " + thrown.get() + ", " + instances.size() + " instances)");
      `
    }
  ]
});
