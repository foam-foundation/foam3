/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.cron.test',
  name: 'CronSchedulerStopTest',
  extends: 'foam.core.test.Test',

  documentation: `
    Proves CronScheduler.stop(), which the shutdown hook calls, interrupts every
    running cron and waits for it to finish, up to shutdownTimeout.

    Cron threads are daemons, so without the wait the JVM kills a cron in the
    middle of its cleanup, for example a cron undoing a half-finished import.
  `,

  javaImports: [
    'foam.core.cron.Cron',
    'foam.core.cron.CronScheduleDAO',
    'foam.core.cron.CronScheduler',
    'foam.core.script.ScriptRunnerDAO',
    'foam.core.script.ScriptStatus',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.lang.X',
    'java.util.Date'
  ],

  constants: [
    {
      name: 'SHUTDOWN_TIMEOUT',
      type: 'Long',
      value: 1500
    },
    {
      // Sleeps until interrupted, then takes 300 ms to clean up, as a cron
      // undoing a half-finished import would.
      name: 'COOPERATIVE_CODE',
      type: 'String',
      value: 'try { while ( true ) Thread.sleep(50); } catch ( InterruptedException e ) { Thread.sleep(300); print("cleaned up"); }'
    },
    {
      // Catches every interrupt and keeps going for 4 s, longer than SHUTDOWN_TIMEOUT.
      name: 'SWALLOWING_CODE',
      type: 'String',
      value: 'long end = System.currentTimeMillis() + 4000; while ( System.currentTimeMillis() < end ) { try { Thread.sleep(50); } catch ( InterruptedException e ) { } }'
    }
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        MDAO mdao = new MDAO(Cron.getOwnClassInfo());
        DAO  dao  = new ScriptRunnerDAO(new CronScheduleDAO.Builder(x).setDelegate(mdao).build());
        // A finished cron writes itself back to x.get(daoKey), "cronJobDAO" by default.
        X    cx   = x.put("cronJobDAO", dao);

        CronScheduler scheduler = new CronScheduler.Builder(cx)
          .setCronJobDAO("cronJobDAO")
          .setShutdownTimeout(SHUTDOWN_TIMEOUT)
          .build();

        test(startCron(cx, dao, mdao, "cron-stop-cooperative", COOPERATIVE_CODE), "cooperative cron is running");
        long start = System.currentTimeMillis();
        scheduler.stop();
        long elapsed = System.currentTimeMillis() - start;
        Cron cron = (Cron) mdao.find("cron-stop-cooperative");
        test(elapsed < SHUTDOWN_TIMEOUT, "stop returned once the cooperative cron finished, elapsed " + elapsed + " ms");
        expect(cron.getStatus(), ScriptStatus.UNSCHEDULED, "cooperative cron finished before stop returned");
        test(cron.getOutput().contains("cleaned up"), "cooperative cron ran its cleanup, output: " + cron.getOutput());

        test(startCron(cx, dao, mdao, "cron-stop-swallowing", SWALLOWING_CODE), "swallowing cron is running");
        start = System.currentTimeMillis();
        scheduler.stop();
        elapsed = System.currentTimeMillis() - start;
        cron = (Cron) mdao.find("cron-stop-swallowing");
        test(elapsed >= SHUTDOWN_TIMEOUT && elapsed < 4000, "stop gave up after shutdownTimeout, elapsed " + elapsed + " ms");
        expect(cron.getStatus(), ScriptStatus.INTERRUPTED, "swallowing cron was interrupted and is still running");
      `
    },
    {
      // Puts the cron SCHEDULED, which ScriptRunnerDAO runs on the thread pool,
      // and waits up to 5 s for its thread to start.
      name: 'startCron',
      args: 'X x, DAO dao, DAO mdao, String id, String code',
      type: 'Boolean',
      javaCode: `
        Cron cron = new Cron.Builder(x).setId(id).setCode(code).build();
        cron.setStatus(ScriptStatus.SCHEDULED);
        // A bare MDAO has no LastModifiedAware decorator to stamp this, and the
        // run's finally block compares it against the stored cron's.
        cron.setLastModified(new Date());
        dao.put_(x, cron);

        long deadline = System.currentTimeMillis() + 5000;
        while ( System.currentTimeMillis() < deadline ) {
          Cron stored = (Cron) mdao.find(id);
          if ( stored.getStatus() == ScriptStatus.RUNNING && stored.getThreadStartTime() > 0 ) return true;
          try {
            Thread.sleep(50);
          } catch (InterruptedException e) {
            return false;
          }
        }
        return false;
      `
    }
  ]
});
