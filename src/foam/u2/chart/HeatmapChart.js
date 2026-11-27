/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'HeatmapChart',
  extends: 'foam.u2.chart.CartesianChartView',

  documentation: `
    A grid of cells coloured by value: requests per hour of the day (columns)
    for each log severity (rows), say. labels are the column names and each
    dataset is one row, with one value per label and null for a cell that has
    no value:
    labels: [ '09', '10' ], datasets: [ { label: 'ERROR', data: [ 4, null ] },
    { label: 'INFO', data: [ 120, 80 ] } ]. The first dataset is drawn at the
    top.

    The lowest value is a pale shade of one colour and the highest is the
    colour itself, which is the first dataset's backgroundColor, or the first
    theme colour. A cell with no value is drawn in a neutral colour, never as
    zero. In place of a series legend there is a colour scale showing the
    lowest and highest value.

    Hovering a cell shows its row, column and value. Clicking one calls
    onCellClick(xIndex, yIndex, event), where xIndex is the position in
    labels and yIndex the position in datasets.
  `,

  requires: [
    'foam.u2.chart.BandScale',
    'foam.u2.chart.ColorScale'
  ],

  constants: [
    {
      name: 'CELL_FILL',
      documentation: 'Share of a band a cell covers; the rest is the gap between cells: 0.94 leaves a 3-pixel gap between 50-pixel cells.',
      value: 0.94
    },
    {
      name: 'CELL_TEXT_PAD_PX',
      documentation: 'Room kept either side of a value written inside a cell, so the text never touches its edge.',
      value: 4
    },
    {
      name: 'TINT_COLOR',
      documentation: 'Theme token the lowest value fades toward: the page background, so the pale end is white in a light theme and dark in a dark one.',
      value: '$backgroundDefault'
    },
    {
      name: 'EMPTY_COLOR',
      documentation: 'Theme token for a cell with no value: neutral, so it is never read as the lowest value.',
      value: '$backgroundTertiary'
    },
    {
      name: 'LIGHT_TEXT_COLOR',
      documentation: 'Theme token for the value written on a dark cell.',
      value: '$white'
    },
    {
      name: 'DARK_TEXT_COLOR',
      documentation: 'Theme token for the value written on a light cell.',
      value: '$black'
    }
  ],

  css: `
    <<cell { stroke: transparent; stroke-width: 1; }
    <<cell:hover { stroke: $textDefault; }
    <<clickable <<cell { cursor: pointer; }
    <<cell-value { pointer-events: none; font-size: 1.1rem; }

    <<scale { display: flex; align-items: center; gap: 0.8rem; }
    <<scale-vertical { flex-direction: column-reverse; }
    <<scale-bar { flex: none; width: 14rem; height: 1.2rem; border-radius: 0.2rem; }
    <<scale-vertical <<scale-bar { width: 1.2rem; height: 14rem; }

    @media (prefers-reduced-motion: no-preference) {
      <<animated <<cells {
        animation-name: foam-u2-chart-HeatmapChart-fade;
        animation-timing-function: ease-out;
      }
    }
    @keyframes foam-u2-chart-HeatmapChart-fade { from { opacity: 0; } }
  `,

  properties: [
    {
      class: 'Boolean',
      name: 'showValues',
      documentation: 'Write each cell\'s value inside it, when the text fits. Off by default: a crowded grid reads better as colour.'
    },
    {
      class: 'Function',
      name: 'onCellClick',
      // A Function property defaults to an empty function, which would show
      // the pointer cursor on a chart nobody can click.
      value: null,
      documentation: 'Called with (xIndex, yIndex, event) when a cell with a value is clicked.'
    },
    {
      // Neither axis has grid lines to draw: the cells are the grid.
      name: 'showGridLines',
      value: false
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.enableClass(this.myClass('clickable'), this.onCellClick$.map(function(f) { return !! f; }));
    },

    function value_(i, j) {
      // The number in row i, column j, or null when the cell has none.
      var v = ( this.datasets[i].data || [] )[j];
      return v == null || v === '' || ! isFinite(Number(v)) ? null : Number(v);
    },

    function range_() {
      // [ lowest, highest ] over every cell with a value; null when there is none.
      var self = this, lo = null, hi = null;
      this.datasets.forEach(function(ds, i) {
        self.labels.forEach(function(l, j) {
          var v = self.value_(i, j);
          if ( v === null ) return;
          if ( lo === null || v < lo ) lo = v;
          if ( hi === null || v > hi ) hi = v;
        });
      });
      return lo === null ? null : [ lo, hi ];
    },

    function colorScale_() {
      var r = this.range_() || [ 0, 0 ];
      return this.ColorScale.create({
        min:    r[0],
        max:    r[1],
        strong: this.seriesColor(0),
        tint:   foam.CSS.returnTokenValue(this.TINT_COLOR, this.cls_, this.__subContext__)
      });
    },

    function legendItems() {
      // A colour scale, added by styleLegend, stands in for the per-series entries.
      return [];
    },

    function styleLegend(legend, vertical) {
      var r = this.range_();
      if ( ! r ) return;
      var cs = this.colorScale_();
      legend.start()
        .addClass(this.myClass('scale'))
        .enableClass(this.myClass('scale-vertical'), vertical)
        .start('span').add(this.formatValue(r[0])).end()
        .start()
          .addClass(this.myClass('scale-bar'))
          .style({ background: 'linear-gradient(to ' + ( vertical ? 'top' : 'right' ) + ', ' + cs.light() + ', ' + cs.strong + ')' })
        .end()
        .start('span').add(this.formatValue(r[1])).end()
      .end();
    },

    function drawChart(svg, w, h) {
      var self = this;
      var xs   = this.labels.map(String);
      var ys   = this.datasets.map(function(ds) { return ds.label || ''; });
      if ( ! xs.length || ! ys.length ) return;

      var a  = this.layout(w, h, xs, ys);
      var bx = this.BandScale.create({ count: xs.length, start: a.left, end: a.left + a.width, fill: this.CELL_FILL });
      var by = this.BandScale.create({ count: ys.length, start: a.top, end: a.top + a.height, fill: this.CELL_FILL });

      this.drawAxes(svg, a,
        xs.map(function(l, j) { return { pos: bx.center(j), label: l }; }),
        ys.map(function(l, i) { return { pos: by.center(i), label: l }; }));

      var cs     = this.colorScale_();
      var empty  = foam.CSS.returnTokenValue(this.EMPTY_COLOR, this.cls_, this.__subContext__);
      var light  = foam.CSS.returnTokenValue(this.LIGHT_TEXT_COLOR, this.cls_, this.__subContext__);
      var dark   = foam.CSS.returnTokenValue(this.DARK_TEXT_COLOR, this.cls_, this.__subContext__);
      var cw     = bx.bandwidth(), ch = by.bandwidth();
      var fp     = this.fontPx();

      svg.start('g').addClass(this.myClass('cells'))
        .forEach(ys, function(yl, i) {
          this.forEach(xs, function(xl, j) {
            var v    = self.value_(i, j);
            var fill = v === null ? empty : cs.colorAt(v);
            var text = v === null ? '' : self.formatValue(v);
            this.start('rect').addClass(self.myClass('cell'))
              .enableClass(self.myClass('empty-cell'), v === null)
              .attrs({ x: bx.center(j) - cw / 2, y: by.center(i) - ch / 2, width: cw, height: ch, fill: fill })
              .callIf(v !== null, function() {
                this
                  .on('mousemove', function(evt) {
                    self.showTooltip(evt, yl, [ { color: fill, label: xl, value: text } ]);
                  })
                  .on('click', function(evt) { if ( self.onCellClick ) self.onCellClick(j, i, evt); });
              })
              .on('mouseleave', self.hideTooltip)
            .end();
            if ( self.showValues && v !== null && fp <= ch && self.textWidth(text) + 2 * self.CELL_TEXT_PAD_PX <= cw ) {
              this.start('text').addClass(self.myClass('cell-value'))
                .attrs({
                  x: bx.center(j), y: by.center(i),
                  'text-anchor': 'middle', 'dominant-baseline': 'central',
                  fill: foam.Color.getBestForeground(fill, dark, light)
                })
                .add(text)
              .end();
            }
          });
        })
      .end();
    }
  ]
});
