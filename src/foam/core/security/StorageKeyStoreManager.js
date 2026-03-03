/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.security',
  name: 'StorageKeyStoreManager',

  implements: [
    'foam.core.COREService',
    'foam.core.security.KeyStoreManager',
    'foam.core.security.KeyStoreAware'
  ],

  documentation: `KeyStoreManager which manages a Java KeyStore loaded
from either File or Resource Storage.`,

  javaImports: [
    'foam.core.logger.Loggers',
    'foam.core.fs.Storage',
    'foam.util.SafetyUtil',
    'java.io.InputStream',
    'java.io.IOException',
    'java.security.KeyStore',
    'static java.security.KeyStore.PasswordProtection',
    'static java.security.KeyStore.SecretKeyEntry',
  ],

  properties: [
    {
      class: 'Object',
      name: 'storage',
      documentation: 'File or Resource stroage in which the keystore resides.'
    },
    {
      class: 'String',
      name: 'type',
      documentation: 'KeyStore type.'
    },
    {
      class: 'String',
      name: 'provider',
      documentation: 'KeyStore crypto provider.'
    },
    {
      class: 'String',
      name: 'keyStorePath',
      documentation: 'Path and name of keystore file.'
    },
    {
      class: 'String',
      name: 'keyStorePass',
      documentation: 'Keystore passphrase.'
    },
    {
      class: 'Object',
      name: 'keyStore',
      documentation: 'Runtime keystore holding loaded or stored keys.',
      transient: true,
      visibility: 'HIDDEN',
      javaType: 'java.security.KeyStore',
      javaFactory: `
        try {
          return ! SafetyUtil.isEmpty(getProvider()) ?
            KeyStore.getInstance(getType(), getProvider()) :
            KeyStore.getInstance(getType());
        } catch (Throwable t) {
          throw new RuntimeException(t);
        }
      `
    }
  ],
  methods: [
    {
      name: 'loadKey',
      javaCode: `
        return loadKey_(alias, new KeyStore.PasswordProtection(resolveSecret(getX(), getKeyStorePass()).toCharArray()));
      `
    },
    {
      name: 'storeKey',
      javaCode: `
        storeKey_(alias, entry, new KeyStore.PasswordProtection(resolveSecret(getX(), getKeyStorePass()).toCharArray()));
      `
    },
    {
      name: 'getSecret',
      javaCode: `
        SecretKeyEntry entry = (SecretKeyEntry) loadKey(alias.toLowerCase());
        if ( entry != null ) {
          // SecretKey.getEncoded() is simpler and more reliable, no need to
          // construct SecretKeyFactory with algorithm and cast to PBEKeySpec.
          return new String(entry.getSecretKey().getEncoded());
        }
        Loggers.logger(getX(), this).warning("getSecret, Alias not found", alias.toLowerCase());
        throw new IllegalArgumentException("Alias not found");
      `
    },
    {
      name: 'unlock',
      javaCode: `
        try {
          Storage storage = getStorage() != null ? (Storage) getStorage() : getX().get(Storage.class);
          InputStream is = storage.getInputStream(getKeyStorePath());
          if ( is != null ) {
            getKeyStore().load(is, resolveSecret(getX(), getKeyStorePass()).toCharArray());
            is.close();
          } else {
            throw new java.io.FileNotFoundException("Keystore resource not found "+getKeyStorePath());
          }
        } catch ( IOException e ) {
          Loggers.logger(getX(), this).error("unlock", getType(), e);
          throw new RuntimeException(e);
        }
      `
    },
    {
      name: 'start',
      javaThrows: [ 'java.lang.Exception' ],
      javaCode: `
        unlock();
      `
    },
    {
      name: 'reload',
      javaCode: `
      clearProperty("keyStore");
      try {
        start();
      } catch (Exception e) {
        throw new RuntimeException(e);
      }
      `
    }
  ]
});
