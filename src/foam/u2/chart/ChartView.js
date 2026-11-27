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

    The data has the shape { labels: [...], datasets: [{ label, data,
    backgroundColor, ... }] }: labels name the categories, and each dataset
    is one series with one value per label. Colours arrive already resolved
    (a theme token such as $primary400 turned into its hex value), so they
    are written as SVG attributes and survive the PDF export, which copies
    the page without its stylesheets. Text, grid and axis colours come from
    CSS tokens, so they follow a light or dark theme switch.
  `,

  requires: [
    'foam.u2.chart.ChartLegend'
  ],

  constants: [
    {
      name: 'DEFAULT_COLORS',
      documentation: 'Series colours when the caller sets none, as theme tokens.',
      value: [ '$primary400', '$orange400', '$green400', '$purple400', '$red400', '$blue400', '$grey400' ]
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
    <<axis-title { fill: $textSecondary; font-size: 1.2rem; font-weight: 600; }
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
      box-shadow: 0 0.2rem 0.8rem rgba(0, 0, 0, 0.15);
      color: $textDefault;
      font-size: 1.2rem;
      white-space: nowrap;
    }
    <<tooltip-title  { font-weight: 600; margin-bottom: 0.2rem; }
    <<tooltip-row    { display: flex; align-items: center; gap: 0.6rem; line-height: 1.8rem; }
    <<tooltip-swatch { flex: none; width: 1rem; height: 1rem; border-radius: 0.2rem; }
    <<tooltip-footer { margin-top: 0.4rem; padding-top: 0.4rem; border-top: 1px solid $borderLight; font-weight: 600; }

    /* The root carries the animation length inline; marks pick it up here. */
    <<animated * { animation-duration: inherit; }
  `,

  properties: [
    {
      name: 'data',
      documentation: 'The chart data: { labels: [...], datasets: [{ label, data, backgroundColor, ... }] }.',
      factory: function() { return { labels: [], datasets: [] }; }
    },
    { class: 'Boolean', name: 'showLegend', value: true },
    {
      class: 'String',
      name: 'legendPosition',
      value: 'top',
      documentation: 'Which side of the chart the legend sits on: top, right, bottom or left.'
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
        .addClass(this.myClass('legend-' + this.legendPosition))
        .callIf(this.animate, function() {
          this.addClass(self.myClass('animated')).style({ animationDuration: self.animationDuration + 'ms' });
          // Animate only the first draw: a resize or a legend click later
          // redraws the marks, and growing them in again would flicker.
          setTimeout(function() { self.removeClass(self.myClass('animated')); }, self.animationDuration + 100);
        })
        .add(this.dynamic(function(showLegend, data, hidden_) {
          if ( ! showLegend ) return;
          var vertical = self.legendPosition === 'left' || self.legendPosition === 'right';
          this.start(self.ChartLegend, {
            items:     self.legendItems(),
            vertical:  vertical,
            clickable: self.isLegendClickable(),
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
          .add(this.dynamic(function(data, hidden_, size_) {
            if ( ! size_ || size_.w < 20 || size_.h < 20 ) return;
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
      /* Hook for a chart type to size its legend, as PieChart does with min and max width. */
    },

    function legendItems() {
      // One entry per dataset; PieChart overrides this with one per slice.
      var self = this;
      return ( this.data.datasets || [] ).map(function(ds, i) {
        return { label: ds.label || '', color: self.seriesColor(i), hidden: !! self.hidden_[i] };
      });
    },

    function isLegendClickable() { return true; },

    function isHidden(i) { return !! this.hidden_[i]; },

    function seriesColor(i, opt_index) {
      // A dataset's colour: its backgroundColor, a per-value array of them
      // (opt_index picks one), or a default from the theme.
      var ds = ( this.data.datasets || [] )[i] || {};
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
      this.measureCtx_.font = ( cs ? cs.fontSize + ' ' + cs.fontFamily : '12px sans-serif' );
      return this.measureCtx_.measureText(String(s)).width;
    },

    function fontPx() {
      var cs = this.computedStyle_();
      return cs ? parseFloat(cs.fontSize) || 12 : 12;
    },

    function computedStyle_() {
      // The chart's font, once it is on the page; before that, null.
      var el = this.element_;
      return el ? el.ownerDocument.defaultView.getComputedStyle(el) : null;
    },

    function truncate(s, maxPx) {
      // "Network Fees and VisaNet Processing Charges" -> "Network Fees and Vi…" at 120 px.
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
      return 'Sum: ' + this.formatValue(sum);
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
      var x   = evt.clientX - box.left + 14;
      var y   = evt.clientY - box.top + 14;
      var tw  = tip.element_.offsetWidth;
      var th  = tip.element_.offsetHeight;
      if ( x + tw > box.width ) x = Math.max(0, evt.clientX - box.left - tw - 14);
      if ( y + th > box.height ) y = Math.max(0, evt.clientY - box.top - th - 14);
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
      /* PieChart shows a slice's value when its legend entry is hovered. */
    }
  ]
});
