/**
 * @license
 * Copyright 2016 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang',
  name: 'DatePropertyValidationRefinement',
  refines: 'foam.lang.Date',

  properties: [
    {
      class: 'ValidationPredicateArray',
      name: 'internalValidationPredicates',
      factory: function() {
        return [
          {
            args: [ this.name ],
            query: 'thisValue !exists||thisValue<=maxDate&&thisValue>=minDate',
            errorString: 'Invalid date value'
          }
        ];
      }
    }
  ]
});
