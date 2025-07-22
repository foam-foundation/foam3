/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// See: https://github.com/web-push-libs/webpush-java
//
// To generate public/private keys:
// npm install web-push --save
// ./node_modules2/.bin/web-push generate-vapid-keys --json

foam.CLASS({
  package: 'foam.core.notification.push',
  name: 'WebPushService',

  implements: [
    'foam.core.COREService'
  ],

  javaImports: [
    'java.security.Security',
    'foam.dao.*',
    'foam.dao.ArraySink',
    'foam.core.logger.Loggers',
    'foam.core.auth.*',
    'java.util.List',
    'java.util.Map',
    'foam.util.SafetyUtil',
    'java.util.concurrent.TimeUnit',
    'nl.martijndwars.webpush.Notification',
    'org.bouncycastle.jce.provider.BouncyCastleProvider',
    'java.time.Duration'
  ],

  constants: [
    {
      type: 'int',
      name: 'TTL_IN_HOURS',
      documentation: 'Time to live for the notification in hours',
      value: 12
    }
  ],

  properties: [
    {
      class: 'String',
      name: 'supportEmail',
      javaPostSet: 'clearPushService();'
    },
    // TODO: move to KeyPairDAO
    {
      class: 'String',
      name: 'publicKey',
      javaPostSet: 'clearPushService();'
    },
    {
      class: 'String',
      name: 'privateKey',
      javaPostSet: 'clearPushService();'
    },
    {
      class: 'Object',
      javaType: 'nl.martijndwars.webpush.PushService',
      name: 'pushService',
      transient: true,
      javaFactory: `
       return buildPushService();
      `
    },
    {
      class: 'Long',
      name: 'readTimeout',
      documentation: '20 seconds',
      value: 20000
    }
  ],

  methods: [
    {
      name: 'buildPushService',
      type: 'nl.martijndwars.webpush.PushService',
      javaCode: `
        try {
          if ( Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null ) {
            Security.addProvider(new BouncyCastleProvider());
          }
          return new nl.martijndwars.webpush.PushService(getPublicKey(), getPrivateKey(), "mailto:" + getSupportEmail() );
        } catch (Throwable t) {
          throw new RuntimeException(t);
        }
      `
    },
    {
      name: 'send',
      args: 'PushRegistration sub, Map msgMap',
      type: 'Void',
      javaCode: `
      /*
      System.err.println("  Sending:    " + msg);
      System.err.println("    endpoint: " + sub.getEndpoint());
      System.err.println("         key: " + sub.getKey());
      System.err.println("        auth: " + sub.getAuth());
      */
        try {
          if ( SafetyUtil.isEmpty(sub.getEndpoint()) ) {
            return;
          }
          var msg = jakarta.json.Json.createObjectBuilder(msgMap)
            .build()
            .toString();

          var pushService = getPushService();
          Duration ttl = Duration.ofHours(TTL_IN_HOURS);
          int ttlValue = (int) ttl.getSeconds();
          byte[] byteArray = msg.getBytes(); 
          Notification n = new Notification(
            sub.getEndpoint(),
            sub.getKey(),
            sub.getAuth(),
            byteArray,
            ttlValue
          );

          var future = pushService.sendAsync(n);
          future.get(getReadTimeout(), TimeUnit.MILLISECONDS);
        } catch (Throwable t) {
          //TODO: add alarm
          Loggers.logger(getX(), this).error("WebPushService", t);
        }
      `
    },
    {
      name: 'reload',
      javaCode: `
        setPushService(buildPushService());
        Loggers.logger(getX(), this).info("WebPushService", "pushService reloaded.");
      `
    }
  ]
});
