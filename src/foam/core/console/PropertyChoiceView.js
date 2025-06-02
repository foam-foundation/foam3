/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.console',
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
  package: 'foam.core.console',
  name: 'PropertyChoiceView',
  extends: 'foam.u2.view.ChoiceView',

  properties: [
    'of',
    'predicate',
    'optionalChoice',
    {
      name: 'choices',
      factory: null,
      expression: function(of) {
        // why???
        debugger
        var choices = this.optionalChoice ? [ this.optionalChoice ] : [];
        if ( ! of?.length ) return choices;
        this.of.getAxiomsByClass(foam.lang.Property).forEach(p => {
          if ( ! p.showInPropertyChoice ) return;
          if ( this.predicate && ! this.predicate(p) ) return;
          choices.push([p, p.name]);
        });
        if ( choices.length ) this.data = choices[0][0];
        return choices;
      }
    }
  ]
});
