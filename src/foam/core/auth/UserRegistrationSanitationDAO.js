/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth',
  name: 'UserRegistrationSanitationDAO',
  extends: 'foam.dao.ProxyDAO',

  documentation: `
    Sanitize the user object being put so that only expected fields are allowed
    to be set to non-default values.
  `,

  javaImports: [
    'foam.lang.X',
    'foam.dao.DAO',
    'static foam.mlang.MLang.*',
    'foam.core.referral.ReferralCode',
    'foam.util.SafetyUtil',
    'java.util.Objects'
  ],

  javaCode: `
    public UserRegistrationSanitationDAO(X x, DAO delegate) {
      setX(x);
      setDelegate(delegate);
    }
  `,

  methods: [
    {
      name: 'put_',
      javaCode: `
        User user = (User) Objects.requireNonNull(obj, "User cannot be null.");
        return super.put_(x, sanitize(x, user));
      `
    },
    {
      name: 'sanitize',
      type: 'User',
      args: 'X x, User user',
      documentation: `Return a sanitized copy of the given user.`,
      javaCode: `
        User nu = new User();
        nu.setUserName(user.getUserName());
        nu.setEmail(user.getEmail());
        nu.setDesiredPassword(user.getDesiredPassword());
        nu.setLanguage(user.getLanguage());
        nu.setGroup(user.getGroup());

        // FIXME: this should be a rule
        if ( ! SafetyUtil.isEmpty(user.getReferralCode()) ) {
          DAO referralCodeDAO = (DAO) x.get("referralCodeDAO");
          ReferralCode referralCode = (ReferralCode) referralCodeDAO.find(OR(
            EQ(ReferralCode.ID, user.getReferralCode()),
            EQ(ReferralCode.CODE, user.getReferralCode())
          ));
          if ( referralCode != null ) {
            nu.setReferralCode(referralCode.getId());
          }
        }
        return nu;
      `
    }
  ],
});
