/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.referral',
  name: 'DisableOldReferralCodesRuleAction',

  documentation: `Mark old referral codes enabled = false when the new one created`,

  implements: ['foam.core.ruler.RuleAction'],

  javaImports: [
    'foam.lang.ContextAgent',
    'foam.lang.X',
    'foam.core.referral.ReferralCode',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'java.util.List',
    'static foam.mlang.MLang.*'
  ],

  methods: [
    {
      name: 'applyAction',
      javaCode: `
      agency.submit(x, new ContextAgent() {
        @Override
        public void execute(X x) {
          ReferralCode referralCode = (ReferralCode) obj;
          DAO referralCodeDAO = (DAO) x.get("referralCodeDAO");
          List<ReferralCode> referralCodes = ((ArraySink) referralCodeDAO.where(
            AND(
              EQ(ReferralCode.REFERRER, referralCode.getReferrer()),
              EQ(ReferralCode.ENABLED, true),
              NEQ(ReferralCode.ID, referralCode.getId())
            )
          ).select(new ArraySink())).getArray();

          for ( ReferralCode code: referralCodes ) {
            if ( code.isFrozen() ) code = (ReferralCode) code.fclone();
            code.setEnabled(false);
            referralCodeDAO.put(code);
          }
        }
      }, "Disable old referral code rule action");
      `
    }
  ]
});
