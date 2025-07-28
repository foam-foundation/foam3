/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PredicateSuggestedField',
  extends: 'foam.core.reflow.PropertySuggestedField',

  documentation: 'SuggestedTextField for property filter selection',

  properties: [
    {
      name: 'placeholder',
      value: 'Type property name to add filter'
    }
  ],

  methods: [
    /**
     * Parse space-separated segments
     */
    function parseSegments(str) {
      return str ? str.split(/\s+/) : [];
    },

    /**
     * Join segments with spaces
     */
    function joinSegments(segments) {
      return segments.join(' ');
    },

    /**
     * Check if space was just typed
     */
    function shouldTriggerSuggestions(oldStr, newStr) {
      return newStr && newStr.endsWith(' ') && ! oldStr.endsWith(' ');
    },

    /**
     * Override property filtering for predicates
     */
    function isPropertySelectable(property) {
      if ( ! property.searchable && ( property.hidden || property.networkTransient ) ) return false;
      return true;
    },

    /**
     * Create predicate options for a property
     */
    function createPropertyOptions(property) {
      var label = property.label || property.name;
      var options = [];
      
      if ( foam.lang.Boolean.isInstance(property) ) {
        // Boolean properties work as standalone predicates with is: prefix
        options.push(this.PropertyOption.create({
          value: this.PREDICATE_IS_PREFIX + property.name,
          label: 'is: ' + label,
          property: property
        }));
        
        options.push(this.PropertyOption.create({
          value: this.PREDICATE_IS_NOT_PREFIX + property.name,
          label: 'isNot: ' + label,
          property: property
        }));
      } else if ( property.searchable !== false ) {
        // For other searchable properties, add them with a colon suffix
        // so users can type the value after selection
        options.push(this.PropertyOption.create({
          value: property.name + ':',
          label: label + ':',
          property: property
        }));
      }
      
      return options;
    }
  ]
});