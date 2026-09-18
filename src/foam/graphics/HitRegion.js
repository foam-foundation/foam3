/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.graphics',
  name: 'HitRegion',
  extends: 'foam.graphics.CView',

  documentation: `
    Invisible rectangle a shape adds over one of its clickable sub-parts.
    findFirstChildAt() returns it on a hit, and the owner reads role to know
    which sub-part was clicked, without a per-shape event system.
  `,

  properties: [
    {
      class: 'String',
      name: 'role',
      documentation: 'What this region stands for, e.g. "toggle", "badge", "label". Owner-defined vocabulary.'
    }
  ],

  methods: [
    function paintSelf(x) {}
  ]
});
