/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'WorkspaceSymbolHandler',

  documentation: 'workspace/symbol — searches FOAM classes, properties, methods, actions, listeners, and enum values across the workspace. Backed by FoamIndex.searchSymbols (lazy-built, cls.getOwnAxiomsByClass per class — no rescan, no regex).',

  constants: {
    DEFAULT_LIMIT: 500
  },

  properties: [
    { name: 'index' }
  ],

  methods: [
    function handle(query, opt_limit) {
      // opt_limit lifted from 100 to 500. Earlier the cap silently truncated
      // common queries — e.g. searching "Fee" returned 100 of ~340 matches.
      var limit = opt_limit || this.DEFAULT_LIMIT;
      var hits  = this.index.searchSymbols(query, { limit: limit });
      var out   = [];
      for ( var i = 0 ; i < hits.length ; i++ ) {
        var h = hits[i];
        out.push({
          name:          h.name,
          kind:          h.kind,
          location: {
            uri:   'file://' + h.filePath,
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
          },
          containerName: h.containerName
        });
      }
      return out;
    }
  ]
});
