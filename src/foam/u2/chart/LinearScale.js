/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'LinearScale',

  documentation: `
    Maps a range of numbers onto a range of pixels and picks round tick
    values. Data from 0 to 7,800 drawn with about five ticks becomes an axis
    from 0 to 8,000 in steps of 2,000, so every gridline sits on a round
    number. Call nice() once min, max and tickCount are set.
  `,

  properties: [
    { class: 'Float', name: 'min' },
    { class: 'Float', name: 'max', value: 1 },
    {
      class: 'Float',
      name: 'start',
      documentation: 'Pixel position of min.'
    },
    {
      class: 'Float',
      name: 'end',
      value: 1,
      documentation: 'Pixel position of max; smaller than start on a vertical axis, which grows upward.'
    },
    {
      class: 'Int',
      name: 'tickCount',
      value: 5,
      documentation: 'About how many steps the axis should have; nice() picks the closest round step.'
    },
    {
      class: 'Float',
      name: 'step',
      documentation: 'Distance between two ticks, set by nice().'
    }
  ],

  methods: [
    function nice() {
      var min = this.min, max = this.max;
      // A flat series (every value 5) still needs a range to draw on.
      if ( min === max ) {
        if ( min === 0 ) max = 1;
        else { min -= Math.abs(min) * 0.5; max += Math.abs(max) * 0.5; }
      }
      var raw  = ( max - min ) / Math.max(1, this.tickCount);
      var mag  = Math.pow(10, Math.floor(Math.log10(raw)));
      var norm = raw / mag;
      var step = ( norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10 ) * mag;
      this.step = step;
      // 0.2 / 0.05 is 4.000000000000001 in floating point; without the
      // tolerance the axis would get an extra, empty step up to 0.25.
      this.min  = Math.floor(min / step + 1e-9) * step;
      this.max  = Math.ceil(max / step - 1e-9) * step;
      return this;
    },

    function decimals_() {
      // Steps are 1, 2 or 5 times a power of ten, so a step of 0.05 needs
      // two decimals and a step of 1,000 needs none.
      if ( ! this.step ) return 0;
      return Math.max(0, - Math.floor(Math.log10(this.step)));
    },

    function ticks() {
      if ( ! this.step ) return [ this.min, this.max ];
      var d = this.decimals_();
      var n = Math.round(( this.max - this.min ) / this.step);
      var ret = [];
      for ( var i = 0 ; i <= n ; i++ ) ret.push(Number(( this.min + i * this.step ).toFixed(d)));
      return ret;
    },

    function map(v) {
      var span = this.max - this.min;
      if ( ! span ) return ( this.start + this.end ) / 2;
      return this.start + ( v - this.min ) / span * ( this.end - this.start );
    },

    function format(v) {
      return Number(v).toLocaleString(foam.locale, { maximumFractionDigits: this.decimals_() });
    }
  ]
});
