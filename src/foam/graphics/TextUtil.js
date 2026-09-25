/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.LIB({
  name: 'foam.graphics.TextUtil',

  constants: {
    ELLIPSIS: '…'   // one character, so it measures like text and never wraps
  },

  methods: [
    function estimateMeasurer(charWidth) {
      /** measure(text, font) for headless tests: every character is charWidth px, the font is ignored. */
      return function(text, font) { return text.length * charWidth; };
    },

    function canvasMeasurer(ctx) {
      /** measure(text, font) bound to a 2D canvas context; sets ctx.font so the width matches what will be painted. */
      return function(text, font) {
        ctx.font = font;
        return ctx.measureText(text).width;
      };
    },

    function truncate(measure, text, font, maxWidth) {
      /**
       * Longest prefix of text, plus an ellipsis, that measures at most maxWidth.
       * Returns text unchanged when it fits, '' when not even the ellipsis fits.
       */
      if ( measure(text, font) <= maxWidth ) return text;
      var ellipsisWidth = measure(this.ELLIPSIS, font);
      if ( ellipsisWidth > maxWidth ) return '';

      // Binary search the cut point: widths are monotonic in the prefix length.
      var lo = 0, hi = text.length;
      while ( lo < hi ) {
        var mid = Math.ceil((lo + hi) / 2);
        if ( measure(text.slice(0, mid), font) + ellipsisWidth <= maxWidth ) lo = mid;
        else hi = mid - 1;
      }
      return text.slice(0, lo) + this.ELLIPSIS;
    }
  ]
});
