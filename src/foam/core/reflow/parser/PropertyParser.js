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

  properties: [
    'of'
  ],

  methods: [
    function grammar(alt, literalIC, seq, sug, sym, repeat, optional) {
      const comparator = (a, b) => b.length - a.length || foam.util.compare(a, b);

      const ps = this.of.getAxiomsByClass(foam.lang.Property).map(p =>
        sug(literalIC(p.name), {
          text:  p.name,
          label: p.label,
          prependSpaceOnSelect: false,
          category: 'property'
        })
      );

      return {
        START: sym('property'),

        property: alt.apply(null, ps),

        propertyList: repeat(sym('property'), ','),

        comparator: repeat(sym('simpleComparator'), sym('comma')),

        simpleComparator: seq(optional(sym('neg')), sym('property')),
//        simpleComparator: seq(sym('property'), optional(sym('direction')),

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
