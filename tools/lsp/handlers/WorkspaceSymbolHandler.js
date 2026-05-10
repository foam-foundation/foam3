/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'WorkspaceSymbolHandler',

  documentation: 'Search FOAM class ids across the workspace by substring. Phase 3 will extend this with property/method search and ranking; today it ships the existing behaviour extracted from server.js.',

  constants: {
    SYMBOL_KIND_CLASS: 5,
    DEFAULT_LIMIT:     100
  },

  properties: [
    { name: 'index' }
  ],

  methods: [
    function handle(query, opt_limit) {
      var q       = ( query || '' ).toLowerCase();
      var limit   = opt_limit || this.DEFAULT_LIMIT;
      var ids     = this.index.getAllClassIds();
      var symbols = [];

      for ( var i = 0 ; i < ids.length && symbols.length < limit ; i++ ) {
        if ( ids[i].toLowerCase().indexOf(q) === -1 ) continue;
        var filePath = this.index.getFilePath(ids[i]);
        if ( ! filePath ) continue;
        symbols.push({
          name:          ids[i].split('.').pop(),
          kind:          this.SYMBOL_KIND_CLASS,
          location: {
            uri:   'file://' + filePath,
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
          },
          containerName: ids[i]
        });
      }

      return symbols;
    }
  ]
});
