/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.parser',
  name: 'PropertyParser',
  extends: 'foam.parse.Grammar',

  documentation: `
    Parsers related to the properties of a model.
    Can be used to parse a single property, a list of properties, or an SQL-style order by list.
  `,

  imports: [ 'of' ],

  properties: [
    {
      name: 'predicate',
      value: { f: function() { return true; } }
    }
  ],

  methods: [
    function grammar(alt, literalIC, seq, seq1, sug, sym, repeat, optional) {
      const comparator = (a, b) => b.length - a.length || foam.util.compare(a, b);

      const ps = this.of.getAxiomsByClass(foam.lang.Property).filter(p => this.predicate.f(p)).map(p =>
        sug(literalIC(p.name), {
          text:  p.name,
          label: p.label,
          prependSpaceOnSelect: false,
          category: 'property'
        })
      );

      return {
        START: seq1(0, sym('property'), repeat(' ')),

        property: alt.apply(null, ps),

        propertyListList: repeat(sym('propertyList'), sym('semiColon')),

        propertyList: repeat(sym('property'), sym('comma')),

        comparator: repeat(sym('simpleComparator'), sym('comma')),

        simpleComparator: seq(optional(sym('neg')), sym('property')),
//        simpleComparator: seq(sym('property'), optional(sym('direction')),

        semiColon: sug(';',  {text: ';', label: 'List Sepearator',  prependSpaceOnSelect: false, category: 'operator'}),

        comma: sug(',',  {text: ',', label: 'List Operator',  prependSpaceOnSelect: false, category: 'operator'}),

        neg: sug('-',  {text: '-', label: 'Descending Order',  prependSpaceOnSelect: false, category: 'operator'}),

        direction: alt(
          sug(literalIC(' asc'),  {text: ' ASC',  prependSpaceOnSelect: false}),
          sug(literalIC(' desc'), {text: ' DESC', prependSpaceOnSelect: false})
        )
      };
    }
  ]
});
