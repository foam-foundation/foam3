/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.LIB({
  name: 'foam.util.TextDiff',

  methods: [
    function lineDiff(oldText, newText, opt_maxCells) {
      /* Longest-common-subsequence line diff of two strings.
         Returns [{ type: ' ' | '-' | '+', text }] in output order, or null
         when oldLines * newLines exceeds opt_maxCells (default 4,000,000),
         since the table costs 4 bytes a cell. */
      var a = oldText.split('\n');
      var b = newText.split('\n');
      var n = a.length;
      var m = b.length;
      if ( n * m > ( opt_maxCells || 4000000 ) ) return null;

      var w = m + 1;
      var L = new Uint32Array((n + 1) * w);
      for ( var i = n - 1 ; i >= 0 ; i-- ) {
        for ( var j = m - 1 ; j >= 0 ; j-- ) {
          L[i * w + j] = a[i] === b[j] ?
            L[(i + 1) * w + j + 1] + 1 :
            Math.max(L[(i + 1) * w + j], L[i * w + j + 1]);
        }
      }

      var out = [];
      var i = 0, j = 0;
      while ( i < n && j < m ) {
        if ( a[i] === b[j] ) {
          out.push({ type: ' ', text: a[i] });
          i++; j++;
        } else if ( L[(i + 1) * w + j] >= L[i * w + j + 1] ) {
          out.push({ type: '-', text: a[i++] });
        } else {
          out.push({ type: '+', text: b[j++] });
        }
      }
      while ( i < n ) out.push({ type: '-', text: a[i++] });
      while ( j < m ) out.push({ type: '+', text: b[j++] });
      return out;
    }
  ]
});
