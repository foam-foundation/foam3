/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.box.test',
  name: 'KeepAliveServerBoxTest',
  extends: 'foam.core.test.Test',

  documentation: `
    A service on the WebSocket route answers a keep-alive ping, which carries
    no session, and still checks the session of every other message.
  `,

  javaImports: [
    'foam.box.Box',
    'foam.box.Envelope',
    'foam.box.KeepAlivePing',
    'foam.box.KeepAlivePong',
    'foam.box.RPCErrorMessage',
    'foam.box.RPCMessage',
    'foam.core.boot.CSpec',
    'foam.core.box.COREServiceRouter',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.lang.X',
    'java.util.ArrayList',
    'java.util.List'
  ],

  constants: [
    {
      name: 'SERVICE',
      type: 'String',
      value: 'keepAliveTestDAO'
    }
  ],

  methods: [
    {
      name: 'recorder',
      args: 'List replies',
      javaType: 'foam.box.Box',
      documentation: 'The client end of the socket: keeps every reply.',
      javaCode: `
        return new foam.box.ProxyBox() {
          @Override
          public void send(Envelope envelope) {
            replies.add(envelope.getMessage());
          }
        };
      `
    },
    {
      name: 'router',
      args: 'X x',
      javaType: 'COREServiceRouter',
      documentation: 'The router NanoWebSocket hands every message to, with one served service that needs a signed-in user.',
      javaCode: `
        DAO cSpecDAO = new MDAO(CSpec.getOwnClassInfo());
        cSpecDAO.put(new CSpec.Builder(x)
          .setName(SERVICE)
          .setServe(true)
          .setAuthenticate(true)
          .build());

        COREServiceRouter router = new COREServiceRouter();
        router.setX(x.put("cSpecDAO", cSpecDAO));
        return router;
      `
    },
    {
      name: 'runTest',
      javaCode: `
        COREServiceRouter router = router(x);

        List replies = new ArrayList();
        router.service(SERVICE, new Envelope(new KeepAlivePing(), recorder(replies)));
        test(replies.size() == 1 && replies.get(0) instanceof KeepAlivePong,
          "a ping without a session gets a pong, got: " + replies);

        List rpcReplies = new ArrayList();
        RPCMessage rpc = new RPCMessage();
        rpc.setName("find_");
        rpc.setArgs(new Object[] { null, 1L });
        router.service(SERVICE, new Envelope(rpc, recorder(rpcReplies)));
        test(rpcReplies.size() == 1 && rpcReplies.get(0) instanceof RPCErrorMessage,
          "any other message without a session is still refused, got: " + rpcReplies);
      `
    }
  ]
});
