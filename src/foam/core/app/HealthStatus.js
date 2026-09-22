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
    { name: 'DOWN',  label: 'down',  color: '$statusNeutralText', background: '$statusNeutralBackground' },
    { name: 'MAINT', label: 'maint', color: '$statusWarnText', background: '$statusWarnBackground' },
    { name: 'UP',     label: 'up',    color: '$statusSuccessText', background: '$statusSuccessBackground' },
    { name: 'FAIL',   label: 'fail',  color: '$statusDangerText', background: '$statusDangerBackground' },
    { name: 'DRAIN', label: 'drain', color: '$statusWarnText', background: '$statusWarnBackground' }
  ]
});
