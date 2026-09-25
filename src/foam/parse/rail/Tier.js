/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.parse.rail',
  name: 'Tier',

  documentation: `
    How much attention an element gets. LIVE: its rule has an open activation
    (or the trace is finished, which renders as a result view). HISTORY: it was
    visited but its rule is idle now. NEVER: not reached. Alpha is multiplied
    down the CView tree, so a faded parent fades its children, which is right:
    a child can only be attempted after its parent.
  `,

  properties: [
    { class: 'Float', name: 'alpha' }
  ],

  values: [
    { name: 'LIVE',    alpha: 1 },
    { name: 'HISTORY', alpha: 0.55 },
    { name: 'NEVER',   alpha: 0.34 }
  ]
});
