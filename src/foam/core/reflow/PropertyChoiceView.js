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
  name: 'PropertyCitationView',
  extends: 'foam.u2.CitationView',
  methods: [
    function render() {   // to be used later for complex views
      this.add(this.data.label);
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PropertyChoiceView',
  extends: 'foam.u2.view.RichChoiceView',

  properties: [
    {
      name: 'of',
      postSet: function(_, value) {
        this.rebuildSections();
      }
    },
    'predicate',
    {
      name: 'search',
      value: true
    },
    {
      name: 'idProperty',
      value: 'name'
    },
    {
      name: 'choosePlaceholder',
      value: 'Choose Property'
    },
    {
      name: 'rowView',
      factory: function() {
        return { class: 'foam.core.reflow.PropertyCitationView' };
      }
    },
    {
      name: 'sections',
      factory: function() {
        if ( ! this.of ) return [
          {
            heading: 'Properties',
            dao: foam.dao.ArrayDAO.create({ array: [] })
          }
        ];
        
        let arr = this.of.getAxiomsByClass(foam.lang.Property)
          .filter(p => p.showInPropertyChoice)
          .filter(p => ! this.predicate || this.predicate(p));

        return [
          {
            heading: 'Properties',
            dao: foam.dao.ArrayDAO.create({ array: arr })
          }
        ];
      }
    }
  ],

  methods: [
    function rebuildSections() {
      this.clearProperty('sections');
    }
  ]
});
