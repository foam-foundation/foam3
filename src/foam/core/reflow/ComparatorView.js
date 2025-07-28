/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ComparatorOption',
  
  documentation: 'Model for comparator dropdown options',
  
  properties: [
    {
      class: 'String',
      name: 'id',
      factory: function() { return this.value; }
    },
    {
      class: 'String',
      name: 'value',
      documentation: 'The actual string value to insert (e.g., "name", "-createdDate")'
    },
    {
      class: 'String',
      name: 'label',
      documentation: 'Display label for the option'
    },
    {
      class: 'String',
      name: 'direction',
      documentation: 'Sort direction: ASC or DESC',
      value: 'ASC'
    },
    {
      name: 'property',
      documentation: 'Optional reference to the property object'
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ComparatorView',
  extends: 'foam.u2.View',

  requires: [
    'foam.u2.TextField',
    'foam.u2.view.RichChoiceIconView',
    'foam.core.reflow.ComparatorOption',
    'foam.core.reflow.PropertyOptionCitationView'
  ],

  imports: [
    'objData'
  ],

  css: `
    ^ {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    ^ .foam-u2-TextField {
      z-index: 10;
    }
  `,

  properties: [
    {
      name: 'choices',
      view: function(_, X) {
        var ComparatorOption = foam.core.reflow.ComparatorOption;
        var of = X.objData.dao.of;
        var options = [];
        
        // Add separator option
        options.push(ComparatorOption.create({
          value: '--',
          label: 'Choose Property'
        }));
        
        // Process properties
        of.getAxiomsByClass(foam.lang.Property).forEach(p => {
          if ( p.hidden || p.networkTransient ) return;
          
          // Ascending option
          options.push(ComparatorOption.create({
            value: p.name,
            label: '↑ ' + (p.label || p.name),
            direction: 'ASC',
            property: p
          }));
          
          // Descending option
          options.push(ComparatorOption.create({
            value: '-' + p.name,
            label: '↓ ' + (p.label || p.name),
            direction: 'DESC',
            property: p
          }));
        });
        
        // Create DAO from options
        var dao = foam.dao.ArrayDAO.create({
          of: ComparatorOption,
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
              heading: 'Sort By',
              dao: dao,
              searchBy: [ ComparatorOption.LABEL, ComparatorOption.VALUE ]
            }
          ]
        };
      },
      preSet: function(o, n) {
        if ( n == '--' || ! n ) return;
        if ( this.objData.order ) this.objData.order += ',';
        this.objData.order += n;
        return '--';
      }
    }
  ],

  methods: [
    function render() {
      this.
        addClass().
        startContext({data: this}).add(this.CHOICES).endContext().
        tag(this.TextField, {data$: this.data$, size: 40, type: 'search'});
    }
  ],

  listeners: [
  ]

});