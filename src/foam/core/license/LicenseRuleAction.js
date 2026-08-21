/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.license',
  name: 'LicenseRuleAction',
  implements: [ 'foam.core.ruler.RuleAction' ],
  documentation: `
    RuleAction that checks if the targetDAO has a License configuration in the licenseDAO
    and, if it does, monitors puts and removes from the targetDAO to keep track of whether
    or not the targetDAO is in compliance with its License.
    (Count of "active" objects < License.quota)
  `,

  javaImports: [
    'foam.core.auth.Subject',
    'foam.core.logger.Logger',
    'foam.lang.ContextAgent',
    'foam.dao.DAO',
    'foam.lang.X',
    'foam.core.auth.LifecycleState',
    'foam.core.auth.LifecycleAware',
    'foam.core.license.License',
    'foam.core.license.LicenseStatus',
    'foam.dao.ArraySink',
    'foam.mlang.sink.Count',
    'static foam.mlang.MLang.*',
    'foam.core.auth.ServiceProviderAware',
    'foam.core.auth.ServiceProvider',
    'foam.core.auth.User'
  ],

  methods: [
    {
      name: 'applyAction',
      javaCode: `
        Logger logger = (Logger) x.get("logger");

        // Get the targetDAO
        DAO targetDAO = (DAO) x.get(rule.getDaoKey());
        if ( targetDAO == null ) return; // Can't do anything without a targetDAO

        // Get the licenseDAO
        DAO licenseDAO = (DAO) x.get("licenseDAO");
        if (licenseDAO == null ) return; // Can't do anything without the licenseDAO

        // The user who performed the operation that triggered this RuleAction
        User actor = ((Subject) x.get("subject")).getRealUser();
        if ( actor == null ) logger.log("LicenseRuleAction could not find actor. Defaulting to system.");

        // Get the spid from somewhere!!

        try {
          // Check if the targetDAO has a configuration stored in the licenseDAO
          License license = (License) licenseDAO.find(new LicenseId(rule.getDaoKey(), )); // !-- Replace with a LicenseId class --!

          if ( license == null ) {
            logger.warning("LicenseRuleAction could not find License for " + rule.getDaoKey());
            return; // No license == don't need to do anything else

          } else {
            // Count the number of "things" on the targetDAO
            long currentCount;
            if ( targetDAO.getOf() instanceof LifecycleAware ) { // If the targetDAO is LifecycleAware, only take ACTIVE objects
              Count countSink = (Count) targetDAO.where(EQ(getOf().getAxiomByName("lifecycleState"), LifecycleState.ACTIVE)).select(COUNT());
              currentCount = countSink.getValue();

            } else {
              Count countSink = (Count) targetDAO.select(COUNT());
              currentCount = countSink.getValue();
            }

            // Check if the count has exceeded what the License allows
            if ( currentCount > license.getQuota() ) {
              license.setStatus(LicenseStatus.VIOLATED); // !-- Or handle this as a post-set of license.count? --!
              
              // Block the operation OR send a warning message
              if ( license.getBlocking() ) {
                // no-op (for now)
                // !-- Don't update the license if the operation is blocked --!

              } else {
                // Notify whoever needs to know (actor for now)
                // !-- (Don't forget if actor == null -> actor = system) --!

                license.setStatus(LicenseStatus.VIOLATED);
                license.setCount(currentCount);
              }

            } else {
              // Update the License when we're Compliant, too
              license.setStatus(LicenseStatus.COMPLIANT);
              license.setCount(currentCount);
            }
          }
        } catch( Exception e ) {
          logger.error("LicenseRuleAction Error: " + e.getMessage());
        }
      `
    }
  ]
});