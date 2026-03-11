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

    Usage Example:
    <pre>
    // MyCredential.js
    foam.CLASS({
      package: 'my.package',
      name: 'MyCredential',

      implements: ['foam.core.security.KeyStoreAware'],

      properties: [
        // ...
        {
          class: 'String',
          name: 'secret'
        }
      ]
    });

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

    // myCredentials.jrl
    p({ id: 'cred1', secret: 'store-secret-in-plain-text' })
    p({ id: 'cred2', secret: 'store-secret-in-myVault', vault: 'myVault' })

    // Retrieval
    cred2.getSecret();                         // returns "store-secret-in-myVault"
    cred2.resolveSecret(x, cred2.getSecret()); // returns the secret key named "store-secret-in-myVault" stored in vault.p12

    cred1.getSecret();                         // returns "store-secret-in-plain-text"
    cred1.resolveSecret(x, cred1.getSecret()); // returns "store-secret-in-plain-text"
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
