/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp',
  name: 'FileModelCache',

  documentation: 'Eval-intercept cache for FOAM model files. Captures foam.CLASS/ENUM/INTERFACE objects directly by executing the file with overridden foam.CLASS.',

  requires: [
    'foam.parse.lsp.CursorAnalyzer',
    'foam.parse.lsp.FileClassifier'
  ],

  properties: [
    {
      name: 'cache_',
      factory: function() { return {}; }
    },
    {
      name: 'analyzer_',
      factory: function() { return this.CursorAnalyzer.create(); }
    },
    {
      name: 'classifier_',
      documentation: `Supplies the significant-foam-call scan that sourceLine_
        is read from. Its own instance rather than the server's: the two share
        no cached answer, only the scan.`,
      factory: function() { return this.FileClassifier.create(); }
    }
  ],

  methods: [
    function getModels(uri, text) {
      /** Returns cached model objects for a file, or parses fresh. */
      if ( this.cache_[uri] && this.cache_[uri].text === text ) {
        return this.cache_[uri].models;
      }
      var models = this.parseFileModels(text);
      this.cache_[uri] = { text: text, models: models };
      return models;
    },

    function getModelAt(uri, text, line) {
      /**
       * Returns the model whose source range contains the given line.
       * Uses sourceLine_ (set from the significant-call scan) to find the last model
       * that starts at or before the given line. Essential for multi-class
       * files where we need to know which model the cursor is inside.
       */
      var models = this.getModels(uri, text);
      if ( models.length === 0 ) return null;
      if ( models.length === 1 ) return models[0];
      var best = models[0];
      for ( var i = 1 ; i < models.length ; i++ ) {
        if ( models[i].sourceLine_ !== undefined && models[i].sourceLine_ <= line ) {
          best = models[i];
        }
      }
      return best;
    },

    function invalidate(uri) {
      delete this.cache_[uri];
    },

    function invalidateAll() {
      this.cache_ = {};
    },

    function parseRequiresEntry(entry) {
      /**
       * Parse a requires entry into { classId, alias }.
       * Handles both plain strings and 'as' alias syntax:
       *   'foam.u2.DetailView'           → { classId: 'foam.u2.DetailView', alias: 'DetailView' }
       *   'foam.lib.csv.CSVParser as FP' → { classId: 'foam.lib.csv.CSVParser', alias: 'FP' }
       *   { path: 'foam.u2.Element' }    → { classId: 'foam.u2.Element', alias: 'Element' }
       */
      var raw = typeof entry === 'string' ? entry : (entry && entry.path ? entry.path : null);
      if ( ! raw ) return null;
      var parts = raw.split(/\s+as\s+/);
      var classId = parts[0].trim();
      var alias = parts.length > 1 ? parts[1].trim() : classId.split('.').pop();
      return { classId: classId, alias: alias };
    },

    function buildRequiresMap(model) {
      /** Build { alias: fullClassId } from model.requires, handling 'as' aliases. */
      var map = {};
      var requires = model ? model.requires || [] : [];
      for ( var i = 0 ; i < requires.length ; i++ ) {
        var parsed = this.parseRequiresEntry(requires[i]);
        if ( parsed ) map[parsed.alias] = parsed.classId;
      }
      return map;
    },

    function getClassId(model) {
      /**
       * Return the full class ID for a model object.
       * For refinements, uses m.refines (the target being refined).
       * For foam.LIB, the ID is m.name directly (e.g., 'foam.Color').
       * Otherwise joins package + name (or just name if no package).
       * Handlers used to inline this expression 10+ times — use this helper.
       */
      if ( ! model ) return null;
      if ( model.type_ === 'LIB' ) return model.name;
      if ( model.refines ) return model.refines;
      return model.package ? model.package + '.' + model.name : model.name;
    },

    function getClassIdAt(uri, text, line) {
      /** Convenience: getModelAt(..) then getClassId(..) — returns null if no model. */
      return this.getClassId(this.getModelAt(uri || '', text, line));
    },

    function resolveRequiresMap(uri, text, opt_line) {
      /**
       * Single source of truth for requires → { alias: classId } resolution.
       * Prefers the eval-captured model. When the file fails to eval
       * (mid-edit SyntaxError, broken body), falls back to the analyzer's
       * text-regex parse so completion/hover keep working while the user
       * types. A grammar-driven axiom extractor will replace the regex
       * fallback in a future pass; until then, this is the single
       * fallback site.
       */
      var model = this.getModelAt(uri || '', text, opt_line == null ? 0 : opt_line);
      if ( model ) return this.buildRequiresMap(model);
      return this.analyzer_.parseRequires(text);
    },

    function resolveShortName(uri, text, name, opt_line) {
      /**
       * Resolve a short class name (`DetailView`) to a full class id
       * (`foam.u2.DetailView`). Reads the eval-captured model's requires axiom
       * when available; otherwise falls back to text-regex via analyzer_
       * (mid-edit safety net — see resolveRequiresMap comment).
       */
      var map = this.resolveRequiresMap(uri, text, opt_line);
      return map[name] || null;
    },

    function resolveClassIdFromText(text) {
      /**
       * Mid-edit fallback: extract the file's class id (`package.name`) by
       * regex when no model is available. Used by handlers that need to
       * stay useful while the user types broken code. Routes through the
       * analyzer so the single tactical surface lives in CursorAnalyzer.
       */
      return this.analyzer_.resolveClassId(text);
    },

    function resolveImports(uri, text, opt_line) {
      /** Imports as a flat name array. Mid-edit fallback via analyzer when no model. */
      var model = this.getModelAt(uri || '', text, opt_line == null ? 0 : opt_line);
      if ( model ) {
        var out = [];
        var imports = model.imports || [];
        for ( var i = 0 ; i < imports.length ; i++ ) {
          var imp = imports[i];
          var name = typeof imp === 'string' ? imp : imp.name;
          out.push(name.replace(/\?$/, ''));
        }
        return out;
      }
      return this.analyzer_.parseImports(text);
    },

    function parseFileModels(text) {
      /**
       * Execute file text with overridden foam.<X>(...) calls to capture
       * model objects. Same pattern as ModelFileDAO.js:47-108.
       *
       * Generic on purpose: any uppercase foam call (foam.CLASS, foam.ENUM,
       * foam.FSM, future extensions) is captured. Specials with non-class
       * bodies (POM, SCRIPT) are no-ops; LIB and RELATIONSHIP have custom
       * shape handling. Everything else routes through `captureGeneric`.
       *
       * Returns array of raw model JS objects with all fields:
       * { package, name, extends, implements, requires, imports, exports,
       *   properties, methods, javaImports, javaCode, refines, type_, ... }
       */
      var models = [];
      var modelCount = 0;

      // Where each model starts, taken from the significant-call scan — calls
      // written inside comments and string literals are not in it. Counting
      // raw foam.<X>( matches instead put every model after a doc comment
      // that mentions foam.CLASS( onto the comment's line.
      var calls      = this.classifier_.significantCalls(text);
      var classLines = [];
      var libLines   = [];
      for ( var ci = 0 ; ci < calls.length ; ci++ ) {
        var callName = calls[ci].name;
        // POM and SCRIPT never enter `models` (their overrides are no-ops) and
        // LIB is counted separately, so neither may shift the class index.
        if ( callName === 'LIB' ) libLines.push(calls[ci].line);
        else if ( callName !== 'POM' && callName !== 'SCRIPT' ) classLines.push(calls[ci].line);
      }

      var captureClass = function(m) {
        m.sourceLine_ = classLines[modelCount] || 0;
        m.type_ = m.type_ || 'CLASS';
        models.push(m);
        modelCount++;
      };

      // Generic capturer for any foam.<TYPE>(model). Sets type_ from the call
      // name (FSM → 'FSM') and a best-effort default `class` axiom so the
      // FOAM JSON serializer can still round-trip the captured model.
      var captureGeneric = function(typeName) {
        return function(m) {
          if ( ! m ) return;
          m.type_ = typeName;
          if ( ! m.class ) {
            m.class = 'foam.lang.' + typeName.charAt(0)
              + typeName.slice(1).toLowerCase() + 'Model';
          }
          captureClass(m);
        };
      };

      var overrides = {
        CLASS: captureClass,
        ENUM: captureGeneric('ENUM'),
        INTERFACE: captureGeneric('INTERFACE'),
        RELATIONSHIP: function(r) {
          if ( ! r ) return;
          r.class = r.class || 'foam.dao.Relationship';
          r.type_ = 'RELATIONSHIP';
          if ( ! r.name && r.sourceModel ) {
            var s = r.sourceModel;
            var t = r.targetModel || '';
            r.package = r.package || s.substring(0, s.lastIndexOf('.'));
            r.name = s.split('.').pop() + t.split('.').pop() + 'Relationship';
          }
          captureClass(r);
        },
        SCRIPT: function() {},
        POM:    function() {},
        LIB:    function(m) {
          if ( ! m || ! m.name ) return;
          m.type_ = 'LIB';
          var libIndex = 0;
          for ( var li = 0 ; li < models.length ; li++ ) {
            if ( models[li].type_ === 'LIB' ) libIndex++;
          }
          m.sourceLine_ = libLines[libIndex] || 0;
          models.push(m);
        }
      };

      // Proxy intercepts every foam.<X> read inside the eval'd text so unknown
      // uppercase types (foam.FSM and any future extension) get a generic
      // capturer instead of falling through to the real foam[<X>] (which
      // would actually register the class for real — bad side-effect).
      var foamProxy = new Proxy(Object.create(foam), {
        get: function(target, prop) {
          if ( typeof prop === 'string' && Object.prototype.hasOwnProperty.call(overrides, prop) ) {
            return overrides[prop];
          }
          if ( typeof prop === 'string' && /^[A-Z][A-Z0-9_]*$/.test(prop) ) {
            return captureGeneric(prop);
          }
          return target[prop];
        }
      });
      var context = { foam: foamProxy };

      try {
        with ( context ) { eval(text); }
      } catch (e) {
        // SyntaxError prevents ALL execution — JS parses before running.
        // Fall back to extracting individual foam.<X>(...) blocks and eval each.
        if ( e instanceof SyntaxError && models.length === 0 ) {
          modelCount = 0;
          this.evalIndividualBlocks_(text, context, models);
        }
        // RuntimeError after some models captured — partial results are fine
      }

      return models;
    },

    function evalIndividualBlocks_(text, context, models) {
      /**
       * Fallback for SyntaxError: extract individual foam.<X>(...) blocks
       * using bracket matching and eval each separately. Generic on the call
       * name so foam.FSM/foam.RELATIONSHIP/etc. all participate.
       */
      var regex = /foam\.[A-Z][A-Z0-9_]*\s*\(/g;
      var match;
      while ( ( match = regex.exec(text) ) !== null ) {
        var start = match.index;
        var depth = 0;
        var end = -1;
        for ( var i = start + match[0].length ; i < text.length ; i++ ) {
          var ch = text[i];
          if ( ch === '(' || ch === '{' || ch === '[' ) depth++;
          else if ( ch === ')' || ch === '}' || ch === ']' ) {
            if ( depth === 0 ) { end = i + 1; break; }
            depth--;
          }
          // Skip strings
          else if ( ch === "'" || ch === '"' || ch === '`' ) {
            var q = ch;
            for ( i++ ; i < text.length ; i++ ) {
              if ( text[i] === '\\' ) { i++; continue; }
              if ( text[i] === q ) break;
            }
          }
        }
        if ( end === -1 ) continue;
        var block = text.substring(start, end);
        try {
          with ( context ) { eval(block); }
        } catch (e2) {
          // This block is incomplete/broken — skip it
        }
      }
    }
  ]
});

