/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'FoldingRangeHandler',

  documentation: 'Foldable region detection for FOAM model files — properties/methods/requires/imports/exports/javaImports/actions/listeners arrays.',

  constants: {
    FOLD_KEYWORDS: [
      'properties', 'methods', 'requires', 'imports',
      'exports', 'javaImports', 'actions', 'listeners'
    ]
  },

  methods: [
    function handle(text) {
      var ranges = [];
      var lines  = text.split('\n');
      var kws    = this.FOLD_KEYWORDS;

      for ( var k = 0 ; k < kws.length ; k++ ) {
        var pattern = new RegExp(kws[k] + '\\s*:\\s*\\[');

        for ( var i = 0 ; i < lines.length ; i++ ) {
          if ( ! pattern.test(lines[i]) ) continue;

          var depth     = 0;
          var foundOpen = false;
          var endLine   = -1;
          for ( var j = i ; j < lines.length ; j++ ) {
            var ln = lines[j];
            for ( var c = 0 ; c < ln.length ; c++ ) {
              if ( ln[c] === '[' ) { depth++; foundOpen = true; }
              else if ( ln[c] === ']' ) {
                depth--;
                if ( foundOpen && depth === 0 ) { endLine = j; break; }
              }
            }
            if ( endLine !== -1 ) break;
          }

          if ( endLine > i ) {
            ranges.push({ startLine: i, endLine: endLine, kind: 'region' });
          }
        }
      }

      return ranges;
    }
  ]
});
