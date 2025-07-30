/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PropertyOption',
  
  documentation: 'Model for property-based dropdown options',
  
  properties: [
    {
      class: 'String',
      name: 'id',
      documentation: 'The actual string value to insert (e.g., "name", "-createdDate", "is:active")'
    },
    {
      class: 'String',
      name: 'label',
      documentation: 'Display label for the option'
    }
  ],
  methods: [
    function toSummary() {
      return this.label;
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PropertySuggestedField',
  extends: 'foam.u2.view.SuggestedTextField',

  documentation: 'Base class for property-based suggested text fields',

  css: `
  ^suggestions {
    gap: 0px; // 8px gap from Parent class gets add to padding giving unbalanced spacing on top+bottom. This fixes that.
  }
  `,

  constants: [
    {
      name: 'SORT_ASC_SYMBOL',
      value: '↑'
    },
    {
      name: 'SORT_DESC_SYMBOL',
      value: '↓'
    }
  ],

  requires: [
    'foam.core.reflow.PropertyOption',
    'foam.core.reflow.PropertyOptionCitationView',
    'foam.dao.ArrayDAO',
    'foam.u2.Autocompleter'
  ],
  
  implements: [
    'foam.mlang.Expressions'
  ],

  imports: [
    'objData'
  ],

  properties: [
    {
      name: 'placeholder',
      value: 'Type property name'
    },
    {
      name: 'onSelect',
      documentation: 'Handler for when a property option is selected from the dropdown',
      value: function(obj) {
        // Parse existing selections
        var segments = this.parseSegments(this.data);
        segments.pop();
        segments.push(obj.id);

        // Update data
        this.data = this.joinSegments(segments);

        // Clear suggestions after selection
        this.filteredValues = [];
        return Promise.resolve();
      }
    },
    {
      name: 'autocompleter',
      documentation: 'Autocompleter that filters property options based on user input',
      factory: function() {
        var self = this;
        return this.Autocompleter.create({
          dao: this.createOptionsDAO(),
          queryFactory: function(str) {
            if ( ! str ) return self.TRUE;
            
            var lastSegment = self.getLastSegment(str);
            
            // If empty (just typed separator), show all options
            if ( ! lastSegment ) {
              return self.TRUE;
            }
            
            // Search in label, id and value fields for the last segment 
            // Search with "id", lets end-user search(type) for "Amount", now Label shows at top, 
            // without this top item was "Bill Amount (billAmtValue)" above "Amount(txnAmtValue)"
            // for end-user, "Amount" label should be at top, if he searches(types) "Amount"
            return self.OR(
              self.CONTAINS_IC(foam.core.reflow.PropertyOption.LABEL, lastSegment),
              self.CONTAINS_IC(foam.core.reflow.PropertyOption.ID, lastSegment),
              self.CONTAINS_IC(foam.core.reflow.PropertyOption.VALUE, lastSegment)
            );
          }
        });
      }
    },
    {
      name: 'suggestOnFocus',
      value: true
    },
    {
      name: 'delimitter',
      value: ','
    },
    {
      name: 'rowView',
      value: { class: 'foam.core.reflow.PropertyOptionCitationView' }
    }
  ],

  methods: [
    function init() {
      this.SUPER();

      // Watch for delimitter typing to show suggestions
      var self = this;
      this.onDetach(this.data$.sub(function(_, __, oldValue, newValue) {
        if ( self.shouldTriggerSuggestions(oldValue, newValue.get()) ) {
          if ( self.autocompleter ) {
            self.autocompleter.onUpdate();
          }
        }
      }));
    },

    function parseSegments(str) {
      return str?.split(this.delimitter) ?? [];
    },

    function joinSegments(segments) {
      return segments.join(this.delimitter);
    },

    function getLastSegment(str) {
      var segments = this.parseSegments(str);
      return segments[segments.length - 1].trim();
    },

    function shouldTriggerSuggestions(oldStr, newStr) {
      return newStr && newStr?.endsWith(this.delimitter) && ! oldStr?.endsWith(this.delimitter);
    },

    function isPropertySelectable(property, context) {
      if ( property.hidden || property.networkTransient ) return false;
      return true;
    },

    /**
     * Create options for a property. Override in subclasses.
     */
    function createPropertyOptions(property) {
      return [
        this.PropertyOption.create({
          id: property.name,
          label: property.label
        })
      ];
    },

    function createOptionsDAO() {
      var of = this.objData.dao.of;
      var options = [];

      // Process properties
      of.getAxiomsByClass(foam.lang.Property).forEach(p => {
        if ( ! p || ! this.isPropertySelectable(p) ) return;

        var propertyOptions = this.createPropertyOptions(p);
        propertyOptions.forEach(opt => options.push(opt));
      });

      options.sort(function(a, b) {
        return a.label.localeCompare(b.label);
      });

      // Create and return DAO
      return this.ArrayDAO.create({
        of: this.PropertyOption,
        array: options
      });
    }
  ]
});