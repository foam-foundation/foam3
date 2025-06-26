/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.app',
  name: 'HealthHeartbeatService',

  documentation: 'Health check broadcaster and listener.',

  implements: [
    'foam.lang.ContextAgent',
    'foam.lang.ContextAware',
    'foam.core.COREService'
  ],

  javaImports: [
    'foam.lang.Agency',
    'foam.lang.ContextAgentTimerTask',
    'foam.lang.ContextAgent',
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.dao.DAO',
    'foam.lib.formatter.FObjectFormatter',
    'foam.lib.formatter.JSONFObjectFormatter',
    'foam.lib.json.JSONParser',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.pm.PM',
    'foam.net.Port',
    'java.io.IOException',
    'java.net.DatagramPacket',
    'java.net.DatagramSocket',
    'java.net.InetAddress',
    'java.net.InetSocketAddress',
    'java.net.MulticastSocket',
    'java.util.Timer'
  ],

  properties: [
    {
      name: 'timerInterval',
      class: 'Long',
      value: 3000,
      units: 'ms'
    },
    {
      name: 'initialTimerDelay',
      class: 'Long',
      value: 5000,
      units: 'ms'
    },
    {
      name: 'port',
      class: 'Int'
    },
    {
      documentation: 'Some environments like AWS prefer different send/receive ports for UDP broadcasts. Value 0 will default to system selected port.',
      name: 'sendPort',
      class: 'Int',
      value: 0
    },
    {
      name: 'multicastAddress',
      class: 'String'
    },
    {
      documentation: 'Evironments such as AWS do not support multicast',
      name: 'useMulticast',
      class: 'Boolean',
      value: true
    },
    {
      name: 'timer',
      class: 'Object',
      transient: true,
      visibility: 'HIDDEN'
    },
    {
      name: 'formatter',
      class: 'Object',
      javaFactory: `
      JSONFObjectFormatter formatter = new JSONFObjectFormatter();
      // Each healthDAO holds a particular 'of'. Not outputting class
      // allows the parser to create the model appropriate for its DAO.
      formatter.setOutputClassNames(false);
      formatter.setOutputDefaultClassNames(false);
      formatter.setOutputShortNames(true);
      formatter.setPropertyPredicate(new foam.lib.ClusterPropertyPredicate());
      return formatter;
      `,
      transient: true,
      visibility: 'HIDDEN'
    }
  ],

  methods: [
    {
      name: 'start',
      javaCode: `
      if ( "localhost".equals(System.getProperty("hostname", "localhost")) ) {
        Loggers.logger(getX(), this).info("broadcaster", "start", getMulticastAddress(), getSendPort(), getPort(), "disabled on localhost");
        return;
      }
      Loggers.logger(getX(), this).info("broadcaster", "start", "multicast", getUseMulticast(), getMulticastAddress(), getSendPort(), getPort());
      Agency agency = (Agency) getX().get("threadPool");
      agency.submit(getX(), this, this.getClass().getSimpleName());

      Timer timer = new Timer(this.getClass().getSimpleName(), true);
      setTimer(timer);
      timer.scheduleAtFixedRate(
        new ContextAgentTimerTask(getX(),
          new ContextAgent() {
            public void execute(X x) {
              PM pm = PM.create(x, "HealthHeartbeatService", "broadcaster");
              Health health = (Health) x.get("Health");
              health.setHeartbeatTime(System.currentTimeMillis());
              health.setHeartbeatSchedule(getTimerInterval());
              FObjectFormatter formatter = (FObjectFormatter) getFormatter();
              formatter.reset();
              formatter.output(health);
              String data = formatter.builder().toString();
              // ((Logger) x.get("logger")).debug("HealthHeartbeatService", "broadcaster", "broadcasting", data);
              byte[] buf = data.getBytes();

              DatagramSocket socket = null;
              try {
                if ( getSendPort() == 0 ) {
                  socket = new DatagramSocket();
                } else {
                  socket = new DatagramSocket(getSendPort());
                }
                DatagramPacket[] packets = getPackets(x, data);
                for ( DatagramPacket packet : packets ) {
                  try {
                    socket.send(packet);
                  } catch ( IOException e ) {
                    if ( "Host is down".equals(e.getMessage()) ) {
                      ((Logger) x.get("logger")).debug("HealthHeartbeatService", "broadcasting", packet.getAddress()+":"+packet.getPort(), e.getMessage());
                    } else {
                      ((Logger) x.get("logger")).warning("HealthHeartbeatService", "broadcasting", packet.getAddress()+":"+packet.getPort(), data, e.getMessage());
                    }
                  }
                }
              } catch ( IOException e ) {
                ((Logger) x.get("logger")).error("HealthHeartbeatService", "broadcasting", data, e.getMessage(), e);
              } finally {
                if ( socket != null ) socket.close();
                pm.log(x);
              }
            }
          }
        ),
        getInitialTimerDelay(),
        getTimerInterval()
      );
      `
    },
    {
      name: 'execute',
      javaCode: `
      Logger logger = Loggers.logger(x, this);
      logger.info("listener", "start", "multicast", getUseMulticast(), getMulticastAddress(), getPort());
      byte[] buf = new byte[512];
      MulticastSocket socket = null;
      InetAddress group = null;
      FObject self = (FObject) x.get("Health");

      try {
        socket = new MulticastSocket(getPort());
        group = InetAddress.getByName(getMulticastAddress());
        socket.joinGroup(group);
        while (true) {
          DatagramPacket packet = new DatagramPacket(buf, buf.length);
          socket.receive(packet);
          long now = System.currentTimeMillis();
          PM pm = PM.create(x, "HealthHeartbeatService", "listener");

          String received = new String(
            packet.getData(), 0, packet.getLength());
          // logger.debug("listener", "received", received);
          try {
            Health health = (Health) x.create(JSONParser.class).parseString(received, self.getClass());
            // NOTE: NOT ignoring broadcast from self as this gives us our own IP address.
            InetSocketAddress sender = (InetSocketAddress) packet.getSocketAddress();
            String address = sender.getAddress().toString();
            if ( address.startsWith("/") ) {
              // typically missing hostname
              address = address.substring(1);
            }
            health.setAddress(address);
            health.setPropogationTime(Math.abs(now - health.getHeartbeatTime()));
            ((DAO) x.get("healthDAO")).put_(x, health);
          } catch ( NullPointerException e ) {
            logger.warning("listener", "received", received, e.getMessage());
          } catch ( ClassCastException e ) {
            logger.debug("listener", "received", received, e.getMessage(), e);
          } catch ( RuntimeException e ) {
            logger.warning("listener", "received", received, e.getMessage(), e);
          } finally {
            pm.log(x);
          }
        }
      } catch ( IOException e ) {
        logger.warning("listener", "exit", e.getMessage(), e);
      } finally {
        if ( socket != null ) {
          try {
            socket.leaveGroup(group);
            socket.close();
          } catch ( IOException e ) {
            // nop
          }
        }
      }
      `
    },
    {
      name: 'getPackets',
      args: 'X x, String data',
      javaType: 'java.net.DatagramPacket[]',
      javaThrows: [ 'java.io.IOException' ],
      javaCode: `
        if ( getUseMulticast() ) {
          byte[] buf = data.getBytes();
          return new DatagramPacket[] { new DatagramPacket(buf, buf.length, InetAddress.getByName(getMulticastAddress()), getPort()) };
        }
        throw new UnsupportedOperationException("getSockets");
      `
    }
  ]
});
