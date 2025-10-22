/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse',
  name: 'SimpleQueryParser',

  documentation:
      'NQL parser that generates FOAM MLang predicates. Supports AND, OR, grouping, and property-specific predicates based on \
      the properties of the specified "of" class. The parser is meant to be used in search bars and similar simple query inputs. \
      It supports auto-completion via the QueryComplete class.',

  axioms: [
    // Reuse parsers if created for same 'of' class.
    foam.pattern.Multiton.create({property: 'of'})
  ],

  requires: [
    'foam.mlang.Constant',
    'foam.mlang.predicate.And',
    'foam.mlang.predicate.ContainsIC',
    'foam.mlang.predicate.DotF',
    'foam.mlang.predicate.Eq',
    'foam.mlang.predicate.Neq',
    'foam.mlang.predicate.Gt',
    'foam.mlang.predicate.Gte',
    'foam.mlang.predicate.Has',
    'foam.mlang.predicate.In',
    'foam.mlang.predicate.InIC',
    'foam.mlang.predicate.Lt',
    'foam.mlang.predicate.Lte',
    'foam.mlang.predicate.Not',
    'foam.mlang.predicate.Or',
    'foam.mlang.predicate.True',
    'foam.parse.Alternate',
    'foam.parse.Grammar',
    'foam.parse.LiteralIC',
    'foam.parse.Suggest',
    'foam.parse.Parsers',
    'foam.parse.StringPStream'
  ],

  properties: [
    {
      class: 'Class',
      name: 'of'
    },
    /** An optional input. If this is defined, 'me' is a keyword in the search
     * and can be used for queries like <tt>owner:me</tt>. Note that since
     * there is exactly one parser instance per 'of' value, the value of 'me' is
     * also shared.
     */
    {
      class: 'String',
      name: 'me' //TODO: Implement 'me' support.
    },
    {
      class: 'Boolean',
      name: 'allowShortNames',
      value: false // TODO: Implement short names support.
    },
    {
      name: 'baseGrammar_',
      value: function(alt, anyChar, literal, literalIC, notChars, optional, range, repeat, repeat0, seq, seq1, str, sug, sym) {

        // helper to create an operator parser that ignores operators case and surrounding whitespace and provides a suggestion
        let operator = (str) => {
          return alt(
            seq1(2, ' ', sym('ws'), sug(literalIC(str), {text: str})),
            literalIC(str) // allow the option without leading spaces, it is still valid, even though it won't suggest
          );
        }
        this.operator = operator;
        let operatorIn = (str) => {
          return (
            seq1(2, ' ', sym('ws'), sug(seq1(0, literalIC(str), sym('ws'), '('), {text: str + ' (', label: str }))
          );
        }
        this.operatorIn = operatorIn;

        return {
          START: seq1(0, sym('query') /*, sym('ws'), eof()*/),

          query: sym('or'),

          or: repeat(
              sym('and'),
              seq(' ', seq1(1, sym('ws'), sug(alt(literalIC('OR'), literal('|')), {text: 'OR'}))),
            1),

          and: repeat(
            sym('expr'),
            seq(' ', seq1(1, sym('ws'), sug(alt(literalIC('AND'), literal('&')), {text: 'AND'}))),
            1),

          expr: alt(
            sym('paren'),
            sym('propPredicates'),
            sym('rangePropPredicates')
          ),

          // opening parentheses consumed by propPredicates
          paren: seq1(3, sym('ws'), '(', sym('ws'), sym('query'), sym('ws'), ')'),

          ws: repeat0(' '),

          floats: repeat(sym('float'), ',', 2),

          'range float': seq1(1, sym('ws'), sym('floats'), sym('ws'), ')'),

          digits: str(repeat(range('0', '9'), null, 1)),

          // TODO replace '.' with an internationalized decimal point, or have the input preprocessed
          float: seq1(1, sym('ws'), str(seq(optional('-'), sym('digits'), optional(str(seq('.', optional(sym('digits')))))))),

          compareFloat: alt(
            seq(operator('>='), sym('float')),
            seq(operator('>'), sym('float')),
            seq(operator('<='), sym('float')),
            seq(operator('<'), sym('float')),
            seq(operator('!='), sym('float')),
            seq(operator('='), sym('float')),
            seq(operatorIn('IN RANGE'), sym('range float')),
            seq(operatorIn('NOT IN RANGE'), sym('range float'))),

          compareNumber: alt(
            seq(operator('>='), sym('number')),
            seq(operator('>'), sym('number')),
            seq(operator('<='), sym('number')),
            seq(operator('<'), sym('number')),
            seq(operator('!='), sym('number')),
            seq(operator('='), sym('number')),
            seq(operatorIn('IN'), sym('numberArray')),
            seq(operatorIn('NOT IN'), sym('numberArray'))),

          numberArray: seq1(1, sym('ws'), sym('numbers'), sym('ws'), ')'),

          numbers: repeat(sym('number'), ',', 1),

          number: seq1(1, sym('ws'), seq(optional('-'), sym('digits'))),

          compareBoolean: alt(seq(' ', seq1(1, sym('ws'), sug(literalIC('IS TRUE'), {text: 'IS TRUE'}))),
                              seq(' ', seq1(1, sym('ws'), sug(literalIC('IS FALSE'), {text: 'IS FALSE'})))),

          date: seq1(1, sym('ws'),
            alt(
              sym('literal date'),
              sym('relative date')
            )
          ),

          // IMPORTANT: order matters, put more complex first
          'literal date': alt(
            // YYYY-MM-DDTHH:MM:SS.mmmZ (or YY)
            sug(seq(sym('digits'), anyChar('-/'), sym('digits'), anyChar('-/'), sym('digits'), 'T',
                sym('digits'), ':', sym('digits'),  ':', sym('digits'),  '.', sym('digits'), 'Z'),
                {tooltip: 'YYYY/MM/DDTHH:MM:SS.mmmZ'}),
            // YYYY-MM-DDTHH:MM:SS.mmm (or YY)
                sug(seq(sym('digits'), anyChar('-/'), sym('digits'), anyChar('-/'), sym('digits'), 'T',
                sym('digits'), ':', sym('digits'),  ':', sym('digits'),  '.', sym('digits')),
                {tooltip: 'YYYY/MM/DDTHH:MM:SS.mmm'}),
            // YYYY-MM-DDTHH:MM:SS (or YY)
            sug(seq(sym('digits'), anyChar('-/'), sym('digits'), anyChar('-/'), sym('digits'), 'T',
                sym('digits'), ':', sym('digits'),  ':', sym('digits')),
                {tooltip: 'YYYY/MM/DDTHH:MM:SS'}),
            // YYYY-MM-DDTHH:MM (or YY)
            sug(seq(sym('digits'), anyChar('-/'), sym('digits'), anyChar('-/'), sym('digits'), 'T', sym('digits'), ':', sym('digits')),
                {tooltip: 'YYYY/MM/DDTHH:MM'}),
            // YYYY-MM-DDTHH (or YY)
            sug(seq(sym('digits'), anyChar('-/'), sym('digits'), anyChar('-/'), sym('digits'), 'T', sym('digits')),
                {tooltip: 'YYYY/MM/DDTHH'}),
            // YYYY-MM-DD (or YY)
            sug(seq(sym('digits'), anyChar('-/'), sym('digits'), anyChar('-/'), sym('digits')),
                {tooltip: 'YYYY/MM/DD'}),
            // YYYY-MM (or YY)
            sug(seq(sym('digits'), anyChar('-/'), sym('digits')),
                {tooltip: 'YYYY/MM'}),
            // YYYY (or YY)
            sug(seq(sym('digits')), {tooltip: 'YYYY'}),
          ),

          // TODAY[±n]
          'relative date': seq(
            sug(literalIC('TODAY'), {text: 'TODAY', label: 'TODAY[+/-n]'}),
            optional(seq(anyChar("+-"), sym('digits')))
          ),

          dates: repeat(sym('date'), ',', 2),

          'range date': seq1(1, sym('ws'), sym('dates'), sym('ws'), ')'),

          compareDate: alt(
            seq(operator('>='), sym('date')),
            seq(operator('>'), sym('date')),
            seq(operator('<='), sym('date')),
            seq(operator('<'), sym('date')),
            seq(operator('!='), sym('date')),
            seq(operator('='), sym('date')),
            seq(operatorIn('IN RANGE'), sym('range date')),
            seq(operatorIn('NOT IN RANGE'), sym('range date')),
            seq(operator('IS EMPTY')),
            seq(operator('IS NOT EMPTY'))),


          string: seq1(1, sym('ws'), alt(sym('word'), sym('quoted string'))),

          'quoted string': str(seq1(1, '"',
            repeat(alt(literal('\\"', '"'), notChars('"'))),
            '"')),

          word: str(repeat(sym('char'), null, 1)),

          char: alt(range('a', 'z'), range('A', 'Z'), range('0', '9'), '-', '^',
            '_', '@', '%', '.'),

          stringArray: seq1(1, sym('ws'), sym('strings'), sym('ws'), ')'),

          strings: repeat(sym('string'), ',', 1),

          compareString: alt(
            seq(operator('>='), sym('string')),
            seq(operator('>'), sym('string')),
            seq(operator('>='), sym('string')),
            seq(operator('<='), sym('string')),
            seq(operator('<'), sym('string')),
            seq(operator('!='), sym('string')),
            seq(operator('='), sym('string')),
            seq(operator(':'), sym('string')),
            seq(operator('~'), sym('string')),
            seq(operator('CONTAINS'), sym('string')),
            seq(operatorIn('IN'), sym('stringArray')),
            seq(operatorIn('NOT IN'), sym('stringArray')),
            seq(operator('IS EMPTY')),
            seq(operator('IS NOT EMPTY'))),
        };
      }
    },
    {
      name: 'propertiesGrammar_',
      value: function(action, alt, nyChar, eof, join, literal, literalIC, not, notChars, optional, range,
        repeat, repeat0, seq, seq1, str, sug, sym, until) {

        let cls                 = this.of;
        let propPredicates      = [];
        let rangePropPredicates = [];
        let props               = cls.getAxiomsByClass(foam.lang.Property);
        let operator            = this.operator;
        let operatorIn          = this.operatorIn;
        let property            = (prop) => seq1(1, sym('ws'),  sug(literal(prop.name, prop), {text: prop.name, label: prop.label}));

        for ( var i = 0 ; i < props.length ; i++ ) {
          let prop = props[i];

          if ( ! prop.searchable ) continue;

          // Property or Referenced Property, the effective type of the Property
          let refProp = prop;

          // TODO: It would be better to handle references with a custom view:
          // which auto-completes based on DAO searches.
          if ( foam.lang.Reference.isInstance(prop) ) {
            refProp = prop.of.ID;
            if ( foam.lang.IDAlias.isInstance(refProp) ) {
              refProp = prop.of.getAxiomByName(refProp.propName);
            }
          }

          if ( foam.lang.Int.isInstance(refProp) ) {
            propPredicates.push(seq(property(prop), sym('compareNumber')));
          }
          else if (foam.lang.Boolean.isInstance(refProp)) {
            propPredicates.push(seq(property(prop), sym('compareBoolean')));
          }
          else if ( foam.lang.Enum.isInstance(refProp) ) {
            let value = (v) => seq1(1, sym('ws'),  sug(literal(v), {text: v}));
            let enumValue  = alt.apply(null, prop.of.VALUES.map(v => value(v.name)));
            let enumArray  = seq1(0, repeat(seq1(0, enumValue, sym('ws')), ',', 1), sym('ws'),')');

            let compareEnum = action(
              alt(seq(operator('='), enumValue),
                  seq(operator('!='), enumValue),
                  seq(operatorIn('IN'), enumArray),
                  seq(operatorIn('NOT IN'), enumArray)),
              function(v) {
                return {
                  operator: v[0],
                  value: v[1]
                };
              });

            propPredicates.push(seq(property(prop), compareEnum));
          }
          else if ( foam.lang.Date.isInstance(refProp) || foam.lang.DateTime.isInstance(refProp) ) {
            rangePropPredicates.push(seq(property(prop), sym('compareDate')));
          }
          else if ( foam.lang.Float.isInstance(refProp) ) {
            propPredicates.push(seq(property(prop), sym('compareFloat')));
          }
          else if ( foam.lang.String.isInstance(refProp) ) {
            propPredicates.push(seq(property(prop), sym('compareString')));
          }
        }

        // return the properties grammar map
        return {propPredicates: alt.apply(null, propPredicates), rangePropPredicates: alt.apply(null, rangePropPredicates)};
      }
    },
    {
      name: 'grammar_',
      factory: function() {
        let base       = foam.Function.withArgs(this.baseGrammar_,       this.Parsers.create(), this);
        let properties = foam.Function.withArgs(this.propertiesGrammar_, this.Parsers.create(), this);
        let grammar    = {
          __proto__: base,
          propPredicates: properties.propPredicates,
          rangePropPredicates: properties.rangePropPredicates
        };
        let self       = this;
        let actions    = {
          or: function(v) {
            return self.Or.create({ args: v });
          },

          and: function(v) {
            return self.And.create({ args: v });
          },

          digits: function(v) {
            return parseInt(v.trim());
          },

          number: function(v) {
            return v[0] ? v[1] * -1 : v[1];
          },

          float: function(v) {
            let start = end = parseFloat(v.trim());
            // account for float's precision inconsistencies
            start -= Number.EPSILON;
            end += Number.EPSILON;
            return [ start, end ];
          },

          compareBoolean: function(v) {
            return {operator: 'IS',
                    value: v[1].toLowerCase().endsWith('true') ? true : false // redundant but clearer
            }
          },

          compareNumber: function(v) {
            return {
              operator: v[0],
              value: v[1]
            };
          },

          compareDate: function(v) {
            return {
              operator: v[0],
              value: v[1]? {start: v[1][0], end: v[1][1]} : null // date range, except for EMPTY operators
            };
          },

          date: function(v) {
            return v; // Pass through the already parsed date
          },

          compareString: function(v) {
            return {
              operator: v[0],
              value: v[1]
            };
          },

          // All dates are actually treated as ranges. These are arrays of Date
          // objects: [start, end]. The start is inclusive and the end exclusive.
          // Using these objects, both ranges (date:2014, date:2014-05..2014-06)
          // and open-ended ranges (date > 2014-01-01) can be computed higher up.
          'literal date': function(v) {
            let defaults = [0, 1, 1, 12]; // default values for missing date parts since we want the dates to default to noon UTC
            let values = v.filter((x, i) => i % 2 === 0); // remove separators
            let i = values.length;
            while (values.length < 4) {
              values.push(defaults[values.length]);
            }
            values[0] = values[0] < 100 ? values[0] + 2000 : values[0], // convert 2-digit year to 4-digit
            values[1] -= 1; // month is zero-based
            let start = new Date(Date.UTC.apply(null, values));
            values[i - 1]++; // bump last given value for end of range
            let end  = new Date(Date.UTC.apply(null, values))
            return [ start, end ];
          },

          'relative date': function(v) {
            // We turn this into a Date range around the current date
            let d = new Date();
            let year  = d.getFullYear();
            let month = d.getMonth();
            let date  = d.getDate(); // day of the month

            // if there is an offset, apply it
            if ( v[1] ) {
              let s = v[1][0] === '+' ? 1 : -1;
              date += (v[1][1]) * s;
            }
            return actions['literal date']([ year, '-', month + 1, '-', date]);
          },

          'range date': function(v) {
            return [ v[0][0], v[1][1] ]; // [start of first, end of second]
          },

          'range float': function(v) {
            return [ v[0][0], v[1][1] ]; // [start of first, end of second]
          },

          propPredicates: function(v) {
            let prop   = v[0];
            let operator = v[1].operator;
            let value    = v[1].value;

            switch (operator) {
              case '=':
                return self.Eq.create({ arg1: prop, arg2: value});
              case '!=':
                return self.Neq.create({arg1: prop, arg2: value});
              case '>=':
                return self.Gte.create({arg1: prop, arg2: value});
              case '>':
                return self.Gt.create({arg1: prop, arg2: value});
              case '<=':
                return self.Lte.create({arg1: prop, arg2: value});
              case '<':
                return self.Lt.create({arg1: prop, arg2: value});
              case 'IN':
                return self.In.create({arg1: prop, arg2: value});
              case 'NOT IN':
                return self.Not.create({arg1: self.In.create({arg1: prop, arg2: value})});
              case 'IS':
                return self.Eq.create({ arg1: prop, arg2: value});
              case 'CONTAINS':
              case ':':
              case '~':
                return self.ContainsIC.create({ arg1: prop, arg2: value });
              case 'IS EMPTY':
                return self.Not.create({arg1: self.Has.create({ arg1: prop })});
              case 'IS NOT EMPTY':
                return self.Has.create({ arg1: prop });

            }
          },

          rangePropPredicates: function(v) {
            let prop     = v[0];
            let operator = v[1].operator;
            let value    = v[1].value;

            switch (operator) {
              case '=':
              case 'IN RANGE':
                return self.And.create({
                  args: [
                    self.Gte.create({ arg1: prop, arg2: value.start }),
                    self.Lt.create({ arg1: prop, arg2: value.end })]
                  });
              case '!=':
              case 'NOT IN RANGE':
                return self.And.create({
                  args: [
                    self.Gte.create({ arg1: prop, arg2: value.end }),
                    self.Lt.create({ arg1: prop, arg2: value.start })]
                  });
              case '>=':
                return self.Gte.create({arg1: prop, arg2: value.start});
              case '>':
                return self.Gt.create({arg1: prop, arg2: value.end});
              case '<=':
                return self.Lte.create({arg1: prop, arg2: value.end});
              case '<':
                return self.Lt.create({arg1: prop, arg2: value.start});
              case 'IS EMPTY':
                return self.Not.create({arg1: self.Has.create({ arg1: prop })});
              case 'IS NOT EMPTY':
                return self.Has.create({ arg1: prop });
            }
          },
        };

        let g = this.Grammar.create({
          symbols: grammar
        });

        g.addActions(actions);
        return g;
      }
    }
  ],

  methods: [
    function parseString(str, opt_name, opt_apply) {
      let query = this.grammar_.parseString(str, opt_name, opt_apply);
      // if we can simplify the query, do so now (something AND FALSE -> FALSE)
      query = query && query.partialEval ? query.partialEval() : query;
      return query;
    }
  ]
});
