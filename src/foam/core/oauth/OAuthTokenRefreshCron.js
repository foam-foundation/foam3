/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.oauth',
  name: 'OAuthTokenRefreshCron',
  implements: ['foam.lang.ContextAgent'],

  javaImports: [
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.session.Session',
    'foam.core.oauth.OAuthCredential',
    'java.util.List'
  ],

  methods: [
    {
      name: 'execute',
      javaCode: `
        DAO oAuthCredentialDAO = (DAO) x.get("oAuthCredentialDAO");
        DAO sessionDAO = (DAO) x.get("localSessionDAO");

        List credentials = ((ArraySink) oAuthCredentialDAO.select(new ArraySink())).getArray();

        int count = 0;
        int refreshed = 0;
        int errors = 0;

        Logger logger = Loggers.logger(x, this);

        for ( Object obj : credentials ) {
          OAuthCredential cred = (OAuthCredential) obj;
          count++;

          Session session = (Session) sessionDAO.find(cred.getSessionId());
          if ( session != null && (session.getUserId() == cred.getUser() || session.getAgentId() == cred.getUser()) ) {
            String oldToken = cred.getAccessToken();

            try {
              cred = (OAuthCredential) cred.fclone();
              cred.checkAndRefresh(x);
              if ( cred.getAccessToken() != null && ! cred.getAccessToken().equals(oldToken) ) {
                oAuthCredentialDAO.put(cred);
                refreshed++;
              }
            } catch ( Exception e ) {
              errors++;
              logger.error("Error refreshing OAuth credential for user " + cred.getUser(), e);

              sessionDAO.remove(session);
              logger.info("Destroyed expired session: " + session.getId());
            }
          }
        }

        logger.info("Done: checked " + count, " refreshed " + refreshed, " errors " + errors);
      `
    }
  ],
});
