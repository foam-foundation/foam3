/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail',
  name: 'RailRepeat',
  extends: 'foam.parse.rail.RailComposite',

  documentation: `
    Child on the main row, loop-back underneath through the delimiter (if any),
    with a left-pointing arrow on the return track. Loops are greedy and never
    give back: the second place this notation differs from textbook railroad.
    Serves Repeat, Plus and Repeat0; the badge states the bounds.
  `,

  constants: {
    ARROW_INSET: 4,      // arrow tip sits this far left of the delimiter
    BADGE_INSET: 4       // badge sits this far right of the right detour column
  },

  properties: [
    { name: 'item' },
    { name: 'delim', documentation: 'Delimiter element on the return track, or null.' },
    { class: 'String', name: 'badge', documentation: 'Bounds: "×1+" (plus), "×n+" (minimum), "∅" (may match nothing), or empty.' }
  ],

  methods: [
    function parts() { return this.delim ? [ this.item, this.delim ] : [ this.item ]; },

    function returnY() {
      /** Row of the return track: through the delimiter, else one arc above the bottom. */
      return this.delim ? this.delim.y + this.delim.entryY : this.height - this.theme.ARC;
    },

    function layout() {
      var T = this.theme;
      var w = Math.max(this.item.width, this.delim ? this.delim.width : 0);
      this.item.x = T.LOOP_PAD + ( w - this.item.width ) / 2;
      this.item.y = 0;
      var h = this.item.height;
      if ( this.delim ) {
        this.delim.x = T.LOOP_PAD + ( w - this.delim.width ) / 2;
        this.delim.y = h + T.VGAP;
        h = this.delim.y + this.delim.height;
      } else {
        h += T.ARC * 2;
      }
      this.width  = w + T.LOOP_PAD * 2;
      this.height = h;
      this.entryY = this.item.entryY;
    },

    function svgSelf(g) {
      var T = this.theme, Tr = foam.parse.rail.Track;
      var W = this.width, E = this.entryY, a = T.ARC, col = a * T.BEND;
      var ry  = this.returnY();
      var gap = this.delim ? [ this.delim.x, this.delim.x + this.delim.width ] : null;
      this.svgTrack(g, Tr.h(0, this.item.x, E) + Tr.h(this.item.x + this.item.width, W, E)
                     + Tr.detour(col, W - col, E, ry, a, gap)
                     + Tr.arrowLeft(this.delim ? this.delim.x - this.ARROW_INSET : W / 2, ry));
      if ( this.badge ) this.svgText(g, 'badge', this.badge, W - col + this.BADGE_INSET, ry);
    }
  ]
});
