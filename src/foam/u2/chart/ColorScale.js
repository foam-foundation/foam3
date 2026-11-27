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
    Colours are resolved values such as '#0A4AC6', 'rgb(10, 74, 198)' or 'hsl(220, 90%, 40%)', never
    theme tokens, so a PDF export keeps them. Pure maths, no DOM.
  `,

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
    function blend(a, b, t) {
      // The colour t of the way from a to b: blend('#000000', '#ffffff', 0.5)
      // is '#808080'. Any colour foam.Color.parse reads works: hex, rgb(),
      // hsl() or a name.
      var ca = foam.Color.parse(a), cb = foam.Color.parse(b);
      var hex = function(k) {
        var from = Number(ca[k]), to = Number(cb[k]);
        var v = Math.round(from + ( to - from ) * t);
        return ( '0' + Math.max(0, Math.min(255, v)).toString(16) ).slice(-2);
      };
      return '#' + hex('red') + hex('green') + hex('blue');
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
    }
  ]
});
