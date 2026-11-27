/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'SankeyChart',
  extends: 'foam.u2.chart.ChartView',

  documentation: `
    How much flows from each source to each target: visits from each entry
    page (left column) to each next page (right column), say. labels are the
    targets and each dataset is one source, with one value per label:
    labels: [ 'Cart', 'Search' ], datasets: [ { label: 'Home', data: [ 30, 70 ] },
    { label: 'Offers', data: [ 10, null ] } ]
    draws two source nodes and two target nodes, and a curved band for each of
    the three pairs that has a value, as thick as the value.

    A node is as tall as its total: Home 100, Offers 10. Both columns share one
    scale, so a band is as thick where it leaves a source as where it reaches
    its target. Nodes in a column are stacked with a small gap, in the order of
    datasets and labels. A band leaves its source in target order and reaches
    its target in source order, so bands cross only where the data makes them.
    A pair with no value, a zero or a negative value has no band.

    Each band takes its source's colour, made see-through by bandOpacity so
    overlapping bands stay readable. Target nodes are one neutral colour.
    Source names are written left of the left column and target names right
    of the right column, cut short when long; a name that would run into the
    one above it is left out and still shows when the node is hovered.

    The legend has one entry per source; clicking one hides that source's
    bands and the layout is worked out again from what is left.

    Hovering a band shows "source → target: value"; hovering a node shows its
    total in and out. Clicking a band calls onFlowClick(sourceIndex,
    targetIndex, event), where sourceIndex is the position in datasets and
    targetIndex the position in labels.
  `,

  requires: [
    'foam.u2.chart.SVGPath'
  ],

  constants: [
    {
      name: 'NODE_WIDTH_PX',
      documentation: 'Width of a node, in pixels: wide enough to hover, narrow enough that the bands get the width.',
      value: 12
    },
    {
      name: 'NODE_GAP_PX',
      documentation: 'Vertical gap between two nodes of one column, so they read as separate: 8 pixels between nodes of 60 pixels.',
      value: 8
    },
    {
      name: 'MAX_GAP_SHARE',
      documentation: 'Most of the plot height that the gaps of one column may take together; with 40 nodes the gap shrinks to fit, so the nodes keep their height.',
      value: 0.3
    },
    {
      name: 'CURVE_PULL',
      documentation: 'How far along the band, as a share of its width, the curve is pulled out before it turns: 0.5 gives the usual S shape.',
      value: 0.5
    },
    {
      name: 'LABEL_GAP_PX',
      documentation: 'Space between a node and its name.',
      value: 6
    },
    {
      name: 'LABEL_MAX_SHARE',
      documentation: 'Most of the chart width one column of names may take, so a long name never squeezes the bands to nothing: 0.25 leaves half the width for the bands.',
      value: 0.25
    },
    {
      name: 'TARGET_COLOR',
      documentation: 'Theme token for the target nodes: neutral, because a target is the sum of many sources and has no colour of its own.',
      value: '$grey400'
    }
  ],

  css: `
    <<flow { stroke: transparent; stroke-width: 1; }
    <<flow:hover { stroke: $textDefault; }
    <<clickable <<flow { cursor: pointer; }
    <<node:hover { stroke: $textDefault; }
    <<node-label { pointer-events: none; }

    @media (prefers-reduced-motion: no-preference) {
      <<animated <<flows {
        animation-name: foam-u2-chart-SankeyChart-fade;
        animation-timing-function: ease-out;
      }
    }
    @keyframes foam-u2-chart-SankeyChart-fade { from { opacity: 0; } }
  `,

  messages: [
    { name: 'FLOW_IN',  message: 'In' },
    { name: 'FLOW_OUT', message: 'Out' }
  ],

  properties: [
    {
      class: 'Float',
      name: 'bandOpacity',
      value: 0.4,
      documentation: 'How solid a band is, from 0 (invisible) to 1 (the full source colour). 0.4 lets two crossing bands show through each other.'
    },
    {
      class: 'Function',
      name: 'onFlowClick',
      // A Function property defaults to an empty function, which would show
      // the pointer cursor on a chart nobody can click.
      value: null,
      documentation: 'Called with (sourceIndex, targetIndex, event) when a band is clicked.'
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.enableClass(this.myClass('clickable'), this.onFlowClick$.map(function(f) { return !! f; }));
    },

    function value_(i, j) {
      // The flow from source i to target j, or 0 when the pair has no
      // positive number: null, missing, zero, negative and text all count as none.
      var v = ( this.datasets[i].data || [] )[j];
      v = v == null || v === '' ? NaN : Number(v);
      return isFinite(v) && v > 0 ? v : 0;
    },

    function model_() {
      // What is drawn, from the visible sources only:
      // { sources, targets, flows }. sources and targets are
      // [{ index, name, total }] in dataset and label order, with the nodes
      // that have no flow left out; flows is [{ s, t, value }] with s and t
      // the positions in datasets and labels, sorted by s then t.
      var self    = this;
      var flows   = [];
      var sources = [];
      var tTotals = {};
      this.datasets.forEach(function(ds, i) {
        if ( self.isHidden(i) ) return;
        var total = 0;
        self.labels.forEach(function(l, j) {
          var v = self.value_(i, j);
          if ( ! v ) return;
          flows.push({ s: i, t: j, value: v });
          total += v;
          tTotals[j] = ( tTotals[j] || 0 ) + v;
        });
        if ( total ) sources.push({ index: i, name: ds.label || '', total: total });
      });
      var targets = [];
      this.labels.forEach(function(l, j) {
        if ( tTotals[j] ) targets.push({ index: j, name: String(l), total: tTotals[j] });
      });
      return { sources: sources, targets: targets, flows: flows };
    },

    function gap_(n, h) {
      // The gap between nodes of a column of n nodes in h pixels.
      return n > 1 ? Math.min(this.NODE_GAP_PX, this.MAX_GAP_SHARE * h / ( n - 1 )) : 0;
    },

    function place_(nodes, k, gap, h) {
      // Gives each node its y and height. The column is centred, so a column
      // that is shorter than the plot does not hang from the top.
      var used = nodes.reduce(function(a, n) { return a + n.total * k; }, 0) + gap * ( nodes.length - 1 );
      var y    = ( h - used ) / 2;
      nodes.forEach(function(n) {
        n.y = y;
        n.height = n.total * k;
        y += n.height + gap;
      });
    },

    function legendItems() {
      // One entry per source, so clicking one hides that source's bands.
      // A source with no positive value shows as hidden: it has no bands.
      var self = this;
      return this.datasets.map(function(ds, i) {
        var any = self.labels.some(function(l, j) { return self.value_(i, j); });
        return { label: ds.label || '', color: self.seriesColor(i), hidden: !! self.hidden_[i] || ! any };
      });
    },

    function drawChart(svg, w, h) {
      var self = this;
      var m    = this.model_();
      if ( ! m.flows.length ) return;

      // One scale for both columns, so a band is as thick at both ends. Both
      // columns hold the same total; the one with more gaps has less height
      // left for its nodes and so sets the scale.
      var total = m.flows.reduce(function(a, f) { return a + f.value; }, 0);
      var gapS  = this.gap_(m.sources.length, h);
      var gapT  = this.gap_(m.targets.length, h);
      var k     = Math.min(( h - gapS * ( m.sources.length - 1 ) ) / total, ( h - gapT * ( m.targets.length - 1 ) ) / total);
      this.place_(m.sources, k, gapS, h);
      this.place_(m.targets, k, gapT, h);

      // Names sit outside the columns, each side as wide as its longest name.
      var maxLabel = this.LABEL_MAX_SHARE * w;
      var widest   = function(nodes) {
        return Math.min(maxLabel, nodes.reduce(function(a, n) { return Math.max(a, self.textWidth(n.name)); }, 0));
      };
      var leftW  = widest(m.sources), rightW = widest(m.targets);
      var nw     = this.NODE_WIDTH_PX, gapL = this.LABEL_GAP_PX;
      var xS     = leftW + gapL;
      var xT     = w - rightW - gapL - nw;
      var x0     = xS + nw, pull = ( xT - x0 ) * this.CURVE_PULL;

      var byS = {}, byT = {};
      m.sources.forEach(function(n) { n.outTotal = n.total; n.inTotal = 0; n.at = n.y; byS[n.index] = n; });
      m.targets.forEach(function(n) { n.inTotal = n.total; n.outTotal = 0; n.at = n.y; byT[n.index] = n; });
      var targetFill = foam.CSS.returnTokenValue(this.TARGET_COLOR, this.cls_, this.__subContext__);

      // flows is sorted by source then target, so each source hands out its
      // height top to bottom in target order, and each target in source order.
      svg.start('g').addClass(this.myClass('flows')).forEach(m.flows, function(f) {
        var src = byS[f.s], tgt = byT[f.t];
        var t   = f.value * k;
        var sy  = src.at, ty = tgt.at;
        src.at += t;
        tgt.at += t;
        var fill = self.seriesColor(f.s);
        var text = self.formatValue(f.value);
        var from = self.datasets[f.s].label || '';
        this.start('path').addClass(self.myClass('flow'))
          .attrs({
            d: self.SVGPath.create()
              .moveTo(x0, sy)
              .curveTo(x0 + pull, sy, xT - pull, ty, xT, ty)
              .lineTo(xT, ty + t)
              .curveTo(xT - pull, ty + t, x0 + pull, sy + t, x0, sy + t)
              .close().toString(),
            fill: fill,
            'fill-opacity': self.bandOpacity
          })
          .on('mousemove', function(evt) {
            self.showTooltip(evt, '', [ { color: fill, label: from + ' → ' + tgt.name, value: text } ]);
          })
          .on('mouseleave', self.hideTooltip)
          .on('click', function(evt) { if ( self.onFlowClick ) self.onFlowClick(f.s, f.t, evt); })
        .end();
      }).end();

      // Nodes, then their names on top. A name that would touch the one above
      // it is skipped, so crowded columns stay readable.
      var fp = this.fontPx();
      var drawNodes = function(nodes, x, fillOf, anchor, labelX, labelW) {
        var lastY = -Infinity;
        svg.start('g').addClass(self.myClass('nodes')).forEach(nodes, function(n) {
          var fill = fillOf(n);
          this.start('rect').addClass(self.myClass('node'))
            .attrs({ x: x, y: n.y, width: nw, height: n.height, fill: fill })
            .on('mousemove', function(evt) {
              self.showTooltip(evt, n.name, [
                { color: fill, label: self.FLOW_IN,  value: self.formatValue(n.inTotal) },
                { color: fill, label: self.FLOW_OUT, value: self.formatValue(n.outTotal) }
              ]);
            })
            .on('mouseleave', self.hideTooltip)
          .end();
          var mid = n.y + n.height / 2;
          if ( mid - lastY >= fp ) {
            lastY = mid;
            this.start('text').addClass(self.myClass('text')).addClass(self.myClass('node-label'))
              .attrs({ x: labelX, y: mid, 'text-anchor': anchor, 'dominant-baseline': 'central' })
              .add(self.truncate(n.name, labelW))
            .end();
          }
        }).end();
      };
      drawNodes(m.sources, xS, function(n) { return self.seriesColor(n.index); }, 'end', xS - gapL, leftW);
      drawNodes(m.targets, xT, function() { return targetFill; }, 'start', xT + nw + gapL, rightW);
    }
  ]
});
