/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp',
  name: 'CursorAnalyzer',

  documentation: 'Shared text analysis utilities for LSP handlers.',

  constants: {
    // Matches the opening of any FOAM model call: foam.<UPPER_IDENT>( ... ).
    // Generic on purpose — any extension (FSM, future model types) is picked up
    // without changes here. POM is excluded from the default form because
    // diagnostics aren't meaningful on POM bodies; the _POM variant includes it.
    FOAM_CALL_REGEX: /foam\.(?!POM\b)[A-Z][A-Z0-9_]*\s*\(/,
    FOAM_CALL_REGEX_POM: /foam\.[A-Z][A-Z0-9_]*\s*\(/
  },

  methods: [
    function isFoamFile(text, opt_includePom) {
      /** True if the text contains any foam.<UPPER>(...) model-defining call. */
      var re = opt_includePom ? this.FOAM_CALL_REGEX_POM : this.FOAM_CALL_REGEX;
      return re.test(text);
    },

    function classIdOf(model) {
      /** Mirror of FileModelCache.getClassId — for use where cache isn't injected. */
      if ( ! model ) return null;
      if ( model.refines ) return model.refines;
      return model.package ? model.package + '.' + model.name : model.name;
    },

    function offsetToPosition(text, offset) {
      /** Convert a character offset to { line, character } position. */
      var line = 0;
      var col = 0;
      for ( var i = 0 ; i < offset && i < text.length ; i++ ) {
        if ( text[i] === '\n' ) { line++; col = 0; } else { col++; }
      }
      return { line: line, character: col };
    },

    function positionToOffset(text, position) {
      /** Convert a { line, character } position to a character offset. */
      var lines = text.split('\n');
      var offset = 0;
      for ( var i = 0 ; i < position.line && i < lines.length ; i++ ) {
        offset += lines[i].length + 1;
      }
      offset += Math.min(position.character, (lines[position.line] || '').length);
      return offset;
    },

    function getDottedWordAtPosition(text, position) {
      /** Get the full dotted word (e.g., 'foam.lang.FObject') at the cursor position. */
      var lines = text.split('\n');
      var line = lines[position.line] || '';
      var ch = position.character;

      var start = ch;
      while ( start > 0 && /[a-zA-Z0-9_.]/.test(line[start - 1]) ) start--;
      var end = ch;
      while ( end < line.length && /[a-zA-Z0-9_.]/.test(line[end]) ) end++;

      var word = line.substring(start, end);
      if ( word.startsWith("'") ) word = word.substring(1);
      if ( word.endsWith("'") ) word = word.substring(0, word.length - 1);
      return word;
    },

    function getEnclosingStringContent(text, position) {
      /**
       * If the cursor sits inside a quoted string literal on its line, return
       * the string's content (between the quotes); otherwise null. Used to
       * stop a word inside a label like 'Reset Password' from resolving to a
       * type/class — only a string whose WHOLE content is a reference should.
       */
      var lines = text.split('\n');
      var line = lines[position.line] || '';
      var ch = position.character;
      var quotes = "'\"`";
      var i = 0;
      while ( i < line.length ) {
        if ( quotes.indexOf(line[i]) !== -1 ) {
          var q = line[i];
          var start = i + 1;
          var j = start;
          while ( j < line.length && line[j] !== q ) {
            if ( line[j] === '\\' ) j++;
            j++;
          }
          if ( ch > start - 1 && ch <= j ) return line.substring(start, j);
          i = j + 1;
        } else {
          i++;
        }
      }
      return null;
    },

    function getSegmentAtPosition(text, position) {
      /**
       * Get just the single identifier segment under the cursor (stops at dots).
       * For 'this.Suggestion.create', returns 'Suggestion' if cursor is on it.
       */
      var lines = text.split('\n');
      var line = lines[position.line] || '';
      var ch = position.character;

      var start = ch;
      while ( start > 0 && /[a-zA-Z0-9_$]/.test(line[start - 1]) ) start--;
      var end = ch;
      while ( end < line.length && /[a-zA-Z0-9_$]/.test(line[end]) ) end++;

      return line.substring(start, end);
    },

    // -----------------------------------------------------------------
    // The four methods below (resolveClassId / parseRequires / parseImports
    // / resolveShortName) are MID-EDIT FALLBACKS only.
    //
    // The handlers prefer the cache-based path (cache.getClassIdAt,
    // cache.resolveRequiresMap, cache.resolveShortName) which reads from
    // the eval-intercepted model. When the file fails to eval (mid-edit
    // SyntaxError, broken function bodies), the model is unavailable and
    // these regex helpers parse axiom values directly from text so
    // completion / hover / definition don't go dark while the user types.
    //
    // The eventual replacement is a grammar-driven model-field
    // extractor — FoamClassGrammar already parses axiom positions, so
    // the extractor can read values without `eval`. Once that lands,
    // these methods are deletable. Until then, treat them as a single
    // tactical surface — do NOT add new regex parsers of FOAM model
    // structure elsewhere in the LSP.
    // -----------------------------------------------------------------

    function resolveClassId(text) {
      /** FALLBACK: extract `package.name` directly from text when no model is available. */
      var pkgMatch  = text.match(/package\s*:\s*['"]([^'"]+)['"]/);
      var nameMatch = text.match(/name\s*:\s*['"]([^'"]+)['"]/);
      if ( ! nameMatch ) return null;
      return pkgMatch ? pkgMatch[1] + '.' + nameMatch[1] : nameMatch[1];
    },

    function parseRequires(text) {
      /** FALLBACK: parse the requires: array via regex when no model is available. */
      var map = {};
      var requiresMatch = text.match(/requires\s*:\s*\[([\s\S]*?)\]/);
      if ( ! requiresMatch ) return map;
      var regex = /['"]([a-zA-Z][\w.]+\.(\w+))(?:\s+as\s+(\w+))?['"]/g;
      var m;
      while ( ( m = regex.exec(requiresMatch[1]) ) !== null ) {
        var fullId    = m[1];
        var shortName = m[3] || m[2];
        map[shortName] = fullId;
      }
      return map;
    },

    function parseImports(text) {
      /** FALLBACK: parse the imports: array via regex when no model is available. */
      var names = [];
      var importsMatch = text.match(/imports\s*:\s*\[([\s\S]*?)\]/);
      if ( ! importsMatch ) return names;
      var regex = /['"](\w[\w?]*)(?:\s+as\s+(\w+))?['"]/g;
      var m;
      while ( ( m = regex.exec(importsMatch[1]) ) !== null ) {
        var name = m[2] || m[1];
        names.push(name.replace(/\?$/, ''));
      }
      return names;
    },

    function resolveShortName(text, name) {
      /** FALLBACK: short-name → full-id via the regex requires-parse. */
      var map = this.parseRequires(text);
      return map[name] || null;
    },

    function findCreateContext(text, lineNum, cache, index, opt_uri) {
      /**
       * Scan backward from the cursor to find an enclosing `.create({` whose
       * opening `{` is at one level of brace-depth above the cursor. Uses a
       * linear scan over the full text (no line limit) with string and
       * comment skipping, then resolves the short name via the cached model's
       * requires axiom (no regex over FOAM model structure).
       *
       * Returns the resolved class ID or null.
       *
       * @param text    - full source text
       * @param lineNum - current line number
       * @param cache   - FileModelCache instance (for short-name resolution)
       * @param index   - FoamIndex instance (final fallback: registered short names)
       * @param opt_uri - URI of the current document (passed to cache for multi-class files)
       */
      var lines = text.split('\n');
      var cursorOffset = this.positionToOffset(text, { line: lineNum, character: (lines[lineNum] || '').length });

      // Walk backward from cursor, tracking brace depth and skipping strings/comments.
      var depth = 0;
      var i = cursorOffset - 1;
      while ( i >= 0 ) {
        var ch = text[i];

        // Skip strings (scan backward to matching opener)
        if ( ch === "'" || ch === '"' || ch === '`' ) {
          var q = ch;
          for ( i-- ; i >= 0 ; i-- ) {
            if ( text[i] === q && text[i - 1] !== '\\' ) { i--; break; }
          }
          continue;
        }

        // Skip block comments: */ ... /*
        if ( ch === '/' && i > 0 && text[i - 1] === '*' ) {
          i -= 2;
          while ( i >= 1 && ! ( text[i - 1] === '/' && text[i] === '*' ) ) i--;
          i -= 2;
          continue;
        }

        // Skip line comments — find start-of-line, check for //
        if ( ch === '\n' ) {
          // could be end of a line comment; no-op, just fall through
        }

        if ( ch === '}' ) depth++;
        else if ( ch === '{' ) {
          if ( depth === 0 ) {
            // Found the opening brace of our enclosing block.
            // Scan backward from here for `.create(` — allow whitespace between.
            var j = i - 1;
            while ( j >= 0 && /\s/.test(text[j]) ) j--;
            if ( j >= 0 && text[j] === '(' ) {
              var end = j;
              j--;
              while ( j >= 0 && /\s/.test(text[j]) ) j--;
              // Expect 'create' before the paren
              if ( j >= 5 && text.substring(j - 5, j + 1) === 'create' ) {
                // Before 'create' expect '.identifier' (or 'this.identifier')
                var k = j - 6;
                if ( k >= 0 && text[k] === '.' ) {
                  var nameEnd = k;
                  var nameStart = nameEnd;
                  while ( nameStart > 0 && /[\w$]/.test(text[nameStart - 1]) ) nameStart--;
                  var shortName = text.substring(nameStart, nameEnd);
                  if ( shortName ) {
                    var resolved = cache ? cache.resolveShortName(opt_uri, text, shortName, lineNum) : null;
                    if ( resolved ) return resolved;
                    if ( index.classExists(shortName) ) return shortName;
                  }
                }
              }
            }
            return null;
          }
          depth--;
        }
        i--;
      }
      return null;
    },

    function getMethodSignature(method) {
      /** Extract method signature: name(param1, param2) */
      if ( method.args && method.args.length > 0 ) {
        var params = method.args.map(function(a) {
          return ( a.type ? a.type + ' ' : '' ) + a.name;
        });
        return method.name + '(' + params.join(', ') + ')';
      }
      if ( method.code ) {
        var match = method.code.toString().match(/function\s*\w*\s*\(([^)]*)\)/);
        if ( match && match[1].trim() ) {
          return method.name + '(' + match[1].trim() + ')';
        }
      }
      return method.name + '()';
    },

    function resolveJavaVariableType(text, position, varName, model, index, opt_seen) {
      /**
       * Resolve a Java variable's type from cast, declaration, or method return type.
       * Resolution order:
       *   1. Cast on current/nearby line: ((TypeName) varName).
       *   2. Explicit type declaration: TypeName varName = ...
       *   3. var x = new T(...)  →  T
       *   4. var x = (T) expr    →  T
       *   5. var x = expr.method(...) — resolve receiver then method return type.
       *   6. var x = getProperty() → property's java type.
       *
       * `opt_seen` is the recursion-guard set; it tracks variable names
       * already on the resolution stack so cycles (`var a = b.x();
       * var b = a.y();`) and self-references (`var x = x.f();`) terminate
       * instead of recursing forever.
       */
      var seen = opt_seen || {};
      if ( seen[varName] ) return null;
      seen = Object.assign({}, seen);
      seen[varName] = true;

      var lines = text.split('\n');

      // 1. Check for cast on current or nearby lines
      for ( var i = position.line ; i >= Math.max(0, position.line - 3) ; i-- ) {
        var castInfo = this.resolveJavaCastType(lines[i] || '', model, index);
        if ( castInfo && castInfo.classId ) {
          var castVarRegex = new RegExp('\\(\\s*\\(\\s*' + castInfo.typeName + '\\s*\\)\\s*' + varName + '\\s*\\)');
          if ( castVarRegex.test(lines[i]) ) return castInfo.classId;
        }
      }

      // Scan backward for declaration
      for ( var i = position.line ; i >= 0 ; i-- ) {
        var scanLine = lines[i];
        if ( ! scanLine ) continue;
        var declMatch = scanLine.match(new RegExp('(\\w+)\\s+' + varName + '\\s*[=;]'));
        if ( ! declMatch ) continue;

        var typeName = declMatch[1];
        if ( ['return', 'new', 'if', 'for', 'while', 'try', 'catch', 'throw', 'else'].indexOf(typeName) !== -1 ) continue;

        // 2. Explicit type declaration (not 'var')
        if ( typeName !== 'var' ) {
          return this.resolveJavaTypeName(typeName, model, index);
        }

        // 3. 'var' declaration — infer from the right-hand side
        // var x = new T(...)  → T
        // var x = (T) expr     → T (with optional generics stripped)
        // var x = T.class      → T (the class type itself)
        var newM = scanLine.match(new RegExp(varName + '\\s*=\\s*new\\s+([A-Z][\\w.$]*)'));
        if ( newM ) return this.resolveJavaTypeName(newM[1], model, index);

        var simpleCastM = scanLine.match(
          new RegExp(varName + '\\s*=\\s*\\(\\s*([A-Z][\\w.$]*)\\s*(?:<[^()]*>)?\\s*\\)'));
        if ( simpleCastM ) return this.resolveJavaTypeName(simpleCastM[1], model, index);

        // var x = ((Cast) y).method() → resolve cast chain
        var rhsCastInfo = this.resolveJavaCastType(scanLine, model, index);
        if ( rhsCastInfo && rhsCastInfo.classId && rhsCastInfo.methodName ) {
          var returnType = this.resolveMethodReturnType(rhsCastInfo.classId, rhsCastInfo.methodName, index);
          if ( returnType ) return returnType;
        }

        // var x = expr.method() → resolve expr type, then method return type
        var methodCallMatch = scanLine.match(new RegExp(varName + '\\s*=\\s*(?:\\w+\\.)*?(\\w+)\\.(\\w+)\\s*\\('));
        if ( methodCallMatch ) {
          var receiverName = methodCallMatch[1];
          var methodName = methodCallMatch[2];

          // Try receiver as a type name (static call)
          var receiverClassId = this.resolveJavaTypeName(receiverName, model, index);
          if ( receiverClassId ) {
            var returnType = this.resolveMethodReturnType(receiverClassId, methodName, index);
            if ( returnType ) return returnType;
          }

          // Try receiver as a variable — pass `seen` so cycles terminate
          var receiverType = this.resolveJavaVariableType(text, { line: i, character: 0 }, receiverName, model, index, seen);
          if ( receiverType ) {
            var returnType = this.resolveMethodReturnType(receiverType, methodName, index);
            if ( returnType ) return returnType;
          }
        }

        // var x = getProperty() → property type on current model
        var getterMatch = scanLine.match(new RegExp(varName + '\\s*=\\s*(get)([A-Z]\\w*)\\s*\\('));
        if ( getterMatch ) {
          var propName = getterMatch[2].charAt(0).toLowerCase() + getterMatch[2].substring(1);
          var classId = this.classIdOf(model);
          if ( classId ) {
            var propType = index.getPropertyJavaType(classId, propName);
            if ( propType ) return this.resolveJavaTypeName(propType, model, index);
          }
        }

        return null;
      }

      // 7. FOAM method parameter — declared in the enclosing method's
      //    `args:` axiom, NOT in the javaCode body. Common pattern:
      //      methods: [{
      //        name: 'foo',
      //        args: 'X x, MyType someParam',
      //        javaCode: `someParam.bar();`
      //      }]
      //    The javaCode reference resolves through the args string of the
      //    nearest preceding method-axiom block. Both string form
      //    ('X x, MyType p') and array-of-objects form
      //    ([{name:'p', javaType:'MyType'}]) are recognized.
      var argType = this.resolveMethodParamType_(text, position, varName, model, index);
      if ( argType ) return argType;
      return null;
    },

    function resolveMethodParamType_(text, position, varName, model, index) {
      /**
       * Find the type of a FOAM method parameter declared in the enclosing
       * method's `args:` axiom. Scans back from the cursor for the nearest
       * `args:` declaration above the current javaCode block.
       *
       * Two `args:` shapes are supported:
       *   - String form:   args: 'X x, MyType someParam'
       *   - Array form:    args: [{ name: 'someParam', javaType: 'MyType' }]
       *
       * Returns a class id resolved via resolveJavaTypeName, or null.
       */
      var lines = text.split('\n');
      var maxScan = Math.min(position.line, 200);

      // String form
      for ( var i = position.line ; i >= position.line - maxScan ; i-- ) {
        if ( i < 0 ) break;
        var line = lines[i] || '';
        var stringArgs = line.match(/args\s*:\s*['"]([^'"]*)['"]/);
        if ( stringArgs ) {
          var pairs = stringArgs[1].split(',');
          for ( var p = 0 ; p < pairs.length ; p++ ) {
            var parts = pairs[p].trim().split(/\s+/);
            if ( parts.length < 2 ) continue;
            // Tail is the param name; everything before is the type. This
            // handles generics-as-tokens (e.g., `List<String> items`).
            var nm = parts[parts.length - 1];
            var ty = parts.slice(0, parts.length - 1).join(' ');
            if ( nm === varName && ty ) {
              return this.resolveJavaTypeName(ty.replace(/<.*$/, ''), model, index);
            }
          }
          break;
        }
        // Array form (single-line subset). Multi-line array form would
        // require a richer parser — fall through to break the scan since
        // the simple match didn't fire.
        var arrayArgs = line.match(/args\s*:\s*\[\s*\{([\s\S]*?)\}\s*\]/);
        if ( arrayArgs ) {
          var entries = arrayArgs[1].split(/\}\s*,\s*\{/);
          for ( var e = 0 ; e < entries.length ; e++ ) {
            var entry = entries[e];
            var nameM = entry.match(/name\s*:\s*['"]([^'"]+)['"]/);
            if ( nameM && nameM[1] === varName ) {
              var typeM = entry.match(/(?:javaType|type)\s*:\s*['"]([^'"]+)['"]/);
              if ( typeM ) return this.resolveJavaTypeName(typeM[1].replace(/<.*$/, ''), model, index);
            }
          }
          break;
        }
      }
      return null;
    },

    function resolveMethodReturnType(classId, methodName, index) {
      /**
       * Look up a method's return type from the FOAM registry.
       * method.type contains the FOAM class ID of the return type.
       * Also handles getX/setX as property getters/setters.
       */
      var cls = index.getClass(classId);
      if ( ! cls ) return null;

      // Check getter pattern: getX → property type
      var getMatch = methodName.match(/^get([A-Z]\w*)$/);
      if ( getMatch ) {
        var propName = getMatch[1].charAt(0).toLowerCase() + getMatch[1].substring(1);
        var propType = index.getPropertyJavaType(classId, propName);
        if ( propType ) return propType === 'String' || propType === 'Object' ? null : propType;
      }

      // Look up method in the class
      var methods = cls.getAxiomsByClass(foam.lang.Method);
      for ( var i = 0 ; i < methods.length ; i++ ) {
        if ( methods[i].name === methodName && methods[i].type ) {
          var returnType = methods[i].type;
          if ( returnType === 'Void' || returnType === 'void' ) return null;
          return returnType;
        }
      }
      return null;
    },

    function resolveJavaCastType(line, model, index) {
      /**
       * Extract the cast type from ((TypeName) expr).method().
       * Single source of truth for cast resolution — used by:
       * - resolveJavaVariableType (variable type from cast)
       * - HoverHandler (hover on method after cast)
       * - SemanticTokenHandler (highlight method after cast)
       *
       * Handles nested parens: ((AuthService) x.get("auth")).check(...)
       */
      // Find ((TypeName) — the opening of a cast expression
      var castStart = line.match(/\(\s*\(\s*(\w+)\s*\)\s*/);
      if ( ! castStart ) return null;

      // From after the type cast, find the matching closing ) using balanced paren tracking
      var afterCast = castStart.index + castStart[0].length;
      var depth = 1; // We're inside the outer (
      for ( var i = afterCast ; i < line.length ; i++ ) {
        if ( line[i] === '(' ) depth++;
        else if ( line[i] === ')' ) {
          depth--;
          if ( depth === 0 ) {
            // Found the closing ) — check for .methodName after it
            var rest = line.substring(i + 1);
            var methodMatch = rest.match(/^\s*\.\s*(\w+)/);
            if ( methodMatch ) {
              return {
                classId: this.resolveJavaTypeName(castStart[1], model, index),
                typeName: castStart[1],
                methodName: methodMatch[1]
              };
            }
            break;
          }
        }
      }
      return null;
    },

    function getBacktickBlockContext(text, position) {
      /**
       * Detects if cursor is inside a backtick-delimited block (css:, javaCode:, etc.).
       * Returns { blockKey, blockContent, blockOffset } or null.
       *
       * Replaces all inline backtick-scanning code across handlers.
       */
      var offset = this.positionToOffset(text, position);
      var textBefore = text.substring(0, offset);

      // Scan backward for unmatched opening backtick
      var lastOpenBacktick = -1;
      var btDepth = 0;
      for ( var i = textBefore.length - 1 ; i >= 0 ; i-- ) {
        if ( textBefore[i] === '`' ) {
          btDepth++;
          if ( btDepth % 2 === 1 ) { lastOpenBacktick = i; break; }
        }
      }
      if ( lastOpenBacktick === -1 ) return null;

      // Extract the key before the backtick: scan backward for "keyName:"
      var beforeBT = text.substring(Math.max(0, lastOpenBacktick - 200), lastOpenBacktick);
      var keyMatch = beforeBT.match(/([\w]+)\s*:\s*$/);
      if ( ! keyMatch ) return null;

      var blockKey = keyMatch[1];

      // Only return for known block keys
      // Every key that holds a Java code/CSS template-literal block. The
      // SemanticTokenHandler scans the same superset; keep them in sync so
      // hover/go-to-def fire inside any Java slot (not just `javaCode:`).
      var knownKeys = {
        css:                            true,
        javaCode:                       true,
        javaPreSet:                     true,
        javaPostSet:                    true,
        javaFactory:                    true,
        javaGetter:                     true,
        javaSetter:                     true,
        javaAdapt:                      true,
        javaCompare:                    true,
        javaComparePropertyToObject:    true,
        javaComparePropertyToValue:     true,
        javaCloneProperty:              true,
        javaDiffProperty:               true,
        javaFormatJSON:                 true,
        javaJSONParser:                 true,
        javaCSVParser:                  true,
        javaQueryParser:                true,
        javaToCSV:                      true,
        javaToCSVLabel:                 true,
        javaFromCSVLabelMapping:        true,
        javaAssertValue:                true,
        javaValidateObj:                true,
        javaCondition:                  true,
        javaValue:                      true,
        javaInit:                       true
      };
      if ( ! knownKeys[blockKey] ) return null;

      // Extract block content (between opening backtick and next backtick or end)
      var contentStart = lastOpenBacktick + 1;
      var contentEnd = text.indexOf('`', contentStart);
      if ( contentEnd === -1 ) contentEnd = text.length;
      var blockContent = text.substring(contentStart, contentEnd);

      return {
        blockKey: blockKey,
        blockContent: blockContent,
        blockOffset: contentStart
      };
    },

    function resolveJavaTypeName(typeName, model, index) {
      /**
       * Resolve a Java type name to a FOAM class ID.
       * Checks: direct lookup, javaImports, same package, dynamic scan.
       */
      if ( index.classExists(typeName) ) return typeName;

      var imports = model ? model.javaImports || [] : [];
      for ( var i = 0 ; i < imports.length ; i++ ) {
        var imp = imports[i];
        if ( imp.endsWith('.' + typeName) || imp.endsWith('.*') ) {
          var fullId = imp.endsWith('.*') ? imp.replace('.*', '.' + typeName) : imp;
          if ( index.classExists(fullId) ) return fullId;
        }
      }

      if ( model && model.package ) {
        var samePackage = model.package + '.' + typeName;
        if ( index.classExists(samePackage) ) return samePackage;
      }

      var ids = index.getAllClassIds();
      var suffix = '.' + typeName;
      for ( var i = 0 ; i < ids.length ; i++ ) {
        if ( ids[i].endsWith(suffix) ) return ids[i];
      }

      return null;
    },

    function getCSSContext(line, character) {
      /**
       * Analyzes cursor position within a CSS line.
       * Returns { type, propName, partial, replaceRange } or null.
       *
       * Types: 'propertyName', 'propertyValue', 'selector'
       *
       * Parses the full line (not just prefix) to handle mid-word editing.
       * Determines context by finding the : and ; boundaries around the cursor.
       */
      var trimmed = line.trimStart();
      if ( ! trimmed ) return { type: 'propertyName', propName: null, partial: '', replaceRange: { start: character, end: character } };

      // Selector detection: line starts with ^, ., #, &, or contains {
      // IMPORTANT: do NOT include \w — that matches property names like "color:"
      // Selectors use ^ (FOAM myClass), . (class), # (id), & (parent ref), > ~ + (combinators)
      var bracePos = line.indexOf('{');
      var closeBracePos = line.indexOf('}');
      var isBeforeBrace = bracePos === -1 || character <= bracePos;
      var hasBrace = bracePos !== -1;
      var selectorStart = /^\s*[\^.#&>~+\[]/.test(line);

      if ( selectorStart && isBeforeBrace && ( hasBrace || ! /:\s/.test(line) ) ) {
        var word = this.getWordAtChar_(line, character);
        return { type: 'selector', propName: null, partial: word.text, replaceRange: word.range };
      }

      // After { on a selector line → fall through to colon/semicolon analysis

      // Find the relevant colon and semicolons — walk backward from cursor
      var colonPos = -1;
      var lastSemiBeforeCursor = -1;

      for ( var i = character - 1 ; i >= 0 ; i-- ) {
        if ( line[i] === ':' && colonPos === -1 ) colonPos = i;
        if ( line[i] === ';' ) { lastSemiBeforeCursor = i; break; }
      }

      // If we found a semicolon before the colon, the colon belongs to a previous declaration
      if ( lastSemiBeforeCursor !== -1 && colonPos !== -1 && colonPos < lastSemiBeforeCursor ) {
        colonPos = -1;
      }

      // Extract the word under/before cursor
      var word = this.getWordAtChar_(line, character);

      if ( colonPos === -1 ) {
        // No colon found before cursor → property name context
        return { type: 'propertyName', propName: null, partial: word.text, replaceRange: word.range };
      }

      // Colon found → property value context
      // Extract property name: text between last semi (or start/brace) and colon
      var propStart = Math.max(lastSemiBeforeCursor + 1, bracePos !== -1 ? bracePos + 1 : 0);
      var propName = line.substring(propStart, colonPos).trim();

      return { type: 'propertyValue', propName: propName, partial: word.text, replaceRange: word.range };
    },

    function getWordAtChar_(line, character) {
      /**
       * Extracts the word fragment at cursor position by scanning both directions.
       * The "partial" is text from word start to cursor. The replaceRange covers
       * the entire word (including text after cursor) for mid-word editing.
       *
       * Word characters: a-z A-Z 0-9 _ - $ . (for CSS tokens, selectors, values)
       */
      var wordChars = /[a-zA-Z0-9_$\-\.]/;
      var left = character;
      while ( left > 0 && wordChars.test(line[left - 1]) ) left--;
      var right = character;
      while ( right < line.length && wordChars.test(line[right]) ) right++;

      var partial = line.substring(left, character);
      return { text: partial, range: { start: left, end: right } };
    }
  ]
});
