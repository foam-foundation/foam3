/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification.email',
  name: 'EmailConfigEmailPropertyService',

  documentation: 'Fills unset properties on an email with values from the system emailConfig service.',

  implements: [
    'foam.core.notification.email.EmailPropertyService'
  ],

  javaImports: [
    'foam.dao.DAO',
    'foam.core.auth.User',
    'foam.core.auth.Subject',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.notification.email.EmailConfig'
  ],

  methods: [
    {
      name: 'apply',
      type: 'foam.core.notification.email.EmailMessage',
      javaCode: `
        Logger logger = Loggers.logger(x, this);
        EmailConfig emailConfig = (EmailConfig) ((DAO) x.get("emailConfigDAO")).find(emailMessage.getSpid());

        // Service property check
        if ( emailConfig == null ) {
          // Support hiearchical spids.
          String spid = emailMessage.getSpid();
          while ( emailConfig == null &&
                  spid.indexOf(".") > 0 ) {
            spid = spid.substring(0, spid.lastIndexOf("."));
            emailConfig = (EmailConfig) ((DAO) x.get("emailConfigDAO")).find(spid);
          }
          if ( emailConfig == null ) {
            logger.error("EmailConfig not found", "spid", emailMessage.getSpid());
            return emailMessage;
          } else {
            logger.debug("EmailConfig found in spid hierarchy", emailMessage.getSpid(), spid);
          }
        }

        // REPLY TO:
        if ( ! emailMessage.isPropertySet("replyTo") ) {
          emailMessage.setReplyTo(emailConfig.getReplyTo());
        }

        // DISPLAY NAME:
        if ( ! emailMessage.isPropertySet("displayName") ) {
          emailMessage.setDisplayName(emailConfig.getDisplayName());
        }

        // FROM:
        if ( ! emailMessage.isPropertySet("from") ) {
          emailMessage.setFrom(emailConfig.getFrom());
        }

        // TO:
        if ( ! emailMessage.isPropertySet("to") ) {
          User user = ((Subject) x.get("subject")).getRealUser();
          emailMessage.setTo(new String[] { user.getEmail() });
        }

        // SPID:
        if ( ! emailMessage.isPropertySet("spid") ) {
          User user = ((Subject) x.get("subject")).getRealUser();
          emailMessage.setSpid(user.getSpid());
        }

        return emailMessage;
      `
    }
  ]
});
