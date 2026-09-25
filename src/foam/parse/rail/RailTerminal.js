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
    function fillToken()    { return 'terminal'; },   // css class on the box: terminal | ruleref | generic

    function svgSelf(g) {
      var T = this.theme;
      this.svgBox(g, this.width, this.height, this.cornerRadius(), this.fillToken());
      this.svgLabel(g, this.text);
      this.svgGlyph(g);
      this.svgValue(g);
      if ( this.badge ) this.svgText(g, 'badge', this.badge, this.width - this.BADGE_INSET, T.PAD, 'end');
    }
  ]
});
