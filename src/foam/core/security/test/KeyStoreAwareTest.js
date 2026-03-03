/**
 * Copyright
 * @license 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.security.test',
  name: 'KeyStoreAwareTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'foam.core.auth.Credential',
    'foam.core.security.KeyStoreAware',
    'foam.core.security.KeyStoreManager',
    'foam.lang.X'
  ],

  classes: [
    {
      name: 'MockKeyStoreManager',
      extends: 'foam.core.security.EmptyKeyStoreManager',
      properties: [
        {
          class: 'String',
          name: 'secretValue'
        }
      ],
      methods: [
        {
          name: 'getSecret',
          javaCode: `
            return getSecretValue();
          `
        }
      ]
    }
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        testResolveSecretWithNoVault(x);
        testResolveSecretWithEmptyVault(x);
        testResolveSecretWithVaultNotInContext(x);
        testResolveSecretWithVaultReturnsSecret(x);
      `
    },
    {
      name: 'testResolveSecretWithNoVault',
      args: 'Context x',
      javaCode: `
        var testObj = new Credential();
        testObj.setPassword("myPlainSecret");
        testObj.setVault(null);

        String result = testObj.getPasswordSecret(x);
        expect(result, "myPlainSecret", "Should return plain text secret when vault is null");
      `
    },
    {
      name: 'testResolveSecretWithEmptyVault',
      args: 'Context x',
      javaCode: `
        var testObj = new Credential();
        testObj.setPassword("myPlainSecret");
        testObj.setVault("");

        String result = testObj.getPasswordSecret(x);
        expect(result, "myPlainSecret", "Should return plain text secret when vault is empty string");
      `
    },
    {
      name: 'testResolveSecretWithVaultNotInContext',
      args: 'Context x',
      javaCode: `
        var testObj = new Credential();
        testObj.setPassword("myPlainSecret");
        testObj.setVault("nonExistentVault");

        String result = testObj.getPasswordSecret(x);
        expect(result, "myPlainSecret", "Should return plain text secret when vault service not in context");
      `
    },
    {
      name: 'testResolveSecretWithVaultReturnsSecret',
      args: 'Context x',
      javaCode: `
        var testObj = new Credential();
        testObj.setPassword("myPlainSecret");
        testObj.setVault("mockVault");

        var mockVault = new MockKeyStoreManager();
        mockVault.setSecretValue("vaultSecret123");

        var testX = x.put("mockVault", mockVault);

        String result = testObj.getPasswordSecret(testX);
        expect(result, "vaultSecret123", "Should return secret from vault when vault service exists");
      `
    }
  ]
});

