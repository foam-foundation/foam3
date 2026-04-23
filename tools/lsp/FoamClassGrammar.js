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
      name: 'classRefParser_',
      documentation: 'Cached alt() parser of all class ID suggestions.'
    },
    {
      name: 'propTypeParser_',
      documentation: 'Cached alt() parser of all property type suggestions.'
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
      var map = { message: {}, value: {}, property: {}, method: {} };

      var apply = function(p, grammar) {
        var startPos = this.pos;
        var result = p.parse(this, grammar);
        if ( result && typeof p.msg === 'function' ) {
          var m = p.msg();
          if ( m && m.kind && map[m.kind] !== undefined ) {
            var endPos = result.pos;
            var name = text.substring(startPos, endPos);
            if ( name && ! map[m.kind][name] ) {
              var line = 0, col = 0;
              for ( var i = 0 ; i < startPos ; i++ ) {
                if ( text.charCodeAt(i) === 10 ) { line++; col = 0; } else col++;
              }
              map[m.kind][name] = {
                line: line, col: col,
                startPos: startPos, endPos: endPos
              };
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
      var propTypes = this.index.getPropertyTypes();
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
      this.classRefParser_ = classRefParsers.length > 0 ?
        P.alt.apply(P, classRefParsers) : P.literal('foam.lang.FObject');
    },

    function buildGrammar_(P) {
      var self = this;

      // === PRIMITIVES ===
      var ws = P.repeat0(P.alt(P.literal(' '), P.literal('\t'), P.literal('\n'), P.literal('\r')));

      // Comments
      var lineComment = P.seq(P.literal('//'), P.str(P.repeat(P.notChars('\n\r'), null, 0)),
        P.alt(P.literal('\r\n'), P.literal('\n'), P.literal('\r')));
      var blockComment = P.seq(P.literal('/*'), P.str(P.until(P.literal('*/'))));

      // Whitespace including comments
      var wsc = P.repeat0(P.alt(P.literal(' '), P.literal('\t'), P.literal('\n'), P.literal('\r'),
        lineComment, blockComment));

      // String literals
      var sqString = P.seq1(1, P.literal("'"),
        P.str(P.repeat(P.alt(P.literal("\\'"), P.notChars("'")), null, 0)), P.literal("'"));
      var dqString = P.seq1(1, P.literal('"'),
        P.str(P.repeat(P.alt(P.literal('\\"'), P.notChars('"')), null, 0)), P.literal('"'));
      var backtickString = P.seq1(1, P.literal('`'),
        P.str(P.repeat(P.alt(P.literal('\\`'), P.notChars('`')), null, 0)), P.literal('`'));
      var stringLiteral = P.alt(sqString, dqString, backtickString);

      var digit = P.range('0', '9');
      var number = P.str(P.repeat(P.alt(digit, P.literal('.'), P.literal('-')), null, 1));
      var booleanLiteral = P.alt(P.literal('true'), P.literal('false'),
        P.literal('null'), P.literal('undefined'));
      var identifier = P.str(P.repeat(P.alt(P.range('a', 'z'), P.range('A', 'Z'),
        P.range('0', '9'), P.chars('_$')), null, 1));
      var dottedId = P.str(P.repeat(P.alt(P.range('a', 'z'), P.range('A', 'Z'),
        P.range('0', '9'), P.chars('_.$')), null, 1));

      function key(name) {
        return P.sug(P.literal(name), foam.parse.Suggestion.create({
          text: name + ': ', category: 'key'
        }));
      }

      // Category-tagged key helpers so callers can distinguish cursor context
      // from collected suggestions (top-level class body vs property object
      // vs POM body). LSP handler maps all of these to Keyword kind (14).
      function topKey(name) {
        return P.sug(P.literal(name), foam.parse.Suggestion.create({
          text: name + ': ', category: 'topKey'
        }));
      }
      function propKey(name) {
        return P.sug(P.literal(name), foam.parse.Suggestion.create({
          text: name + ': ', category: 'propKey'
        }));
      }
      function pomKeyHelper(name) {
        return P.sug(P.literal(name), foam.parse.Suggestion.create({
          text: name + ': ', category: 'pomKey'
        }));
      }

      var comma = P.seq0(wsc, P.literal(','), wsc);

      var anyValue = P.alt(
        stringLiteral, number, booleanLiteral,
        P.sym('functionBody'),  // BEFORE dottedId — 'function' would match as identifier otherwise
        P.sym('array'), P.sym('object'), dottedId
      );

      return {
        // === FILE-LEVEL ===
        START: P.repeat(P.alt(P.sym('foamCall'), P.sym('ignoredContent')), null, 0),

        foamCall: P.alt(P.sym('foamClass'), P.sym('foamEnum'), P.sym('foamInterface'),
          P.sym('foamPOM')),

        foamClass: P.seq(P.literal('foam.CLASS'), wsc, P.literal('('), wsc,
          P.sym('classBody'), wsc, P.optional(P.literal(')'))),
        foamEnum: P.seq(P.literal('foam.ENUM'), wsc, P.literal('('), wsc,
          P.sym('classBody'), wsc, P.optional(P.literal(')'))),
        foamInterface: P.seq(P.literal('foam.INTERFACE'), wsc, P.literal('('), wsc,
          P.sym('classBody'), wsc, P.optional(P.literal(')'))),

        foamPOM: P.seq(P.literal('foam.POM'), wsc, P.literal('('), wsc,
          P.sym('pomBody'), wsc, P.optional(P.literal(')'))),

        pomBody: P.seq(P.literal('{'), wsc,
          P.optional(P.repeat(P.sym('pomEntry'), comma)),
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
        pomNameEntry: P.seq(pomKeyHelper('name'), wsc, P.literal(':'), wsc, stringLiteral),
        pomVersionEntry: P.seq(pomKeyHelper('version'), wsc, P.literal(':'), wsc, stringLiteral),

        pomJournalFilesEntry: P.seq(pomKeyHelper('journalFiles'), wsc, P.literal(':'), wsc,
          P.literal('['), wsc,
          P.optional(P.repeat(P.seq(wsc, stringLiteral, wsc), comma)),
          wsc, P.optional(P.literal(']'))),

        // Specific POM entry rules. Each emits a context marker (via sug with
        // \u0002 that never matches) so the LSP handler can detect cursor
        // position by inspecting collected sug categories.

        pomFilesEntry: P.seq(pomKeyHelper('files'), wsc, P.literal(':'), wsc,
          P.literal('['), wsc,
          P.optional(P.repeat(P.seq(wsc, P.sym('pomFileObj'), wsc), comma)),
          wsc, P.optional(P.literal(']'))),

        pomJavaFilesEntry: P.seq(pomKeyHelper('javaFiles'), wsc, P.literal(':'), wsc,
          P.literal('['), wsc,
          P.optional(P.repeat(P.seq(wsc, P.sym('pomJavaFileObj'), wsc), comma)),
          wsc, P.optional(P.literal(']'))),

        pomProjectsEntry: P.seq(pomKeyHelper('projects'), wsc, P.literal(':'), wsc,
          P.literal('['), wsc,
          P.optional(P.repeat(P.seq(wsc, P.sym('pomProjectObj'), wsc), comma)),
          wsc, P.optional(P.literal(']'))),

        pomJavaDepsEntry: P.seq(pomKeyHelper('javaDependencies'), wsc, P.literal(':'), wsc,
          P.literal('['), wsc,
          P.optional(P.repeat(P.seq(wsc, P.literal("'"), P.sym('pomJavaDep'),
            P.optional(P.literal("'")), wsc), comma)),
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
          P.optional(P.repeat(P.sym('pomFileObjEntry'), comma)),
          wsc, P.optional(P.literal('}'))),

        pomJavaFileObj: P.seq(
          P.sug(P.literal('{'), foam.parse.Suggestion.create({
            text: "{ name: '' }", category: 'pomJavaFileEntry',
            hint: 'new Java file entry'
          })),
          wsc,
          P.optional(P.repeat(P.sym('pomJavaFileObjEntry'), comma)),
          wsc, P.optional(P.literal('}'))),

        pomProjectObj: P.seq(
          P.sug(P.literal('{'), foam.parse.Suggestion.create({
            text: "{ name: '' }", category: 'pomProjectEntry',
            hint: 'new project entry'
          })),
          wsc,
          P.optional(P.repeat(P.sym('pomProjectObjEntry'), comma)),
          wsc, P.optional(P.literal('}'))),

        pomFileObjEntry: P.alt(
          P.seq(pomKeyHelper('name'), wsc, P.literal(':'), wsc,
            P.literal("'"), P.sym('pomFileName'), P.optional(P.literal("'"))),
          P.seq(pomKeyHelper('flags'), wsc, P.literal(':'), wsc,
            P.literal("'"), P.sym('pomFlagValue'), P.optional(P.literal("'"))),
          P.sym('genericEntry')
        ),

        pomJavaFileObjEntry: P.alt(
          P.seq(pomKeyHelper('name'), wsc, P.literal(':'), wsc,
            P.literal("'"), P.sym('pomJavaFileName'), P.optional(P.literal("'"))),
          P.seq(pomKeyHelper('flags'), wsc, P.literal(':'), wsc,
            P.literal("'"), P.sym('pomFlagValue'), P.optional(P.literal("'"))),
          P.sym('genericEntry')
        ),

        pomProjectObjEntry: P.alt(
          P.seq(pomKeyHelper('name'), wsc, P.literal(':'), wsc,
            P.literal("'"), P.sym('pomProjectPath'), P.optional(P.literal("'"))),
          P.seq(pomKeyHelper('flags'), wsc, P.literal(':'), wsc,
            P.literal("'"), P.sym('pomFlagValue'), P.optional(P.literal("'"))),
          P.sym('genericEntry')
        ),

        // Context markers — each alternative's sug(literal('\u0002')) fails
        // at cursor and emits a category marker. The str(repeat) fallback
        // handles the actual token parse.
        pomFileName: P.alt(
          P.sug(P.literal('\u0002'), foam.parse.Suggestion.create({
            text: '__ctx_pomFileName__', category: 'pomFileName', hint: 'file name'
          })),
          P.str(P.repeat(P.notChars("'"), null, 0))
        ),
        pomJavaFileName: P.alt(
          P.sug(P.literal('\u0002'), foam.parse.Suggestion.create({
            text: '__ctx_pomJavaFileName__', category: 'pomJavaFileName', hint: 'Java file name'
          })),
          P.str(P.repeat(P.notChars("'"), null, 0))
        ),
        pomProjectPath: P.alt(
          P.sug(P.literal('\u0002'), foam.parse.Suggestion.create({
            text: '__ctx_pomProjectPath__', category: 'pomProjectPath', hint: 'subproject path'
          })),
          P.str(P.repeat(P.notChars("'"), null, 0))
        ),
        pomFlagValue: P.alt(
          P.sug(P.literal('\u0002'), foam.parse.Suggestion.create({
            text: '__ctx_pomFlagValue__', category: 'pomFlagValue', hint: 'flag combination'
          })),
          P.str(P.repeat(P.notChars("'"), null, 0))
        ),
        pomJavaDep: P.alt(
          P.sug(P.literal('\u0002'), foam.parse.Suggestion.create({
            text: '__ctx_pomJavaDep__', category: 'pomJavaDep', hint: 'Java dependency'
          })),
          P.str(P.repeat(P.notChars("'"), null, 0))
        ),

        // Skip one character — catch-all that lets START consume the whole file
        ignoredContent: P.anyChar(),

        // === CLASS BODY ===
        classBody: P.seq(P.literal('{'), wsc,
          P.optional(P.sym('classEntries')), wsc, P.optional(P.literal('}'))),

        classEntries: P.repeat(P.sym('classEntry'), P.seq0(wsc, P.literal(','), wsc)),

        classEntry: P.alt(
          P.sym('packageEntry'),
          P.sym('nameEntry'),
          P.sym('extendsEntry'),
          P.sym('implementsEntry'),
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
          P.sym('cssEntry'),
          P.sym('topLevelKey'),
          P.sym('genericEntry')
        ),

        // === SPECIFIC ENTRIES ===
        packageEntry: P.seq(key('package'), wsc, P.literal(':'), wsc, stringLiteral),
        nameEntry: P.seq(key('name'), wsc, P.literal(':'), wsc, stringLiteral),
        extendsEntry: P.seq(key('extends'), wsc, P.literal(':'), wsc,
          P.literal("'"), P.sym('classRef'), P.optional(P.literal("'"))),
        documentationEntry: P.seq(key('documentation'), wsc, P.literal(':'), wsc, stringLiteral),
        abstractEntry: P.seq(key('abstract'), wsc, P.literal(':'), wsc, booleanLiteral),
        flagsEntry: P.seq(key('flags'), wsc, P.literal(':'), wsc, P.sym('array')),
        actionsEntry: P.seq(key('actions'), wsc, P.literal(':'), wsc, P.sym('array')),
        listenersEntry: P.seq(key('listeners'), wsc, P.literal(':'), wsc, P.sym('array')),
        cssEntry: P.seq(key('css'), wsc, P.literal(':'), wsc, backtickString),

        implementsEntry: P.seq(key('implements'), wsc, P.literal(':'), wsc, P.literal('['), wsc,
          P.optional(P.repeat(
            P.seq(wsc, P.literal("'"), P.sym('classRef'), P.optional(P.literal("'")), wsc), comma)),
          wsc, P.optional(P.literal(']'))),

        requiresEntry: P.seq(key('requires'), wsc, P.literal(':'), wsc, P.literal('['), wsc,
          P.optional(P.repeat(
            P.seq(wsc, P.literal("'"), P.sym('classRef'), P.optional(P.literal("'")), wsc), comma)),
          wsc, P.optional(P.literal(']'))),

        // messages: [ { name: 'LABEL_X', message: '…' } ]
        // Each name's string content is msg-tagged so collectAxiomPositions
        // can harvest source positions in one parse pass — replacing the
        // per-axiom regex scanners we used to need.
        messagesEntry: P.seq(topKey('messages'), wsc, P.literal(':'), wsc,
          P.literal('['), wsc,
          P.optional(P.repeat(P.seq(wsc, P.sym('messageObject'), wsc), comma)),
          wsc, P.optional(P.literal(']'))),

        messageObject: P.seq(P.literal('{'), wsc,
          P.optional(P.repeat(P.sym('messageObjEntry'), comma)),
          wsc, P.optional(P.literal('}'))),

        messageObjEntry: P.alt(
          P.seq(propKey('name'), wsc, P.literal(':'), wsc,
            P.literal("'"), P.sym('messageNameValue'), P.optional(P.literal("'"))),
          P.seq(propKey('name'), wsc, P.literal(':'), wsc,
            P.literal('"'), P.sym('messageNameValue'), P.optional(P.literal('"'))),
          P.seq(propKey('message'), wsc, P.literal(':'), wsc, stringLiteral),
          P.sym('genericEntry')
        ),

        messageNameValue: P.msg(
          P.str(P.repeat(P.alt(P.range('a', 'z'), P.range('A', 'Z'),
            P.range('0', '9'), P.chars('_$')), null, 1)),
          { kind: 'message' }
        ),

        // values: [ { name: 'X', ... } ] — foam.ENUM value declarations.
        valuesEntry: P.seq(topKey('values'), wsc, P.literal(':'), wsc,
          P.literal('['), wsc,
          P.optional(P.repeat(P.seq(wsc, P.sym('valueObject'), wsc), comma)),
          wsc, P.optional(P.literal(']'))),

        valueObject: P.seq(P.literal('{'), wsc,
          P.optional(P.repeat(P.sym('valueObjEntry'), comma)),
          wsc, P.optional(P.literal('}'))),

        valueObjEntry: P.alt(
          P.seq(propKey('name'), wsc, P.literal(':'), wsc,
            P.literal("'"), P.sym('enumValueName'), P.optional(P.literal("'"))),
          P.seq(propKey('name'), wsc, P.literal(':'), wsc,
            P.literal('"'), P.sym('enumValueName'), P.optional(P.literal('"'))),
          P.sym('genericEntry')
        ),

        enumValueName: P.msg(
          P.str(P.repeat(P.alt(P.range('a', 'z'), P.range('A', 'Z'),
            P.range('0', '9'), P.chars('_$')), null, 1)),
          { kind: 'value' }
        ),

        // Property `name: 'foo'` — emit a 'property' axiom position so
        // DefinitionHandler.buildLocationAtProperty can jump straight to
        // the declaration without text-scan regex.
        propertyNameValue: P.msg(
          P.str(P.repeat(P.alt(P.range('a', 'z'), P.range('A', 'Z'),
            P.range('0', '9'), P.chars('_$')), null, 1)),
          { kind: 'property' }
        ),

        // tableColumns/searchColumns: emit a 'columnName' category at each value
        // position so the LSP handler can detect context without regex scanning.
        // Real suggestions come from the model (this class's properties).
        tableColumnsEntry: P.seq(topKey('tableColumns'), wsc, P.literal(':'), wsc,
          P.literal('['), wsc,
          P.optional(P.repeat(P.seq(wsc, P.literal("'"), P.sym('columnName'),
            P.optional(P.literal("'")), wsc), comma)),
          wsc, P.optional(P.literal(']'))),
        searchColumnsEntry: P.seq(topKey('searchColumns'), wsc, P.literal(':'), wsc,
          P.literal('['), wsc,
          P.optional(P.repeat(P.seq(wsc, P.literal("'"), P.sym('columnName'),
            P.optional(P.literal("'")), wsc), comma)),
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
            P.str(P.repeat(P.alt(P.range('a', 'z'), P.range('A', 'Z'),
              P.range('0', '9'), P.chars('_.')), null, 1)),
            { type: 'columnName' }
          )
        ),

        importsEntry: P.seq(key('imports'), wsc, P.literal(':'), wsc, P.sym('array')),

        // exports: [ 'axiomName', 'axiomName as alias' ] — emit an 'exportName'
        // context marker per value so the LSP handler can suggest axiom names
        // (properties, methods, actions, listeners) from the enclosing model
        // instead of the class-ref fallback list.
        exportsEntry: P.seq(key('exports'), wsc, P.literal(':'), wsc,
          P.literal('['), wsc,
          P.optional(P.repeat(P.seq(wsc, P.literal("'"), P.sym('exportName'),
            P.optional(P.literal("'")), wsc), comma)),
          wsc, P.optional(P.literal(']'))),

        exportName: P.alt(
          P.sug(P.literal(''), foam.parse.Suggestion.create({
            text: '__ctx_exportName__', category: 'exportName', hint: 'axiom name'
          })),
          P.msg(
            P.str(P.repeat(P.alt(P.range('a', 'z'), P.range('A', 'Z'),
              P.range('0', '9'), P.chars('_ $')), null, 1)),
            { type: 'exportName' }
          )
        ),

        javaImportsEntry: P.seq(key('javaImports'), wsc, P.literal(':'), wsc,
          P.literal('['), wsc,
          P.optional(P.repeat(P.seq(wsc, P.sym('javaImport'), wsc), comma)),
          wsc, P.optional(P.literal(']'))),

        javaImport: P.seq1(1, P.literal("'"), P.sym('javaImportRef'), P.optional(P.literal("'"))),
        javaImportRef: P.alt(
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
          })),
          P.str(P.repeat(P.alt(P.range('a', 'z'), P.range('A', 'Z'),
            P.range('0', '9'), P.chars('._*')), null, 1))
        ),

        propertiesEntry: P.seq(key('properties'), wsc, P.literal(':'), wsc,
          P.literal('['), wsc,
          P.optional(P.repeat(P.sym('propertyDef'), comma)),
          wsc, P.optional(P.literal(']'))),

        methodsEntry: P.seq(key('methods'), wsc, P.literal(':'), wsc,
          P.literal('['), wsc,
          P.optional(P.repeat(P.sym('methodDef'), comma)),
          wsc, P.optional(P.literal(']'))),

        topLevelKey: P.alt(
          topKey('package'), topKey('name'), topKey('extends'), topKey('requires'),
          topKey('imports'), topKey('exports'), topKey('properties'), topKey('methods'),
          topKey('actions'), topKey('documentation'), topKey('abstract'),
          topKey('implements'), topKey('javaImports'), topKey('axioms'),
          topKey('css'), topKey('messages'), topKey('topics'), topKey('listeners'),
          topKey('constants'), topKey('sections'), topKey('flags'),
          topKey('tableColumns'), topKey('searchColumns'),
          topKey('refines'), topKey('label'), topKey('plural'), topKey('order'),
          topKey('ids'), topKey('javaCode'), topKey('cssTokens'), topKey('mixins'),
          topKey('static'), topKey('of'), topKey('values')
        ),

        // === CLASS REFERENCES (dynamic) ===
        // The permissive fallback is wrapped in msg() so diagnostic collection
        // can flag it as an unknown class — the msg is only consumed by
        // collectDiagnostics(), not by completion.
        classRef: P.alt(
          self.classRefParser_,
          P.msg(
            P.str(P.repeat(P.alt(P.range('a', 'z'), P.range('A', 'Z'),
              P.range('0', '9'), P.chars('._')), null, 1)),
            { type: 'unknownClassRef' }
          )
        ),

        // === PROPERTY DEFINITIONS ===
        // Try structured parse first, fall back to balanced braces if it fails
        propertyDef: P.alt(stringLiteral, P.sym('propertyObject'), P.sym('balancedBraces')),
        propertyObject: P.seq(P.literal('{'), wsc,
          P.optional(P.sym('propEntries')), wsc, P.optional(P.literal('}'))),
        propEntries: P.repeat(P.sym('propEntry'), comma),

        propEntry: P.alt(
          P.seq(P.sug(P.literal('class'), foam.parse.Suggestion.create({
            text: 'class', category: 'key' })),
            wsc, P.literal(':'), wsc, P.literal("'"), P.sym('propType'),
            P.optional(P.literal("'"))),
          P.seq(P.sug(P.literal('name'), foam.parse.Suggestion.create({
            text: 'name', category: 'key' })),
            wsc, P.literal(':'), wsc,
            P.literal("'"), P.sym('propertyNameValue'), P.optional(P.literal("'"))),
          P.seq(P.sug(P.literal('name'), foam.parse.Suggestion.create({
            text: 'name', category: 'key' })),
            wsc, P.literal(':'), wsc,
            P.literal('"'), P.sym('propertyNameValue'), P.optional(P.literal('"'))),
          P.seq(P.sug(P.literal('of'), foam.parse.Suggestion.create({
            text: 'of', category: 'key' })),
            wsc, P.literal(':'), wsc, P.literal("'"), P.sym('classRef'),
            P.optional(P.literal("'"))),
          // view: 'com.acme.MyView' — treat the string form exactly like `of:`
          // so class suggestions (including view classes) surface in viewSpec
          // positions. The { class: '...' } object form is covered by the
          // normal propEntry/class rule inside that object.
          P.seq(P.sug(P.literal('view'), foam.parse.Suggestion.create({
            text: 'view', category: 'key' })),
            wsc, P.literal(':'), wsc, P.literal("'"), P.sym('classRef'),
            P.optional(P.literal("'"))),
          P.seq(P.sug(P.literal('documentation'), foam.parse.Suggestion.create({
            text: 'documentation', category: 'key' })),
            wsc, P.literal(':'), wsc, stringLiteral),
          P.seq(P.sug(P.literal('hidden'), foam.parse.Suggestion.create({
            text: 'hidden', category: 'key' })),
            wsc, P.literal(':'), wsc, booleanLiteral),
          P.seq(P.sug(P.literal('transient'), foam.parse.Suggestion.create({
            text: 'transient', category: 'key' })),
            wsc, P.literal(':'), wsc, booleanLiteral),
          P.sym('propKey'),
          P.sym('genericEntry')
        ),

        propKey: P.alt(
          propKey('class'), propKey('name'), propKey('of'), propKey('documentation'),
          propKey('hidden'), propKey('transient'),
          propKey('value'), propKey('factory'), propKey('expression'),
          propKey('javaCode'), propKey('javaGetter'), propKey('javaPostSet'),
          propKey('javaPreSet'), propKey('javaFactory'),
          propKey('aliases'), propKey('label'), propKey('section'), propKey('visibility'),
          propKey('view'), propKey('adapt'), propKey('preSet'), propKey('postSet'),
          propKey('required'), propKey('width'), propKey('placeholder'), propKey('help'),
          propKey('gridColumns'), propKey('tableCellFormatter'), propKey('labelFormatter'),
          propKey('shortName'), propKey('readPermissionRequired'), propKey('writePermissionRequired'),
          propKey('validateObj'), propKey('tableWidth'), propKey('storageTransient'),
          propKey('cloneProperty'), propKey('networkTransient'), propKey('readOnly'),
          propKey('permissionRequired'), propKey('javaSetter'), propKey('javaInfoType')
        ),

        propType: P.alt(
          self.propTypeParser_,
          P.msg(
            P.str(P.repeat(P.alt(P.range('a', 'z'), P.range('A', 'Z'),
              P.range('0', '9'), P.chars('._')), null, 1)),
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
          P.optional(P.repeat(P.sym('methodObjEntry'), comma)),
          wsc, P.optional(P.literal('}'))),

        methodObjEntry: P.alt(
          P.seq(propKey('name'), wsc, P.literal(':'), wsc,
            P.literal("'"), P.sym('methodNameValue'), P.optional(P.literal("'"))),
          P.seq(propKey('name'), wsc, P.literal(':'), wsc,
            P.literal('"'), P.sym('methodNameValue'), P.optional(P.literal('"'))),
          P.sym('genericEntry')
        ),

        methodNameValue: P.msg(
          P.str(P.repeat(P.alt(P.range('a', 'z'), P.range('A', 'Z'),
            P.range('0', '9'), P.chars('_$')), null, 1)),
          { kind: 'method' }
        ),

        // === GENERIC CATCH-ALL ===
        genericEntry: P.seq(identifier, wsc, P.literal(':'), wsc, anyValue),

        // === STRUCTURAL ===
        array: P.seq(P.literal('['), wsc,
          P.optional(P.repeat(P.seq(wsc, anyValue, wsc), comma)),
          wsc, P.optional(P.literal(']'))),

        object: P.seq(P.literal('{'), wsc,
          P.optional(P.repeat(P.seq(wsc, P.sym('genericEntry'), wsc), comma)),
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
          P.sym('balancedBraces'), stringLiteral, backtickString,
          lineComment, blockComment, P.notChars('{}')
        ), null, 0)), P.literal('}'))
      };
    }
  ]
});
