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
       * Covers:
       *   • `var x = this.X.create(…)` / `var x = Short.create(…)`
       *   • `var x = this.METHOD(…)` with return-type inferred via FoamIndex
       *   • `.then((p) => …)` / `.then(function(p) { … })` callback params
       *     typed as the awaited receiver, specifically
       *     `…select(SINK).then(p => p.…)` → p typed as SINK's class.
       */
      var types = {};
      if ( ! model ) return types;

      var requiresMap = this.cache.buildRequiresMap(model);
      var lines = text.split('\n');

      // Resolve the current class for method return type lookups
      var classId = this.cache.getClassId(model);

      // Pre-pass: track .then() callback parameters typed from the chain's
      // preceding `.select(…)` argument. Scans the whole text once and maps
      // every `.then((param) => …)` / `.then(function(param))` parameter to
      // the resolved sink class id. Later, cursor-local var scan can still
      // override these when a direct assignment is closer.
      this.collectThenParams_(text, classId, model, requiresMap, index, types);

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
    },

    function collectThenParams_(text, classId, model, requiresMap, index, types) {
      /**
       * Find every `.select(SINK).then((P) => …)` or
       * `.select(SINK).then(function(P) …)` in the text and type P as
       * SINK's class. Multi-line friendly — uses a single DOTALL regex
       * that allows any characters (including newlines) between `.select(`
       * and the opening paren of its argument, and between `)` and `.then(`.
       *
       * SINK expressions resolved:
       *   • this.METHOD(…)     → FoamIndex.getMethodReturnType
       *   • this.Class.create( → short name via requires
       *   • Class.create(      → short name via requires (rare)
       */
      // Walk string with a balanced-paren scanner: find `.select(`, grab
      // its first top-level argument expression, then look for the
      // immediately-following `.then(` — again with balanced paren — and
      // extract the callback's first parameter name.
      var i = 0;
      var n = text.length;
      while ( i < n ) {
        var sel = text.indexOf('.select(', i);
        if ( sel === -1 ) break;
        var argStart = sel + '.select('.length;
        var argEnd = this.matchCloseParen_(text, argStart);
        if ( argEnd === -1 ) { i = argStart; continue; }

        // Walk past whitespace/comments between ) and .then(
        var afterSel = this.skipChainSpace_(text, argEnd + 1);
        if ( text.substr(afterSel, 6) !== '.then(' ) { i = afterSel; continue; }

        var thenStart = afterSel + '.then('.length;
        var thenEnd = this.matchCloseParen_(text, thenStart);
        if ( thenEnd === -1 ) { i = thenStart; continue; }

        var cbText = text.substring(thenStart, thenEnd);
        var paramName = this.extractCallbackParamName_(cbText);
        if ( ! paramName ) { i = thenEnd; continue; }

        // Resolve the sink expression inside `.select(…)`
        var sinkExpr = text.substring(argStart, argEnd).trim();
        var sinkClassId = this.resolveExpressionType_(
          sinkExpr, classId, model, requiresMap, index);
        if ( sinkClassId ) types[paramName] = sinkClassId;

        i = thenEnd + 1;
      }
    },

    function matchCloseParen_(text, openIdx) {
      /**
       * Given `openIdx` is the position AFTER a `(`, return the index of its
       * matching `)`, skipping over nested parens, strings, comments,
       * and template literals. Returns -1 if unmatched.
       */
      var depth = 1;
      var i = openIdx;
      var n = text.length;
      while ( i < n ) {
        var c = text[i];
        if ( c === '/' && text[i + 1] === '/' ) {
          while ( i < n && text[i] !== '\n' ) i++;
          continue;
        }
        if ( c === '/' && text[i + 1] === '*' ) {
          i += 2;
          while ( i < n - 1 && ! ( text[i] === '*' && text[i + 1] === '/' ) ) i++;
          i += 2;
          continue;
        }
        if ( c === "'" || c === '"' || c === '`' ) {
          var q = c; i++;
          while ( i < n && text[i] !== q ) {
            if ( text[i] === '\\' ) i++;
            i++;
          }
          i++;
          continue;
        }
        if ( c === '(' ) depth++;
        else if ( c === ')' ) {
          depth--;
          if ( depth === 0 ) return i;
        }
        i++;
      }
      return -1;
    },

    function skipChainSpace_(text, i) {
      /** Skip whitespace and comments between a `)` and a following `.then(`. */
      var n = text.length;
      while ( i < n ) {
        var c = text[i];
        if ( c === ' ' || c === '\t' || c === '\n' || c === '\r' ) { i++; continue; }
        if ( c === '/' && text[i + 1] === '/' ) {
          while ( i < n && text[i] !== '\n' ) i++;
          continue;
        }
        if ( c === '/' && text[i + 1] === '*' ) {
          i += 2;
          while ( i < n - 1 && ! ( text[i] === '*' && text[i + 1] === '/' ) ) i++;
          i += 2;
          continue;
        }
        break;
      }
      return i;
    },

    function extractCallbackParamName_(cbText) {
      /**
       * Extract the first parameter name from a callback string. Accepts:
       *   `(param) => …`, `param => …`, `function (param) …`,
       *   `function name(param) …`, `async (param) => …`, etc.
       * Returns null if none.
       */
      var s = cbText.replace(/^\s+/, '');
      // `function [name]?(param)…`
      var fm = s.match(/^(?:async\s+)?function\s*\w*\s*\(\s*([a-zA-Z_$][\w$]*)/);
      if ( fm ) return fm[1];
      // `(param) => …` or `(param, ...) => …`
      var pm = s.match(/^(?:async\s*)?\(\s*([a-zA-Z_$][\w$]*)/);
      if ( pm ) return pm[1];
      // `param => …`
      var bm = s.match(/^(?:async\s+)?([a-zA-Z_$][\w$]*)\s*=>/);
      if ( bm ) return bm[1];
      return null;
    },

    function resolveExpressionType_(expr, classId, model, requiresMap, index) {
      /**
       * Resolve the class id produced by a small set of expression shapes:
       *   • `this.X.create(...)`   → short name via requires
       *   • `X.create(...)`        → short name via requires
       *   • `this.METHOD(...)`     → FoamIndex.getMethodReturnType; if the
       *     current class isn't in the registry (mid-edit or synthetic),
       *     fall through to its `extends` + `implements` chain.
       * First match wins, null otherwise.
       */
      var m;
      m = expr.match(/^this\s*\.\s*(\w+)\s*\.\s*create\s*\(/);
      if ( m ) {
        return requiresMap[m[1]] || (index.classExists(m[1]) ? m[1] : null);
      }
      m = expr.match(/^(\w+)\s*\.\s*create\s*\(/);
      if ( m ) {
        return requiresMap[m[1]] || (index.classExists(m[1]) ? m[1] : null);
      }
      m = expr.match(/^this\s*\.\s*(\w+)\s*\(/);
      if ( m ) {
        var methodName = m[1];
        var direct = index.getMethodReturnType(classId, methodName);
        if ( direct ) return direct;
        // Fall through to extends / implements — the method may live there.
        var chain = this.methodScopeChain_(model);
        for ( var i = 0 ; i < chain.length ; i++ ) {
          var ret = index.getMethodReturnType(chain[i], methodName);
          if ( ret ) return ret;
        }
      }
      return null;
    },

    function methodScopeChain_(model) {
      /**
       * Classes to consult for method-axiom lookups when the current class
       * isn't in the runtime registry (e.g. during edit of a class that
       * hasn't been reloaded). Returns extends + every implemented interface
       * in declared order.
       */
      if ( ! model ) return [];
      var out = [];
      if ( model.extends ) out.push(model.extends);
      var impls = model.implements || [];
      for ( var i = 0 ; i < impls.length ; i++ ) {
        var ifc = impls[i];
        out.push(typeof ifc === 'string' ? ifc : (ifc && ifc.path));
      }
      return out.filter(function(x) { return !! x; });
    }
  ]
});
