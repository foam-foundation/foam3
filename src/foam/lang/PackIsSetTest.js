/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang',
  name: 'PackIsSetTest',
  extends: 'foam.core.test.Test',

  documentation: 'javaPackIsSet: one long per 64 properties holds the isSet flags, behind the unchanged isSet API.',

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
        testIsSetApi();
        testConcurrentSetters();
      `
    },
    {
      name: 'testStorageShape',
      javaCode: `
        test(declaredField("p0IsSet_") == null, "no boolean isSet field per property");
        Field w0 = declaredField("isSetPackIsSetTestModel_0");
        Field w1 = declaredField("isSetPackIsSetTestModel_1");
        Field w2 = declaredField("isSetPackIsSetTestModel_2");
        test(w0 != null && w0.getType() == long.class, "first 64 properties share one long field");
        test(w1 != null && w1.getType() == long.class, "properties 65..70 get a second long field");
        test(w2 == null, "no third word for 70 properties");
      `
    },
    {
      name: 'declaredField',
      type: 'Field',
      args: 'String name',
      javaCode: `
        try {
          return PackIsSetTestModel.class.getDeclaredField(name);
        } catch ( NoSuchFieldException e ) {
          return null;
        }
      `
    },
    {
      name: 'testIsSetApi',
      javaCode: `
        PackIsSetTestModel o = new PackIsSetTestModel();
        test(! PackIsSetTestModel.P0.isSet(o), "unset property reports unset");
        test(o.getP0() == 0L, "unset Long reads its default");

        o.setP0(7L);
        o.setP64(9L);
        test(PackIsSetTestModel.P0.isSet(o), "set property in word 0 reports set");
        test(PackIsSetTestModel.P64.isSet(o), "set property in word 1 reports set");
        test(! PackIsSetTestModel.P1.isSet(o), "neighbour bit in word 0 untouched");
        test(! PackIsSetTestModel.P65.isSet(o), "neighbour bit in word 1 untouched");

        PackIsSetTestModel c = (PackIsSetTestModel) o.fclone();
        test(PackIsSetTestModel.P0.isSet(c) && PackIsSetTestModel.P64.isSet(c), "fclone carries the flags");

        o.clearP0();
        test(! PackIsSetTestModel.P0.isSet(o), "clearX() drops the flag");
        test(o.getP0() == 0L, "cleared property reads its default again");
        test(PackIsSetTestModel.P64.isSet(o), "clearing one bit leaves the other word alone");
      `
    },
    {
      name: 'testConcurrentSetters',
      documentation: 'Eight threads each set a different property of one object, all bits in the same word. A plain |= is a read-modify-write and drops flags; the flag write must not.',
      javaCode: `
        final PropertyInfo[] props = {
          PackIsSetTestModel.P0, PackIsSetTestModel.P1, PackIsSetTestModel.P2, PackIsSetTestModel.P3,
          PackIsSetTestModel.P4, PackIsSetTestModel.P5, PackIsSetTestModel.P6, PackIsSetTestModel.P7
        };
        final int threads = props.length;
        final int rounds  = 20000;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        AtomicInteger lost = new AtomicInteger();
        try {
          for ( int r = 0 ; r < rounds ; r++ ) {
            final PackIsSetTestModel o = new PackIsSetTestModel();
            final CyclicBarrier go = new CyclicBarrier(threads);
            Future<?>[] done = new Future<?>[threads];
            for ( int t = 0 ; t < threads ; t++ ) {
              final int i = t;
              done[t] = pool.submit(() -> {
                try { go.await(); } catch ( java.lang.Exception e ) { throw new RuntimeException(e); }
                switch ( i ) {
                  case 0: o.setP0(0L);  break;
                  case 1: o.setP1("1"); break;
                  case 2: o.setP2(2L);  break;
                  case 3: o.setP3("3"); break;
                  case 4: o.setP4(4L);  break;
                  case 5: o.setP5("5"); break;
                  case 6: o.setP6(6L);  break;
                  default: o.setP7("7");
                }
              });
            }
            for ( Future<?> f : done ) {
              try { f.get(); } catch ( java.lang.Exception e ) { throw new RuntimeException(e); }
            }
            for ( PropertyInfo p : props ) if ( ! p.isSet(o) ) lost.incrementAndGet();
          }
        } finally {
          pool.shutdown();
        }
        test(lost.get() == 0, "concurrent setters on different properties keep every flag (lost " + lost.get() + " of " + (rounds * threads) + ")");
      `
    }
  ]
});
