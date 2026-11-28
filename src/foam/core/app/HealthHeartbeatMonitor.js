/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.app',
  name: 'HealthHeartbeatMonitor',

  documentation: 'Mark system unhealthy if # heartbeats missed.',

  implements: [
    'foam.lang.ContextAgent',
    'foam.lang.ContextAware',
    'foam.core.COREService'
  ],

  javaImports: [
    'foam.core.alarming.Alarm',
    'foam.core.alarming.AlarmReason',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.pm.PM',
    'foam.dao.DAO',
    'foam.dao.Sink',
    'foam.lang.Agency',
    'foam.lang.ContextAgentTimerTask',
    'foam.lang.ContextAgent',
    'foam.lang.Detachable',
    'foam.lang.X',
    'static foam.mlang.MLang.EQ',
    'static foam.mlang.MLang.NEQ',
    'foam.box.socket.SslContextFactory',
    'foam.lib.json.JSONParser',
    'foam.net.Port',
    'java.io.BufferedReader',
    'java.io.InputStreamReader',
    'java.nio.charset.StandardCharsets',
    'java.net.InetSocketAddress',
    'java.net.URL',
    'java.util.List',
    'java.util.Timer',
    'javax.net.ssl.HostnameVerifier',
    'javax.net.ssl.HttpsURLConnection',
    'javax.net.ssl.SSLContext',
    'javax.net.ssl.SSLSession'
  ],

  properties: [
    {
      documentation: 'Set status to MAINT if this many heartbeats are missed.',
      name: 'missed',
      class: 'Int',
      value: 2
    },
    {
      name: 'unhealthyStatus',
      class: 'Enum',
      of: 'foam.core.app.HealthStatus',
      value: 'FAIL'
    },
    {
      name: 'timerInterval',
      class: 'Long',
      value: 2000,
      units: 'ms'
    },
    {
      name: 'initialTimerDelay',
      class: 'Long',
      value: 60000,
      units: 'ms'
    },
    {
      name: 'timer',
      class: 'Object',
      hidden: true,
      transient: true
    }
  ],

  methods: [
    {
      name: 'start',
      javaCode: `
      if ( "localhost".equals(System.getProperty("hostname", "localhost")) ) {
        Loggers.logger(getX(), this).info("start, disabled on localhost");
        return;
      }
      Loggers.logger(getX(), this).info("start");
      Timer timer = new Timer(this.getClass().getSimpleName(), true);
      timer.scheduleAtFixedRate(
        new ContextAgentTimerTask(getX(), this),
        getInitialTimerDelay(),
        getTimerInterval()
      );
      setTimer(timer);
      `
    },
    {
      name: 'reload',
      javaCode: `
      if ( "localhost".equals(System.getProperty("hostname", "localhost")) ) {
        Loggers.logger(getX(), this).info("reload, disabled on localhost");
        return;
      }
      Loggers.logger(getX(), this).info("reload");
      Timer timer = (Timer) getTimer();
      if ( timer != null ) {
        timer.cancel();
      }
      timer = new Timer(this.getClass().getSimpleName(), true);
      timer.scheduleAtFixedRate(
        new ContextAgentTimerTask(getX(), this),
        getTimerInterval(),
        getTimerInterval()
      );
      setTimer(timer);
      `
    },
    {
      name: 'execute',
      javaCode: `
      final Logger logger = Loggers.logger(x, this);

      HealthHeartbeatService service = (HealthHeartbeatService) x.get("healthHeartbeatService");
      if ( service != null && service.getMode() == HeartbeatMode.DIRECT ) {
        // DIRECT has no UDP heartbeat to listen for; actively poll each peer's
        // /service/health over HTTPS to populate healthDAO instead.
        pollPeers(x, service);
        return;
      }

      HealthSupport healthSupport = (HealthSupport) x.get("healthSupport");
      Health self = healthSupport.getLocalHealth(x);
      ((DAO) x.get("healthDAO"))
      .where(
        NEQ(Health.ID, self.getId())
      )
      .select(
        new Sink() {
          public void put(Object obj, Detachable sub) {
            Health health = (Health) obj;
            if ( health.getHeartbeatTime() == 0 ) return;

            if ( health.getStatus() == HealthStatus.DOWN ||
                 health.getStatus() == HealthStatus.FAIL )
              return;

            DAO alarmDAO = (DAO) x.get("alarmDAO");
            String name = "Heartbeat missed - "+health.toSummary();
            Alarm alarm = (Alarm) alarmDAO.find(EQ(Alarm.NAME, name));

            long targetTime = health.getHeartbeatTime() +
              (getMissed() * health.getHeartbeatSchedule()) +
              health.getPropogationTime();

            if ( System.currentTimeMillis() > targetTime ) {
              logger.warning("heartbeat", "missed", health.getId());
              health = (Health) health.fclone();
              health.setStatus(getUnhealthyStatus());
              health.setUpTime(0L);
              ((DAO) x.get("healthDAO")).put_(x, health);

              if ( alarm != null ) {
                if ( ! alarm.getIsActive() ) {
                  alarm = (Alarm) alarm.fclone();
                  alarm.setIsActive(true);
                  alarmDAO.put(alarm);
                }
              } else {
                alarm = new Alarm(name);
                alarm.setSeverity(foam.log.LogLevel.INFO);
                alarm.setReason(AlarmReason.TIMEOUT);
                alarm.setClusterable(false);
                alarm.setNote("heartbeats missed "+health.toSummary());
                alarmDAO.put(alarm);
              }
            } else if ( alarm != null &&
                        alarm.getIsActive() ) {
              alarm = (Alarm) alarm.fclone();
              alarm.setIsActive(false);
              alarmDAO.put(alarm);
            }
          }

          public void remove(Object obj, Detachable sub) {}
          public void eof() {}
          public void reset(Detachable sub) {}
        }
      );
      `
    },
    {
      documentation: `DIRECT-mode health gathering. foam-saf getPeers() supplies
        the enabled SAF peers as host:heartbeatPort; poll each peer's HTTPS
        /service/health instead of waiting for a UDP heartbeat (which DIRECT
        cannot deliver in a many-to-one topology: the monitor has no peers to
        unicast to, and a sender never hears itself). A 200 returns the peer's
        own Health (?format=json), stored with a fresh heartbeatTime so the SAF
        forward gate (SAFManager) sees the destination UP. Also refresh this
        instance's own Health row, which DIRECT's lack of self-loopback would
        otherwise leave missing ("Health not found, creating default"). The poll
        reuses the SAF self-signed cert via sslContextFactory; it trusts that
        cert like SAF's sockets do but skips HTTP hostname verification, which
        those sockets also do not perform.`,
      name: 'pollPeers',
      args: 'X x, foam.core.app.HealthHeartbeatService service',
      javaCode: `
      Logger logger = Loggers.logger(x, this);
      DAO healthDAO = (DAO) x.get("healthDAO");

      // Refresh self so getLocalHealth finds a current row under DIRECT.
      Health self = (Health) ((Health) x.get("Health")).fclone();
      self.setHeartbeatTime(System.currentTimeMillis());
      self.setHeartbeatSchedule(getTimerInterval());
      healthDAO.put_(x, self);

      SslContextFactory sslFactory = (SslContextFactory) x.get("sslContextFactory");
      int webPort = Port.get(x, "http");

      List peers = service.getPeers(x);
      for ( int i = 0 ; i < peers.size() ; i++ ) {
        String host = ((InetSocketAddress) peers.get(i)).getHostString();
        String spec = "https://" + host + ":" + webPort + "/service/health?format=json";
        long sendTime = System.currentTimeMillis();
        try {
          URL url = new URL(spec);
          HttpsURLConnection conn = (HttpsURLConnection) url.openConnection();
          if ( sslFactory != null ) {
            SSLContext ctx = sslFactory.getSSLContext(x);
            conn.setSSLSocketFactory(ctx.getSocketFactory());
          }
          conn.setHostnameVerifier(new HostnameVerifier() {
            public boolean verify(String h, SSLSession s) { return true; }
          });
          conn.setRequestMethod("GET");
          conn.setConnectTimeout(3000);
          conn.setReadTimeout(5000);

          int code = conn.getResponseCode();
          long recvTime = System.currentTimeMillis();
          if ( code == 200 ) {
            StringBuilder sb = new StringBuilder();
            try ( BufferedReader r = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8)) ) {
              for ( String line ; ( line = r.readLine() ) != null ; ) sb.append(line).append('\\n');
            }
            Health health = (Health) x.create(JSONParser.class).parseString(sb.toString(), Health.class);
            if ( health == null ) {
              logger.warning("poll", "parse failed", host);
              markPeerDown(x, host);
              continue;
            }
            health.setAddress(host);
            health.setHeartbeatTime(recvTime);
            health.setHeartbeatSchedule(getTimerInterval());
            health.setPropogationTime(recvTime - sendTime);
            healthDAO.put_(x, health);
          } else {
            logger.warning("poll", host, "status", code);
            markPeerDown(x, host);
          }
        } catch ( Throwable t ) {
          logger.warning("poll", host, "failed", t.getMessage());
          markPeerDown(x, host);
        }
      }
      `
    },
    {
      documentation: `Mark a peer down when its poll fails. Uses the last stored
        row for that address, which carries the peer's real Health id; if the
        peer has never answered there is no row, and none is synthesised -- the
        SAF forward gate already treats a missing destination health as not-UP,
        so nothing forwards, which is the right outcome for a monitor never
        seen.`,
      name: 'markPeerDown',
      args: 'X x, String address',
      javaCode: `
      DAO healthDAO = (DAO) x.get("healthDAO");
      Health health = (Health) healthDAO.find(EQ(Health.ADDRESS, address));
      if ( health == null ) return;
      if ( health.getStatus() == getUnhealthyStatus() ) return;
      health = (Health) health.fclone();
      health.setStatus(getUnhealthyStatus());
      health.setUpTime(0L);
      healthDAO.put_(x, health);
      `
    }
  ]
});
