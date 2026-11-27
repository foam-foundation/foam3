/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'ChartView',
  extends: 'foam.u2.View',

  documentation: `
    Base for the SVG charts. It fills its parent, places the legend on the
    chosen side, and hands the space that is left to drawChart(svg, w, h),
    which each chart type implements. It redraws when the data changes, when
    the parent resizes and when a legend click hides a series.

    labels name the categories, and each of datasets (a Dataset) is one
    series with one value per label. Colours arrive already resolved
    (a theme token such as $primary400 turned into its hex value) and are
    written as SVG attributes. Text, grid and axis colours come from CSS
    tokens, so they follow a light or dark theme switch.
  `,

  requires: [
    'foam.u2.chart.ChartLegend',
    'foam.u2.chart.Dataset',
    'foam.u2.chart.LegendPosition'
  ],

  constants: [
    {
      name: 'DEFAULT_COLORS',
      documentation: 'Series colours when the caller sets none, as theme tokens.',
      value: [ '$primary400', '$orange400', '$green400', '$purple400', '$red400', '$blue400', '$grey400' ]
    },
    {
      name: 'TOOLTIP_OFFSET_PX',
      documentation: 'How far the tooltip sits from the pointer, right and below, so it never covers what is hovered.',
      value: 14
    },
    {
      name: 'MIN_PLOT_PX',
      documentation: 'Smallest plot, either way, worth drawing; a chart in a collapsed card draws nothing until it opens.',
      value: 20
    },
    {
      name: 'DEFAULT_FONT_PX',
      documentation: 'Label font size before the chart is on the page and its CSS can be read.',
      value: 12
    },
    {
      name: 'ANIMATION_END_MS',
      documentation: 'Wait past animationDuration before dropping the animation, so the last frame is not cut.',
      value: 100
    }
  ],

  css: `
    << {
      /* The chart takes the width its container gives it and never asks for
         more: without this a legend label that gets shorter after a click
         narrows the card around it, the chart redraws at the new width, and
         dashboard cards in one row shift back and forth. */
      contain: inline-size;
      position: relative;
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
      font-size: 1.2rem;
    }
    <<legend-bottom { flex-direction: column-reverse; }
    <<legend-left   { flex-direction: row; }
    <<legend-right  { flex-direction: row-reverse; }
    /* A legend above or below the plot keeps at most a third of the height
       and scrolls past that, so 30 series still leave room to draw: without
       the cap their legend filled the chart and the plot was 20 px tall. */
    <<legend { flex: none; padding: 0.4rem 0.8rem; box-sizing: border-box; max-height: 33%; overflow-y: auto; }
    <<legend-left <<legend, <<legend-right <<legend { max-height: 100%; }
    <<plot { position: relative; flex: 1; min-width: 0; min-height: 0; }
    <<plot > svg { position: absolute; top: 0; left: 0; overflow: visible; }

    <<text       { fill: $textSecondary; font-size: 1.2rem; }
    <<axis-title { fill: $textSecondary; font-size: 1.2rem; font-weight: $font-medium; }
    <<grid       { stroke: $borderLight; stroke-width: 1; shape-rendering: crispEdges; }
    <<axis       { stroke: $borderDefault; stroke-width: 1; shape-rendering: crispEdges; }
    <<guide      { stroke: $borderDefault; stroke-width: 1; stroke-dasharray: 3 3; pointer-events: none; }

    <<tooltip {
      position: absolute;
      z-index: 2;
      pointer-events: none;
      min-width: 8rem;
      padding: 0.6rem 0.8rem;
      border: 1px solid $borderLight;
      border-radius: 0.4rem;
      background: $backgroundDefault;
      box-shadow: $shadow-md;
      color: $textDefault;
      font-size: 1.2rem;
      white-space: nowrap;
    }
    <<tooltip-title  { font-weight: $font-medium; margin-bottom: 0.2rem; }
    <<tooltip-row    { display: flex; align-items: center; gap: 0.6rem; line-height: 1.8rem; }
    <<tooltip-swatch { flex: none; width: 1rem; height: 1rem; border-radius: 0.2rem; }
    <<tooltip-footer { margin-top: 0.4rem; padding-top: 0.4rem; border-top: 1px solid $borderLight; font-weight: $font-medium; }

    /* The root carries the animation length inline; marks pick it up here. */
    <<animated * { animation-duration: inherit; }
  `,

  messages: [
    { name: 'SUM', message: 'Sum' },
    { name: 'NO_DATA', message: 'No data available' }
  ],

  properties: [
    {
      class: 'Array',
      name: 'labels',
      documentation: 'The category names, in order: one per bar, slice or category point.'
    },
    {
      class: 'FObjectArray',
      of: 'foam.u2.chart.Dataset',
      name: 'datasets',
      documentation: 'The series. A plain object such as { label, data } adapts to a Dataset.'
    },
    { class: 'Boolean', name: 'showLegend', value: true },
    {
      class: 'Enum',
      of: 'foam.u2.chart.LegendPosition',
      name: 'legendPosition',
      value: 'TOP',
      documentation: 'Which side of the chart the legend sits on. A name such as \'left\' adapts to its value.'
    },
    {
      class: 'Boolean',
      name: 'legendClickable',
      value: true,
      documentation: 'Whether clicking a legend entry hides and shows its series.'
    },
    { class: 'Boolean', name: 'showTooltips', value: true },
    {
      class: 'Boolean',
      name: 'showTooltipSum',
      documentation: 'End the tooltip with a "Sum:" line adding up the values it lists.'
    },
    { class: 'Boolean', name: 'animate', value: true },
    {
      class: 'Int',
      name: 'animationDuration',
      value: 1000,
      documentation: 'How long, in milliseconds, the marks take to grow in on the first draw.'
    },
    {
      class: 'Array',
      name: 'hidden_',
      documentation: 'hidden_[i] is true while legend entry i is switched off.'
    },
    {
      name: 'size_',
      documentation: 'The plot box { w, h } in pixels, read from a ResizeObserver.'
    },
    {
      name: 'tooltip_',
      documentation: 'The floating tooltip element.'
    },
    {
      name: 'measureCtx_',
      documentation: 'An offscreen canvas context, used only to measure label widths.'
    }
  ],

  methods: [
    function render() {
      var self = this;
      this
        .addClass()
        .addClass(this.myClass('legend-' + this.legendPosition.name.toLowerCase()))
        .callIf(this.animate, function() {
          this.addClass(self.myClass('animated')).style({ animationDuration: self.animationDuration + 'ms' });
          // Animate only the first draw: a resize or a legend click later
          // redraws the marks, and growing them in again would flicker.
          setTimeout(function() { self.removeClass(self.myClass('animated')); }, self.animationDuration + self.ANIMATION_END_MS);
        })
        .add(this.dynamic(function(showLegend, labels, datasets, hidden_) {
          if ( ! showLegend ) return;
          var vertical = self.legendPosition.vertical;
          this.start(self.ChartLegend, {
            items:     self.legendItems(),
            vertical:  vertical,
            clickable: self.legendClickable,
            onToggle:  self.toggleSeries,
            onHover:   self.onLegendHover
          })
            .addClass(self.myClass('legend'))
            .call(function() { self.styleLegend(this, vertical); })
          .end();
        }))
        .start()
          .addClass(this.myClass('plot'))
          .resizeObserver(function(entries) {
            var r = entries[0].contentRect;
            var w = Math.floor(r.width), h = Math.floor(r.height);
            if ( ! self.size_ || self.size_.w !== w || self.size_.h !== h ) self.size_ = { w: w, h: h };
          })
          .add(this.dynamic(function(labels, datasets, hidden_, size_) {
            if ( ! size_ || size_.w < self.MIN_PLOT_PX || size_.h < self.MIN_PLOT_PX ) return;
            this.start('svg')
              .attrs({ width: size_.w, height: size_.h, role: 'img' })
              .on('mouseleave', self.hideTooltip)
              .call(function() { self.drawChart(this, size_.w, size_.h); })
            .end();
          }))
        .end()
        .start(null, null, this.tooltip_$).addClass(this.myClass('tooltip')).hide().end();
    },

    function drawChart(svg, w, h) {
      /* Draw the marks into svg, which is w by h pixels. Each chart type overrides this. */
    },

    function styleLegend(legend, vertical) {
      /* Hook for a chart type to size its legend, e.g. give a side legend a min and max width. */
    },

    function legendItems() {
      // One entry per dataset. A chart with one entry per value overrides this.
      var self = this;
      return this.datasets.map(function(ds, i) {
        return { label: ds.label || '', color: self.seriesColor(i), hidden: !! self.hidden_[i] };
      });
    },

    function isHidden(i) { return !! this.hidden_[i]; },

    function seriesColor(i, opt_index) {
      // A dataset's colour: its backgroundColor, a per-value array of them
      // (opt_index picks one), or a default from the theme.
      var ds = this.datasets[i] || this.Dataset.create();
      var c  = ds.borderColor || ds.backgroundColor;
      if ( Array.isArray(ds.backgroundColor) && ds.backgroundColor.length ) {
        c = ds.backgroundColor[( opt_index || 0 ) % ds.backgroundColor.length];
      }
      return c || this.defaultColor(i);
    },

    function defaultColor(i) {
      return foam.CSS.returnTokenValue(this.DEFAULT_COLORS[i % this.DEFAULT_COLORS.length], this.cls_, this.__subContext__);
    },

    function textWidth(s) {
      // Width in pixels of s in the chart's label font, so axes can leave
      // room for "1,000,000" but not for "0".
      if ( ! this.measureCtx_ ) {
        this.measureCtx_ = this.document.createElement('canvas').getContext('2d');
      }
      var cs = this.computedStyle_();
      this.measureCtx_.font = cs ? cs.fontSize + ' ' + cs.fontFamily : this.DEFAULT_FONT_PX + 'px sans-serif';
      return this.measureCtx_.measureText(String(s)).width;
    },

    function fontPx() {
      var cs = this.computedStyle_();
      return cs && parseFloat(cs.fontSize) || this.DEFAULT_FONT_PX;
    },

    function computedStyle_() {
      // The chart's font, once it is on the page; before that, null.
      var el = this.element_;
      return el ? el.ownerDocument.defaultView.getComputedStyle(el) : null;
    },

    function truncate(s, maxPx) {
      // "Monthly Subscription Renewals by Region" -> "Monthly Subscription Re…" at 120 px.
      s = String(s);
      if ( this.textWidth(s) <= maxPx ) return s;
      var lo = 0, hi = s.length;
      while ( lo < hi ) {
        var mid = Math.ceil(( lo + hi ) / 2);
        if ( this.textWidth(s.slice(0, mid) + '…') <= maxPx ) lo = mid; else hi = mid - 1;
      }
      return s.slice(0, lo) + '…';
    },

    function formatValue(v) {
      return v == null ? '' : Number(v).toLocaleString(foam.locale);
    },

    function sumLine(values) {
      var sum = values.reduce(function(a, v) { return a + ( Number(v) || 0 ); }, 0);
      return this.SUM + ': ' + this.formatValue(sum);
    },

    function showTooltip(evt, title, rows, opt_footer) {
      // rows: [{ color, label, value }]. The box follows the pointer and
      // flips to its left near the right edge so it never leaves the chart.
      if ( ! this.showTooltips || ! this.tooltip_ ) return;
      var self = this;
      var tip  = this.tooltip_;
      tip.removeAllChildren();
      tip
        .callIf(title !== undefined && title !== '', function() {
          this.start().addClass(self.myClass('tooltip-title')).add(String(title)).end();
        })
        .forEach(rows, function(r) {
          this.start().addClass(self.myClass('tooltip-row'))
            .callIf(r.color, function() {
              this.start().addClass(self.myClass('tooltip-swatch')).style({ background: r.color }).end();
            })
            .add(r.label ? r.label + ': ' + r.value : r.value)
          .end();
        })
        .callIf(opt_footer, function() {
          this.start().addClass(self.myClass('tooltip-footer')).add(opt_footer).end();
        });
      tip.show();

      var box = this.element_.getBoundingClientRect();
      var gap = this.TOOLTIP_OFFSET_PX;
      var x   = evt.clientX - box.left + gap;
      var y   = evt.clientY - box.top + gap;
      var tw  = tip.element_.offsetWidth;
      var th  = tip.element_.offsetHeight;
      if ( x + tw > box.width ) x = Math.max(0, evt.clientX - box.left - tw - gap);
      if ( y + th > box.height ) y = Math.max(0, evt.clientY - box.top - th - gap);
      tip.style({ left: x + 'px', top: y + 'px' });
    }
  ],

  listeners: [
    function hideTooltip() {
      if ( this.tooltip_ ) this.tooltip_.hide();
    },

    function toggleSeries(i) {
      var h = this.hidden_.slice();
      h[i] = ! h[i];
      this.hidden_ = h;
    },

    function onLegendHover(i, evt) {
      /* Called with (index, event) while a legend entry is hovered, and index -1 when it is left. */
    }
  ]
});
