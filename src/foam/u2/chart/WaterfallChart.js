/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'WaterfallChart',
  extends: 'foam.u2.chart.CartesianChartView',

  documentation: `
    How a running total moves step by step. labels name the steps and the
    first dataset holds one signed value per step:
    labels: [ 'Jan', 'Feb', 'Mar' ], datasets: [ { label: 'Change', data: [ 40, -15, 25 ] } ]
    starts at 0, rises to 40, falls to 25 and rises to 50.

    Each bar floats from the total before its step to the total after it, so
    a rise is a bar going up and a fall a bar going down. A rise and a fall
    have two colours. With showTotal on, one last bar stands on zero and
    shows the end total (50 above). A thin line joins the end of each bar to
    the start of the next. The value axis always includes zero and every
    running total, including one below zero.

    The first dataset's backgroundColor may be a list of three colours:
    rise, fall and total, in that order. Without it the colours come from the
    theme (WaterfallStepKind). Datasets after the first are ignored.

    The legend lists the kinds, one entry for rise, fall and total, and a
    click on it hides nothing: the bars stand on one another, so hiding one
    kind would leave every later bar at the wrong height.

    Hovering a step shows its change, with its sign, and the running total
    after it. Clicking one calls onStepClick(index, event), where index is
    the position in labels, and labels.length for the total bar.
  `,

  requires: [
    'foam.u2.chart.BandScale',
    'foam.u2.chart.LinearScale',
    'foam.u2.chart.WaterfallStepKind'
  ],

  constants: [
    {
      name: 'BAR_FILL',
      documentation: 'Share of a band a bar covers; 0.7 leaves a gap wide enough to show the connector line: 35 of 50 pixels.',
      value: 0.7
    }
  ],

  css: `
    <<hit { fill: transparent; }
    <<hit:hover { fill: $borderLight; fill-opacity: 0.35; }
    <<clickable <<hit { cursor: pointer; }
    <<connector { stroke: $textSecondary; stroke-width: 1; shape-rendering: crispEdges; pointer-events: none; }

    @media (prefers-reduced-motion: no-preference) {
      <<animated <<bars, <<animated <<connectors {
        animation-name: foam-u2-chart-WaterfallChart-fade;
        animation-timing-function: ease-out;
      }
    }
    @keyframes foam-u2-chart-WaterfallChart-fade { from { opacity: 0; } }
  `,

  messages: [
    { name: 'RISE',          message: 'Rise' },
    { name: 'FALL',          message: 'Fall' },
    { name: 'TOTAL',         message: 'Total' },
    { name: 'CHANGE',        message: 'Change' },
    { name: 'RUNNING_TOTAL', message: 'Running total' }
  ],

  properties: [
    {
      class: 'Boolean',
      name: 'showTotal',
      value: true,
      documentation: 'Add a last bar, from zero, that shows the end total.'
    },
    {
      class: 'Function',
      name: 'onStepClick',
      // A Function property defaults to an empty function, which would show
      // the pointer cursor on a chart nobody can click.
      value: null,
      documentation: 'Called with (index, event) when a step is clicked; index is labels.length for the total bar.'
    },
    {
      // Hiding a kind would leave every later bar at the wrong height.
      name: 'legendClickable',
      value: false
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.enableClass(this.myClass('clickable'), this.onStepClick$.map(function(f) { return !! f; }));
    },

    function steps_() {
      // One { name, from, to, change, kind } per bar, in order. A step runs
      // from the total before it to the total after it: 40 then -15 gives
      // 0 to 40, then 40 to 25. The last bar, when showTotal is on, runs from
      // 0 to the end total. A value that is not a number counts as 0.
      var data = this.datasets.length ? this.datasets[0].data || [] : [];
      var run  = 0;
      var out  = this.labels.map(function(l, j) {
        var v    = Number(data[j]);
        var from = run;
        run += isFinite(v) ? v : 0;
        return { name: String(l), from: from, to: run, change: run - from, kind: run < from ? this.WaterfallStepKind.FALL : this.WaterfallStepKind.RISE };
      }, this);
      if ( this.showTotal && out.length ) {
        out.push({ name: this.TOTAL, from: 0, to: run, change: run, kind: this.WaterfallStepKind.TOTAL });
      }
      return out;
    },

    function kindColor_(kind) {
      var bg = this.datasets.length ? this.datasets[0].backgroundColor : null;
      var c  = Array.isArray(bg) ? bg[kind.ordinal] : null;
      return c || foam.CSS.returnTokenValue(kind.color, this.cls_, this.__subContext__);
    },

    function legendItems() {
      var self = this;
      if ( ! this.labels.length ) return [];
      return this.WaterfallStepKind.VALUES
        .filter(function(k) { return k !== self.WaterfallStepKind.TOTAL || self.showTotal; })
        .map(function(k) { return { label: self[k.name], color: self.kindColor_(k), hidden: false }; });
    },

    function drawChart(svg, w, h) {
      var self  = this;
      var steps = this.steps_();
      if ( ! steps.length ) return;

      // Zero, and the level at both ends of every step, must fit on the axis.
      var lo = 0, hi = 0;
      steps.forEach(function(s) { lo = Math.min(lo, s.from, s.to); hi = Math.max(hi, s.from, s.to); });

      var names = steps.map(function(s) { return s.name; });
      var fit = this.layoutForValues(w, h, names, false,
        function(n) { return self.LinearScale.create({ min: lo, max: hi, tickCount: n }).nice(); },
        function(scale) { return scale.ticks(); });
      var a      = fit.area;
      var vScale = fit.scale;

      var band = this.BandScale.create({ count: steps.length, start: a.left, end: a.left + a.width, fill: this.BAR_FILL });
      vScale.start = a.top + a.height;
      vScale.end   = a.top;

      this.drawAxes(svg, a,
        names.map(function(l, j) { return { pos: band.center(j), label: l }; }),
        vScale.ticks().map(function(t) { return { pos: vScale.map(t), label: vScale.format(t) }; }));

      var bw = band.bandwidth();
      svg.start('g').addClass(this.myClass('bars')).forEach(steps, function(s, j) {
        var y0 = vScale.map(s.from), y1 = vScale.map(s.to);
        if ( y0 === y1 ) return;
        this.start('rect').addClass(self.myClass('bar'))
          .attrs({ x: band.center(j) - bw / 2, y: Math.min(y0, y1), width: bw, height: Math.abs(y1 - y0), fill: self.kindColor_(s.kind) })
        .end();
      }).end();

      // The end of each bar to the start of the next, which sits at the same total.
      svg.start('g').addClass(this.myClass('connectors')).forEach(steps.slice(0, -1), function(s, j) {
        var y = vScale.map(s.to);
        this.start('line').addClass(self.myClass('connector'))
          .attrs({ x1: band.center(j) + bw / 2, x2: band.center(j + 1) - bw / 2, y1: y, y2: y })
        .end();
      }).end();

      // One transparent column per bar on top, so a thin or empty bar can still be hovered and clicked.
      var step = Math.abs(band.step());
      svg.start('g').forEach(steps, function(s, j) {
        this.start('rect').addClass(self.myClass('hit'))
          .attrs({ x: band.center(j) - step / 2, y: a.top, width: step, height: a.height })
          .on('mousemove', function(evt) { self.showStepTooltip_(evt, s); })
          .on('mouseleave', self.hideTooltip)
          .on('click', function(evt) { if ( self.onStepClick ) self.onStepClick(j, evt); })
        .end();
      }).end();
    },

    function signed_(v) {
      return ( v > 0 ? '+' : '' ) + this.formatValue(v);
    },

    function showStepTooltip_(evt, s) {
      var total = s.kind === this.WaterfallStepKind.TOTAL;
      var rows  = total ? [] : [ { color: this.kindColor_(s.kind), label: this.CHANGE, value: this.signed_(s.change) } ];
      rows.push({ color: total ? this.kindColor_(s.kind) : undefined, label: this.RUNNING_TOTAL, value: this.formatValue(s.to) });
      this.showTooltip(evt, s.name, rows);
    }
  ]
});
