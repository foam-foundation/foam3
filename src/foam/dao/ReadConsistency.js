/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.dao',
  name: 'ReadConsistency',

  values: [
    {
      name: 'STRONG',
      label: 'Strong Consistency'
    },
    {
      name: 'EVENTUAL',
      label: 'Eventual Consistency'
    }
  ]
});
