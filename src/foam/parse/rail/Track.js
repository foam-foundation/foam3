/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.LIB({
  name: 'foam.parse.rail.Track',

  documentation: `
    Track geometry shared by every composite: straight runs, S-curves between
    rows, detours (loop-back below / bypass above), the loop arrow and rounded
    boxes. All coordinates are local to the caller's CView. Callers begin the
    path, call these, then stroke.
  `,

  methods: [
    function begin(ctx, color, width) {
      ctx.strokeStyle = color;
      ctx.lineWidth   = width;
      ctx.beginPath();
    },

    function h(ctx, x1, x2, y) {
      /** Horizontal run from x1 to x2 on row y. */
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
    },

    function sCurve(ctx, x0, y0, xm, x1, y1, r) {
      /** From (x0,y0) right to column xm, vertical to y1, right to (x1,y1); both corners rounded by r. */
      var s = y1 > y0 ? 1 : -1;
      ctx.moveTo(x0, y0);
      ctx.lineTo(xm - r, y0);
      ctx.arcTo(xm, y0, xm, y0 + s * r, r);
      ctx.lineTo(xm, y1 - s * r);
      ctx.arcTo(xm, y1, xm + r, y1, r);
      ctx.lineTo(x1, y1);
    },

    function detour(ctx, lx, rx, mainY, sideY, r, opt_gap) {
      /**
       * A track that leaves the main row at column lx, runs along sideY and
       * rejoins at column rx. sideY below the row = loop-back, above = bypass.
       * opt_gap = [x0, x1] leaves the side row open there (for a delimiter box).
       */
      var s = sideY > mainY ? 1 : -1;
      ctx.moveTo(lx - r, mainY);
      ctx.arcTo(lx, mainY, lx, mainY + s * r, r);
      ctx.lineTo(lx, sideY - s * r);
      ctx.arcTo(lx, sideY, lx + r, sideY, r);
      if ( opt_gap ) { ctx.lineTo(opt_gap[0], sideY); ctx.moveTo(opt_gap[1], sideY); }
      ctx.lineTo(rx - r, sideY);
      ctx.arcTo(rx, sideY, rx, sideY - s * r, r);
      ctx.lineTo(rx, mainY + s * r);
      ctx.arcTo(rx, mainY, rx + r, mainY, r);
    },

    function arrowLeft(ctx, x, y) {
      /** Small left-pointing chevron with its tip at (x, y): the loop runs right-to-left underneath. */
      ctx.moveTo(x + 5, y - 4); ctx.lineTo(x, y); ctx.lineTo(x + 5, y + 4);
    },

    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y,     x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x,     y + h, r);
      ctx.arcTo(x,     y + h, x,     y,     r);
      ctx.arcTo(x,     y,     x + w, y,     r);
      ctx.closePath();
    }
  ]
});
