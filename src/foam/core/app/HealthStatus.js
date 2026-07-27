/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.core.app',
  name: 'HealthStatus',

  documentation: 'Represents typical health status. Intended for use by a Load Balancer.',

  values: [
    { name: 'DOWN',  label: 'down',  color: '$grey500' },
    { name: 'MAINT', label: 'maint', color: '$orange500' },
    { name: 'UP',     label: 'up',    color: '$success500' },
    { name: 'FAIL',   label: 'fail',  color: '$destructive500' },
    { name: 'DRAIN', label: 'drain', color: '$orange500' }
  ]
});
