/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail',
  name: 'RailAlt',
  extends: 'foam.parse.rail.RailComposite',

  documentation: `
    Ordered choice: branches stacked top-down, entered on the first row. The
    number beside each branch is its PEG priority (first match wins), the one
    place this notation deliberately differs from textbook railroad, where any
    branch is equally valid.
  `,

  properties: [
    { name: 'items', factory: function() { return []; } }
  ],

  methods: [
    function parts() { return this.items; },

    function priorityOf(item) { return this.items.indexOf(item) + 1; },

    function layout() {
      var T = this.theme, w = 0, y = 0;
      this.items.forEach(function(i) { w = Math.max(w, i.width); });
      // Each branch centred on the widest, with detour room on both sides for the S-curves.
      this.items.forEach(function(i) { i.x = T.LOOP_PAD + ( w - i.width ) / 2; i.y = y; y += i.height + T.VGAP; });
      this.width  = w + T.LOOP_PAD * 2;
      this.height = Math.max(0, y - T.VGAP);
      this.entryY = this.items.length ? this.items[0].entryY : 0;
    },

    function paintSelf(ctx) {
      var T = this.theme, Tr = foam.parse.rail.Track, self = this;
      var W = this.width, E = this.entryY, a = T.ARC, col = a * T.BEND;
      this.items.forEach(function(i, n) {
        var iy = i.y + i.entryY;
        // Each branch track carries its own item's outcome, so a taken branch reads differently from an untried one.
        Tr.begin(ctx, i.outcomeColor(), i.visited() ? T.BRANCH_STROKE_VISITED : T.BRANCH_STROKE);
        if ( n === 0 ) {
          Tr.h(ctx, 0, i.x, E);
          Tr.h(ctx, i.x + i.width, W, E);
        } else {
          Tr.sCurve(ctx, 0, E, col, i.x, iy, a);
          Tr.sCurve(ctx, i.x + i.width, iy, W - col, W, E, a);
        }
        ctx.stroke();
        self.paintPriority(ctx, n + 1, i.x - T.PRIORITY_DX, iy - T.PRIORITY_DY);
      });
    },

    function paintPriority(ctx, n, cx, cy) {
      /** Small filled circle with the branch number, haloed in the background colour so it survives crossing a curve. */
      var T = this.theme;
      ctx.beginPath(); ctx.arc(cx, cy, T.PRIORITY_RADIUS + 1, 0, Math.PI * 2);
      ctx.fillStyle = T.background; ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, T.PRIORITY_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = T.resolve('muted'); ctx.fill();
      ctx.font = T.font('priority'); ctx.fillStyle = T.background;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(n), cx, cy);
    }
  ]
});
