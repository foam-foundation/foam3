/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'I18nHandler',

  documentation: 'i18n logic for the LSP: extract-to-messages edit building, missing-language scanning, messageMap edits, and translate-command execution. Extracted from DiagnosticsHandler (2026-08); see docs for foam3#5283.',

  requires: [
    'foam.parse.lsp.FoamIndex',
    'foam.parse.lsp.FileModelCache',
    'foam.parse.lsp.CursorAnalyzer'
  ],

  properties: [
    { class: 'FObjectProperty', of: 'foam.parse.lsp.FoamIndex',       name: 'index',    factory: function() { return this.FoamIndex.create(); } },
    { class: 'FObjectProperty', of: 'foam.parse.lsp.FileModelCache',  name: 'cache',    factory: function() { return this.FileModelCache.create(); } },
    { class: 'FObjectProperty', of: 'foam.parse.lsp.CursorAnalyzer',  name: 'analyzer', factory: function() { return this.CursorAnalyzer.create(); } }
  ],

  methods: [
    // MOVED VERBATIM from DiagnosticsHandler:
    //   constantizeMessageName_, collectAxiomConstants_, findAddLiteral_,
    //   literalSpanFromRange_, buildAddExtractEdit, findNewMessagesInsertion_
    // plus a private copy of escapeRegex_ (DiagnosticsHandler keeps its own —
    // isCollectionAddReceiver_ still uses it there).
    function escapeRegex_(s) {
      return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    function constantizeMessageName_(s, opt_taken) {
      /** 'Upload Complete' -> 'UPLOAD_COMPLETE_MSG'; safe, unique FOAM message
       *  constant. The _MSG suffix keeps the generated constant out of the
       *  property/action namespace — a 'fileName' property already installs a
       *  FILE_NAME constant, so extracting the label 'File Name' to a bare
       *  FILE_NAME would clash. opt_taken is the set of names already defined on
       *  the model; on any remaining clash a numeric suffix is appended until
       *  free (FILE_NAME_MSG, FILE_NAME_MSG2, ...). */
      var up = String(s).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      if ( ! up ) up = 'MESSAGE';
      if ( /^[0-9]/.test(up) ) up = 'M_' + up;     // an identifier can't start with a digit
      var base = up + '_MSG';
      if ( ! opt_taken ) return base;
      var name = base, n = 2;
      while ( opt_taken[name] ) name = base + (n++);
      return name;
    },

    function collectAxiomConstants_(text, uri) {
      /** Names already defined as constant-style members on the file's single
       *  model, so an extracted message name can dodge them. Holds the CONSTANT
       *  form of every own + inherited property and action (FOAM installs a
       *  FILE_NAME constant for a 'fileName' property) plus existing message /
       *  constant names (already constant-cased). */
      var taken = {};
      var models = this.cache.getModels(uri || '', text);
      if ( ! models || ! models.length ) return taken;
      var model = models[0];
      var nameOf   = function(x) { return typeof x === 'string' ? x : ( x && x.name ); };
      var addConst = function(nm) { if ( nm ) taken[foam.String.constantize(nm)] = true; };
      var addRaw   = function(nm) { if ( nm ) taken[nm] = true; };

      var props = model.properties || [];
      for ( var i = 0 ; i < props.length ; i++ ) addConst(nameOf(props[i]));
      var acts = model.actions || [];
      for ( var i = 0 ; i < acts.length ; i++ ) addConst(nameOf(acts[i]));
      var msgs = model.messages || [];
      for ( var i = 0 ; i < msgs.length ; i++ ) addRaw(nameOf(msgs[i]));

      var consts = model.constants;
      if ( Array.isArray(consts) ) {
        for ( var i = 0 ; i < consts.length ; i++ ) addRaw(nameOf(consts[i]));
      } else if ( consts && typeof consts === 'object' ) {
        for ( var k in consts ) if ( Object.prototype.hasOwnProperty.call(consts, k) ) addRaw(k);
      }

      // Inherited properties — best effort; getProperties returns [] when the
      // class isn't registered (incomplete file mid-edit).
      var inherited = this.index.getProperties(this.cache.getClassId(model));
      if ( inherited ) {
        for ( var i = 0 ; i < inherited.length ; i++ ) addConst(inherited[i].name);
      }
      return taken;
    },

    function findAddLiteral_(text, messageText) {
      /** Locate `.add('messageText')` and return the {start,end} span of the
       *  quoted literal (quotes included), or null. */
      var re = new RegExp("\\.add\\(\\s*(['\"`])" + this.escapeRegex_(messageText) + "\\1");
      var m = re.exec(text);
      if ( ! m ) return null;
      var quoteRel = m[0].indexOf(m[1]);          // opening quote within the match
      var litStart = m.index + quoteRel;
      var litEnd = litStart + 1 + messageText.length + 1;  // open + text + close
      return { start: litStart, end: litEnd };
    },

    function literalSpanFromRange_(text, range) {
      /** {start, end, content} of the quoted literal for the occurrence the diagnostic
       *  range points at. The range covers the inner text (no quotes): the opening quote
       *  is one char before range.start and the closing quote is at range.end. Reading
       *  content straight from source (range as the source of truth) is robust to
       *  embedded quotes — unlike re-deriving length from a (possibly message-truncated)
       *  string. Returns null if the quotes don't line up. */
      if ( ! range || ! range.start || ! range.end ) return null;
      var innerStart = this.analyzer.positionToOffset(text, range.start);
      var innerEnd   = this.analyzer.positionToOffset(text, range.end);
      var open = innerStart - 1;
      if ( open < 0 || innerEnd <= innerStart || innerEnd >= text.length ) return null;
      var q = text[open];
      if ( q !== "'" && q !== '"' && q !== '`' ) return null;   // not a quoted literal here
      if ( text[innerEnd] !== q ) return null;                  // closing quote must match
      return { start: open, end: innerEnd + 1, content: text.substring(innerStart, innerEnd) };
    },

    function buildAddExtractEdit(text, messageText, uri, opt_range) {
      /**
       * Build the "extract to messages: entry" WorkspaceEdit for a hardcoded
       * .add('<messageText>') string: rewrite the usage to `this.<NAME>` and add
       * a `{ name, message }` entry (into an existing messages: array, or a new
       * one). Returns { changes: { [uri]: [edits] } } or null.
       *
       * opt_range (the triggering diagnostic's LSP range) pins the rewrite to the
       * exact occurrence — without it, a repeated identical string would rewrite the
       * first match. Falls back to the first .add() match only when no range is given.
       *
       * Scope safety: bail (null) unless there is exactly one top-level model and an
       * unambiguous single insertion target. Multiple `foam.CLASS(`, inline `classes:`,
       * or more than one `properties:`/`messages:` block → ambiguous → no autofix.
       *
       * Limitations:
       * - Diagnostics can appear in multi-model files, but the extract code action is
       *   intentionally disabled there; inserting `messages:` into the right model
       *   requires model-boundary parsing, not whole-file regexes.
       * - Inline inner `classes:` are skipped for the same reason: `messages:` or
       *   `properties:` could belong to either the outer model or an inner class.
       * - If the diagnostic range no longer lines up with the quoted literal, no edit is
       *   returned rather than risking a rewrite at the wrong occurrence.
       */
      var classMatches = text.match(/foam\.CLASS\s*\(/g);
      if ( ! classMatches || classMatches.length !== 1 ) return null;
      // Ambiguous nesting → the "first" messages:/properties: may belong to an inner class.
      if ( /\bclasses\s*:\s*\[/.test(text) ) return null;
      if ( ( text.match(/\bproperties\s*:\s*\[/g) || [] ).length > 1 ) return null;
      if ( ( text.match(/\bmessages\s*:\s*\[/g)   || [] ).length > 1 ) return null;

      // With a range, read the literal (and its content) straight from source — the
      // range is authoritative and handles embedded quotes; the passed messageText may
      // be truncated by the caller's message-reparse. Without a range, fall back to the
      // first .add() match of messageText.
      var usage, content;
      if ( opt_range ) {
        usage = this.literalSpanFromRange_(text, opt_range);
        if ( ! usage ) return null;
        content = usage.content;
      } else {
        usage = this.findAddLiteral_(text, messageText);
        if ( ! usage ) return null;
        content = messageText;
      }

      var name = this.constantizeMessageName_(content, this.collectAxiomConstants_(text, uri));
      var edits = [];

      // Rewrite the usage: 'messageText' -> this.NAME
      edits.push({
        range: {
          start: this.analyzer.offsetToPosition(text, usage.start),
          end:   this.analyzer.offsetToPosition(text, usage.end)
        },
        newText: 'this.' + name
      });

      // Add the messages entry. Reuse the verbatim source literal (quotes + already-
      // valid escaping) for the message: value — re-escaping the raw captured content
      // would double-escape an existing `\'` and produce invalid JS.
      var rawLiteral = text.substring(usage.start, usage.end);
      var entry = "{ name: '" + name + "', message: " + rawLiteral + " }";
      var msgArr = /messages\s*:\s*\[/.exec(text);
      if ( msgArr ) {
        var insAt = msgArr.index + msgArr[0].length;          // just after '['
        var p = this.analyzer.offsetToPosition(text, insAt);
        edits.push({ range: { start: p, end: p }, newText: '\n    ' + entry + ',' });
      } else {
        var ins = this.findNewMessagesInsertion_(text, entry);
        if ( ! ins ) return null;
        var p2 = this.analyzer.offsetToPosition(text, ins.offset);
        edits.push({ range: { start: p2, end: p2 }, newText: ins.newText });
      }

      var changes = {};
      changes[uri] = edits;
      return { changes: changes };
    },

    function findNewMessagesInsertion_(text, entry) {
      /**
       * Pick where to insert a brand-new `messages: [...]` block. Preference:
       *   1. Right before the FIRST top-level block — properties:/methods:/listeners:/
       *      actions:. This sits after the declarative header (package/name/extends/
       *      requires/imports) and before any body, so it never lands inside a method
       *      body object literal.
       *   2. Else after the last header key — requires/imports (arrays) or
       *      package/name/extends (strings).
       *   3. Else right after `foam.CLASS({`.
       * Returns { offset, newText } for a zero-width insert, or null.
       */
      // 1. Before the first properties:/methods:/listeners:/actions: block.
      // First match (not last) → the top-level block, never a body-nested key.
      var pm = /(^|\n)([ \t]*)(?:properties|methods|listeners|actions)\s*:/.exec(text);
      if ( pm ) {
        var indent = pm[2];
        var lineStart = pm.index + pm[1].length;   // start of that line's indent
        return {
          offset: lineStart,
          newText: indent + 'messages: [\n' + indent + '  ' + entry + '\n' + indent + '],\n'
        };
      }

      // 2. After the last header key
      var endOff = -1, endIndent = '  ';
      var strRe = /(^|\n)([ \t]*)(package|name|extends)\s*:\s*'[^']*'\s*,?/g, sm;
      while ( ( sm = strRe.exec(text) ) !== null ) {
        var e = sm.index + sm[0].length;
        if ( e > endOff ) { endOff = e; endIndent = sm[2]; }
      }
      var arrKeys = ['requires', 'imports'];
      for ( var k = 0 ; k < arrKeys.length ; k++ ) {
        var am = new RegExp('(^|\\n)([ \\t]*)' + arrKeys[k] + '\\s*:\\s*\\[').exec(text);
        if ( ! am ) continue;
        var i = am.index + am[0].length - 1;       // at the '['
        var depth = 0;
        for ( ; i < text.length ; i++ ) {
          if ( text[i] === '[' ) depth++;
          else if ( text[i] === ']' ) { depth--; if ( depth === 0 ) { i++; break; } }
        }
        if ( text[i] === ',' ) i++;                // include trailing comma
        if ( i > endOff ) { endOff = i; endIndent = am[2]; }
      }
      if ( endOff !== -1 ) {
        return {
          offset: endOff,
          newText: '\n' + endIndent + 'messages: [\n' + endIndent + '  ' + entry + '\n' + endIndent + '],'
        };
      }

      // 3. After foam.CLASS({
      var clsOpen = /foam\.CLASS\s*\(\s*\{/.exec(text);
      if ( ! clsOpen ) return null;
      var o = clsOpen.index + clsOpen[0].length;
      return { offset: o, newText: '\n  messages: [\n    ' + entry + '\n  ],' };
    }
  ]
});
