/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.jetty.test',
  name: 'BindAddressTest',
  extends: 'foam.core.test.Test',

  documentation: 'bindAddress limits HttpServer and SocketServer to one address; empty listens on every address.',

  javaImports: [
    'foam.box.socket.SocketServer',
    'foam.core.boot.CSpec',
    'foam.core.jetty.HttpServer',
    'foam.core.jetty.IPAccess',
    'foam.dao.MDAO',
    'java.net.InetAddress',
    'java.net.InetSocketAddress',
    'java.net.ServerSocket',
    'java.net.UnknownHostException',
    'java.nio.channels.ServerSocketChannel',
    'org.eclipse.jetty.server.ServerConnector'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
      String saved = System.getProperty("http.bindAddress");
      String savedSocket = System.getProperty("socket.bindAddress");
      System.clearProperty("http.bindAddress");
      System.clearProperty("socket.bindAddress");
      try {
        test(httpBoundTo(x, "127.0.0.1").isLoopbackAddress(), "HttpServer with bindAddress 127.0.0.1 listens on a loopback address");
        test(httpBoundTo(x, "").isAnyLocalAddress(), "HttpServer with an empty bindAddress listens on every address");
        test(socketBoundTo(x, "127.0.0.1").isLoopbackAddress(), "SocketServer with bindAddress 127.0.0.1 listens on a loopback address");
        test(socketBoundTo(x, "").isAnyLocalAddress(), "SocketServer with an empty bindAddress listens on every address");

        SocketServer bad = new SocketServer();
        bad.setX(x);
        bad.setBindAddress("127.0.0.l");
        boolean unknownHost = false;
        try { bad.openServerSocket(); } catch ( UnknownHostException e ) { unknownHost = true; } catch ( Exception e ) { /* wrong exception */ }
        test(unknownHost, "SocketServer with an unparseable bindAddress throws UnknownHostException, which start() treats like a port in use");

        HttpServer badHttp = new HttpServer();
        badHttp.setBindAddress("127.0.0.l");
        boolean httpUnknownHost = false;
        try { badHttp.resolveBindAddress(); } catch ( UnknownHostException e ) { httpUnknownHost = true; } catch ( Exception e ) { /* wrong exception */ }
        test(httpUnknownHost, "HttpServer with an unparseable bindAddress throws UnknownHostException, which start() treats as fatal");

        test(! unownedAddressBinds(x), "HttpServer with a bindAddress this machine does not own reports that it cannot bind, so start() exits");

        test(new HttpServer().getBindAddress().isEmpty(), "HttpServer bindAddress is empty by default");
        test(new SocketServer().getBindAddress().isEmpty(), "SocketServer bindAddress is empty by default");
        System.setProperty("http.bindAddress", "127.0.0.1");
        test("127.0.0.1".equals(new HttpServer().getBindAddress()), "HttpServer reads http.bindAddress");
        test(new SocketServer().getBindAddress().isEmpty(), "SocketServer ignores http.bindAddress");
        System.setProperty("socket.bindAddress", "127.0.0.1");
        test("127.0.0.1".equals(new SocketServer().getBindAddress()), "SocketServer reads socket.bindAddress");
      } finally {
        restore("http.bindAddress", saved);
        restore("socket.bindAddress", savedSocket);
      }
      `
    },
    {
      name: 'restore',
      args: [ { name: 'key', type: 'String' }, { name: 'value', type: 'String' } ],
      javaCode: `
      if ( value == null ) System.clearProperty(key);
      else System.setProperty(key, value);
      `
    },
    {
      name: 'unownedAddressBinds',
      type: 'Boolean',
      args: [ { name: 'x', type: 'Context' } ],
      documentation: 'Starts a Jetty server whose connector listens on 192.0.2.1, a documentation address no machine owns, and answers whether HttpServer.startListening says it bound.',
      javaCode: `
      HttpServer http = new HttpServer();
      http.setX(x);
      http.setBindAddress("192.0.2.1");
      org.eclipse.jetty.server.Server jetty = new org.eclipse.jetty.server.Server();
      ServerConnector connector = new ServerConnector(jetty);
      connector.setPort(0);
      connector.setHost("192.0.2.1");
      jetty.addConnector(connector);
      try {
        return http.startListening(jetty);
      } catch ( Exception e ) {
        return true;
      } finally {
        try { jetty.stop(); } catch ( Exception e ) { /* test cleanup */ }
      }
      `
    },
    {
      name: 'httpBoundTo',
      type: 'InetAddress',
      args: [ { name: 'x', type: 'Context' }, { name: 'address', type: 'String' } ],
      documentation: 'Starts an HttpServer on a port the system picks and answers the address its listening channel is bound to.',
      javaCode: `
      CSpec spec = new CSpec();
      spec.setId("bindAddressTestHttp");
      // Each start adds a listener to jettyIPAccessDAO: give it a store of its own so the listener goes with the test.
      foam.lang.X testX = x.put("jettyIPAccessDAO", new MDAO(IPAccess.getOwnClassInfo()));
      HttpServer server = new HttpServer();
      server.setX(testX);
      server.setCSpec(spec);
      server.setEnableWebsockets(false);
      server.setPort(0);
      server.setBindAddress(address);
      org.eclipse.jetty.server.Server jetty = null;
      try {
        server.start();
        jetty = (org.eclipse.jetty.server.Server) server.getServer();
        ServerConnector connector = (ServerConnector) jetty.getConnectors()[0];
        return ((InetSocketAddress) ((ServerSocketChannel) connector.getTransport()).getLocalAddress()).getAddress();
      } catch ( Exception e ) {
        throw new RuntimeException(e);
      } finally {
        try { if ( jetty != null ) jetty.stop(); } catch ( Exception e ) { /* test cleanup */ }
      }
      `
    },
    {
      name: 'socketBoundTo',
      type: 'InetAddress',
      args: [ { name: 'x', type: 'Context' }, { name: 'address', type: 'String' } ],
      documentation: 'Starts a SocketServer on a port the system picks and answers the address its socket is bound to.',
      javaCode: `
      SocketServer server = new SocketServer();
      server.setX(x);
      test(x.get(server.getThreadPoolName()) != null, "the test context has the thread pool agent " + server.getThreadPoolName() + ", which SocketServer.start needs");
      server.setPort(0);
      server.setBindAddress(address);
      ServerSocket socket = null;
      try {
        try { server.start(); } catch ( Exception e ) { throw new RuntimeException(e); }
        socket = server.getServerSocket();
        return socket.getInetAddress();
      } finally {
        try { if ( socket != null ) socket.close(); } catch ( java.io.IOException e ) { /* test cleanup */ }
      }
      `
    }
  ]
});
