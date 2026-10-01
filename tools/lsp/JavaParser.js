/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp',
  name: 'JavaParser',
  extends: 'foam.parse.lsp.JavaGrammar',

  documentation: `
    Parses .java files using the FOAM grammar.

    The grammar (JavaGrammar) does the actual structural parsing — it
    knows what's a method signature vs a comment vs a control flow
    statement. Actions on each symbol push parsed nodes into result_.

    Position tracking uses an apply callback on the StringPStream:
    when a tagged symbol successfully matches, we capture pStream.pos
    before and after, then convert to line numbers.

    parseFile(text) returns:
      { package, imports, classes, methods, calls, casts, news, locals,
        idents, strings, comments }
    where:
      methods  = [{ name, sig, returnType, params, modifiers, doc, line }]
      calls    = [{ receiver, methodName, line, col, recvCol, methodCol }]
      casts    = [{ typeName, line, col }]
      news     = [{ typeName, line, col }]
      locals   = [{ typeName, varName, line, col }]
      idents   = [{ name, line, col }]   // bare identifiers — used for enum constants
      strings  = [{ start, end, line, col }]  // string/char literal spans
      comments = [{ start, end, line, col }]  // // and /* */ spans
    start/end are character offsets into the parsed text (parseBlock does
    NOT shift them — only line/col land in the host file).

    parseBlock(text, baseLine, baseCol) returns the same shape but with
    per-token positions offset so positions land in the host file.
  `,

  requires: [
    'foam.parse.StringPStream'
  ],

  methods: [
    function parseFile(text) {
      var lineOffsets = [0];
      for ( var i = 0 ; i < text.length ; i++ ) {
        if ( text[i] === '\n' ) lineOffsets.push(i + 1);
      }
      var offsetToLine = function(offset) {
        var lo = 0, hi = lineOffsets.length - 1;
        while ( lo < hi ) {
          var mid = (lo + hi + 1) >> 1;
          if ( lineOffsets[mid] <= offset ) lo = mid; else hi = mid - 1;
        }
        return lo;
      };

      var result = {
        'package': null, imports: [], classes: [], methods: [],
        calls: [], casts: [], news: [], locals: [], idents: [],
        strings: [], comments: []
      };
      var captured = []; // { kind, startPos, endPos, value }

      // The apply callback observes every parser application. We watch
      // the parser stack via toString() to identify when high-level
      // grammar symbols match successfully.
      // Use msg() decorators in the grammar to mark trackable symbols.
      // The apply callback fires for every parser, and if the parser is
      // a Msg decorator AND the parse succeeded, we capture its position.
      var apply = function(p, grammar) {
        var startPos = this.pos;
        var res = p.parse(this, grammar);
        if ( res && p.msg ) {
          var msgVal = p.msg();
          if ( msgVal && msgVal.kind ) {
            // res is the new PStream after successful parse; res.pos is end
            var endPos = res.pos !== undefined ? res.pos : this.pos;
            captured.push({
              kind: msgVal.kind,
              startPos: startPos,
              endPos: endPos,
              text: text.substring(startPos, endPos)
            });
          }
        }
        return res;
      };

      try {
        this.parseString(text, 'START', apply);
      } catch (e) {}

      // Map line offsets to col-of-first-char so we can compute column.
      var offsetToCol = function(offset) {
        var ln = offsetToLine(offset);
        return offset - lineOffsets[ln];
      };

      // Process captured nodes
      var seen = {}; // dedup by startPos+kind

      for ( var n = 0 ; n < captured.length ; n++ ) {
        var node = captured[n];
        var key = node.kind + ':' + node.startPos;
        if ( seen[key] ) continue;
        seen[key] = true;
        var line = offsetToLine(node.startPos);
        var col  = offsetToCol(node.startPos);

        if ( node.kind === 'package' ) {
          var pname = this.extractPackageName_(node.text);
          if ( pname ) result['package'] = pname;
        } else if ( node.kind === 'import' ) {
          var iname = this.extractImportName_(node.text);
          if ( iname ) result.imports.push({ name: iname, line: line });
        } else if ( node.kind === 'classDecl' ) {
          var cinfo = this.extractClassInfo_(node.text);
          if ( cinfo ) { cinfo.line = line; result.classes.push(cinfo); }
        } else if ( node.kind === 'methodSig' ) {
          var minfo = this.extractMethodInfo_(node.text);
          if ( ! minfo ) continue;
          if ( /^(if|for|while|switch|catch|return|throw|do|else|try)$/.test(minfo.name) ) continue;
          if ( minfo.name === 'getName' || minfo.name === 'call' ) continue;
          minfo.line = line;
          minfo.doc = this.findJavadoc_(text, node.startPos);
          result.methods.push(minfo);
        } else if ( node.kind === 'qualifiedCall' ) {
          var qc = this.extractQualifiedCall_(node.text, node.startPos,
            offsetToLine, offsetToCol);
          if ( qc ) result.calls.push(qc);
        } else if ( node.kind === 'castExpr' ) {
          var ce = this.extractTypeFromSpan_(node.text, /\(\s*([A-Z][\w.$]*)/,
            node.startPos, offsetToLine, offsetToCol);
          if ( ce ) result.casts.push(ce);
        } else if ( node.kind === 'newExpr' ) {
          var ne = this.extractTypeFromSpan_(node.text, /new\s+([A-Z][\w.$]*)/,
            node.startPos, offsetToLine, offsetToCol);
          if ( ne ) result.news.push(ne);
        } else if ( node.kind === 'localDecl' ) {
          var ldExt = this.extractLocalDecl_(node.text, node.startPos,
            offsetToLine, offsetToCol);
          if ( ldExt ) result.locals.push(ldExt);
        } else if ( node.kind === 'varDecl' ) {
          var vdExt = this.extractVarDecl_(node.text, node.startPos,
            offsetToLine, offsetToCol);
          if ( vdExt ) result.locals.push(vdExt);
        } else if ( node.kind === 'stringLit' || node.kind === 'charLit' ) {
          result.strings.push({ start: node.startPos, end: node.endPos, line: line, col: col });
        } else if ( node.kind === 'lineComment' || node.kind === 'blockComment' ) {
          result.comments.push({ start: node.startPos, end: node.endPos, line: line, col: col });
        } else if ( node.kind === 'identTok' ) {
          // Bare identifiers — useful for enum-constant detection (a
          // standalone TypeName.UPPER_VALUE shows up as two adjacent
          // identTok captures).
          result.idents.push({ name: node.text, line: line, col: col });
        }
      }

      return result;
    },

    function parseBlock(text, baseLine, baseCol) {
      /**
       * Parse a Java fragment (e.g., the contents of a javaCode: backtick
       * block) and return parseFile()'s structure with all positions
       * shifted so they land in the host file.
       *
       * baseLine/baseCol point at the first character of `text` in the
       * host file. Newlines within `text` push following positions to
       * line baseLine + N, with col reset to that line's offset within
       * the block. The first line is offset by baseCol; subsequent lines
       * start at column 0.
       */
      var raw = this.parseFile(text);

      var shift = function(ln, c) {
        return {
          line: baseLine + ln,
          col:  ln === 0 ? baseCol + c : c
        };
      };

      var arrShift = function(arr, lineKey, colKey) {
        for ( var i = 0 ; i < arr.length ; i++ ) {
          var s = shift(arr[i][lineKey || 'line'], arr[i][colKey || 'col']);
          arr[i][lineKey || 'line'] = s.line;
          arr[i][colKey  || 'col']  = s.col;
        }
      };

      arrShift(raw.imports);
      arrShift(raw.classes);
      arrShift(raw.methods);
      arrShift(raw.casts);
      arrShift(raw.news);
      arrShift(raw.idents);
      // strings/comments: line/col shift only — start/end stay block-relative
      arrShift(raw.strings);
      arrShift(raw.comments);

      // calls have receiver + method positions
      for ( var i = 0 ; i < raw.calls.length ; i++ ) {
        var c = raw.calls[i];
        if ( c.recvLine != null ) {
          var rs = shift(c.recvLine, c.recvCol);
          c.recvLine = rs.line; c.recvCol = rs.col;
        }
        var ms = shift(c.line, c.col);
        c.line = ms.line; c.col = ms.col;
        c.methodCol = c.col;
      }

      // locals have type + name positions
      for ( var i = 0 ; i < raw.locals.length ; i++ ) {
        var l = raw.locals[i];
        var ts = shift(l.line, l.col);
        l.line = ts.line; l.col = ts.col;
        if ( l.nameLine != null ) {
          var ns = shift(l.nameLine, l.nameCol);
          l.nameLine = ns.line; l.nameCol = ns.col;
        }
      }

      return raw;
    },

    // ===== Helpers to extract structured info from grammar-validated text =====

    function extractPackageName_(text) {
      // text is "package foo.bar;"
      var idx = text.indexOf('package');
      if ( idx === -1 ) return null;
      var rest = text.substring(idx + 7).trim();
      var end = rest.indexOf(';');
      return end !== -1 ? rest.substring(0, end).trim() : null;
    },

    function extractImportName_(text) {
      // text is "import [static] foo.Bar;"
      var idx = text.indexOf('import');
      if ( idx === -1 ) return null;
      var rest = text.substring(idx + 6).trim();
      if ( rest.indexOf('static') === 0 ) rest = rest.substring(6).trim();
      var end = rest.indexOf(';');
      return end !== -1 ? rest.substring(0, end).trim() : rest.trim();
    },

    function extractClassInfo_(text) {
      // text is "[modifiers] (class|interface|enum) Name"
      for ( var k = 0 ; k < 3 ; k++ ) {
        var kind = ['class', 'interface', 'enum'][k];
        var idx = text.indexOf(kind);
        if ( idx === -1 ) continue;
        // Verify it's a word boundary
        if ( idx > 0 && /\w/.test(text[idx - 1]) ) continue;
        var afterKw = idx + kind.length;
        if ( afterKw >= text.length || /\w/.test(text[afterKw]) ) continue;
        var rest = text.substring(afterKw).trim();
        var nameMatch = /^(\w+)/.exec(rest);
        if ( nameMatch ) return { name: nameMatch[1], kind: kind };
      }
      return null;
    },

    function extractMethodInfo_(text) {
      /** Split a grammar-validated method signature into structured parts. */
      // Strip throws clause
      var throwsIdx = text.search(/\)\s*throws\b/);
      if ( throwsIdx !== -1 ) text = text.substring(0, throwsIdx + 1);

      var parenIdx = text.indexOf('(');
      if ( parenIdx === -1 ) return null;
      var paramsEnd = text.lastIndexOf(')');
      var beforeParen = text.substring(0, parenIdx).trim();
      var params = paramsEnd > parenIdx ? text.substring(parenIdx + 1, paramsEnd).trim() : '';

      // Tokenize respecting <generics>
      var tokens = this.tokenizeJavaSig_(beforeParen);
      if ( tokens.length < 2 ) return null;

      var name = tokens[tokens.length - 1];
      var returnType = tokens[tokens.length - 2];
      var modifiers = tokens.slice(0, tokens.length - 2);

      return {
        name: name,
        returnType: returnType,
        params: params,
        modifiers: modifiers,
        sig: returnType + ' ' + name + '(' + params + ')'
      };
    },

    function tokenizeJavaSig_(text) {
      var tokens = [];
      var current = '';
      var depth = 0;
      for ( var i = 0 ; i < text.length ; i++ ) {
        var ch = text[i];
        if ( ch === '<' ) { depth++; current += ch; }
        else if ( ch === '>' ) { depth--; current += ch; }
        else if ( /\s/.test(ch) && depth === 0 ) {
          if ( current ) { tokens.push(current); current = ''; }
        } else {
          current += ch;
        }
      }
      if ( current ) tokens.push(current);
      return tokens;
    },

    function extractQualifiedCall_(span, spanStart, offsetToLine, offsetToCol) {
      /**
       * span looks like "Loggers.logger(" (whitespace allowed). The outer
       * `qualifiedCall` rule guarantees the shape <ident>.<ident> ws? `(`.
       * Recover receiver and method positions by re-locating each in span.
       */
      var m = span.match(/^([A-Za-z_$][\w$]*)\s*\.\s*([A-Za-z_$][\w$]*)/);
      if ( ! m ) return null;
      var recvName   = m[1];
      var methodName = m[2];
      var recvOff    = spanStart + span.indexOf(recvName);
      var methodOff  = spanStart + span.indexOf(methodName, span.indexOf(recvName) + recvName.length);
      return {
        receiver:   recvName,
        methodName: methodName,
        line:       offsetToLine(methodOff),
        col:        offsetToCol(methodOff),
        recvLine:   offsetToLine(recvOff),
        recvCol:    offsetToCol(recvOff),
        methodCol:  offsetToCol(methodOff)
      };
    },

    function extractTypeFromSpan_(span, regex, spanStart, offsetToLine, offsetToCol) {
      /**
       * Generic helper: regex captures a single type identifier inside the
       * outer span. Returns position info for the captured type. Used for
       * castExpr and newExpr where the upper-case-typed slot is the only
       * navigation target.
       */
      var m = span.match(regex);
      if ( ! m ) return null;
      var typeName = m[1];
      var typeOff  = spanStart + span.indexOf(typeName);
      return {
        typeName: typeName,
        line: offsetToLine(typeOff),
        col:  offsetToCol(typeOff)
      };
    },

    function extractVarDecl_(span, spanStart, offsetToLine, offsetToCol) {
      /**
       * span looks like "var v = new Foo();" or "var x = (Foo) bar;"
       * or "var y = Foo.create()".
       * Recovers: var name + inferred type from the RHS shape. Tries
       * (in order): `new T(`, `(T)`, `T.method(`, literal `T.class`.
       * Returns null if no type can be inferred — we don't want to add
       * a typeless entry to result.locals.
       */
      var nameMatch = span.match(/^var\s+([A-Za-z_$][\w$]*)\s*=/);
      if ( ! nameMatch ) return null;
      var varName = nameMatch[1];
      var rhs = span.substring(nameMatch[0].length);

      // RHS type inference — order matters (most specific first).
      var typeName = null;
      var newM = rhs.match(/^\s*new\s+([A-Z][\w.$]*)/);
      if ( newM ) {
        typeName = newM[1];
      } else {
        // Cast accepts optional generics between the type and `)`:
        // `(Foo)`, `(Foo<String>)`, `(Foo<Map<K,V>>)`. Strip generics
        // for the result so the typeName is the bare class.
        var castM = rhs.match(/^\s*\(\s*([A-Z][\w.$]*)\s*(?:<[^()]*>)?\s*\)/);
        if ( castM ) {
          typeName = castM[1];
        } else {
          var staticM = rhs.match(/^\s*([A-Z][\w.$]*)\s*\.[A-Za-z_$][\w$]*\s*\(/);
          if ( staticM ) typeName = staticM[1];
          else {
            var classLitM = rhs.match(/^\s*([A-Z][\w.$]*)\s*\.class\b/);
            if ( classLitM ) typeName = classLitM[1] + '.class';
          }
        }
      }
      if ( ! typeName ) return null;

      var nameOff = spanStart + span.indexOf(varName);
      // For inferred-type vars, `line/col` points at the `var` keyword
      // (so go-to-def lands on the declaration), and nameLine/nameCol
      // point at the name itself.
      return {
        typeName: typeName, varName: varName,
        line: offsetToLine(spanStart),
        col:  offsetToCol(spanStart),
        nameLine: offsetToLine(nameOff),
        nameCol:  offsetToCol(nameOff),
        inferred_: true
      };
    },

    function extractLocalDecl_(span, spanStart, offsetToLine, offsetToCol) {
      /**
       * span looks like "Logger logger =", "List<String> items;", or
       * "ConfigMatrix configMatrix=". Recover type and var name positions.
       */
      var m = span.match(/^([A-Z][\w.$]*)(?:\s*<[^>]*>)?\s+([A-Za-z_$][\w$]*)/);
      if ( ! m ) return null;
      var typeName = m[1];
      var varName  = m[2];
      var typeOff  = spanStart + span.indexOf(typeName);
      var nameOff  = spanStart + span.indexOf(varName, typeOff - spanStart + typeName.length);
      return {
        typeName: typeName, varName: varName,
        line:     offsetToLine(typeOff),
        col:      offsetToCol(typeOff),
        nameLine: offsetToLine(nameOff),
        nameCol:  offsetToCol(nameOff)
      };
    },

    function findJavadoc_(text, beforeOffset) {
      if ( beforeOffset <= 0 ) return '';
      var start = Math.max(0, beforeOffset - 500);
      var slice = text.substring(start, beforeOffset);
      var openIdx = slice.lastIndexOf('/**');
      if ( openIdx === -1 ) return '';
      var closeIdx = slice.indexOf('*/', openIdx);
      if ( closeIdx === -1 ) return '';
      var raw = slice.substring(openIdx + 3, closeIdx);
      return raw.replace(/\s*\*\s*/g, ' ').trim();
    }
  ]
});
