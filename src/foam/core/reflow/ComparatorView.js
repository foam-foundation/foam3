/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ComparatorView',
  extends: 'foam.core.reflow.ComparatorSuggestedField',

  documentation: 'View for building sort order expressions using property selection',

  imports: [
    'objData'
  ],

  properties: [
    {
      name: 'data',
      postSet: function(_, n) {
        // Update objData.order when data changes
        this.objData.order = n;
      }
    }
  ],

  methods: [
    function init() {
      this.SUPER();
      // Initialize data from objData.order
      this.data = this.objData.order || '';
    }
  ]
});
