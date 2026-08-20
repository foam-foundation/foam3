/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.core.partition',
  name: 'DatePartitioningScheme',

  values: [
    {
      name: 'YYYYMM'
    },
    {
      name: 'YYYYWW',
    },
    {
      name: 'YYYYDDD'
    },
    {
      name: 'YYYYMMDD'
    }
  ]
});
