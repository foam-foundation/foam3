/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail',
  name: 'RailOptional',
  extends: 'foam.parse.rail.RailComposite',

  documentation: 'Child on the main row with a bypass track above it. When the child fails the bypass is the taken path, which is normal, not an error.',

  properties: [
    { name: 'item' }
  ],

  methods: [
    function parts() { return [ this.item ]; },

    function headroom() { return this.theme.ARC * this.theme.BYPASS_HEADROOM; },

    function layout() {
      var T = this.theme, head = this.headroom();
      this.item.x = T.LOOP_PAD;
      this.item.y = head;
      this.width  = this.item.width + T.LOOP_PAD * 2;
      this.height = this.item.height + head;
      this.entryY = head + this.item.entryY;
    },

    function svgSelf(g) {
      var T = this.theme, Tr = foam.parse.rail.Track;
      var W = this.width, E = this.entryY, a = T.ARC, col = a * T.BEND;
      this.svgTrack(g, Tr.h(0, this.item.x, E) + Tr.h(this.item.x + this.item.width, W, E)
                     + Tr.detour(col, W - col, E, a, a));      // bypass row is one arc below the top edge
    }
  ]
});
