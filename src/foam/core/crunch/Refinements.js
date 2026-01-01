/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.crunch',
  name: 'CapabilityRefinement',
  refines: 'foam.core.crunch.Capability',

  implements: [
    'foam.mlang.Expressions',
    'foam.core.auth.LastModifiedAware',
    'foam.core.auth.LastModifiedByAware',
    'foam.core.crunch.Renewable'
  ]
});
