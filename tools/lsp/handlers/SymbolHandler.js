/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'SymbolHandler',

  requires: [
    'foam.parse.lsp.FileModelCache',
    'foam.parse.lsp.CursorAnalyzer'
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.FileModelCache',
      name: 'cache',
      factory: function() { return this.FileModelCache.create(); }
    },
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.CursorAnalyzer',
      name: 'analyzer',
      factory: function() { return this.CursorAnalyzer.create(); }
    }
  ],

  methods: [
    function handle(text, opt_uri) {
      /**
       * Returns DocumentSymbol[] — outline of class, properties, methods.
       * Uses FileModelCache for class-level info, regex for source positions.
       */
      if ( ! this.analyzer.isFoamFile(text) ) return [];

      var models = this.cache.getModels(opt_uri || '', text);
      var symbols = [];

      for ( var i = 0 ; i < models.length ; i++ ) {
        var m = models[i];
        var className = this.cache.getClassId(m) || 'Unknown';
        var startLine = m.sourceLine_ || 0;
        var kindNum = m.type_ === 'ENUM' ? 10 : m.type_ === 'INTERFACE' ? 11 : 5;
        var children = [];

        // Property children
        var props = m.properties || [];
        for ( var j = 0 ; j < props.length ; j++ ) {
          var p = props[j];
          var propName = typeof p === 'string' ? p : p.name;
          if ( ! propName ) continue;
          var propPos = this.findPropPosition_(text, propName);
          children.push({
            name: propName,
            kind: 7,
            range: { start: propPos, end: propPos },
            selectionRange: { start: propPos, end: propPos }
          });
        }

        // Method children
        var methods = m.methods || [];
        for ( var j = 0 ; j < methods.length ; j++ ) {
          var method = methods[j];
          var methodName = typeof method === 'function' ? method.name : (method.name || '');
          if ( ! methodName ) continue;
          var methodPos = this.findMethodPosition_(text, methodName);
          children.push({
            name: methodName,
            kind: 6,
            range: { start: methodPos, end: methodPos },
            selectionRange: { start: methodPos, end: methodPos }
          });
        }

        symbols.push({
          name: className,
          kind: kindNum,
          range: { start: { line: startLine, character: 0 }, end: { line: startLine, character: 0 } },
          selectionRange: { start: { line: startLine, character: 0 }, end: { line: startLine, character: 0 } },
          children: children
        });
      }

      // If no models from eval (SyntaxError), fall back to regex
      if ( models.length === 0 ) {
        return this.regexFallback_(text);
      }

      return symbols;
    },

    function findPropPosition_(text, propName) {
      /** Find the position of a property name in the source text. */
      var regex = new RegExp("name\\s*:\\s*['\"]" + propName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "['\"]");
      var match = regex.exec(text);
      if ( match ) return this.analyzer.offsetToPosition(text, match.index);
      return { line: 0, character: 0 };
    },

    function findMethodPosition_(text, methodName) {
      /** Find the position of a method definition in the source text. */
      var regex = new RegExp("function\\s+" + methodName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "\\s*\\(");
      var match = regex.exec(text);
      if ( match ) return this.analyzer.offsetToPosition(text, match.index);
      return { line: 0, character: 0 };
    },

    function regexFallback_(text) {
      /** Fallback symbol extraction using regex for broken files. */
      var symbols = [];

      // Class name
      var pkgMatch = text.match(/package\s*:\s*['"]([^'"]+)['"]/);
      var nameMatch = text.match(/name\s*:\s*['"]([^'"]+)['"]/);
      if ( nameMatch ) {
        var className = pkgMatch ? pkgMatch[1] + '.' + nameMatch[1] : nameMatch[1];
        var classPos = this.analyzer.offsetToPosition(text, nameMatch.index);
        symbols.push({
          name: className,
          kind: 5,
          range: { start: { line: 0, character: 0 }, end: this.analyzer.offsetToPosition(text, text.length) },
          selectionRange: { start: classPos, end: { line: classPos.line, character: classPos.character + nameMatch[0].length } }
        });
      }

      // Properties
      var objRegex = /\{\s*class\s*:\s*['"][^'"]*['"]\s*,\s*name\s*:\s*['"]([^'"]+)['"]/g;
      var match;
      while ( ( match = objRegex.exec(text) ) !== null ) {
        var pos = this.analyzer.offsetToPosition(text, match.index);
        symbols.push({
          name: match[1],
          kind: 7,
          range: { start: pos, end: { line: pos.line, character: pos.character + match[0].length } },
          selectionRange: { start: pos, end: { line: pos.line, character: pos.character + match[0].length } }
        });
      }

      // Methods
      var methodRegex = /function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
      while ( ( match = methodRegex.exec(text) ) !== null ) {
        if ( match[1] === 'factory' || match[1] === 'expression' ) continue;
        var pos = this.analyzer.offsetToPosition(text, match.index);
        symbols.push({
          name: match[1],
          kind: 6,
          range: { start: pos, end: { line: pos.line, character: pos.character + match[0].length } },
          selectionRange: { start: pos, end: { line: pos.line, character: pos.character + match[0].length } }
        });
      }

      return symbols;
    }
  ]
});
