/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'GaugeChart',
  extends: 'foam.u2.chart.ChartView',

  documentation: `
    One number against a range, as a half-circle dial: today's visits against
    a target, say. The first dataset's first value is the number, and min and
    max are the two ends of the dial. With min 0, max 200 and the value 150,
    the arc fills three quarters of the track.

    A value outside the range fills the arc to the nearer end of the dial; the
    label under the dial still shows the real number. With no value (an empty
    data list, or one that is not a number) only the track is drawn.

    bands colour stretches of the track, for example red to 50, amber to 80
    and green to 100. The value arc then takes the colour of the band the
    value is in, and a value past the last band's upTo counts as in the last
    band. The legend is off by default, since there is one value; when it is
    on it lists the bands, and a click on an entry hides nothing.

    Hovering the dial shows the value and the band it is in. Clicking it calls
    onValueClick(event).
  `,

  requires: [
    'foam.u2.chart.GaugeBand',
    'foam.u2.chart.SVGPath'
  ],

  constants: [
    {
      name: 'EDGE_PX',
      documentation: 'Gap between the dial and the edge of the chart.',
      value: 4
    },
    {
      name: 'RING_RATIO',
      documentation: 'Width of the ring as a share of the dial\'s radius: at 0.25 a 100 pixel dial has a 25 pixel ring.',
      value: 0.25
    },
    {
      name: 'BAND_OPACITY',
      documentation: 'How strongly a band shows on the track; the value arc, drawn over it at full strength, stands out.',
      value: 0.35
    },
    {
      name: 'TEXT_GAP_PX',
      documentation: 'Gap between the dial\'s flat edge and the labels under it.',
      value: 6
    },
    {
      name: 'VALUE_FONT_RATIO',
      documentation: 'Size of the value label as a multiple of the other labels: 2 gives a 24 pixel value over 12 pixel ends.',
      value: 2
    }
  ],

  css: `
    <<track { fill: $borderLight; }
    <<hit { fill: transparent; }
    <<clickable <<hit { cursor: pointer; }
    <<value { fill: $textDefault; font-weight: $font-medium; }

    @media (prefers-reduced-motion: no-preference) {
      <<animated <<value-arc {
        animation-name: foam-u2-chart-GaugeChart-fade;
        animation-timing-function: ease-out;
      }
    }
    @keyframes foam-u2-chart-GaugeChart-fade { from { opacity: 0; } }
  `,

  messages: [
    { name: 'BAND', message: 'Band' }
  ],

  properties: [
    {
      class: 'Double',
      name: 'min',
      documentation: 'The value at the left end of the dial.'
    },
    {
      class: 'Double',
      name: 'max',
      value: 100,
      documentation: 'The value at the right end of the dial.'
    },
    {
      class: 'FObjectArray',
      of: 'foam.u2.chart.GaugeBand',
      name: 'bands',
      documentation: 'Coloured stretches of the track. A plain object such as { upTo, color } adapts to a GaugeBand.'
    },
    {
      class: 'Function',
      name: 'onValueClick',
      // A Function property defaults to an empty function, which would show
      // the pointer cursor on a chart nobody can click.
      value: null,
      documentation: 'Called with the click event when the dial is clicked.'
    },
    {
      // One value, so there is nothing to tell apart.
      name: 'showLegend',
      value: false
    },
    {
      // The legend explains the bands; hiding one would change nothing.
      name: 'legendClickable',
      value: false
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.enableClass(this.myClass('clickable'), this.onValueClick$.map(function(f) { return !! f; }));
    },

    function value_() {
      // The number on the dial, or null when there is none.
      var ds = this.datasets[0];
      var v  = ds && ds.data ? ds.data[0] : null;
      return typeof v === 'number' && isFinite(v) ? v : null;
    },

    function fraction_(v) {
      // How far along the dial v is, from 0 at min to 1 at max, held to
      // that range: 150 on a 0 to 100 dial is 1.
      var span = this.max - this.min;
      return span > 0 ? Math.max(0, Math.min(1, ( v - this.min ) / span)) : 0;
    },

    function bandRanges_() {
      // The bands in order of upTo, each as { band, from, to, color }: a band
      // starts where the one before it ends, and the first at min.
      var self  = this;
      var from  = this.min;
      return this.bands
        .filter(function(b) { return isFinite(b.upTo); })
        .sort(function(a, b) { return a.upTo - b.upTo; })
        .map(function(b, i) {
          var range = {
            band:  b,
            from:  from,
            to:    b.upTo,
            color: b.color ? foam.CSS.returnTokenValue(b.color, self.cls_, self.__subContext__) : self.defaultColor(i)
          };
          from = b.upTo;
          return range;
        });
    },

    function bandOf_(v) {
      // The band v is in: the first whose upTo reaches it, or the last band
      // for a value past them all. Null when there are no bands.
      var ranges = this.bandRanges_();
      return ranges.find(function(r) { return v <= r.to; }) || ranges[ranges.length - 1] || null;
    },

    function bandLabel_(range) {
      return this.formatValue(range.from) + ' – ' + this.formatValue(range.to);
    },

    function legendItems() {
      var self = this;
      return this.bandRanges_().map(function(r) {
        return { label: self.bandLabel_(r), color: r.color, hidden: false };
      });
    },

    function ringPath_(cx, cy, r, r0, f0, f1) {
      // The stretch of the ring from f0 to f1 of the way along the dial,
      // 0 being the left end and 1 the right. The dial's top is 0.5.
      var pt = function(rad, f) {
        return { x: cx - rad * Math.cos(Math.PI * f), y: cy - rad * Math.sin(Math.PI * f) };
      };
      var p0 = pt(r, f0),  p1 = pt(r, f1);
      var q0 = pt(r0, f0), q1 = pt(r0, f1);
      // A stretch is never more than half a circle, so never the large arc.
      return this.SVGPath.create()
        .moveTo(p0.x, p0.y).arcTo(r, false, true, p1.x, p1.y)
        .lineTo(q1.x, q1.y).arcTo(r0, false, false, q0.x, q0.y)
        .close();
    },

    function drawChart(svg, w, h) {
      var self    = this;
      var v       = this.value_();
      var fontPx  = this.fontPx();
      var valuePx = fontPx * this.VALUE_FONT_RATIO;
      var labelsH = valuePx + this.TEXT_GAP_PX;
      var r       = Math.max(0, Math.min(w / 2 - this.EDGE_PX, h - 2 * this.EDGE_PX - labelsH));
      if ( r <= 0 ) return;
      var r0 = r * ( 1 - this.RING_RATIO );
      var cx = w / 2;
      // The dial and the labels under it are centred as one block.
      var cy = Math.max(this.EDGE_PX, ( h - r - labelsH ) / 2) + r;
      var span = this.max - this.min;
      var band = v === null ? null : this.bandOf_(v);

      svg.start('g').call(function() {
        var g = this;
        g.start('path').addClass(self.myClass('track'))
          .attrs({ d: self.ringPath_(cx, cy, r, r0, 0, 1) })
        .end();
        self.bandRanges_().forEach(function(range) {
          var f0 = self.fraction_(range.from), f1 = self.fraction_(range.to);
          if ( span <= 0 || f1 <= f0 ) return;
          g.start('path').addClass(self.myClass('band'))
            .attrs({ d: self.ringPath_(cx, cy, r, r0, f0, f1), fill: range.color, 'fill-opacity': self.BAND_OPACITY })
          .end();
        });
        var f = v === null ? 0 : self.fraction_(v);
        if ( f > 0 ) {
          g.start('path').addClass(self.myClass('value-arc'))
            .attrs({ d: self.ringPath_(cx, cy, r, r0, 0, f), fill: band ? band.color : self.seriesColor(0, 0) })
          .end();
        }
        g.start('path').addClass(self.myClass('hit'))
          .attrs({ d: self.ringPath_(cx, cy, r, r0, 0, 1) })
          .on('mousemove', function(evt) { self.showValueTooltip_(evt); })
          .on('mouseleave', self.hideTooltip)
          .on('click', function(evt) { if ( self.onValueClick ) self.onValueClick(evt); })
        .end();

        var ringMid = ( r + r0 ) / 2;
        var endY    = cy + self.TEXT_GAP_PX + fontPx;
        g.start('text').addClass(self.myClass('text')).addClass(self.myClass('min'))
          .attrs({ x: cx - ringMid, y: endY, 'text-anchor': 'middle' }).add(self.formatValue(self.min))
        .end();
        g.start('text').addClass(self.myClass('text')).addClass(self.myClass('max'))
          .attrs({ x: cx + ringMid, y: endY, 'text-anchor': 'middle' }).add(self.formatValue(self.max))
        .end();
        if ( v !== null ) {
          g.start('text').addClass(self.myClass('value'))
            .attrs({ x: cx, y: cy + self.TEXT_GAP_PX + valuePx, 'text-anchor': 'middle', 'font-size': valuePx })
            .add(self.formatValue(v))
          .end();
        }
      }).end();
    },

    function showValueTooltip_(evt) {
      var v = this.value_();
      if ( v === null ) return;
      var ds   = this.datasets[0];
      var band = this.bandOf_(v);
      var rows = [ { color: band ? band.color : this.seriesColor(0, 0), label: ds.label || '', value: this.formatValue(v) } ];
      if ( band ) rows.push({ color: band.color, label: this.BAND, value: this.bandLabel_(band) });
      this.showTooltip(evt, '', rows);
    }
  ]
});
