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

    function svgSelf(g) {
      var T = this.theme, Tr = foam.parse.rail.Track, self = this;
      var W = this.width, E = this.entryY, a = T.ARC, col = a * T.BEND;
      this.branchEls_ = [];
      this.items.forEach(function(i, n) {
        var iy = i.y + i.entryY, d;
        // Each branch track carries its own item's outcome, so a taken branch reads differently from an untried one.
        if ( n === 0 ) d = Tr.h(0, i.x, E) + Tr.h(i.x + i.width, W, E);
        else           d = Tr.sCurve(0, E, col, i.x, iy, a) + Tr.sCurve(i.x + i.width, iy, W - col, W, E, a);
        var p = g.start('path').addClass('branch').attrs({ d: d });
        p.end();
        self.branchEls_.push(p);
        self.svgPriority(g, n + 1, i.x - T.PRIORITY_DX, iy - T.PRIORITY_DY);
      });
    },

    function svgPriority(g, n, cx, cy) {
      /** Small filled circle with the branch number, haloed in the background colour so it survives crossing a curve. */
      var T = this.theme, Tr = foam.parse.rail.Track;
      g.start('circle').addClass('priority-halo').attrs({ cx: Tr.n(cx), cy: Tr.n(cy), r: T.PRIORITY_RADIUS + 1 }).end();
      g.start('circle').addClass('priority').attrs({ cx: Tr.n(cx), cy: Tr.n(cy), r: T.PRIORITY_RADIUS }).end();
      this.svgText(g, 'priority-text', String(n), cx, cy, 'middle');
    },

    function syncState() {
      this.SUPER();
      // Branch tracks follow their item's outcome, not the choice's.
      var els = this.branchEls_ || [];
      this.items.forEach(function(i, n) {
        if ( els[n] ) els[n].element_.setAttribute('class', 'branch outcome-' + i.outcome.name + ( i.visited() ? ' visited' : '' ));
      });
    }
  ]
});
