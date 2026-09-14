/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.graphics',
  name: 'TooltipCView',
  extends: 'foam.graphics.Box',

  documentation: `
    One reusable tooltip box painted in a scene's overlay layer. The owner sets
    text, positions it with x/y, and calls layout(); the box sizes itself from
    the measured text. Never a hit target.
  `,

  requires: [ 'foam.graphics.CViewTheme' ],

  constants: {
    LINE_HEIGHT_RATIO: 1.3,   // box height = font px size * ratio + 2 * padding
    DEFAULT_FONT_PX:   12     // when the font shorthand carries no px size
  },

  properties: [
    { class: 'String', name: 'text' },
    {
      name: 'theme',
      documentation: 'Tokens used: colors "tooltipBg", "tooltipBorder", "tooltipText"; font "tooltip".',
      factory: function() { return this.CViewTheme.create(); }
    },
    {
      name: 'measure',
      documentation: 'function(text, font) -> px; the owner passes scene.measure.',
      factory: function() { return function(text) { return text.length * 7; }; }
    },
    { class: 'Float', name: 'padding', value: 6 },
    { class: 'Int',   name: 'cornerRadius', value: 4 },
    { class: 'String', name: 'font', expression: function(theme) { return theme.font('tooltip'); } },
    { name: 'color',  expression: function(theme) { return theme.resolve('tooltipBg'); } },
    { name: 'border', expression: function(theme) { return theme.resolve('tooltipBorder'); } }
  ],

  methods: [
    function fontPx() {
      /** Pixel size parsed from a CSS font shorthand like "bold 11px sans-serif". */
      var m = /(\d+(?:\.\d+)?)px/.exec(this.font);
      return m ? parseFloat(m[1]) : this.DEFAULT_FONT_PX;
    },

    function layout() {
      /** Sizes the box to its text; call after changing text or font. */
      this.width  = this.measure(this.text, this.font) + 2 * this.padding;
      this.height = this.fontPx() * this.LINE_HEIGHT_RATIO + 2 * this.padding;
    },

    function paintSelf(x) {
      this.SUPER(x);                                   // Box paints fill and border
      x.font         = this.font;
      x.fillStyle    = this.theme.resolve('tooltipText');
      x.textBaseline = 'middle';
      x.fillText(this.text, this.padding, this.height / 2);
    },

    function hitTest(p) { return false; }
  ]
});
