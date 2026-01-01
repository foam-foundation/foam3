/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.core.referral',
  name: 'ReferralCodeGeneratorService',

  client: true,
  skeleton: true,

  documentation: `
    A service that generates a referral code on request
  `,

  javaImports: [
    'foam.core.auth.User',
    'foam.core.referral.ReferralCode'
  ],

  methods: [
    {
      name: 'getCode',
      type: 'String',
      args: 'Long userId'
    }
  ]
});
