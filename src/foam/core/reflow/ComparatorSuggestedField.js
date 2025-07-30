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
    function createPropertyOptions(property) {
      var label = property.label;
      
      return [
        // Ascending option
        this.PropertyOption.create({
          id: property.name,
          label: this.SORT_ASC_SYMBOL + ' ' + label
        }),
        // Descending option
        this.PropertyOption.create({
          id: '-' + property.name,
          label: this.SORT_DESC_SYMBOL + ' ' + label
        })
      ];
    }
  ]
});