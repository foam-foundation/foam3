/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'StopRemoteListenerTest',
  extends: 'foam.core.test.Test',

  documentation: `
    A client listening over a WebSocket can stop its listener on the server.
  `,

  javaImports: [
    'foam.box.Box',
    'foam.box.Envelope',
    'foam.box.RPCMessage',
    'foam.box.SubBox',
    'foam.core.auth.EnabledAwareDummy',
    'foam.lang.X',
    'java.util.ArrayList',
    'java.util.List'
  ],

  methods: [
    {
      name: 'recorder',
      args: 'List sent, boolean fail',
      javaType: 'foam.box.Box',
      documentation: 'The client end of a connection: keeps what the server sends, or throws as a closed socket does.',
      javaCode: `
        return new foam.box.ProxyBox() {
          @Override
          public void send(Envelope envelope) {
            if ( fail ) throw new RuntimeException("connection closed");
            sent.add(envelope);
          }
        };
      `
    },
    {
      name: 'call',
      args: 'X cx, SessionDAOSkeleton skeleton, String name, Object arg, List replies',
      documentation: 'One RPC from the client, as NanoWebSocket hands it to the skeleton: args are [x, arg, predicate].',
      javaCode: `
        RPCMessage rpc = new RPCMessage();
        rpc.setName(name);
        rpc.setArgs(new Object[] { null, arg, null });
        skeleton.send(new Envelope(cx, rpc, recorder(replies, false)));
      `
    },
    {
      name: 'clientSink',
      args: 'X x, String name, Box toClient',
      javaType: 'foam.dao.ClientSink',
      documentation: 'A listen sink as it arrives from a browser: a ClientSink exported under a SubBox name.',
      javaCode: `
        ClientSink sink = new ClientSink(x);
        sink.setDelegate(new SubBox(name, toClient));
        return sink;
      `
    },
    {
      name: 'stop',
      args: 'String name',
      javaType: 'foam.dao.StopListeningCmd',
      javaCode: `
        StopListeningCmd cmd = new StopListeningCmd();
        cmd.setName(name);
        return cmd;
      `
    },
    {
      name: 'row',
      args: 'X x, long id',
      javaType: 'foam.lang.FObject',
      javaCode: `return new EnabledAwareDummy.Builder(x).setId(id).setEnabled(true).build();`
    },
    {
      name: 'runTest',
      javaCode: `
        final DAO          dao      = new MDAO(EnabledAwareDummy.getOwnClassInfo());
        SessionDAOSkeleton skeleton = new SessionDAOSkeleton();
        skeleton.setX(x);
        skeleton.setDelegateFactory(new foam.lang.XFactory() { public Object create(X fx) { return dao; } });

        RemoteListeners connA = new RemoteListeners.Builder(x).build();
        RemoteListeners connB = new RemoteListeners.Builder(x).build();
        X               onA   = x.put("remoteListeners", connA);
        X               onB   = x.put("remoteListeners", connB);
        List            reply = new ArrayList();

        // a listen is tracked by its exported name, and hears
        List heard7 = new ArrayList();
        call(onA, skeleton, "listen_", clientSink(x, "7", recorder(heard7, false)), reply);
        test(connA.size() == 1, "a remote listen is tracked by its connection");
        dao.put(row(x, 1));
        test(heard7.size() == 1, "and hears a put");

        // the client stops it: the skeleton answers, and nothing more is sent
        int replies = reply.size();
        call(onA, skeleton, "cmd_", stop("7"), reply);
        test(reply.size() == replies + 1, "the skeleton answers a StopListeningCmd itself");
        test(connA.size() == 0, "the stopped listen leaves the connection's list");
        dao.put(row(x, 2));
        test(heard7.size() == 1, "a stopped listener hears nothing more");

        // stopped before any event: detached at the next one
        List heard8 = new ArrayList();
        call(onA, skeleton, "listen_", clientSink(x, "8", recorder(heard8, false)), reply);
        call(onA, skeleton, "cmd", stop("8"), reply);
        dao.put(row(x, 3));
        test(heard8.size() == 0, "a listener stopped before any event never hears one (the cmd spelling too)");

        // another connection cannot stop it
        List heard9 = new ArrayList();
        call(onA, skeleton, "listen_", clientSink(x, "9", recorder(heard9, false)), reply);
        call(onB, skeleton, "cmd_", stop("9"), reply);
        dao.put(row(x, 4));
        test(heard9.size() == 1, "a stop from another connection does not stop it");

        // the connection closes: all its listeners stop
        connA.stopAll();
        dao.put(row(x, 5));
        test(heard9.size() == 1 && connA.size() == 0, "closing the connection stops every listener it made");

        // a client that cannot be reached is forgotten
        List lost = new ArrayList();
        call(onA, skeleton, "listen_", clientSink(x, "10", recorder(lost, true)), reply);
        test(connA.size() == 1, "a listen to a client about to fail is tracked");
        dao.put(row(x, 6));
        test(connA.size() == 0, "a failed send takes it out of the connection's list");

        // the listen exactly as a browser's ClientDAO sends it (captured from the JS client)
        List fromBrowser = new ArrayList();
        X    wire        = onA.put("returnBox", recorder(fromBrowser, false));
        RPCMessage listenRpc = (RPCMessage) wire.create(foam.lib.json.JSONParser.class).parseString(
          "{\\"class\\":\\"foam.box.RPCMessage\\",\\"name\\":\\"listen_\\",\\"args\\":[null,{\\"class\\":\\"foam.dao.ClientSink\\",\\"delegate\\":{\\"class\\":\\"foam.box.SubBox\\",\\"name\\":\\"41\\",\\"delegate\\":{\\"class\\":\\"foam.box.ReturnBox\\"}}},null]}");
        skeleton.send(new Envelope(wire, listenRpc, recorder(reply, false)));
        dao.put(row(x, 8));
        test(fromBrowser.size() == 1, "a listen in the browser's wire form is heard");
        RPCMessage stopRpc = (RPCMessage) wire.create(foam.lib.json.JSONParser.class).parseString(
          "{\\"class\\":\\"foam.box.RPCMessage\\",\\"name\\":\\"cmd_\\",\\"args\\":[null,{\\"class\\":\\"foam.dao.StopListeningCmd\\",\\"name\\":\\"41\\"}]}");
        skeleton.send(new Envelope(wire, stopRpc, recorder(reply, false)));
        dao.put(row(x, 9));
        test(fromBrowser.size() == 1, "and the browser's StopListeningCmd for name 41 stops it");

        // no connection list (HTTP, a server-side call): listen works as before
        List plain = new ArrayList();
        call(x, skeleton, "listen_", clientSink(x, "11", recorder(plain, false)), reply);
        dao.put(row(x, 7));
        test(plain.size() == 1, "without a connection list a listen is untouched and hears");
      `
    }
  ]
});
