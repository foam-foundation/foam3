/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'TypeHierarchyHandler',

  documentation: 'Type hierarchy for FOAM classes — handles textDocument/prepareTypeHierarchy + typeHierarchy/{supertypes,subtypes}. Maps directly to FoamIndex.getInheritanceChain / getSubclasses / getImplementors.',

  requires: [
    'foam.parse.lsp.CursorAnalyzer'
  ],

  constants: {
    SYMBOL_KIND_CLASS:     5,
    SYMBOL_KIND_INTERFACE: 11
  },

  properties: [
    { name: 'index' },
    { name: 'cache' },
    {
      name: 'analyzer',
      factory: function() { return this.CursorAnalyzer.create(); }
    }
  ],

  methods: [
    function prepare(text, position, opt_uri) {
      /**
       * Resolve the cursor word to a class id and return a single
       * TypeHierarchyItem, or null when the cursor isn't on a known class.
       */
      var word = this.analyzer.getDottedWordAtPosition(text, position);
      if ( ! word ) return null;

      var classId = this.resolveClassId_(text, position, word, opt_uri);
      if ( ! classId ) return null;

      return [ this.itemFor_(classId) ].filter(Boolean);
    },

    function supertypes(item) {
      if ( ! item || ! item.data || ! item.data.classId ) return [];
      var chain = this.index.getInheritanceChain(item.data.classId);
      var out   = [];
      // First entry of getInheritanceChain is the class itself; skip it.
      for ( var i = 1 ; i < chain.length ; i++ ) {
        var it = this.itemFor_(chain[i]);
        if ( it ) out.push(it);
      }
      return out;
    },

    function subtypes(item) {
      if ( ! item || ! item.data || ! item.data.classId ) return [];
      var children = this.index.getSubclasses(item.data.classId);
      // Interfaces also surface their implementors as "subtypes" for the UI tree.
      if ( this.index.isInterface(item.data.classId) ) {
        var implementors = this.index.getImplementors(item.data.classId);
        for ( var i = 0 ; i < implementors.length ; i++ ) {
          if ( children.indexOf(implementors[i]) === -1 ) children.push(implementors[i]);
        }
      }
      var out = [];
      for ( var i = 0 ; i < children.length ; i++ ) {
        var it = this.itemFor_(children[i]);
        if ( it ) out.push(it);
      }
      return out;
    },

    function itemFor_(classId) {
      var filePath = this.index.getFilePath(classId);
      if ( ! filePath ) return null;
      var isInterface = this.index.isInterface(classId);
      var line = this.index.getClassLine(classId);
      var range = { start: { line: line, character: 0 }, end: { line: line, character: 0 } };
      return {
        name:           classId.split('.').pop(),
        kind:           isInterface ? this.SYMBOL_KIND_INTERFACE : this.SYMBOL_KIND_CLASS,
        uri:            'file://' + filePath,
        range:          range,
        selectionRange: range,
        detail:         classId,
        data:           { classId: classId }
      };
    },

    function resolveClassId_(text, position, word, opt_uri) {
      // Already a full classId
      if ( this.index.classExists(word) ) return word;
      // Short-name resolution via the cached model
      if ( this.cache ) {
        var resolved = this.cache.resolveShortName(opt_uri, text, word.split('.').pop(), position.line);
        if ( resolved ) return resolved;
        // Current file's own class
        var selfId = this.cache.getClassIdAt(opt_uri || '', text, position.line);
        if ( selfId && ( selfId === word || selfId.split('.').pop() === word ) ) return selfId;
      }
      return null;
    }
  ]
});
