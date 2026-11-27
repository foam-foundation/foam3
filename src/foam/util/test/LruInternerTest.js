/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.util.test',
  name: 'LruInternerTest',
  extends: 'foam.core.test.Test',

  documentation: 'foam.util.LruInterner: a miss keeps the instance, a hit returns it, find never stores, eviction at capacity, promotion hands hits to the delegate, an evicted value adopts the delegate canonical; StringInterner takes a first sight from find.',

  javaImports: [
    'foam.util.Interner',
    'foam.util.JvmInterner',
    'foam.util.LruInterner',
    'foam.util.StringInterner'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        long tag = System.nanoTime();
        final int[] calls = { 0 };
        Interner counting = s -> { calls[0]++; return s; };

        // never promotes: the LRU alone
        LruInterner lru = new LruInterner(1024, 1 << 30, counting);
        String v = "code-" + tag;
        test(lru.find(v) == null, "find on an empty LRU returns null");
        test(lru.find(v) == null && lru.size() == 0, "find never stores");
        String a = new String(v);
        test(lru.intern(a) == a, "a miss returns the instance it is given");
        test(lru.intern(new String(v)) == a, "a hit returns the stored canonical, not the new instance");
        test(lru.find(new String(v)) == a, "find returns the stored canonical");
        test(calls[0] == 0, "no promotion, no delegate call (calls " + calls[0] + ")");
        test(lru.intern(null) == null && lru.find(null) == null, "null passes through");

        // eviction: past capacity the oldest value is gone, its next instance starts over
        LruInterner small = new LruInterner(32, 1 << 30, counting);
        String old = new String("old-" + tag);
        small.intern(old);
        for ( int i = 0 ; i < 10000 ; i++ ) small.intern("filler-" + tag + "-" + i);
        String back = new String("old-" + tag);
        test(small.find(back) == null && small.intern(back) == back, "an evicted value comes back as the new instance");
        test(small.size() <= 32, "size stays within capacity (size " + small.size() + ")");

        // promoteOneIn 1: every hit reaches the delegate, a miss never does
        calls[0] = 0;
        LruInterner always = new LruInterner(1024, 1, counting);
        always.intern(new String("promote-" + tag));
        test(calls[0] == 0, "a miss does not call the delegate");
        always.intern(new String("promote-" + tag));
        always.intern(new String("promote-" + tag));
        test(calls[0] == 2, "each hit calls the delegate once (calls " + calls[0] + ")");

        // the delegate already holds another canonical: the LRU adopts it
        final String held = new String("held-" + tag);
        LruInterner adopt = new LruInterner(1024, 1, s -> s.equals(held) ? held : s);
        adopt.intern(new String("held-" + tag));
        test(adopt.intern(new String("held-" + tag)) == held, "promotion returns the delegate's canonical");
        test(adopt.find(new String("held-" + tag)) == held, "the LRU then holds the adopted canonical");

        // the real chain: a value that keeps coming back ends up in the JVM table
        LruInterner chain = new LruInterner(1024, 16, JvmInterner.INSTANCE);
        String got = null;
        for ( int i = 0 ; i < 1000 ; i++ ) got = chain.intern(new String("hot-" + tag));
        test(got.intern() == got, "after 1000 hits at 1 in 16 the canonical is the JVM table's");

        // two replays sharing one LRU: the second replay's FIRST sight takes the first replay's canonical
        LruInterner shared = new LruInterner(1024, 1 << 30, s -> s);
        StringInterner replayA = new StringInterner(shared), replayB = new StringInterner(shared);
        String inA = new String("shared-" + tag);
        replayA.intern(inA);
        replayA.intern(new String("shared-" + tag));
        test(replayB.intern(new String("shared-" + tag)) == inA, "another replay's first sight returns the canonical the LRU holds");
        String once = new String("once-" + tag);
        replayA.intern(once);
        test(shared.find(once) == null, "a value seen once never enters the LRU");
      `
    }
  ]
});
