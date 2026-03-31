/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.core.security',
  name: 'KeyStoreManager',

  documentation: 'FOAM interface to Java KeyStore',

  javaImports: [
    'java.security.KeyStore'
  ],

  methods: [
    {
      name: 'getKeyStore',
      documentation: 'Returns the KeyStore.',
      javaType: 'java.security.KeyStore'
    },
    {
      name: 'unlock',
      documentation: 'Unlocks the KeyStore.',
      javaThrows: [
        'java.security.cert.CertificateException',
        'java.security.NoSuchAlgorithmException',
        'java.io.IOException'
      ]
    },
    {
      name: 'loadKey',
      documentation: 'Loads a key from the KeyStore.',
      javaType: 'java.security.KeyStore.Entry',
      javaThrows: [
        'java.security.UnrecoverableEntryException',
        'java.security.NoSuchAlgorithmException',
        'java.security.KeyStoreException'
      ],
      args: 'String alias',
    },
    {
      name: 'loadKey_',
      documentation: 'Loads a key from the KeyStore using additional protection parameter.',
      protected: true,
      javaType: 'java.security.KeyStore.Entry',
      javaThrows: [
        'java.security.UnrecoverableEntryException',
        'java.security.NoSuchAlgorithmException',
        'java.security.KeyStoreException'
      ],
      args: 'String alias, java.security.KeyStore.ProtectionParameter protParam',
      javaCode: `
        return getKeyStore().getEntry(alias, protParam);
      `
    },
    {
      name: 'storeKey',
      documentation: 'Stores a new key.',
      javaThrows: [
        'java.security.KeyStoreException'
      ],
      args: 'String alias, java.security.KeyStore.Entry entry',
      javaCode: `
        storeKey_(alias, entry, null);
      `
    },
    {
      name: 'storeKey_',
      documentation: 'Stores a new key using additional protection parameter.',
      protected: true,
      javaThrows: [
        'java.security.KeyStoreException'
      ],
      args: 'String alias, java.security.KeyStore.Entry entry, java.security.KeyStore.ProtectionParameter protParam',
      javaCode: `
        getKeyStore().setEntry(alias, entry, protParam);
      `
    },
    {
      documentation: `Retrieve a password from the keystore imported via importpass.
keytool -importpass \
 -v \
 -alias "$ALIAS" \
 -keypass "$PASSWORD" \
 -keyalg PBEWithHmacSHA256AndAES_128 \
 -keysize 256 \
 -keystore "$DOMAIN.jks" \
 -storepass "$PASSWORD" \
 -storetype PKCS12 \
 <<<"$SECRET"
`,
      name: 'getSecret',
      type: 'String',
      javaThrows: [
        'java.lang.IllegalArgumentException',
        'java.io.IOException',
        'java.security.GeneralSecurityException'
      ],
      args: [
        {
          name: 'x',
          type: 'Context'
        },
        {
          name: 'alias',
          type: 'String'
        }
        // {
        //   documentation: 'A PBE Algorithm. See https://docs.oracle.com/en/java/javase/11/docs/specs/security/standard-names.html#keystore-types',
        //   name: 'algorithm',
        //   type: 'String'
        // }
      ],
      javaCode: `
      throw new UnsupportedOperationException();
      `
    }
  ]
});
