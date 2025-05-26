/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
/*
 p({
   "class": "foam.core.boot.CSpec",
   "name": "push",
   "description": "Connects to google's firebase API and sends a message and notification pair to be processed by the interface.",
   "documentation": "Pushes a message to google's firebase API. See https://firebase.google.com/docs/reference for information on how to use google's firebase API.",
   "serviceClass": "foam.core.notification.push.FirebasePushService",
   "service": {"class":"foam.core.notification.push.FirebasePushService","apiKey":"AAAAMKWTPTs:APA91bFLHRdVt76aQ-kZ8RBPS1ytYjmO-YsDfSktiN3Ka7U_jpRmt_U7HAs4RNL8bwPEiseZaiecatJDYs3DUp4K3vaq-zx6jg-RaH4xqGjo4KDk-VWDLtz9dgFrySSBcpC2F5DjZJqcuATPI0KMwQLE3KzRoSRQDg"}
 })

*/
/* refinement to add device token property for Firebase */
foam.CLASS({
  package: 'foam.core.auth',
  name: 'UserDeviceTokenRefinement',
  refines: 'foam.core.auth.User',

  properties: [
    {
      class: 'String',
      name: 'deviceToken',
      section: 'deprecatedInformation',
      order: 20,
      gridColumns: 6,
      columnPermissionRequired: true
    }
  ]
});

foam.CLASS({
  package: 'foam.core.notification.push',
  name: 'FirebasePushService',

  implements: [
    'foam.core.notification.push.PushService'
  ],

  javaImports: [
    'foam.lib.json.Outputter',
    'foam.lib.NetworkPropertyPredicate',
    'foam.util.SafetyUtil',
    'java.io.OutputStreamWriter',
    'java.net.HttpURLConnection',
    'java.net.URL',
    'java.util.HashMap',
    'java.util.Map'
  ],

  constants: [
    {
      name: 'FIREBASE_URL',
      value: 'https://fcm.googleapis.com/fcm/send',
      type: 'String'
    }
  ],

  properties: [
    {
      class: 'String',
      name: 'apiKey'
    }
  ],

  methods: [
    {
      name: 'sendPush',
      javaCode:
`HttpURLConnection conn = null;
OutputStreamWriter wr = null;

try {
  if ( user == null || SafetyUtil.isEmpty(user.getDeviceToken()) )
    throw new RuntimeException("Invalid Parameters: Missing user");
  if ( msg == null || msg.isEmpty() )
    throw new RuntimeException("Invalid Parameter: Missing message");

  URL url = new URL(FIREBASE_URL);
  conn = (HttpURLConnection) url.openConnection();

  conn.setRequestMethod("POST");
  conn.setRequestProperty("Authorization", "key=" + getApiKey());
  conn.setRequestProperty("Content-Type", "application/json");
  conn.setDoOutput(true);

  Map<String, Object> body = new HashMap<String, Object>();
  body.put("to", user.getDeviceToken());

  Map<String, Object> notification = new HashMap<String, Object>();
  notification.put("body", msg);
  notification.put("badge", "1");
  notification.put("sound", "default");
  body.put("notification", notification);
  if ( extra != null ) {
    body.put("data", extra);
  }
  body.put("content_available", true);
  body.put("priority", "high");
  if ( data != null ) {
    body.put("data", data);
  }

  Outputter outputter = new Outputter(getX()).setPropertyPredicate(new NetworkPropertyPredicate());
  outputter.output(body);

  wr = new OutputStreamWriter(conn.getOutputStream());
  wr.write(outputter.toString());
  wr.flush();

  return ( conn.getResponseCode() == 200 );
} catch (Throwable t) {
  throw new RuntimeException(t);
} finally {
  if ( wr != null )
    try { wr.close(); } catch (Throwable ignored) {}
  if ( conn != null )
    conn.disconnect();
}`
    }
  ]
});
