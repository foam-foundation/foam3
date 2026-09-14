/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail',
  name: 'RailInputRibbon',
  extends: 'foam.graphics.CView',

  documentation: `
    Read-only view of the input during a trace on its own small canvas:
    consumed prefix, the innermost open attempt underlined, the char it died
    on, index ticks every 5 chars, the caret, the current character (dashed,
    trace still running) and the character under test (strong amber box while
    a terminal is trying). With no snapshot it shows plain text.
  `,

  requires: [ 'foam.parse.rail.RailTheme' ],

  constants: {
    X0: 12, TOP: 8, ROW_H: 22, BASELINE: 24, TICK_EVERY: 5, UNDERLINE_W: 3, CARET_W: 2
  },

  properties: [
    { class: 'String', name: 'text' },
    { name: 'snapshot' },
    { name: 'theme',   factory: function() { return this.RailTheme.create(); } },
    { name: 'measure', factory: function() { return foam.graphics.TextUtil.estimateMeasurer(9); } },
    { class: 'Float', name: 'height', value: 44 },
    { class: 'Float', name: 'width',  value: 400 }
  ],

  methods: [
    function toE(args, X) {
      return this.Canvas.create({ cview: this, width$: this.width$, height$: this.height$ }, X);
    },

    function paintSelf(ctx) {
      var T = this.theme, snap = this.snapshot, text = snap ? snap.input : this.text;
      var pos = snap ? snap.pos : -1, tryStart = snap ? snap.tryStart : -1, failPos = snap ? snap.failPos : -1, probe = snap ? snap.probe : null;
      var font = T.font('ribbon'), cw = this.measure('M', font), x0 = this.X0, top = this.TOP, h = this.ROW_H;
      var amber = T.outcomeColor(foam.parse.rail.Outcome.TRYING);

      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, this.width, this.height);
      ctx.font = font;
      for ( var i = 0 ; i < text.length ; i++ ) {
        var x = x0 + i * cw, bg = null;
        if ( pos >= 0 && i < pos ) bg = T.resolve('consumedBg');
        if ( i === failPos )       bg = T.resolve('failBg');
        if ( bg ) { ctx.fillStyle = bg; ctx.fillRect(x, top, cw, h); }
        if ( probe && i >= probe.start && i < probe.end ) {
          ctx.strokeStyle = amber; ctx.lineWidth = 2; ctx.setLineDash([]);
          ctx.strokeRect(x + 1, top - 1, cw - 2, h + 2);
        } else if ( snap && ! snap.finished && i === pos ) {
          ctx.strokeStyle = T.resolve('muted'); ctx.lineWidth = 1; ctx.setLineDash([ 2, 2 ]);
          ctx.strokeRect(x + 1.5, top - 0.5, cw - 3, h + 1);
          ctx.setLineDash([]);
        }
        ctx.fillStyle = pos >= 0 && i >= pos ? T.resolve('muted') : T.resolve('text');
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(text[i], x, this.BASELINE);
        if ( i % this.TICK_EVERY === 0 ) {
          ctx.fillStyle = T.resolve('muted'); ctx.font = T.font('badge');
          ctx.fillText(String(i), x, this.height - 3);
          ctx.font = font;
        }
      }
      if ( probe && probe.end === probe.start ) {     // end-of-input test: box the slot after the text
        ctx.strokeStyle = amber; ctx.lineWidth = 2;
        ctx.strokeRect(x0 + probe.start * cw + 1, top - 1, cw - 2, h + 2);
      }
      if ( tryStart >= 0 && pos >= tryStart ) {
        ctx.strokeStyle = amber; ctx.lineWidth = this.UNDERLINE_W;
        ctx.beginPath(); ctx.moveTo(x0 + tryStart * cw, top + h + 1); ctx.lineTo(x0 + Math.max(pos, tryStart + 0.3) * cw, top + h + 1); ctx.stroke();
      }
      if ( pos >= 0 ) {
        ctx.strokeStyle = T.resolve('text'); ctx.lineWidth = this.CARET_W;
        ctx.beginPath(); ctx.moveTo(x0 + pos * cw, top - 2); ctx.lineTo(x0 + pos * cw, top + h + 2); ctx.stroke();
      }
    },

    function hitTest(p) { return false; }
  ]
});
