/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'BandScale',

  documentation: `
    Splits a pixel range into one band per category, for bar charts. Ten
    categories over 500 pixels give 50-pixel bands; with the default fill of
    0.72 each bar is 36 pixels wide and centred in its band, which leaves a
    gap between neighbours.
  `,

  properties: [
    { class: 'Int', name: 'count' },
    { class: 'Float', name: 'start' },
    { class: 'Float', name: 'end', value: 1 },
    {
      class: 'Float',
      name: 'fill',
      value: 0.72,
      documentation: 'Share of each band the bars cover; the rest is the gap between categories.'
    }
  ],

  methods: [
    function step() {
      return this.count ? ( this.end - this.start ) / this.count : 0;
    },

    function bandwidth() {
      return Math.abs(this.step()) * this.fill;
    },

    function center(i) {
      return this.start + ( i + 0.5 ) * this.step();
    }
  ]
});
