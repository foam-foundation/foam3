/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.core.security',
  name: 'KeyStoreAware',

  properties: [
    {
      class: 'String',
      name: 'vault',
      documentation: 'A cspec service that implements KeyStoreManager.'
    }
  ],

  methods: [
    {
      name: 'resolveSecret',
      type: 'String',
      args: 'Context x, String secretId',
      javaCode: `
    if ( ! foam.util.SafetyUtil.isEmpty(getVault()) ) {
      var vault = (KeyStoreManager) x.get(getVault());
      if ( vault != null ) {
        try {
          return vault.getSecret(x, secretId, null);
        } catch ( Throwable e ) {
          throw new RuntimeException(e);
        }
      }
    }
    return secretId;
`
    }
  ]
});
