/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail',
  name: 'RailSeq',
  extends: 'foam.parse.rail.RailComposite',

  documentation: 'Items side by side on one track, aligned on their entry rows. Draws Sequence, Sequence0 and Sequence1.',

  constants: {
    EMPHASIS_DASH: [ 2, 2 ],
    EMPHASIS_PAD: 3
  },

  properties: [
    { name: 'items', factory: function() { return []; } },
    { class: 'Int', name: 'emphasis', value: -1, documentation: 'Index of the item whose value the sequence returns (Sequence1.n), or -1.' }
  ],

  methods: [
    function parts() { return this.items; },

    function layout() {
      var T = this.theme;
      // The shared row is the deepest entry among the items; items hang above and below it.
      var entry = 0, below = 0;
      this.items.forEach(function(i) {
        entry = Math.max(entry, i.entryY);
        below = Math.max(below, i.height - i.entryY);
      });
      var x = 0;
      this.items.forEach(function(i) { i.x = x; i.y = entry - i.entryY; x += i.width + T.GAP; });
      this.width  = Math.max(0, x - T.GAP);
      this.height = entry + below;
      this.entryY = entry;
    },

    function paintSelf(ctx) {
      // Only the connecting runs between items; the items paint themselves.
      var Tr = foam.parse.rail.Track;
      this.beginTrack(ctx);
      for ( var k = 0 ; k < this.items.length - 1 ; k++ ) {
        Tr.h(ctx, this.items[k].x + this.items[k].width, this.items[k + 1].x, this.entryY);
      }
      ctx.stroke();
      if ( this.emphasis >= 0 && this.items[this.emphasis] ) {
        // Sequence1 returns only this item's value: dashed outline plus ▸n (1-based for the reader).
        var it = this.items[this.emphasis], T = this.theme, p = this.EMPHASIS_PAD;
        ctx.setLineDash(this.EMPHASIS_DASH); ctx.strokeStyle = T.resolve('muted'); ctx.lineWidth = T.STROKE_BASE;
        ctx.strokeRect(it.x - p, it.y - p, it.width + 2 * p, it.height + 2 * p);
        ctx.setLineDash([]);
        ctx.font = T.font('badge'); ctx.fillStyle = T.resolve('muted'); ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText('▸' + ( this.emphasis + 1 ), it.x - p, it.y - p - 1);
      }
    }
  ]
});
