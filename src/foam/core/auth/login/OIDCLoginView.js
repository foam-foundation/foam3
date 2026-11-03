/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth.login',
  name: 'OIDCLoginView',
  extends: 'foam.u2.Element',

  requires: [
    'foam.core.oauth.OAuthProvider'
  ],

  imports: [
    'clientLoginService',
    'oAuthProviderDAO',
    'theme',
    'window'
  ],

  properties: [
    {
      class: 'Map',
      name: 'reqParams',
      documentation: 'Request params sent on OIDC authentication request'
    },
    {
      class: 'Boolean',
      name: 'oauthInNewWindow',
      value: false
    }
  ],

  methods: [
    function init() {
      var self = this;
      var currentDomain = this.window?.location?.host || '';
      var currentHostname = this.window?.location?.hostname || '';

      this.oAuthProviderDAO
        .find(
          this.OR(
            this.CONTAINS(this.OAuthProvider.DOMAINS, currentDomain),
            this.CONTAINS(this.OAuthProvider.DOMAINS, currentHostname)
          ))
        .then(provider => {
          if ( ! provider ) { self.add('OAuth Provider not found'); return; }

          self.clientLoginService.oauthInWindow = this.oauthInNewWindow;
          self.clientLoginService.signInWithOIDC(provider, this.theme.registrationEnabled, '', this.reqParams);
        });
    }
  ]
});
