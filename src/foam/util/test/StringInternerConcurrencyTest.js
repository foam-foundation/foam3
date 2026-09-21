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
    every call hands in a fresh instance with its own entry id, like a parser.
    With room for every value (no bucket over WAYS deep) the result is exact:
    one instance per value, the JVM canonical, on every thread; a race on a
    slot never leaks an extra copy. With a cache too small for the values,
    evictions happen, and the guarantee is equality and no exception. A
    release() mid-run keeps both.
  `,

  javaImports: [
    'foam.util.StringInterner',
    'java.util.ArrayList',
    'java.util.Collections',
    'java.util.IdentityHashMap',
    'java.util.List',
    'java.util.Set',
    'java.util.concurrent.CountDownLatch',
    'java.util.concurrent.atomic.AtomicInteger',
    'java.util.concurrent.atomic.AtomicLong'
  ],

  methods: [
    {
      name: 'sweep',
      documentation: 'THREADS threads, CALLS calls each, over values; returns the distinct instances handed out.',
      args: 'StringInterner interner, String[] values, int threads, int calls, AtomicInteger entries, AtomicLong wrong, AtomicLong thrown, Runnable midRun',
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
                String out = interner.intern(in, entries.incrementAndGet());
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
        final AtomicInteger entries = new AtomicInteger();

        // ---- room for every value: the result is exact ----------------------
        int bits = 16, buckets = (1 << bits) / StringInterner.WAYS;
        int[] depth = new int[buckets];
        int deepest = 0;
        for ( String v : values ) {
          int h = v.hashCode();
          deepest = Math.max(deepest, ++depth[(h ^ (h >>> 16)) & (buckets - 1)]);
        }
        test(deepest <= StringInterner.WAYS, "setup: no bucket holds more than " + StringInterner.WAYS + " of the values (deepest " + deepest + ")");

        StringInterner c1 = new StringInterner(bits);
        AtomicLong wrong = new AtomicLong(), thrown = new AtomicLong();
        Set<String> instances = sweep(c1, values, THREADS, CALLS, entries, wrong, thrown, null);
        int canonical = 0;
        for ( String s : instances ) if ( s.intern() == s ) canonical++;
        test(wrong.get() == 0 && thrown.get() == 0, "exact: every call returned a string equal to its input and nothing threw (wrong " + wrong.get() + ", thrown " + thrown.get() + ")");
        test(instances.size() == DISTINCT, "exact: " + THREADS + " threads x " + CALLS + " calls over " + DISTINCT + " values handed out " + instances.size() + " instances (one per value; a slot race leaks no copy)");
        test(canonical == DISTINCT, "exact: every instance handed out is the JVM canonical (" + canonical + " of " + instances.size() + ")");

        // ---- too small for the values: evictions, still never a wrong value ---
        StringInterner c2 = new StringInterner(10);
        wrong = new AtomicLong(); thrown = new AtomicLong();
        instances = sweep(c2, values, THREADS, CALLS, entries, wrong, thrown, null);
        test(wrong.get() == 0 && thrown.get() == 0, "evicting: 1024 slots for " + DISTINCT + " values, " + instances.size() + " instances handed out; every call equal to its input, nothing threw (wrong " + wrong.get() + ", thrown " + thrown.get() + ")");

        // ---- release() while the threads are still running --------------------
        final StringInterner c3 = new StringInterner(bits);
        wrong = new AtomicLong(); thrown = new AtomicLong();
        instances = sweep(c3, values, THREADS, CALLS, entries, wrong, thrown, () -> {
          try { Thread.sleep(5); } catch ( InterruptedException e ) { Thread.currentThread().interrupt(); }
          c3.release();
        });
        test(wrong.get() == 0 && thrown.get() == 0, "release mid-run: every call still equal to its input, nothing threw (wrong " + wrong.get() + ", thrown " + thrown.get() + ", " + instances.size() + " instances)");
      `
    }
  ]
});
