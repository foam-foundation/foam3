/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail',
  name: 'RailComposite',
  extends: 'foam.parse.rail.RailElement',

  documentation: `
    An element made of other elements. Subclasses implement parts() and
    layout(); this class adds the parts as children and re-runs layout()
    whenever any part's width, height or entryY changes, which is how an
    unfold deep inside a strip re-lays-out every ancestor with no global pass.
    Composites are track shapes; the tooltip and click belong to their parts.
  `,

  methods: [
    function init() {
      this.SUPER();
      var self  = this;
      var parts = this.parts();
      parts.forEach(function(p) { self.add(p); });
      // One ArraySlot over every part's geometry; a change anywhere re-lays-out this composite.
      var slots = [];
      parts.forEach(function(p) { slots.push(p.width$, p.height$, p.entryY$); });
      this.layoutSub_ = foam.lang.ArraySlot.create({ slots: slots }).sub(function() { self.layout(); });
      this.layout();
    },

    function parts()  { return []; },
    function layout() {},
    function isHitTarget() { return false; }
  ]
});
