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
    'foam.parse.lsp.CursorAnalyzer',
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
      if ( ! /foam\.(CLASS|ENUM|INTERFACE|RELATIONSHIP)\s*\(/.test(text) ) {
        return [];
      }

      var uri = opt_uri || '';
      var models = this.cache.getModels(uri, text);
      var diagnostics = [];
      var prev = this.prevResults_[uri];

      for ( var i = 0 ; i < models.length ; i++ ) {
        var m = models[i];
        var modelKey = (m.refines || (m.package ? m.package + '.' + m.name : m.name)) + '_' + (m.sourceLine_ || 0);

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

      this.prevResults_[uri] = { text: text, modelKeys: prev ? prev.modelKeys : {} };
      return diagnostics;
    },

    function validateModel_(m, text, diagnostics) {
      var classId = m.refines || (m.package ? m.package + '.' + m.name : m.name);
      var modelOffset = m.sourceLine_ ? this.analyzer.positionToOffset(text, { line: m.sourceLine_, character: 0 }) : 0;

      // Validate extends
      if ( m.extends && ! this.classKnown_(m.extends) ) {
        var loc = this.findInText_(text, 'extends', m.extends, modelOffset);
        if ( loc !== null ) this.addDiag_(diagnostics, text, loc, m.extends.length, 2,
          "Unknown class in extends: '" + m.extends + "'");
      }

      // Validate requires — parse 'as' aliases to extract the real class ID
      var requires = m.requires || [];
      for ( var i = 0 ; i < requires.length ; i++ ) {
        var parsed = this.cache.parseRequiresEntry(requires[i]);
        if ( ! parsed ) continue;
        var reqId = parsed.classId;
        if ( reqId && ! this.classKnown_(reqId) ) {
          var loc = this.findInText_(text, null, reqId, modelOffset);
          if ( loc !== null ) this.addDiag_(diagnostics, text, loc, reqId.length, 2,
            "Unknown class in requires: '" + reqId + "'");
        }
      }

      // Validate property types
      var props = m.properties || [];
      for ( var i = 0 ; i < props.length ; i++ ) {
        var p = props[i];
        if ( typeof p === 'object' && p.class ) {
          if ( ! this.validTypes_[p.class] && ! this.classKnown_(p.class) ) {
            var loc = this.findInText_(text, 'class', p.class, modelOffset);
            if ( loc !== null ) this.addDiag_(diagnostics, text, loc, p.class.length, 3,
              "Unknown property type: '" + p.class + "'");
          }
        }
      }

      // Validate Java blocks
      this.javaValidator.validateModel(m, classId, diagnostics, text);

      // Validate CSS token references
      this.validateCSS_(m, text, diagnostics);

      // Validate tableColumns/searchColumns
      this.validateColumns_(m, text, diagnostics);
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

    function validateColumns_(m, text, diagnostics) {
      /**
       * Validate tableColumns and searchColumns entries are real property names.
       */
      var columnKeys = ['tableColumns', 'searchColumns'];
      var classId = m.refines || (m.package ? m.package + '.' + m.name : m.name);
      var modelOffset = m.sourceLine_ ? this.analyzer.positionToOffset(text, { line: m.sourceLine_, character: 0 }) : 0;

      // Build property name set (own + inherited + model-defined)
      var propNames = {};
      var props = this.index.getProperties(classId);
      for ( var i = 0 ; i < props.length ; i++ ) propNames[props[i].name] = true;

      // If the class itself isn't registered, resolve inherited properties from extends
      if ( props.length === 0 && m.extends ) {
        var parentProps = this.index.getProperties(m.extends);
        for ( var i = 0 ; i < parentProps.length ; i++ ) propNames[parentProps[i].name] = true;
      }

      var ownProps = m.properties || [];
      for ( var i = 0 ; i < ownProps.length ; i++ ) {
        var p = ownProps[i];
        var name = typeof p === 'string' ? p : p.name;
        if ( name ) propNames[name] = true;
      }

      for ( var k = 0 ; k < columnKeys.length ; k++ ) {
        var key = columnKeys[k];
        var columns = m[key];
        if ( ! columns || ! Array.isArray(columns) ) continue;

        for ( var i = 0 ; i < columns.length ; i++ ) {
          var col = columns[i];
          if ( typeof col !== 'string' ) continue;
          // Column names can have dot paths (e.g., 'owner.name') — validate the first segment
          var baseName = col.split('.')[0];
          if ( ! propNames[baseName] ) {
            var loc = this.findInText_(text, null, col, modelOffset);
            if ( loc !== null ) {
              this.addDiag_(diagnostics, text, loc, col.length, 2,
                "Property '" + col + "' does not exist on " + classId);
            }
          }
        }
      }
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
      diagnostics.push({
        range: {
          start: pos,
          end: { line: pos.line, character: pos.character + length }
        },
        severity: severity,
        message: message,
        source: 'foam-lsp'
      });
    }
  ]
});
