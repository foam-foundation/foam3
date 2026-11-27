/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'ColorScale',

  documentation: `
    Maps a number onto a shade of one colour, for a heatmap. The lowest value
    gets a pale shade (the strong colour faded toward the tint) and the highest
    gets the strong colour itself: with min 0, max 100 and a blue strong
    colour, 50 is the blue half way between the pale shade and full blue.
    Colours are resolved values such as '#0A4AC6' or 'rgb(10, 74, 198)', never
    theme tokens, so a PDF export keeps them. Pure maths, no DOM.
  `,

  constants: [
    {
      name: 'DARK_LUMINANCE',
      documentation: 'A colour whose luminance (0 black, 1 white) is below this is dark, and needs light text on it.',
      value: 0.5
    },
    {
      name: 'LUMA_RED',
      documentation: 'Share of red in perceived brightness (Rec. 601): green counts most, blue least.',
      value: 0.299
    },
    {
      name: 'LUMA_GREEN',
      documentation: 'Share of green in perceived brightness (Rec. 601).',
      value: 0.587
    },
    {
      name: 'LUMA_BLUE',
      documentation: 'Share of blue in perceived brightness (Rec. 601).',
      value: 0.114
    },
    {
      name: 'MAX_CHANNEL',
      documentation: 'Largest value of one red, green or blue channel.',
      value: 255
    }
  ],

  properties: [
    { class: 'Float', name: 'min' },
    { class: 'Float', name: 'max', value: 1 },
    {
      class: 'String',
      name: 'strong',
      documentation: 'Resolved colour of the highest value.'
    },
    {
      class: 'String',
      name: 'tint',
      documentation: 'Resolved colour the strong colour fades toward for the lowest value, usually the page background.'
    },
    {
      class: 'Float',
      name: 'fade',
      value: 0.85,
      documentation: 'How far the lowest value fades toward the tint: 0 leaves it as strong as the highest, 1 makes it the tint itself.'
    }
  ],

  methods: [
    function parse_(c) {
      // '#0A4AC6', '#0af' and 'rgb(10, 74, 198)' give [ 10, 74, 198 ]; any
      // other text gives black, so a mistyped colour still draws.
      var s = String(c || '').trim();
      var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
      if ( m ) {
        var h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
        return [ 0, 2, 4 ].map(function(i) { return parseInt(h.substr(i, 2), 16); });
      }
      m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
      return m ? [ Number(m[1]), Number(m[2]), Number(m[3]) ] : [ 0, 0, 0 ];
    },

    function blend(a, b, t) {
      // The colour t of the way from a to b: blend('#000000', '#ffffff', 0.5) is '#808080'.
      var ca = this.parse_(a), cb = this.parse_(b);
      var self = this, hex = function(i) {
        var v = Math.round(ca[i] + ( cb[i] - ca[i] ) * t);
        return ( '0' + Math.max(0, Math.min(self.MAX_CHANNEL, v)).toString(16) ).slice(-2);
      };
      return '#' + hex(0) + hex(1) + hex(2);
    },

    function light() {
      return this.blend(this.strong, this.tint, this.fade);
    },

    function share(v) {
      // 0 at min, 1 at max; with one value alone (min === max) every cell is as strong as it gets.
      var span = this.max - this.min;
      if ( ! span ) return 1;
      return Math.max(0, Math.min(1, ( v - this.min ) / span));
    },

    function colorAt(v) {
      return this.blend(this.light(), this.strong, this.share(v));
    },

    function isDark(color) {
      var c = this.parse_(color);
      var l = ( c[0] * this.LUMA_RED + c[1] * this.LUMA_GREEN + c[2] * this.LUMA_BLUE ) / this.MAX_CHANNEL;
      return l < this.DARK_LUMINANCE;
    }
  ]
});
