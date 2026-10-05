/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.core.reflow',
  name: 'TreeCellFormatter',
  documentation: `
    Interface designed to be used by Flowables
    to perform some task / render some visual when
    the treeCellFormatter is called by FlowableTree.

    For example, Block uses this interface to render
    a cmd-specific icon next to the Block's name in
    the Contents section of Reflow.

    Note that this interface is NOT Flowable-specific--
    you can use treeCellFormatter to do whatever you want.
  `,

  methods: [
    {
      name: 'treeCellFormatter',
      args: [
        { name: 'e', type: 'foam.u2.Element' }
      ],
      type: 'Void'
    }
  ]
});