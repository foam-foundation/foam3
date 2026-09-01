/**
* @license
* Copyright 2026 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.box.socket',
  name: 'UnsafeSslContextFactory',
  extends: 'foam.box.socket.SslContextFactory',
  documentation: 'create SSL context which trusts all certification requests',

  javaImports: [
    'java.security.cert.X509Certificate',
    'java.security.*',
    'javax.net.ssl.*'
  ],

  methods: [
    {
      name: 'getSSLContext',
      javaType: 'SSLContext',
      javaCode: `
        SSLContext sslContext = null;
        try {
          sslContext = SSLContext.getInstance(getProtocol());

          TrustManager[] trustAll = new TrustManager[] {
            new X509TrustManager() {
              public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
              public void checkClientTrusted(X509Certificate[] c, String a) {}
              public void checkServerTrusted(X509Certificate[] c, String a) {
                getLogger().debug("UnsafeSSLContext", "checkServerTrusted", a);
              }
            }
          };
          sslContext.init(null, trustAll, null);
        } catch ( NoSuchAlgorithmException e ) {
          getLogger().error(e);
          throw new RuntimeException(e);
        } catch ( KeyManagementException e ) {
          getLogger().error(e);
          throw new RuntimeException(e);
        }
        return sslContext;
      `
    }
  ]
});
