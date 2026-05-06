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


  constants: [
    {
      name: 'PREDICATE_IS_PREFIX',
      value: 'is:'
    },
    {
      name: 'PREDICATE_IS_NOT_PREFIX',
      value: '-is:'
    }
  ],

  properties: [
    {
      name: 'placeholder',
      value: 'Type property name to add filter'
    },
    {
      name: 'delimitter',
      value: ' '
    }
  ],

  methods: [
    /**
     * Override property filtering for predicates
     */
    function isPropertySelectable(property) {
      if ( ! property.searchable ) return false;
      return this.SUPER(property)
    },

    /**
     * Create predicate options for a property
     */
    function createPropertyOptions(property) {
      var label = property.label;
      var options = [];

      if ( foam.lang.Boolean.isInstance(property) ) {
        // Boolean properties work as standalone predicates with is: prefix
        options.push(this.PropertyOption.create({
          id: this.PREDICATE_IS_PREFIX + property.name,
          label: 'is: ' + label
        }));

        options.push(this.PropertyOption.create({
          id: this.PREDICATE_IS_NOT_PREFIX + property.name,
          label: 'isNot: ' + label
        }));
      } else {
        // For other searchable properties, add them with an equals suffix
        // so users can type the value after selection
        options.push(this.PropertyOption.create({
          id: property.name + '=',
          label: label
        }));
      }

      return options;
    }
  ]
});
