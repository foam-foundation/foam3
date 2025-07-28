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
      factory: function() { return this.value; }
    },
    {
      class: 'String',
      name: 'value',
      documentation: 'The actual string value to insert (e.g., "name", "-createdDate", "is:active")'
    },
    {
      class: 'String',
      name: 'label',
      documentation: 'Display label for the option'
    },
    {
      class: 'String',
      name: 'direction',
      documentation: 'Sort direction: ASC or DESC (for comparator options)',
      value: ''
    },
    {
      name: 'property',
      documentation: 'Optional reference to the property object'
    },
    {
      class: 'Boolean',
      name: 'isSeparator',
      documentation: 'Whether this option is a separator',
      value: false
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PropertySuggestedField',
  extends: 'foam.u2.view.SuggestedTextField',

  documentation: 'Base class for property-based suggested text fields',

  constants: [
    {
      name: 'SEPARATOR_VALUE',
      value: '--'
    },
    {
      name: 'SEPARATOR_LABEL',
      value: 'Choose Property'
    },
    {
      name: 'SORT_ASC_SYMBOL',
      value: '↑'
    },
    {
      name: 'SORT_DESC_SYMBOL',
      value: '↓'
    },
    {
      name: 'PREDICATE_IS_PREFIX',
      value: 'is:'
    },
    {
      name: 'PREDICATE_IS_NOT_PREFIX',
      value: '-is:'
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
        // Skip separator option
        if ( obj.value === this.SEPARATOR_VALUE ) return Promise.resolve();
        
        // Parse existing selections
        var segments = this.parseSegments(this.data);
        
        // Remove the last segment (partial search term)
        segments.pop();
        
        // Add the new selection
        segments.push(obj.value);
        
        // Update data
        this.data = this.joinSegments(segments);
        
        // Clear suggestions after selection
        this.filteredValues = [];
        
        // Return a resolved promise as expected by SuggestedTextField
        return Promise.resolve();
      }
    },
    {
      name: 'rowView',
      value: { class: 'foam.core.reflow.PropertyOptionCitationView' }
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
            
            // Search in both label and value fields for the last segment
            return self.OR(
              self.CONTAINS_IC(foam.core.reflow.PropertyOption.LABEL, lastSegment),
              self.CONTAINS_IC(foam.core.reflow.PropertyOption.VALUE, lastSegment)
            );
          }
        });
      }
    },
    {
      name: 'suggestOnFocus',
      value: true
    }
  ],

  methods: [
    function init() {
      this.SUPER();
      
      // Watch for separator typing to show suggestions
      var self = this;
      this.onDetach(this.data$.sub(function(_, __, oldValue, newValue) {
        // Ensure values are strings
        var oldStr = self.toSafeString(oldValue);
        var newStr = self.toSafeString(newValue);
        
        if ( self.shouldTriggerSuggestions(oldStr, newStr) ) {
          // Just typed a separator, trigger autocompleter update
          if ( self.autocompleter ) {
            self.autocompleter.onUpdate();
          }
        }
      }));
    },

    /**
     * Convert value to string safely
     */
    function toSafeString(value) {
      return value ? String(value) : '';
    },

    /**
     * Parse input string into segments. Override in subclasses.
     */
    function parseSegments(str) {
      // Default implementation - override in subclasses
      return str ? str.split(',') : [];
    },

    /**
     * Join segments back into a string. Override in subclasses.
     */
    function joinSegments(segments) {
      // Default implementation - override in subclasses
      return segments.join(',');
    },

    /**
     * Get the last segment from the input string
     */
    function getLastSegment(str) {
      var segments = this.parseSegments(str);
      return segments[segments.length - 1].trim();
    },

    /**
     * Check if suggestions should be triggered based on input change
     */
    function shouldTriggerSuggestions(oldStr, newStr) {
      // Default implementation - override in subclasses
      return newStr && newStr.endsWith(',') && ! oldStr.endsWith(',');
    },

    /**
     * Check if a property should be included in options
     */
    function isPropertySelectable(property, context) {
      // Base filtering logic
      if ( property.hidden || property.networkTransient ) return false;
      
      // Additional context-specific filtering can be added in subclasses
      return true;
    },

    /**
     * Create options for a property. Override in subclasses.
     */
    function createPropertyOptions(property) {
      // Default implementation - override in subclasses
      return [];
    },
    
    function createOptionsDAO() {
      var of = this.objData.dao.of;
      var options = [];
      
      // Add separator option
      options.push(this.PropertyOption.create({
        value: this.SEPARATOR_VALUE,
        label: this.SEPARATOR_LABEL,
        isSeparator: true
      }));
      
      // Process properties
      of.getAxiomsByClass(foam.lang.Property).forEach(p => {
        if ( ! this.isPropertySelectable(p) ) return;
        
        var propertyOptions = this.createPropertyOptions(p);
        propertyOptions.forEach(opt => options.push(opt));
      });
      
      // Sort options by label, keeping separator at top
      var separator = options.shift(); // Remove first item (separator)
      options.sort(function(a, b) {
        return a.label.localeCompare(b.label);
      });
      options.unshift(separator); // Put separator back at the beginning
      
      // Create and return DAO
      return this.ArrayDAO.create({
        of: this.PropertyOption,
        array: options
      });
    }
  ]
});