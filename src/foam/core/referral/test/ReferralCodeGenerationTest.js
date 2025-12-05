/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.referral.test',
  name: 'ReferralCodeGenerationTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'foam.dao.ArraySink',
    'foam.core.referral.UserReferralCodeService',
    'foam.dao.DAO',
    'foam.core.auth.Group',
    'foam.core.auth.Permission',
    'foam.core.auth.User',
    'foam.core.referral.ReferralCode',
    'java.util.List'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        User testUser1 = null;
        User testUser2 = null;
        DAO userDAO = (DAO) x.get("localUserDAO");
        DAO referralCodeDAO = (DAO) x.get("referralCodeDAO");
        UserReferralCodeService referralCodeService = (UserReferralCodeService) x.get("generateUserReferralCode");

        Permission permission = new Permission.Builder(x).setId("rule.read.create-referralCode").build();
        Group group = (Group) ((DAO) x.get("localGroupDAO")).find("anonymous");
        group.getPermissions(x).add(permission);
        permission = new Permission.Builder(x).setId("referralCode.create").build();
        group.getPermissions(x).add(permission);

        testUser1 = new User.Builder(x)
          .setFirstName("referralGenerationTest1")
          .setUserName("referralGenerationTest1")
          .setEmail("referralTest1@foamdev.com")
          .setGroup("anonymous")
          .build();
        testUser1 = (User) userDAO.put(testUser1);

        ReferralCode refCode = (ReferralCode) ((ArraySink) testUser1.getReferralCodes(x).select(new ArraySink())).getArray().get(0);
        String code = referralCodeService.getReferralCode(testUser1);
        test(code.equals("REFE0000"), "Referral code created for first user");
        if ( refCode.isFrozen() ) refCode = (ReferralCode) refCode.fclone();
        refCode.setCustomReferralCode(code);
        referralCodeDAO.put(refCode);

        code = referralCodeService.getReferralCode(testUser1);
        test(code.equals("REFE0001"), "Referral code created for second user");

        testUser2 = new User.Builder(x)
          .setEmail("referralTest2@foamdev.com")
          .setUserName("referralGenerationTest2")
          .setFirstName("re")
          .setReferralCode(refCode.getId())
          .setGroup("anonymous")
          .build();
        testUser2 = (User) userDAO.put(testUser2);
        code = referralCodeService.getReferralCode(testUser2);
        test(code.equals("REXX0000"), "Referral code created for the name with less then 4 characters");
      `
    }
  ]
});
