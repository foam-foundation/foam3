/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail',
  name: 'RailUntil',
  extends: 'foam.parse.rail.RailComposite',

  documentation: `
    "Anything up to" a terminator: an ellipsis box, then the terminator element,
    on one track. Serves Until, Until0, UntilLiteral, UntilLiteral0; the 0
    variants (no value returned) carry the empty badge.
  `,

  constants: { DOTS: '…' },

  properties: [
    { name: 'terminator' },
    { class: 'String', name: 'badge' }
  ],

  methods: [
    function parts() { return [ this.terminator ]; },

    function dotsWidth() {
      var T = this.theme;
      return T.GLYPH_SLOT + this.measure(this.DOTS, T.font('label')) + 2 * T.PAD;
    },

    function layout() {
      var T = this.theme, dw = this.dotsWidth(), t = this.terminator;
      var entry = Math.max(T.BOX_H / 2, t.entryY);
      t.x = dw + T.GAP;
      t.y = entry - t.entryY;
      this.width  = dw + T.GAP + t.width;
      this.height = Math.max(entry + T.BOX_H / 2, t.y + t.height);
      this.entryY = entry;
    },

    function svgSelf(g) {
      var T = this.theme, Tr = foam.parse.rail.Track, dw = this.dotsWidth(), E = this.entryY;
      var top = E - T.BOX_H / 2;
      // Ellipsis box in the terminal style; the outcome colours it like any box.
      g.start('path').addClass('box').addClass('terminal').attrs({ d: Tr.roundRect(0, top, dw, T.BOX_H, 10) }).end();
      this.svgText(g, 'label', this.DOTS, T.GLYPH_SLOT + T.PAD, E);
      if ( this.badge ) this.svgText(g, 'badge', this.badge, dw - 4, top + T.PAD, 'end');
      this.valueEl_ = this.svgText(g, 'value', '', 0, top + T.BOX_H + this.VALUE_DY);
      this.svgTrack(g, Tr.h(dw, this.terminator.x, E));
    },

    function isHitTarget() { return true; }
  ]
});
