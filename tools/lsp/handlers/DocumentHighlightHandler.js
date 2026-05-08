/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'DocumentHighlightHandler',

  documentation: 'Highlight all occurrences of the identifier under the cursor within the current file.',

  requires: [
    'foam.parse.lsp.CursorAnalyzer'
  ],

  constants: {
    KIND_TEXT: 1,
    KIND_READ: 2,
    KIND_WRITE: 3
  },

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.CursorAnalyzer',
      name: 'analyzer',
      factory: function() { return this.CursorAnalyzer.create(); }
    }
  ],

  methods: [
    function handle(text, position) {
      var segment = this.analyzer.getSegmentAtPosition(text, position);
      if ( ! segment || segment.length < 2 ) return [];

      // Word-boundary match so `create` doesn't highlight inside `createTable`.
      var re = new RegExp('\\b' + segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
      var highlights = [];
      var m;
      while ( ( m = re.exec(text) ) !== null ) {
        var startPos = this.analyzer.offsetToPosition(text, m.index);
        highlights.push({
          range: {
            start: startPos,
            end: { line: startPos.line, character: startPos.character + segment.length }
          },
          kind: this.KIND_TEXT
        });
      }
      return highlights;
    }
  ]
});
