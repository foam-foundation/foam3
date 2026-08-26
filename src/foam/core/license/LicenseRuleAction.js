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
    'foam.dao.DAO',
    'foam.dao.ArraySink',
    'foam.lang.X',
    'foam.lang.FObject',
    'foam.lang.ContextAgent',
    'foam.mlang.sink.Count',
    'static foam.mlang.MLang.*',
    'foam.core.dao.Operation',
    'foam.core.logger.Logger',
    'foam.core.auth.User',
    'foam.core.auth.Subject',
    'foam.core.auth.LifecycleState',
    'foam.core.auth.LifecycleAware',
    'foam.core.auth.ServiceProviderAware',
    'foam.core.auth.ServiceProvider',
    'foam.core.auth.AuthorizationException',
    'foam.core.license.LicenseAlert',
    'foam.core.license.License',
    'foam.core.license.LicenseStatus',
    'foam.core.notification.Notification'
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

        ServiceProviderAware sp = (ServiceProviderAware) obj; // Assume the object is spid-aware (for now)

        // Check if the targetDAO has a configuration stored in the licenseDAO
        License license = (License) licenseDAO.find(new LicenseId(rule.getDaoKey(), sp.getSpid()));

        if ( license == null ) {
          logger.warning("LicenseRuleAction could not find License for " + rule.getDaoKey());
          return; // No license == don't need to do anything else

        } else {
          // Save the old state of the license
          LicenseStatus oldStatus = license.getStatus();

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

          // Because this RuleAction executes *before* the DAO operation completes,
          // we need to manually update the license count based on what operation
          // was/will be performed.
          Operation op = rule.getOperation();
          boolean isRemove = false;
          if ( op == Operation.CREATE || (op == Operation.CREATE_OR_UPDATE && oldObj == null) ) { // On CREATEs
            currentCount += 1; // We need to factor in the newly created object

          } else if ( op == Operation.UPDATE || (op == Operation.CREATE_OR_UPDATE && oldObj != null) ) { // On UPDATEs
            // If the DAO is LifecycleAware, check that the object was not "deactivated" (DISABLED, DELETED, PENDING, etc.)
            // If the DAO is EnabledAware, check that the object was not disabled
            if ( (obj.getProperty("lifecycleState") != null && (LifecycleState) obj.getProperty("lifecycleState") != LifecycleState.ACTIVE)
                || (obj.getProperty("enabled") != null && (boolean) obj.getProperty("enabled") == false) ) {
              // If it was, we shouldn't count the object we're deactivating
              currentCount -= 1;
              isRemove = true;
            } else if ( 
                ( obj.getProperty("lifecycleState") != null 
                  && (LifecycleState) obj.getProperty("lifecycleState") == LifecycleState.ACTIVE
                  && (LifecycleState) oldObj.getProperty("lifecycleState") != LifecycleState.ACTIVE
                ) || ( obj.getProperty("enabled") != null 
                  && (boolean) obj.getProperty("enabled") == true 
                  && (boolean) oldObj.getProperty("enabled") != true
                )
              )
            {
              // If the DAO is LifecycleAware, count objects that were "reactivated"
              // if the DAO is EnabledAware, count objects that were re-enabled
              currentCount += 1;
            }
          } else if ( op == Operation.REMOVE ) { // On REMOVEs
            currentCount -= 1;
            isRemove = true;
          }

          // Check if the count has exceeded what the License allows
          if ( currentCount > license.getQuota() ) {
            // Block the operation OR send a warning message
            if ( license.getBlocking() && !isRemove ) {
              // Note: removes are never blocked because it is possible to get stuck in the EXCEEDED state
              // if you change a EXCEEDED non-blocking License to a blocking one OR change the quota
              // on a COMPLIANT blocking License to be less than the current count.
              var e = new AuthorizationException("This operation is blocked by the " + license.getName() + " license.");
              e.setIsClientException(true);
              throw e; // Don't update the License when we block the operation

            } else {
              // Update the License...
              licenseClone.setStatus(LicenseStatus.EXCEEDED);
              licenseClone.setCount(currentCount);
            }
          } else {
            // Update the License when we're Compliant, too
            licenseClone.setStatus(LicenseStatus.COMPLIANT);
            licenseClone.setCount(currentCount);
          }

          agency.submit(x, new ContextAgent() {
            public void execute(X x) {
              DAO innerLicenseDAO = (DAO) x.get("licenseDAO");
              if ( innerLicenseDAO == null ) {
                logger.error("LicenseRuleAction could not find (inner) licenseDAO");
                return;
              }
              // Put the clone to the DAO...
              innerLicenseDAO.put(licenseClone);
            }
          }, "LicenseRuleAction");
          
          // ...and notify whoever needs to know (actor for now) if the status changed
          if ( oldStatus != licenseClone.getStatus() && oldStatus != LicenseStatus.INITIATED ) {
            String actorName = actor != null ? actor.getLegalName() : "system";

            // Find the client using the spid
            String clientName = "Unknown";
            DAO capabilityDAO = (DAO) x.get("capabilityDAO");
            if ( capabilityDAO == null ) {
              logger.warning("LicenseRuleAction could not find capabilityDAO");
            } else {
              clientName = ((ServiceProvider) capabilityDAO.find(license.getSpid())).getName();
            }

            // Build the notification...
            LicenseAlert notif = new LicenseAlert();
            notif.setUserId(actor != null ? actor.getId() : 1L);
            notif.setClientName(clientName);
            notif.setLicenseName(licenseClone.getName());
            notif.setSpid(licenseClone.getSpid());
            notif.setDaoKey(licenseClone.getDaoKey());
            notif.setBody(licenseClone.getName() + " restricts the number of active objects on the " + licenseClone.getDaoKey() + " to " + licenseClone.getQuota() + ". Current count is: " + licenseClone.getCount() + ".");
            notif.setToastMessage(licenseClone.getStatus() == LicenseStatus.EXCEEDED ? actorName + " exceeded " + licenseClone.getName() : actorName + " restored compliance with " + licenseClone.getName());

            agency.submit(x, new ContextAgent() {
              public void execute(X x) {
                // ...and send it
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
      `
    }
  ]
});