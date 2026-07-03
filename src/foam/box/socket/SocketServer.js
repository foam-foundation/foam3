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
    'java.io.IOException',
    'java.net.ServerSocket',
    'java.net.Socket',
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
      name: 'start',
      javaCode: `
        final Logger logger = Loggers.logger(getX(), this, "port", String.valueOf(getPort()));
        try {
          ServerSocket serverSocket0 = null;
          SslContextFactory contextFactory = (SslContextFactory) getX().get("sslContextFactory");

          if ( contextFactory != null && contextFactory.getEnableSSL() ) {
            SSLServerSocket sslServerSocket = (SSLServerSocket) contextFactory.getSSLContext(getX()).getServerSocketFactory().createServerSocket(getPort());
            sslServerSocket.setNeedClientAuth(true);
            serverSocket0 = sslServerSocket;
          } else {
            serverSocket0 = new ServerSocket(getPort());
          }

          final ServerSocket serverSocket = serverSocket0;

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
              logger.error("SocketServer.accept-" + getPort() + " terminate", ioe);
            } catch ( Exception e) {
              logger.error("SocketServer.accept-" + getPort() + " terminate", e);
            }
          }, "SocketServer.accept-"  + getPort());
          serverThread.setDaemon(true);
          serverThread.setPriority(Thread.MAX_PRIORITY);
          serverThread.start();

        } catch (java.net.BindException e) {
          logger.error(e.getMessage(), e);
          System.exit(1);
        } catch ( Exception e ) {
          logger.error(e);
        }
      `
    }
  ]
});
