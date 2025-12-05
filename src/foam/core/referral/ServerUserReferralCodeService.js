/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
foam.CLASS({
  package: 'foam.core.referral',
  name: 'ServerUserReferralCodeService',

  implements: [
    'foam.core.referral.UserReferralCodeService'
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
      name: 'getReferralCode',
      type: 'String',
      javaCode: `
        X x = XLocator.get();
        DAO referralCodeDAO = (DAO) x.get("referralCodeDAO");
        String name = user.getFirstName();
        String referralCode = (name.toUpperCase() +
          "XXXX").substring(0, 4);
        var count = (Count) referralCodeDAO.where(
          IN(referralCode, ReferralCode.CUSTOM_REFERRAL_CODE)
        ).select(new Count());

        referralCode += String.format("%04d", count.getValue());
        return referralCode;
      `
    }
  ]
})
