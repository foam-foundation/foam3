/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2',
  name: 'CSSTokenModelRefinement',
  refines: 'foam.lang.Model',

  documentation: 'An Axiom for defining CSS class constants.',

  properties: [
    {
      name: 'cssTokens',
      class: 'AxiomArray',
      of: 'foam.u2.CSSToken',
      adapt: function(_, a, prop) {
        if ( ! a ) return [];
        if ( ! Array.isArray(a) ) {
          var cs = [];
          for ( var key in a ) {
            cs.push(foam.u2.CSSToken.create({name: key, value: a[key]}));
          }
          return cs;
        }
        return foam.lang.AxiomArray.ADAPT.value.call(this, _, a, prop);
      },
      adaptArrayElement: function(o, prop) {
        if ( Array.isArray(o) ) {
          return foam.u2.CSSToken.create({ name: o[0], value: o[1] });
        }

        return foam.lang.AxiomArray.ADAPT_ARRAY_ELEMENT.value.call(this, o, prop);
      }
    }
  ]
});
