/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'DiagnosticsHandler',

  requires: [
    'foam.parse.lsp.FoamIndex',
    'foam.parse.lsp.FileModelCache',
    'foam.parse.lsp.FoamClassGrammar',
    'foam.parse.lsp.CursorAnalyzer',
    'foam.parse.lsp.Diagnostic',
    'foam.parse.lsp.handlers.JavaBlockValidator'
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.FoamIndex',
      name: 'index',
      factory: function() { return this.FoamIndex.create(); }
    },
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
    },
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.FoamClassGrammar',
      name: 'grammar',
      factory: function() { return this.FoamClassGrammar.create({ index: this.index }); }
    },
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.handlers.JavaBlockValidator',
      name: 'javaValidator',
      factory: function() { return this.JavaBlockValidator.create({ index: this.index }); }
    },
    {
      name: 'prevResults_',
      documentation: 'Cache of previous diagnostics per URI for incremental updates.',
      factory: function() { return {}; }
    },
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.CSSTokenResolver',
      name: 'cssTokenResolver'
    },
    {
      name: 'validTypes_',
      factory: function() {
        var types = {};
        var propTypes = this.index.getPropertyTypes();
        for ( var i = 0 ; i < propTypes.length ; i++ ) {
          types[propTypes[i].name] = true;
          types[propTypes[i].id] = true;
        }
        return types;
      }
    }
  ],

  methods: [
    function handle(text, opt_uri) {
      if ( ! this.analyzer.isFoamFile(text) ) return [];

      var uri = opt_uri || '';
      var models = this.cache.getModels(uri, text);
      var diagnostics = [];
      var prev = this.prevResults_[uri];

      for ( var i = 0 ; i < models.length ; i++ ) {
        var m = models[i];
        var modelKey = (this.cache.getClassId(m)) + '_' + (m.sourceLine_ || 0);

        // Incremental: reuse previous diagnostics if model hasn't changed
        if ( prev && prev.modelKeys && prev.modelKeys[modelKey] && prev.text === text ) {
          var cached = prev.modelKeys[modelKey];
          for ( var j = 0 ; j < cached.length ; j++ ) diagnostics.push(cached[j]);
        } else {
          var modelDiags = [];
          this.validateModel_(m, text, modelDiags);
          for ( var j = 0 ; j < modelDiags.length ; j++ ) diagnostics.push(modelDiags[j]);
          if ( ! prev ) prev = { text: text, modelKeys: {} };
          prev.modelKeys[modelKey] = modelDiags;
        }
      }

      // Parser-emitted diagnostics — single grammar pass covers all class-ref
      // and property-type positions (extends/requires/of/implements and
      // class: '…'). Positions come straight from parser offsets, no regex.
      this.collectGrammarDiagnostics_(text, diagnostics);

      this.prevResults_[uri] = { text: text, modelKeys: prev ? prev.modelKeys : {} };
      return this.toLSPDiagnostics_(diagnostics);
    },

    function collectGrammarDiagnostics_(text, diagnostics) {
      /**
       * Consume msg-tagged records from grammar parse. For each record,
       * decide whether to emit a Diagnostic based on the msg type and the
       * matched text. All positions come from parser offsets — no regex.
       */
      var records = this.grammar.collectDiagnostics(text);
      for ( var i = 0 ; i < records.length ; i++ ) {
        var r = records[i];
        var matched = text.substring(r.startPos, r.endPos);
        if ( ! matched ) continue;

        if ( r.msg && r.msg.type === 'unknownClassRef' ) {
          if ( ! this.classKnown_(matched) ) {
            this.addDiag_(diagnostics, text, r.startPos, matched.length, 2,
              "Unknown class: '" + matched + "'");
          }
        } else if ( r.msg && r.msg.type === 'unknownPropType' ) {
          if ( ! this.validTypes_[matched] && ! this.classKnown_(matched) ) {
            this.addDiag_(diagnostics, text, r.startPos, matched.length, 3,
              "Unknown property type: '" + matched + "'");
          }
        } else if ( r.msg && r.msg.type === 'columnName' ) {
          // Cross-reference with the enclosing model's property set.
          var pos = this.analyzer.offsetToPosition(text, r.startPos);
          var model = this.cache.getModelAt('', text, pos.line);
          if ( ! model ) continue;
          var propSet = this.collectPropNames_(model);
          // Column names can be dot paths ('owner.name') — check first segment
          var baseName = matched.split('.')[0];
          if ( ! propSet[baseName] ) {
            var classId = this.cache.getClassId(model);
            this.addDiag_(diagnostics, text, r.startPos, matched.length, 2,
              "Property '" + matched + "' does not exist on " + classId);
          }
        }
      }
    },

    function collectPropNames_(model) {
      /** Property-name set for a model: registry props + own raw props. */
      var propNames = {};
      var classId = this.cache.getClassId(model);
      var props = this.index.getProperties(classId);
      for ( var i = 0 ; i < props.length ; i++ ) propNames[props[i].name] = true;
      if ( props.length === 0 && model.extends ) {
        var parentProps = this.index.getProperties(model.extends);
        for ( var i = 0 ; i < parentProps.length ; i++ ) propNames[parentProps[i].name] = true;
      }
      var ownProps = model.properties || [];
      for ( var i = 0 ; i < ownProps.length ; i++ ) {
        var p = ownProps[i];
        var name = typeof p === 'string' ? p : p.name;
        if ( name ) propNames[name] = true;
      }
      return propNames;
    },

    function toLSPDiagnostics_(diagnostics) {
      /** Flatten Diagnostic instances to LSP protocol shape; pass raws through. */
      if ( ! diagnostics ) return diagnostics;
      var out = new Array(diagnostics.length);
      for ( var i = 0 ; i < diagnostics.length ; i++ ) {
        var d = diagnostics[i];
        out[i] = ( d && typeof d.toLSP === 'function' ) ? d.toLSP() : d;
      }
      return out;
    },

    function validateModel_(m, text, diagnostics) {
      var classId = this.cache.getClassId(m);

      // Unknown class (extends/requires/of/implements) and unknown property-type
      // diagnostics come from collectGrammarDiagnostics_ — not repeated here.

      // Validate Java blocks
      this.javaValidator.validateModel(m, classId, diagnostics, text);

      // Validate CSS token references
      this.validateCSS_(m, text, diagnostics);

      // Validate tableColumns/searchColumns
      // tableColumns/searchColumns validation is now emitted from the grammar's
      // columnName rule via P.msg — see collectGrammarDiagnostics_.

      // Validate raw CSS values
      this.validateRawCSSValues_(m, text, diagnostics);

      // Validate expression parameters
      this.validateExpressions_(m, text, diagnostics);
    },

    function validateCSS_(model, text, diagnostics) {
      /**
       * Validate $token references inside css: template strings.
       * Reports unknown CSS token names as warnings.
       */
      if ( ! this.cssTokenResolver ) return;

      var cssStr = model.css;
      if ( ! cssStr || typeof cssStr !== 'string' ) return;

      var baseOffset = text.indexOf(cssStr);
      if ( baseOffset === -1 ) return;

      var tokenPattern = /\$([a-zA-Z][a-zA-Z0-9_\-]*)/g;
      var tm;
      while ( ( tm = tokenPattern.exec(cssStr) ) !== null ) {
        var tokenName = tm[1];
        if ( ! this.cssTokenResolver.tokenExists(tokenName) ) {
          this.addDiag_(diagnostics, text, baseOffset + tm.index, tm[0].length, 2,
            "Unknown CSS token: '$" + tokenName + "'");
        }
      }
    },

    function validateRawCSSValues_(m, text, diagnostics) {
      /**
       * Warn when raw color values are used where CSS tokens should be.
       * Checks css: template strings and color properties on enum values.
       * Consistent with CSSAuditTest.js detection patterns.
       */
      var colorProps = /(?:^|[;{}\s])\s*(color|background(?:-color)?|border(?:-color)?|border-(?:top|bottom|left|right)(?:-color)?|outline-color)\s*:\s*([^;}\n$]+)/g;
      var rawColorValue = /#[0-9a-fA-F]{3,8}\b|rgba?\s*\(|hsla?\s*\(/;

      // Check css: template string
      var cssStr = m.css;
      if ( cssStr && typeof cssStr === 'string' ) {
        var baseOffset = text.indexOf(cssStr);
        if ( baseOffset !== -1 ) {
          var match;
          while ( ( match = colorProps.exec(cssStr) ) !== null ) {
            var valueStr = match[2].trim();
            if ( rawColorValue.test(valueStr) ) {
              var rawMatch = valueStr.match(/#[0-9a-fA-F]{3,8}|rgba?\s*\([^)]*\)|hsla?\s*\([^)]*\)/);
              var rawVal = rawMatch ? rawMatch[0] : valueStr;
              var offset = baseOffset + match.index + match[0].indexOf(valueStr);
              this.addDiag_(diagnostics, text, offset, rawVal.length, 2,
                this.rawColorMessage_(rawVal));
            }
          }
        }
      }

      // Check enum values with color properties
      var values = m.values || [];
      for ( var i = 0 ; i < values.length ; i++ ) {
        var v = values[i];
        if ( ! v || typeof v !== 'object' ) continue;
        var colorVal = v.color || v.background;
        if ( colorVal && typeof colorVal === 'string' && rawColorValue.test(colorVal) ) {
          var loc = this.findInText_(text, 'color', colorVal, 0);
          if ( loc === null ) loc = this.findInText_(text, 'background', colorVal, 0);
          if ( loc !== null ) {
            this.addDiag_(diagnostics, text, loc, colorVal.length, 2,
              this.rawColorMessage_(colorVal));
          }
        }
      }
    },

    function rawColorMessage_(rawVal) {
      /**
       * Build a raw-color diagnostic message that names the matching CSS
       * token when one exists. No match → honest "no token matches" message.
       */
      if ( this.cssTokenResolver ) {
        var token = this.cssTokenResolver.findTokenForValue(rawVal);
        if ( token ) {
          return "Prefer CSS token '$" + token + "' over raw color '" + rawVal + "'";
        }
      }
      return "Raw color '" + rawVal + "' — no matching CSS token in the registry";
    },

    function validateExpressions_(m, text, diagnostics) {
      /**
       * Validate expression function parameters are real property names.
       * Handles trailing $ (slot access), deep $ chains (block$flowParent$value),
       * inner classes (classes: [...]), and multi-model files.
       *
       * Builds property scopes — one for the outer model, one per inner class —
       * each with a text range. For each expression match, finds the narrowest
       * enclosing scope and validates against that scope's properties.
       */
      var classId = this.cache.getClassId(m);
      var modelOffset = m.sourceLine_ ? this.analyzer.positionToOffset(text, { line: m.sourceLine_, character: 0 }) : 0;

      // Determine end of this model's text
      var nextModelRegex = new RegExp(this.analyzer.FOAM_CALL_REGEX.source, 'g');
      nextModelRegex.lastIndex = modelOffset + 1;
      var nextMatch = nextModelRegex.exec(text);
      var modelEnd = nextMatch ? nextMatch.index : text.length;
      var modelText = text.substring(modelOffset, modelEnd);

      // Build property scopes: outer model + each inner class
      var scopes = [];
      scopes.push(this.buildPropScope_(classId, m, 0, modelText.length));

      // Inner classes get their own scopes with text ranges
      var innerClasses = m.classes || [];
      for ( var ic = 0 ; ic < innerClasses.length ; ic++ ) {
        var inner = innerClasses[ic];
        var innerName = inner.name || ('InnerClass' + ic);
        var innerClassId = classId + '.' + innerName;

        // Find inner class text range within modelText
        var innerRange = this.findInnerClassRange_(modelText, innerName);
        scopes.push(this.buildPropScope_(innerClassId, inner,
          innerRange ? innerRange.start : 0,
          innerRange ? innerRange.end : modelText.length));
      }

      // Find expression: function(...) patterns within this model's text
      var exprRegex = /expression\s*:\s*function\s*\(([^)]*)\)/g;
      var match;
      while ( ( match = exprRegex.exec(modelText) ) !== null ) {
        var paramsStr = match[1].trim();
        if ( ! paramsStr ) continue;

        // Find the narrowest enclosing scope for this expression
        var exprPos = match.index;
        var scope = this.findEnclosingScope_(scopes, exprPos);

        var params = paramsStr.split(/\s*,\s*/);
        var paramsOffset = modelOffset + match.index + match[0].indexOf(paramsStr);

        var currentOffset = paramsOffset;
        for ( var i = 0 ; i < params.length ; i++ ) {
          var param = params[i].trim();
          if ( ! param ) { currentOffset += params[i].length + 1; continue; }

          var paramOffset = text.indexOf(param, currentOffset);
          if ( paramOffset === -1 ) paramOffset = currentOffset;
          currentOffset = paramOffset + param.length + 1;

          // Strip trailing $ (slot access)
          var cleanParam = param;
          if ( cleanParam.charAt(cleanParam.length - 1) === '$' ) cleanParam = cleanParam.substring(0, cleanParam.length - 1);

          // Split on $ for deep paths
          var segments = cleanParam.split('$');
          var firstSegment = segments[0];

          // Skip non-property-like params
          if ( /^[_$]$/.test(firstSegment) || firstSegment === 'x' || firstSegment === 'data' ||
               firstSegment === 'self' || firstSegment === 'this' ) continue;

          // Validate first segment against scope properties
          if ( ! scope.propNames[firstSegment] ) {
            this.addDiag_(diagnostics, text, paramOffset, param.length, 2,
              "Property '" + firstSegment + "' does not exist on " + scope.classId);
            continue;
          }

          // Walk the chain for deep paths
          if ( segments.length > 1 ) {
            var currentClassId = this.index.resolvePropertyTypeClassId(scope.classId, firstSegment);
            for ( var s = 1 ; s < segments.length ; s++ ) {
              if ( ! currentClassId ) break;
              var segment = segments[s];
              var segProps = this.index.getProperties(currentClassId);
              var segFound = false;
              for ( var sp = 0 ; sp < segProps.length ; sp++ ) {
                if ( segProps[sp].name === segment ) { segFound = true; break; }
              }

              if ( ! segFound ) {
                var segOffset = text.indexOf(segment, paramOffset);
                if ( segOffset === -1 ) segOffset = paramOffset;
                this.addDiag_(diagnostics, text, segOffset, segment.length, 2,
                  "Property '" + segment + "' does not exist on " + currentClassId);
                break;
              }

              currentClassId = this.index.resolvePropertyTypeClassId(currentClassId, segment);
            }
          }
        }
      }
    },

    function buildPropScope_(classId, modelObj, rangeStart, rangeEnd) {
      /**
       * Build a property scope: { classId, propNames, start, end }.
       * Collects names that are valid as `expression:` / `postSet:` / etc.
       * parameters — i.e., anything accessible on `this.`: own + inherited
       * properties, plus imports (which FOAM exposes on `this` too).
       */
      var propNames = {};

      // Registry properties (own + inherited)
      var props = this.index.getProperties(classId);
      for ( var i = 0 ; i < props.length ; i++ ) propNames[props[i].name] = true;

      // If class not registered, try parent
      if ( props.length === 0 && modelObj.extends ) {
        var parentProps = this.index.getProperties(modelObj.extends);
        for ( var i = 0 ; i < parentProps.length ; i++ ) propNames[parentProps[i].name] = true;
      }

      // Raw model properties
      var ownProps = modelObj.properties || [];
      for ( var i = 0 ; i < ownProps.length ; i++ ) {
        var p = ownProps[i];
        var name = typeof p === 'string' ? p : p.name;
        if ( name ) propNames[name] = true;
      }

      // Imports — `imports: [ 'visualizationWidth', 'ctrl?' ]` are all exposed
      // on `this` at runtime so they're valid expression params too.
      var imps = modelObj.imports || [];
      for ( var i = 0 ; i < imps.length ; i++ ) {
        var imp = imps[i];
        var iname = typeof imp === 'string' ? imp : (imp && imp.name);
        if ( ! iname ) continue;
        // handle aliases `'a as b'` and optional `'x?'`
        var asIdx = iname.indexOf(' as ');
        if ( asIdx !== -1 ) iname = iname.substring(asIdx + 4).trim();
        iname = iname.replace(/\?$/, '').trim();
        if ( iname ) propNames[iname] = true;
      }

      // Constants — `constants: { NAME: 'X' }` or `constants: [{ name: 'X' }]`
      var consts = modelObj.constants;
      if ( consts ) {
        if ( Array.isArray(consts) ) {
          for ( var i = 0 ; i < consts.length ; i++ ) {
            var c = consts[i];
            var cn = typeof c === 'string' ? c : (c && c.name);
            if ( cn ) propNames[cn] = true;
          }
        } else if ( typeof consts === 'object' ) {
          for ( var cn in consts ) {
            if ( Object.prototype.hasOwnProperty.call(consts, cn) ) propNames[cn] = true;
          }
        }
      }

      return { classId: classId, propNames: propNames, start: rangeStart, end: rangeEnd };
    },

    function findInnerClassRange_(modelText, className) {
      /**
       * Find the text range of an inner class definition within the model text.
       * Returns { start, end } offsets or null.
       */
      var namePattern = new RegExp("name\\s*:\\s*['\"]" + className + "['\"]");
      var nameMatch = namePattern.exec(modelText);
      if ( ! nameMatch ) return null;

      // Walk backward from name match to find the opening {
      var start = nameMatch.index;
      for ( var i = start ; i >= 0 ; i-- ) {
        if ( modelText.charAt(i) === '{' ) { start = i; break; }
      }

      // Walk forward to find the closing } at the same depth
      var depth = 0;
      var end = modelText.length;
      for ( var i = start ; i < modelText.length ; i++ ) {
        var ch = modelText.charAt(i);
        if ( ch === '{' ) depth++;
        else if ( ch === '}' ) {
          depth--;
          if ( depth === 0 ) { end = i + 1; break; }
        }
        // Skip strings
        else if ( ch === "'" || ch === '"' || ch === '`' ) {
          for ( i++ ; i < modelText.length ; i++ ) {
            if ( modelText.charAt(i) === '\\' ) { i++; continue; }
            if ( modelText.charAt(i) === ch ) break;
          }
        }
      }

      return { start: start, end: end };
    },

    function findEnclosingScope_(scopes, position) {
      /**
       * Find the narrowest scope that contains the given position.
       * Inner class scopes are narrower than the outer model scope.
       */
      var best = scopes[0]; // outer model is always the fallback
      for ( var i = 1 ; i < scopes.length ; i++ ) {
        var s = scopes[i];
        if ( position >= s.start && position < s.end ) {
          // Prefer narrower scope
          if ( (s.end - s.start) < (best.end - best.start) ) {
            best = s;
          }
        }
      }
      return best;
    },

    function classKnown_(classId) {
      /**
       * Check if a class is known — registered in FOAM runtime OR in the
       * POM file index. The file index includes all files from the POM walk
       * with the current flags, so flag-filtered classes (test, swift, etc.)
       * are correctly excluded unless the user enables those flags.
       */
      return this.index.classExists(classId) || this.index.getFilePath(classId) != null;
    },

    function findInText_(text, key, value, opt_startOffset) {
      /** Find the offset of a value string in text, optionally near a key. */
      var escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var searchStr = key ? key + "\\s*:\\s*['\"]" + escaped : "['\"]" + escaped;
      var regex = new RegExp(searchStr, 'g');
      if ( opt_startOffset ) regex.lastIndex = opt_startOffset;
      var match = regex.exec(text);
      if ( ! match ) return null;
      return match.index + match[0].indexOf(value);
    },

    function addDiag_(diagnostics, text, offset, length, severity, message) {
      var pos = this.analyzer.offsetToPosition(text, offset);
      diagnostics.push(this.Diagnostic.create({
        range: {
          start: pos,
          end: { line: pos.line, character: pos.character + length }
        },
        severity: severity,
        message: message
      }));
    }
  ]
});
