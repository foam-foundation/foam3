/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'HoverHandler',

  requires: [
    'foam.parse.lsp.FoamIndex',
    'foam.parse.lsp.FileModelCache',
    'foam.parse.lsp.CursorAnalyzer',
    'foam.parse.lsp.TypeTracker'
  ],

  constants: {
    JAVA_X_METHODS_: {
      get:            { sig: 'Object get(String key)',     doc: 'Look up a service or value in the context by key.\n\nCommon keys: `"userDAO"`, `"subject"`, `"auth"`, `"emailMessageDAO"`' },
      put:            { sig: 'X put(String key, Object value)', doc: 'Create a new sub-context with an additional key-value binding.' },
      createSubContext: { sig: 'X createSubContext(Map values)', doc: 'Create a sub-context with multiple key-value bindings.' }
    }
  },

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
      of: 'foam.parse.lsp.TypeTracker',
      name: 'typeTracker'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.CSSTokenResolver',
      name: 'cssTokenResolver'
    }
  ],

  methods: [
    function handle(text, position, opt_uri) {
      if ( ! this.analyzer.isFoamFile(text) ) return null;

      var word = this.analyzer.getDottedWordAtPosition(text, position);
      if ( ! word ) return null;

      // Try Java block hover — getters, variables, type references inside javaCode
      var javaHover = this.javaBlockHover_(text, position, opt_uri);
      if ( javaHover ) return javaHover;

      // Try CSS block hover — $tokens and ^myClass references
      var cssHover = this.cssBlockHover_(text, position, opt_uri);
      if ( cssHover ) return cssHover;

      // Guard: if cursor is inside any backtick block (css/javaCode/…) and the
      // block-specific hover above returned nothing, DON'T fall through to
      // class-body property lookup — a property name happening to match a CSS
      // selector or Java identifier is a coincidence, not a reference.
      var blockCtx = this.analyzer.getBacktickBlockContext(text, position);
      if ( blockCtx ) return null;

      // Try as class ID (full path like foam.lang.FObject)
      if ( this.index.classExists(word) ) {
        return this.buildClassHover(word);
      }

      // foam.LIB references — foam.Color, foam.Color.adjustAlpha, etc.
      // Runs after class lookup so a class ID that shares a name with a LIB
      // refinement prefers the class.
      var libHover = this.buildLibHover_(word);
      if ( libHover ) return libHover;

      // Try as property type (short name like String, FObjectProperty)
      var propTypes = this.index.getPropertyTypes();
      for ( var i = 0 ; i < propTypes.length ; i++ ) {
        if ( propTypes[i].name === word ) {
          return this.buildClassHover(propTypes[i].id);
        }
      }

      // Get the specific segment under cursor (not the full dotted chain)
      var segment = this.analyzer.getSegmentAtPosition(text, position);

      // Try as short name from requires via model
      if ( segment ) {
        var resolved = this.resolveFromModel_(text, position, segment, opt_uri);
        if ( resolved ) {
          return this.buildClassHover(resolved);
        }
        // Fallback to text-based requires parsing
        resolved = this.analyzer.resolveShortName(text, segment);
        if ( resolved ) {
          return this.buildClassHover(resolved);
        }
      }

      // Try as typed variable (var x = this.Foo.create())
      if ( segment && this.typeTracker ) {
        var model = this.cache.getModelAt(opt_uri || '', text, position.line);
        var varType = this.typeTracker.resolveVariableType(text, position, segment, model, this.index);
        if ( varType ) {
          return this.buildClassHover(varType);
        }
      }

      // Try as property on a typed variable: testvar.breadcrumbTitle
      // word = 'testvar.breadcrumbTitle', segment = 'breadcrumbTitle'
      if ( segment && word && word.indexOf('.') !== -1 && this.typeTracker ) {
        var parts = word.split('.');
        var varName = parts[0];
        var propName = parts[parts.length - 1];
        if ( varName !== 'this' && varName !== 'foam' ) {
          var model = this.cache.getModelAt(opt_uri || '', text, position.line);
          var varType = this.typeTracker.resolveVariableType(text, position, varName, model, this.index);
          if ( varType ) {
            var propDoc = this.index.getPropertyDoc(varType, propName);
            if ( propDoc ) {
              return { contents: { kind: 'markdown', value: propDoc } };
            }
          }
        }
      }

      // Try 'create' — show info about the class being created
      if ( segment === 'create' ) {
        var createHover = this.buildCreateHover_(text, position, opt_uri);
        if ( createHover ) return createHover;
      }

      // Try as property inside .create({}) block — resolve the target class
      var lookupName = segment || word;
      var createClassId = this.resolveCreateContext_(text, position);
      if ( createClassId ) {
        var createPropDoc = this.index.getPropertyDoc(createClassId, lookupName);
        if ( createPropDoc ) {
          return { contents: { kind: 'markdown', value: createPropDoc } };
        }
      }

      // Try segment as property or method name — resolve the current class
      var currentClassId = this.resolveCurrentClass_(text, position, opt_uri);
      if ( currentClassId ) {
        // Property hover
        var propDoc = this.index.getPropertyDoc(currentClassId, lookupName);
        if ( propDoc ) {
          return { contents: { kind: 'markdown', value: propDoc } };
        }

        // Method hover — show signature and documentation + return type
        var methods = this.index.getMethods(currentClassId);
        for ( var i = 0 ; i < methods.length ; i++ ) {
          if ( methods[i].name === lookupName ) {
            var md = this.buildMethodHover_(methods[i], currentClassId);
            var retType = this.index.getMethodReturnType(currentClassId, lookupName);
            if ( retType ) md += '\n\n**Returns:** `' + retType + '`';
            return { contents: { kind: 'markdown', value: md } };
          }
        }

        // Message axiom hover — `this.LABEL_X` → show the message text.
        var msg = this.index.findMessage(currentClassId, lookupName);
        if ( msg ) {
          var mmd = '**' + msg.name + '** — message\n\n' +
                    '```\n' + (msg.message || '') + '\n```\n';
          if ( msg.definerId && msg.definerId !== currentClassId ) {
            mmd += '\n*Defined on `' + msg.definerId + '`.*';
          }
          return { contents: { kind: 'markdown', value: mmd } };
        }
      }

      return null;
    },

    function resolveFromModel_(text, position, shortName, opt_uri) {
      /** Resolve a short name from model.requires using FileModelCache. */
      var model = this.cache.getModelAt(opt_uri || '', text, position.line);
      if ( ! model ) return null;
      var requiresMap = this.cache.buildRequiresMap(model);
      return requiresMap[shortName] || null;
    },

    function resolveCurrentClass_(text, position, opt_uri) {
      /** Get the class ID of the model at the cursor position. */
      var model = this.cache.getModelAt(opt_uri || '', text, position.line);
      if ( ! model ) return null;
      return this.cache.getClassId(model);
    },

    function javaBlockHover_(text, position, opt_uri) {
      /** Hover inside Java code blocks — resolve getters, variables, types. */
      var blockCtx = this.analyzer.getBacktickBlockContext(text, position);
      if ( ! blockCtx || blockCtx.blockKey === 'css' ) return null;
      // blockCtx.blockKey is javaCode/javaPreSet/javaPostSet/javaFactory/javaGetter

      var segment = this.analyzer.getSegmentAtPosition(text, position);
      if ( ! segment ) return null;

      var model = this.cache.getModelAt(opt_uri || '', text, position.line);

      // Hover on getX/setX → show property type
      // Resolves from: (1) cast on same line, (2) current model's class
      var getSetMatch = segment.match(/^(get|set)([A-Z]\w*)$/);
      if ( getSetMatch ) {
        var propName = getSetMatch[2].charAt(0).toLowerCase() + getSetMatch[2].substring(1);

        // Try cast resolution first: ((TypeName) expr).getX()
        var lines = text.split('\n');
        var castInfo = this.analyzer.resolveJavaCastType(lines[position.line] || '', model, this.index);
        var classId = castInfo && castInfo.classId ? castInfo.classId : null;

        // Fall back to current model's class
        if ( ! classId ) {
          classId = this.cache.getClassId(model);
        }

        if ( classId ) {
          var javaType = this.index.getPropertyJavaType(classId, propName);
          if ( javaType ) {
            var md = getSetMatch[1] === 'get'
              ? '**' + javaType + '** get' + getSetMatch[2] + '()\n\nGetter for `' + propName + '` on `' + classId + '`'
              : '**void** set' + getSetMatch[2] + '(' + javaType + ' val)\n\nSetter for `' + propName + '` on `' + classId + '`';
            return { contents: { kind: 'markdown', value: md } };
          }
        }
      }

      // Hover on enum value: PRIVATE, SHARED, etc. — check if preceded by ClassName.
      if ( /^[A-Z][A-Z0-9_]+$/.test(segment) ) {
        var word = this.analyzer.getDottedWordAtPosition(text, position);
        var dotParts = word ? word.split('.') : [];
        if ( dotParts.length >= 2 ) {
          var enumClassName = dotParts[dotParts.length - 2];
          var enumValue = dotParts[dotParts.length - 1];
          var enumClassId = this.analyzer.resolveJavaTypeName(enumClassName, model, this.index);
          if ( enumClassId ) {
            var enumValues = this.index.getEnumValues(enumClassId);
            for ( var i = 0 ; i < enumValues.length ; i++ ) {
              if ( enumValues[i].name === enumValue ) {
                var md = '**' + enumClassId + '.' + enumValue + '**\n\n';
                md += 'Enum value (ordinal: ' + enumValues[i].ordinal + ')';
                if ( enumValues[i].label ) md += '\n\nLabel: ' + enumValues[i].label;
                return { contents: { kind: 'markdown', value: md } };
              }
            }
          }
        }
      }

      // Hover on variable.method() — resolve variable type, then find method
      var word = this.analyzer.getDottedWordAtPosition(text, position);
      if ( word && word.indexOf('.') !== -1 ) {
        var parts = word.split('.');
        var varName = parts[parts.length - 2];
        var methodName = parts[parts.length - 1];

        // Skip this.method (handled by main hover) and ClassName.ENUM_VALUE (handled above)
        if ( varName !== 'this' && ! /^[A-Z][A-Z0-9_]+$/.test(methodName) ) {
          // Special: x is always foam.lang.X (the FOAM context)
          if ( varName === 'x' ) {
            var xMethodDoc = this.JAVA_X_METHODS_[methodName];
            if ( xMethodDoc ) {
              return { contents: { kind: 'markdown', value: '```java\n' + xMethodDoc.sig + '\n```\n*foam.lang.X*\n\n' + xMethodDoc.doc } };
            }
          }

          // Resolve the variable's type
          var varClassId = this.analyzer.resolveJavaVariableType(text, position, varName, model, this.index);
          if ( ! varClassId ) {
            // Try as a type name (static call like Country.find())
            varClassId = this.analyzer.resolveJavaTypeName(varName, model, this.index);
          }
          if ( varClassId ) {
            // Check if it's a getter/setter
            var gsMatch = methodName.match(/^(get|set)([A-Z]\w*)$/);
            if ( gsMatch ) {
              var propName = gsMatch[2].charAt(0).toLowerCase() + gsMatch[2].substring(1);
              var javaType = this.index.getPropertyJavaType(varClassId, propName);
              if ( javaType ) {
                var md = gsMatch[1] === 'get'
                  ? '```java\n' + javaType + ' get' + gsMatch[2] + '()\n```\n*' + varClassId + '*\n\nGetter for `' + propName + '`'
                  : '```java\nvoid set' + gsMatch[2] + '(' + javaType + ' val)\n```\n*' + varClassId + '*\n\nSetter for `' + propName + '`';
                return { contents: { kind: 'markdown', value: md } };
              }
            }

            // Check if it's a FOAM method
            var methods = this.index.getMethods(varClassId);
            for ( var i = 0 ; i < methods.length ; i++ ) {
              if ( methods[i].name === methodName ) {
                return { contents: { kind: 'markdown', value: this.buildMethodHover_(methods[i], varClassId) } };
              }
            }

            // Fallback: Java-only methods scanned from .java files
            var javaMethods = this.index.getJavaMethods(varClassId);
            for ( var i = 0 ; i < javaMethods.length ; i++ ) {
              if ( javaMethods[i].name === methodName ) {
                var jm = javaMethods[i];
                return { contents: { kind: 'markdown', value: '```java\n' + jm.sig + '\n```\n*' + varClassId + '* (Java)\n\n' + (jm.doc || '') } };
              }
            }


            // Show the variable's type at minimum
            var propDoc = this.index.getPropertyDoc(varClassId, methodName);
            if ( propDoc ) {
              return { contents: { kind: 'markdown', value: propDoc } };
            }
          }
        }
      }

      // Hover on a variable name → resolve its Java type
      var varType = this.analyzer.resolveJavaVariableType(text, position, segment, model, this.index);
      if ( varType ) {
        return this.buildClassHover(varType);
      }

      // Hover on a type name (e.g., FlowAccess, Subject) → resolve to FOAM class
      var typeClassId = this.analyzer.resolveJavaTypeName(segment, model, this.index);
      if ( typeClassId ) {
        return this.buildClassHover(typeClassId);
      }

      return null;
    },

    function cssBlockHover_(text, position, opt_uri) {
      /**
       * Hover inside CSS template blocks — uses shared block detection
       * and CSS context analysis.
       */
      if ( ! this.cssTokenResolver ) return null;

      var blockCtx = this.analyzer.getBacktickBlockContext(text, position);
      if ( ! blockCtx || blockCtx.blockKey !== 'css' ) return null;

      var lines = text.split('\n');
      var line = lines[position.line] || '';
      var cssCtx = this.analyzer.getCSSContext(line, position.character);
      if ( ! cssCtx || ! cssCtx.partial ) return null;

      // Get the full word (including text after cursor) for exact matching.
      // Extend left one char to catch leading `$`/`^` which aren't in the
      // CSS word-char set but are part of the token/selector semantics.
      var wordStart = cssCtx.replaceRange.start;
      var wordEnd   = cssCtx.replaceRange.end;
      var leadChar  = wordStart > 0 ? line.charAt(wordStart - 1) : '';
      var fullWord  = ( leadChar === '$' || leadChar === '^' ? leadChar : '' )
                      + line.substring(wordStart, wordEnd);

      // $tokenName — resolve via CSSTokenResolver
      if ( fullWord.charAt(0) === '$' ) {
        var tokenName = fullWord.substring(1);
        var md = this.cssTokenResolver.buildHoverContent(tokenName);
        if ( md ) return { contents: { kind: 'markdown', value: md } };
      }

      // ^name — FOAM myClass shorthand. This is a CSS selector, NOT a
      // reference to the class property of the same name — always takes
      // precedence over property-doc lookup to prevent false hovers.
      if ( fullWord.charAt(0) === '^' ) {
        var suffix = fullWord.substring(1);
        var model = this.cache.getModelAt(opt_uri || '', text, position.line);
        var pkg = model && model.package ? model.package.replace(/\./g, '-') : '';
        var cls = model && model.name || '';
        var expanded = '.' + pkg + ( pkg ? '-' : '' ) + cls + ( suffix ? '-' + suffix : '' );
        var md = '**`^' + suffix + '`** — FOAM CSS scope selector\n\n' +
                 'Expands to `' + expanded + '` (scoped to this class\'s DOM).\n\n' +
                 '*Not a reference to the `' + suffix + '` property.*';
        return { contents: { kind: 'markdown', value: md } };
      }

      return null;
    },

    function formatDocumentation_(doc) {
      /**
       * Format FOAM documentation for markdown rendering.
       * - Dedents common leading indentation
       * - Preserves blank lines as paragraph breaks
       * - Indented lines (deeper than baseline) become list items with
       *   trailing markdown hard-breaks (two spaces) so they stay on
       *   their own line in the rendered hover
       */
      if ( ! doc ) return '';
      var lines = doc.split('\n');

      // Trim leading/trailing blank lines
      while ( lines.length && ! lines[0].trim() ) lines.shift();
      while ( lines.length && ! lines[lines.length - 1].trim() ) lines.pop();
      if ( ! lines.length ) return '';

      // Find minimum indent across non-empty lines
      var minIndent = Infinity;
      for ( var i = 0 ; i < lines.length ; i++ ) {
        if ( ! lines[i].trim() ) continue;
        var leading = lines[i].match(/^(\s*)/)[1].length;
        if ( leading < minIndent ) minIndent = leading;
      }
      if ( minIndent === Infinity ) minIndent = 0;

      // Dedent and detect indented/structured lines
      var out = [];
      for ( var i = 0 ; i < lines.length ; i++ ) {
        var line = lines[i].substring(minIndent);
        var trimmed = line.trim();
        if ( ! trimmed ) {
          out.push('');  // paragraph break
          continue;
        }
        // Indented lines (e.g. "  START — ..." or "  - item") get a hard break
        // so they don't collapse with the next prose line
        var hasExtraIndent = /^\s/.test(line);
        out.push(hasExtraIndent ? line + '  ' : line);
      }

      return out.join('\n');
    },

    function buildLibHover_(word) {
      /**
       * Hover for a foam.LIB reference. Matches the longest LIB prefix and
       * surfaces LIB name + member name (methods/constants).
       */
      if ( ! word || word.indexOf('.') === -1 ) return null;
      var parts = word.split('.');
      var libName = null;
      for ( var k = parts.length ; k >= 2 ; k-- ) {
        var candidate = parts.slice(0, k).join('.');
        if ( this.index.getLibEntry(candidate) ) { libName = candidate; break; }
      }
      if ( ! libName ) return null;

      var entry = this.index.getLibEntry(libName);
      var tail = word.substring(libName.length + 1);
      var md = '```foam\nfoam.LIB ' + libName + '\n```\n';
      if ( ! tail ) {
        var methods = entry.methods || [];
        var consts = entry.constants || [];
        if ( methods.length ) md += '\n**Methods:** ' + methods.join(', ') + '\n';
        if ( consts.length )  md += '\n**Constants:** ' + consts.join(', ') + '\n';
        md += '\n*Defined in `' + (entry.path || 'unknown') + '`.*';
        return { contents: { kind: 'markdown', value: md } };
      }
      var member = tail.split('.')[0];
      var isMethod = (entry.methods || []).indexOf(member) !== -1;
      var isConst  = (entry.constants || []).indexOf(member) !== -1;
      if ( ! isMethod && ! isConst ) return null;
      md += '\n**' + (isMethod ? 'method' : 'constant') + '** `' + libName + '.' + member + '`\n';
      md += '\n*Defined in `' + (entry.path || 'unknown') + '`.*';
      return { contents: { kind: 'markdown', value: md } };
    },

    function buildClassHover(classId) {
      var cls = this.index.getClass(classId);
      if ( ! cls ) return null;
      var m = cls.model_;

      var md = '';

      // 1. Header — class id, one-line signature with extends/implements.
      //    Kept tight; multi-line only when needed, never wraps awkwardly.
      var header = m.id;
      var sigParts = [];
      if ( m.extends && m.extends !== 'FObject' ) sigParts.push('extends ' + m.extends);
      if ( m.implements && m.implements.length > 0 ) {
        var ifaces = m.implements.map(function(i) { return typeof i === 'string' ? i : i.path; });
        sigParts.push('implements ' + ifaces.join(', '));
      }
      md += '```foam\n' + header + '\n```\n';
      if ( sigParts.length > 0 ) {
        md += '*' + sigParts.join(' · ') + '*\n';
      }

      // 2. Documentation — quoted block.
      if ( m.documentation ) {
        var formatted = this.formatDocumentation_(m.documentation);
        md += '\n> ' + formatted.split('\n').join('\n> ') + '\n';
      }

      // 3. Own properties — table with conditional Description column,
      //    framework-internal `_`-suffixed props hidden.
      var ownProps = this.filterUserFacing_(this.index.getOwnProperties(classId));
      if ( ownProps.length > 0 ) {
        md += '\n**Properties** (' + ownProps.length + ')\n\n';
        var hasDocs = ownProps.some(function(p) { return p.documentation; });
        if ( hasDocs ) {
          md += '| Property | Type | Description |\n|:--|:--|:--|\n';
          for ( var i = 0 ; i < ownProps.length ; i++ ) {
            var p = ownProps[i];
            md += '| `' + p.name + '` | ' + this.propTypeName_(p) + ' | ' +
              this.briefDoc_(p.documentation) + ' |\n';
          }
        } else {
          md += '| Property | Type |\n|:--|:--|\n';
          for ( var i = 0 ; i < ownProps.length ; i++ ) {
            var p = ownProps[i];
            md += '| `' + p.name + '` | ' + this.propTypeName_(p) + ' |\n';
          }
        }
      }

      // 4. Own methods — one line with signatures (up to 8), overflow summarized.
      var ownMethods = this.index.getOwnMethods ? this.index.getOwnMethods(classId) : [];
      if ( ownMethods && ownMethods.length > 0 ) {
        md += '\n**Methods** (' + ownMethods.length + ')\n\n';
        var show = ownMethods.slice(0, 8).map(function(mt) {
          return '`' + mt.name + '()`';
        });
        md += show.join(' · ');
        if ( ownMethods.length > 8 ) md += ' *+' + (ownMethods.length - 8) + ' more*';
        md += '\n';
      }

      // 5. Inherited — single-line summary per ancestor instead of dumping names.
      var inherited = this.index.getInheritedProperties(classId);
      if ( inherited && inherited.length > 0 ) {
        md += '\n**Inherited**\n\n';
        for ( var g = 0 ; g < inherited.length ; g++ ) {
          var group = inherited[g];
          var visibleProps = this.filterUserFacing_(group.properties);
          md += '- `' + group.className + '` — ' + visibleProps.length + ' properties\n';
        }
      }

      return { contents: { kind: 'markdown', value: md } };
    },

    function filterUserFacing_(props) {
      /** Hide framework-internal props (trailing underscore) from hover. */
      if ( ! props ) return [];
      var out = [];
      for ( var i = 0 ; i < props.length ; i++ ) {
        var n = props[i].name;
        if ( n && n.charAt(n.length - 1) === '_' ) continue;
        out.push(props[i]);
      }
      return out;
    },

    function propTypeName_(p) {
      /** Short, readable property type name. */
      return p.cls_ && p.cls_.model_ ? p.cls_.model_.name : 'Property';
    },

    function briefDoc_(doc) {
      /** First line of doc, trimmed to 60 chars, markdown-safe. */
      if ( ! doc ) return '';
      var first = doc.split('\n')[0].trim();
      if ( first.length > 60 ) first = first.substring(0, 57) + '…';
      return first.replace(/\|/g, '\\|');
    },

    function resolveCreateContext_(text, position) {
      /** Find if cursor is inside a .create({}) block, return the target class ID. */
      var lines = text.split('\n');
      return this.analyzer.findCreateContext(lines, position.line, text, this.index);
    },

    function buildCreateHover_(text, position, opt_uri) {
      /** When hovering on 'create', resolve the class and show its info. */
      var lines = text.split('\n');
      var line = lines[position.line] || '';
      var match = line.match(/(?:this\.)?(\w[\w.]*)\.create/);
      if ( ! match ) return null;
      var name = match[1];
      var resolved = this.analyzer.resolveShortName(text, name);
      if ( ! resolved && this.index.classExists(name) ) resolved = name;
      if ( ! resolved ) return null;

      var cls = this.index.getClass(resolved);
      if ( ! cls ) return null;
      var md = '```foam\n' + resolved + '.create()\n```\n';
      var props = this.index.getOwnProperties(resolved);
      if ( props.length > 0 ) {
        md += '| Property | Type |\n';
        md += '|:--|:--|\n';
        for ( var i = 0 ; i < Math.min(props.length, 12) ; i++ ) {
          var p = props[i];
          var typeName = p.cls_ && p.cls_.model_ ? p.cls_.model_.name : 'Property';
          md += '| `' + p.name + '` | ' + typeName + ' |\n';
        }
        if ( props.length > 12 ) md += '| *... +' + (props.length - 12) + ' more* | |\n';
      }
      return { contents: { kind: 'markdown', value: md } };
    },

    function buildMethodHover_(method, classId) {
      /**
       * Build markdown hover for a method with signature, documentation,
       * and (where inferrable) the concrete return type. The return type
       * is computed by FoamIndex.getMethodReturnType which parses the
       * method body for `return this.X.create(...)` etc. and falls back to
       * the declared `type:` axiom — so we don't emit both lines here;
       * that single line is appended by the caller in handle() to avoid
       * duplication for paths that don't want it.
       */
      var sig = this.analyzer.getMethodSignature(method);
      var md = '```javascript\n' + sig + '\n```\n';
      md += '*' + classId + '*\n';
      if ( method.documentation ) md += '\n' + method.documentation + '\n';
      return md;
    }
  ]
});
