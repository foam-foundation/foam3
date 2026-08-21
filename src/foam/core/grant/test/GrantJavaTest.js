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
  name: 'GrantJavaTest',
  extends: 'foam.core.test.Test',

  documentation: 'Java tests for Grant permission framework: TriePermissionSet, CompoundPermissionSet, PermissionedPermissionSet, GlobalPermissionSet, RecordingPermissionSet.',

  javaImports: [
    'foam.core.grant.TriePermissionSet',
    'foam.core.grant.CompoundPermissionSet',
    'foam.core.grant.PermissionedPermissionSet',
    'foam.core.grant.GlobalPermissionSet',
    'foam.core.grant.RecordingPermissionSet',
    'foam.core.grant.PermissionSet',
    'foam.lang.X'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        testTrieAddCheck();
        testTrieWildcards();
        testTrieOverlapping();
        testTrieEdgeCases();
        testUnion();
        testCompound();
        testPermissioned();
        testGlobal();
        testRecording();
      `
    },

    {
      name: 'testTrieAddCheck',
      javaCode: `
        // Test 1: Simple 2-segment
        TriePermissionSet t = TriePermissionSet.EMPTY.add("a.b");
        test(t.check("a.b"), "T1: 2-segment add/check");

        // Test 2: Simple 3-segment
        t = TriePermissionSet.EMPTY.add("menu.read.transactions");
        test(t.check("menu.read.transactions"), "T2: 3-segment add/check");

        // Test 3: 4-segment (dotted ID) — the bug scenario
        t = TriePermissionSet.EMPTY.add("menu.read.id.idd");
        test(t.check("menu.read.id.idd"), "T3: 4-segment dotted ID");

        // Test 4: 5-segment deep
        t = TriePermissionSet.EMPTY.add("a.b.c.d.e");
        test(t.check("a.b.c.d.e"), "T4: 5-segment deep");

        // Test 5: Partial match fails
        t = TriePermissionSet.EMPTY.add("menu.read.id");
        test( ! t.check("menu.read.id.idd"), "T5: Partial match fails");

        // Test 6: Over-specified fails
        t = TriePermissionSet.EMPTY.add("menu.read.id.idd");
        test( ! t.check("menu.read.id"), "T6: Over-specified fails");

        // Test 7: Wrong leaf fails
        t = TriePermissionSet.EMPTY.add("menu.read.id.idd");
        test( ! t.check("menu.read.id.xyz"), "T7: Wrong leaf fails");
      `
    },

    {
      name: 'testTrieWildcards',
      javaCode: `
        // Test 8: Wildcard matches child
        TriePermissionSet t = TriePermissionSet.EMPTY.add("menu.read.*");
        test(t.check("menu.read.transactions"), "T8: Wildcard matches child");

        // Test 9: Wildcard matches dotted child
        t = TriePermissionSet.EMPTY.add("menu.read.*");
        test(t.check("menu.read.id.idd"), "T9: Wildcard matches dotted child");

        // Test 10: Mid-level wildcard
        t = TriePermissionSet.EMPTY.add("menu.*");
        test(t.check("menu.read.id.idd"), "T10: Mid-level wildcard");

        // Test 11: Root wildcard
        t = TriePermissionSet.EMPTY.add("*");
        test(t.check("menu.read.id.idd"), "T11: Root wildcard");

        // Test 12: Wildcard no false positive
        t = TriePermissionSet.EMPTY.add("menu.read.*");
        test( ! t.check("menu.write.x"), "T12: Wildcard no false positive");
      `
    },

    {
      name: 'testTrieOverlapping',
      javaCode: `
        // Test 15: Overlapping — add terminal then child
        TriePermissionSet t = TriePermissionSet.EMPTY.add("menu.read.id").add("menu.read.id.idd");
        test(t.check("menu.read.id"),     "T15: Terminal then child — terminal preserved");
        test(t.check("menu.read.id.idd"), "T15: Terminal then child — child also works");

        // Test 16: Overlapping — add child then terminal
        t = TriePermissionSet.EMPTY.add("menu.read.id.idd").add("menu.read.id");
        test(t.check("menu.read.id.idd"), "T16: Child then terminal — child preserved");
        test(t.check("menu.read.id"),     "T16: Child then terminal — terminal also works");
      `
    },

    {
      name: 'testTrieEdgeCases',
      javaCode: `
        // Test 13: Empty permission
        TriePermissionSet t = TriePermissionSet.EMPTY.add("");
        test(t.check(""), "T13: Empty permission");

        // Test 14: Single segment
        t = TriePermissionSet.EMPTY.add("admin");
        test(t.check("admin"), "T14: Single segment");
      `
    },

    {
      name: 'testUnion',
      javaCode: `
        // Test 17: Union two tries
        TriePermissionSet a = TriePermissionSet.EMPTY.add("a.b");
        TriePermissionSet b = TriePermissionSet.EMPTY.add("c.d");
        TriePermissionSet u = a.union(b);
        test(u.check("a.b"), "T17: Union — first perm");
        test(u.check("c.d"), "T17: Union — second perm");

        // Test 18: Union overlapping paths
        a = TriePermissionSet.EMPTY.add("menu.read.x");
        b = TriePermissionSet.EMPTY.add("menu.read.y");
        u = a.union(b);
        test(u.check("menu.read.x"), "T18: Union overlap — x");
        test(u.check("menu.read.y"), "T18: Union overlap — y");

        // Regression: parent + child paths must both survive union
        a = TriePermissionSet.EMPTY.add("menu.read.admin");
        b = TriePermissionSet.EMPTY.add("menu.read.admin.users");
        u = a.union(b);
        test(u.check("menu.read.admin"), "T18b: Union parent-child keeps parent");
        test(u.check("menu.read.admin.users"), "T18b: Union parent-child keeps child");

        a = TriePermissionSet.EMPTY.add("menu.read.admin.users");
        b = TriePermissionSet.EMPTY.add("menu.read.admin");
        u = a.union(b);
        test(u.check("menu.read.admin"), "T18c: Union child-parent keeps parent");
        test(u.check("menu.read.admin.users"), "T18c: Union child-parent keeps child");

        // T18d regression: order-independent union of parent + sibling + child of parent.
        // Three single-perm tries unioned in sequence must reconstruct the parent permission
        // regardless of order. The bug pattern: sibling causes parent value to collapse to
        // {"":TRUE}, then unioning the parent's child path recurses into "" against null and
        // creates {"":{"":TRUE}} which check() can't traverse.
        String[][] orderings = new String[][] {
          { "a.b", "a.c", "a.b.x" },
          { "a.b", "a.b.x", "a.c" },
          { "a.c", "a.b", "a.b.x" },
          { "a.c", "a.b.x", "a.b" },
          { "a.b.x", "a.b", "a.c" },
          { "a.b.x", "a.c", "a.b" }
        };
        for ( int i = 0 ; i < orderings.length ; i++ ) {
          String[] ord = orderings[i];
          TriePermissionSet u3 = TriePermissionSet.EMPTY.add(ord[0]).union(TriePermissionSet.EMPTY.add(ord[1])).union(TriePermissionSet.EMPTY.add(ord[2]));
          String label = ord[0] + "," + ord[1] + "," + ord[2];
          test(u3.check("a.b"),   "T18d: " + label + " — parent a.b survives");
          test(u3.check("a.c"),   "T18d: " + label + " — sibling a.c survives");
          test(u3.check("a.b.x"), "T18d: " + label + " — child a.b.x survives");
        }

        // Test 19: Union with wildcard
        a = TriePermissionSet.EMPTY.add("menu.*");
        b = TriePermissionSet.EMPTY.add("menu.read.id.idd");
        u = a.union(b);
        test(u.check("menu.read.id.idd"), "T19: Union wildcard — specific");
        test(u.check("menu.write.x"),     "T19: Union wildcard — via wildcard");
      `
    },

    {
      name: 'testCompound',
      javaCode: `
        // Test 20: Compound delegates
        TriePermissionSet d1 = TriePermissionSet.EMPTY.add("a.b");
        TriePermissionSet d2 = TriePermissionSet.EMPTY.add("c.d");
        TriePermissionSet d3 = TriePermissionSet.EMPTY.add("e.f");
        CompoundPermissionSet cps = new CompoundPermissionSet();
        cps.setDelegates(new PermissionSet[] { d1, d2, d3 });
        test(cps.check("a.b"), "T20: Compound — delegate 1");
        test(cps.check("c.d"), "T20: Compound — delegate 2");
        test(cps.check("e.f"), "T20: Compound — delegate 3");
        test( ! cps.check("g.h"), "T20: Compound — missing perm");

        // Test 21: Snapshot flattens to TriePermissionSet
        PermissionSet snapped = cps.snapshot(getX());
        test(snapped instanceof TriePermissionSet, "T21: Snapshot produces TriePermissionSet");
        test(snapped.check("a.b"), "T21: Snapshot retains perm a.b");
        test(snapped.check("c.d"), "T21: Snapshot retains perm c.d");
        test(snapped.check("e.f"), "T21: Snapshot retains perm e.f");

        // Test 22: Empty compound
        cps = new CompoundPermissionSet();
        cps.setDelegates(new PermissionSet[0]);
        test( ! cps.check("anything"), "T22: Empty compound denies");

        // T22b regression: snapshot of CompoundPermissionSet with parent + sibling + child
        // permissions must produce identical results regardless of delegate order.
        // Mirrors the deployment/thredd modules.jrl File Uploads override scenario:
        //   menu.read.Upload (sibling), menu.read.intake (parent), menu.read.intake.uploadStatus (child)
        String[] perms = new String[] { "menu.read.Upload", "menu.read.intake", "menu.read.intake.uploadStatus" };
        int[][] pOrderings = new int[][] {
          { 0, 1, 2 }, { 0, 2, 1 }, { 1, 0, 2 }, { 1, 2, 0 }, { 2, 0, 1 }, { 2, 1, 0 }
        };
        for ( int i = 0 ; i < pOrderings.length ; i++ ) {
          int[] idx = pOrderings[i];
          PermissionSet[] dlg = new PermissionSet[] {
            TriePermissionSet.EMPTY.add(perms[idx[0]]),
            TriePermissionSet.EMPTY.add(perms[idx[1]]),
            TriePermissionSet.EMPTY.add(perms[idx[2]])
          };
          String label = perms[idx[0]] + "," + perms[idx[1]] + "," + perms[idx[2]];
          CompoundPermissionSet cps2 = new CompoundPermissionSet();
          cps2.setDelegates(dlg);
          PermissionSet snap = cps2.snapshot(getX());
          test(snap.check("menu.read.Upload"),              "T22b: " + label + " — Upload granted");
          test(snap.check("menu.read.intake"),              "T22b: " + label + " — intake granted");
          test(snap.check("menu.read.intake.uploadStatus"), "T22b: " + label + " — intake.uploadStatus granted");
        }
      `
    },

    {
      name: 'testPermissioned',
      javaCode: `
        // Test 23: check always false
        PermissionedPermissionSet pps = new PermissionedPermissionSet.Builder(getX())
          .setCondition("module.x")
          .setDelegate(TriePermissionSet.EMPTY.add("menu.read.stuff"))
          .build();
        test( ! pps.check("menu.read.stuff"), "T23: PermissionedPS check always false");

        // Test 24: Snapshot grants when condition met
        X ctx = getX().put("permissionSet", TriePermissionSet.EMPTY.add("module.x"));
        PermissionSet snapped = pps.snapshot(ctx);
        test(snapped.check("menu.read.stuff"), "T24: Snapshot grants when condition met");

        // Test 25: Snapshot empty when condition NOT met
        ctx = getX().put("permissionSet", TriePermissionSet.EMPTY.add("module.y"));
        snapped = pps.snapshot(ctx);
        test( ! snapped.check("menu.read.stuff"), "T25: Snapshot empty when condition unmet");

        // Test 26: Dotted condition
        pps = new PermissionedPermissionSet.Builder(getX())
          .setCondition("module.id.idd")
          .setDelegate(TriePermissionSet.EMPTY.add("menu.read.stuff"))
          .build();
        ctx = getX().put("permissionSet", TriePermissionSet.EMPTY.add("module.id.idd"));
        snapped = pps.snapshot(ctx);
        test(snapped.check("menu.read.stuff"), "T26: Dotted condition resolves");

        // Test 27: Dotted condition + dotted permission
        pps = new PermissionedPermissionSet.Builder(getX())
          .setCondition("module.mymod")
          .setDelegate(TriePermissionSet.EMPTY.add("menu.read.id.idd"))
          .build();
        ctx = getX().put("permissionSet", TriePermissionSet.EMPTY.add("module.mymod"));
        snapped = pps.snapshot(ctx);
        test(snapped.check("menu.read.id.idd"), "T27: Dotted condition + dotted perm");

        // Test 28: Wildcard condition
        pps = new PermissionedPermissionSet.Builder(getX())
          .setCondition("module.x")
          .setDelegate(TriePermissionSet.EMPTY.add("menu.read.stuff"))
          .build();
        ctx = getX().put("permissionSet", TriePermissionSet.EMPTY.add("module.*"));
        snapped = pps.snapshot(ctx);
        test(snapped.check("menu.read.stuff"), "T28: Wildcard condition matches");

        // Test 29: Nested compound delegate
        CompoundPermissionSet innerCPS = new CompoundPermissionSet();
        innerCPS.setDelegates(new PermissionSet[] {
          TriePermissionSet.EMPTY.add("a.b"),
          TriePermissionSet.EMPTY.add("c.d")
        });
        pps = new PermissionedPermissionSet.Builder(getX())
          .setCondition("module.x")
          .setDelegate(innerCPS)
          .build();
        ctx = getX().put("permissionSet", TriePermissionSet.EMPTY.add("module.x"));
        snapped = pps.snapshot(ctx);
        test(snapped.check("a.b"), "T29: Nested compound — a.b");
        test(snapped.check("c.d"), "T29: Nested compound — c.d");
      `
    },

    {
      name: 'testGlobal',
      javaCode: `
        // Test 30: GlobalPS grants everything
        GlobalPermissionSet gps = GlobalPermissionSet.instance();
        test(gps.check("any.permission.here"), "T30: GlobalPS grants anything");

        // Test 31: GlobalPS snapshot produces wildcard trie
        PermissionSet snapped = gps.snapshot(getX());
        test(snapped.check("any.permission.here"), "T31: GlobalPS snapshot grants anything");
      `
    },

    {
      name: 'testRecording',
      javaCode: `
        // Test 32: RecordingPS grants non-wildcard and records
        RecordingPermissionSet rps = new RecordingPermissionSet();
        test(rps.check("menu.read.x"), "T32: RecordingPS grants non-wildcard");
        boolean found = false;
        for ( String p : rps.getPermissions() ) {
          if ( "menu.read.x".equals(p) ) { found = true; break; }
        }
        test(found, "T32: RecordingPS records permission");

        // Test 33: RecordingPS denies wildcard
        test( ! rps.check("*"), "T33: RecordingPS denies wildcard");
      `
    }
  ]
});
