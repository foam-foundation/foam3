/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.benchmark',
  name: 'StringInternerBenchmark',
  extends: 'foam.core.bench.Benchmark',

  documentation: `
    Four ways to canonicalize the string values a journal replay parses, timed
    against each other at a chosen cardinality:

      CACHED  foam.util.StringInterner: intern on second sight, two maps per replay
      JVM     String.intern() on every call
      LEGACY  the weak ConcurrentHashMap interner this replaced (copied below so
              the comparison stays runnable)
      RAW     no canonicalization at all

    Cardinality decides which wins, so it is a property. At "distinct" far below
    "batchSize" the interners share what RAW keeps separately; at "distinct" equal
    to "batchSize" nothing repeats and an interner's index is pure cost. Sweep
    "distinct" to find the crossover for a corpus.

    Speed only. Retained heap is the other axis: LEGACY pays about 96 bytes an
    entry on the heap for good, JVM about 22 bytes an entry in native memory,
    and CACHED the JVM's 22 for a repeated value plus about 42 bytes a distinct
    value on the heap until the replay releases it.
  `,

  javaImports: [
    'foam.core.bench.BenchmarkResult',
    'foam.lang.X',
    'foam.util.StringInterner',
    'java.lang.ref.Reference',
    'java.lang.ref.ReferenceQueue',
    'java.lang.ref.WeakReference',
    'java.util.concurrent.ConcurrentHashMap'
  ],

  javaCode: `
    /** The interner this benchmark's CACHED mode replaced: one weak entry per distinct value, on the heap. */
    static final class LegacyWeakInterner {
      final ConcurrentHashMap<Key, Key> map = new ConcurrentHashMap<>(1 << 17);
      final ReferenceQueue<String>      queue = new ReferenceQueue<>();

      final class Key extends WeakReference<String> {
        final int hash_;
        Key(String s) { super(s, queue); hash_ = s.hashCode(); }
        @Override public int hashCode() { return hash_; }
        @Override public boolean equals(Object o) {
          if ( this == o ) return true;
          if ( ! ( o instanceof Key ) ) return false;
          String a = get(), b = ((Key) o).get();
          return a != null && a.equals(b);
        }
      }

      String intern(String s) {
        Reference<? extends String> dead;
        while ( ( dead = queue.poll() ) != null ) map.remove(dead);
        Key key = new Key(s);
        for ( ; ; ) {
          Key entry = map.putIfAbsent(key, key);
          if ( entry == null ) return s;
          String canonical = entry.get();
          if ( canonical != null ) return canonical;
          map.remove(key, entry);
        }
      }
    }

    protected StringInterner      cached_;
    protected LegacyWeakInterner  legacy_;
  `,

  properties: [
    {
      documentation: 'Strings handled per execute(). Sized so one execution is long enough to time.',
      class: 'Int',
      name: 'batchSize',
      value: 200000
    },
    {
      documentation: 'Distinct values the batch draws from. Equal to batchSize means every value is unique.',
      class: 'Int',
      name: 'distinct',
      value: 10000
    },
    {
      documentation: 'CACHED, JVM, LEGACY or RAW.',
      class: 'String',
      name: 'mode',
      value: 'CACHED'
    },
    {
      documentation: 'Values are rebuilt per execute() from these, so each call allocates fresh char data like a parser does.',
      class: 'StringArray',
      name: 'values'
    },
    {
      documentation: 'Holds the results so the JIT cannot drop the interning as dead code.',
      class: 'StringArray',
      name: 'sink'
    }
  ],

  methods: [
    {
      name: 'setup',
      args: 'X x, BenchmarkResult br',
      javaCode: `
        String[] vals = new String[getDistinct()];
        for ( int i = 0 ; i < vals.length ; i++ ) vals[i] = "value-" + i + "-padding";
        setValues(vals);
        setSink(new String[getBatchSize()]);
        cached_ = new StringInterner();
        legacy_ = new LegacyWeakInterner();
      `
    },
    {
      name: 'execute',
      args: 'X x',
      javaCode: `
        String[] vals = getValues();
        String[] sink = getSink();
        String   mode = getMode();
        int      n    = getBatchSize();
        int      d    = vals.length;

        for ( int i = 0 ; i < n ; i++ ) {
          // new char data every iteration: the parser builds each value from
          // bytes, so interning a literal would measure the wrong thing
          String s = new StringBuilder(vals[i % d]).toString();
          if ( "CACHED".equals(mode) )      sink[i] = cached_.intern(s);
          else if ( "JVM".equals(mode) )    sink[i] = s.intern();
          else if ( "LEGACY".equals(mode) ) sink[i] = legacy_.intern(s);
          else                              sink[i] = s;
        }
      `
    }
  ]
});
