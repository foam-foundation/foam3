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
    'java.net.NetworkInterface',
    'java.util.ArrayList',
    'java.util.List',
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
      documentation: `How heartbeats are delivered and received. BROADCAST
        (default) multicasts to the group on the OS default interface.
        LOOPBACK multicasts but pins the loopback interface, for several
        instances on one host (local dev) where a VPN would otherwise swallow
        the multicast. DIRECT unicasts to each peer from getPeers(), for
        environments such as AWS that do not support multicast.`,
      name: 'mode',
      class: 'Enum',
      of: 'foam.core.app.HeartbeatMode',
      value: 'BROADCAST'
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
      if ( getMode() == HeartbeatMode.DIRECT ) {
        // DIRECT does not use the UDP heartbeat. Unicast-to-peers cannot reach
        // a monitor that has no peers, and a sender never hears its own packet,
        // so health would never populate. In DIRECT, HealthHeartbeatMonitor
        // polls each peer's /service/health over HTTPS instead. Leave the UDP
        // sender and listener stopped.
        Loggers.logger(getX(), this).info("broadcaster", "start", getMode().getName(), "UDP heartbeat disabled for DIRECT; HealthHeartbeatMonitor polls /service/health");
        return;
      }
      Loggers.logger(getX(), this).info("broadcaster", "start", getMode().getName(), getMulticastAddress(), getSendPort(), getPort());
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
              sendHealth(x, health);
              pm.log(x);
            }
          }
        ),
        getInitialTimerDelay(),
        getTimerInterval()
      );
      `
    },
    {
      documentation: `COREService stop, called by CSpecFactory.shutdown() on a
        graceful JVM shutdown. Cancel the periodic heartbeat and send one final
        DOWN heartbeat, so a monitor records this instance as intentionally down
        instead of waiting for missed heartbeats to time out. Best-effort: never
        let heartbeat trouble hold up shutdown.`,
      name: 'stop',
      javaCode: `
      Timer timer = (Timer) getTimer();
      if ( timer != null ) {
        timer.cancel();
        clearTimer();
      }
      if ( "localhost".equals(System.getProperty("hostname", "localhost")) ) {
        return;
      }
      try {
        X x = getX();
        Health health = (Health) x.get("Health");
        health.setStatus(HealthStatus.DOWN);
        health.setHeartbeatTime(System.currentTimeMillis());
        sendHealth(x, health);
        Loggers.logger(x, this).info("broadcaster", "stop", "sent DOWN", getMode().getName());
      } catch ( Throwable t ) {
        Loggers.logger(getX(), this).warning("broadcaster", "stop", t.getMessage());
      }
      `
    },
    {
      documentation: `Re-evaluate the mode after a config change. DIRECT keeps the
        UDP heartbeat disabled (start() returns early); any other mode (re)starts
        the sender timer and listener. Caveat: the listener loop blocks on
        receive with no interrupt, so a listener already running from a prior
        non-DIRECT start is not torn down here -- a redundant submit just fails
        to bind and exits, and a switch INTO DIRECT stops the sender but leaves
        the now-idle listener until the next restart. The clean transition is
        OUT of DIRECT, which starts polling-free UDP heartbeating again.`,
      name: 'reload',
      javaCode: `
      Timer timer = (Timer) getTimer();
      if ( timer != null ) {
        timer.cancel();
        clearTimer();
      }
      try {
        start();
      } catch ( Exception e ) {
        Loggers.logger(getX(), this).warning("reload", e.getMessage());
      }
      `
    },
    {
      name: 'execute',
      javaCode: `
      Logger logger = Loggers.logger(x, this);
      logger.info("listener", "start", getMode().getName(), getMulticastAddress(), getPort());
      byte[] buf = new byte[512];
      DatagramSocket socket = null;
      MulticastSocket mcastSocket = null;
      InetSocketAddress groupAddr = null;
      FObject self = (FObject) x.get("Health");

      try {
        if ( getMode() == HeartbeatMode.DIRECT ) {
          // Unicast: no group to join, just bind the port and receive.
          socket = new DatagramSocket(getPort());
        } else {
          mcastSocket = new MulticastSocket(getPort());
          InetAddress group = InetAddress.getByName(getMulticastAddress());
          if ( getMode() == HeartbeatMode.LOOPBACK ) {
            groupAddr = new InetSocketAddress(group, getPort());
            mcastSocket.joinGroup(groupAddr, getLoopbackInterface());
          } else {
            // BROADCAST: default interface, deprecated join preserves the
            // original interface-selection behaviour exactly.
            mcastSocket.joinGroup(group);
            groupAddr = new InetSocketAddress(group, getPort());
          }
          socket = mcastSocket;
        }
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
        if ( mcastSocket != null && groupAddr != null ) {
          try {
            if ( getMode() == HeartbeatMode.LOOPBACK ) {
              mcastSocket.leaveGroup(groupAddr, getLoopbackInterface());
            } else {
              mcastSocket.leaveGroup(groupAddr.getAddress());
            }
          } catch ( IOException e ) {
            // nop
          }
        }
        if ( socket != null ) socket.close();
      }
      `
    },
    {
      documentation: `Format a Health and send it as a heartbeat, honouring the
        current mode. Shared by the periodic broadcaster and by stop()'s final
        DOWN heartbeat.`,
      name: 'sendHealth',
      args: 'X x, foam.core.app.Health health',
      javaCode: `
        FObjectFormatter formatter = (FObjectFormatter) getFormatter();
        formatter.reset();
        formatter.output(health);
        String data = formatter.builder().toString();

        DatagramSocket socket = null;
        try {
          socket = createSendSocket();
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
        }
      `
    },
    {
      name: 'getPackets',
      args: 'X x, String data',
      javaType: 'java.net.DatagramPacket[]',
      javaThrows: [ 'java.io.IOException' ],
      javaCode: `
        byte[] buf = data.getBytes();
        if ( getMode() == HeartbeatMode.DIRECT ) {
          // One unicast packet per peer. getPeers is empty in foam3 core;
          // foam-saf refines it to return the enabled SAF peers.
          List peers = getPeers(x);
          DatagramPacket[] packets = new DatagramPacket[peers.size()];
          for ( int i = 0 ; i < peers.size() ; i++ ) {
            packets[i] = new DatagramPacket(buf, buf.length, (InetSocketAddress) peers.get(i));
          }
          return packets;
        }
        // BROADCAST and LOOPBACK both address the multicast group; LOOPBACK
        // pins the egress interface on the socket (see createSendSocket), it
        // does not change the destination address.
        return new DatagramPacket[] { new DatagramPacket(buf, buf.length, InetAddress.getByName(getMulticastAddress()), getPort()) };
      `
    },
    {
      documentation: `DIRECT-mode unicast targets, one InetSocketAddress per
        peer. Empty in foam3 core so DIRECT sends nowhere on its own; a
        deployment that uses DIRECT refines this (foam-saf does, from its
        enabled SAFConfigs) to supply the peers.`,
      name: 'getPeers',
      args: 'X x',
      javaType: 'java.util.List',
      javaCode: `
        return new ArrayList();
      `
    },
    {
      documentation: `The loopback NetworkInterface, resolved portably (lo0 on
        macOS, lo on Linux) so LOOPBACK mode needs no hardcoded interface name.`,
      name: 'getLoopbackInterface',
      javaType: 'java.net.NetworkInterface',
      javaThrows: [ 'java.io.IOException' ],
      javaCode: `
        return NetworkInterface.getByInetAddress(InetAddress.getLoopbackAddress());
      `
    },
    {
      documentation: `The send socket for the current mode. LOOPBACK needs a
        MulticastSocket with its interface pinned to loopback so the group
        packet egresses lo0; BROADCAST and DIRECT use a plain DatagramSocket.`,
      name: 'createSendSocket',
      javaType: 'java.net.DatagramSocket',
      javaThrows: [ 'java.io.IOException' ],
      javaCode: `
        if ( getMode() == HeartbeatMode.LOOPBACK ) {
          MulticastSocket socket = getSendPort() == 0
            ? new MulticastSocket()
            : new MulticastSocket(getSendPort());
          socket.setNetworkInterface(getLoopbackInterface());
          return socket;
        }
        return getSendPort() == 0
          ? new DatagramSocket()
          : new DatagramSocket(getSendPort());
      `
    }
  ]
});
