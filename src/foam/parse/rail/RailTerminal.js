/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail',
  name: 'RailTerminal',
  extends: 'foam.parse.rail.RailElement',

  documentation: 'Rounded box for a terminal parser: Literal, LiteralIC (aA badge), Range, Chars, NotChars, AnyChar, EOF.',

  constants: {
    CORNER_RADIUS: 10,
    BADGE_MARGIN: 8,      // gap between label and badge
    BADGE_INSET: 4        // badge sits this far from the right edge
  },

  properties: [
    { class: 'String', name: 'text' },
    { class: 'String', name: 'badge', documentation: 'Small tag in the top-right corner, e.g. "aA"; empty for none.' },
    {
      class: 'Float',
      name: 'width',
      expression: function(text, badge, theme, measure) {
        return theme.GLYPH_SLOT + measure(text, theme.font('label')) + theme.PAD * 2
             + ( badge ? measure(badge, theme.font('badge')) + this.BADGE_MARGIN : 0 );
      }
    },
    { class: 'Float', name: 'height', factory: function() { return this.theme.BOX_H; } }
  ],

  methods: [
    function cornerRadius() { return this.CORNER_RADIUS; },
    function fillToken()    { return 'terminalBg'; },

    function paintSelf(ctx) {
      var T = this.theme;
      foam.parse.rail.Track.roundRect(ctx, 0, 0, this.width, this.height, this.cornerRadius());
      ctx.fillStyle = T.resolve(this.fillToken());
      ctx.fill();
      ctx.lineWidth = this.strokeWidth(); ctx.strokeStyle = this.outcomeColor();
      ctx.stroke();
      this.paintLabel(ctx, this.text);
      this.paintGlyph(ctx);
      if ( this.badge ) {
        ctx.font = T.font('badge'); ctx.fillStyle = T.resolve('muted');
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(this.badge, this.width - this.BADGE_INSET, T.PAD);
      }
    }
  ]
});
