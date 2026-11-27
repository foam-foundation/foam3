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

  constants: [
    {
      name: 'EPSILON',
      documentation: `Slack for floating-point division: 0.2 / 0.05 is 4.000000000000001,
        and without slack an axis from 0 to 0.2 in steps of 0.05 gets an extra, empty step.`,
      value: 1e-9
    },
    {
      name: 'MAX_TICKS',
      documentation: 'Most ticks ticks() returns, so a hand-set range far wider than its step cannot build thousands.',
      value: 200
    },
    {
      name: 'FLAT_SPREAD',
      documentation: 'A flat series (every value 5) is drawn this share above and below its value: from 2.5 to 7.5.',
      value: 0.5
    }
  ],

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
    },
    {
      class: 'String',
      name: 'suffix',
      documentation: 'Written after every formatted value: "%" turns 40 into "40%".'
    }
  ],

  methods: [
    function nice() {
      var min = this.min, max = this.max;
      // A flat series (every value 5) still needs a range to draw on.
      if ( min === max ) {
        if ( min === 0 ) max = 1;
        else { min -= Math.abs(min) * this.FLAT_SPREAD; max += Math.abs(max) * this.FLAT_SPREAD; }
      }
      var raw  = ( max - min ) / Math.max(1, this.tickCount);
      var mag  = Math.pow(10, Math.floor(Math.log10(raw)));
      var norm = raw / mag;
      var step = ( norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10 ) * mag;
      this.step = step;
      this.min  = Math.floor(min / step + this.EPSILON) * step;
      this.max  = Math.ceil(max / step - this.EPSILON) * step;
      return this;
    },

    function decimals_() {
      // Steps are 1, 2 or 5 times a power of ten, so a step of 0.05 needs
      // two decimals and a step of 1,000 needs none.
      if ( ! this.step ) return 0;
      return Math.max(0, - Math.floor(Math.log10(this.step)));
    },

    function ticks() {
      // Every multiple of step from min to max. Ends set by hand need not be
      // multiples: min 3, max 10 and step 2 give ticks at 4, 6, 8 and 10.
      if ( ! this.step ) return [ this.min, this.max ];
      var d     = this.decimals_();
      var first = Math.ceil(this.min / this.step - this.EPSILON);
      var last  = Math.floor(this.max / this.step + this.EPSILON);
      var ret   = [];
      for ( var i = first ; i <= last && ret.length < this.MAX_TICKS ; i++ ) ret.push(Number(( i * this.step ).toFixed(d)));
      return ret;
    },

    function map(v) {
      var span = this.max - this.min;
      if ( ! span ) return ( this.start + this.end ) / 2;
      return this.start + ( v - this.min ) / span * ( this.end - this.start );
    },

    function format(v) {
      return Number(v).toLocaleString(foam.locale, { maximumFractionDigits: this.decimals_() }) + this.suffix;
    }
  ]
});
