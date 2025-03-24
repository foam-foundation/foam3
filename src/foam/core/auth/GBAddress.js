/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth',
  name: 'GBAddress',
  extends: 'foam.core.auth.Address',

  javaImports: [
    'foam.util.SafetyUtil'
  ],

  properties: [
    {
      name: 'regionId',
      visibility: 'HIDDEN',
      required: false
    }
  ]
});
