/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.index.test',
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
    'foam.dao.BulkLoadDAO',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.dao.index.AndOrderStatus',
    'foam.lang.FObject',
    'foam.lang.Indexer',
    'foam.lang.PropertyInfo',
    'foam.dao.index.TreeNode',
    'foam.mlang.order.Comparator',
    'foam.mlang.predicate.Predicate',
    'foam.mlang.sink.Count',
    'foam.mlang.sink.GroupBy',
    'java.util.ArrayList',
    'java.util.Collections',
    'java.util.List',
    'static foam.mlang.MLang.*'
  ],

  properties: [
    {
      name: 'onlyReportFailed',
      value: true
    },
    {
      class: 'Boolean',
      name: 'bulk_',
      transient: true,
      hidden: true,
      documentation: `Whether build() adds the index after the rows, so the index
        is built from them in one pass, rather than before them, so it is filled
        one put at a time.`
    },
    {
      class: 'String',
      name: 'shapeError_',
      transient: true,
      hidden: true,
      documentation: 'The first thing checkShape found wrong with a tree, if any.'
    }
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        for ( int pass = 0 ; pass < 2 ; pass++ ) {
          setBulk_(pass == 1);

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
        }

        // Ranges too small to have an interesting shape, and a key every
        // row shares, are where an off-by-one in the split lands.
        setBulk_(true);
        checkSmall(x);
        checkStaged(x);
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
        MDAO idx   = build(x, new Indexer[] { prop });

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
        test(pg.equals(ig), tag() + label + " / GROUP_BY buckets: indexed=" + ig + " plain=" + pg);

        checkShape(x, idx, prop, label);
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
        MDAO idx   = build(x, new Indexer[] { IndexKeyRecord.WHEN });

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
        MDAO idx   = build(x, new Indexer[] { IndexKeyRecord.STATUS, IndexKeyRecord.NAME });

        checkShape(x, idx, IndexKeyRecord.STATUS, "compound(status,name)");

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
        MDAO idx   = build(x, new Indexer[] { (Indexer) DOT(IndexKeyRecord.REF, IndexKeyRecord.NAME) });

        checkShape(x, idx, (Indexer) DOT(IndexKeyRecord.REF, IndexKeyRecord.NAME), "Dot(ref,name)");

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
      type: 'foam.dao.index.test.IndexKeyRecord',
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
        MDAO idx   = build(x, new Indexer[] { prop });

        long[] order = { 4, 2, 7, 1, 6, 3, 8, 5, 11, 9, 12, 10 };
        for ( int i = 0 ; i < order.length ; i++ ) {
          FObject victim = idx.inX(x).find(order[i]);
          test(victim != null, tag() + label + " / remove: row " + order[i] + " present before removal");
          if ( victim == null ) return;

          plain.inX(x).remove(victim);
          idx.inX(x).remove(victim);

          expect(x, plain, idx, TRUE, prop, label + " / after removing " + order[i]);
          checkShape(x, idx, prop, label + " / after removing " + order[i]);

          // Every surviving row must still be reachable through the index by
          // its own key, which is what a key moved onto the wrong node breaks.
          List survivors = ((ArraySink) plain.inX(x).select(new ArraySink())).getArray();
          for ( Object o : survivors ) {
            Object k = prop.f(o);
            long   n = count(x, idx, EQ(prop, k));
            long   p = count(x, plain, EQ(prop, k));
            if ( n != p ) {
              test(false, tag() + label + " / after removing " + order[i] + ": EQ(" + k
                + ") indexed=" + n + " plain=" + p);
              return;
            }
          }
        }

        test(count(x, idx, TRUE) == 0, tag() + label + " / remove: index empty at the end");

        // Removing from an empty index must be a no-op, not a failure.
        IndexKeyRecord ghost = mk(999, 999, "ghost", null, AndOrderStatus.INIT);
        idx.inX(x).remove(ghost);
        test(count(x, idx, TRUE) == 0, tag() + label + " / remove: removing from an empty index is a no-op");
      `
    },

    {
      name: 'checkUpdate',
      args: 'X x',
      documentation: 'A put that changes an indexed value removes then re-adds.',
      javaCode: `
        MDAO plain = build(x, null);
        MDAO idx   = build(x, new Indexer[] { IndexKeyRecord.GROUP_ID });

        IndexKeyRecord moved = mk(3, 77, "alpha", null, AndOrderStatus.INIT);
        plain.inX(x).put(moved);
        idx.inX(x).put(moved);

        checkShape(x, idx, IndexKeyRecord.GROUP_ID, "update");

        expect(x, plain, idx, TRUE, IndexKeyRecord.GROUP_ID, "update / all");
        expect(x, plain, idx, EQ(IndexKeyRecord.GROUP_ID, 77L), IndexKeyRecord.ID, "update / new key");
        expect(x, plain, idx, EQ(IndexKeyRecord.GROUP_ID, 10L), IndexKeyRecord.ID, "update / old key");
      `
    },

    {
      name: 'checkStaged',
      args: 'X x',
      documentation: `An index built from every row at once has to answer as one
        filled a row at a time. The rows are collected the way JDAO collects
        them, in a BulkLoadDAO, because a journal replay looks each entry up
        before writing it so the entry can be merged onto the row already
        there.`,
      javaCode: `
        MDAO plain = build(x, new Indexer[] { IndexKeyRecord.GROUP_ID });

        MDAO staged = new MDAO(IndexKeyRecord.getOwnClassInfo());
        staged.addIndex(IndexKeyRecord.GROUP_ID);

        BulkLoadDAO load = new BulkLoadDAO(x, IndexKeyRecord.getOwnClassInfo());

        long day = 86400000L;
        long t0  = 1700000000000L;
        load.put_(x, mk(1,  10, "alpha",   d(t0),           AndOrderStatus.INIT));
        load.put_(x, mk(2,  10, "bravo",   d(t0 + day),     AndOrderStatus.INIT));
        load.put_(x, mk(3,  10, "alpha",   d(t0 + 2 * day), AndOrderStatus.WITHDRAWN));
        load.put_(x, mk(4,  20, "charlie", d(t0 + 3 * day), AndOrderStatus.WITHDRAWN));

        // Read back what was just written, the way a replay does before merging.
        FObject back = load.inX(x).find(2L);
        test(back != null && ((IndexKeyRecord) back).getName().equals("bravo"),
          "staged / a row put during the load is found during the load");
        test(load.inX(x).find(99L) == null,
          "staged / a row that was never put is not found during the load");

        // A row written twice keeps the later value, and one removed goes away.
        load.put_(x, mk(4,  20, "charlie", d(t0 + 3 * day), AndOrderStatus.EXCLUDED));
        load.put_(x, mk(5,  20, "bravo",   null,            AndOrderStatus.EXCLUDED));
        load.remove_(x, mk(5, 20, "bravo", null, AndOrderStatus.EXCLUDED));

        load.put_(x, mk(5,  20, "bravo",   null,            AndOrderStatus.EXCLUDED));
        load.put_(x, mk(6,  20, "",        d(t0 + day),     AndOrderStatus.INIT));
        load.put_(x, mk(7,  30, "delta",   d(t0 + 4 * day), AndOrderStatus.EXCLUDED));
        load.put_(x, mk(8,  30, "alpha",   null,            AndOrderStatus.INIT));
        load.put_(x, mk(9,  30, "echo",    d(t0 + 2 * day), AndOrderStatus.WITHDRAWN));
        load.put_(x, mk(10, 40, "bravo",   d(t0 + 5 * day), AndOrderStatus.INIT));
        load.put_(x, mk(11, 40, "foxtrot", d(t0),           AndOrderStatus.EXCLUDED));
        load.put_(x, mk(12, 50, "golf",    d(t0 + 6 * day), AndOrderStatus.WITHDRAWN));

        staged.bulkLoad(load.rows());

        expect(x, plain, staged, TRUE, IndexKeyRecord.GROUP_ID, "staged / all");
        checkShape(x, staged, IndexKeyRecord.GROUP_ID, "staged");

        IndexKeyRecord moved = mk(3, 77, "alpha", null, AndOrderStatus.INIT);
        plain.inX(x).put(moved);
        staged.inX(x).put(moved);
        expect(x, plain, staged, EQ(IndexKeyRecord.GROUP_ID, 77L), IndexKeyRecord.ID, "staged / put after the load");
        checkShape(x, staged, IndexKeyRecord.GROUP_ID, "staged / after a put");

        // A DAO that already holds rows declines, rather than dropping them.
        BulkLoadDAO second = new BulkLoadDAO(x, IndexKeyRecord.getOwnClassInfo());
        second.put_(x, mk(13, 60, "hotel", d(t0), AndOrderStatus.INIT));
        staged.bulkLoad(second.rows());
        test(staged.inX(x).find(13L) == null,
          "staged / a second load is declined");
        expect(x, plain, staged, TRUE, IndexKeyRecord.GROUP_ID, "staged / the declined load left the rows alone");

        // A journal with nothing in it leaves the DAO exactly as it was.
        MDAO empty = new MDAO(IndexKeyRecord.getOwnClassInfo());
        empty.addIndex(IndexKeyRecord.GROUP_ID);
        empty.bulkLoad(new BulkLoadDAO(x, IndexKeyRecord.getOwnClassInfo()).rows());
        empty.inX(x).put(mk(1, 10, "alpha", d(t0), AndOrderStatus.INIT));
        test(empty.inX(x).find(1L) != null,
          "staged / an empty load leaves a DAO that still takes puts");
      `
    },

    {
      name: 'checkSmall',
      args: 'X x',
      documentation: `Every range small enough for the split to be off by one,
        and a key every row shares so the whole tree is a single node holding a
        sub-index. Each one is read back and then mutated row by row, because a
        tree with the wrong node levels reads correctly and only comes apart on
        the next remove.`,
      javaCode: `
        for ( int n = 0 ; n <= 8 ; n++ ) {
          checkRows(x, n, false, "distinct keys x" + n);
          checkRows(x, n, true,  "one shared key x" + n);
        }
      `
    },

    {
      name: 'checkRows',
      args: 'X x, int n, boolean sameKey, String label',
      javaCode: `
        MDAO plain = new MDAO(IndexKeyRecord.getOwnClassInfo());
        MDAO idx   = new MDAO(IndexKeyRecord.getOwnClassInfo());

        for ( int i = 1 ; i <= n ; i++ ) {
          IndexKeyRecord r = mk(i, sameKey ? 1 : i, "n" + ( sameKey ? 1 : i ), null, AndOrderStatus.INIT);
          plain.put_(x, r);
          idx.put_(x, r);
        }
        idx.addIndex(IndexKeyRecord.GROUP_ID);

        expect(x, plain, idx, TRUE, IndexKeyRecord.GROUP_ID, label);
        checkShape(x, idx, IndexKeyRecord.GROUP_ID, label);

        String pg = groups(x, plain, IndexKeyRecord.GROUP_ID), ig = groups(x, idx, IndexKeyRecord.GROUP_ID);
        test(pg.equals(ig), tag() + label + " / GROUP_BY buckets: indexed=" + ig + " plain=" + pg);

        // Remove from the middle out so both the predecessor and the successor
        // substitution run against a tree nothing has rebalanced yet.
        for ( int i = ( n + 1 ) / 2 ; i >= 1 ; i-- ) {
          FObject victim = idx.inX(x).find((long) i);
          if ( victim == null ) {
            test(false, tag() + label + " / row " + i + " missing before removal");
            return;
          }
          plain.inX(x).remove(victim);
          idx.inX(x).remove(victim);
          expect(x, plain, idx, TRUE, IndexKeyRecord.GROUP_ID, label + " / after removing " + i);
          checkShape(x, idx, IndexKeyRecord.GROUP_ID, label + " / after removing " + i);
        }
      `
    },

    {
      name: 'checkShape',
      args: 'X x, foam.dao.MDAO idx, foam.lang.Indexer indexer, String label',
      documentation: `Read the secondary index's tree out of the MDAO and assert
        the AA invariants and the stored sizes on it directly.

        Counts and ordered ids cannot see either. A node whose level is wrong is
        still a correctly ordered binary search tree, and skew and split rotate
        it back into shape on the next write, so a tree built as a list answers
        every query correctly and merely costs O(n) to search. The only way to
        catch that is to look at the tree.`,
      javaCode: `
        // addIndex on a DAO holding nothing leaves the new index without state
        // at all, so there is no tree to look at and nothing to check.
        long held = count(x, idx, TRUE);
        if ( held == 0 ) return;

        Object state = idx.cmd_(x, MDAO.NOW_CMD);
        if ( ! ( state instanceof Object[] ) || ((Object[]) state).length < 2 ) {
          test(false, tag() + label + " / shape: the secondary index has no state");
          return;
        }

        setShapeError_("");
        List keys = new ArrayList();
        long rows = walk((TreeNode) ((Object[]) state)[1], indexer, keys);

        // One node per distinct key: a repeated key has to share a node holding
        // a sub-index, not sit in a second node the searches never reach.
        for ( int i = 1 ; i < keys.size() ; i++ ) {
          if ( indexer.comparePropertyToValue(keys.get(i-1), keys.get(i)) >= 0 ) {
            note("key " + keys.get(i) + " repeats or falls out of order");
            break;
          }
        }

        if ( rows != held ) note("the tree holds " + rows + " rows where the DAO holds " + held);

        boolean ok = foam.util.SafetyUtil.isEmpty(getShapeError_());
        test(ok, tag() + label + " / shape: "
          + ( ok ? "AA invariants, key order and sizes all hold" : getShapeError_() ));
      `
    },

    {
      name: 'walk',
      args: 'foam.dao.index.TreeNode n, foam.lang.Indexer indexer, java.util.List keys',
      type: 'Long',
      documentation: `Rows stored under n, checking the AA invariants and n's
        recorded size on the way and collecting the keys in order. A node holds
        no key of its own, so each one is read back off the rows under it.`,
      javaCode: `
        if ( n == null ) return 0;

        TreeNode l = n.getLeft(), r = n.getRight();

        if ( n.getLevel() < 1 )
          note("level " + n.getLevel() + " is below 1");
        if ( l != null && l.getLevel() != n.getLevel() - 1 )
          note("a left child at level " + l.getLevel() + " under level " + n.getLevel());
        if ( r != null && r.getLevel() != n.getLevel() && r.getLevel() != n.getLevel() - 1 )
          note("a right child at level " + r.getLevel() + " under level " + n.getLevel());
        if ( r != null && r.getRight() != null && r.getRight().getLevel() >= n.getLevel() )
          note("two horizontal right links in a row at level " + n.getLevel());

        // The fifth AA invariant - a node above level 1 has two children - is
        // deliberately not asserted. removeNode splices a node out without
        // rebalancing or lowering a level (TreeNode.removeNode), so a tree that
        // has had rows removed already breaks it, on the row-by-row path as much
        // as the bulk one. Levels 1 to 4 are what bound the search depth.

        long under = walk(l, indexer, keys);
        keys.add(n.nodeKey(indexer));

        Object v = n.getValue();
        under += v instanceof TreeNode ? ((TreeNode) v).getSize() : ( v == null ? 0 : 1 );
        under += walk(r, indexer, keys);

        if ( n.getSize() != under )
          note("a node recording size " + n.getSize() + " with " + under + " rows under it");

        return under;
      `
    },

    {
      name: 'note',
      args: 'String msg',
      documentation: 'Keep the first thing that went wrong; the rest follow from it.',
      javaCode: 'if ( foam.util.SafetyUtil.isEmpty(getShapeError_()) ) setShapeError_(msg);'
    },

    {
      name: 'tag',
      type: 'String',
      documentation: 'Which pass a failure came from, so the two are told apart.',
      javaCode: 'return getBulk_() ? "bulk / " : "incremental / ";'
    },

    {
      name: 'expect',
      args: 'X x, foam.dao.MDAO plain, foam.dao.MDAO idx, foam.mlang.predicate.Predicate p, foam.lang.PropertyInfo order, String label',
      documentation: `Assert the indexed and un-indexed DAO agree on count, on
        ordered ids, and on a limited count.

        The limited count is the one that reads a node's stored size rather than
        the rows under it, so a size that leaves out the node's own rows is only
        visible here and in the counts the tree answers from a narrowed state.`,
      javaCode: `
        label = tag() + label;

        long pc = count(x, plain, p), ic = count(x, idx, p);
        test(pc == ic, label + " / count: indexed=" + ic + " plain=" + pc);

        String pi = ids(x, plain, p, order), ii = ids(x, idx, p, order);
        test(pi.equals(ii), label + " / ordered ids: indexed=[" + ii + "] plain=[" + pi + "]");

        long[] limits = { 0, 1, 3, 7 };
        for ( int i = 0 ; i < limits.length ; i++ ) {
          long pl = ((Count) plain.inX(x).where(p).limit(limits[i]).select(new Count())).getValue();
          long il = ((Count) idx.inX(x).where(p).limit(limits[i]).select(new Count())).getValue();
          if ( pl != il ) {
            test(false, label + " / count limit=" + limits[i] + ": indexed=" + il + " plain=" + pl);
            return;
          }
        }
      `
    },

    {
      name: 'build',
      args: 'X x, foam.lang.Indexer[] indexers',
      type: 'foam.dao.MDAO',
      documentation: `Twelve rows. groupId and name repeat so a non-unique index
        nests sub-trees; two rows leave the date unset; one name is empty.

        The index goes on after the rows when bulk_ is set, which is what an
        EasyDAO does - the journal replays first and the secondary indexes are
        added to a DAO that already holds every row.`,
      javaCode: `
        MDAO dao = new MDAO(IndexKeyRecord.getOwnClassInfo());
        if ( indexers != null && ! getBulk_() ) dao.addIndex(indexers);

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

        if ( indexers != null && getBulk_() ) dao.addIndex(indexers);

        return dao;
      `
    },

    {
      name: 'mk',
      args: 'long id, long groupId, String name, java.util.Date when, foam.dao.index.AndOrderStatus status',
      type: 'foam.dao.index.test.IndexKeyRecord',
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
