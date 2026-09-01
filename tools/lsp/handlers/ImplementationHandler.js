/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'ImplementationHandler',

  documentation: 'textDocument/implementation — given a FOAM interface id at the cursor, return locations of every class that implements it. For non-interface classes, falls back to direct subclasses (same shape as references for users that bound implementation to "show me concrete things").',

  requires: [
    'foam.parse.lsp.CursorAnalyzer'
  ],

  properties: [
    { name: 'index' },
    { name: 'cache' },
    {
      name: 'analyzer',
      factory: function() { return this.CursorAnalyzer.create(); }
    }
  ],

  methods: [
    function handle(text, position, opt_uri) {
      var word = this.analyzer.getDottedWordAtPosition(text, position);
      if ( ! word ) return [];

      var classId = this.resolveClassId_(text, position, word, opt_uri);
      if ( ! classId ) return [];

      var targets = [];
      if ( this.index.isInterface(classId) ) {
        targets = this.index.getImplementors(classId);
      } else {
        targets = this.index.getSubclasses(classId);
      }

      var locations = [];
      for ( var i = 0 ; i < targets.length ; i++ ) {
        var filePath = this.index.getFilePath(targets[i]);
        if ( ! filePath ) continue;
        var line = this.index.getClassLine(targets[i]);
        locations.push({
          uri: 'file://' + filePath,
          range: { start: { line: line, character: 0 }, end: { line: line, character: 0 } }
        });
      }
      return locations;
    },

    function resolveClassId_(text, position, word, opt_uri) {
      if ( this.index.classExists(word) ) return word;
      if ( this.cache ) {
        var resolved = this.cache.resolveShortName(opt_uri, text, word.split('.').pop(), position.line);
        if ( resolved ) return resolved;
      }
      return null;
    }
  ]
});
