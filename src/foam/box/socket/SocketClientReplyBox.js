/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.box.socket',
  name: 'SocketClientReplyBox',
  implements: [
    'foam.box.Box'
  ],

  documentation: `Provides for 'reply' socket box reuse via the SocketConnectionBoxManager.`,

  javaImports: [
    'foam.box.Box',
    'foam.lang.X',
    'java.net.Socket'
  ],

  properties: [
    {
      class: 'String',
      name: 'replyBoxId'
    },
    {
      name: 'created',
      class: 'DateTime',
      javaFactory: 'return new java.util.Date();'
    }
  ],

  javaCode: `
    public SocketClientReplyBox(String replyBoxId) {
      setReplyBoxId(replyBoxId);
      setCreated(new java.util.Date());
    }
  `,

  methods: [
    {
      name: 'send',
      javaCode: `
      X x = foam.lang.XLocator.get();
      Socket socket = (Socket) x.get("socket");
      if ( socket == null ) {
        x = getX();
        socket = (Socket) x.get("socket");
      }
      if ( socket != null ) {
        Box box = ((SocketConnectionBoxManager) x.get("socketConnectionBoxManager")).getReplyBox(x, socket.getRemoteSocketAddress().toString());
        box.send(new foam.box.Envelope.Builder(x).setMessage(new foam.box.SubBoxMessage(getReplyBoxId(), envelope.getMessage())).build());
      } else {
        foam.core.logger.Logger logger = (foam.core.logger.Logger) x.get("logger");
        if ( logger == null ) {
          logger = foam.core.logger.StdoutLogger.instance();
        }
        logger.error(this.getClass().getSimpleName(), "send,Socket not found", "replyBoxId", getReplyBoxId(), "message abandoned", envelope, new Exception("Socket not found."));
      }
      `
    }
  ]
});
