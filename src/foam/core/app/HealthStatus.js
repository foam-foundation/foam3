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
    { name: 'DOWN',  label: 'down',  color: '$statusNeutralText' },
    { name: 'MAINT', label: 'maint', color: '$statusWarnText' },
    { name: 'UP',     label: 'up',    color: '$statusSuccessText' },
    { name: 'FAIL',   label: 'fail',  color: '$statusDangerText' },
    { name: 'DRAIN', label: 'drain', color: '$statusWarnText' }
  ]
});
