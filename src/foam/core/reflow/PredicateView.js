/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PredicateOption',
  
  documentation: 'Model for predicate dropdown options',
  
  properties: [
    {
      class: 'String',
      name: 'id',
      factory: function() { return this.value; }
    },
    {
      class: 'String',
      name: 'value',
      documentation: 'The actual string value to insert (e.g., "is:active", "name")'
    },
    {
      class: 'String',
      name: 'label',
      documentation: 'Display label for the option'
    },

    {
      name: 'property',
      documentation: 'Optional reference to the property object'
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PredicateView',
  extends: 'foam.u2.View',

  requires: [
    'foam.u2.TextField',
    'foam.u2.view.RichChoiceIconView',
    'foam.core.reflow.PredicateOption',
    'foam.core.reflow.PropertyOptionCitationView'
  ],

  imports: [
    'eval_',
    'objData'
  ],

  css: `
    ^ {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    ^helper-icon svg { fill: currentColor; }
    ^helper-icon { vertical-align: sub; padding: 6px; }
    ^ .foam-u2-TextField {
      z-index: 10;
    }
  `,

  properties: [
    {
      name: 'choices',
      view: function(_, X) {
        var PredicateOption = foam.core.reflow.PredicateOption;
        var of = X.objData.dao.of;
        var options = [];
        
        // Add separator option
        options.push(PredicateOption.create({
          value: '--',
          label: '-- Choose Property --'
        }));
        
        // Process properties
        of.getAxiomsByClass(foam.lang.Property).forEach(p => {
          if ( ! p.searchable && ( p.hidden || p.networkTransient ) ) return;
          
          if ( foam.lang.Boolean.isInstance(p) ) {
            // Boolean predicates
            options.push(PredicateOption.create({
              value: 'is:' + p.name,
              label: 'is: ' + (p.label || p.name),
              property: p
            }));
            options.push(PredicateOption.create({
              value: '-is:' + p.name,
              label: 'isNot: ' + (p.label || p.name),
              property: p
            }));
          } else {
            // Other property types
            options.push(PredicateOption.create({
              value: p.name,
              label: p.label || p.name,
              property: p
            }));
          }
        });
        
        // Create DAO from options
        var dao = foam.dao.ArrayDAO.create({
          of: PredicateOption,
          array: options
        });
        
        return {
          class: 'foam.u2.view.RichChoiceIconView',
          themeIcon: 'plus',
          search: true,
          searchPlaceholder: 'Search properties...',
          idProperty: 'value',
          rowView: { class: 'foam.core.reflow.PropertyOptionCitationView' },
          sections: [
            {
              heading: 'Properties',
              dao: dao,
              searchBy: [ PredicateOption.LABEL, PredicateOption.VALUE ]
            }
          ]
        };
      },
      preSet: function(o, n) {
        if ( n == '--' || ! n ) return;
        if ( this.objData.where ) this.objData.where += ' ';
        this.objData.where += n;
        return '--';
      }
    }
  ],

  // Glyphs can be found at `foam3/src/foam/u2/theme/ThemeGlyphs.js`
  methods: [
    function render() {
      this.
        addClass().
        startContext({data: this}).add(this.CHOICES).endContext().
        tag(this.TextField, {data$: this.data$, size: 40});
    }
  ],

  listeners: [
    function mqlHelp() {
      this.eval_('helpMQL', true);
    }
  ]

});