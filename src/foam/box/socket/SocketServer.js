/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.box.socket',
  name: 'SocketServer',

  documentation: 'Waits on the socket connection for requests, passing them off to a SocketServerProcessor.',

  implements: [
    'foam.core.COREService'
  ],

  javaImports: [
    'foam.box.Box',
    'foam.lang.Agency',
    'foam.lang.ContextAgent',
    'foam.lang.X',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.net.Port',
    'foam.util.SafetyUtil',
    'java.io.IOException',
    'java.net.BindException',
    'java.net.InetAddress',
    'java.net.ServerSocket',
    'java.net.Socket',
    'java.net.UnknownHostException',
    'javax.net.ssl.SSLContext',
    'javax.net.ssl.SSLServerSocket'
  ],

  properties: [
    {
      class: 'Int',
      name: 'port',
      javaFactory: 'return Port.get(getX(), "SocketServer");'
    },
    {
      class: 'String',
      name: 'bindAddress',
      documentation: 'The one address the socket server listens on, for example 127.0.0.1 so only this machine can connect. Empty listens on every address. The system property socket.bindAddress sets the default. This moves the socket server only, which cluster nodes also use to reach each other: a cluster or Docker setup leaves it empty. For a server only this computer can reach, set http.bindAddress and socket.bindAddress together.',
      javaFactory: `return System.getProperty("socket.bindAddress", "");`
    },
    {
      documentation: 'The listening socket, kept so a caller can read its address or close it.',
      class: 'Object',
      name: 'serverSocket',
      flags: ['java'],
      javaType: 'java.net.ServerSocket',
      hidden: true,
      transient: true
    },
    {
      class: 'String',
      name: 'threadPoolName',
      value: 'boxThreadPool'
    },
    {
      documentation: 'So not to block server shutdown, have sockets timeout. Catch and continue on SocketTimeoutException.',
      class: 'Int',
      name: 'soTimeout',
      value: 60000
    },
    {
      class: 'Boolean',
      name: 'useThreadPoolForConnection',
      value: true
    }
  ],

  methods: [
    {
      name: 'openServerSocket',
      type: 'ServerSocket',
      javaThrows: ['java.lang.Exception'],
      documentation: 'Opens the listening socket on the port and bindAddress, with SSL when the context factory enables it. Throws UnknownHostException for an address that cannot be parsed and BindException when the address or port cannot be used.',
      javaCode: `
        InetAddress address = SafetyUtil.isEmpty(getBindAddress()) ? null : InetAddress.getByName(getBindAddress());
        SslContextFactory contextFactory = (SslContextFactory) getX().get("sslContextFactory");

        // Backlog 0 is Java's default of 50.
        if ( contextFactory != null && contextFactory.getEnableSSL() ) {
          SSLServerSocket sslServerSocket = (SSLServerSocket) contextFactory.getSSLContext(getX()).getServerSocketFactory().createServerSocket(getPort(), 0, address);
          sslServerSocket.setNeedClientAuth(true);
          return sslServerSocket;
        }
        return new ServerSocket(getPort(), 0, address);
      `
    },
    {
      name: 'start',
      javaCode: `
        final Logger logger = Loggers.logger(getX(), this, "port", String.valueOf(getPort()));
        try {
          final ServerSocket serverSocket = openServerSocket();
          setServerSocket(serverSocket);

          Agency agency = (Agency) getX().get(getThreadPoolName());
          final X x_ = getX();
          logger.info("start", "threadPoolName", getThreadPoolName(), "threadsPerCore", ((foam.core.pool.AbstractFixedThreadPool) agency).getThreadsPerCore(), "numberOfThreads", ((foam.core.pool.AbstractFixedThreadPool) agency).getNumberOfThreads());
          Thread serverThread = new Thread(() -> {
            try {
              while ( true ) {
                Socket client = serverSocket.accept();
                client.setSoTimeout(getSoTimeout());

                if ( getUseThreadPoolForConnection() ) {
                  agency.submit(
                    x_,
                    new SocketServerProcessor(x_, client),
                    client.getRemoteSocketAddress().toString()
                  );
                } else {
                  Thread acceptThread = new Thread(() -> {
                    try {
                      SocketServerProcessor processor = new SocketServerProcessor(x_, client);
                      processor.execute(x_);
                    } catch ( IOException ioe ) {
                      logger.error("Accept failed", client.getRemoteSocketAddress(), ioe);
                    }
                  }, client.getRemoteSocketAddress().toString());
                  acceptThread.setDaemon(true);
                  acceptThread.start();
                }
              }
            } catch ( IOException ioe ) {
              // Closing the socket ends accept; only an unexpected failure is an error.
              if ( ! serverSocket.isClosed() ) logger.error("SocketServer.accept-" + getPort() + " terminate", ioe);
            } catch ( Exception e) {
              logger.error("SocketServer.accept-" + getPort() + " terminate", e);
            }
          }, "SocketServer.accept-"  + getPort());
          serverThread.setDaemon(true);
          serverThread.setPriority(Thread.MAX_PRIORITY);
          serverThread.start();

        } catch ( UnknownHostException e ) {
          // An address that is not an address stops the server: it cannot listen where it was told to.
          logger.error("bindAddress is not a valid address: " + getBindAddress(), e);
          System.exit(1);
        } catch ( BindException e ) {
          // A port in use stops the server for the same reason.
          logger.error(e.getMessage(), e);
          System.exit(1);
        } catch ( Exception e ) {
          logger.error(e);
        }
      `
    }
  ]
});
