/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'TypeDefinitionHandler',

  documentation: 'textDocument/typeDefinition — distinct from definition. For a property usage `this.foo`, jump to the property\'s declared class (e.g. foam.lang.Long); for a class reference, jump to the class itself.',

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
      var segment = this.analyzer.getSegmentAtPosition(text, position);
      if ( ! segment ) return null;

      // Case A: segment IS a class id (or short name of one) — same as Definition.
      var directId = segment;
      if ( ! this.index.classExists(directId) && this.cache ) {
        directId = this.cache.resolveShortName(opt_uri, text, segment, position.line);
      }
      if ( directId && this.index.classExists(directId) ) {
        var filePath = this.index.getFilePath(directId);
        if ( filePath ) return this.location_(filePath);
      }

      // Case B: segment is a property name on the current class — jump to its
      // Property subclass file (e.g. `foam.lang.Long`).
      var ownerId = this.cache ? this.cache.getClassIdAt(opt_uri || '', text, position.line) : null;
      if ( ! ownerId ) return null;

      var props = this.index.getProperties(ownerId);
      for ( var i = 0 ; i < props.length ; i++ ) {
        if ( props[i].name !== segment ) continue;
        var propClassId = props[i].cls_ && props[i].cls_.id;
        if ( ! propClassId ) continue;
        var filePath = this.index.getFilePath(propClassId);
        if ( filePath ) return this.location_(filePath);
      }

      return null;
    },

    function location_(filePath) {
      return {
        uri: 'file://' + filePath,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
      };
    }
  ]
});
