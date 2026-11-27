/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'FunnelChart',
  extends: 'foam.u2.chart.ChartView',

  documentation: `
    How much of a process survives each step. labels name the steps, in
    process order, and the first dataset holds one value per step:
    labels: [ 'Home', 'Product', 'Basket', 'Checkout' ], datasets: [ { data: [ 1000, 640, 280, 90 ] } ]
    draws four bands from top to bottom, each as wide as its value and
    centred, so the funnel narrows from 1000 to 90.

    Each band is a trapezoid whose top is as wide as its step and whose
    bottom is as wide as the next step, so the bands join into one shape;
    the last band is a rectangle. The widest visible step takes the full
    width, and the steps keep the order of labels: a funnel's order is the
    process order, not the value order.

    A band is labelled with its step name, its value and its share of the
    first visible step ("Basket · 280 · 28%"), cut short when the band is too
    narrow. A step with a value of 0 draws as a thin band; a step with a
    negative or missing value is left out.

    The legend has one entry per step; clicking one hides that step and the
    funnel redraws without it, so the first visible step becomes 100%.

    Hovering a band shows its value, its share of the first step and its
    share of the step before. Clicking one calls onStepClick(index, event),
    where index is the position in labels.
  `,

  requires: [
    'foam.u2.chart.SVGPath'
  ],

  constants: [
    {
      name: 'GAP_PX',
      documentation: 'Vertical gap between two bands, so the steps read as separate; 3 pixels leaves a visible line between 50-pixel bands.',
      value: 3
    },
    {
      name: 'MIN_BAND_PX',
      documentation: 'Narrowest and shortest a band is drawn, so a step of 0 is still a visible, hoverable sliver instead of nothing.',
      value: 2
    },
    {
      name: 'LABEL_PAD_PX',
      documentation: 'Room kept either side of a band\'s label, so the text never touches the slanted edge.',
      value: 6
    },
    {
      name: 'LIGHT_TEXT_COLOR',
      documentation: 'Theme token for the label written on a dark band.',
      value: '$white'
    },
    {
      name: 'DARK_TEXT_COLOR',
      documentation: 'Theme token for the label written on a light band.',
      value: '$black'
    }
  ],

  css: `
    <<band { stroke: transparent; pointer-events: none; }
    <<band-label { pointer-events: none; font-size: 1.2rem; }
    <<hit { fill: transparent; }
    <<hit:hover { fill: $borderLight; fill-opacity: 0.35; }
    <<clickable <<hit { cursor: pointer; }

    @media (prefers-reduced-motion: no-preference) {
      <<animated <<bands {
        animation-name: foam-u2-chart-FunnelChart-fade;
        animation-timing-function: ease-out;
      }
    }
    @keyframes foam-u2-chart-FunnelChart-fade { from { opacity: 0; } }
  `,

  messages: [
    { name: 'VALUE',       message: 'Value' },
    { name: 'OF_FIRST',    message: 'Of first step' },
    { name: 'OF_PREVIOUS', message: 'Of previous step' }
  ],

  properties: [
    {
      class: 'Function',
      name: 'onStepClick',
      // A Function property defaults to an empty function, which would show
      // the pointer cursor on a chart nobody can click.
      value: null,
      documentation: 'Called with (index, event) when a step is clicked; index is its position in labels.'
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.enableClass(this.myClass('clickable'), this.onStepClick$.map(function(f) { return !! f; }));
    },

    function steps_() {
      // One { index, name, value } per step that is drawn, in label order.
      // index is the position in labels, which is also the legend entry's
      // index. A hidden step, and one whose value is negative or missing, is
      // left out: 1000, -5, 90 draws two bands.
      var data = this.datasets.length ? this.datasets[0].data || [] : [];
      var out  = [];
      this.labels.forEach(function(l, j) {
        var v = data[j] == null ? NaN : Number(data[j]);
        if ( this.isHidden(j) || ! isFinite(v) || v < 0 ) return;
        out.push({ index: j, name: String(l), value: v });
      }, this);
      return out;
    },

    function percent_(v, of) {
      // "28%" for 280 of 1000; a share under 1% reads "<1%", not "0%", so a tiny step is not mistaken for an empty one.
      var pct = of > 0 ? v / of * 100 : 0;
      return pct > 0 && pct < 0.5 ? '<1%' : Math.round(pct) + '%';
    },

    function legendItems() {
      // One entry per label, so the entry's index is the label's index. A
      // step that is left out for a negative value shows as hidden.
      var self = this;
      var data = this.datasets.length ? this.datasets[0].data || [] : [];
      return this.labels.map(function(l, j) {
        var v = data[j] == null ? NaN : Number(data[j]);
        return { label: String(l), color: self.seriesColor(0, j), hidden: self.isHidden(j) || ! isFinite(v) || v < 0 };
      });
    },

    function seriesColor(i, opt_index) {
      // Steps take the dataset's colours in turn, then the theme defaults.
      var ds = this.datasets[0];
      var bg = ds && ds.backgroundColor;
      var j  = opt_index || 0;
      if ( Array.isArray(bg) && bg.length ) return bg[j % bg.length];
      return this.defaultColor(j);
    },

    function drawChart(svg, w, h) {
      var self  = this;
      var steps = this.steps_();
      var n     = steps.length;
      if ( ! n ) return;

      var max   = Math.max.apply(null, steps.map(function(s) { return s.value; }));
      var first = steps[0].value;
      var bh    = Math.max(this.MIN_BAND_PX, ( h - ( n - 1 ) * this.GAP_PX ) / n);
      var cx    = w / 2;
      var light = foam.CSS.returnTokenValue(this.LIGHT_TEXT_COLOR, this.cls_, this.__subContext__);
      var dark  = foam.CSS.returnTokenValue(this.DARK_TEXT_COLOR, this.cls_, this.__subContext__);
      var fp    = this.fontPx();
      // A step's width in proportion to its value; a 0 keeps a sliver.
      var width = function(s) { return Math.max(self.MIN_BAND_PX, max > 0 ? s.value / max * w : 0); };

      svg.start('g').addClass(this.myClass('bands')).forEach(steps, function(s, k) {
        var y0   = k * ( bh + self.GAP_PX );
        var wt   = width(s);
        // The bottom edge is as wide as the next step, so the bands join; the last band is a rectangle.
        var wb   = k < n - 1 ? width(steps[k + 1]) : wt;
        var fill = self.seriesColor(0, s.index);
        this.start('path').addClass(self.myClass('band'))
          .attrs({
            d: self.SVGPath.create()
              .moveTo(cx - wt / 2, y0).lineTo(cx + wt / 2, y0)
              .lineTo(cx + wb / 2, y0 + bh).lineTo(cx - wb / 2, y0 + bh).close().toString(),
            fill: fill
          })
        .end();

        // The label sits mid-band, so it must fit the band's width at the top
        // and bottom of its own line, not at the band's far edges.
        var half  = fp / 2 / bh;
        var wAt   = function(f) { return wt + ( wb - wt ) * f; };
        var avail = Math.min(wAt(0.5 - half), wAt(0.5 + half)) - 2 * self.LABEL_PAD_PX;
        var text  = avail > 0 && bh >= fp ?
          self.truncate([ s.name, self.formatValue(s.value), self.percent_(s.value, first) ].join(' · '), avail) : '';
        if ( text && text !== '…' ) {
          this.start('text').addClass(self.myClass('band-label'))
            .attrs({
              x: cx, y: y0 + bh / 2,
              'text-anchor': 'middle', 'dominant-baseline': 'central',
              fill: foam.Color.getBestForeground(fill, dark, light)
            })
            .add(text)
          .end();
        }
      }).end();

      // One transparent row per band on top, so a thin band can still be hovered and clicked.
      svg.start('g').forEach(steps, function(s, k) {
        this.start('rect').addClass(self.myClass('hit'))
          .attrs({ x: 0, y: k * ( bh + self.GAP_PX ), width: w, height: bh })
          .on('mousemove', function(evt) { self.showStepTooltip_(evt, steps, k); })
          .on('mouseleave', self.hideTooltip)
          .on('click', function(evt) { if ( self.onStepClick ) self.onStepClick(s.index, evt); })
        .end();
      }).end();
    },

    function showStepTooltip_(evt, steps, k) {
      var s    = steps[k];
      var rows = [
        { color: this.seriesColor(0, s.index), label: this.VALUE, value: this.formatValue(s.value) },
        { label: this.OF_FIRST, value: this.percent_(s.value, steps[0].value) }
      ];
      if ( k > 0 ) rows.push({ label: this.OF_PREVIOUS, value: this.percent_(s.value, steps[k - 1].value) });
      this.showTooltip(evt, s.name, rows);
    }
  ]
});
