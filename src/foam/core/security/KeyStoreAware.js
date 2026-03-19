/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.core.security',
  name: 'KeyStoreAware',

  documentation: `
    Interface for resolving secrets from a vault/key store.

    Classes implementing this interface can retrieve sensitive values
    (such as API keys, passwords, or tokens) from a configured vault
    service rather than storing them as plain text on the object itself.

    Usage example 1 (via credentialDAO):
    <pre>
    // credentials.jrl
    p({id:'cred1', password:'password-in-plain-text'})
    p({id:'cred2', password:'password-in-myVault', vault: 'myVault'})

    // Retrieval
    cred1.getPassword();          // returns "password-in-plain-text"
    cred1.getPasswordSecret(x);   // returns "password-in-plain-text" (because vault property is not set)

    cred2.getPassword();          // returns "password-in-myVault"
    cred2.getPasswordSecret(x);   // returns the secret key with alias:"password-in-myVault" from "myVault" keystore

    // services.jrl
    p({
      class: 'foam.core.boot.CSpec',
      name: 'myVault',
      lazy: false,
      serviceScript: """
        return new foam.core.security.StorageKeyStoreManager.Builder(x)
          .setStorage(new foam.core.fs.FileSystemStorage("/opt/myapp/var"))
          .setType("PKCS12")
          .setKeyStorePath("vault.p12")
          .setKeyStorePass("passphrase")
          .build();
      """
    })
    </pre>


    Usage example 2 (install directly on a service):
    <pre>
    // MyService.js
    foam.CLASS({
      package: 'my.package',
      name: 'MyService',
      implements: ['foam.core.security.KeyStoreAware'],

      properties: [
        { class: 'String', name: 'apiKey' }
      ],
      methods: [
        {
          name: 'doSomething',
          args: 'Context x',
          javaCode: """
            String secretApiKey = resolveSecret(x, getApiKey());
            // make api call with the resolved secretApiKey
          """
        }
      ]
    });

    // services.jrl
    p({
      class: 'foam.core.boot.CSpec',
      name: 'myService',
      lazy: false,
      serviceScript: """
        return new my.package.MyService.Builder(x)
          .setVault("myVault")
          .setApiKey("my-service-api-key")
          .build();
      """
    })
    </pre>
  `,

  properties: [
    {
      class: 'String',
      name: 'vault',
      documentation: 'A cspec service that implements KeyStoreManager.',
      order: -1
    }
  ],

  methods: [
    {
      name: 'resolveSecret',
      type: 'String',
      args: 'Context x, String secretId',
      documentation: `
        Resolves a secret value from the configured vault.
        Throws RuntimeException if secretId is not found in the vault.
        If the vault is not being configured returns the secretId back as-is.
      `,
      javaCode: `
    if ( ! foam.util.SafetyUtil.isEmpty(getVault()) ) {
      var vault = (KeyStoreManager) x.get(getVault());
      if ( vault != null ) {
        try {
          return vault.getSecret(x, secretId);
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
