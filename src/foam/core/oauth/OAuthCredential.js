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
      documentation: 'Returns the access token, proactively refreshing if within 5 minutes of expiration',
      args: 'Context x',
      javaCode: `
        if ( getExpiresAt() != null && ! SafetyUtil.isEmpty(getRefreshToken()) ) {
          Instant expiresAt = getExpiresAt().toInstant();
          Instant fiveMinutesFromNow = Instant.now().plusSeconds(300);
          if ( expiresAt.isBefore(fiveMinutesFromNow) )
            refreshAuth(x);
        }

        return getAccessToken();
      `
    }
  ]
})