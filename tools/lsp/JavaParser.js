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
      { package, imports, classes, methods }
    where methods is [{ name, sig, returnType, params, modifiers, doc, line }].
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

      var result = { 'package': null, imports: [], classes: [], methods: [] };
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

      // Process captured nodes
      var seen = {}; // dedup by startPos+kind
      for ( var n = 0 ; n < captured.length ; n++ ) {
        var node = captured[n];
        var key = node.kind + ':' + node.startPos;
        if ( seen[key] ) continue;
        seen[key] = true;
        var line = offsetToLine(node.startPos);

        if ( node.kind === 'package' ) {
          var name = this.extractPackageName_(node.text);
          if ( name ) result['package'] = name;
        } else if ( node.kind === 'import' ) {
          var name = this.extractImportName_(node.text);
          if ( name ) result.imports.push({ name: name, line: line });
        } else if ( node.kind === 'classDecl' ) {
          var info = this.extractClassInfo_(node.text);
          if ( info ) { info.line = line; result.classes.push(info); }
        } else if ( node.kind === 'methodSig' ) {
          var info = this.extractMethodInfo_(node.text);
          if ( ! info ) continue;
          if ( /^(if|for|while|switch|catch|return|throw|do|else|try)$/.test(info.name) ) continue;
          if ( info.name === 'getName' || info.name === 'call' ) continue;
          info.line = line;
          info.doc = this.findJavadoc_(text, node.startPos);
          result.methods.push(info);
        }
      }

      return result;
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
