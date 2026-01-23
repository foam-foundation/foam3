/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse',
  name: 'SimpleJavaScriptParser',

  documentation: 'A simple JavaScript expression parser for basic field operations with autocomplete support',

  requires: [
    'foam.parse.Alternate',
    'foam.parse.ImperativeGrammar',
    'foam.parse.Literal',
    'foam.parse.Parsers',
    'foam.parse.Suggest'
  ],

  axioms: [
    foam.pattern.Multiton.create({property: 'of'})
  ],

  properties: [
    {
      class: 'Class',
      name: 'of',
      documentation: 'The model class that defines available fields'
    },
    {
      name: 'headerMap',
      documentation: 'Optional map of normalized header names to original names',
      factory: function() { return {}; }
    },
    {
      name: 'grammar_',
      factory: function() {
        const cls = this.of;
        const fields = [];
        const properties = cls ? cls.getAxiomsByClass(foam.lang.Property) : [];

        // Build field list from model properties with suggestions
        // Filter out internal FOAM properties
        for ( var i = 0; i < properties.length; i++ ) {
          var prop = properties[i];

          // Skip internal FOAM properties that end with underscore or are hidden
          if ( prop.name.endsWith('_') || prop.hidden ) continue;

          var lit = this.Literal.create({
            s: prop.name,
            value: prop.name
          });

          // Build suggestion with original header name if available
          var original = this.headerMap[prop.name] || prop.label || prop.name;

          // Wrap with Suggest to provide autocomplete
          var suggestParser = this.Suggest.create({
            p: lit,
            suggestion: {
              text: prop.name,     // Normalized name (what gets inserted)
              label: original,     // Original header name (what's displayed)
              category: 'property'
            }
          });
          fields.push(suggestParser);
        }

        // Sort fields by length (longest first) then alphabetically
        fields.sort(function(a, b) {
          var aText = a.suggestion.text;
          var bText = b.suggestion.text;
          var c = foam.util.compare(bText.length, aText.length);
          if ( c ) return c;
          return foam.util.compare(aText, bText);
        });

        var base = foam.Function.withArgs(
          this.baseGrammar_,
          this.Parsers.create(), this);

        var grammar = {
          __proto__: base
        };

        // Create fieldname parser - if no fields, use the word parser from base
        if ( fields.length > 0 ) {
          grammar.fieldname = this.Alternate.create({args: fields});
        }
        // else fieldname will inherit from base.fieldname which is base.word

        var g = this.ImperativeGrammar.create({
          symbols: grammar
        });

        g.addActions({
          binaryOp: function(v) {
            // v[0] is the first term, v[1] is array of [ws, op, ws, term]
            var result = v[0];
            for ( var i = 0; i < v[1].length; i++ ) {
              var op = v[1][i][1];
              var right = v[1][i][3];
              result = '(' + result + ' ' + op + ' ' + right + ')';
            }
            return result;
          },
          parenExpr: function(v) { return '(' + v + ')'; },
          field: function(v) { return v; },
          string: function(v) { return v; },
          number: function(v) { return v[0] == null ? parseInt(v[1].join("")) : -parseInt(v[1].join("")); }
        });

        return g;
      }
    },
    {
      name: 'baseGrammar_',
      value: function(alt, anyChar, eof, join, literal, literalIC, not, notChars, optional, range,
        repeat, repeat0, seq, seq1, str, sug, sym, until) {
        return {
          START: sym('expr'),

          expr: alt(
            sym('binaryOp'),
            sym('string'),
            sym('field'),
            sym('number')
          ),

          binaryOp: seq(
            sym('term'),
            repeat(seq(
              sym('ws'),
              alt(
                sug(literal('+'), {text: '+', label: 'Add', category: 'operator'}),
                sug(literal('-'), {text: '-', label: 'Subtract', category: 'operator'}),
                sug(literal('*'), {text: '*', label: 'Multiply', category: 'operator'}),
                sug(literal('/'), {text: '/', label: 'Divide', category: 'operator'})
              ),
              sym('ws'),
              sym('term')
            ))
          ),

          term: alt(sym('string'), sym('field'), sym('number'), sym('parenExpr')),

          parenExpr: seq1(1, '(', sym('ws'), sym('expr'), sym('ws'), ')'),

          field: sym('fieldname'),

          string: str(seq1(1, '"', repeat(alt(literal('\\"', '"'), notChars('"'))), '"')),

          number: seq(optional(literal('-')), repeat(range('0', '9'), null, 1)),

          fieldname: sym('word'),

          word: str(repeat(alt(range('a', 'z'), range('A', 'Z'), range('0', '9'), '_'), null, 1)),

          ws: repeat0(alt(literal(' '), literal('\t'), literal('\n'), literal('\r')))
        };
      }
    }
  ],

  methods: [
    function parseString(str, opt_name, opt_apply) {
      return this.grammar_.parseString(str, opt_name, opt_apply);
    }
  ]
});
