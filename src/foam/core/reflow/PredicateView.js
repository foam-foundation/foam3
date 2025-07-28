/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PredicateView',
  extends: 'foam.core.reflow.PredicateSuggestedField',

  documentation: 'View for building filter expressions using property selection',

  imports: [
    'eval_',
    'objData'
  ],

  properties: [
    {
      name: 'data',
      postSet: function(_, n) {
        // Update objData.where when data changes
        this.objData.where = n;
      }
    }
  ],

  methods: [
    function init() {
      this.SUPER();
      // Initialize data from objData.where
      this.data = this.objData.where || '';
    }
  ],

  listeners: [
    function mqlHelp() {
      this.eval_('helpMQL', true);
    }
  ]
});
