/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.test',
  name: 'DependencyScannerTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.core.reflow.DependencyScanner'
  ],

  methods: [
    async function runTest(x) {
      var scanner = this.DependencyScanner.create({
        ignore: [ 'dao', 'daofilter', 'transform', 'script', 'layout' ]
      });

      // ============================================
      // 1. Forward reference
      // ============================================
      var blocks1 = [
        { flowName: 'transform1', cmd: 'dao(transform2.data)' },
        { flowName: 'transform2', cmd: 'dao x' }
      ];
      var r1 = scanner.scan(blocks1);
      x.test(r1.edges.length === 1, 'Forward ref: exactly one edge');
      x.test(
        r1.edges[0] &&
        r1.edges[0].source === 'transform2' &&
        r1.edges[0].target === 'transform1' &&
        r1.edges[0].kind === 'data' &&
        r1.edges[0].field === 'cmd',
        'Forward ref: edge shape source=transform2 target=transform1 kind=data field=cmd'
      );

      // ============================================
      // 2. Nested reactions_
      // ============================================
      var blocks2 = [
        { flowName: 'dao1', cmd: 'dao x' },
        { flowName: 'activeTab', cmd: 'dao y' },
        {
          flowName: 't1',
          value: { select: { reactions_: { limit: 'dao1.count' } } },
          border: { reactions_: { title: 'dao1.name' } },
          reactions_: { shown: "activeTab.value === 'x'" }
        }
      ];
      var r2 = scanner.scan(blocks2);
      var reactionEdges = r2.edges.filter(function(e) { return e.kind === 'reaction'; });
      x.test(reactionEdges.length === 3, 'Nested reactions_: three reaction edges');
      var reactionFields = reactionEdges.map(function(e) { return e.field; }).sort();
      var expectedReactionFields = [
        'border.reactions_.title',
        'reactions_.shown',
        'value.select.reactions_.limit'
      ].sort();
      x.test(
        JSON.stringify(reactionFields) === JSON.stringify(expectedReactionFields),
        'Nested reactions_: fields are value.select.reactions_.limit, border.reactions_.title, reactions_.shown'
      );

      // ============================================
      // 3. daoKey family
      // ============================================
      var blocks3a = [
        { flowName: 'dao1', cmd: 'dao x' },
        { flowName: 't1', value: { daoKey: 'dao1.data.dao' } }
      ];
      var r3a = scanner.scan(blocks3a);
      x.test(
        r3a.edges.length === 1 && r3a.edges[0].source === 'dao1' && r3a.edges[0].field === 'value.daoKey',
        'daoKey: value.daoKey = "dao1.data.dao" -> one data edge to dao1, field value.daoKey'
      );

      var blocks3b = [
        { flowName: 't1', value: { daoKey: 'transactionDAO' } }
      ];
      var r3b = scanner.scan(blocks3b);
      x.test(r3b.edges.length === 0, 'daoKey: value.daoKey = "transactionDAO" with no such block -> no edge');

      var blocks3c = [
        { flowName: 'dao1', cmd: 'dao x' },
        { flowName: 't1', value: { daoKey: 'dao1' } }
      ];
      var r3c = scanner.scan(blocks3c);
      x.test(
        r3c.edges.length === 1 && r3c.edges[0].source === 'dao1',
        'daoKey: value.daoKey = "dao1" -> edge'
      );

      var blocks3d = [
        { flowName: 'dao1', cmd: 'dao x' },
        { flowName: 't1', value: { joins: [ { daoKey: 'dao1' } ] } }
      ];
      var r3d = scanner.scan(blocks3d);
      x.test(
        r3d.edges.length === 1 && r3d.edges[0].field === 'value.joins[0].daoKey',
        'daoKey: value.joins[0].daoKey = "dao1" -> edge with field value.joins[0].daoKey'
      );

      var blocks3e = [
        { flowName: 'a', cmd: 'dao x' },
        { flowName: 'b', cmd: 'dao y' },
        { flowName: 't1', value: { daoKey1: 'a.filteredDAO', daoKey2: 'b.filteredDAO' } }
      ];
      var r3e = scanner.scan(blocks3e);
      x.test(r3e.edges.length === 2, 'daoKey: daoKey1/daoKey2 with blocks a, b -> two edges');

      // ============================================
      // 4. Alias resolution
      // ============================================
      var blocks4a = [
        { flowName: 'transactionDAO', cmd: 'dao x' },
        { flowName: 's1', value: { code: 'transaction.select()' } }
      ];
      var r4a = scanner.scan(blocks4a);
      var scriptEdges4a = r4a.edges.filter(function(e) { return e.kind === 'script'; });
      x.test(
        scriptEdges4a.length === 1 && scriptEdges4a[0].source === 'transactionDAO',
        'Alias: value.code = "transaction.select()" -> script edge from transactionDAO'
      );

      var blocks4b = [
        { flowName: 'transactionDAO', cmd: 'dao x' },
        { flowName: 's2', cmd: 'transactionDAO$block.shown = false' }
      ];
      var r4b = scanner.scan(blocks4b);
      x.test(
        r4b.edges.length === 1 && r4b.edges[0].source === 'transactionDAO' && r4b.edges[0].kind === 'data',
        'Alias: cmd with transactionDAO$block -> data edge from transactionDAO'
      );

      var blocks4c = [
        { flowName: 'transaction', cmd: 'dao x' },
        { flowName: 'transactionDAO', cmd: 'dao y' },
        { flowName: 's3', value: { code: 'transaction.select()' } }
      ];
      var r4c = scanner.scan(blocks4c);
      var scriptEdges4c = r4c.edges.filter(function(e) { return e.kind === 'script'; });
      x.test(
        scriptEdges4c.length === 1 && scriptEdges4c[0].source === 'transaction',
        'Alias: when both transaction and transactionDAO exist, token transaction resolves to transaction (exact wins)'
      );

      // ============================================
      // 5. False positives
      // ============================================
      var blocks5a = [
        { flowName: 'dao1', cmd: 'dao x' },
        { flowName: 'dao10', cmd: 'dao y' },
        { flowName: 't1', cmd: 'dao(dao10.filteredDAO)' }
      ];
      var r5a = scanner.scan(blocks5a);
      x.test(
        r5a.edges.length === 1 && r5a.edges[0].source === 'dao10',
        'False positive: dao(dao10.filteredDAO) -> edge from dao10 only, none from dao1'
      );

      var blocks5b = [
        { flowName: 'dao1', cmd: 'dao x' },
        { flowName: 't1', cmd: 'x.dao1' }
      ];
      var r5b = scanner.scan(blocks5b);
      x.test(r5b.edges.length === 0, 'False positive: cmd "x.dao1" -> no edge (dao1 preceded by dot)');

      var blocks5c = [
        { flowName: 'dao1', cmd: 'dao(dao1.filteredDAO)' }
      ];
      var r5c = scanner.scan(blocks5c);
      x.test(r5c.edges.length === 0, 'False positive: block mentioning its own name -> no self edge');

      var blocks5d = [
        { flowName: 't1', cmd: 'dao region' }
      ];
      var r5d = scanner.scan(blocks5d);
      x.test(r5d.edges.length === 0, 'False positive: cmd "dao region" with dao ignored and no block named region -> no edge');

      // ============================================
      // 6. LayoutBlock child
      // ============================================
      var blocks6 = [
        { flowName: 'dao1', cmd: 'dao x' },
        {
          flowName: 'layout1',
          cmd: 'layout()',
          flowChildren: [
            { flowName: 'child1', cmd: 'dao(dao1.filteredDAO)' }
          ]
        }
      ];
      var r6 = scanner.scan(blocks6);
      var child1 = r6.nodes.filter(function(n) { return n.name === 'child1'; })[0];
      var layout1 = r6.nodes.filter(function(n) { return n.name === 'layout1'; })[0];
      x.test(
        !! child1 && child1.parent === 'layout1' && child1.depth === 1,
        'LayoutBlock child: child1 has parent=layout1, depth=1'
      );
      x.test(
        !! layout1 && layout1.parent === null && layout1.depth === 0,
        'LayoutBlock child: layout1 has parent=null, depth=0'
      );
      x.test(
        r6.edges.length === 1 && r6.edges[0].source === 'dao1' && r6.edges[0].target === 'child1',
        'LayoutBlock child: edge dao1 -> child1'
      );
      var names6 = scanner.names(blocks6);
      x.test(
        JSON.stringify(names6) === JSON.stringify([ 'dao1', 'layout1', 'child1' ]),
        'LayoutBlock child: names() returns [dao1, layout1, child1]'
      );

      // ============================================
      // 7. rewrite
      // ============================================
      var blocks7 = [
        {
          flowName: 'dao1',
          cmd: 'dao(dao1.filteredDAO)',
          value: {
            reactions_: { aql: 'dao1.count + dao10.count' },
            daoKey: 'transaction.x',
            code: 'this.dao1; transactionDAO$block'
          },
          border: { title: 'dao1 report' },
          flowChildren: [
            { flowName: 'dao1' }
          ]
        }
      ];
      scanner.rewrite(blocks7, { dao1: 'dao2', transactionDAO: 'transaction1DAO' });
      var b7 = blocks7[0];
      x.test(b7.cmd === 'dao(dao2.filteredDAO)', 'rewrite: cmd rewritten to dao(dao2.filteredDAO)');
      x.test(
        b7.value.reactions_.aql === 'dao2.count + dao10.count',
        'rewrite: reactions_ expression rewritten to dao2.count + dao10.count'
      );
      x.test(b7.value.daoKey === 'transaction1.x', 'rewrite: daoKey rewritten to transaction1.x');
      x.test(
        b7.value.code === 'this.dao1; transaction1DAO$block',
        'rewrite: code rewritten to "this.dao1; transaction1DAO$block" (this.dao1 untouched, preceded by dot)'
      );
      x.test(b7.border.title === 'dao1 report', 'rewrite: border.title left unchanged (not a scanned field)');
      x.test(
        b7.flowChildren[0].flowName === 'dao2',
        'rewrite: nested flowChildren[0].flowName renamed to dao2'
      );
      x.test(b7.flowName === 'dao2', 'rewrite: top-level flowName renamed to dao2');

      // A DAO short form yields to a block that owns the exact name, as in scan().
      var blocks7b = [
        { flowName: 'usersDAO', cmd: 'FROM userDAO' },
        { flowName: 'users',    cmd: 'script' },
        { flowName: 'r1',       cmd: 'dao(users.filteredDAO)' },
        { flowName: 'r2',       cmd: 'dao(usersDAO.filteredDAO)' }
      ];
      scanner.rewrite(blocks7b, { usersDAO: 'peopleDAO' });
      x.test(
        blocks7b[2].cmd === 'dao(users.filteredDAO)',
        'rewrite: "users" names its own block, so renaming usersDAO leaves it alone'
      );
      x.test(blocks7b[3].cmd === 'dao(peopleDAO.filteredDAO)', 'rewrite: usersDAO -> peopleDAO in full');

      // The short form follows a rename onto a name without the DAO suffix, in full.
      var blocks7c = [
        { flowName: 'usersDAO', cmd: 'FROM userDAO' },
        { flowName: 'r1',       cmd: 'dao(users.filteredDAO)' }
      ];
      scanner.rewrite(blocks7c, { usersDAO: 'people' });
      x.test(blocks7c[1].cmd === 'dao(people.filteredDAO)', 'rewrite: short form users -> people after usersDAO -> people');

      // ============================================
      // 8. freeName
      // ============================================
      x.test(
        scanner.freeName('dao1', function(n) { return [ 'dao1', 'dao2' ].includes(n); }) === 'dao3',
        'freeName: dao1 with dao1,dao2 taken -> dao3'
      );
      x.test(
        scanner.freeName('transactionDAO', function(n) { return n === 'transactionDAO'; }) === 'transaction1DAO',
        'freeName: transactionDAO with transactionDAO taken -> transaction1DAO'
      );
      x.test(
        scanner.freeName('a', function() { return false; }) === 'a1',
        'freeName: a with nothing taken -> a1'
      );

      // ============================================
      // 9. Duplicate flowNames -- positional ids
      // ============================================
      var blocks9 = [
        { flowName: 'a', cmd: 'x' },
        {
          flowName: 'L',
          cmd: 'layout()',
          flowChildren: [
            { flowName: 'a', cmd: 'y' }
          ]
        },
        { flowName: 'b', cmd: 'dao(a.filteredDAO)' }
      ];
      var r9 = scanner.scan(blocks9);
      x.test(
        JSON.stringify(r9.nodes.map(function(n) { return n.id; })) === JSON.stringify([ 'a', 'L', 'a#2', 'b' ]),
        'Duplicates: node ids are [a, L, a#2, b]'
      );
      var aNode9 = r9.nodes.filter(function(n) { return n.id === 'a#2'; })[0];
      x.test(!! aNode9 && aNode9.parent === 'L', 'Duplicates: a#2 has parent L');
      x.test(
        r9.edges.length === 1 && r9.edges[0].source === 'a#2' && r9.edges[0].target === 'b',
        'Duplicates: edge from b resolves to the last occurrence a#2, not the first a'
      );
      var names9 = scanner.names(blocks9);
      x.test(
        JSON.stringify(names9) === JSON.stringify([ 'a', 'L', 'a', 'b' ]),
        'Duplicates: names() still returns every flowName with repeats: [a, L, a, b]'
      );

      // ============================================
      // Empty input
      // ============================================
      var rEmpty = scanner.scan([]);
      x.test(
        rEmpty.nodes.length === 0 && rEmpty.edges.length === 0,
        'scan([]) returns empty nodes and edges'
      );
    }
  ]
});
