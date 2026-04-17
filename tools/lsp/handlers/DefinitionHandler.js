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
      if ( ! this.analyzer.isFoamFile(text) ) return null;
      var uri = opt_uri || '';

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

        // Try as short name from requires
        var resolved = this.analyzer.resolveShortName(text, segment);
        if ( resolved ) {
          filePath = this.index.getFilePath(resolved);
          if ( filePath ) return this.buildLocation(filePath, resolved);
        }
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
       * Uses FileModelCache to find the class's source range, then searches
       * only within that range — avoids matching refinement methods.
       */
      try {
        var fs_ = require('fs');
        var content = fs_.readFileSync(filePath, 'utf8');

        // Find the correct model's source range
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

        // Search for the method only within the model's range
        var lines = content.split('\n');
        var regex = new RegExp('function\\s+' + methodName + '\\s*\\(');
        for ( var ln = startLine ; ln < endLine ; ln++ ) {
          if ( regex.test(lines[ln]) ) {
            return { uri: 'file://' + filePath, range: { start: { line: ln, character: 0 }, end: { line: ln, character: 0 } } };
          }
        }
      } catch (e) {}
      return this.buildLocation(filePath, classId);
    },

    function buildLocationAtMessage_(filePath, msgName) {
      /**
       * Jump to the `{ name: 'msgName', … }` entry inside messages:[…].
       * Tries grammar-indexed position first (FoamClassGrammar emits a
       * `{kind: 'message'}` msg on every parsed message name — zero
       * ambiguity, container-aware). If the grammar bails before reaching
       * the messages block (pathological earlier constructs), falls back
       * to the name-regex to keep go-to-def working.
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

        // Grammar didn't see this message — regex fallback scoped to the
        // messages: [...] block so we don't pick up stray name: '…' entries.
        var mb = this.findMessagesBlock_(content);
        if ( mb ) {
          var esc = msgName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          var re = new RegExp("name\\s*:\\s*['\"]" + esc + "['\"]");
          var slice = content.substring(mb.start, mb.end);
          var m = re.exec(slice);
          if ( m ) {
            var absIdx = mb.start + m.index;
            var line = 0, col = 0;
            for ( var i = 0 ; i < absIdx ; i++ ) {
              if ( content[i] === '\n' ) { line++; col = 0; } else col++;
            }
            return {
              uri: 'file://' + filePath,
              range: {
                start: { line: line, character: col },
                end:   { line: line, character: col + m[0].length }
              }
            };
          }
        }
      } catch ( e ) {}
      return this.buildLocation(filePath);
    },

    function findMessagesBlock_(content) {
      /**
       * Locate the `messages: [ … ]` block by scanning for the key at code
       * scope (strings/comments skipped) and balance-matching its closing `]`.
       * Returns `{start, end}` absolute offsets into content, or null.
       */
      var key = 'messages';
      var n = content.length;
      var i = 0;
      while ( i < n ) {
        // Skip strings/comments
        var c = content[i];
        if ( c === "'" || c === '"' || c === '`' ) {
          var q = c; i++;
          while ( i < n && content[i] !== q ) { if ( content[i] === '\\' ) i++; i++; }
          i++;
          continue;
        }
        if ( c === '/' && content[i + 1] === '/' ) {
          while ( i < n && content[i] !== '\n' ) i++;
          continue;
        }
        if ( c === '/' && content[i + 1] === '*' ) {
          i += 2;
          while ( i < n - 1 && ! ( content[i] === '*' && content[i + 1] === '/' ) ) i++;
          i += 2;
          continue;
        }
        // Word-boundary key match
        if ( content.substr(i, key.length) === key ) {
          var prev = i > 0 ? content.charCodeAt(i - 1) : 0;
          var isWord = function(c) {
            return (c >= 48 && c <= 57) || (c >= 65 && c <= 90) ||
                   (c >= 97 && c <= 122) || c === 95 || c === 36;
          };
          if ( ! isWord(prev) ) {
            var after = i + key.length;
            if ( ! isWord(content.charCodeAt(after)) ) {
              // Expect `:` then `[`
              var p = after;
              while ( p < n && /\s/.test(content[p]) ) p++;
              if ( content[p] === ':' ) {
                p++;
                while ( p < n && /\s/.test(content[p]) ) p++;
                if ( content[p] === '[' ) {
                  var start = p + 1;
                  var depth = 1;
                  var k = start;
                  while ( k < n && depth > 0 ) {
                    var ch = content[k];
                    if ( ch === "'" || ch === '"' || ch === '`' ) {
                      var qq = ch; k++;
                      while ( k < n && content[k] !== qq ) { if ( content[k] === '\\' ) k++; k++; }
                      k++;
                      continue;
                    }
                    if ( ch === '[' ) depth++;
                    else if ( ch === ']' ) depth--;
                    if ( depth === 0 ) return { start: start, end: k };
                    k++;
                  }
                }
              }
            }
          }
        }
        i++;
      }
      return null;
    },

    function grammar_() {
      /** Lazy grammar reused for axiom-position lookups on arbitrary files. */
      if ( ! this.grammarInstance_ ) {
        this.grammarInstance_ = foam.parse.lsp.FoamClassGrammar.create({ index: this.index });
      }
      return this.grammarInstance_;
    },

    function buildLocationAtProperty(filePath, propName) {
      /** Jump to a property definition within a file. */
      try {
        var fs_ = require('fs');
        var content = fs_.readFileSync(filePath, 'utf8');
        var regex = new RegExp("name\\s*:\\s*['\"]" + propName + "['\"]");
        var match = regex.exec(content);
        if ( match ) {
          var line = 0;
          for ( var i = 0 ; i < match.index ; i++ ) {
            if ( content[i] === '\n' ) line++;
          }
          return { uri: 'file://' + filePath, range: { start: { line: line, character: 0 }, end: { line: line, character: 0 } } };
        }
      } catch (e) {}
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

      // 2. variable.method() — resolve variable type, then find method definition
      if ( word && word.indexOf('.') !== -1 ) {
        var parts = word.split('.');
        var varName = parts[parts.length - 2];
        var methodName = parts[parts.length - 1];

        if ( varName !== 'this' ) {
          // Resolve the variable's type
          var varClassId = this.analyzer.resolveJavaVariableType(text, position, varName, model, this.index);
          if ( ! varClassId ) {
            varClassId = this.analyzer.resolveJavaTypeName(varName, model, this.index);
          }
          if ( varClassId ) {
            // getter/setter → navigate to the property's defining class
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

            // FOAM method
            var cls = this.index.getClass(varClassId);
            if ( cls ) {
              var defClass = this.findMethodDefiner_(cls, methodName);
              if ( defClass ) {
                var filePath = this.index.getFilePath(defClass);
                if ( filePath ) return this.buildLocationAtMethod(filePath, defClass, methodName);
              }
            }

            // Java-only method → navigate to .java file
            var javaLoc = this.findJavaMethodLocation_(varClassId, methodName);
            if ( javaLoc ) return javaLoc;
          }
        }
      }

      // 3. Standalone method name (e.g., getProperty on current model)
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
