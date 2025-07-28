/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ComparatorSuggestedField',
  extends: 'foam.core.reflow.PropertySuggestedField',

  documentation: 'SuggestedTextField for property sort selection',

  properties: [
    {
      name: 'placeholder',
      value: 'Type property name to add sort criteria'
    }
  ],

  methods: [
    /**
     * Parse comma-separated segments
     */
    function parseSegments(str) {
      return str ? str.split(',') : [];
    },

    /**
     * Join segments with commas
     */
    function joinSegments(segments) {
      return segments.join(',');
    },

    /**
     * Check if comma was just typed
     */
    function shouldTriggerSuggestions(oldStr, newStr) {
      return newStr && newStr.endsWith(',') && ! oldStr.endsWith(',');
    },

    /**
     * Create sort options for a property (ascending and descending)
     */
    function createPropertyOptions(property) {
      var label = property.label || property.name;
      
      return [
        // Ascending option
        this.PropertyOption.create({
          value: property.name,
          label: this.SORT_ASC_SYMBOL + ' ' + label,
          direction: 'ASC',
          property: property
        }),
        // Descending option
        this.PropertyOption.create({
          value: '-' + property.name,
          label: this.SORT_DESC_SYMBOL + ' ' + label,
          direction: 'DESC',
          property: property
        })
      ];
    }
  ]
});