/**
* PAYTIC CONFIDENTIAL
*
* [2026] Paytic Inc.
* All Rights Reserved.
*
* NOTICE:  All information contained herein is, and remains
* the property of Paytic Inc.
* The intellectual and technical concepts contained
* herein are proprietary to Paytic Inc
* and may be covered by Canadian and Foreign Patents, patents
* in process, and are protected by trade secret or copyright law.
* Dissemination of this information or reproduction of this material
* is strictly forbidden unless prior written permission is obtained
* from Paytic Inc.
*/

foam.CLASS({
  package: 'foam.core.grant.test',
  name: 'GrantTest',
  extends: 'foam.core.test.JSTest',

  documentation: 'JavaScript tests for Grant permission framework: TriePermissionSet, CompoundPermissionSet, PermissionedPermissionSet, GlobalPermissionSet, RecordingPermissionSet.',

  methods: [
    function runTest(x) {
      this.testTrieAddCheck(x);
      this.testTrieWildcards(x);
      this.testTrieOverlapping(x);
      this.testTrieEdgeCases(x);
      this.testUnion(x);
      this.testCompound(x);
      this.testPermissioned(x);
      this.testGlobal(x);
      this.testRecording(x);
    },

    //
    // Part 1: TriePermissionSet — add/check (Tests 1-7)
    //
    function testTrieAddCheck(x) {
      var T = foam.core.grant.TriePermissionSet;

      // Test 1: Simple 2-segment
      var t = T.EMPTY.add('a.b');
      x.test(t.check('a.b') === true,  'T1: 2-segment add/check');

      // Test 2: Simple 3-segment
      t = T.EMPTY.add('menu.read.transactions');
      x.test(t.check('menu.read.transactions') === true, 'T2: 3-segment add/check');

      // Test 3: 4-segment (dotted ID) — the bug scenario
      t = T.EMPTY.add('menu.read.id.idd');
      x.test(t.check('menu.read.id.idd') === true, 'T3: 4-segment dotted ID');

      // Test 4: 5-segment deep
      t = T.EMPTY.add('a.b.c.d.e');
      x.test(t.check('a.b.c.d.e') === true, 'T4: 5-segment deep');

      // Test 5: Partial match fails
      t = T.EMPTY.add('menu.read.id');
      x.test(t.check('menu.read.id.idd') === false, 'T5: Partial match fails');

      // Test 6: Over-specified fails
      t = T.EMPTY.add('menu.read.id.idd');
      x.test(t.check('menu.read.id') === false, 'T6: Over-specified fails');

      // Test 7: Wrong leaf fails
      t = T.EMPTY.add('menu.read.id.idd');
      x.test(t.check('menu.read.id.xyz') === false, 'T7: Wrong leaf fails');
    },

    //
    // Part 1 continued: Wildcards (Tests 8-12)
    //
    function testTrieWildcards(x) {
      var T = foam.core.grant.TriePermissionSet;

      // Test 8: Wildcard matches child
      var t = T.EMPTY.add('menu.read.*');
      x.test(t.check('menu.read.transactions') === true, 'T8: Wildcard matches child');

      // Test 9: Wildcard matches dotted child
      t = T.EMPTY.add('menu.read.*');
      x.test(t.check('menu.read.id.idd') === true, 'T9: Wildcard matches dotted child');

      // Test 10: Mid-level wildcard
      t = T.EMPTY.add('menu.*');
      x.test(t.check('menu.read.id.idd') === true, 'T10: Mid-level wildcard');

      // Test 11: Root wildcard
      t = T.EMPTY.add('*');
      x.test(t.check('menu.read.id.idd') === true, 'T11: Root wildcard');

      // Test 12: Wildcard no false positive
      t = T.EMPTY.add('menu.read.*');
      x.test(t.check('menu.write.x') === false, 'T12: Wildcard no false positive');
    },

    //
    // Part 1 continued: Overlapping & edge cases (Tests 13-16)
    //
    function testTrieOverlapping(x) {
      var T = foam.core.grant.TriePermissionSet;

      // Test 15: Overlapping — add terminal then child
      // add 'menu.read.id' then 'menu.read.id.idd'
      // Expected: BOTH should be granted (terminal preserved)
      var t = T.EMPTY.add('menu.read.id').add('menu.read.id.idd');
      x.test(t.check('menu.read.id') === true,     'T15: Terminal then child — terminal preserved');
      x.test(t.check('menu.read.id.idd') === true,  'T15: Terminal then child — child also works');

      // Test 16: Overlapping — add child then terminal
      // add 'menu.read.id.idd' then 'menu.read.id'
      t = T.EMPTY.add('menu.read.id.idd').add('menu.read.id');
      x.test(t.check('menu.read.id.idd') === true, 'T16: Child then terminal — child preserved');
      x.test(t.check('menu.read.id') === true,     'T16: Child then terminal — terminal also works');
    },

    function testTrieEdgeCases(x) {
      var T = foam.core.grant.TriePermissionSet;

      // Test 13: Empty permission
      var t = T.EMPTY.add('');
      x.test(t.check('') === true, 'T13: Empty permission');

      // Test 14: Single segment
      t = T.EMPTY.add('admin');
      x.test(t.check('admin') === true, 'T14: Single segment');
    },

    //
    // Part 2: Union & CompoundPermissionSet (Tests 17-22)
    //
    function testUnion(x) {
      var T = foam.core.grant.TriePermissionSet;

      // Test 17: Union two tries
      var a = T.EMPTY.add('a.b');
      var b = T.EMPTY.add('c.d');
      var u = a.union(b);
      x.test(u.check('a.b') === true, 'T17: Union — first perm');
      x.test(u.check('c.d') === true, 'T17: Union — second perm');

      // Test 18: Union overlapping paths
      a = T.EMPTY.add('menu.read.x');
      b = T.EMPTY.add('menu.read.y');
      u = a.union(b);
      x.test(u.check('menu.read.x') === true, 'T18: Union overlap — x');
      x.test(u.check('menu.read.y') === true, 'T18: Union overlap — y');

      // Regression: parent + child paths must both survive union
      a = T.EMPTY.add('menu.read.admin');
      b = T.EMPTY.add('menu.read.admin.users');
      u = a.union(b);
      x.test(u.check('menu.read.admin') === true, 'T18b: Union parent-child keeps parent');
      x.test(u.check('menu.read.admin.users') === true, 'T18b: Union parent-child keeps child');

      a = T.EMPTY.add('menu.read.admin.users');
      b = T.EMPTY.add('menu.read.admin');
      u = a.union(b);
      x.test(u.check('menu.read.admin') === true, 'T18c: Union child-parent keeps parent');
      x.test(u.check('menu.read.admin.users') === true, 'T18c: Union child-parent keeps child');

      // T18d regression: order-independent union of parent + sibling + child of parent.
      // Three single-perm tries unioned in sequence must reconstruct the parent permission
      // regardless of order. The bug pattern: sibling causes parent value to collapse to
      // {'':true}, then unioning the parent's child path recurses into '' against null and
      // creates {'':{'':true}} which check() can't traverse.
      var orderings = [
        [ 'a.b', 'a.c', 'a.b.x' ],
        [ 'a.b', 'a.b.x', 'a.c' ],
        [ 'a.c', 'a.b', 'a.b.x' ],
        [ 'a.c', 'a.b.x', 'a.b' ],
        [ 'a.b.x', 'a.b', 'a.c' ],
        [ 'a.b.x', 'a.c', 'a.b' ]
      ];
      for ( var i = 0 ; i < orderings.length ; i++ ) {
        var ord = orderings[i];
        u = T.EMPTY.add(ord[0]).union(T.EMPTY.add(ord[1])).union(T.EMPTY.add(ord[2]));
        x.test(u.check('a.b')   === true, 'T18d: ' + ord.join(',') + ' — parent a.b survives');
        x.test(u.check('a.c')   === true, 'T18d: ' + ord.join(',') + ' — sibling a.c survives');
        x.test(u.check('a.b.x') === true, 'T18d: ' + ord.join(',') + ' — child a.b.x survives');
      }

      // Test 19: Union with wildcard
      a = T.EMPTY.add('menu.*');
      b = T.EMPTY.add('menu.read.id.idd');
      u = a.union(b);
      x.test(u.check('menu.read.id.idd') === true, 'T19: Union wildcard — specific');
      x.test(u.check('menu.write.x') === true,     'T19: Union wildcard — via wildcard');
    },

    function testCompound(x) {
      var T   = foam.core.grant.TriePermissionSet;
      var CPS = foam.core.grant.CompoundPermissionSet;

      // Test 20: Compound delegates
      var d1 = T.EMPTY.add('a.b');
      var d2 = T.EMPTY.add('c.d');
      var d3 = T.EMPTY.add('e.f');
      var cps = CPS.create({ delegates: [d1, d2, d3] });
      x.test(cps.check('a.b') === true, 'T20: Compound — delegate 1');
      x.test(cps.check('c.d') === true, 'T20: Compound — delegate 2');
      x.test(cps.check('e.f') === true, 'T20: Compound — delegate 3');
      x.test(cps.check('g.h') === false, 'T20: Compound — missing perm');

      // Test 21: Snapshot flattens to TriePermissionSet
      var snapped = cps.snapshot({});
      x.test(foam.core.grant.TriePermissionSet.isInstance(snapped), 'T21: Snapshot produces TriePermissionSet');
      x.test(snapped.check('a.b') === true, 'T21: Snapshot retains perm a.b');
      x.test(snapped.check('c.d') === true, 'T21: Snapshot retains perm c.d');
      x.test(snapped.check('e.f') === true, 'T21: Snapshot retains perm e.f');

      // Test 22: Empty compound
      cps = CPS.create({ delegates: [] });
      x.test(cps.check('anything') === false, 'T22: Empty compound denies');

      // T22b regression: snapshot of CompoundPermissionSet with parent + sibling + child
      // permissions must produce identical results regardless of delegate order.
      // Mirrors the deployment/thredd modules.jrl File Uploads override scenario:
      //   menu.read.Upload (sibling), menu.read.intake (parent), menu.read.intake.uploadStatus (child)
      var perms = [ 'menu.read.Upload', 'menu.read.intake', 'menu.read.intake.uploadStatus' ];
      var pOrderings = [
        [ 0, 1, 2 ], [ 0, 2, 1 ], [ 1, 0, 2 ], [ 1, 2, 0 ], [ 2, 0, 1 ], [ 2, 1, 0 ]
      ];
      for ( var i = 0 ; i < pOrderings.length ; i++ ) {
        var idx = pOrderings[i];
        var dlg = [
          T.EMPTY.add(perms[idx[0]]),
          T.EMPTY.add(perms[idx[1]]),
          T.EMPTY.add(perms[idx[2]])
        ];
        var label = perms[idx[0]] + ',' + perms[idx[1]] + ',' + perms[idx[2]];
        var snap = CPS.create({ delegates: dlg }).snapshot({});
        x.test(snap.check('menu.read.Upload')              === true, 'T22b: ' + label + ' — Upload granted');
        x.test(snap.check('menu.read.intake')              === true, 'T22b: ' + label + ' — intake granted');
        x.test(snap.check('menu.read.intake.uploadStatus') === true, 'T22b: ' + label + ' — intake.uploadStatus granted');
      }
    },

    //
    // Part 3: PermissionedPermissionSet (Tests 23-29)
    //
    function testPermissioned(x) {
      var T   = foam.core.grant.TriePermissionSet;
      var PPS = foam.core.grant.PermissionedPermissionSet;
      var CPS = foam.core.grant.CompoundPermissionSet;

      // Test 23: check() always returns false
      var pps = PPS.create({
        condition: 'module.x',
        delegate: T.EMPTY.add('menu.read.stuff')
      });
      x.test(pps.check('menu.read.stuff') === false, 'T23: PermissionedPS check always false');

      // Test 24: Snapshot grants when condition met
      var ctx = { permissionSet: T.EMPTY.add('module.x') };
      var snapped = pps.snapshot(ctx);
      x.test(snapped.check('menu.read.stuff') === true, 'T24: Snapshot grants when condition met');

      // Test 25: Snapshot empty when condition NOT met
      ctx = { permissionSet: T.EMPTY.add('module.y') };
      snapped = pps.snapshot(ctx);
      x.test(snapped.check('menu.read.stuff') === false, 'T25: Snapshot empty when condition unmet');

      // Test 26: Dotted condition
      pps = PPS.create({
        condition: 'module.id.idd',
        delegate: T.EMPTY.add('menu.read.stuff')
      });
      ctx = { permissionSet: T.EMPTY.add('module.id.idd') };
      snapped = pps.snapshot(ctx);
      x.test(snapped.check('menu.read.stuff') === true, 'T26: Dotted condition resolves');

      // Test 27: Dotted condition + dotted permission
      pps = PPS.create({
        condition: 'module.mymod',
        delegate: T.EMPTY.add('menu.read.id.idd')
      });
      ctx = { permissionSet: T.EMPTY.add('module.mymod') };
      snapped = pps.snapshot(ctx);
      x.test(snapped.check('menu.read.id.idd') === true, 'T27: Dotted condition + dotted perm');

      // Test 28: Wildcard condition
      pps = PPS.create({
        condition: 'module.x',
        delegate: T.EMPTY.add('menu.read.stuff')
      });
      ctx = { permissionSet: T.EMPTY.add('module.*') };
      snapped = pps.snapshot(ctx);
      x.test(snapped.check('menu.read.stuff') === true, 'T28: Wildcard condition matches');

      // Test 29: Nested compound delegate
      var innerCPS = CPS.create({
        delegates: [ T.EMPTY.add('a.b'), T.EMPTY.add('c.d') ]
      });
      pps = PPS.create({
        condition: 'module.x',
        delegate: innerCPS
      });
      ctx = { permissionSet: T.EMPTY.add('module.x') };
      snapped = pps.snapshot(ctx);
      x.test(snapped.check('a.b') === true, 'T29: Nested compound — a.b');
      x.test(snapped.check('c.d') === true, 'T29: Nested compound — c.d');
    },

    //
    // Part 4: GlobalPermissionSet & RecordingPermissionSet (Tests 30-33)
    //
    function testGlobal(x) {
      var GPS = foam.core.grant.GlobalPermissionSet;

      // Test 30: GlobalPS grants everything
      var gps = GPS.create();
      x.test(gps.check('any.permission.here') === true, 'T30: GlobalPS grants anything');

      // Test 31: GlobalPS snapshot produces wildcard trie
      var snapped = gps.snapshot({});
      x.test(snapped.check('any.permission.here') === true, 'T31: GlobalPS snapshot grants anything');
    },

    function testRecording(x) {
      var RPS = foam.core.grant.RecordingPermissionSet;

      // Test 32: RecordingPS grants non-wildcard and records
      var rps = RPS.create();
      x.test(rps.check('menu.read.x') === true, 'T32: RecordingPS grants non-wildcard');
      x.test(rps.permissions.indexOf('menu.read.x') !== -1, 'T32: RecordingPS records permission');

      // Test 33: RecordingPS denies wildcard
      x.test(rps.check('*') === false, 'T33: RecordingPS denies wildcard');
    }
  ]
});
