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
    stops, and keeps running when the pool is only reloaded.

    ThreadPoolAgency.stop() waits for every task, so a loop that kept going
    would hold shutdown for the whole shutdownTimeout. reload() interrupts the
    loop too, but the server carries on, so the loop must not end there.
  `,

  javaImports: [
    'foam.core.cron.Cron',
    'foam.core.cron.CronScheduler',
    'foam.core.cron.Schedulable',
    'foam.core.pool.ThreadPoolAgency',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.dao.ProxyDAO',
    'foam.dao.Sink',
    'foam.lang.X',
    'foam.mlang.order.Comparator',
    'foam.mlang.predicate.Predicate',
    'java.util.concurrent.atomic.AtomicLong'
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
        stopEndsLoop(x);
        reloadKeepsLoop(x);
      `
    },
    {
      name: 'stopEndsLoop',
      args: 'Context x',
      javaCode: `
        ThreadPoolAgency agency = startAgency(x);
        AtomicLong       passes = new AtomicLong();
        startScheduler(x, agency, passes);

        long start = System.currentTimeMillis();
        agency.stop();
        long elapsed = System.currentTimeMillis() - start;
        test(elapsed < SHUTDOWN_TIMEOUT, "stop did not wait for the scheduler loop, elapsed " + elapsed + " ms");
        test(! advances(passes), "scheduler loop ended when its pool stopped");
      `
    },
    {
      name: 'reloadKeepsLoop',
      args: 'Context x',
      javaCode: `
        ThreadPoolAgency agency    = startAgency(x);
        AtomicLong       passes    = new AtomicLong();
        startScheduler(x, agency, passes);

        agency.reload();
        test(advances(passes), "scheduler loop kept running after its pool reloaded");

        // The loop still runs on a thread of the pool reload() replaced. stop()
        // waits for that pool too, so the loop must see stopping after its next
        // sleep (100 ms here) and end.
        long start = System.currentTimeMillis();
        agency.stop();
        long elapsed = System.currentTimeMillis() - start;
        test(elapsed < SHUTDOWN_TIMEOUT, "stop after a reload did not wait for the scheduler loop, elapsed " + elapsed + " ms");

        test(! advances(passes), "scheduler loop ended when its pool stopped after a reload");
      `
    },
    {
      name: 'startAgency',
      args: 'Context x',
      javaType: 'ThreadPoolAgency',
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
        return agency;
      `
    },
    {
      // Runs the loop on agency as threadPool, over empty DAOs so it only
      // sleeps, every 100 ms. Each pass selects from the cron DAO and bumps
      // passes, and the method returns once the first pass is in.
      name: 'startScheduler',
      args: [
        { name: 'x',      type: 'Context' },
        { name: 'agency', javaType: 'ThreadPoolAgency' },
        { name: 'passes', javaType: 'java.util.concurrent.atomic.AtomicLong' }
      ],
      javaCode: `
        DAO cronDAO = new ProxyDAO(x, new MDAO(Cron.getOwnClassInfo())) {
          @Override
          public Sink select_(X x, Sink sink, long skip, long limit, Comparator order, Predicate predicate) {
            passes.incrementAndGet();
            return super.select_(x, sink, skip, limit, order, predicate);
          }
        };
        X cx = x
          .put("threadPool", agency)
          .put("cronSchedulerPoolStopTestCronDAO", cronDAO)
          .put("cronSchedulerPoolStopTestSchedulableDAO", new MDAO(Schedulable.getOwnClassInfo()));
        CronScheduler scheduler = new CronScheduler.Builder(cx)
          .setCronJobDAO("cronSchedulerPoolStopTestCronDAO")
          .setSchedulableDAO("cronSchedulerPoolStopTestSchedulableDAO")
          .setCronDelay(100)
          .build();
        agency.submit(cx, scheduler, "CronScheduler");

        long deadline = System.currentTimeMillis() + 5000;
        while ( passes.get() == 0 && System.currentTimeMillis() < deadline ) {
          try {
            Thread.sleep(50);
          } catch (InterruptedException e) {
            break;
          }
        }
        test(passes.get() > 0, "scheduler loop is running on the pool");
      `
    },
    {
      // True when the loop makes another pass within 1 s, ten times its delay.
      name: 'advances',
      args: [ { name: 'passes', javaType: 'java.util.concurrent.atomic.AtomicLong' } ],
      javaType: 'boolean',
      javaCode: `
        long before = passes.get();
        try {
          Thread.sleep(1000);
        } catch (InterruptedException e) {
          return false;
        }
        return passes.get() > before;
      `
    }
  ]
});
