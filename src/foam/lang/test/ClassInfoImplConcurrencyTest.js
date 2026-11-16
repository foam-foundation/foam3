/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang.test',
  name: 'ClassInfoImplConcurrencyTest',
  extends: 'foam.core.test.Test',

  documentation: `
    getAxiomByName caches a parent's axiom in the child's by-name table on the
    first lookup, so concurrent first lookups write to a table shared by every
    thread. On a HashMap those writes can drop entries already in it, such as
    the child's own properties: a later lookup by name then returns null for a
    property the class declares. Each round builds a fresh parent/child pair
    and has several threads look up every inherited name at once, then checks
    that every own axiom is still found.
  `,

  javaImports: [
    'foam.lang.Axiom',
    'foam.lang.ClassInfoImpl',
    'foam.lang.EmptyClassInfo',
    'java.util.ArrayList',
    'java.util.Collections',
    'java.util.List',
    'java.util.Random',
    'java.util.concurrent.ExecutorService',
    'java.util.concurrent.Executors',
    'java.util.concurrent.Future',
    'java.util.concurrent.atomic.AtomicInteger'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        final int threads   = Math.max(2, Math.min(8, Runtime.getRuntime().availableProcessors()));
        final int own       = 12;   // fills a default HashMap to its resize threshold
        final int inherited = 36;   // enough cached names to force two resizes
        int rounds = 500, roundsWithLoss = 0;

        ExecutorService pool = Executors.newFixedThreadPool(threads);
        try {
          for ( int r = 0 ; r < rounds ; r++ ) {
            final ClassInfoImpl parent = new ClassInfoImpl() {{ parent_ = new EmptyClassInfo(); }};
            for ( int i = 0 ; i < inherited ; i++ ) {
              final String n = "inherited" + i;
              parent.addAxiom((Axiom) () -> n);
            }
            final ClassInfoImpl child = new ClassInfoImpl() {{ parent_ = parent; }};
            for ( int i = 0 ; i < own ; i++ ) {
              final String n = "own" + i;
              child.addAxiom((Axiom) () -> n);
            }

            // Spin until every thread is ready so the first lookups overlap.
            final AtomicInteger ready = new AtomicInteger();
            List<Future<?>> futures = new ArrayList<>();
            for ( int t = 0 ; t < threads ; t++ ) {
              final List<String> names = new ArrayList<>();
              for ( int i = 0 ; i < inherited ; i++ ) names.add("inherited" + i);
              Collections.shuffle(names, new Random(r * 31L + t));
              futures.add(pool.submit(() -> {
                ready.incrementAndGet();
                while ( ready.get() < threads ) Thread.onSpinWait();
                for ( String n : names ) child.getAxiomByName(n);
                return null;
              }));
            }
            for ( Future<?> f : futures ) f.get();

            for ( int i = 0 ; i < own ; i++ ) {
              if ( child.getAxiomByName("own" + i) == null ) {
                roundsWithLoss++;
                break;
              }
            }
          }
        } catch (java.lang.Exception e) {
          throw new RuntimeException(e);
        } finally {
          pool.shutdownNow();
        }

        test(roundsWithLoss == 0,
          "own axioms survive concurrent first lookups of inherited axioms; lost in " +
            roundsWithLoss + " of " + rounds + " rounds with " + threads + " threads");
      `
    }
  ]
});
