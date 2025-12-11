/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.referral',
  name: 'BuildReferralCodeURLRuleAction',

  documentation: 'Construct the Referral code from website, menu, id, when manually created',

  implements: ['foam.core.ruler.RuleAction'],

  javaImports: [
    'foam.lang.ContextAgent',
    'foam.lang.X',
    'foam.dao.DAO',
    'foam.util.SafetyUtil'
  ],

  methods: [
    {
      name: 'applyAction',
      javaCode: `
      agency.submit(x, new ContextAgent() {
        @Override
        public void execute(X x) {
          ReferralCodeGeneratorService service = (ReferralCodeGeneratorService) x.get("referralCodeGenerationService");
          ReferralCode referralCode = (ReferralCode) obj;
          if ( SafetyUtil.isEmpty(referralCode.getId()) ) return;
          if ( SafetyUtil.isEmpty(referralCode.getCode()) ) {
            referralCode.setCode(service.getCode(referralCode.getReferrer()));
          }
          referralCode.setUrl(referralCode.getWebsite() + "/?" + referralCode.getQuery() + "=" + referralCode.getCode() + "#" + referralCode.getMenu());
        }
      }, "BuildReferralCodeUrl");
      `
    }
  ]
});
