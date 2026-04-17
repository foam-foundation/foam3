/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp',
  name: 'TypeTracker',

  documentation: 'Resolves variable types from .create() assignments. Scans backward from cursor to find var x = this.Foo.create() patterns and resolves Foo through the requires map.',

  requires: [
    'foam.parse.lsp.FileModelCache'
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.FileModelCache',
      name: 'cache',
      factory: function() { return this.FileModelCache.create(); }
    }
  ],

  methods: [
    function getVariableTypes(text, position, model, index) {
      /**
       * Returns { varName: classId } for variables in scope at position.
       * Scans backward from cursor through the enclosing method body.
       */
      var types = {};
      if ( ! model ) return types;

      var requiresMap = this.cache.buildRequiresMap(model);
      var lines = text.split('\n');

      // Resolve the current class for method return type lookups
      var classId = this.cache.getClassId(model);

      // Scan backward from cursor, stop at function boundary
      for ( var i = position.line ; i >= 0 ; i-- ) {
        var line = lines[i];
        if ( ! line ) continue;

        // Stop at function declaration (we've left the method scope)
        if ( i < position.line && /^\s*function\s+\w+\s*\(/.test(line) ) break;
        if ( i < position.line && /^\s*\w+\s*:\s*function\s*\(/.test(line) ) break;
        if ( i < position.line && /^\s*async\s+function\s+\w+\s*\(/.test(line) ) break;

        // var x = this.ShortName.create( or var x = ClassName.create(
        var createMatch = line.match(/(?:var|let|const)\s+(\w+)\s*=\s*(?:this\.)?(\w+)\.create\s*\(/);
        if ( createMatch ) {
          var varName = createMatch[1];
          var className = createMatch[2];
          var resolved = requiresMap[className] || (index.classExists(className) ? className : null);
          if ( resolved ) types[varName] = resolved;
          continue;
        }

        // var x = this.methodName(...) → FoamIndex.getMethodReturnType handles
        // both explicit method.type axioms and code-body `return …` parsing.
        var methodMatch = line.match(/(?:var|let|const)\s+(\w+)\s*=\s*this\.(\w+)\s*\(/);
        if ( methodMatch ) {
          var mName = methodMatch[2];
          if ( mName === 'create' ) continue;   // .create() handled above
          var ret = index.getMethodReturnType(classId, mName);
          if ( ret ) types[methodMatch[1]] = ret;
        }
      }
      return types;
    },

    function resolveVariableType(text, position, varName, model, index) {
      /** Resolve a single variable name to a class ID, or null. */
      var types = this.getVariableTypes(text, position, model, index);
      return types[varName] || null;
    }
  ]
});
