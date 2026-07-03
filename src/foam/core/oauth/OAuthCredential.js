foam.CLASS({
  package: 'foam.core.oauth',
  name: 'OAuthCredential',
  ids: ["provider", "user"],

  javaImports: [
    'foam.util.SafetyUtil',
    'java.time.Instant'
  ],

  properties: [
    {
      class: 'Reference',
      of: 'foam.core.oauth.OAuthProvider',
      name: 'provider'
    },
    {
      class: 'Reference',
      of: 'foam.core.auth.User',
      name: 'user'
    },
    {
      class: 'String',
      name: 'accessToken'
    },
    {
      class: 'String',
      name: 'refreshToken'
    },
    {
      class: 'StringArray',
      name: 'scopes'
    },
    {
      class: 'DateTime',
      name: 'expiresAt',
      documentation: 'Expiration time of the access token, as returned by the OAuth provider'
    },
    {
      class: 'String',
      name: 'sessionId',
      documentation: 'Session ID associated with the OAuth token'
    }
  ],
  methods: [
    {
      name: 'refreshAuth',
      type: 'Void',
      args: [ { name: 'x', type: 'Context' } ],
      javaCode: `
        var provider = findProvider(x);
        provider.refreshAccessToken(x, this);
      `
    },
    {
      name: 'checkAndRefresh',
      type: 'String',
      documentation: 'Returns the access token, proactively refreshing if within 10 minutes of expiration',
      args: 'Context x',
      javaCode: `
        // We refresh every 5 minutes, so update if expiring in 10 minutes, to avoid a race-condition
        if ( getExpiresAt() != null ) {
          Instant expiresAt         = getExpiresAt().toInstant();
          Instant tenMinutesFromNow = Instant.now().plusSeconds(10 * 60);

          if ( expiresAt.isBefore(tenMinutesFromNow) ) {
            refreshAuth(x);

            // Should we refresh our Session?
            // Session s = (Session) x.get(Session);
            // if ( s != null ) s.touch();
          }
        }

        return getAccessToken();
      `
    }
  ]
})
