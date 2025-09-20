/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse',
  name: 'SimpleQueryParser',

  documentation:
      'Create a query strings to MLangs parser for a particular class.',

  axioms: [
    // Reuse parsers if created for same 'of' class.
    foam.pattern.Multiton.create({property: 'of'})
  ],

  // TODO(braden): Support KEYWORD predicates and queries on them.

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
   // 'foam.mlang.predicate.MQLExpr',
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
      name: 'me'
    },
    {
      class: 'Boolean',
      name: 'allowShortNames',
      value: true
    },
    {
      name: 'baseGrammar_',
      value: function(alt, anyChar, eof, join, literal, literalIC, not, notChars, optional, range,
        repeat, repeat0, seq, seq1, str, sug, sym, until) {

         // TODO remove extra ws handling, should be only before or after, decide based on what works better for the suggestions

        // helper to create an operator parser that ignores operators case and surrounding whitespace and provides a suggestion
        let operator = (str) => {
          return alt(
            seq(' ', seq1(1, sym('ws'), sug(literalIC(str), {text: str}))),
            seq1(1, sym('ws'), literalIC(str))
          );
        }
        this.operator = operator;

        return {
          START: seq1(0, sym('query') /*, sym('ws'), eof()*/),

          query: sym('or'),

          or: repeat(
              sym('and'),
              seq(' ', seq1(1, sym('ws'), sug(alt(literalIC('OR'), literal('|')), {text: 'OR'}))), 
            1),

          and: repeat(
              sym('propPredicates'),
              seq(' ', seq1(1, sym('ws'), sug(alt(literalIC('AND'), literal('&')), {text: 'AND'}))), 
            1),

          ws: repeat0(' '),

          compareNumber: alt(seq(operator('>='), sym('number')),
                             seq(operator('>'), sym('number')),
                             seq(operator('<='), sym('number')),
                             seq(operator('<'), sym('number')),
                             seq(operator('!='), sym('number')),
                             seq(operator('='), sym('number')),
                             seq(operator('IN'), sym('numberArray')),
                             seq(operator('NOT IN'), sym('numberArray'))),

          numberArray: seq1(2, sym('ws'), '(', sym('numbers'), ')'),

          numbers: repeat(sym('number'), ',', 1),

          // TODO replace '.' with an internationalized decimal point, add negative number support
          number: seq1(1, sym('ws'), repeat(range('0', '9'), null, 1), optional('.'), repeat(range('0', '9'))),
          
          compareBoolean: alt(seq(' ', seq1(1, sym('ws'), sug(literalIC('IS TRUE'), {text: 'IS TRUE'}))),
                              seq(' ', seq1(1, sym('ws'), sug(literalIC('IS FALSE'), {text: 'IS FALSE'})))),

                              
        };
      }
    },
    {
      name: 'propertiesGrammar_',
      value: function(alt, anyChar, eof, join, literal, literalIC, not, notChars, optional, range,
        repeat, repeat0, seq, seq1, str, sug, sym, until) { 

        let cls    = this.of;
        let propPredicates = [];
        let props = cls.getAxiomsByClass(foam.lang.Property);
        let operator = this.operator;
        let property = (prop) => {
            return alt(
              seq(' ', seq1(1, sym('ws'), sug(literal(prop.name, prop), {text: prop.name}))),
              seq1(1, sym('ws'), literal(prop.name, prop))
          );        
        }

        for ( var i = 0 ; i < props.length ; i++ ) {

          let prop = props[i];

          if ( ! prop.searchable ) continue;

          if (foam.lang.Int.isInstance(prop) || foam.lang.Float.isInstance(prop)) {
            propPredicates.push(seq(property(prop), sym('compareNumber')));     
          } else if (foam.lang.Boolean.isInstance(prop)) { 
            propPredicates.push(seq(property(prop), sym('compareBoolean')));    
          } 
          /*
          else if ( foam.lang.Enum.isInstance(prop) ) {

           let enumValue = alt.apply(null, prop.of.VALUES.map(v => sug(seq1(1, sym('ws'),literalIC(v.name, v), sym('ws')), { text: v.name })));
           let enumArray = seq1(2, sym('ws'), '(', repeat(enumValue, ',', 1), ')', sym('ws'));
           //let compareEnum = seq(seq1(1, sym('ws'), operator('='), sym('ws')),literalIC('ACTIVE'));
       
           let compareEnum = alt(seq(operator('='), enumValue),
                                 seq(operator('!='), enumValue),
                                 seq(operator('IN'), enumArray),
                                 seq(operator('NOT IN'), enumArray));
    
            propPredicates.push(seq(sug(literalIC(prop.name, prop),{text: prop.name}), compareEnum));
          }
            */

        } 
        // return the properties grammar map
        return {propPredicates: alt.apply(null, propPredicates)};       
      }
    },  
    {
      name: 'grammar_',
      factory: function() {
       

        let base = foam.Function.withArgs(this.baseGrammar_, this.Parsers.create(), this);
        let properties = foam.Function.withArgs(this.propertiesGrammar_, this.Parsers.create(), this); 

        let grammar = {
          __proto__: base,
          propPredicates: properties.propPredicates
        };

        let self = this;

        // TODO: Fix me to just build the object directly. ???
        let actions = {

          or: function(v) {
            return self.Or.create({ args: v });
          },

          and: function(v) {
            return self.And.create({ args: v });
          },  

          number: function(v) {
            console.log("number: " + v);
            return parseInt(v);
          },

          compareBoolean: function(v) {
            return {operator: 'IS',
                    value: v[1].toLowerCase().endsWith('true') ? true : false // redundant but clearer
            }
          },  

          compareNumber: function(v) {
            return {
              operator: foam.Array.isInstance(v[0])? v[0][1] : v[0],
              value: v[1]
            };
          },
    
          propPredicates: function(v){
            let prop   = foam.Array.isInstance(v[0])? v[0][1] : v[0];
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



