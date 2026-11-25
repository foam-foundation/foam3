/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.cron.test',
  name: 'CronSchedulerPoolStopTest',
  extends: 'foam.core.test.Test',

  documentation: `
    Proves the CronScheduler loop ends when threadPool, the pool it runs on,
    stops. The loop ignores other interrupts, and ThreadPoolAgency.stop() waits
    for every task, so a loop that kept going would hold shutdown for the whole
    shutdownTimeout.
  `,

  javaImports: [
    'foam.core.cron.Cron',
    'foam.core.cron.CronScheduler',
    'foam.core.cron.Schedulable',
    'foam.core.pool.ThreadPoolAgency',
    'foam.dao.MDAO',
    'foam.lang.X'
  ],

  constants: [
    {
      name: 'SHUTDOWN_TIMEOUT',
      type: 'Long',
      value: 3000
    }
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        ThreadPoolAgency agency = new ThreadPoolAgency.Builder(x)
          .setPrefix("cron-stop-test")
          .setNumberOfThreads(1)
          .setShutdownTimeout(SHUTDOWN_TIMEOUT)
          .build();
        try {
          agency.start();
        } catch (Exception e) {
          throw new RuntimeException(e);
        }

        // Empty DAOs, so the loop finds nothing to schedule and only sleeps.
        X cx = x
          .put("threadPool", agency)
          .put("cronSchedulerPoolStopTestCronDAO", new MDAO(Cron.getOwnClassInfo()))
          .put("cronSchedulerPoolStopTestSchedulableDAO", new MDAO(Schedulable.getOwnClassInfo()));
        CronScheduler scheduler = new CronScheduler.Builder(cx)
          .setCronJobDAO("cronSchedulerPoolStopTestCronDAO")
          .setSchedulableDAO("cronSchedulerPoolStopTestSchedulableDAO")
          .build();
        agency.submit(cx, scheduler, "CronScheduler");

        long deadline = System.currentTimeMillis() + 5000;
        while ( agency.getExecuting() == 0 && System.currentTimeMillis() < deadline ) {
          try {
            Thread.sleep(50);
          } catch (InterruptedException e) {
            break;
          }
        }
        expect(agency.getExecuting(), 1L, "scheduler loop is running on the pool");

        long start = System.currentTimeMillis();
        agency.stop();
        long elapsed = System.currentTimeMillis() - start;
        test(elapsed < SHUTDOWN_TIMEOUT, "scheduler loop ended when its pool stopped, elapsed " + elapsed + " ms");
      `
    }
  ]
});
