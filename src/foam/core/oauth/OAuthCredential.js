foam.CLASS({
  package: 'foam.core.oauth',
  name: 'OAuthCredential',
  ids: ["provider", "user", "remoteSubject"],
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
      class: 'String',
      name: 'remoteSubject',
      documentation: 'Remote account identifier (e.g., OpenID Connect sub).'
    },
    {
      class: 'String',
      name: 'remoteEmail',
      documentation: 'Remote account email for display (not a stable identifier).'
    }
  ],
  methods: [
    {
      name: 'refreshAuth',
      type: 'Void',
      args: [ { name: 'x', type: 'Context' } ],
      javaCode: `
        var provider = findProvider(x);
        String newAccessToken = provider.refreshAccessToken(x, getRefreshToken());
        setAccessToken(newAccessToken);
      `
    }
  ]
})
