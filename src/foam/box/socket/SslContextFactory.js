/**
* @license
* Copyright 2021 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.box.socket',
  name: 'SslContextFactory',
  documentation: 'create SSL context from resource',

  implements: [
    'foam.core.security.KeyStoreAware'
  ],

  javaImports: [
    'foam.lang.X',
    'foam.core.logger.PrefixLogger',
    'foam.core.logger.Logger',
    'javax.net.ssl.*',
    'java.io.FileInputStream',
    'java.io.FileNotFoundException',
    'java.io.IOException',
    'java.io.InputStream',
    'java.net.Socket',
    'java.security.*',
    'java.security.cert.CertificateException',
    'java.util.Arrays'
  ],

  properties: [
    {
      class: 'String',
      name: 'storeType',
      value: 'PKCS12'
    },
    {
      class: 'String',
      name: 'protocol',
      value: 'SSL'
    },
    {
      class: 'String',
      name: 'keyStoreDir'
    },
    {
      class: 'String',
      name: 'keyStorePath'
    },
    {
      class: 'String',
      name: 'keyStorePass'
    },
    {
      class: 'String',
      name: 'trustStorePath'
    },
    {
      class: 'String',
      name: 'trustStorePass'
    },
    {
      class: 'FObjectProperty',
      name: 'logger',
      of: 'foam.core.logger.Logger',
      visibility: 'HIDDEN',
      transient: true,
      javaCloneProperty: '//noop',
      javaFactory: `
      return new PrefixLogger(new Object[] {
        this.getClass().getSimpleName(),
        getKeyStorePath(),
        getStoreType()
      }, (Logger) getX().get("logger"));
      `
    },
    {
      class: 'Boolean',
      name: 'enableSSL',
      value: false
    }
  ],

  methods: [
    {
      name: 'getKeyManagers',
      javaType: 'KeyManager[]',
      args: [
        {
          name: 'x',
          type: 'Context'
        },
        {
          name: 'storePath',
          type: 'String'
        },
        {
          name: 'storePass',
          type: 'String'
        }
      ],
      javaCode: `
        KeyManager[] keyManagers = null;
        KeyManagerFactory factory = null;
        KeyStore keyStore = null;

        try {
          keyStore = getKeystore(x, storePath, storePass);
          factory = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
          factory.init(keyStore, storePass == null ? null : storePass.toCharArray());
        } catch ( UnrecoverableKeyException e ) {
          getLogger().error(e);
          throw new RuntimeException(e);
        } catch ( KeyStoreException e ) {
          getLogger().error(e);
          throw new RuntimeException(e);
        } catch ( NoSuchAlgorithmException e ) {
          getLogger().error(e);
          throw new RuntimeException(e);
        }
        keyManagers = factory.getKeyManagers();
        return keyManagers;
      `
    },
    {
      name: 'getTrustManagers',
      javaType: 'TrustManager[]',
      args: [
        {
          name: 'x',
          type: 'Context'
        },
        {
          name: 'storePath',
          type: 'String'
        },
        {
          name: 'storePass',
          type: 'String'
        }
      ],
      javaCode: `
        TrustManager[] trustManagers = null;
        TrustManagerFactory factory = null;
        KeyStore keyStore = null;

        try {
          keyStore = getKeystore(x, storePath, storePass);
          factory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
          factory.init(keyStore);
        } catch ( KeyStoreException e ) {
          getLogger().error(e);
          throw new RuntimeException(e);
        } catch ( NoSuchAlgorithmException e ) {
          getLogger().error(e);
          throw new RuntimeException(e);
        }
        trustManagers = factory.getTrustManagers();
        return trustManagers;
      `
    },
    {
      name: 'getKeystore',
      javaType: 'KeyStore',
      args: [
        {
          name: 'x',
          type: 'Context'
        },
        {
          name: 'storePath',
          type: 'String'
        },
        {
          name: 'storePass',
          type: 'String'
        }
      ],
      javaCode: `
        KeyStore keyStore = null;
        try {
          if ( ! foam.util.SafetyUtil.isEmpty(getVault()) ) {
            keyStore = resolveKeyStore(x, storePath, getStoreType(), storePass);
          } else {
            InputStream is = getStorage().getInputStream(storePath);
            if ( is == null ) {
              throw new IOException("Failed opening inputstream "+storePath);
            }

            keyStore = KeyStore.getInstance(getStoreType());
            keyStore.load(is, storePass == null ? null : storePass.toCharArray());
            is.close();
          }
        } catch ( KeyStoreException e ) {
          getLogger().error(e);
          throw new RuntimeException(e);
        } catch ( FileNotFoundException e ) {
          getLogger().error(e);
          throw new RuntimeException(e);
        } catch ( NoSuchAlgorithmException e ) {
          getLogger().error(e);
          throw new RuntimeException(e);
        } catch ( CertificateException e ) {
          getLogger().error(e);
          throw new RuntimeException(e);
        } catch ( IOException e ) {
          getLogger().error(e);
          throw new RuntimeException(e);
        } catch ( Exception e ) {
          getLogger().error(e);
          throw new RuntimeException(e);
        }
        return keyStore;
      `
    },
    {
      name: 'getSSLContext',
      javaType: 'SSLContext',
      args: [
        {
          name: 'x',
          type: 'Context'
        }
      ],
      javaCode: `
        // getLogger().debug("getSSLContext");
        SSLContext sslContext = null;
        try {
          sslContext = SSLContext.getInstance(getProtocol());
          sslContext.init(
            getKeyManagers(x, getKeyStorePath(), resolveSecret(x, getKeyStorePass())),
            getTrustManagers(x, getTrustStorePath(), resolveSecret(x, getTrustStorePass())),
            null
          );
        } catch ( NoSuchAlgorithmException e ) {
          getLogger().error(e);
          throw new RuntimeException(e);
        } catch ( KeyManagementException e ) {
          getLogger().error(e);
          throw new RuntimeException(e);
        }
        return sslContext;
      `
    },
    {
      name: 'getSSLContextByAlias',
      javaType: 'SSLContext',
      args: [
        {
          name: 'x',
          type: 'Context'
        },
        {
          name: 'keyAlias',
          type: 'String'
        }
      ],
      javaCode: `
        SSLContext sslContext = null;
        try {
          KeyManager[] keyManagers = getKeyManagers(x, getKeyStorePath(), resolveSecret(x, getKeyStorePass()));
          if ( keyManagers == null || keyManagers.length < 1 ) return sslContext;

          sslContext = SSLContext.getInstance(getProtocol());
          sslContext.init(Arrays.stream(keyManagers)
            .map(k -> {
              if ( k instanceof X509KeyManager ) {
                return new X509ExtendedKeyManager() {
                  @Override
                  public String chooseEngineClientAlias(String[] paramArrayOfString, Principal[] paramArrayOfPrincipal, SSLEngine paramSSLEngine) {
                    return chooseClientAlias(paramArrayOfString, paramArrayOfPrincipal, null);
                  }

                  @Override
                  public String chooseClientAlias(String[] keyType, Principal[] issuers, Socket socket) {
                    return keyAlias;
                  }
                  @Override
                  public java.security.PrivateKey getPrivateKey(String str) {
                    return ((X509KeyManager) k).getPrivateKey(str);
                  }
                  @Override
                  public java.security.cert.X509Certificate[] getCertificateChain(String s) {
                    return ((X509KeyManager) k).getCertificateChain(s);
                  }
                  @Override
                  public String chooseServerAlias(String keyType, java.security.Principal[] issuers, java.net.Socket socket) {
                    return ((X509KeyManager) k).chooseServerAlias(keyType, issuers, socket);
                  }
                  @Override
                  public String[] getServerAliases(String keyType, java.security.Principal[] issuers) {
                    return ((X509KeyManager) k).getServerAliases(keyType, issuers);
                  }
                  @Override
                  public String[] getClientAliases(String keyType, java.security.Principal[] issuers) {
                    return ((X509KeyManager) k).getClientAliases(keyType, issuers);
                  }
                };
              } else {
                return k;
              }
            }).toArray(KeyManager[]::new),
            getTrustManagers(x, getTrustStorePath(), resolveSecret(x, getTrustStorePass())),
              null);

        } catch ( NoSuchAlgorithmException e ) {
          getLogger().error(e);
          throw new RuntimeException(e);
        } catch ( KeyManagementException e ) {
          getLogger().error(e);
          throw new RuntimeException(e);
        }
        return sslContext;
      `
    },
    {
      name: 'getStorage',
      type: 'foam.core.fs.Storage',
      javaCode: `
        if ( storage_ == null ) {
          if ( ! foam.util.SafetyUtil.isEmpty(getKeyStoreDir()) ) {
            storage_ = new foam.core.fs.FileSystemStorage(getKeyStoreDir());
          } else {
            storage_ = getX().get(foam.core.fs.Storage.class);
          }
        }
        return storage_;
      `
    }
  ],

  javaCode: `
    protected foam.core.fs.Storage storage_;
  `
});
