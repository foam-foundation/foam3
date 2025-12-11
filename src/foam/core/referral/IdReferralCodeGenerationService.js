/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.referral',
  name: 'IdReferralCodeGenerationService',
  documentation: 'Default referral code generation service that uses referral code ID as the code',

  implements: [
    'foam.core.referral.ReferralCodeGeneratorService'
  ],

  javaImports: [
    'foam.lang.X',
    'foam.lang.XLocator',
    'foam.core.auth.User',
    'foam.dao.DAO',
    'foam.mlang.sink.Count',
    'static foam.mlang.MLang.*'
  ],

  methods: [
    {
      name: 'getCode',
      synchronized: true,
      javaCode: `
        X x = XLocator.get();
        DAO referralCodeDAO = (DAO) x.get("referralCodeDAO");
        ReferralCode code = (ReferralCode) referralCodeDAO.find(
          AND(
            EQ(ReferralCode.REFERRER, userId),
            EQ(ReferralCode.ENABLED, true)
          )
        );
        return code.getId();
      `
    }
  ]
});
