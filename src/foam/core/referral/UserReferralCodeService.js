/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.core.referral',
  name: 'UserReferralCodeService',

  client: true,
  skeleton: true,

  documentation: `
    A service that generates referral codes by taking the first four letters of a user's
    name and appending a four-digit sequential number
  `,

  javaImports: [
    'foam.core.auth.User'
  ],

  methods: [
    {
      name: 'getReferralCode',
      type: 'String',
      async: true,
      args: [
        { name: 'user', type: 'foam.core.auth.User' },
      ]
    }
  ]
});
