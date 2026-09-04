/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.index.test',
  name: 'MDAOBulkLoadTest',
  extends: 'foam.core.test.JSTest',

  documentation: `An index built from all the rows at once has to answer as one
    filled a row at a time, and has to survive being written to afterwards.

    The un-indexed reads are checked against a DAO loaded row by row, so no
    expected value is written down here. The tree itself is checked separately,
    because reads cannot see its shape: a node at the wrong level is still a
    correctly ordered binary search tree, and skew and split rotate it back into
    shape on the next write, so a tree built as a list answers every query
    correctly and merely costs O(n) to search.

    Sizes 0 to 9 are covered because that is the range where the split between
    the two sub-trees is off by one, and each size is run twice - once with a key
    per row and once with a single key every row shares, which is the case that
    puts every row in one node's sub-index.`,

  requires: [
    'foam.dao.MDAO',
    'foam.dao.index.test.IndexKeyRecord',
    'foam.mlang.sink.Count'
  ],

  methods: [
    async function runTest(x) {
      for ( var n = 0 ; n <= 9 ; n++ ) {
        await this.check(x, n, false, 'a key per row x' + n);
        await this.check(x, n, true,  'one shared key x' + n);
      }
    },

    async function check(x, n, sameKey, label) {
      var rows  = this.rows(n, sameKey);
      var plain = this.MDAO.create({ of: this.IndexKeyRecord });
      var bulk  = this.MDAO.create({ of: this.IndexKeyRecord });

      plain.addPropertyIndex(this.IndexKeyRecord.GROUP_ID);
      bulk.addPropertyIndex(this.IndexKeyRecord.GROUP_ID);

      for ( var i = 0 ; i < rows.length ; i++ ) await plain.put(rows[i].clone());
      bulk.index.bulkLoad(rows.map(function(o) { return o.clone(); }));

      await this.same(x, plain, bulk, label);
      this.shape(x, bulk, label);

      // Removing afterwards is what a tree built at the wrong levels breaks.
      for ( var j = 1 ; j <= n ; j += 2 ) {
        var victim = this.IndexKeyRecord.create({ id: j });
        await plain.remove(victim);
        await bulk.remove(victim);
      }
      await this.same(x, plain, bulk, label + ' / after removing every other row');
    },

    async function same(x, plain, bulk, label) {
      var pc = ( await plain.select(this.Count.create()) ).value;
      var bc = ( await bulk.select(this.Count.create()) ).value;
      x.test(pc === bc, label + ' / count: bulk=' + bc + ' row by row=' + pc);

      var props = [ this.IndexKeyRecord.ID, this.IndexKeyRecord.GROUP_ID ];
      for ( var i = 0 ; i < props.length ; i++ ) {
        var p = await this.ids(plain, props[i]), b = await this.ids(bulk, props[i]);
        x.test(p === b, label + ' / ids by ' + props[i].name + ': bulk=[' + b + '] row by row=[' + p + ']');
      }
    },

    function shape(x, bulk, label) {
      // delegates[0] is the primary id index; the one under test was added after.
      var found = [], keys = [];
      this.walk(bulk.index.delegates[1].root, found, keys);

      for ( var i = 1 ; i < keys.length ; i++ ) {
        if ( foam.util.compare(keys[i-1], keys[i]) >= 0 ) {
          found.push('key ' + keys[i] + ' repeats or falls out of order');
          break;
        }
      }

      x.test(found.length === 0, label + ' / shape: '
        + ( found.length === 0 ? 'AA invariants, key order and sizes all hold' : found.join('; ') ));
    },

    function walk(n, found, keys) {
      // The null node is the sentinel at level 0, not a real node.
      if ( ! n || ! n.level ) return 0;

      var l = n.left  && n.left.level  ? n.left  : null;
      var r = n.right && n.right.level ? n.right : null;

      if ( l && l.level !== n.level - 1 )
        found.push('a left child at level ' + l.level + ' under level ' + n.level);
      if ( r && r.level !== n.level && r.level !== n.level - 1 )
        found.push('a right child at level ' + r.level + ' under level ' + n.level);
      if ( r && r.right && r.right.level && r.right.level >= n.level )
        found.push('two horizontal right links in a row at level ' + n.level);

      // The fifth AA invariant - a node above level 1 has two children - is not
      // asserted: removeNode splices a node out without lowering a level, so a
      // tree that has had rows removed already breaks it however it was built.

      var under = this.walk(l, found, keys);
      keys.push(n.key);
      under += n.value.size() + this.walk(r, found, keys);

      if ( n.size !== under )
        found.push('a node recording size ' + n.size + ' with ' + under + ' rows under it');

      return under;
    },

    async function ids(dao, order) {
      var s = await dao.orderBy(order).select();
      return s.array.map(function(o) { return o.id; }).join(',');
    },

    function rows(n, sameKey) {
      var a = [];
      for ( var i = 1 ; i <= n ; i++ ) {
        a.push(this.IndexKeyRecord.create({
          id:      i,
          groupId: sameKey ? 1 : i % 4,
          name:    'n' + ( i % 3 )
        }));
      }
      return a;
    }
  ]
});
