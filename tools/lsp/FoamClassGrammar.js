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

      // Property types — all subclasses of foam.lang.Property
      var propTypes = this.index.getPropertyTypes();
      var propTypeParsers = propTypes.map(function(t) {
        return P.sug(P.literalIC(t.name), foam.parse.Suggestion.create({
          text: t.name,
          category: 'property',
          hint: t.doc || t.id
        }));
      });
      this.propTypeParser_ = propTypeParsers.length > 0 ?
        P.alt.apply(P, propTypeParsers) : P.literalIC('String');

      // Class references — all known class IDs
      var ids = this.index.getAllClassIds();
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
          P.sym('pomKey'),
          P.sym('genericEntry')
        ),

        pomKey: P.alt(
          key('name'), key('version'), key('files'), key('projects'),
          key('javaDependencies'), key('javaFiles'), key('journalFiles')
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
          P.sym('importsEntry'),
          P.sym('exportsEntry'),
          P.sym('javaImportsEntry'),
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

        importsEntry: P.seq(key('imports'), wsc, P.literal(':'), wsc, P.sym('array')),
        exportsEntry: P.seq(key('exports'), wsc, P.literal(':'), wsc, P.sym('array')),

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
          key('package'), key('name'), key('extends'), key('requires'),
          key('imports'), key('exports'), key('properties'), key('methods'),
          key('actions'), key('documentation'), key('abstract'),
          key('implements'), key('javaImports'), key('axioms'),
          key('css'), key('messages'), key('topics'), key('listeners'),
          key('constants'), key('sections'), key('flags'),
          key('tableColumns'), key('searchColumns'),
          key('refines'), key('label'), key('plural'), key('order'),
          key('ids'), key('javaCode'), key('cssTokens'), key('mixins'),
          key('static'), key('of'), key('values')
        ),

        // === CLASS REFERENCES (dynamic) ===
        classRef: P.alt(
          self.classRefParser_,
          P.str(P.repeat(P.alt(P.range('a', 'z'), P.range('A', 'Z'),
            P.range('0', '9'), P.chars('._')), null, 1))
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
            wsc, P.literal(':'), wsc, stringLiteral),
          P.seq(P.sug(P.literal('of'), foam.parse.Suggestion.create({
            text: 'of', category: 'key' })),
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
          key('class'), key('name'), key('of'), key('documentation'),
          key('hidden'), key('transient'),
          key('value'), key('factory'), key('expression'),
          key('javaCode'), key('javaGetter'), key('javaPostSet'),
          key('javaPreSet'), key('javaFactory'),
          key('aliases'), key('label'), key('section'), key('visibility'),
          key('view'), key('adapt'), key('preSet'), key('postSet'),
          key('required'), key('width'), key('placeholder'), key('help'),
          key('gridColumns'), key('tableCellFormatter'), key('labelFormatter'),
          key('shortName'), key('readPermissionRequired'), key('writePermissionRequired'),
          key('validateObj'), key('tableWidth'), key('storageTransient'),
          key('cloneProperty'), key('networkTransient'), key('readOnly'),
          key('permissionRequired'), key('javaSetter'), key('javaInfoType')
        ),

        propType: P.alt(
          self.propTypeParser_,
          P.str(P.repeat(P.alt(P.range('a', 'z'), P.range('A', 'Z'),
            P.range('0', '9'), P.chars('._')), null, 1))
        ),

        // === METHOD DEFINITIONS ===
        methodDef: P.alt(P.sym('functionBody'), P.sym('object')),

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
