/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'SemanticTokenHandler',

  documentation: 'Provides semantic tokens for resolved class references (this.ShortName) and typed variables.',

  requires: [
    'foam.parse.lsp.FoamIndex',
    'foam.parse.lsp.FileModelCache',
    'foam.parse.lsp.CursorAnalyzer',
    'foam.parse.lsp.TypeTracker'
  ],

  constants: {
    TOKEN_TYPES: ['type', 'class', 'variable', 'keyword', 'string', 'comment', 'number', 'operator', 'method'],
    TOKEN_MODIFIERS: ['declaration', 'readonly']
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
    function handle(text, opt_uri) {
      /** Returns encoded semantic tokens array for the file. */
      var models = this.cache.getModels(opt_uri || '', text);
      var tokens = [];

      for ( var i = 0 ; i < models.length ; i++ ) {
        this.collectModelTokens_(text, models[i], tokens);
        this.collectJavaTokens_(text, models[i], tokens);
        this.collectCSSTokens_(text, models[i], tokens);
      }

      // Sort by position (line, then character)
      tokens.sort(function(a, b) {
        return a.line !== b.line ? a.line - b.line : a.char - b.char;
      });

      // Encode as relative deltas per LSP spec
      return this.encodeTokens_(tokens);
    },

    function collectModelTokens_(text, model, tokens) {
      /**
       * Scope-aware model token collection. Builds four priority lookup sets
       * from the model and does a single pass over lines matching this.\w+.
       *
       * Priority: requires (type 0) > property (variable 2) > method (method 8) > import (variable 2 readonly)
       *
       * Typed variable usages (var x = this.Foo.create()) are only emitted
       * inside code scope — NOT in structural ranges or string literals.
       */
      var classId = this.cache.getClassId(model);
      var cls     = this.index.getClass(classId);

      // --- Build requires set ---
      var requiresSet = {};
      var requiresMap = this.cache.buildRequiresMap(model);
      if ( cls ) {
        var regRequires = this.index.getRequires(classId);
        for ( var i = 0 ; i < regRequires.length ; i++ ) {
          var r = regRequires[i];
          if ( r.name && r.path && ! requiresMap[r.name] ) {
            requiresMap[r.name] = r.path;
          }
        }
      }
      var aliases = Object.keys(requiresMap);
      for ( var i = 0 ; i < aliases.length ; i++ ) {
        requiresSet[aliases[i]] = true;
      }

      // --- Build property set ---
      var propertySet = {};
      if ( cls ) {
        var props = cls.getAxiomsByClass(foam.lang.Property);
        for ( var i = 0 ; i < props.length ; i++ ) {
          propertySet[props[i].name] = true;
        }
      }
      // Also pick up raw model properties (may not be registered yet)
      var rawProps = model.properties || [];
      for ( var i = 0 ; i < rawProps.length ; i++ ) {
        var pName = typeof rawProps[i] === 'string' ? rawProps[i] : rawProps[i].name;
        if ( pName ) propertySet[pName] = true;
      }

      // --- Build method set ---
      var methodSet = {};
      if ( cls ) {
        var methods = cls.getAxiomsByClass(foam.lang.Method);
        for ( var i = 0 ; i < methods.length ; i++ ) {
          methodSet[methods[i].name] = true;
        }
      }
      var rawMethods = model.methods || [];
      for ( var i = 0 ; i < rawMethods.length ; i++ ) {
        var m = rawMethods[i];
        var mName = typeof m === 'function' ? m.name : (m && m.name);
        if ( mName ) methodSet[mName] = true;
      }

      // --- Build import set ---
      var importSet = {};
      if ( cls ) {
        var imports = cls.getAxiomsByClass(foam.lang.Import);
        for ( var i = 0 ; i < imports.length ; i++ ) {
          // Import key is the local name (last segment or 'as' alias)
          var imp = imports[i];
          var impName = imp.name || imp.key;
          if ( impName ) importSet[impName] = true;
        }
      }
      var rawImports = model.imports || [];
      for ( var i = 0 ; i < rawImports.length ; i++ ) {
        var rawImp = rawImports[i];
        if ( typeof rawImp === 'string' ) {
          // Strip trailing '?' for optional imports
          var cleaned = rawImp.replace(/\?$/, '');
          var parts = cleaned.split(/\s+as\s+/);
          var localName = parts.length > 1 ? parts[1].trim() : parts[0].trim().split('.').pop();
          if ( localName ) importSet[localName] = true;
        }
      }

      // --- Compute structural ranges to skip for variable usage ---
      var lines = text.split('\n');
      var structuralRanges = this.computeStructuralRanges_(lines);

      // --- Single pass: match this.\w+ and classify by priority ---
      var thisPattern = /this\.(\w+)/g;
      for ( var lineNum = 0 ; lineNum < lines.length ; lineNum++ ) {
        thisPattern.lastIndex = 0;
        var match;
        while ( ( match = thisPattern.exec(lines[lineNum]) ) !== null ) {
          var name = match[1];
          var charPos = match.index + 5; // skip 'this.'

          if ( requiresSet[name] ) {
            tokens.push({ line: lineNum, char: charPos, length: name.length, type: 0, modifiers: 0 });
          } else if ( propertySet[name] ) {
            tokens.push({ line: lineNum, char: charPos, length: name.length, type: 2, modifiers: 0 });
          } else if ( methodSet[name] ) {
            tokens.push({ line: lineNum, char: charPos, length: name.length, type: 8, modifiers: 0 });
          } else if ( importSet[name] ) {
            tokens.push({ line: lineNum, char: charPos, length: name.length, type: 2, modifiers: 2 });
          }
        }
      }

      // --- Typed variable declarations + scoped usages ---
      if ( ! this.typeTracker ) return;
      var createRegex = /(?:var|let|const)\s+(\w+)\s*=\s*(?:this\.)?(\w+)\.create\s*\(/g;
      var varTypes = {};

      for ( var lineNum = 0 ; lineNum < lines.length ; lineNum++ ) {
        createRegex.lastIndex = 0;
        var match;
        while ( ( match = createRegex.exec(lines[lineNum]) ) !== null ) {
          var varName   = match[1];
          var className = match[2];
          var resolved  = requiresMap[className] ||
            (this.index.classExists(className) ? className : null);
          if ( resolved ) {
            varTypes[varName] = true;
            tokens.push({
              line: lineNum,
              char: match.index + match[0].indexOf(varName),
              length: varName.length,
              type: 2,
              modifiers: 1
            });
          }
        }
      }

      // Emit usage tokens only in code scope (skip structural ranges and strings)
      var varNames = Object.keys(varTypes);
      if ( varNames.length === 0 ) return;
      var usagePattern = new RegExp('\\b(' + varNames.join('|') + ')\\b', 'g');
      for ( var lineNum = 0 ; lineNum < lines.length ; lineNum++ ) {
        if ( this.isInStructuralRange_(lineNum, structuralRanges) ) continue;
        usagePattern.lastIndex = 0;
        var match;
        while ( ( match = usagePattern.exec(lines[lineNum]) ) !== null ) {
          // Skip if this is a declaration token
          var isDecl = false;
          for ( var t = 0 ; t < tokens.length ; t++ ) {
            if ( tokens[t].line === lineNum && tokens[t].char === match.index && tokens[t].modifiers === 1 ) {
              isDecl = true;
              break;
            }
          }
          if ( isDecl ) continue;

          // Skip matches inside string literals
          if ( this.isInStringLiteral_(lines[lineNum], match.index) ) continue;

          tokens.push({ line: lineNum, char: match.index, length: match[1].length, type: 2, modifiers: 2 });
        }
      }
    },

    function computeStructuralRanges_(lines) {
      /**
       * Finds line ranges of structural arrays (requires, imports, exports,
       * javaImports) where variable usage tokens should NOT be emitted.
       * Returns array of { start: lineNum, end: lineNum } objects.
       */
      var ranges = [];
      var keywords = ['requires', 'imports', 'exports', 'javaImports'];
      var keywordPattern = new RegExp(
        '\\b(' + keywords.join('|') + ')\\s*:\\s*\\[', 'g'
      );

      for ( var lineNum = 0 ; lineNum < lines.length ; lineNum++ ) {
        keywordPattern.lastIndex = 0;
        var match = keywordPattern.exec(lines[lineNum]);
        if ( ! match ) continue;

        // Found opening bracket — track depth to find closing bracket
        var depth  = 0;
        var started = false;
        var startLine = lineNum;
        for ( var i = lineNum ; i < lines.length ; i++ ) {
          var line = lines[i];
          for ( var c = (i === lineNum ? match.index : 0) ; c < line.length ; c++ ) {
            if ( line[c] === '[' ) { depth++; started = true; }
            if ( line[c] === ']' ) { depth--; }
            if ( started && depth === 0 ) {
              ranges.push({ start: startLine, end: i });
              i = lines.length; // break outer
              break;
            }
          }
        }
      }
      return ranges;
    },

    function isInStructuralRange_(lineNum, ranges) {
      /** Returns true if lineNum falls within any structural range. */
      for ( var i = 0 ; i < ranges.length ; i++ ) {
        if ( lineNum >= ranges[i].start && lineNum <= ranges[i].end ) return true;
      }
      return false;
    },

    function isInStringLiteral_(line, charIndex) {
      /**
       * Returns true if charIndex falls inside a string literal on this line.
       * Handles single quotes, double quotes, and backtick template literals.
       */
      var inSingle = false;
      var inDouble = false;
      var inTick   = false;
      for ( var i = 0 ; i < charIndex ; i++ ) {
        var ch = line[i];
        // Skip escaped characters
        if ( ch === '\\' ) { i++; continue; }
        if ( ch === "'" && ! inDouble && ! inTick ) { inSingle = ! inSingle; continue; }
        if ( ch === '"' && ! inSingle && ! inTick ) { inDouble = ! inDouble; continue; }
        if ( ch === '`' && ! inSingle && ! inDouble ) { inTick = ! inTick; continue; }
      }
      return inSingle || inDouble || inTick;
    },

    function collectCSSTokens_(text, model, tokens) {
      /**
       * Full CSS syntax highlighting inside css: backtick blocks.
       *
       * Token types: 0=type, 1=class, 2=variable, 3=keyword, 4=string,
       * 5=comment, 6=number, 7=operator, 8=method
       *
       * Highlights:
       * - $tokenName        → variable (2)
       * - ^ and ^name       → type (0)
       * - CSS property names → keyword (3)
       * - CSS values         → string (4)
       * - Numbers with units → number (6)
       * - Hex colors         → number (6)
       * - Comments           → comment (5)
       * - !important         → operator (7)
       * - Selectors (.class) → class (1)
       */
      var cssStr = model.css;
      if ( ! cssStr || typeof cssStr !== 'string' ) return;

      var cssIndex = text.indexOf(cssStr);
      if ( cssIndex === -1 ) return;

      // Pre-compute line offsets
      var lineOffsets = [0];
      for ( var i = 0 ; i < text.length ; i++ ) {
        if ( text[i] === '\n' ) lineOffsets.push(i + 1);
      }

      function addToken(offset, length, type) {
        var lo = 0, hi = lineOffsets.length - 1;
        while ( lo < hi ) {
          var mid = (lo + hi + 1) >> 1;
          if ( lineOffsets[mid] <= offset ) lo = mid; else hi = mid - 1;
        }
        tokens.push({ line: lo, char: offset - lineOffsets[lo], length: length, type: type, modifiers: 0 });
      }

      var base = cssIndex;
      var match;

      // Comments: /* ... */
      var commentRegex = /\/\*[\s\S]*?\*\//g;
      while ( ( match = commentRegex.exec(cssStr) ) !== null ) {
        addToken(base + match.index, match[0].length, 5);
      }

      // $tokenName references (FOAM CSS tokens)
      var tokenVarPattern = /\$([a-zA-Z_][\w-]*)/g;
      while ( ( match = tokenVarPattern.exec(cssStr) ) !== null ) {
        addToken(base + match.index, match[0].length, 2);
      }

      // ^ and ^name selectors (FOAM myClass shorthand)
      var myClassPattern = /\^([a-zA-Z][\w-]*)?/g;
      while ( ( match = myClassPattern.exec(cssStr) ) !== null ) {
        addToken(base + match.index, match[0].length, 0);
      }

      // .className selectors
      var classSelectorPattern = /\.([a-zA-Z][\w-]*)/g;
      while ( ( match = classSelectorPattern.exec(cssStr) ) !== null ) {
        // Skip if inside a $token (e.g., don't match the dot in numbers like 0.8rem)
        if ( match.index > 0 && /\d/.test(cssStr[match.index - 1]) ) continue;
        addToken(base + match.index, match[0].length, 1);
      }

      // CSS property declarations: property-name: value;
      // Match "  property-name:" at the start of lines (indented)
      var propRegex = /^[ \t]+([\w-]+)\s*:/gm;
      while ( ( match = propRegex.exec(cssStr) ) !== null ) {
        var propName = match[1];
        var propStart = match.index + match[0].indexOf(propName);
        addToken(base + propStart, propName.length, 3);

        // Find the value between : and ; on this line
        var afterColon = match.index + match[0].length;
        var semiPos = cssStr.indexOf(';', afterColon);
        if ( semiPos === -1 ) continue;
        var valueStr = cssStr.substring(afterColon, semiPos).trim();
        if ( ! valueStr ) continue;

        // Skip values that are purely $tokenName (already highlighted as variable)
        if ( /^\$[\w-]+$/.test(valueStr) ) continue;
        // Skip values that contain $tokenName mixed with other text (e.g., "1px solid $borderLight")
        // — highlight the non-token parts only

        // Numbers with units: 8px, 1rem, 0.8rem, 100%, 1.5em
        var numUnitRegex = /(\d+\.?\d*)(px|em|rem|%|vh|vw|vmin|vmax|pt|ch|s|ms|deg|fr)?/g;
        var numMatch;
        var valueStart = cssStr.indexOf(valueStr, afterColon);
        while ( ( numMatch = numUnitRegex.exec(valueStr) ) !== null ) {
          addToken(base + valueStart + numMatch.index, numMatch[0].length, 6);
        }

        // Hex colors: #FFF, #FFFFFF, #0A4AC6
        var hexRegex = /#[0-9a-fA-F]{3,8}/g;
        var hexMatch;
        while ( ( hexMatch = hexRegex.exec(valueStr) ) !== null ) {
          addToken(base + valueStart + hexMatch.index, hexMatch[0].length, 6);
        }

        // CSS keyword values (common ones)
        var cssValueKeywords = /\b(none|auto|inherit|initial|unset|revert|flex|grid|block|inline|inline-block|inline-flex|contents|table|column|row|wrap|nowrap|center|start|end|stretch|space-between|space-around|space-evenly|baseline|normal|bold|bolder|lighter|italic|underline|solid|dashed|dotted|double|hidden|visible|scroll|relative|absolute|fixed|sticky|static|pointer|not-allowed|default|text|move|grab|grabbing|crosshair|help|wait|collapse|separate|transparent|currentColor|ease|ease-in|ease-out|ease-in-out|linear|forwards|backwards|both|infinite|alternate|running|paused|uppercase|lowercase|capitalize|nowrap|pre|pre-wrap|pre-line|break-word|break-all|keep-all|ellipsis|clip|cover|contain|fill|border-box|content-box|padding-box)\b/g;
        var kwMatch;
        while ( ( kwMatch = cssValueKeywords.exec(valueStr) ) !== null ) {
          // Skip if this is part of a $token
          var absPos = valueStart + kwMatch.index;
          if ( absPos > 0 && cssStr[absPos - 1] === '$' ) continue;
          addToken(base + absPos, kwMatch[0].length, 4);
        }
      }

      // !important
      var importantRegex = /!important/g;
      while ( ( match = importantRegex.exec(cssStr) ) !== null ) {
        addToken(base + match.index, match[0].length, 7);
      }
    },

    function collectJavaTokens_(text, model, tokens) {
      /**
       * Knowledge-driven Java syntax highlighting — uses the SAME resolution
       * logic as HoverHandler (via CursorAnalyzer.resolveJavaTypeName).
       * DRY: one source of truth for type/enum resolution.
       *
       * Token types: 0=type, 1=class, 2=variable, 3=keyword, 4=string,
       * 5=comment, 6=number, 7=operator, 8=method
       */
      var javaKeys = [
        'javaCode', 'javaPreSet', 'javaPostSet', 'javaFactory', 'javaGetter', 'javaSetter',
        'javaAdapt', 'javaCompare', 'javaComparePropertyToObject', 'javaComparePropertyToValue',
        'javaCloneProperty', 'javaDiffProperty', 'javaFormatJSON', 'javaJSONParser',
        'javaCSVParser', 'javaQueryParser', 'javaToCSV', 'javaToCSVLabel',
        'javaFromCSVLabelMapping', 'javaAssertValue', 'javaValidateObj',
        'javaCondition', 'javaValue', 'javaImports', 'code', 'serviceScript'
      ];
      var self = this;
      var classId = this.cache.getClassId(model);

      // Use registry class for refines — FOAM merges refinements into the original class
      var cls = self.index.getClass(classId);

      // Merge model's javaImports with the registry class's javaImports (for refines)
      var effectiveModel = model;
      if ( model.refines && cls && cls.model_ ) {
        effectiveModel = {
          javaImports: (model.javaImports || []).concat(cls.model_.javaImports || []),
          package: cls.model_.package || model.package
        };
      }

      // Build property set from registry (not manually)
      var propNames = {};
      if ( cls ) {
        var props = cls.getAxiomsByClass(foam.lang.Property);
        for ( var i = 0 ; i < props.length ; i++ ) propNames[props[i].name.toLowerCase()] = true;
      }
      (model.properties || []).forEach(function(p) {
        var name = typeof p === 'string' ? p : p.name;
        if ( name ) propNames[name.toLowerCase()] = true;
      });

      // Pre-compute line offsets for fast offset → line/col
      var lineOffsets = [0];
      for ( var i = 0 ; i < text.length ; i++ ) {
        if ( text[i] === '\n' ) lineOffsets.push(i + 1);
      }

      function addToken(absOffset, length, type) {
        var lo = 0, hi = lineOffsets.length - 1;
        while ( lo < hi ) {
          var mid = (lo + hi + 1) >> 1;
          if ( lineOffsets[mid] <= absOffset ) lo = mid; else hi = mid - 1;
        }
        tokens.push({ line: lo, char: absOffset - lineOffsets[lo], length: length, type: type, modifiers: 0 });
      }

      var JAVA_KEYWORDS = /\b(abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|extends|final|finally|float|for|goto|if|implements|import|instanceof|int|interface|long|native|new|null|package|private|protected|public|return|short|static|strictfp|super|switch|synchronized|this|throw|throws|transient|try|var|void|volatile|while|true|false)\b/g;

      // Cache type resolutions to avoid repeated registry scans
      var typeCache = {};
      function resolveType(name) {
        if ( typeCache[name] !== undefined ) return typeCache[name];
        // Use SAME resolution as HoverHandler → CursorAnalyzer.resolveJavaTypeName
        typeCache[name] = self.analyzer.resolveJavaTypeName(name, effectiveModel, self.index);
        return typeCache[name];
      }

      var usedOffsets = {};
      function scanJavaBlock(javaStr) {
        if ( ! javaStr || typeof javaStr !== 'string' ) return;
        // Find this Java string in the full text, skipping already-used offsets
        var searchFrom = 0;
        var baseOffset = -1;
        while ( true ) {
          baseOffset = text.indexOf(javaStr, searchFrom);
          if ( baseOffset === -1 ) return;
          if ( ! usedOffsets[baseOffset] ) { usedOffsets[baseOffset] = true; break; }
          searchFrom = baseOffset + 1;
        }

        // Comments
        var commentRegex = /\/\/[^\n]*|\/\*[\s\S]*?\*\//g;
        var cm;
        while ( ( cm = commentRegex.exec(javaStr) ) !== null ) {
          addToken(baseOffset + cm.index, cm[0].length, 5);
        }

        // String literals
        var strRegex = /"(?:[^"\\]|\\.)*"|'[^']*'/g;
        var sm;
        while ( ( sm = strRegex.exec(javaStr) ) !== null ) {
          addToken(baseOffset + sm.index, sm[0].length, 4);
        }

        // Java keywords
        JAVA_KEYWORDS.lastIndex = 0;
        var kw;
        while ( ( kw = JAVA_KEYWORDS.exec(javaStr) ) !== null ) {
          addToken(baseOffset + kw.index, kw[1].length, 3);
        }

        // Numbers
        var numRegex = /\b\d+[lLfFdD]?\b/g;
        var nm;
        while ( ( nm = numRegex.exec(javaStr) ) !== null ) {
          addToken(baseOffset + nm.index, nm[0].length, 6);
        }

        // Type names — resolved via CursorAnalyzer.resolveJavaTypeName (same as hover)
        var typeRegex = /\b([A-Z][a-zA-Z0-9_]*)\b/g;
        var tm;
        while ( ( tm = typeRegex.exec(javaStr) ) !== null ) {
          if ( resolveType(tm[1]) ) {
            addToken(baseOffset + tm.index, tm[1].length, 0);
          }
        }

        // Java variable declarations + usage tracking
        // Track declared variables so we can highlight their usage throughout the block
        // 'x' is always available as the FOAM context (foam.lang.X)
        var declaredVars = { x: true };
        var varDeclRegex = /\b(\w+)\s+([a-z]\w*)\s*[=;]/g;
        var vd;
        while ( ( vd = varDeclRegex.exec(javaStr) ) !== null ) {
          var declType = vd[1];
          if ( /^(if|for|while|try|catch|throw|return|new|else|var|int|long|float|double|boolean|byte|short|char|void)$/.test(declType) ) {
            if ( declType === 'var' || /^(int|long|float|double|boolean|byte|short|char)$/.test(declType) ) {
              var vOffset = vd.index + vd[0].indexOf(vd[2]);
              addToken(baseOffset + vOffset, vd[2].length, 2);
              declaredVars[vd[2]] = true;
            }
            continue;
          }
          if ( resolveType(declType) ) {
            var vOffset = vd.index + vd[0].indexOf(vd[2]);
            addToken(baseOffset + vOffset, vd[2].length, 2);
            declaredVars[vd[2]] = true;
          }
        }
        var genericDeclRegex = /(\w+)\s*<[^>]*>\s+([a-z]\w*)\s*[=;]/g;
        var gd;
        while ( ( gd = genericDeclRegex.exec(javaStr) ) !== null ) {
          var vOffset = gd.index + gd[0].indexOf(gd[2]);
          addToken(baseOffset + vOffset, gd[2].length, 2);
          declaredVars[gd[2]] = true;
        }
        var forEachRegex = /\bfor\s*\(\s*(\w+)\s+([a-z]\w*)\s*:/g;
        var fe;
        while ( ( fe = forEachRegex.exec(javaStr) ) !== null ) {
          var vOffset = fe.index + fe[0].indexOf(fe[2]);
          addToken(baseOffset + vOffset, fe[2].length, 2);
          declaredVars[fe[2]] = true;
        }
        var catchRegex = /\bcatch\s*\(\s*(\w+)\s+([a-z]\w*)\s*\)/g;
        var ce;
        while ( ( ce = catchRegex.exec(javaStr) ) !== null ) {
          var vOffset = ce.index + ce[0].indexOf(ce[2]);
          addToken(baseOffset + vOffset, ce[2].length, 2);
          declaredVars[ce[2]] = true;
        }

        // Variable usage — highlight each declared variable throughout the block
        for ( var varName in declaredVars ) {
          if ( varName.length < 2 ) continue;
          var vuRegex = new RegExp('\\b' + varName + '\\b', 'g');
          var vu;
          while ( ( vu = vuRegex.exec(javaStr) ) !== null ) {
            addToken(baseOffset + vu.index, varName.length, 2);
          }
        }

        // Enum values: ClassName.VALUE — resolved via same resolveType + getEnumValues
        var enumRegex = /\b([A-Z]\w*)\.([A-Z][A-Z0-9_]+)\b/g;
        var em;
        while ( ( em = enumRegex.exec(javaStr) ) !== null ) {
          var enumFullId = resolveType(em[1]);
          if ( enumFullId ) {
            var enumVals = self.index.getEnumValues(enumFullId);
            for ( var i = 0 ; i < enumVals.length ; i++ ) {
              if ( enumVals[i].name === em[2] ) {
                addToken(baseOffset + em.index + em[1].length + 1, em[2].length, 2);
                break;
              }
            }
          }
        }

        // Getter/setter calls — verified against known properties OR cast target properties
        // Uses CursorAnalyzer.resolveJavaCastType for cast resolution (DRY)
        var getSetRegex = /(get|set)([A-Z][a-zA-Z0-9_]*)\s*\(/g;
        var gs;
        while ( ( gs = getSetRegex.exec(javaStr) ) !== null ) {
          var propName = gs[2].charAt(0).toLowerCase() + gs[2].substring(1);
          var known = propNames[propName.toLowerCase()];

          // If not on current model, check cast via CursorAnalyzer
          if ( ! known ) {
            var lineStart = javaStr.lastIndexOf('\n', gs.index) + 1;
            var lineEnd = javaStr.indexOf('\n', gs.index);
            if ( lineEnd === -1 ) lineEnd = javaStr.length;
            var javaLine = javaStr.substring(lineStart, lineEnd);
            var castInfo = self.analyzer.resolveJavaCastType(javaLine, effectiveModel, self.index);
            if ( castInfo && castInfo.classId ) {
              var castProps = self.index.getProperties(castInfo.classId);
              for ( var i = 0 ; i < castProps.length ; i++ ) {
                if ( castProps[i].name.toLowerCase() === propName.toLowerCase() ) { known = true; break; }
              }
            }
          }

          if ( known ) {
            addToken(baseOffset + gs.index, gs[1].length + gs[2].length, 8);
          }
        }
      }

      // Scan model-level, property-level, AND method-level Java blocks
      javaKeys.forEach(function(key) { scanJavaBlock(model[key]); });
      (model.properties || []).forEach(function(p) {
        if ( typeof p !== 'object' ) return;
        javaKeys.forEach(function(key) { scanJavaBlock(p[key]); });
      });
      (model.methods || []).forEach(function(m) {
        if ( typeof m !== 'object' ) return;
        javaKeys.forEach(function(key) { scanJavaBlock(m[key]); });
      });
    },

    function encodeTokens_(tokens) {
      /**
       * Encode tokens as flat array of relative deltas per LSP spec:
       * [deltaLine, deltaStartChar, length, tokenType, tokenModifiers]
       */
      var data = [];
      var prevLine = 0;
      var prevChar = 0;
      for ( var i = 0 ; i < tokens.length ; i++ ) {
        var t = tokens[i];
        var deltaLine = t.line - prevLine;
        var deltaChar = deltaLine === 0 ? t.char - prevChar : t.char;
        data.push(deltaLine, deltaChar, t.length, t.type, t.modifiers);
        prevLine = t.line;
        prevChar = t.char;
      }
      return { data: data };
    }
  ]
});
