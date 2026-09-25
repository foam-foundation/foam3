/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.LIB({
  name: 'foam.parse.rail.Track',

  documentation: `
    Track geometry shared by every composite, as SVG path data: straight runs,
    S-curves between rows, detours (loop-back below / bypass above), the loop
    arrow and rounded boxes. All coordinates are local to the caller's node.
    Callers concatenate the strings into one <path d="...">.
  `,

  methods: [
    function n(v) { return Math.round(v * 100) / 100; },

    function h(x1, x2, y) {
      /** Horizontal run from x1 to x2 on row y. */
      var n = this.n;
      return 'M' + n(x1) + ' ' + n(y) + 'L' + n(x2) + ' ' + n(y);
    },

    function arc(x, y, r, sweep) {
      /** Quarter-circle arc of radius r ending at (x, y); sweep 1 = clockwise. */
      var n = this.n;
      return 'A' + n(r) + ' ' + n(r) + ' 0 0 ' + sweep + ' ' + n(x) + ' ' + n(y);
    },

    function sCurve(x0, y0, xm, x1, y1, r) {
      /** From (x0,y0) right to column xm, vertical to y1, right to (x1,y1); both corners rounded by r. */
      var n = this.n, s = y1 > y0 ? 1 : -1, down = s > 0;
      return 'M' + n(x0) + ' ' + n(y0)
           + 'L' + n(xm - r) + ' ' + n(y0)
           + this.arc(xm, y0 + s * r, r, down ? 1 : 0)
           + 'L' + n(xm) + ' ' + n(y1 - s * r)
           + this.arc(xm + r, y1, r, down ? 0 : 1)
           + 'L' + n(x1) + ' ' + n(y1);
    },

    function detour(lx, rx, mainY, sideY, r, opt_gap) {
      /**
       * A track that leaves the main row at column lx, runs along sideY and
       * rejoins at column rx. sideY below the row = loop-back, above = bypass.
       * opt_gap = [x0, x1] leaves the side row open there (for a delimiter box).
       */
      var n = this.n, s = sideY > mainY ? 1 : -1, down = s > 0;
      var d = 'M' + n(lx - r) + ' ' + n(mainY)
            + this.arc(lx, mainY + s * r, r, down ? 1 : 0)
            + 'L' + n(lx) + ' ' + n(sideY - s * r)
            + this.arc(lx + r, sideY, r, down ? 0 : 1);
      if ( opt_gap ) d += 'L' + n(opt_gap[0]) + ' ' + n(sideY) + 'M' + n(opt_gap[1]) + ' ' + n(sideY);
      d += 'L' + n(rx - r) + ' ' + n(sideY)
         + this.arc(rx, sideY - s * r, r, down ? 0 : 1)
         + 'L' + n(rx) + ' ' + n(mainY + s * r)
         + this.arc(rx + r, mainY, r, down ? 1 : 0);
      return d;
    },

    function arrowLeft(x, y) {
      /** Small left-pointing chevron with its tip at (x, y): the loop runs right-to-left underneath. */
      var n = this.n;
      return 'M' + n(x + 5) + ' ' + n(y - 4) + 'L' + n(x) + ' ' + n(y) + 'L' + n(x + 5) + ' ' + n(y + 4);
    },

    function roundRect(x, y, w, h, r) {
      var n = this.n;
      return 'M' + n(x + r) + ' ' + n(y)
           + 'L' + n(x + w - r) + ' ' + n(y) + this.arc(x + w, y + r, r, 1)
           + 'L' + n(x + w) + ' ' + n(y + h - r) + this.arc(x + w - r, y + h, r, 1)
           + 'L' + n(x + r) + ' ' + n(y + h) + this.arc(x, y + h - r, r, 1)
           + 'L' + n(x) + ' ' + n(y + r) + this.arc(x + r, y, r, 1) + 'Z';
    }
  ]
});
