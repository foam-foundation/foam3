/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'DefinitionHandler',

  requires: [
    'foam.parse.lsp.FoamIndex',
    'foam.parse.lsp.FileModelCache',
    'foam.parse.lsp.CursorAnalyzer'
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
    }
  ],

  methods: [
    function handle(text, position, opt_uri) {
      var uri = opt_uri || '';

      // POM ↔ class jumps. In a pom.js file, go-to-def on a file-entry
      // name navigates to the class file. In a class file, go-to-def on
      // the class's own `name:` value navigates to its POM entry.
      if ( this.isPomFile_(uri) ) {
        var pomJump = this.handlePomToClass_(text, position, uri);
        if ( pomJump ) return pomJump;
        return null;
      }

      var classToPomJump = this.handleClassToPom_(text, position, uri);
      if ( classToPomJump ) return classToPomJump;

      if ( ! this.analyzer.isFoamFile(text) ) return null;

      var word = this.analyzer.getDottedWordAtPosition(text, position);
      if ( ! word ) return null;

      // Java block: resolve type names and methods via javaImports + registry
      var blockCtx = this.analyzer.getBacktickBlockContext(text, position);
      if ( blockCtx && blockCtx.blockKey !== 'css' ) {
        var result = this.handleJavaDefinition_(text, position, word, uri);
        if ( result ) return result;
      }

      // Try as full class ID
      var filePath = this.index.getFilePath(word);
      if ( filePath ) return this.buildLocation(filePath, word);

      // foam.LIB: handle 'foam.Color.adjustAlpha' and 'foam.Color'
      // Runs after class lookup so class IDs that share a name with a LIB
      // refinement (e.g., foam.lang.FObject has both) resolve to the class.
      var libLoc = this.resolveLibReference_(text, position, word);
      if ( libLoc ) return libLoc;

      // Try as short property type name → resolve to full ID → get file
      var propTypes = this.index.getPropertyTypes();
      for ( var i = 0 ; i < propTypes.length ; i++ ) {
        if ( propTypes[i].name === word ) {
          filePath = this.index.getFilePath(propTypes[i].id);
          if ( filePath ) return this.buildLocation(filePath, propTypes[i].id);
          break;
        }
      }

      // Try as method/property on current class — navigate to the defining class
      var segment = this.analyzer.getSegmentAtPosition(text, position);
      if ( segment ) {
        var model = this.cache.getModelAt(uri, text, position.line);
        var classId = this.cache.getClassId(model);

        // If the dotted word is a chain (this.a.b.c), walk each intermediate
        // segment through its FObjectProperty/Reference/Enum `of:` class.
        // Only do this when the final segment truly is the cursor's segment —
        // otherwise skip the chain walk and fall through to the normal path.
        if ( classId && word && word.indexOf('.') !== -1 ) {
          var parts = word.split('.');
          if ( parts[parts.length - 1] === segment && parts.length >= 3 ) {
            var walkClassId = classId;
            if ( parts[0] === 'this' ) {
              for ( var p = 1 ; p < parts.length - 1 && walkClassId ; p++ ) {
                walkClassId = this.index.resolvePropertyTypeClassId(walkClassId, parts[p]);
              }
              if ( walkClassId && walkClassId !== classId ) {
                var chainLoc = this.resolveMemberOnClass_(walkClassId, segment);
                if ( chainLoc ) return chainLoc;
              }
            }
          }
        }

        if ( classId ) {
          var cls = this.index.getClass(classId);
          if ( cls ) {
            // Check if it's a FOAM method
            var methods = cls.getAxiomsByClass(foam.lang.Method);
            for ( var i = 0 ; i < methods.length ; i++ ) {
              if ( methods[i].name === segment ) {
                var defClass = this.findMethodDefiner_(cls, segment);
                if ( defClass ) {
                  filePath = this.index.getFilePath(defClass);
                  if ( filePath ) return this.buildLocationAtMethod(filePath, defClass, segment);
                }
              }
            }
            // Check if it's a Java-only method (not in FOAM axioms)
            var javaMethods = this.index.getJavaMethods(classId);
            for ( var i = 0 ; i < javaMethods.length ; i++ ) {
              if ( javaMethods[i].name === segment ) {
                var javaLoc = this.findJavaMethodLocation_(classId, segment);
                if ( javaLoc ) return javaLoc;
              }
            }
            // Check if it's a property
            var prop = cls.getAxiomByName(segment);
            if ( prop && foam.lang.Property.isInstance(prop) ) {
              var defClass = this.findPropertyDefiner_(cls, segment);
              if ( defClass ) {
                filePath = this.index.getFilePath(defClass);
                if ( filePath ) return this.buildLocationAtProperty(filePath, segment);
              }
            }
            // Check if it's a message axiom — `this.LABEL_X`
            var msg = this.index.findMessage(classId, segment);
            if ( msg && msg.definerId ) {
              filePath = this.index.getFilePath(msg.definerId);
              if ( filePath ) return this.buildLocationAtMessage_(filePath, segment);
            }
          }
        }

        // Try as short name from requires (via the captured model — no regex).
        var resolved = this.cache.resolveShortName(uri, text, segment, position.line);
        if ( resolved ) {
          filePath = this.index.getFilePath(resolved);
          if ( filePath ) return this.buildLocation(filePath, resolved);
        }
      }

      return null;
    },

    function isPomFile_(uri) {
      return /\bpom\.js$/.test(uri || '');
    },

    function handlePomToClass_(text, position, uri) {
      // Cursor inside a pom.js — if it lands on `name: 'X'` jump to X.js.
      var lines  = text.split('\n');
      var line   = lines[position.line] || '';
      // Match `name: 'foo'` or `name: "foo"` (FOAM POM convention).
      var nameRe = /\bname\s*:\s*(['"])([^'"]+)\1/g;
      var m;
      while ( ( m = nameRe.exec(line) ) !== null ) {
        var valStart = m.index + m[0].lastIndexOf(m[2]);
        var valEnd   = valStart + m[2].length;
        if ( position.character >= valStart && position.character <= valEnd ) {
          var pomPath  = uri.indexOf('file://') === 0 ? decodeURIComponent(uri.slice(7)) : uri;
          var classId  = this.index.getClassForPomEntry(pomPath, m[2]);
          if ( classId ) {
            var filePath = this.index.getFilePath(classId);
            if ( filePath ) return this.buildLocation(filePath, classId);
          }
          // Fall back to opening the .js file even without a registered class.
          var path_    = require('path');
          var jsPath   = path_.resolve(path_.dirname(pomPath), m[2] + '.js');
          var fs_      = require('fs');
          if ( fs_.existsSync(jsPath) ) {
            return { uri: 'file://' + jsPath, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } };
          }
          return null;
        }
      }
      return null;
    },

    function handleClassToPom_(text, position, uri) {
      // Cursor inside a class file — if it lands on the class's own
      // `name: 'X'` axiom value, jump to the POM entry that registers it.
      var lines = text.split('\n');
      var line  = lines[position.line] || '';
      var nameRe = /\bname\s*:\s*(['"])([^'"]+)\1/g;
      var m;
      while ( ( m = nameRe.exec(line) ) !== null ) {
        var valStart = m.index + m[0].lastIndexOf(m[2]);
        var valEnd   = valStart + m[2].length;
        if ( position.character >= valStart && position.character <= valEnd ) {
          var model = this.cache.getModelAt(uri, text, position.line);
          if ( ! model ) return null;
          var ownClassId = this.cache.getClassId(model);
          if ( ! ownClassId ) return null;
          // Only fire when the cursor matched THIS class's name axiom, not a
          // nested property's name string.
          if ( model.name !== m[2] ) return null;
          var loc = this.index.getPomLocationForClass(ownClassId);
          if ( ! loc ) return null;
          return {
            uri: 'file://' + loc.pomFile,
            range: {
              start: { line: loc.line, character: loc.character },
              end:   { line: loc.line, character: loc.character + m[2].length }
            }
          };
        }
      }
      return null;
    },

    function resolveLibReference_(text, position, word) {
      /**
       * Jump to foam.X or foam.X.Y where foam.X was registered via foam.LIB.
       * Supports cursor on any segment — resolves the longest LIB prefix
       * of `word` and uses the remaining tail as a method/constant name.
       */
      if ( ! word || word.indexOf('.') === -1 ) return null;
      var parts = word.split('.');

      // Find the longest LIB-registered prefix, e.g. 'foam.animation.Interp'
      // for word 'foam.animation.Interp.linear'.
      var libName = null;
      for ( var k = parts.length ; k >= 2 ; k-- ) {
        var candidate = parts.slice(0, k).join('.');
        if ( this.index.getLibEntry(candidate) ) { libName = candidate; break; }
      }
      if ( ! libName ) return null;

      var entry = this.index.getLibEntry(libName);
      var tail = word.substring(libName.length + 1);  // '' if cursor on lib name

      // Determine the segment under the cursor.
      var segment = this.analyzer.getSegmentAtPosition(text, position);

      // Cursor on the LIB name itself → jump to the foam.LIB declaration line.
      if ( ! tail || libName.split('.').indexOf(segment) !== -1 ) {
        return {
          uri: 'file://' + entry.path,
          range: {
            start: { line: entry.line || 0, character: 0 },
            end:   { line: entry.line || 0, character: 0 }
          }
        };
      }

      // Cursor on a member name (possibly deeper than one hop — take the first
      // tail segment; nested member resolution isn't modeled by foam.LIB).
      var memberName = tail.split('.')[0];
      if ( segment && segment !== memberName ) {
        // Cursor is deeper in the chain — ignore, fall through to other handlers.
        return null;
      }
      // Only claim this word when the tail is a real LIB member — otherwise
      // fall through so the word can be resolved as e.g. a full class ID.
      var isMethod = (entry.methods || []).indexOf(memberName) !== -1;
      var isConst  = (entry.constants || []).indexOf(memberName) !== -1;
      if ( ! isMethod && ! isConst ) return null;
      return this.locateLibMember_(entry, memberName);
    },

    function locateLibMember_(entry, memberName) {
      /**
       * Find the line of `memberName` inside a foam.LIB block's file.
       * Looks for `function name(...)` or `{ name: 'name' …}` within the
       * block starting at entry.line. Falls back to the block start.
       */
      try {
        var fs_ = require('fs');
        var content = fs_.readFileSync(entry.path, 'utf8');
        var lines = content.split('\n');
        var fnRe = new RegExp('function\\s+' + memberName + '\\s*\\(');
        var nameRe = new RegExp("name\\s*:\\s*['\"]" + memberName + "['\"]");
        var endLine = lines.length;
        // Limit the search to after the LIB call starts — best-effort end.
        for ( var ln = (entry.line || 0) ; ln < endLine ; ln++ ) {
          var l = lines[ln];
          if ( fnRe.test(l) || nameRe.test(l) ) {
            return {
              uri: 'file://' + entry.path,
              range: {
                start: { line: ln, character: 0 },
                end:   { line: ln, character: 0 }
              }
            };
          }
        }
      } catch ( e ) {}
      return {
        uri: 'file://' + entry.path,
        range: {
          start: { line: entry.line || 0, character: 0 },
          end:   { line: entry.line || 0, character: 0 }
        }
      };
    },

    function resolveMemberOnClass_(classId, name) {
      /**
       * Resolve a method/property/message `name` on `classId` to a Location.
       * Returns null if not found. Used by the property-chain walk so
       * `this.country.capital.name` navigates into Capital.name and not
       * the current model.
       */
      var cls = this.index.getClass(classId);
      if ( ! cls ) return null;

      var methods = cls.getAxiomsByClass(foam.lang.Method);
      for ( var i = 0 ; i < methods.length ; i++ ) {
        if ( methods[i].name === name ) {
          var defClass = this.findMethodDefiner_(cls, name);
          if ( defClass ) {
            var filePath = this.index.getFilePath(defClass);
            if ( filePath ) return this.buildLocationAtMethod(filePath, defClass, name);
          }
        }
      }

      var javaMethods = this.index.getJavaMethods(classId);
      for ( var i = 0 ; i < javaMethods.length ; i++ ) {
        if ( javaMethods[i].name === name ) {
          var javaLoc = this.findJavaMethodLocation_(classId, name);
          if ( javaLoc ) return javaLoc;
        }
      }

      var prop = cls.getAxiomByName(name);
      if ( prop && foam.lang.Property.isInstance(prop) ) {
        var defClass = this.findPropertyDefiner_(cls, name);
        if ( defClass ) {
          var filePath = this.index.getFilePath(defClass);
          if ( filePath ) return this.buildLocationAtProperty(filePath, name);
        }
      }

      var msg = this.index.findMessage(classId, name);
      if ( msg && msg.definerId ) {
        var filePath = this.index.getFilePath(msg.definerId);
        if ( filePath ) return this.buildLocationAtMessage_(filePath, name);
      }

      return null;
    },

    function findMethodDefiner_(cls, methodName) {
      /** Walk the class hierarchy to find which class defines the method. */
      var seen = {};
      while ( cls && ! seen[cls.id] ) {
        seen[cls.id] = true;
        var own = cls.getOwnAxiomsByClass(foam.lang.Method);
        for ( var i = 0 ; i < own.length ; i++ ) {
          if ( own[i].name === methodName ) return cls.id;
        }
        cls = cls.model_.extends ? this.index.getClass(cls.model_.extends) : null;
      }
      return null;
    },

    function findPropertyDefiner_(cls, propName) {
      /** Walk the class hierarchy to find which class defines the property. */
      var seen = {};
      while ( cls && ! seen[cls.id] ) {
        seen[cls.id] = true;
        var own = cls.getOwnAxiomsByClass(foam.lang.Property);
        for ( var i = 0 ; i < own.length ; i++ ) {
          if ( own[i].name === propName ) return cls.id;
        }
        cls = cls.model_.extends ? this.index.getClass(cls.model_.extends) : null;
      }
      return null;
    },

    function buildLocationAtMethod(filePath, classId, methodName) {
      /**
       * Jump to a method definition within the correct class in the file.
       * Pure grammar-based: relies on `kind: 'method'` positions emitted
       * by `methodNameValue` in FoamClassGrammar.
       *
       * Resolution order:
       *   1. Grammar map constrained to the requested class's source range.
       *      Wins when the file has multiple class blocks.
       *   2. Unconstrained grammar map — for single-class files or when
       *      parseFileModels didn't capture the class section under the
       *      expected classId (refines, generic foam.<X> calls).
       *
       * If both miss, that means the grammar didn't emit a method
       * position — a grammar bug to fix in FoamClassGrammar.js, not
       * something to paper over with a regex here.
       */
      try {
        var fs_ = require('fs');
        var content = fs_.readFileSync(filePath, 'utf8');

        var models = this.cache.parseFileModels(content);
        var startLine = 0;
        var endLine = content.split('\n').length;
        for ( var i = 0 ; i < models.length ; i++ ) {
          var m = models[i];
          var id = this.cache.getClassId(m);
          if ( id === classId ) {
            startLine = m.sourceLine_ || 0;
            endLine = (i + 1 < models.length && models[i + 1].sourceLine_) ? models[i + 1].sourceLine_ : endLine;
            break;
          }
        }

        var map = this.grammar_().collectAxiomPositions(content);
        var positions = map && map.method ? map.method : null;
        var hit = positions ? positions[methodName] : null;
        if ( hit && hit.line >= startLine && hit.line < endLine ) {
          return this.buildMethodPosLocation_(filePath, hit, methodName);
        }
        if ( hit ) {
          return this.buildMethodPosLocation_(filePath, hit, methodName);
        }
      } catch ( e ) {}
      return this.buildLocation(filePath, classId);
    },

    function buildMethodPosLocation_(filePath, pos, methodName) {
      return {
        uri: 'file://' + filePath,
        range: {
          start: { line: pos.line, character: pos.col || 0 },
          end:   { line: pos.line, character: (pos.col || 0) + methodName.length }
        }
      };
    },

    function buildLocationAtMessage_(filePath, msgName) {
      /**
       * Jump to the `{ name: 'msgName', … }` entry inside messages:[…].
       * Grammar-only: FoamClassGrammar emits a `{kind: 'message'}` msg on
       * every parsed message name. If the grammar can't see a message
       * (rare; file earlier in the body breaks parse), we return a
       * file-top location so the user still lands in the right file and
       * we learn the grammar needs more recovery rules — not a regex
       * fallback that hides the breakage.
       */
      try {
        var fs_ = require('fs');
        var content = fs_.readFileSync(filePath, 'utf8');
        var pos = this.grammar_().findAxiomPosition(content, 'message', msgName);
        if ( pos ) {
          return {
            uri: 'file://' + filePath,
            range: {
              start: { line: pos.line, character: pos.col },
              end:   { line: pos.line, character: pos.col + msgName.length }
            }
          };
        }
      } catch ( e ) {}
      return this.buildLocation(filePath);
    },

    function grammar_() {
      /** Lazy grammar reused for axiom-position lookups on arbitrary files. */
      if ( ! this.grammarInstance_ ) {
        this.grammarInstance_ = foam.parse.lsp.FoamClassGrammar.create({ index: this.index });
      }
      return this.grammarInstance_;
    },

    function buildLocationAtProperty(filePath, propName) {
      /**
       * Jump to a property definition within a file. Uses the grammar's
       * axiom-position index (`kind: 'property'` emitted by `propertyNameValue`
       * in FoamClassGrammar) so the lookup respects multi-class files and
       * matches how messages are located.
       *
       * Pure grammar-based: trusts `propertyNameValue` in
       * FoamClassGrammar.js to emit position info for every property
       * declaration. If a property isn't being found, the grammar rule
       * needs a missing case — fix it there, not with a regex here.
       */
      try {
        var fs_ = require('fs');
        var content = fs_.readFileSync(filePath, 'utf8');
        var pos = this.grammar_().findAxiomPosition(content, 'property', propName);
        if ( pos ) {
          return {
            uri: 'file://' + filePath,
            range: {
              start: { line: pos.line, character: pos.col },
              end:   { line: pos.line, character: pos.col + propName.length }
            }
          };
        }
      } catch ( e ) {}
      return this.buildLocation(filePath);
    },

    function handleJavaDefinition_(text, position, word, opt_uri) {
      /**
       * Go-to-definition inside Java code blocks.
       * Resolves: type names (Country → foam.core.auth.Country),
       * variable.method() chains, getters/setters, x.get().
       */
      var model = this.cache.getModelAt(opt_uri || '', text, position.line);
      var segment = this.analyzer.getSegmentAtPosition(text, position);
      if ( ! segment ) return null;

      // 1. Try as a Java type name → resolve via javaImports + registry
      var typeClassId = this.analyzer.resolveJavaTypeName(segment, model, this.index);
      if ( typeClassId ) {
        var filePath = this.index.getFilePath(typeClassId);
        if ( filePath ) return this.buildLocation(filePath, typeClassId);
      }

      // 2. variable.method() — resolve variable type, then find method
      //    definition. CRITICAL: when the click is a chained call
      //    (`<recv>.<seg>` with a non-`this` receiver), this branch is
      //    AUTHORITATIVE — we never fall through to step 3 because step 3
      //    would search the *current* class (e.g., the enclosing FSM)
      //    and silently land on the wrong file. Better to return null
      //    (no navigation) than to navigate to an unrelated symbol.
      if ( word && word.indexOf('.') !== -1 ) {
        var parts = word.split('.');
        var varName = parts[parts.length - 2];
        var methodName = parts[parts.length - 1];

        if ( varName !== 'this' ) {
          var varClassId = this.analyzer.resolveJavaVariableType(text, position, varName, model, this.index);
          if ( ! varClassId ) {
            varClassId = this.analyzer.resolveJavaTypeName(varName, model, this.index);
          }
          if ( varClassId ) {
            var gsMatch = methodName.match(/^(get|set)([A-Z]\w*)$/);
            if ( gsMatch ) {
              var propName = gsMatch[2].charAt(0).toLowerCase() + gsMatch[2].substring(1);
              var cls = this.index.getClass(varClassId);
              if ( cls ) {
                var defClass = this.findPropertyDefiner_(cls, propName);
                if ( defClass ) {
                  var filePath = this.index.getFilePath(defClass);
                  if ( filePath ) return this.buildLocationAtProperty(filePath, propName);
                }
              }
            }

            var cls2 = this.index.getClass(varClassId);
            if ( cls2 ) {
              var mDefClass = this.findMethodDefiner_(cls2, methodName);
              if ( mDefClass ) {
                var mFilePath = this.index.getFilePath(mDefClass);
                if ( mFilePath ) return this.buildLocationAtMethod(mFilePath, mDefClass, methodName);
              }
            }

            var javaLoc = this.findJavaMethodLocation_(varClassId, methodName);
            if ( javaLoc ) return javaLoc;
          }
          // Authoritative: a chained-call click never falls through to
          // step 3 (current-model search). The receiver is what
          // determines the target — even if we can't resolve it, the
          // current model is almost certainly NOT the answer.
          return null;
        }
      }

      // 3. Standalone method name (e.g., getProperty on current model)
      //    Only reached for non-chained clicks or `this.method` clicks.
      var currentClassId = this.cache.getClassId(model);
      if ( currentClassId ) {
        var javaLoc = this.findJavaMethodLocation_(currentClassId, segment);
        if ( javaLoc ) return javaLoc;
      }

      return null;
    },

    function findJavaMethodLocation_(classId, methodName) {
      /**
       * Find a Java-only method's location in the .java file.
       * Walks the inheritance chain. Uses JavaParser (FOAM grammar-based)
       * for accurate line numbers via getJavaMethods.
       */
      var fs_ = require('fs');
      var chain = this.index.getInheritanceChain(classId);
      for ( var c = 0 ; c < chain.length ; c++ ) {
        var methods = this.index.getJavaMethods(chain[c]);
        for ( var i = 0 ; i < methods.length ; i++ ) {
          if ( methods[i].name === methodName ) {
            var entry = this.index.fileIndex_[chain[c]];
            var jsPath = typeof entry === 'string' ? entry : entry.path;
            var javaPath = jsPath.replace(/\.js$/, '.java');
            return {
              uri: 'file://' + javaPath,
              range: {
                start: { line: methods[i].line || 0, character: 0 },
                end:   { line: methods[i].line || 0, character: 0 }
              }
            };
          }
        }
      }
      return null;
    },

    function buildLocation(filePath, opt_classId) {
      var line = 0;
      if ( opt_classId ) {
        try {
          var fs_ = require('fs');
          var content = fs_.readFileSync(filePath, 'utf8');
          var models = this.cache.parseFileModels(content);
          for ( var i = 0 ; i < models.length ; i++ ) {
            var m = models[i];
            var id = this.cache.getClassId(m);
            if ( id === opt_classId && m.sourceLine_ ) { line = m.sourceLine_; break; }
          }
        } catch (e) {}
      }
      return {
        uri: 'file://' + filePath,
        range: {
          start: { line: line, character: 0 },
          end: { line: line, character: 0 }
        }
      };
    }
  ]
});
