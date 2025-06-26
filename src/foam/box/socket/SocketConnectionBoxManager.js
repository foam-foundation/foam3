/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.box.socket',
  name: 'SocketConnectionBoxManager',

  documentation: 'Manages Socket boxes, providing reuse of established connections for send and receive.',
  
  implements: [
    'foam.core.COREService'
  ],

  javaImports: [
    'foam.box.Box',
    'foam.lang.Agency',
    'foam.lang.ContextAgent',
    'foam.lang.X',
    'foam.core.logger.PrefixLogger',
    'foam.core.logger.Logger',
    'java.io.IOException',
    'java.net.ConnectException',
    'java.net.InetSocketAddress',
    'java.net.Socket',
    'java.net.SocketAddress',
    'java.net.SocketException',
    'java.net.SocketTimeoutException',
    'javax.net.ssl.SSLContext',
    'javax.net.ssl.SSLSocket',
    'javax.net.ssl.SSLSocketFactory'
  ],

  properties: [
    {
      documentation: 'Create a Box per nspec service rather than one socket for all services to a particular host:port',
      class: 'Boolean',
      name: 'boxPerService'
    },
    {
      documentation: 'So not to block server shutdown, have sockets timeout. Catch and continue on SocketTimeoutException.',
      class: 'Int',
      name: 'soTimeout',
      value: 60000
    },
    {
      documentation: 'Time to wait on initial creation for connection to be established',
      class: 'Int',
      name: 'connectTimeout',
      value: 10000
    },
    {
      class: 'String',
      name: 'threadPoolName',
      value: 'boxThreadPool'
    },
    {
      class: 'Map',
      name: 'boxes',
      javaFactory: `
        return java.util.Collections.synchronizedMap(new java.util.HashMap());
      `,
      transient: true,
      visibility: 'HIDDEN'
    },
    {
      name: 'logger',
      class: 'FObjectProperty',
      of: 'foam.core.logger.Logger',
      visibility: 'HIDDEN',
      transient: true,
      javaCloneProperty: '//noop',
      javaFactory: `
        return new PrefixLogger(new Object[] {
          this.getClass().getSimpleName()
        }, (Logger) getX().get("logger"));
      `
    }
  ],

  methods: [
    {
      name: 'add',
      args: [
        {
          name: 'box',
          type: 'SocketConnectionBox'
        }
      ],
      javaCode: `
      getBoxes().put(box.getKey(), box);
      `
    },
    {
      name: 'remove',
      args: [
        {
          name: 'box',
          type: 'SocketConnectionBox'
        }
      ],
      javaCode: `
      if ( box != null ) {
        getBoxes().remove(box.getKey());

        Socket socket = (Socket) box.getSocket();
        if ( socket != null &&
             socket.isConnected() ) {
          try {
            socket.getOutputStream().flush();
          } catch (IOException e) {
            // nop
          }
          try {
            getLogger().debug("socket,close",socket.getRemoteSocketAddress());
            socket.close();
          } catch (IOException e) {
            // nop
          }
        }
      }
      `
    },
    {
      name: 'makeKey',
      type: 'String',
      args: [
        {
          name: 'host',
          type: 'String'
        },
        {
          name: 'port',
          type: 'int'
        },
        {
          name: 'serviceName',
          type: 'String'
        }
      ],
      javaCode: `
        StringBuilder sb = new StringBuilder();
        sb.append(host);
        sb.append(":");
        sb.append(port);
        if ( getBoxPerService() ) {
          sb.append(":");
          sb.append(serviceName);
        }
        return sb.toString();
      `
    },
    {
      name: 'get',
      synchronized: true,
      type: 'foam.box.Box',
      args: [
        {
          name: 'x',
          type: 'X'
        },
        {
          name: 'host',
          type: 'String'
        },
        {
          name: 'port',
          type: 'int'
        },
        {
          name: 'serviceName',
          type: 'String'
        }
      ],
      javaCode: `
        String key = makeKey(host, port, serviceName);
        SocketConnectionBox box = (SocketConnectionBox) getBoxes().get(key);
        if ( box != null ) {
          return box;
        }

        try {
          Socket socket = null;
          SslContextFactory contextFactory = (SslContextFactory) getX().get("sslContextFactory");

          if ( contextFactory != null && contextFactory.getEnableSSL() ) {
            SSLContext sslContext = contextFactory.getSSLContext();
            socket = (SSLSocket)sslContext.getSocketFactory().createSocket();
          } else {
            socket = new Socket();
          }

          socket.setSoTimeout(getSoTimeout());
          SocketAddress address = new InetSocketAddress(host, port);
          socket.connect(address, getConnectTimeout());
          box = new SocketConnectionBox(x, key, socket);
          add(box);

          final SocketConnectionBox b = box;
          final X x_ = x;
          Thread thread = new Thread(() -> {
            b.execute(x_);
          }, socket.getRemoteSocketAddress().toString());
          thread.setDaemon(true);
          thread.start();
          
          return box;
        } catch ( java.net.ConnectException |
                   java.net.NoRouteToHostException |
                   java.net.UnknownHostException e ) {
          remove(box);
          getLogger().warning(key, e.getClass().getSimpleName(), e.getMessage());
          throw new RuntimeException(e);
        } catch ( Throwable t ) { // All other IOExceptions
          remove(box);
          getLogger().error(key, t.getClass().getSimpleName(), t.getMessage(), t);
          throw new RuntimeException(t);
        }
      `
    },
    {
      name: 'getReplyBox',
      type: 'foam.box.Box',
      synchronized: true,
      args: [
        {
          name: 'x',
          type: 'X'
        },
        {
          name: 'key',
          type: 'String'
        },
      ],
      javaCode: `
      Box box = (Box) getBoxes().get(key);
      if ( box != null ) {
        return box;
      }

      box = new SocketConnectionReplyBox(x, key);
      getBoxes().put(key, box);
      return box;
      `
    },
    {
      name: 'removeReplyBox',
      args: [
        {
          name: 'box',
          type: 'SocketConnectionReplyBox'
        }
      ],
      javaCode: `
      getBoxes().remove(box.getKey());
      `
    },
    {
      name: 'start',
      javaCode: `
        return;
      `
    }
  ]
});

