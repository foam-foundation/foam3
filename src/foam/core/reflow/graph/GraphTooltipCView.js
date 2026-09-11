/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.graph',
  name: 'GraphTooltipCView',
  extends: 'foam.graphics.Box',

  documentation: `
    A small pointer-anchored label, painted offset from the pointer rather
    than positioned via the normal x/y properties. Paints nothing while
    text is empty, and never intercepts hit-testing so it can't block
    clicks on whatever it's floating over.
  `,

  properties: [
    { class: 'String', name: 'text' },
    { name: 'theme', documentation: 'A foam.core.reflow.graph.GraphTheme.' },
    { class: 'Float', name: 'anchorX', documentation: 'Pointer x, in scene coordinates.' },
    { class: 'Float', name: 'anchorY', documentation: 'Pointer y, in scene coordinates.' }
  ],

  methods: [
    function paintSelf(ctx) {
      if ( ! this.text ) return;

      var theme = this.theme;
      var t     = theme ? theme.colors : {};
      var f     = theme ? theme.fonts  : {};

      ctx.font = f.body;
      var w = ctx.measureText(this.text).width + 12;
      var h = 22;

      ctx.save();
      ctx.translate(this.anchorX + 12, this.anchorY + 12);

      this.roundRect(ctx, 0, 0, w, h, 4);
      ctx.fillStyle = t.tooltipBg;
      ctx.fill();

      ctx.fillStyle = t.tooltipText;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.text, 6, h / 2);
      ctx.restore();
    },

    function hitTest(p) {
      return false;
    }
  ]
});
