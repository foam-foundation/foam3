/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'GlyphView',
  extends: 'foam.u2.View',

  documentation: 'Read-only view of a Glyph which shows the glyph itself rather than its SVG source.',

  requires: [ 'foam.u2.tag.Image' ],

  css: `
    ^ svg {
      fill: var(--glyph-fill, currentColor);
      height: var(--glyph-size, 2.4rem);
      width: auto;
    }
  `,

  methods: [
    function render() {
      this
        .addClass()
        .tag(this.Image, { glyph$: this.data$, role: 'presentation' });
    }
  ]
});
