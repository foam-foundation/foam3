/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp',
  name: 'FoamClassGrammar',
  extends: 'foam.parse.Grammar',

  documentation: 'Grammar that parses foam.CLASS/ENUM/INTERFACE definitions with dynamic suggestions.',

  requires: [
    'foam.parse.lsp.AxiomCatalog',
    'foam.parse.lsp.FoamIndex'
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
      of: 'foam.parse.lsp.AxiomCatalog',
      name: 'catalog',
      factory: function() { return this.AxiomCatalog.create(); }
    },
    {
      name: 'classRefParser_',
      documentation: 'Cached alt() parser of all class ID suggestions.'
    },
    {
      name: 'propTypeParser_',
      documentation: 'Cached alt() parser of all property type suggestions.'
    },
    {
      name: 'classTypedKeyParser_',
      documentation: `Cached alt() parser matching any axiom slot name whose
        value is a class id (Class/Reference/FObjectProperty/FObjectArray on
        any registered model). Drives the generic classTypedSlotEntry rule.`
    },
    {
      name: 'symbols',
      factory: function() {
        var self = this;
        this.buildDynamicParsers_();
        var P = foam.parse.Parsers.create();
        var grammar = this.buildGrammar_(P);
        return foam.parse.Grammar.SYMBOLS.adapt.call(this, null, grammar);
      }
    }
  ],

  methods: [
    function collectAxiomPositions(text) {
      /**
       * Single-parse axiom-position index driven by the grammar itself.
       * The `messageNameValue` / `enumValueName` / (future) propertyName /
       * methodName rules are wrapped in `P.msg({kind: '...'})`. On successful
       * match their msg is emitted with the parser's start/end position —
       * exactly the info callers need to go-to-definition or build hover
       * targets.
       *
       * Returns:
       *   {
       *     message:  { NAME: { line, col, startPos, endPos } },
       *     value:    { NAME: { … } },
       *     property: { name: { … } },       // future
       *     method:   { name: { … } }        // future
       *   }
       *
       * Cached by text identity on the grammar instance.
       */
      if ( this.axiomCache_ && this.axiomCache_.text === text ) {
        return this.axiomCache_.map;
      }

      var self = this;
      var map = {
        message:     {}, value:    {}, property: {}, method:  {},
        pomFileName: {}, classRef: {}, comment:  {}, documentation: {},
        instCall: {}, instCreateReceiver: {}, instTagClass: {}, instClassRef: {},
        instKey: {}, instValue: {}, memberRef: {}
      };
      // Kinds that allow multiple occurrences per name. Single-occurrence
      // kinds (message, value, property, method, pomFileName) keep their
      // first sighting only — a model defines each name once. Class
      // references DO repeat (requires + extends + ofs + raw strings + …),
      // so collect every position.
      var MULTI = { classRef: true, comment: true, documentation: true,
        instCall: true, instCreateReceiver: true, instTagClass: true,
        instClassRef: true, instKey: true, instValue: true, memberRef: true };

      var apply = function(p, grammar) {
        var startPos = this.pos;
        var result = p.parse(this, grammar);
        if ( result && typeof p.msg === 'function' ) {
          var m = p.msg();
          if ( m && m.kind && map[m.kind] !== undefined ) {
            var endPos = result.pos;
            var name = text.substring(startPos, endPos);
            if ( name ) {
              var line = 0, col = 0;
              for ( var i = 0 ; i < startPos ; i++ ) {
                if ( text.charCodeAt(i) === 10 ) { line++; col = 0; } else col++;
              }
              var rec = {
                line: line, col: col,
                startPos: startPos, endPos: endPos
              };
              if ( MULTI[m.kind] ) {
                var arr = map[m.kind][name] || (map[m.kind][name] = []);
                arr.push(rec);
              } else if ( ! map[m.kind][name] ) {
                map[m.kind][name] = rec;
              }
            }
          }
        }
        return result;
      };

      var ps = foam.parse.StringPStream.create({
        str: text + String.fromCharCode(26),
        apply: apply
      });

      try { this.parse(ps); } catch ( e ) { /* partial results fine */ }

      this.axiomCache_ = { text: text, map: map };
      return map;
    },

    function collectRanges(text) {
      /** Comment + documentation-value spans, harvested from the grammar's
       *  P.msg(comment)/P.msg(documentation) emissions in a single parse.
       *  Dedupes by startPos (wsc is retried at the same offset during
       *  backtracking, so a comment can be recorded more than once). */
      var map = this.collectAxiomPositions(text);
      function flatten(byName) {
        var out = [], seen = {};
        for ( var name in byName ) {
          var arr = byName[name];
          if ( ! Array.isArray(arr) ) arr = [arr];
          for ( var i = 0 ; i < arr.length ; i++ ) {
            var rec = arr[i];
            if ( seen[rec.startPos] ) continue;
            seen[rec.startPos] = true;
            out.push({ startPos: rec.startPos, endPos: rec.endPos });
          }
        }
        return out;
      }
      return { comment: flatten(map.comment), documentation: flatten(map.documentation) };
    },

    function collectInstantiations(text) {
      /** Groups instKey/instValue under each instCall (by innermost span) and
       *  resolves the view class from instCreateReceiver (the receiver) or
       *  instTagClass (the .tag first arg). Grammar-driven — no regex.
       *  Returns [{ classText, isTag, callSpan, entries:[{ key, keyPos,
       *  valueText, valuePos }] }]. */
      var map = this.collectAxiomPositions(text);
      function recs(kind) {
        var byName = map[kind] || {}, out = [];
        for ( var n in byName ) {
          var a = byName[n];
          if ( ! Array.isArray(a) ) a = [a];
          for ( var i = 0 ; i < a.length ; i++ ) {
            out.push({ text: n, startPos: a[i].startPos, endPos: a[i].endPos });
          }
        }
        return out;
      }
      var calls = recs('instCall'), creators = recs('instCreateReceiver'),
          tags = recs('instTagClass'), classRefs = recs('instClassRef'),
          keys = recs('instKey'), vals = recs('instValue');
      function within(r, span) { return r.startPos >= span.startPos && r.endPos <= span.endPos; }
      function innermost(r) {
        var best = null;
        for ( var c = 0 ; c < calls.length ; c++ ) {
          if ( within(r, calls[c]) ) {
            if ( ! best || ( calls[c].endPos - calls[c].startPos ) < ( best.endPos - best.startPos ) ) {
              best = calls[c];
            }
          }
        }
        return best;
      }
      function firstIn(list, span) {
        var best = null;
        for ( var i = 0 ; i < list.length ; i++ ) {
          if ( within(list[i], span) && ( ! best || list[i].startPos < best.startPos ) ) best = list[i];
        }
        return best;
      }
      var out = [];
      for ( var c = 0 ; c < calls.length ; c++ ) {
        var span = calls[c];
        var tag = firstIn(tags, span);
        var classRef = firstIn(classRefs, span);   // { class: 'X', ... } form
        var creator = firstIn(creators, span);
        var classText = tag ? tag.text : ( classRef ? classRef.text : ( creator ? creator.text : null ) );
        if ( ! classText ) continue;
        if ( classText.indexOf('this.') === 0 ) classText = classText.substring(5);
        // keys/values that belong to THIS call (innermost containing call)
        var kIn = keys.filter(function(k) { var ic = innermost(k); return ic && ic.startPos === span.startPos; })
                      .sort(function(a, b) { return a.startPos - b.startPos; });
        var vIn = vals.filter(function(v) { var ic = innermost(v); return ic && ic.startPos === span.startPos; })
                      .sort(function(a, b) { return a.startPos - b.startPos; });
        var entries = [];
        for ( var i = 0 ; i < kIn.length ; i++ ) {
          var val = null;
          for ( var j = 0 ; j < vIn.length ; j++ ) {
            if ( vIn[j].startPos > kIn[i].startPos ) { val = vIn[j]; break; }
          }
          entries.push({
            key: kIn[i].text,
            keyPos: { startPos: kIn[i].startPos, endPos: kIn[i].endPos },
            valueText: val ? val.text : null,
            valuePos: val ? { startPos: val.startPos, endPos: val.endPos } : null
          });
        }
        out.push({ classText: classText, isTag: !! ( tag || classRef ),
          callSpan: { startPos: span.startPos, endPos: span.endPos }, entries: entries });
      }
      return out;
    },

    function findAxiomPosition(text, kind, name) {
      /** Convenience: lookup single axiom position. kind ∈ {'message','value','property','method'}. */
      var map = this.collectAxiomPositions(text);
      return ( map[kind] && map[kind][name] ) || null;
    },

    function collectDiagnostics(text) {
      /**
       * Parse `text` and collect diagnostic records from P.msg()-wrapped
       * parsers that succeeded. Each record is { startPos, endPos, msg }.
       * Callers interpret `msg` to produce a Diagnostic — e.g., the
       * 'unknownClassRef' msg is converted to an "Unknown class: X" warning
       * only if the matched text isn't in the class registry.
       *
       * No framework additions — uses the existing foam.parse.Msg decorator
       * which already carries an arbitrary message payload.
       */
      var records = [];

      var apply = function(p, grammar) {
        var startPos = this.pos;
        var result = p.parse(this, grammar);
        if ( result && typeof p.msg === 'function' ) {
          var m = p.msg();
          if ( m ) {
            // FOAM parsers are immutable — the new position is on `result`,
            // not on `this` (which still points to startPos).
            records.push({ startPos: startPos, endPos: result.pos, msg: m });
          }
        }
        return result;
      };

      var ps = foam.parse.StringPStream.create({
        str: text + String.fromCharCode(26),
        apply: apply
      });

      try {
        this.parse(ps);
      } catch ( e ) {
        // Partial results are fine.
      }

      return records;
    },

    function collectSuggestionsAt(text, cursorOffset) {
      /**
       * Parse `text` and collect suggestions from sug() parsers whose
       * failure/end position lands at or within 1 char of `cursorOffset`.
       * The caller is expected to have inserted a sentinel at cursorOffset
       * (via CursorSentinel) so parse failure is guaranteed exactly there.
       *
       * Uses SmartView-style maxPos tracking: a parser may advance through
       * valid prefix (e.g., `foam.u2.`) before hitting the sentinel — its
       * final pos marks the failure point and the relevant suggestions are
       * the ones that failed *at that point*. Deduplicates by text.
       */
      var seen = {};
      var suggestions = [];
      var maxPos = 0;

      var apply = function(p, grammar) {
        var startPos = this.pos;
        var result = p.parse(this, grammar);
        var endPos = this.pos;

        if ( endPos > maxPos ) maxPos = endPos;

        if ( ! result && p.suggest ) {
          // Two collection modes:
          //  (a) startPos is at cursor (empty-value case like `extends: ''`)
          //  (b) parser advanced to the cursor and failed there
          //      (partial-value case like `extends: 'foam.u2'`)
          var nearCursor = (startPos >= cursorOffset - 1 && startPos <= cursorOffset + 1)
                        || (endPos   >= cursorOffset - 1 && endPos   <= cursorOffset + 1);
          if ( nearCursor ) {
            var s = p.suggest();
            if ( s ) {
              var key = s.text || s.label;
              if ( key && ! seen[key] ) {
                seen[key] = true;
                suggestions.push(s);
              }
            }
          }
        }

        return result;
      };

      var ps = foam.parse.StringPStream.create({
        str: text + String.fromCharCode(26),
        apply: apply
      });

      try {
        this.parse(ps);
      } catch ( e ) {
        // Grammar errors are fine — suggestions are collected along the way
      }

      return suggestions;
    },

    function buildDynamicParsers_() {
      var self = this;
      var P = foam.parse.Parsers.create();

      // Property types — all subclasses of foam.lang.Property.
      // Only foam.lang.* types may be inserted by short name; every other
      // package must be inserted as its full class id so the generated code
      // resolves unambiguously (fixes issue where `class: 'foam.u2.ViewSpec'`
      // completed to bare `'ViewSpec'`).
      // Property type alts MUST be sorted longest-first. P.alt returns
      // the FIRST match — without the sort, `Double` would prefix-match
      // and short-circuit `DoubleUnitValue`/`UnitValue`, leaving the
      // `UnitValue` suffix to choke the outer rule. Same bug as the
      // classRefParser_ ordering below.
      var propTypes = this.index.getPropertyTypes().slice().sort(function(a, b) {
        return b.name.length - a.name.length;
      });
      var propTypeParsers = propTypes.map(function(t) {
        var isLang = t.id && t.id.indexOf('foam.lang.') === 0;
        var insertText = isLang ? t.name : t.id;
        return P.sug(P.literalIC(t.name), foam.parse.Suggestion.create({
          text: insertText,
          category: 'property',
          hint: t.doc || t.id
        }));
      });
      this.propTypeParser_ = propTypeParsers.length > 0 ?
        P.alt.apply(P, propTypeParsers) : P.literalIC('String');

      // Class references — all known class IDs, SORTED BY LENGTH DESCENDING.
      // Critical: `alt` returns the FIRST match, so longer ids must be tried
      // first. Otherwise a shorter prefix (e.g. `foam.mlang.Expr`) would
      // greedy-match inside `foam.mlang.Expressions`, consuming 14 chars and
      // leaving the outer seq stranded at `essions'`. We used to lose every
      // `implements: [ 'foam.mlang.Expressions' ]` to exactly this bug.
      var ids = this.index.getAllClassIds().slice().sort(function(a, b) {
        return b.length - a.length;
      });
      var classRefParsers = ids.map(function(id) {
        var cls = self.index.getClass(id);
        var doc = cls && cls.model_ ? ( cls.model_.documentation || '' ) : '';
        return P.sug(P.literal(id), foam.parse.Suggestion.create({
          text: id,
          category: 'class',
          hint: doc.substring(0, 80)
        }));
      });
      // Wrap with P.msg so collectAxiomPositions records every class
      // reference's position. Each msg carries `kind: 'classRef'`; the apply
      // hook routes those into `map.classRef[classId] = [positions...]` so
      // references handlers can find exact occurrences without text scan.
      var rawClassRef = classRefParsers.length > 0 ?
        P.alt.apply(P, classRefParsers) : P.literal('foam.lang.FObject');
      this.classRefParser_ = P.msg(rawClassRef, { kind: 'classRef' });

      // Class-typed axiom slot names — any axiom whose value is a class id.
      // Used by classTypedSlotEntry so a custom property like FSM `next`
      // (Class-typed) parses its `'foo.X'` value as a class reference
      // without the LSP knowing about FSM. Sorted longest-first to keep
      // alt() deterministic for prefix-overlapping names.
      var slotNames = this.index.getClassTypedPropertyNames().slice().sort(function(a, b) {
        return b.length - a.length;
      });
      // Skip names already handled by their own first-class entry to avoid
      // duplicate matching (extends/implements/refines/sourceModel/
      // targetModel/of/class/view).
      var handled = {
        'extends':     true, 'implements':  true, 'refines':     true,
        'sourceModel': true, 'targetModel': true,
        'of':          true, 'class':       true, 'view':        true
      };
      var classTypedKeyParsers = [];
      for ( var s = 0 ; s < slotNames.length ; s++ ) {
        if ( handled[slotNames[s]] ) continue;
        classTypedKeyParsers.push(P.literal(slotNames[s]));
      }
      this.classTypedKeyParser_ = classTypedKeyParsers.length > 0 ?
        P.alt.apply(P, classTypedKeyParsers) :
        // Fallback: if registry walk yielded nothing (unlikely), match a
        // sentinel that never appears so this rule simply never fires.
        P.literal('');
    },

    function buildGrammar_(P) {
      var self = this;

      // === PRIMITIVES ===
      // Reusable character classes — these are the primitive building
      // blocks. Defining them once and reusing them keeps the grammar
      // DRY and ensures every identifier-shaped position uses the same
      // tolerance (e.g., letters / digits / underscore / `$`).
      var lower = P.range('a', 'z');
      var upper = P.range('A', 'Z');
      var digit = P.range('0', '9');
      var alpha = P.alt(lower, upper);
      var alphaNum = P.alt(lower, upper, digit);

      // Whitespace primitives. `ws` is whitespace-only; `wsc` is the
      // whitespace + comments form used between grammar tokens.
      var lineComment = P.msg(P.seq(P.literal('//'), P.str(P.repeat(P.notChars('\n\r'), null, 0)),
        P.alt(P.literal('\r\n'), P.literal('\n'), P.literal('\r'))), { kind: 'comment' });
      var blockComment = P.msg(P.seq(P.literal('/*'), P.str(P.until(P.literal('*/')))), { kind: 'comment' });
      var wsChar = P.chars(' \t\n\r');
      var ws  = P.repeat0(wsChar);
      var wsc = P.repeat0(P.alt(wsChar, lineComment, blockComment));

      // String literals — three quote flavors share the same shape.
      function quotedString(qChar) {
        return P.seq1(1, P.literal(qChar),
          P.str(P.repeat(P.alt(P.literal('\\' + qChar), P.notChars(qChar)), null, 0)),
          P.literal(qChar));
      }
      var sqString       = quotedString("'");
      var dqString       = quotedString('"');
      var backtickString = quotedString('`');
      var stringLiteral  = P.alt(sqString, dqString, backtickString);

      var number = P.str(P.repeat(P.alt(digit, P.literal('.'), P.literal('-')), null, 1));
      var booleanLiteral = P.alt(P.literal('true'), P.literal('false'),
        P.literal('null'), P.literal('undefined'));

      // Identifier shapes. Plain ident = `[A-Za-z0-9_$]+`; dotted form
      // also accepts `.`. Centralized so future tweaks (e.g., adding
      // `-` for property names that allow it) hit one place.
      var identChars       = P.alt(alphaNum, P.chars('_$'));
      var dottedIdentChars = P.alt(alphaNum, P.chars('_.$'));
      var identifier = P.str(P.repeat(identChars, null, 1));
      var dottedId   = P.str(P.repeat(dottedIdentChars, null, 1));

      // === INSTANTIATION (F3) ===
      // Receiver chain for `X.create(` / `el.tag(`: (this.)? seg (.seg)*
      // that STOPS before the trailing `.create(` / `.tag(`. Negative
      // lookahead (P.not) keeps the rule from matching generic calls.
      var instMethodAhead = P.seq(P.alt(P.literal('create'), P.literal('tag')), wsc, P.literal('('));
      var classSeg = P.str(P.repeat(identChars, null, 1));
      var instReceiverChain = P.str(P.seq(
        P.optional(P.seq(P.literal('this'), P.literal('.'))),
        classSeg,
        P.repeat0(P.seq(P.literal('.'), P.seq(P.not(instMethodAhead), classSeg)))
      ));

      // Identifier-as-msg helper. The grammar has many `name: ` slots
      // that must emit a position-tagged msg for downstream handlers
      // (axiom-position lookups, references, definition jumps). All of
      // them use the same identifier shape, so route through one helper.
      function identMsg(kind) {
        return P.msg(P.str(P.repeat(identChars, null, 1)), { kind: kind });
      }

      // Suggestion-shaped key helpers. All four (key/topKey/propKey/
      // pomKey) emit a sug() with a label, category, and optional hint
      // — only the category differs. Generate the four flavors from one
      // factory so the suggestion shape stays in sync. LSP handler
      // maps all four categories to Keyword kind (14). The hint is
      // shown as the suggestion description in IDEs that render it
      // (e.g., VS Code shows it under the label).
      function makeKeyHelper(category) {
        return function(name, hint) {
          return P.sug(P.literal(name), foam.parse.Suggestion.create({
            text: name + ': ', category: category, hint: hint || ''
          }));
        };
      }

      // String-value rule helper — the canonical shape for any axiom
      // whose value is a quoted scalar inside the grammar (file names,
      // flag combinations, subproject paths, Java dep ids, etc.).
      //
      // Two responsibilities:
      //   1. At cursor — emit a Suggestion via P.sug(sentinel) so the
      //      completion handler knows what category to offer.
      //   2. Off cursor — match the value text up to the closing quote.
      //      stopChars defaults to BOTH quote styles so the same value
      //      parser works whether the caller used single or double
      //      quotes around it. Forgetting one quote was the source of
      //      a runaway-match bug that swallowed entire POM files.
      //
      // If `msgKind` is provided the off-cursor branch is wrapped in
      // P.msg({kind}) so collectAxiomPositions records the value span.
      function stringValueRule(opts) {
        opts = opts || {};
        var stopChars = opts.stopChars || "'\"";
        var capture   = P.str(P.repeat(P.notChars(stopChars), null, 0));
        if ( opts.msgKind ) capture = P.msg(capture, { kind: opts.msgKind });
        if ( ! opts.category ) return capture;
        return P.alt(
          P.sug(P.literal(''), foam.parse.Suggestion.create({
            text:     '__ctx_' + opts.category + '__',
            category: opts.category,
            hint:     opts.hint || ''
          })),
          capture
        );
      }
      var key           = makeKeyHelper('key');
      var topKey        = makeKeyHelper('topKey');
      var propKey       = makeKeyHelper('propKey');
      var pomKeyHelper  = makeKeyHelper('pomKey');

      // Build an alt() of all key suggestions for a given scope, sourced
      // from AxiomCatalog. Single source of truth: adding a new axiom
      // slot in AxiomCatalog automatically grows the grammar's hint
      // and the editor's hover.
      var catalog = this.catalog;
      function catalogAlt(scope) {
        var helper = makeKeyHelper(scope);
        var entries = catalog.byScope(scope);
        var alts = entries.map(function(e) { return helper(e.name, e.hint); });
        return alts.length > 0 ? P.alt.apply(P, alts) : P.literal('');
      }

      // Convenience: pull a hint by scope+name. Used in explicit entry
      // declarations (extendsEntry, refinesEntry, etc.) so their key()
      // suggestion uses the same hint text as catalogAlt's auto-generated
      // sug() arms.
      function topHint(name)  { return catalog.getHint('topKey',  name); }
      function propHint(name) { return catalog.getHint('propKey', name); }
      function pomHint(name)  { return catalog.getHint('pomKey',  name); }

      // Accept either 'value' or "value" — defensive against mismatched/
      // mixed quote styles in hand-edited files. The closing quote is
      // optional so cursor-mid-edit input still parses far enough for
      // suggestions and diagnostics to fire.
      function quotedAny(inner) {
        return P.alt(
          P.seq(P.literal("'"), inner, P.optional(P.literal("'"))),
          P.seq(P.literal('"'), inner, P.optional(P.literal('"')))
        );
      }

      // Like quotedAny but tags the double-quote arm with a style hint
      // (FOAM convention is single quotes for class refs). The
      // DiagnosticsHandler converts the msg to a hint-level diagnostic
      // and the server.js CodeAction provides a one-click fix.
      function quoted(inner) {
        return P.alt(
          P.seq(P.literal("'"), inner, P.optional(P.literal("'"))),
          P.msg(
            P.seq(P.literal('"'), inner, P.optional(P.literal('"'))),
            { type: 'doubleQuotedClassRef' }
          )
        );
      }

      var comma = P.seq0(wsc, P.literal(','), wsc);

      // Trailing-comma-tolerant list: `entry (, entry)* ,?`. JavaScript
      // allows trailing commas in arrays / object literals, and so does
      // the FOAM JSON serializer; without this helper the parser would
      // bail at the first list with one (silently swallowing every
      // downstream property/method emission). All array-of-entries
      // sites in the grammar route through this so the bug only has
      // one place to fix.
      function repeatList(entry) {
        return P.optional(P.seq(
          entry,
          P.repeat(P.seq(comma, entry)),
          P.optional(comma)
        ));
      }

      var anyValue = P.alt(
        stringLiteral, number, booleanLiteral,
        P.sym('functionBody'),  // BEFORE dottedId — 'function' would match as identifier otherwise
        P.sym('array'), P.sym('object'), dottedId
      );

      return {
        // === FILE-LEVEL ===
        START: P.repeat(P.alt(P.sym('foamCall'), P.sym('ignoredContent')), null, 0),

        // POM keeps a distinct rule because its body grammar (pomBody) is
        // different from a class body. Everything else (CLASS, ENUM,
        // INTERFACE, RELATIONSHIP, FSM, and any future foam.<X> extension)
        // routes through `foamGenericCall` so adding a new model type
        // requires no grammar changes.
        foamCall: P.alt(P.sym('foamPOM'), P.sym('foamGenericCall')),

        foamPOM: P.seq(P.literal('foam.POM'), wsc, P.literal('('), wsc,
          P.sym('pomBody'), wsc, P.optional(P.literal(')'))),

        // Captures `foam.<UPPER>(<classBody>)` for any uppercase identifier
        // other than POM. The captured name is preserved by `foamCallName`
        // so handlers can branch (e.g., FSM-specific completions) if needed.
        foamGenericCall: P.seq(
          P.literal('foam.'),
          P.sym('foamCallName'),
          wsc, P.literal('('), wsc,
          P.sym('classBody'),
          wsc, P.optional(P.literal(')'))
        ),

        foamCallName: P.str(P.repeat(P.alt(
          P.range('A', 'Z'), P.range('0', '9'), P.literal('_')
        ), null, 1)),

        pomBody: P.seq(P.literal('{'), wsc,
          repeatList(P.sym('pomEntry')),
          wsc, P.optional(P.literal('}'))),

        pomEntry: P.alt(
          P.sym('pomFilesEntry'),
          P.sym('pomJavaFilesEntry'),
          P.sym('pomProjectsEntry'),
          P.sym('pomJavaDepsEntry'),
          P.sym('pomJournalFilesEntry'),
          P.sym('pomNameEntry'),
          P.sym('pomVersionEntry'),
          P.sym('genericEntry')
        ),

        // Scalar string entries — each emits its key sug and parses through
        // the rest of the `key: 'value'` assignment so the outer repeat can
        // move on to the next comma-separated entry without blocking.
        pomNameEntry: P.seq(pomKeyHelper('name', pomHint('name')), wsc, P.literal(':'), wsc, stringLiteral),
        pomVersionEntry: P.seq(pomKeyHelper('version', pomHint('version')), wsc, P.literal(':'), wsc, stringLiteral),

        pomJournalFilesEntry: P.seq(pomKeyHelper('journalFiles', pomHint('journalFiles')), wsc, P.literal(':'), wsc,
          P.literal('['), wsc,
          repeatList(P.seq(wsc, stringLiteral, wsc)),
          wsc, P.optional(P.literal(']'))),

        // Specific POM entry rules. Each emits a context marker (via sug with
        // \u0002 that never matches) so the LSP handler can detect cursor
        // position by inspecting collected sug categories.

        pomFilesEntry: P.seq(pomKeyHelper('files', pomHint('files')), wsc, P.literal(':'), wsc,
          P.literal('['), wsc,
          repeatList(P.seq(wsc, P.sym('pomFileObj'), wsc)),
          wsc, P.optional(P.literal(']'))),

        pomJavaFilesEntry: P.seq(pomKeyHelper('javaFiles', pomHint('javaFiles')), wsc, P.literal(':'), wsc,
          P.literal('['), wsc,
          repeatList(P.seq(wsc, P.sym('pomJavaFileObj'), wsc)),
          wsc, P.optional(P.literal(']'))),

        pomProjectsEntry: P.seq(pomKeyHelper('projects', pomHint('projects')), wsc, P.literal(':'), wsc,
          P.literal('['), wsc,
          repeatList(P.seq(wsc, P.sym('pomProjectObj'), wsc)),
          wsc, P.optional(P.literal(']'))),

        pomJavaDepsEntry: P.seq(pomKeyHelper('javaDependencies', pomHint('javaDependencies')), wsc, P.literal(':'), wsc,
          P.literal('['), wsc,
          repeatList(P.seq(wsc, P.literal("'"), P.sym('pomJavaDep'),
            P.optional(P.literal("'")), wsc)),
          wsc, P.optional(P.literal(']'))),

        // File/project object headers fire a snippet sug when `{` is expected
        // but not present — e.g. on a blank line between entries. Without this
        // the grammar backtracks to pomEntry and the user sees top-level POM
        // keys instead of a new-entry template.
        pomFileObj: P.seq(
          P.sug(P.literal('{'), foam.parse.Suggestion.create({
            text: "{ name: '', flags: 'js' }", category: 'pomFileEntry',
            hint: 'new file entry'
          })),
          wsc,
          repeatList(P.sym('pomFileObjEntry')),
          wsc, P.optional(P.literal('}'))),

        pomJavaFileObj: P.seq(
          P.sug(P.literal('{'), foam.parse.Suggestion.create({
            text: "{ name: '' }", category: 'pomJavaFileEntry',
            hint: 'new Java file entry'
          })),
          wsc,
          repeatList(P.sym('pomJavaFileObjEntry')),
          wsc, P.optional(P.literal('}'))),

        pomProjectObj: P.seq(
          P.sug(P.literal('{'), foam.parse.Suggestion.create({
            text: "{ name: '' }", category: 'pomProjectEntry',
            hint: 'new project entry'
          })),
          wsc,
          repeatList(P.sym('pomProjectObjEntry')),
          wsc, P.optional(P.literal('}'))),

        pomFileObjEntry: P.alt(
          P.seq(pomKeyHelper('name'),  wsc, P.literal(':'), wsc, quotedAny(P.sym('pomFileName'))),
          P.seq(pomKeyHelper('flags'), wsc, P.literal(':'), wsc, quotedAny(P.sym('pomFlagValue'))),
          P.sym('genericEntry')
        ),

        pomJavaFileObjEntry: P.alt(
          P.seq(pomKeyHelper('name'),  wsc, P.literal(':'), wsc, quotedAny(P.sym('pomJavaFileName'))),
          P.seq(pomKeyHelper('flags'), wsc, P.literal(':'), wsc, quotedAny(P.sym('pomFlagValue'))),
          P.sym('genericEntry')
        ),

        pomProjectObjEntry: P.alt(
          P.seq(pomKeyHelper('name'),  wsc, P.literal(':'), wsc, quotedAny(P.sym('pomProjectPath'))),
          P.seq(pomKeyHelper('flags'), wsc, P.literal(':'), wsc, quotedAny(P.sym('pomFlagValue'))),
          P.sym('genericEntry')
        ),

        // Context markers — each alternative's sug(literal('\u0002')) fails
        // at cursor and emits a category marker. stringValueRule() drives the
        // shape, including the "stop at either quote" rule that prevents the
        // value parser from running past its closing quote into the next
        // entry. Adding a new POM scalar value is a one-liner now.
        pomFileName:     stringValueRule({ category: 'pomFileName',     hint: 'file name',          msgKind: 'pomFileName' }),
        pomJavaFileName: stringValueRule({ category: 'pomJavaFileName', hint: 'Java file name' }),
        pomProjectPath:  stringValueRule({ category: 'pomProjectPath',  hint: 'subproject path' }),
        pomFlagValue:    stringValueRule({ category: 'pomFlagValue',    hint: 'flag combination' }),
        pomJavaDep:      stringValueRule({ category: 'pomJavaDep',      hint: 'Java dependency' }),

        // Skip one character — catch-all that lets START consume the whole file
        ignoredContent: P.anyChar(),

        // === CLASS BODY ===
        classBody: P.seq(P.literal('{'), wsc,
          P.optional(P.sym('classEntries')), wsc, P.optional(P.literal('}'))),

        classEntries: repeatList(P.sym('classEntry')),

        classEntry: P.alt(
          P.sym('packageEntry'),
          P.sym('nameEntry'),
          P.sym('extendsEntry'),
          P.sym('implementsEntry'),
          P.sym('refinesEntry'),
          P.sym('requiresEntry'),
          P.sym('propertiesEntry'),
          P.sym('methodsEntry'),
          P.sym('messagesEntry'),
          P.sym('valuesEntry'),
          P.sym('importsEntry'),
          P.sym('exportsEntry'),
          P.sym('javaImportsEntry'),
          P.sym('tableColumnsEntry'),
          P.sym('searchColumnsEntry'),
          P.sym('documentationEntry'),
          P.sym('abstractEntry'),
          P.sym('flagsEntry'),
          P.sym('actionsEntry'),
          P.sym('listenersEntry'),
          P.sym('sectionsEntry'),
          P.sym('cssEntry'),
          P.sym('sourceModelEntry'),
          P.sym('targetModelEntry'),
          P.sym('classTypedSlotEntry'),
          P.sym('topLevelKey'),
          P.sym('genericEntry')
        ),

        // === SPECIFIC ENTRIES ===
        // Hints are sourced from AxiomCatalog via topHint() — keeps the
        // descriptions in one place and reachable from HoverHandler too.
        packageEntry: P.seq(key('package',  topHint('package')),  wsc, P.literal(':'), wsc, stringLiteral),
        nameEntry:    P.seq(key('name',     topHint('name')),     wsc, P.literal(':'), wsc, stringLiteral),
        extendsEntry: P.seq(key('extends',  topHint('extends')),  wsc, P.literal(':'), wsc,
          quoted(P.sym('classRef'))),

        // refines: 'foam.x.Y' — classRef-typed top-level slot. Promoted from
        // suggestion-only topLevelKey to first-class entry so go-to-def,
        // hover, and unknown-class diagnostics work the same as `extends:`.
        refinesEntry: P.seq(key('refines', topHint('refines')), wsc, P.literal(':'), wsc,
          quoted(P.sym('classRef'))),

        // sourceModel/targetModel: classRef-typed slots used by
        // foam.RELATIONSHIP({...}). Same treatment as extends/refines.
        sourceModelEntry: P.seq(key('sourceModel', topHint('sourceModel')), wsc, P.literal(':'), wsc,
          quoted(P.sym('classRef'))),
        targetModelEntry: P.seq(key('targetModel', topHint('targetModel')), wsc, P.literal(':'), wsc,
          quoted(P.sym('classRef'))),

        // Generic axiom-class-typed slot: `<key>: 'foo.X'` where <key> is
        // the name of any property defined as Class/Reference/FObjectProperty/
        // FObjectArray on a model in the FOAM registry. Driven by
        // FoamIndex.getClassTypedPropertyNames() — adding a new class-typed
        // axiom (e.g., FSM `next: 'foo.X.STATE'`) requires no grammar change.
        classTypedSlotEntry: P.seq(
          self.classTypedKeyParser_,
          wsc, P.literal(':'), wsc,
          quoted(P.sym('classRef'))
        ),
        documentationEntry: P.seq(key('documentation', topHint('documentation')), wsc, P.literal(':'), wsc,
          P.msg(stringLiteral, { kind: 'documentation' })),
        abstractEntry: P.seq(key('abstract', topHint('abstract')), wsc, P.literal(':'), wsc, booleanLiteral),
        flagsEntry: P.seq(key('flags', topHint('flags')), wsc, P.literal(':'), wsc, P.sym('array')),
        // actions/listeners/sections — array-of-object axioms. Each gets a
        // dedicated inner-object rule so completion suggests the right keys
        // for THAT scope (actionKey/listenerKey/sectionKey from
        // AxiomCatalog). Falls back to `array` of unstructured values
        // when the inner-object form isn't used.
        actionsEntry: P.seq(key('actions', topHint('actions')), wsc, P.literal(':'), wsc,
          P.alt(P.sym('actionsArray'), P.sym('array'))),
        listenersEntry: P.seq(key('listeners', topHint('listeners')), wsc, P.literal(':'), wsc,
          P.alt(P.sym('listenersArray'), P.sym('array'))),
        sectionsEntry: P.seq(key('sections', topHint('sections')), wsc, P.literal(':'), wsc,
          P.alt(P.sym('sectionsArray'), P.sym('array'))),

        actionsArray: P.seq(P.literal('['), wsc,
          repeatList(P.seq(wsc, P.sym('actionObject'), wsc)),
          wsc, P.optional(P.literal(']'))),
        actionObject: P.seq(P.literal('{'), wsc,
          repeatList(P.sym('actionObjEntry')),
          wsc, P.optional(P.literal('}'))),
        actionObjEntry: P.alt(
          P.seq(catalogAlt('actionKey'), wsc, P.literal(':'), wsc, anyValue),
          P.sym('genericEntry')
        ),

        listenersArray: P.seq(P.literal('['), wsc,
          repeatList(P.seq(wsc, P.sym('listenerDef'), wsc)),
          wsc, P.optional(P.literal(']'))),
        // Listeners come in two forms — the bare named-function form
        // (`function click(e){...}`, a common idiom) and the object form
        // (`{ name, code }`). Without the bare-function arm, listenersArray's
        // object-only rule "succeeds" on just `[` (empty optional list + optional
        // `]`), leaving `function click(){}], methods:[...]` to be misparsed as
        // class entries — silently dropping every axiom after the listeners block.
        // namedFunctionBody also emits the 'method' axiom position so go-to-def /
        // hover resolve on the listener name (parity with methodDef).
        listenerDef: P.alt(
          P.sym('namedFunctionBody'),
          P.sym('listenerObject')
        ),
        listenerObject: P.seq(P.literal('{'), wsc,
          repeatList(P.sym('listenerObjEntry')),
          wsc, P.optional(P.literal('}'))),
        listenerObjEntry: P.alt(
          P.seq(catalogAlt('listenerKey'), wsc, P.literal(':'), wsc, anyValue),
          P.sym('genericEntry')
        ),

        sectionsArray: P.seq(P.literal('['), wsc,
          repeatList(P.seq(wsc, P.sym('sectionObject'), wsc)),
          wsc, P.optional(P.literal(']'))),
        sectionObject: P.seq(P.literal('{'), wsc,
          repeatList(P.sym('sectionObjEntry')),
          wsc, P.optional(P.literal('}'))),
        sectionObjEntry: P.alt(
          P.seq(catalogAlt('sectionKey'), wsc, P.literal(':'), wsc, anyValue),
          P.sym('genericEntry')
        ),
        cssEntry: P.seq(key('css', topHint('css')), wsc, P.literal(':'), wsc, backtickString),

        // implements: ['foam.x.Y'] — same classRef parsing as extends.
        // FOAM allows implements to reference any class id, not just
        // foam.INTERFACE-declared ones (e.g., StringFilterView implements
        // foam.mlang.Expressions, which is a class).
        implementsEntry: P.seq(key('implements', topHint('implements')), wsc, P.literal(':'), wsc, P.literal('['), wsc,
          repeatList(P.seq(wsc, quoted(P.sym('classRef')), wsc)),
          wsc, P.optional(P.literal(']'))),

        requiresEntry: P.seq(key('requires', topHint('requires')), wsc, P.literal(':'), wsc, P.literal('['), wsc,
          repeatList(P.seq(wsc, quoted(P.sym('classRef')), wsc)),
          wsc, P.optional(P.literal(']'))),

        // messages: [ { name: 'LABEL_X', message: '…' } ]
        // Each name's string content is msg-tagged so collectAxiomPositions
        // can harvest source positions in one parse pass — replacing the
        // per-axiom regex scanners we used to need.
        messagesEntry: P.seq(topKey('messages'), wsc, P.literal(':'), wsc,
          P.literal('['), wsc,
          repeatList(P.seq(wsc, P.sym('messageObject'), wsc)),
          wsc, P.optional(P.literal(']'))),

        messageObject: P.seq(P.literal('{'), wsc,
          repeatList(P.sym('messageObjEntry')),
          wsc, P.optional(P.literal('}'))),

        // First arm emits the 'message' axiom position; catalogAlt covers
        // every other message-object slot (name/message/documentation).
        messageObjEntry: P.alt(
          P.seq(propKey('name', catalog.getHint('messageKey', 'name')),
            wsc, P.literal(':'), wsc,
            quotedAny(P.sym('messageNameValue'))),
          P.seq(catalogAlt('messageKey'), wsc, P.literal(':'), wsc, anyValue),
          P.sym('genericEntry')
        ),

        messageNameValue: identMsg('message'),

        // values: [ { name: 'X', ... } ] — foam.ENUM value declarations.
        valuesEntry: P.seq(topKey('values'), wsc, P.literal(':'), wsc,
          P.literal('['), wsc,
          repeatList(P.seq(wsc, P.sym('valueObject'), wsc)),
          wsc, P.optional(P.literal(']'))),

        valueObject: P.seq(P.literal('{'), wsc,
          repeatList(P.sym('valueObjEntry')),
          wsc, P.optional(P.literal('}'))),

        // First arm emits the 'value' axiom position for enum values;
        // catalogAlt covers everything else (label/ordinal/documentation).
        valueObjEntry: P.alt(
          P.seq(propKey('name', catalog.getHint('valueKey', 'name')),
            wsc, P.literal(':'), wsc,
            quotedAny(P.sym('enumValueName'))),
          P.seq(catalogAlt('valueKey'), wsc, P.literal(':'), wsc, anyValue),
          P.sym('genericEntry')
        ),

        enumValueName: identMsg('value'),

        // Property `name: 'foo'` — emit a 'property' axiom position so
        // DefinitionHandler.buildLocationAtProperty can jump straight to
        // the declaration without text-scan regex.
        propertyNameValue: identMsg('property'),

        // tableColumns/searchColumns: emit a 'columnName' category at each value
        // position so the LSP handler can detect context without regex scanning.
        // Real suggestions come from the model (this class's properties).
        tableColumnsEntry: P.seq(topKey('tableColumns'), wsc, P.literal(':'), wsc,
          P.literal('['), wsc,
          repeatList(P.seq(wsc, P.literal("'"), P.sym('columnName'),
            P.optional(P.literal("'")), wsc)),
          wsc, P.optional(P.literal(']'))),
        searchColumnsEntry: P.seq(topKey('searchColumns'), wsc, P.literal(':'), wsc,
          P.literal('['), wsc,
          repeatList(P.seq(wsc, P.literal("'"), P.sym('columnName'),
            P.optional(P.literal("'")), wsc)),
          wsc, P.optional(P.literal(']'))),

        // Context marker: the sug here always fails (matches \u0002 which
        // doesn't appear in source) so it fires during suggestion collection.
        // The id-shaped fallback is msg-wrapped so validation can flag
        // unknown column names (property names not on the class).
        columnName: P.alt(
          P.sug(P.literal('\u0002'), foam.parse.Suggestion.create({
            text: '__ctx_columnName__', category: 'columnName', hint: 'property name'
          })),
          P.msg(
            P.str(P.repeat(P.alt(alphaNum, P.chars('_.')), null, 1)),
            { type: 'columnName' }
          )
        ),

        importsEntry: P.seq(key('imports', topHint('imports')), wsc, P.literal(':'), wsc, P.sym('array')),

        // exports: [ 'axiomName', 'axiomName as alias' ] — emit an 'exportName'
        // context marker per value so the LSP handler can suggest axiom names
        // (properties, methods, actions, listeners) from the enclosing model
        // instead of the class-ref fallback list.
        exportsEntry: P.seq(key('exports', topHint('exports')), wsc, P.literal(':'), wsc,
          P.literal('['), wsc,
          repeatList(P.seq(wsc, P.literal("'"), P.sym('exportName'),
            P.optional(P.literal("'")), wsc)),
          wsc, P.optional(P.literal(']'))),

        exportName: P.alt(
          P.sug(P.literal(''), foam.parse.Suggestion.create({
            text: '__ctx_exportName__', category: 'exportName', hint: 'axiom name'
          })),
          P.msg(
            P.str(P.repeat(P.alt(alphaNum, P.chars('_ $')), null, 1)),
            { type: 'exportName' }
          )
        ),

        javaImportsEntry: P.seq(key('javaImports', topHint('javaImports')), wsc, P.literal(':'), wsc,
          P.literal('['), wsc,
          repeatList(P.seq(wsc, P.sym('javaImport'), wsc)),
          wsc, P.optional(P.literal(']'))),

        javaImport: P.seq1(1, P.literal("'"), P.sym('javaImportRef'), P.optional(P.literal("'"))),
        // Full Java FQ-name first — must consume the entire qualified name
        // including any wildcard `.*` suffix and the optional `static `
        // prefix used for static-method imports
        // (`'static foo.MLang.AND'`). The sug() arms below match common
        // prefixes (foam.lang., java.util., …) and emit completion
        // suggestions; they're ordered AFTER the full-id regex so they
        // only fire when collectSuggestionsAt() runs against a sentinel
        // — never during a real parse where they'd otherwise greedily
        // consume just the prefix and leave the rest un-parsed (which
        // silently bailed the whole class body downstream).
        javaImportRef: P.alt(
          P.seq(
            P.optional(P.seq(P.literal('static'), P.repeat(P.chars(' \t')))),
            P.str(P.repeat(P.alt(alphaNum, P.chars('._*')), null, 1))
          ),
          P.sug(P.literal('foam.lang.'), foam.parse.Suggestion.create({
            text: 'foam.lang.', category: 'class',
            hint: 'FOAM lang package (FObject, X, PropertyInfo)'
          })),
          P.sug(P.literal('foam.core.'), foam.parse.Suggestion.create({
            text: 'foam.core.', category: 'class',
            hint: 'FOAM core package (auth, logger, ruler)'
          })),
          P.sug(P.literal('java.util.'), foam.parse.Suggestion.create({
            text: 'java.util.', category: 'class',
            hint: 'Java util (List, ArrayList, Map, Set)'
          })),
          P.sug(P.literal('java.io.'), foam.parse.Suggestion.create({
            text: 'java.io.', category: 'class', hint: 'Java IO'
          }))
        ),

        propertiesEntry: P.seq(key('properties', topHint('properties')), wsc, P.literal(':'), wsc,
          P.literal('['), wsc,
          repeatList(P.sym('propertyDef')),
          wsc, P.optional(P.literal(']'))),

        methodsEntry: P.seq(key('methods', topHint('methods')), wsc, P.literal(':'), wsc,
          P.literal('['), wsc,
          repeatList(P.sym('methodDef')),
          wsc, P.optional(P.literal(']'))),

        // topLevelKey is a FULL entry: suggests known top-level keys AND
        // consumes their `: <value>` so the outer classEntries repeat keeps
        // progressing. The list of slots + descriptions comes from
        // AxiomCatalog so grammar hints and HoverHandler hover text share
        // the same source.
        topLevelKey: P.seq(catalogAlt('topKey'), wsc, P.literal(':'), wsc, anyValue),

        // === CLASS REFERENCES (dynamic) ===
        // The permissive fallback is wrapped in msg() so diagnostic collection
        // can flag it as an unknown class — the msg is only consumed by
        // collectDiagnostics(), not by completion.
        classRef: P.alt(
          self.classRefParser_,
          P.msg(
            P.str(P.repeat(P.alt(alphaNum, P.chars('._')), null, 1)),
            { type: 'unknownClassRef' }
          )
        ),

        // === PROPERTY DEFINITIONS ===
        // Try structured parse first, fall back to balanced braces if it fails
        propertyDef: P.alt(stringLiteral, P.sym('propertyObject'), P.sym('balancedBraces')),
        propertyObject: P.seq(P.literal('{'), wsc,
          P.optional(P.sym('propEntries')), wsc, P.optional(P.literal('}'))),
        propEntries: repeatList(P.sym('propEntry')),

        propEntry: P.alt(
          // class: 'String'  → propType (short name, matches String/Long/etc.)
          // class: 'foo.X.Y' → classRef (dotted full class id)
          // Order matters: propType is `literalIC` of short names, so it
          // declines on dotted input and we fall through to classRef.
          // quoted() accepts " too, with a style hint diagnostic.
          P.seq(P.sug(P.literal('class'), foam.parse.Suggestion.create({
            text: 'class', category: 'key' })),
            wsc, P.literal(':'), wsc,
            quoted(P.alt(P.sym('propType'), P.sym('classRef')))),
          P.seq(P.sug(P.literal('name'), foam.parse.Suggestion.create({
            text: 'name', category: 'key' })),
            wsc, P.literal(':'), wsc,
            quotedAny(P.sym('propertyNameValue'))),
          P.seq(P.sug(P.literal('of'), foam.parse.Suggestion.create({
            text: 'of', category: 'key' })),
            wsc, P.literal(':'), wsc, quoted(P.sym('classRef'))),
          // view: 'com.acme.MyView' — treat the string form exactly like `of:`
          // so class suggestions (including view classes) surface in viewSpec
          // positions. The `view: { class: '...' }` object form routes through
          // viewSpecObject so the class id emits a classRef position too.
          P.seq(P.sug(P.literal('view'), foam.parse.Suggestion.create({
            text: 'view', category: 'key' })),
            wsc, P.literal(':'), wsc,
            P.alt(quoted(P.sym('classRef')), P.sym('viewSpecObject'))),
          P.seq(P.sug(P.literal('documentation'), foam.parse.Suggestion.create({
            text: 'documentation', category: 'key' })),
            wsc, P.literal(':'), wsc, P.msg(stringLiteral, { kind: 'documentation' })),
          P.seq(P.sug(P.literal('hidden'), foam.parse.Suggestion.create({
            text: 'hidden', category: 'key' })),
            wsc, P.literal(':'), wsc, booleanLiteral),
          P.seq(P.sug(P.literal('transient'), foam.parse.Suggestion.create({
            text: 'transient', category: 'key' })),
            wsc, P.literal(':'), wsc, booleanLiteral),
          P.sym('propKey'),
          P.sym('genericEntry')
        ),

        // propKey is a full entry — suggests the prop slot AND consumes
        // its `: <value>`. List + hints come from AxiomCatalog (shared
        // with HoverHandler).
        propKey: P.seq(catalogAlt('propKey'), wsc, P.literal(':'), wsc, anyValue),

        propType: P.alt(
          self.propTypeParser_,
          P.msg(
            P.str(P.repeat(P.alt(alphaNum, P.chars('._')), null, 1)),
            { type: 'unknownPropType' }
          )
        ),

        // === METHOD DEFINITIONS ===
        // Method forms:
        //   function foo(args) { ... }           — bare function
        //   { name: 'foo', code: function... }   — object with name
        // Both forms emit a 'method' axiom position so DefinitionHandler
        // can jump straight to the declaration without text-scan regex.
        methodDef: P.alt(
          P.sym('namedFunctionBody'),
          P.sym('methodObject'),
          P.sym('object')
        ),

        namedFunctionBody: P.seq(
          P.optional(P.literal('async')), wsc,
          P.literal('function'), wsc,
          P.sym('methodNameValue'),
          wsc, P.sym('balancedParens'), wsc, P.sym('balancedBraces')
        ),

        methodObject: P.seq(P.literal('{'), wsc,
          repeatList(P.sym('methodObjEntry')),
          wsc, P.optional(P.literal('}'))),

        // The first two arms emit a 'method' axiom position from the
        // string value (used by buildLocationAtMethod). Catalog-driven
        // entry handles every other method-object slot AND consumes its
        // `: <value>` so the loop keeps progressing across mixed forms
        // (`{ name: 'm', args: 'X x', javaCode: ` ... `, documentation: '...' }`).
        // The trailing genericEntry remains as a safety net for keys we
        // haven't catalogued.
        methodObjEntry: P.alt(
          P.seq(propKey('name', catalog.getHint('methodKey', 'name')),
            wsc, P.literal(':'), wsc,
            quotedAny(P.sym('methodNameValue'))),
          P.seq(catalogAlt('methodKey'), wsc, P.literal(':'), wsc, anyValue),
          P.sym('genericEntry')
        ),

        methodNameValue: identMsg('method'),

        // === GENERIC CATCH-ALL ===
        genericEntry: P.seq(identifier, wsc, P.literal(':'), wsc, anyValue),

        // === STRUCTURAL ===
        array: P.seq(P.literal('['), wsc,
          repeatList(P.seq(wsc, anyValue, wsc)),
          wsc, P.optional(P.literal(']'))),

        object: P.seq(P.literal('{'), wsc,
          repeatList(P.seq(wsc, P.sym('genericEntry'), wsc)),
          wsc, P.optional(P.literal('}'))),

        functionBody: P.seq(
          P.optional(P.literal('async')), wsc,
          P.literal('function'), wsc,
          P.optional(identifier),
          wsc, P.sym('balancedParens'), wsc, P.sym('balancedBraces')
        ),

        balancedParens: P.seq(P.literal('('), P.str(P.repeat(P.alt(
          P.sym('balancedParens'), stringLiteral, lineComment, blockComment,
          P.notChars('()')
        ), null, 0)), P.literal(')')),

        balancedBraces: P.seq(P.literal('{'), P.str(P.repeat(P.alt(
          P.sym('instClassObject'), P.sym('balancedBraces'), stringLiteral, backtickString,
          lineComment, blockComment, P.sym('instantiationCall'), P.sym('thisMemberRef'),
          P.notChars('{}')
        ), null, 0)), P.literal('}')),

        // `this.Ident` / `self.Ident` member access inside code — the FOAM
        // idiom for using a required class (or property/method) in render,
        // init, listeners. Emits the full `this.Ident` span; ReferencesHandler
        // maps the trailing identifier to a class via requires. Runs after
        // instantiationCall so `this.X.create(...)` / `.tag(this.X, ...)` are
        // claimed by their own rules first.
        thisMemberRef: P.msg(P.seq(
          P.alt(P.literal('this'), P.literal('self')),
          P.literal('.'),
          P.str(P.repeat(identChars, null, 1))
        ), { kind: 'memberRef' }),

        balancedBrackets: P.seq(P.literal('['), P.str(P.repeat(P.alt(
          P.sym('balancedBrackets'), P.sym('balancedBraces'), P.sym('balancedParens'),
          stringLiteral, backtickString, lineComment, blockComment, P.notChars('[]')
        ), null, 0)), P.literal(']')),

        // === INSTANTIATION RULES (F3) ===
        instCreateCall: P.msg(P.seq(
          P.msg(instReceiverChain, { kind: 'instCreateReceiver' }),
          P.literal('.create'), wsc, P.literal('('), wsc,
          repeatList(P.alt(P.sym('instObject'), anyValue)),
          wsc, P.optional(P.literal(')'))
        ), { kind: 'instCall' }),

        // Generic argument-call form: ANY call that passes a class reference
        // immediately followed by an object literal — `.tag(this.X, {...})`,
        // `.add(this.X, {...})`, `helper(this.X, {...})`, `[this.X, {...}]`,
        // etc. The class is the arg before the object; the method name is
        // irrelevant, so the LSP works it out without per-helper knowledge.
        // Anchored on `classRef, {` adjacency. Non-class refs are dropped later
        // by resolution (classExists), so matching broadly is safe.
        instArgCall: P.msg(P.seq(
          P.msg(dottedId, { kind: 'instTagClass' }),
          wsc, P.literal(','), wsc,
          P.sym('instObject'),
          wsc, P.optional(P.literal(')'))
        ), { kind: 'instCall' }),

        // Inline ViewSpec object: `{ class: 'X', prop: ... }` — the class is
        // named by the `class:` key (required first), siblings are X's props.
        // Only reached inside code (balancedBraces); property/axiom specs in
        // `properties:`/`actions:`/etc. arrays are parsed by their own object
        // rules and never hit this, so `{ class: 'String', name: 'x' }` defs
        // are untouched.
        instClassObject: P.msg(P.seq(
          P.literal('{'), wsc,
          P.literal('class'), wsc, P.literal(':'), wsc,
          quotedAny(P.msg(P.str(P.repeat(P.alt(alphaNum, P.chars('._')), null, 1)),
            { kind: 'instClassRef' })),
          P.repeat0(P.seq(comma, P.sym('instEntry'))),
          P.optional(comma),
          wsc, P.optional(P.literal('}'))
        ), { kind: 'instCall' }),

        // Object-form ViewSpec in a property definition:
        // `view: { class: 'foam.u2.view.X', … }`. Emits a plain classRef for
        // the class id (find-references / definition / unknown-class
        // diagnostics) WITHOUT the instCall record instClassObject adds —
        // property-def specs must not trigger instantiation-value diagnostics.
        viewSpecObject: P.seq(
          P.literal('{'), wsc,
          P.literal('class'), wsc, P.literal(':'), wsc,
          quoted(P.sym('classRef')),
          P.repeat0(P.seq(comma, P.sym('genericEntry'))),
          P.optional(comma),
          wsc, P.optional(P.literal('}'))
        ),

        instantiationCall: P.alt(P.sym('instCreateCall'), P.sym('instArgCall')),

        instObject: P.seq(P.literal('{'), wsc,
          repeatList(P.sym('instEntry')),
          wsc, P.optional(P.literal('}'))),

        instEntry: P.alt(
          P.seq(P.msg(identifier, { kind: 'instKey' }), wsc, P.literal(':'), wsc,
            P.msg(P.sym('instValueExpr'), { kind: 'instValue' })),
          P.sym('genericEntry')),

        // A property value: a primary token plus any call/index/member trailers,
        // so call expressions (this.slot(...)), slots (this.x$), nested objects
        // and arrays parse as ONE value instead of stopping at `this.slot` and
        // desyncing the rest of the object literal.
        instValueExpr: P.seq(
          P.alt(stringLiteral, number, booleanLiteral, P.sym('functionBody'),
            P.sym('object'), P.sym('array'), dottedId),
          P.repeat0(P.alt(P.sym('balancedParens'), P.sym('balancedBrackets'),
            P.seq(P.literal('.'), dottedId)))
        )
      };
    }
  ]
});
