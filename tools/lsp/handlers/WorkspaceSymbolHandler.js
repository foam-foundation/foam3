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
        // Class-level hits (Class/Interface/Enum) sit at the foam.CLASS call;
        // member hits resolve to their axiom line via the grammar position map
        // (one parse per file, cached in FoamIndex.getFilePosMap_).
        var line = 0, character = 0;
        if ( h.kind === 5 || h.kind === 11 || h.kind === 10 ) {
          line = this.index.getClassLine(h.classId);
        } else {
          var pos = this.index.getSymbolPosition(h.classId, h.name, h.kind);
          line = pos.line; character = pos.character;
        }
        out.push({
          name:          h.name,
          kind:          h.kind,
          location: {
            uri:   'file://' + h.filePath,
            range: { start: { line: line, character: character }, end: { line: line, character: character } }
          },
          containerName: h.containerName
        });
      }
      return out;
    }
  ]
});
