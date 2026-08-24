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
    'foam.core.auth.User',
    'foam.lang.FObject',
    'foam.core.notification.Notification',
    'foam.core.license.LicenseAlert'
  ],

  methods: [
    {
      name: 'applyAction',
      javaCode: `
        Logger logger = (Logger) x.get("logger");
        logger.log("BEHOLD! RULE WAS RUN!");

        // Get the targetDAO
        DAO targetDAO = (DAO) x.get(rule.getDaoKey());
        if ( targetDAO == null ) return; // Can't do anything without a targetDAO

        // Get the licenseDAO
        DAO licenseDAO = (DAO) x.get("licenseDAO");
        if (licenseDAO == null ) return; // Can't do anything without the licenseDAO

        // The user who performed the operation that triggered this RuleAction
        User actor = ((Subject) x.get("subject")).getRealUser();
        if ( actor == null ) logger.log("LicenseRuleAction could not find actor. Defaulting to system.");

        ServiceProviderAware sp = (ServiceProviderAware) obj; // Assume the object is spid-aware (for now)

        try {
          // Check if the targetDAO has a configuration stored in the licenseDAO
          License license = (License) licenseDAO.find(new LicenseId(rule.getDaoKey(), sp.getSpid()));

          if ( license == null ) {
            logger.warning("LicenseRuleAction could not find License for " + rule.getDaoKey());
            return; // No license == don't need to do anything else

          } else {
            // Save the old state of the license
            LicenseStatus oldStatus = license.getStatus();
            long oldCount = license.getCount();

            // Count the number of "things" on the targetDAO
            long currentCount;
            if ( targetDAO.getOf().isAssignableTo(LifecycleAware.class) ) { // If the targetDAO is LifecycleAware, only take ACTIVE objects
              Count countSink = (Count) targetDAO.where(AND(
                EQ(targetDAO.getOf().getAxiomByName("lifecycleState"), LifecycleState.ACTIVE),
                EQ(targetDAO.getOf().getAxiomByName("spid"), license.getSpid())
              )).select(COUNT());
              currentCount = countSink.getValue();

            } else { // Otherwise, take any object with a matching SPID
              Count countSink = (Count) targetDAO.where(EQ(targetDAO.getOf().getAxiomByName("spid"), license.getSpid())).select(COUNT());
              currentCount = countSink.getValue();
            }

            // Clone the license so we can update it
            License licenseClone = (License) license.fclone();

            // Check if the count has exceeded what the License allows
            if ( currentCount > license.getQuota() ) {
              licenseClone.setStatus(LicenseStatus.VIOLATED); // !-- Or handle this as a post-set of license.count? --!
              
              // Block the operation OR send a warning message
              if ( licenseClone.getBlocking() ) {
                // no-op (for now)
                // !-- Don't update the license if the operation is blocked --!
              } else {
                // Update the License...
                licenseClone.setStatus(LicenseStatus.VIOLATED);
                licenseClone.setCount(currentCount);
              }
            } else {
              // Update the License when we're Compliant, too
              licenseClone.setStatus(LicenseStatus.COMPLIANT);
              licenseClone.setCount(currentCount);
              logger.log("License was compliant!");
            }

            // Put the clone to the DAO...
            licenseDAO.put(licenseClone);
            
            // ...and notify whoever needs to know (actor for now) if the status changed
            if ( oldStatus != licenseClone.getStatus() ) {
              LicenseAlert notif = new LicenseAlert();
              notif.setUserId(actor != null ? actor.getId() : 1L);
              // notif.setClientName(???);
              notif.setSpid(license.getSpid());
              notif.setDaoKey(license.getDaoKey());
              notif.setBody(license.getName() + " restricts the number of active objects on the " + license.getDaoKey() + " to " + license.getQuota() + ". Current count is: " + license.getCount() + ".");
              notif.setToastMessage(licenseClone.getStatus() == LicenseStatus.VIOLATED ? actor.getLegalName() + " violated " + license.getName() : actor.getLegalName() + " restored compliance with " + license.getName());

              agency.submit(x, new ContextAgent() {
                public void execute(X x) {
                  DAO notificationDAO = (DAO) x.get("notificationDAO");
                  if ( notificationDAO == null ) {
                    logger.error("LicenseRuleAction could not find notificationDAO");
                    return;
                  }  
                  notificationDAO.put(notif);
                }
              }, "LicenseRuleAction");
            }
          }
        } catch( Exception e ) {
          logger.error("LicenseRuleAction Error: " + e.getMessage());
        }
      `
    }
  ]
});