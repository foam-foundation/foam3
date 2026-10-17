/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang',
  name: 'SparseTest',
  extends: 'foam.core.test.Test',

  documentation: 'javaSparse: set reference properties live in one values array behind a shape shared by every instance with the same set, behind the unchanged property API.',

  javaImports: [
    'java.lang.reflect.Field',
    'java.util.concurrent.CyclicBarrier',
    'java.util.concurrent.ExecutorService',
    'java.util.concurrent.Executors',
    'java.util.concurrent.Future',
    'java.util.concurrent.atomic.AtomicInteger'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        testStorageShape();
        testPropertyApi();
        testSharedShape();
        testCloneEqualsFreeze();
        testConcurrentSetters();
      `
    },
    {
      name: 'declaredField',
      type: 'Field',
      args: 'String name',
      javaCode: `
        try {
          return SparseTestModel.class.getDeclaredField(name);
        } catch ( NoSuchFieldException e ) {
          return null;
        }
      `
    },
    {
      name: 'read',
      type: 'Object',
      args: 'SparseTestModel o, String field',
      javaCode: `
        try {
          Field f = declaredField(field);
          f.setAccessible(true);
          return f.get(o);
        } catch ( java.lang.Exception e ) {
          throw new RuntimeException(e);
        }
      `
    },
    {
      name: 'testStorageShape',
      javaCode: `
        test(declaredField("s0_") == null && declaredField("s0IsSet_") == null, "sparse property has no value or isSet field");
        Field shape  = declaredField("shapeSparseTestModel_");
        Field values = declaredField("valuesSparseTestModel_");
        test(shape != null && shape.getType() == SparseShape.class, "class holds one shape reference");
        test(values != null && values.getType() == Object[].class, "class holds one values array");
        Field n0 = declaredField("n0_");
        test(n0 != null && n0.getType() == long.class && declaredField("n0IsSet_") != null, "primitive property keeps its own field and flag");
      `
    },
    {
      name: 'testPropertyApi',
      javaCode: `
        SparseTestModel o = new SparseTestModel();
        test(! SparseTestModel.S0.isSet(o) && "".equals(o.getS0()), "unset sparse property reports unset and reads its default");
        test(((Object[]) read(o, "valuesSparseTestModel_")).length == 0, "fresh instance holds no values");

        o.setS3("three");
        o.setS7("seven");
        test(SparseTestModel.S3.isSet(o) && "three".equals(o.getS3()), "set property reads back");
        test("seven".equals(SparseTestModel.S7.get(o)), "PropertyInfo.get reads the stored value");
        test(! SparseTestModel.S4.isSet(o), "neighbour stays unset");
        test(((Object[]) read(o, "valuesSparseTestModel_")).length == 2, "values array holds only the set properties");

        o.setS3("three again");
        test("three again".equals(o.getS3()) && ((Object[]) read(o, "valuesSparseTestModel_")).length == 2, "re-setting a property overwrites its slot");

        o.clearS3();
        test(! SparseTestModel.S3.isSet(o) && "".equals(o.getS3()), "clearX() drops the property");
        test("seven".equals(o.getS7()) && ((Object[]) read(o, "valuesSparseTestModel_")).length == 1, "clearing one property leaves the other in place");
      `
    },
    {
      name: 'testSharedShape',
      javaCode: `
        SparseTestModel a = new SparseTestModel();
        a.setS3("x"); a.setS7("y");
        SparseTestModel b = new SparseTestModel();
        b.setS7("p"); b.setS3("q");
        test(read(a, "shapeSparseTestModel_") == read(b, "shapeSparseTestModel_"), "same set of properties shares one shape, whatever the set order");
        test("q".equals(b.getS3()) && "p".equals(b.getS7()), "values land in the slot their ordinal owns, not in set order");

        SparseTestModel c = new SparseTestModel();
        c.setS3("z");
        test(read(a, "shapeSparseTestModel_") != read(c, "shapeSparseTestModel_"), "different set gets a different shape");
        c.setS7("w");
        test(read(a, "shapeSparseTestModel_") == read(c, "shapeSparseTestModel_"), "adding a property moves the instance onto the shared shape");
        c.clearS7();
        SparseTestModel d = new SparseTestModel();
        d.setS3("only");
        test(read(c, "shapeSparseTestModel_") == read(d, "shapeSparseTestModel_"), "clearing moves back to the shape without it");
      `
    },
    {
      name: 'testCloneEqualsFreeze',
      javaCode: `
        SparseTestModel o = new SparseTestModel();
        o.setS1("one"); o.setS8("eight"); o.setN0(5L);

        SparseTestModel c = (SparseTestModel) o.fclone();
        test("one".equals(c.getS1()) && "eight".equals(c.getS8()) && c.getN0() == 5L, "fclone carries sparse and fixed values");
        test(o.equals(c) && o.hashCode() == c.hashCode(), "clone equals the original with the same hashCode");
        c.setS8("changed");
        c.setS9("new");
        test("eight".equals(o.getS8()) && ! SparseTestModel.S9.isSet(o), "writing the clone leaves the original alone");
        test(! o.equals(c), "differing sparse value breaks equality");

        o.freeze();
        boolean threw = false;
        try { o.setS1("frozen"); } catch ( java.lang.Exception e ) { threw = true; }
        test(threw && "one".equals(o.getS1()), "setter on a frozen instance throws and changes nothing");
      `
    },
    {
      name: 'testConcurrentSetters',
      documentation: 'Eight threads each set a different sparse property of one object. Each set moves the shape and rebuilds the values array, so an unsynchronized setter loses values or indexes past the array.',
      javaCode: `
        final int threads = 8;
        final int rounds  = 20000;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        AtomicInteger lost = new AtomicInteger();
        try {
          for ( int r = 0 ; r < rounds ; r++ ) {
            final SparseTestModel o = new SparseTestModel();
            final CyclicBarrier go = new CyclicBarrier(threads);
            Future<?>[] done = new Future<?>[threads];
            for ( int t = 0 ; t < threads ; t++ ) {
              final int i = t;
              done[t] = pool.submit(() -> {
                try { go.await(); } catch ( java.lang.Exception e ) { throw new RuntimeException(e); }
                switch ( i ) {
                  case 0: o.setS0("0"); break;
                  case 1: o.setS1("1"); break;
                  case 2: o.setS2("2"); break;
                  case 3: o.setS3("3"); break;
                  case 4: o.setS4("4"); break;
                  case 5: o.setS5("5"); break;
                  case 6: o.setS6("6"); break;
                  default: o.setS7("7");
                }
              });
            }
            boolean failed = false;
            for ( Future<?> f : done ) {
              try { f.get(); } catch ( java.lang.Exception e ) { failed = true; }
            }
            if ( failed
              || ! "0".equals(o.getS0()) || ! "1".equals(o.getS1()) || ! "2".equals(o.getS2()) || ! "3".equals(o.getS3())
              || ! "4".equals(o.getS4()) || ! "5".equals(o.getS5()) || ! "6".equals(o.getS6()) || ! "7".equals(o.getS7()) ) {
              lost.incrementAndGet();
            }
          }
        } finally {
          pool.shutdown();
        }
        test(lost.get() == 0, "concurrent setters on different sparse properties keep every value (" + lost.get() + " of " + rounds + " rounds lost one)");
      `
    }
  ]
});
