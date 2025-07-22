/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification.push',
  name: 'APNSPushService',

  documentation: `Not called directly, called through WebPushService
  TODO: not very msp friendly at the moment, there is no way for WebPushService to find the right apnsPushService for a given app`,

  implements: [
    'foam.core.auth.ServiceProviderAware',
    'foam.core.COREService',
  ],

  javaCode: `
    public void send(iOSNativePushRegistration sub, Map msg) {
      send(sub, msg, 0);
    }
  `,

  constants: [
    {
      type: 'int',
      name: 'MAX_RETRY_ATTEMPTS',
      documentation: 'Number of times service will try to deliver a notification if an exception is thrown',
      value: 3
    },
    {
      type: 'int',
      name: 'TTL_IN_HOURS',
      documentation: 'Time to live for the notification in hours',
      value: 12
    },
  ],

  javaImports: [
    'foam.lang.X',
    'foam.dao.*',
    'foam.dao.ArraySink',
    'foam.core.auth.*',
    'foam.core.logger.Loggers',
    'foam.mlang.MLang',
    'foam.util.SafetyUtil',

    'java.security.Security',
    'java.util.List',
    'java.util.Map',
    'java.io.IOException',
    'java.util.concurrent.ExecutionException',
    'java.util.concurrent.TimeoutException',
    'java.util.concurrent.TimeUnit',

    'com.eatthepath.pushy.apns.*',
    'com.eatthepath.pushy.apns.util.*',
    'com.eatthepath.pushy.apns.util.concurrent.*',

    'foam.core.security.KeyStoreManager',
    'java.security.cert.X509Certificate',

    'java.time.temporal.ChronoUnit',
    'java.time.*'
  ],

  properties: [
    {
      class: 'Object',
      javaType: 'com.eatthepath.pushy.apns.ApnsClient',
      name: 'apnsClient',
      transient: true,
      javaFactory: `
        return buildClient();
      `
    },
    {
      class: 'String',
      name: 'apnsCredentialId',
      documentation: 'credential id to find for host and key data'
    },
    {
      class: 'Long',
      name: 'connectionTimeout',
      documentation: '8 seconds',
      value: 8000
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
      name: 'buildClient',
      type: 'ApnsClient',
      javaCode: `
      try {
        var decoder = org.apache.commons.codec.binary.Base64.builder()
          .get();

        var credential = getCredentials(getX());
        return new ApnsClientBuilder()
          .setConnectionTimeout(ofMillis(getConnectionTimeout()))
          .setApnsServer(credential.getHost())
          .setClientCredentials(
            new java.io.ByteArrayInputStream(
              decoder.decode(credential.getP12Base64())),
              credential.getP12Password())
          .build();
      } catch ( Throwable e ) {
        throw new RuntimeException(e);
      }
      `
    },
    {
      name: 'send',
      args: 'iOSNativePushRegistration sub, Map msg, int attempt',
      type: 'Void',
      javaCode: `
          // Dont send notifications to subs that are in denied state
          if ( SafetyUtil.equals(sub.getLastKnownState(), "DENIED") ) {
            return;
          } 

          var cred = getCredentials(getX());

          final ApnsPayloadBuilder payloadBuilder = new SimpleApnsPayloadBuilder();
          payloadBuilder.setAlertBody((String) msg.get("body"));
          payloadBuilder.setAlertTitle((String) msg.get("title"));

          for ( var e : msg.entrySet() ) {
            var entry = (java.util.Map.Entry)e;
            if ( !((String)entry.getKey()).equals("body") && !((String)entry.getKey()).equals("title") ) {
              payloadBuilder.addCustomProperty((String)entry.getKey(), entry.getValue());
            }
          }
          String payload = payloadBuilder.build();
          // Add a ttl for notifications on the payload
          String token = TokenUtil.sanitizeTokenString(sub.getEndpoint());

          // TTL for notification delivery, after this time apns will stop trying to deliver this notification
          // Currently hardcoded to 7 days
          Instant instant = Instant.now();
          instant = instant.plus(TTL_IN_HOURS, ChronoUnit.HOURS);
          SimpleApnsPushNotification pushNotification = new SimpleApnsPushNotification(token, cred.getAppBundleId(), payload, instant);

          try {
            // Asking the APNs client to send the notification
            // and creating the future that will return the status
            // of the push after it's sent.
            final PushNotificationFuture<SimpleApnsPushNotification, PushNotificationResponse<SimpleApnsPushNotification>> sendNotificationFuture = getApnsClient().sendNotification(pushNotification);

            // getting the response from APNs
            final PushNotificationResponse<SimpleApnsPushNotification> pushNotificationResponse = sendNotificationFuture.get(getReadTimeout(), TimeUnit.MILLISECONDS);
            if (pushNotificationResponse.isAccepted()) {
              Loggers.logger(getX(), this).info("APNSPushService", "Push notification accepted by APNs gateway." + pushNotificationResponse.getApnsId());
            } else {
              //TODO: Replace with alarms
              Loggers.logger(getX(), this).error("APNSPushService", "Notification rejected by the APNs gateway: " + pushNotificationResponse.getRejectionReason());

              if (pushNotificationResponse.getTokenInvalidationTimestamp() != null) {
                Loggers.logger(getX(), this).error("APNSPushService", "and the token is invalid as of " + pushNotificationResponse.getTokenInvalidationTimestamp());

                // If notification is rejected with invalidation timestamp, change it's status
                sub = (iOSNativePushRegistration) sub.fclone();
                sub.setLastKnownState("DENIED");
                ((DAO) getX().get("pushRegistrationDAO")).put(sub);
              }
            }
          } catch ( ExecutionException | InterruptedException | TimeoutException e ) {
            // Should retry if it fails without explanation i.e. we never get a response from apple's servers however a rejection from the apple server should be considered permanent and no retry should be attempted
            Loggers.logger(getX(), this).error("APNSPushService", "Notification rejected by network interrupt", "remaining attempts: " + attempt);
            if ( attempt < MAX_RETRY_ATTEMPTS ) {
              attempt++;
              send(sub, msg, attempt);
            } 
          } catch ( Exception e ) {
            Loggers.logger(getX(), this).error("APNSPushService", "Failed to send push notification.", e);
          }
      `
    },
    {
      name: 'getCredentials',
      args: 'X x',
      type: 'APNSCredential',
      javaCode: `
        APNSCredential credentials = null;
        DAO credentialDAO = (DAO) x.get("credentialsDAO");
        credentials = (APNSCredential) credentialDAO.find(MLang.EQ(APNSCredential.ID, getApnsCredentialId()));
        return credentials;
      `
    },
    {
      name: 'reload',
      javaCode: `
        setApnsClient(buildClient());
        Loggers.logger(getX(), this).info("APNSPushService", "httpClient reloaded.");
      `
    }
  ]
});
