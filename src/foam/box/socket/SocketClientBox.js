/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.box.socket',
  name: 'SocketClientBox',

  documentation: `Provides for 'send' socket box reuse via the SocketConnectionBoxManager.`,

  implements: [
    'foam.box.Box'
  ],

  properties: [
    {
      class: 'String',
      name: 'host'
    },
    {
      class: 'Int',
      name: 'port'
    },
    {
      class: 'String',
      name: 'serviceName'
    }
  ],

  methods: [
    {
      name: 'send',
      javaCode: `
        foam.box.Box box = ((SocketConnectionBoxManager) getX().get("socketConnectionBoxManager")).get(getX(), getHost(), getPort(), getServiceName());
        try {
          box.send(new foam.box.Envelope(new foam.box.SubBoxMessage(getServiceName(), envelope.getMessage()), envelope.getReplyBox()));
        } catch ( RuntimeException e ) {
          ((SocketConnectionBoxManager) getX().get("socketConnectionBoxManager")).remove((SocketConnectionBox) box);
          throw e;
        }
      `
    }
  ]
});
