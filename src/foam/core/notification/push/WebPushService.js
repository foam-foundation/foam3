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

  javaImports: [
    'java.security.Security',
    'foam.dao.*',
    'foam.dao.ArraySink',
    'foam.core.auth.*',
    'java.util.List',
    'java.util.Map',
    'foam.util.SafetyUtil',
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
      of: 'nl.martijndwars.webpush.PushService',
      name: 'pushService',
      transient: true,
      javaFactory: `
      // TODO: rebuild if settings change
      try {
        if ( Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null ) {
          Security.addProvider(new BouncyCastleProvider());
        }
        return new nl.martijndwars.webpush.PushService(getPublicKey(), getPrivateKey(), "mailto:" + getSupportEmail() );
      } catch (Throwable t) {
        t.printStackTrace();
        return null;
      }
      `
    }
  ],

  methods: [
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

          var a = (nl.martijndwars.webpush.PushService) getPushService();
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

          a.sendAsync(n);
        } catch (Throwable t) {
          //TODO: add alarm
          t.printStackTrace();
        }
      `
    }
  ]
});
