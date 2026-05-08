/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.LIB({
  name: 'foam.core.reflow.dashboard.CanvasTextUtil',

  documentation: `Canvas text layout helpers for chart/legend rendering.
    Chart.js does not wrap legend labels on its own, but its renderer
    accepts an array of strings as an item's text (one entry per line).
    wrap() turns a long string into that array.`,

  methods: [
    {
      name: 'wrap',
      documentation: `Greedy word-boundary wrap that falls back to a
        mid-word break when a single word is wider than maxPx. Uses the
        supplied canvas context for accurate measurement against the
        caller's font. Returns the original string when it already fits
        or when maxPx is non-positive; returns an array of lines when
        a split happened.`,
      code: function(ctx, text, fontStr, maxPx) {
        if ( ! text || maxPx <= 0 ) return text;
        var s = String(text);
        ctx.save();
        if ( fontStr ) ctx.font = fontStr;
        if ( ctx.measureText(s).width <= maxPx ) {
          ctx.restore();
          return s;
        }
        var lines = [];
        var remaining = s;
        while ( remaining.length > 0 ) {
          // Find the longest prefix that fits within maxPx.
          var fitLen = remaining.length;
          while ( fitLen > 0 && ctx.measureText(remaining.slice(0, fitLen)).width > maxPx ) {
            fitLen--;
          }
          if ( fitLen === 0 ) fitLen = 1; // guarantee progress on a single char
          // Prefer a word-boundary split inside the fitting prefix.
          var breakAt = fitLen;
          if ( fitLen < remaining.length ) {
            var spaceIdx = remaining.lastIndexOf(' ', fitLen);
            if ( spaceIdx > 0 ) breakAt = spaceIdx;
          }
          lines.push(remaining.slice(0, breakAt));
          remaining = remaining.slice(breakAt).replace(/^\s+/, '');
        }
        ctx.restore();
        return lines.length > 1 ? lines : s;
      }
    },

    {
      name: 'truncate',
      documentation: `Single-line truncation that ends with a Unicode
        ellipsis (U+2026) when the input would exceed maxPx. Uses the
        caller's font via ctx for accurate measurement. Returns the
        original string when it already fits or when maxPx is non-positive.
        For legend labels paired with a hover tooltip that shows the full
        text — the ellipsis signals truncation without the extra legend
        row that wrap() would add.`,
      code: function(ctx, text, fontStr, maxPx) {
        if ( ! text || maxPx <= 0 ) return text;
        var s = String(text);
        ctx.save();
        if ( fontStr ) ctx.font = fontStr;
        if ( ctx.measureText(s).width <= maxPx ) {
          ctx.restore();
          return s;
        }
        var ELLIPSIS  = '…';
        var ellipsisW = ctx.measureText(ELLIPSIS).width;
        // Binary-search the longest prefix whose measured width + the
        // ellipsis still fits within maxPx.
        var lo = 0, hi = s.length;
        while ( lo < hi ) {
          var mid = (lo + hi + 1) >> 1;
          if ( ctx.measureText(s.slice(0, mid)).width + ellipsisW <= maxPx ) {
            lo = mid;
          } else {
            hi = mid - 1;
          }
        }
        // Strip trailing whitespace so the ellipsis sits tight against text.
        var prefix = s.slice(0, lo).replace(/\s+$/, '');
        ctx.restore();
        return prefix + ELLIPSIS;
      }
    },

    {
      name: 'legendLabelFont',
      documentation: `Builds the CSS font string Chart.js would use for a
        legend item, falling back to chart.options.font then Chart.js
        defaults. Pass the chart instance; returns a string suitable for
        ctx.font.`,
      code: function(chart) {
        var labelOpts = chart.options.plugins.legend.labels || {};
        var f = labelOpts.font || chart.options.font || {};
        return (f.weight || 'normal') + ' ' +
               (f.size   || 12) + 'px ' +
               (f.family || 'sans-serif');
      }
    },

    {
      name: 'legendLabelChromePx',
      documentation: `Horizontal overhead Chart.js v4 reserves around the
        widest legend item in a right/left (single-column) legend,
        before any text is drawn. Derived directly from chart.js 4.x
        _fitCols + calculateItemWidth:
          legendWidth = padding + (boxWidth + fontSize/2 + textWidth) + 10
        so chrome (non-text) = padding + boxWidth + fontSize/2 + 10.
        Defaults match Chart.js v4: boxWidth falls back to fontSize
        (v4 changed this from v2/v3's 40 — see chart.js getBoxSize),
        padding to 10. With labelFont.size=12 and no overrides chrome
        ≈ 10 + 12 + 6 + 10 = 38.`,
      code: function(chart) {
        var labelOpts = chart.options.plugins.legend.labels || {};
        var f         = labelOpts.font || chart.options.font || {};
        var fontSize  = f.size || 12;
        var boxWidth  = labelOpts.boxWidth !== undefined ? labelOpts.boxWidth : fontSize;
        var padding   = labelOpts.padding  !== undefined ? labelOpts.padding  : 10;
        return padding + boxWidth + (fontSize / 2) + 10;
      }
    },

    {
      name: 'padWidestToMin',
      documentation: `Chart.js v4 has no legend.minWidth — a legend
        naturally shrinks to its widest label. This pads the widest
        label's widest line with trailing non-breaking spaces until its
        measured width is at least minPx. Other items stay natural;
        Chart.js's legend column width tracks the widest item, so
        padding one item is enough to force the whole legend to minPx.
        Mutates the items' text in place and returns the items.`,
      code: function(ctx, items, fontStr, minPx) {
        if ( minPx <= 0 || ! items || items.length === 0 ) return items;
        ctx.save();
        if ( fontStr ) ctx.font = fontStr;

        // Find the widest line across all items (accounting for array-text
        // multi-line labels) and remember where it lives.
        var bestWidth = 0, bestItemIdx = -1, bestLineIdx = -1;
        for ( var i = 0 ; i < items.length ; i++ ) {
          var t = items[i].text;
          var lines = Array.isArray(t) ? t : [t];
          for ( var k = 0 ; k < lines.length ; k++ ) {
            var w = ctx.measureText(lines[k]).width;
            if ( w > bestWidth ) {
              bestWidth = w;
              bestItemIdx = i;
              bestLineIdx = k;
            }
          }
        }
        if ( bestItemIdx < 0 || bestWidth >= minPx ) { ctx.restore(); return items; }

        // Non-breaking space so Chart.js (and whatever layout rtrims plain
        // spaces) keeps the pad intact at draw time.
        var NBSP = ' ';
        var target = items[bestItemIdx];
        var line = Array.isArray(target.text) ? target.text[bestLineIdx] : target.text;
        var padded = line;
        // HAIR space (U+200A) closes the last NBSP-width gap down to ~1px. Like
        // NBSP, it's non-collapsing so Chart.js preserves it at draw time.
        var HAIR = '\u200A';
        // Four phases, each closing a narrower gap than the last:
        //   1. geometric NBSP doubling — coarse approach (cheap for large gaps)
        //   2. linear NBSP fill — closes the up-to-one-run undershoot that the
        //      geometric loop leaves behind (without this, shorter-label charts
        //      undershoot by different amounts than longer-label ones and
        //      stacked pies still drift)
        //   3. linear HAIR fill — closes the final NBSP-width gap (~3.5px) to
        //      hair-space granularity (~1px). Guarded against fonts that render
        //      HAIR as zero-width; in that case phase 2's accuracy stands.
        //   4. defensive trim — shouldn't run after phase 3, cheap insurance.
        var run = NBSP;
        while ( ctx.measureText(padded + run).width < minPx ) {
          padded += run;
          if ( run.length < 64 ) run += run; // geometric growth caps overshoot
        }
        while ( ctx.measureText(padded + NBSP).width <= minPx ) {
          padded += NBSP;
        }
        // Guard against fonts that render HAIR as 0-width (infinite loop) —
        // we still get NBSP-level accuracy from the phase above.
        if ( ctx.measureText(HAIR).width > 0 ) {
          while ( ctx.measureText(padded + HAIR).width <= minPx ) {
            padded += HAIR;
          }
        }
        while ( padded.length > line.length && ctx.measureText(padded).width > minPx ) {
          padded = padded.slice(0, -1);
        }
        if ( Array.isArray(target.text) ) {
          target.text[bestLineIdx] = padded;
        } else {
          target.text = padded;
        }
        ctx.restore();
        return items;
      }
    }
  ]
});
