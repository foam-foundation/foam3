/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.test',
  name: 'CanonicalizeStringsTest',
  extends: 'foam.core.test.Test',

  documentation: 'CanonicalizeStrings swaps stored raw copies of interned values for the canonical, leaves everything else alone, and MDAO.swap_ refuses when the record changed underneath.',

  javaImports: [
    'foam.core.auth.User',
    'foam.dao.CanonicalizeStrings',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.dao.ProxyDAO',
    'foam.lang.X',
    'java.util.ArrayList',
    'java.util.List'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        long   tag = System.nanoTime();
        String dup = "dup-" + tag;
        String uni = "uni-" + tag;
        MDAO   mdao = new MDAO(User.getOwnClassInfo());

        // two records holding their own raw copies of one value, one record with a value nobody repeats
        User u1 = new User(); u1.setId(1); u1.setSpid(new String(dup)); mdao.put_(x, u1);
        User u2 = new User(); u2.setId(2); u2.setSpid(new String(dup)); mdao.put_(x, u2);
        User u3 = new User(); u3.setId(3); u3.setSpid(new String(uni)); mdao.put_(x, u3);
        User s1 = (User) mdao.find_(x, 1L), s2 = (User) mdao.find_(x, 2L), s3 = (User) mdao.find_(x, 3L);
        test(s1.getSpid() != s2.getSpid() && s1.getSpid().equals(s2.getSpid()), "setup: two stored records, two instances of one value");

        // the replay interner created the canonical for dup, not for uni
        List<String> canonicals = new ArrayList<>();
        canonicals.add(dup.intern());
        DAO wrapped = new ProxyDAO(x, mdao);   // the journal writes through decorators; the pass unwraps them
        new CanonicalizeStrings.Builder(x).setDao(wrapped).setCanonicals(canonicals).setJournalName("test").build().execute(x);

        User a1 = (User) mdao.find_(x, 1L), a2 = (User) mdao.find_(x, 2L), a3 = (User) mdao.find_(x, 3L);
        test(a1.getSpid() == dup.intern() && a2.getSpid() == dup.intern(), "both records now hold the canonical");
        test(a1 != s1 && a2 != s2 && a1.isFrozen() && a2.isFrozen(), "swapped records are fresh frozen clones");
        test(a3 == s3 && a3.getSpid() == s3.getSpid(), "a record with no canonical to apply is left as the same instance");

        // swap_ refuses a stale expected: a put landed in between
        User stale = (User) mdao.find_(x, 1L);
        User newer = new User(); newer.setId(1); newer.setSpid("newer-" + tag); mdao.put_(x, newer);
        User clone = (User) stale.fclone(); clone.setSpid("from-stale-" + tag);
        test( ! mdao.swap_(x, stale, clone), "swap_ refuses when the stored record is no longer the one read");
        test(("newer-" + tag).equals(((User) mdao.find_(x, 1L)).getSpid()), "the newer put survives");

        // and accepts the current one
        User cur = (User) mdao.find_(x, 1L);
        User cur2 = (User) cur.fclone(); cur2.setSpid("swapped-" + tag);
        test(mdao.swap_(x, cur, cur2) && ("swapped-" + tag).equals(((User) mdao.find_(x, 1L)).getSpid()), "swap_ replaces the record it was given");
      `
    }
  ]
});
