/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.license',
  name: 'LicenseRefreshRuleAction',
  implements: [ 'foam.core.ruler.RuleAction' ],
  documentation: `
    RuleAction that monitors for licenseDAO for puts/updates and recomputes
    the count and status of newly created/updated Licenses.
  `,

  javaImports: [
    'java.util.Map',
    'foam.util.SafetyUtil',
    'foam.dao.DAO',
    'foam.lang.X',
    'foam.lang.FObject',
    'foam.lang.ContextAgent',
    'foam.mlang.sink.Count',
    'static foam.mlang.MLang.*',
    'foam.core.logger.Logger',
    'foam.core.auth.User',
    'foam.core.auth.Subject',
    'foam.core.auth.LifecycleAware',
    'foam.core.auth.LifecycleState',
    'foam.core.auth.ServiceProviderAware',
    'foam.core.auth.ServiceProvider',
    'foam.core.license.License',
    'foam.core.license.LicenseAlert'
  ],

  methods: [
    {
      name: 'applyAction',
      javaCode: `
        Logger logger = (Logger) x.get("logger");

        // Cast the obj to a License
        License newLicense = (License) obj;
        if ( newLicense == null ) return;

        // Cast the oldObj to a License
        License oldLicense = (License) oldObj;

        // Find the user who performed the operation that triggered this RuleAction
        User actor = ((Subject) x.get("subject")).getRealUser();
        if ( actor == null ) logger.log("LicenseRefreshRuleAction could not find actor. Defaulting to system.");

        try {
          int numChangedProps = 0;
          String changedPropsText = "";
          if ( oldLicense != null ) { // Rule triggered on UPDATE
            Map changedProps = newLicense.diff(oldLicense);
            if ( changedProps.isEmpty() ) return; // Ignore updates that didn't change anything
          
            // Keep track of what changed
            numChangedProps = changedProps.size();
            StringBuilder sb = new StringBuilder();
            for ( Object prop : changedProps.keySet() ) {
              String propName = (String) prop;

              if ( SafetyUtil.equals(prop, "count") || SafetyUtil.equals(prop, "status") ) {
                numChangedProps -= 1;
                continue;
              }
              
              if ( sb.length() > 0 ) sb.append(", ");
              sb.append(prop);
            }
            changedPropsText = sb.toString();

            // If we've skipped all the fields that were changed,
            // this update did "nothing" so we ignore it.
            if ( SafetyUtil.isEmpty(changedPropsText) ) return;
          }

          // Get the status/count BEFORE we update it
          LicenseStatus ogStatus = newLicense.getStatus();
          long ogCount           = newLicense.getCount();

          // Look for the DAO the License applies to
          DAO targetDAO = (DAO) x.get(newLicense.getDaoKey());
          if ( targetDAO == null ) {
            logger.warning("LicenseRefreshRuleAction could not find DAO: " + newLicense.getDaoKey());
            return; // No daoKey means we can't compute the count or determine the status
          
          } else {
            // Count the objects on the targetDAO and use that to update the status
            long currentCount;
            if ( targetDAO.getOf().isAssignableTo(LifecycleAware.class) ) { // If the DAO is LifecycleAware
              // Only take the ACTIVE objects that belong to the License's SPID
              Count countSink = (Count) targetDAO.where(AND(
                EQ(targetDAO.getOf().getAxiomByName("lifecycleState"), LifecycleState.ACTIVE),
                EQ(targetDAO.getOf().getAxiomByName("spid"), newLicense.getSpid())
              )).select(COUNT());
              currentCount = countSink.getValue();

            } else {
              // Otherwise, take any object with a matching SPID
              Count countSink = (Count) targetDAO.where(EQ(targetDAO.getOf().getAxiomByName("spid"), newLicense.getSpid())).select(COUNT());
              currentCount = countSink.getValue();
            } 

            // Update the License
            newLicense.setStatus(currentCount > newLicense.getQuota() ? LicenseStatus.EXCEEDED : LicenseStatus.COMPLIANT);
            newLicense.setCount(currentCount);

            // If this RuleAction updated the status or count...
            if ( currentCount != ogCount || newLicense.getStatus() != ogStatus ) {
              String actorName = actor != null ? actor.getLegalName() : "system";

              // Find the client this License applies to
              String clientName = "Unknown";
              DAO capabilityDAO = (DAO) x.get("capabilityDAO");
              if ( capabilityDAO == null ) {
                logger.warning("LicenseRefreshRuleAction could not find capabilityDAO");
              } else {
                clientName = ((ServiceProvider) capabilityDAO.find(newLicense.getSpid())).getName();
              }

              // Separate messages for CREATE and UPDATE
              StringBuilder bodyBuilder = new StringBuilder();
              StringBuilder toaster = new StringBuilder();

              if ( oldLicense == null ) { // On CREATE
                toaster.append(actorName)
                  .append(" created new license on ")
                  .append(newLicense.getDaoKey())
                  .append(".");

                bodyBuilder.append(actorName)
                  .append(" created new license '")
                  .append(newLicense.getName())
                  .append("' that restricts the number of active objects on the ")
                  .append(newLicense.getDaoKey())
                  .append(" to ")
                  .append(newLicense.getQuota())
                  .append(". Count is currently ")
                  .append(newLicense.getCount())
                  .append(".").append(System.lineSeparator()).append(System.lineSeparator())
                  .append("License is ")
                  .append(newLicense.getStatus() == LicenseStatus.EXCEEDED ? "exceeded." : "compliant.");

              } else { // On UPDATE
                toaster.append(actorName)
                  .append(" updated ")
                  .append(newLicense.getName())
                  .append(".");

                bodyBuilder.append(actorName)
                  .append(" changed ")
                  .append(numChangedProps)
                  .append(" field(s) on ")
                  .append(newLicense.getName())
                  .append(": ").append(changedPropsText)
                  .append(System.lineSeparator())
                  .append("Count is currently ")
                  .append(newLicense.getCount())
                  .append(".").append(System.lineSeparator()).append(System.lineSeparator())
                  .append(newLicense.getName())
                  .append(" is ")
                  .append(newLicense.getStatus() == LicenseStatus.EXCEEDED ? "exceeded." : "compliant.");
              }

              // Build the notification...
              LicenseAlert notif = new LicenseAlert();
              notif.setUserId(actor != null ? actor.getId() : 1L);
              notif.setClientName(clientName);
              notif.setLicenseName(newLicense.getName());
              notif.setSpid(newLicense.getSpid());
              notif.setDaoKey(newLicense.getDaoKey());
              notif.setBody(bodyBuilder.toString());
              notif.setToastMessage(toaster.toString());
              
              // ...and send it
              agency.submit(x, new ContextAgent() {
                public void execute(X x) {
                  DAO notificationDAO = (DAO) x.get("notificationDAO");
                  if ( notificationDAO == null ) {
                    logger.error("LicenseRefreshRuleAction could not find notificationDAO");
                    return;
                  }  
                  notificationDAO.put(notif);
                }
              }, "LicenseRefreshRuleAction");
            }
          }
        } catch ( Exception e ) {
          logger.error("LicenseRefreshRuleAction Error: " + e.getMessage());
        }
      `
    }
  ]
});