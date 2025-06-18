/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PropertyRefinement',
  refines: 'Property',

  properties: [
    {
      class: 'Boolean',
      name: 'showInPropertyChoice',
      factory: function() { return ! this.hidden && ! this.networkTransient; }
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PropertyChoiceView',
  extends: 'foam.u2.view.ChoiceView',

  properties: [
    {
      name: 'of',
      postSet: function(_, value) {
        this.choices = undefined;
      }
    },
    'predicate',
    'optionalChoice',
    {
      name: 'choices',
      expression: function(of) {
        var choices = [ ];
        if ( this.optionalChoice ) choices.push(this.optionalChoice);
        if ( of ) {
          this.of.getAxiomsByClass(foam.lang.Property).forEach(p => {
            if ( ! p.showInPropertyChoice ) return;
            if ( this.predicate && ! this.predicate(p) ) return;
            choices.push([p, p.label]);
          });
        }
        if ( choices.length ) this.data = choices[0][0];
        return choices;
      }
    }
  ]
});
