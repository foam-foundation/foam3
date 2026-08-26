/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.index',
  name: 'MDAOIndexKeyTest',
  extends: 'foam.core.test.Test',

  documentation: `A tree index must answer every query the same way whether or
    not the index exists. Each case here builds two MDAOs over identical rows -
    one with only the primary id index, one with the secondary index under test -
    and asserts the two agree on counts, ordered ids and group-by buckets. That
    makes the un-indexed DAO the oracle, so no expected value is hard-coded and
    the assertions survive a change to the fixture.

    The interesting cases are the ones where a key is not simply a reference the
    record already holds: a primitive-backed Long, a Date that may be unset, and
    a Dot over an unset intermediate. Delete is covered row by row because the
    AA-tree substitutes a predecessor or successor into the removed node's place,
    which moves a key between nodes.`,

  javaImports: [
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.lang.FObject',
    'foam.lang.Indexer',
    'foam.lang.PropertyInfo',
    'foam.mlang.order.Comparator',
    'foam.mlang.predicate.Predicate',
    'foam.mlang.sink.Count',
    'foam.mlang.sink.GroupBy',
    'java.util.ArrayList',
    'java.util.Collections',
    'java.util.List',
    'static foam.mlang.MLang.*'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        // Long key, values deliberately repeating so nodes carry sub-trees.
        checkKey(x, IndexKeyRecord.GROUP_ID, 4, 1, "Long groupId");

        // String key: the key is the record's own reference, plus duplicates
        // and an empty string.
        checkKey(x, IndexKeyRecord.NAME, 2, 1, "String name");

        // Date key, with two rows whose date is unset. A null-unsafe key
        // comparison fails on those.
        checkKey(x, IndexKeyRecord.WHEN, 2, 1, "Date when");

        // Enum key: a singleton, so the derived key must be identity-equal.
        checkKey(x, IndexKeyRecord.STATUS, 3, 1, "Enum status");

        checkNullKey(x);
        checkCompound(x);
        checkDot(x);
        checkRemove(x, IndexKeyRecord.GROUP_ID, "Long groupId");
        checkRemove(x, IndexKeyRecord.WHEN,     "Date when");
        checkUpdate(x);
      `
    },

    {
      name: 'checkKey',
      args: 'X x, foam.lang.PropertyInfo prop, long eqRow, long midRow, String label',
      documentation: `Run the read battery against an indexed and an un-indexed
        DAO. The two query keys are read back off stored rows rather than written
        as literals, so they are already in whatever form the property stores -
        a Date property normalizes its value on write, and feeding a raw literal
        in would be testing that normalization rather than key derivation.`,
      javaCode: `
        MDAO plain = build(x, null);
        MDAO idx   = build(x, prop);

        Object eqKey  = prop.f(plain.inX(x).find(eqRow));
        Object midKey = prop.f(plain.inX(x).find(midRow));

        expect(x, plain, idx, TRUE,                 prop, label + " / all");
        expect(x, plain, idx, EQ(prop,  eqKey),     prop, label + " / EQ");
        expect(x, plain, idx, GT(prop,  midKey),    prop, label + " / GT");
        expect(x, plain, idx, GTE(prop, midKey),    prop, label + " / GTE");
        expect(x, plain, idx, LT(prop,  midKey),    prop, label + " / LT");
        expect(x, plain, idx, LTE(prop, midKey),    prop, label + " / LTE");
        expect(x, plain, idx, NEQ(prop, eqKey),     prop, label + " / NEQ");

        // GroupBy keys the buckets in a HashMap, so a derived key has to be
        // equal - not just equivalent - to the key the node used to store.
        String pg = groups(x, plain, prop), ig = groups(x, idx, prop);
        test(pg.equals(ig), label + " / GROUP_BY buckets: indexed=" + ig + " plain=" + pg);
      `
    },

    {
      name: 'checkNullKey',
      args: 'X x',
      documentation: `Two rows leave the date unset, so their index key is null.
        A null key has to match the same rows through the index as through a
        scan, with no removals involved.`,
      javaCode: `
        MDAO plain = build(x, null);
        MDAO idx   = build(x, IndexKeyRecord.WHEN);

        expect(x, plain, idx, EQ(IndexKeyRecord.WHEN, null),  IndexKeyRecord.ID, "null key / EQ");
        expect(x, plain, idx, NEQ(IndexKeyRecord.WHEN, null), IndexKeyRecord.ID, "null key / NEQ");
        expect(x, plain, idx, HAS(IndexKeyRecord.WHEN),       IndexKeyRecord.ID, "null key / HAS");
      `
    },

    {
      name: 'checkCompound',
      args: 'X x',
      documentation: `A compound index nests one tree inside another, so the
        outer level's node holds a sub-tree rather than a record.`,
      javaCode: `
        MDAO plain = build(x, null);
        MDAO idx   = build(x, null);
        idx.addIndex(IndexKeyRecord.STATUS, IndexKeyRecord.NAME);

        expect(x, plain, idx, TRUE, IndexKeyRecord.NAME, "compound(status,name) / all");
        expect(x, plain, idx, EQ(IndexKeyRecord.STATUS, AndOrderStatus.INIT),
          IndexKeyRecord.NAME, "compound(status,name) / EQ outer");
        expect(x, plain, idx,
          AND(EQ(IndexKeyRecord.STATUS, AndOrderStatus.INIT), EQ(IndexKeyRecord.NAME, "alpha")),
          IndexKeyRecord.NAME, "compound(status,name) / EQ both");
      `
    },

    {
      name: 'checkDot',
      args: 'X x',
      documentation: `Dot is the only Indexer that is not a PropertyInfo. The
        twelve seeded rows all leave ref unset, so the key is underivable; the
        rows added here set it, so the nested name is what orders them. Both
        have to answer exactly as no index would.`,
      javaCode: `
        MDAO plain = build(x, null);
        MDAO idx   = build(x, null);
        idx.addIndex((Indexer) DOT(IndexKeyRecord.REF, IndexKeyRecord.NAME));

        expect(x, plain, idx, TRUE, IndexKeyRecord.ID, "Dot(ref,name) / all");
        expect(x, plain, idx, EQ(IndexKeyRecord.NAME, "alpha"), IndexKeyRecord.ID,
          "Dot(ref,name) / EQ on another property");

        dotSeed(x, plain);
        dotSeed(x, idx);

        expect(x, plain, idx, TRUE, IndexKeyRecord.ID,
          "Dot(ref,name) / refs set and unset together");
        expect(x, plain, idx, EQ(IndexKeyRecord.NAME, "zulu"), IndexKeyRecord.ID,
          "Dot(ref,name) / EQ with refs set");

        // Remove reaches the tree through the same comparison, and a promotion
        // has to locate the node it took the value from.
        plain.remove_(x, mk(22, 20, "yankee", null, AndOrderStatus.INIT));
        idx.remove_(x, mk(22, 20, "yankee", null, AndOrderStatus.INIT));
        expect(x, plain, idx, TRUE, IndexKeyRecord.ID,
          "Dot(ref,name) / after removing a row with ref set");
      `
    },

    {
      name: 'dotSeed',
      args: 'X x, foam.dao.MDAO dao',
      documentation: `Four rows with ref set, three of them sharing a nested
        name so the Dot index nests sub-trees, and one pointing at a target
        whose own name is unset.`,
      javaCode: `
        dao.put_(x, ref(21, "zulu",   "delta"));
        dao.put_(x, ref(22, "yankee", "alpha"));
        dao.put_(x, ref(23, "xray",   "alpha"));
        dao.put_(x, ref(24, "whisky", null));
      `
    },

    {
      name: 'ref',
      args: 'long id, String name, String refName',
      type: 'foam.dao.index.IndexKeyRecord',
      documentation: 'A null refName leaves the target\'s own name unset.',
      javaCode: `
        IndexKeyRecord target = new IndexKeyRecord();
        target.setId(id + 1000);
        if ( refName != null ) target.setName(refName);

        IndexKeyRecord r = mk(id, 20, name, null, AndOrderStatus.INIT);
        r.setRef(target);
        return r;
      `
    },

    {
      name: 'checkRemove',
      args: 'X x, foam.lang.PropertyInfo prop, String label',
      documentation: `Remove one row at a time in a shuffled order so both the
        predecessor and the successor substitution paths run, checking after
        every removal rather than only at the end.`,
      javaCode: `
        MDAO plain = build(x, null);
        MDAO idx   = build(x, prop);

        long[] order = { 4, 2, 7, 1, 6, 3, 8, 5, 11, 9, 12, 10 };
        for ( int i = 0 ; i < order.length ; i++ ) {
          FObject victim = idx.inX(x).find(order[i]);
          test(victim != null, label + " / remove: row " + order[i] + " present before removal");
          if ( victim == null ) return;

          plain.inX(x).remove(victim);
          idx.inX(x).remove(victim);

          expect(x, plain, idx, TRUE, prop, label + " / after removing " + order[i]);

          // Every surviving row must still be reachable through the index by
          // its own key, which is what a key moved onto the wrong node breaks.
          List survivors = ((ArraySink) plain.inX(x).select(new ArraySink())).getArray();
          for ( Object o : survivors ) {
            Object k = prop.f(o);
            long   n = count(x, idx, EQ(prop, k));
            long   p = count(x, plain, EQ(prop, k));
            if ( n != p ) {
              test(false, label + " / after removing " + order[i] + ": EQ(" + k
                + ") indexed=" + n + " plain=" + p);
              return;
            }
          }
        }

        test(count(x, idx, TRUE) == 0, label + " / remove: index empty at the end");

        // Removing from an empty index must be a no-op, not a failure.
        IndexKeyRecord ghost = mk(999, 999, "ghost", null, AndOrderStatus.INIT);
        idx.inX(x).remove(ghost);
        test(count(x, idx, TRUE) == 0, label + " / remove: removing from an empty index is a no-op");
      `
    },

    {
      name: 'checkUpdate',
      args: 'X x',
      documentation: 'A put that changes an indexed value removes then re-adds.',
      javaCode: `
        MDAO plain = build(x, null);
        MDAO idx   = build(x, IndexKeyRecord.GROUP_ID);

        IndexKeyRecord moved = mk(3, 77, "alpha", null, AndOrderStatus.INIT);
        plain.inX(x).put(moved);
        idx.inX(x).put(moved);

        expect(x, plain, idx, TRUE, IndexKeyRecord.GROUP_ID, "update / all");
        expect(x, plain, idx, EQ(IndexKeyRecord.GROUP_ID, 77L), IndexKeyRecord.ID, "update / new key");
        expect(x, plain, idx, EQ(IndexKeyRecord.GROUP_ID, 10L), IndexKeyRecord.ID, "update / old key");
      `
    },

    {
      name: 'expect',
      args: 'X x, foam.dao.MDAO plain, foam.dao.MDAO idx, foam.mlang.predicate.Predicate p, foam.lang.PropertyInfo order, String label',
      documentation: 'Assert the indexed and un-indexed DAO agree on count and on ordered ids.',
      javaCode: `
        long pc = count(x, plain, p), ic = count(x, idx, p);
        test(pc == ic, label + " / count: indexed=" + ic + " plain=" + pc);

        String pi = ids(x, plain, p, order), ii = ids(x, idx, p, order);
        test(pi.equals(ii), label + " / ordered ids: indexed=[" + ii + "] plain=[" + pi + "]");
      `
    },

    {
      name: 'build',
      args: 'X x, foam.lang.PropertyInfo index',
      type: 'foam.dao.MDAO',
      documentation: `Twelve rows. groupId and name repeat so a non-unique index
        nests sub-trees; two rows leave the date unset; one name is empty.`,
      javaCode: `
        MDAO dao = new MDAO(IndexKeyRecord.getOwnClassInfo());
        if ( index != null ) dao.addIndex(index);

        long day = 86400000L;
        long t0  = 1700000000000L;

        dao.put_(x, mk(1,  10, "alpha",   d(t0),           AndOrderStatus.INIT));
        dao.put_(x, mk(2,  10, "bravo",   d(t0 + day),     AndOrderStatus.INIT));
        dao.put_(x, mk(3,  10, "alpha",   d(t0 + 2 * day), AndOrderStatus.WITHDRAWN));
        dao.put_(x, mk(4,  20, "charlie", d(t0 + 3 * day), AndOrderStatus.WITHDRAWN));
        dao.put_(x, mk(5,  20, "bravo",   null,            AndOrderStatus.EXCLUDED));
        dao.put_(x, mk(6,  20, "",        d(t0 + day),     AndOrderStatus.INIT));
        dao.put_(x, mk(7,  30, "delta",   d(t0 + 4 * day), AndOrderStatus.EXCLUDED));
        dao.put_(x, mk(8,  30, "alpha",   null,            AndOrderStatus.INIT));
        dao.put_(x, mk(9,  30, "echo",    d(t0 + 2 * day), AndOrderStatus.WITHDRAWN));
        dao.put_(x, mk(10, 40, "bravo",   d(t0 + 5 * day), AndOrderStatus.INIT));
        dao.put_(x, mk(11, 40, "foxtrot", d(t0),           AndOrderStatus.EXCLUDED));
        dao.put_(x, mk(12, 50, "golf",    d(t0 + 6 * day), AndOrderStatus.WITHDRAWN));

        return dao;
      `
    },

    {
      name: 'mk',
      args: 'long id, long groupId, String name, java.util.Date when, foam.dao.index.AndOrderStatus status',
      type: 'foam.dao.index.IndexKeyRecord',
      documentation: 'A null when leaves the date property unset.',
      javaCode: `
        IndexKeyRecord r = new IndexKeyRecord();
        r.setId(id);
        r.setGroupId(groupId);
        r.setName(name);
        r.setStatus(status);
        if ( when != null ) r.setWhen(when);
        return r;
      `
    },

    {
      name: 'd',
      args: 'long millis',
      type: 'java.util.Date',
      javaCode: 'return new java.util.Date(millis);'
    },

    {
      name: 'count',
      args: 'X x, foam.dao.DAO dao, foam.mlang.predicate.Predicate p',
      type: 'Long',
      javaCode: 'return ((Count) dao.inX(x).where(p).select(new Count())).getValue();'
    },

    {
      name: 'ids',
      args: 'X x, foam.dao.DAO dao, foam.mlang.predicate.Predicate p, foam.lang.PropertyInfo order',
      type: 'String',
      documentation: `Ids in index order. Ties on the ordered property are broken
        by id so the comparison stays deterministic.`,
      javaCode: `
        List rows = ((ArraySink) dao.inX(x).where(p)
          .orderBy(THEN_BY(order, IndexKeyRecord.ID)).select(new ArraySink())).getArray();

        StringBuilder sb = new StringBuilder();
        for ( Object o : rows ) {
          if ( sb.length() > 0 ) sb.append(',');
          sb.append(((IndexKeyRecord) o).getId());
        }
        return sb.toString();
      `
    },

    {
      name: 'groups',
      args: 'X x, foam.dao.DAO dao, foam.lang.PropertyInfo prop',
      type: 'String',
      documentation: `Bucket key and count per group, sorted by the key's string
        form because getGroups() is a HashMap and its iteration order is not
        stable across runs.`,
      javaCode: `
        GroupBy g = (GroupBy) dao.inX(x).select(GROUP_BY(prop, COUNT()));

        List<String> out = new ArrayList<String>();
        for ( Object k : g.getGroups().keySet() ) {
          Count c = (Count) g.getGroups().get(k);
          out.add(String.valueOf(k) + "=" + c.getValue());
        }
        Collections.sort(out);
        return String.join(" ", out);
      `
    }
  ]
});
